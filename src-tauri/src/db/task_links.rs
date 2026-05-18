use rusqlite::{params, Connection};
use std::collections::HashSet;

pub fn add_link(conn: &mut Connection, pred: i64, succ: i64) -> Result<(), String> {
    if pred == succ {
        return Err("Una task non può essere predecessore di se stessa".into());
    }
    let (pred_exam, succ_exam): (Option<i64>, Option<i64>) = conn.query_row(
        "SELECT (SELECT exam_id FROM tasks WHERE id = ?1),
                (SELECT exam_id FROM tasks WHERE id = ?2)",
        params![pred, succ],
        |r| Ok((r.get(0)?, r.get(1)?)),
    ).map_err(|e| format!("lookup tasks: {e}"))?;
    let pred_exists = pred_exam.is_some()
        || conn.query_row("SELECT 1 FROM tasks WHERE id = ?1", params![pred], |_| Ok(true)).unwrap_or(false);
    let succ_exists = succ_exam.is_some()
        || conn.query_row("SELECT 1 FROM tasks WHERE id = ?1", params![succ], |_| Ok(true)).unwrap_or(false);
    if !pred_exists { return Err(format!("Task predecessore {pred} non esiste")); }
    if !succ_exists { return Err(format!("Task successore {succ} non esiste")); }
    if let (Some(pe), Some(se)) = (pred_exam, succ_exam) {
        if pe != se {
            return Err("Task di esami diversi non possono essere linkate (a meno che una sia libera)".into());
        }
    }
    if reachable(conn, succ, pred)? {
        return Err("Il link creerebbe un ciclo".into());
    }
    conn.execute(
        "INSERT OR IGNORE INTO task_links (predecessor_id, successor_id) VALUES (?1, ?2)",
        params![pred, succ],
    ).map_err(|e| format!("insert link: {e}"))?;
    Ok(())
}

pub fn remove_link(conn: &Connection, pred: i64, succ: i64) -> Result<(), String> {
    conn.execute(
        "DELETE FROM task_links WHERE predecessor_id = ?1 AND successor_id = ?2",
        params![pred, succ],
    ).map_err(|e| format!("delete link: {e}"))?;
    Ok(())
}

fn reachable(conn: &Connection, from: i64, target: i64) -> Result<bool, String> {
    let mut stack = vec![from];
    let mut seen: HashSet<i64> = HashSet::new();
    while let Some(cur) = stack.pop() {
        if cur == target { return Ok(true); }
        if !seen.insert(cur) { continue; }
        let succs: Vec<i64> = conn.prepare(
            "SELECT successor_id FROM task_links WHERE predecessor_id = ?1"
        ).map_err(|e| format!("prepare reach: {e}"))?
        .query_map(params![cur], |r| r.get(0))
        .map_err(|e| format!("query reach: {e}"))?
        .collect::<rusqlite::Result<_,_>>().map_err(|e| format!("row reach: {e}"))?;
        stack.extend(succs);
    }
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::db::task_types::*;
    use crate::db::tasks;
    use crate::db::types::*;
    use crate::db::exams;

    fn make_task(conn: &mut Connection, title: &str, exam_id: Option<i64>) -> i64 {
        let input = TaskInput {
            title: title.into(), description: String::new(), exam_id,
            priority: TaskPriority::Normal, due_date: None, checklist: vec![],
        };
        tasks::create(conn, &input).unwrap().id
    }

    fn make_exam(conn: &mut Connection, name: &str) -> i64 {
        let input = ExamInput::Esame(EsameInputData {
            name: name.into(), color: "#112233".into(), icon: "book-open".into(),
            passed: false, default_study_minutes: 60, appelli: vec![],
        });
        exams::create(conn, &input).unwrap().base().id
    }

    #[test]
    fn add_basic_link() {
        let mut conn = open_in_memory().unwrap();
        let a = make_task(&mut conn, "A", None);
        let b = make_task(&mut conn, "B", None);
        add_link(&mut conn, a, b).unwrap();
        let n: i64 = conn.query_row("SELECT COUNT(*) FROM task_links", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 1);
    }

    #[test]
    fn add_self_link_rejected() {
        let mut conn = open_in_memory().unwrap();
        let a = make_task(&mut conn, "A", None);
        assert!(add_link(&mut conn, a, a).is_err());
    }

    #[test]
    fn add_cycle_rejected() {
        let mut conn = open_in_memory().unwrap();
        let a = make_task(&mut conn, "A", None);
        let b = make_task(&mut conn, "B", None);
        let c = make_task(&mut conn, "C", None);
        add_link(&mut conn, a, b).unwrap();
        add_link(&mut conn, b, c).unwrap();
        // Aggiungere C → A creerebbe un ciclo A→B→C→A
        let err = add_link(&mut conn, c, a).unwrap_err();
        assert!(err.contains("ciclo"), "got: {err}");
    }

    #[test]
    fn cross_exam_link_rejected() {
        let mut conn = open_in_memory().unwrap();
        let e1 = make_exam(&mut conn, "Neuro");
        let e2 = make_exam(&mut conn, "Biochim");
        let a = make_task(&mut conn, "A", Some(e1));
        let b = make_task(&mut conn, "B", Some(e2));
        let err = add_link(&mut conn, a, b).unwrap_err();
        assert!(err.contains("esami diversi"), "got: {err}");
    }

    #[test]
    fn same_exam_link_ok() {
        let mut conn = open_in_memory().unwrap();
        let e1 = make_exam(&mut conn, "Neuro");
        let a = make_task(&mut conn, "A", Some(e1));
        let b = make_task(&mut conn, "B", Some(e1));
        add_link(&mut conn, a, b).unwrap();
    }

    #[test]
    fn free_to_exam_link_ok() {
        let mut conn = open_in_memory().unwrap();
        let e1 = make_exam(&mut conn, "Neuro");
        let free = make_task(&mut conn, "Comprare libro", None);
        let exam_t = make_task(&mut conn, "Studia cap 1", Some(e1));
        add_link(&mut conn, free, exam_t).unwrap();
    }

    #[test]
    fn missing_task_rejected() {
        let mut conn = open_in_memory().unwrap();
        let a = make_task(&mut conn, "A", None);
        assert!(add_link(&mut conn, a, 9999).is_err());
        assert!(add_link(&mut conn, 9999, a).is_err());
    }

    #[test]
    fn duplicate_link_idempotent() {
        let mut conn = open_in_memory().unwrap();
        let a = make_task(&mut conn, "A", None);
        let b = make_task(&mut conn, "B", None);
        add_link(&mut conn, a, b).unwrap();
        add_link(&mut conn, a, b).unwrap(); // INSERT OR IGNORE
        let n: i64 = conn.query_row("SELECT COUNT(*) FROM task_links", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 1);
    }

    #[test]
    fn remove_link_works() {
        let mut conn = open_in_memory().unwrap();
        let a = make_task(&mut conn, "A", None);
        let b = make_task(&mut conn, "B", None);
        add_link(&mut conn, a, b).unwrap();
        remove_link(&conn, a, b).unwrap();
        let n: i64 = conn.query_row("SELECT COUNT(*) FROM task_links", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn delete_task_cascades_links() {
        let mut conn = open_in_memory().unwrap();
        let a = make_task(&mut conn, "A", None);
        let b = make_task(&mut conn, "B", None);
        add_link(&mut conn, a, b).unwrap();
        tasks::delete(&conn, a).unwrap();
        let n: i64 = conn.query_row("SELECT COUNT(*) FROM task_links", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn diamond_dag_allowed() {
        // A → B, A → C, B → D, C → D (diamante, due path A-B-D e A-C-D)
        let mut conn = open_in_memory().unwrap();
        let a = make_task(&mut conn, "A", None);
        let b = make_task(&mut conn, "B", None);
        let c = make_task(&mut conn, "C", None);
        let d = make_task(&mut conn, "D", None);
        add_link(&mut conn, a, b).unwrap();
        add_link(&mut conn, a, c).unwrap();
        add_link(&mut conn, b, d).unwrap();
        add_link(&mut conn, c, d).unwrap();
        let n: i64 = conn.query_row("SELECT COUNT(*) FROM task_links", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 4);
    }
}
