use rusqlite::{params, Connection, Result as SqlResult};
use crate::db::task_types::*;

pub fn create(conn: &mut Connection, input: &TaskInput) -> Result<Task, String> {
    let title = validate_task_input(input)?;
    let tx = conn.transaction().map_err(|e| format!("tx: {e}"))?;
    tx.execute(
        "INSERT INTO tasks (title, description, exam_id, priority, due_date) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![title, input.description, input.exam_id, input.priority.as_str(), input.due_date],
    ).map_err(|e| format!("insert task: {e}"))?;
    let id = tx.last_insert_rowid();
    for item in &input.checklist {
        tx.execute(
            "INSERT INTO task_checklist (task_id, label, done, position) VALUES (?1, ?2, ?3, ?4)",
            params![id, item.label.trim(), item.done as i64, item.position],
        ).map_err(|e| format!("insert checklist: {e}"))?;
    }
    tx.commit().map_err(|e| format!("commit: {e}"))?;
    get_by_id(conn, id)
}

pub fn list(conn: &Connection) -> Result<Vec<Task>, String> {
    let ids: Vec<i64> = conn.prepare(
        "SELECT id FROM tasks ORDER BY done ASC, created_at ASC"
    ).map_err(|e| format!("prepare list: {e}"))?
    .query_map([], |r| r.get::<_, i64>(0))
    .map_err(|e| format!("query list: {e}"))?
    .collect::<SqlResult<_>>().map_err(|e| format!("row list: {e}"))?;
    let mut out = Vec::with_capacity(ids.len());
    for id in ids { out.push(get_by_id(conn, id)?); }
    Ok(out)
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Task, String> {
    let (title, description, exam_id, priority, due_date, done): (
        String, String, Option<i64>, String, Option<String>, i64
    ) = conn.query_row(
        "SELECT title, description, exam_id, priority, due_date, done FROM tasks WHERE id = ?1",
        params![id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)),
    ).map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => format!("Task {id} non trovato"),
        e => format!("select task: {e}"),
    })?;
    let checklist = load_checklist(conn, id)?;
    let (predecessor_ids, successor_ids) = load_links(conn, id)?;
    Ok(Task {
        id, title, description, exam_id,
        priority: TaskPriority::from_str(&priority)?,
        due_date, done: done != 0,
        checklist, predecessor_ids, successor_ids,
    })
}

fn load_checklist(conn: &Connection, task_id: i64) -> Result<Vec<ChecklistItem>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, label, done, position FROM task_checklist WHERE task_id = ?1 ORDER BY position"
    ).map_err(|e| format!("prepare checklist: {e}"))?;
    let rows = stmt.query_map(params![task_id], |r| {
        Ok(ChecklistItem {
            id: r.get(0)?, label: r.get(1)?, done: r.get::<_,i64>(2)? != 0, position: r.get(3)?,
        })
    }).map_err(|e| format!("query checklist: {e}"))?;
    rows.collect::<SqlResult<Vec<_>>>().map_err(|e| format!("row checklist: {e}"))
}

fn load_links(conn: &Connection, task_id: i64) -> Result<(Vec<i64>, Vec<i64>), String> {
    let preds: Vec<i64> = conn.prepare(
        "SELECT predecessor_id FROM task_links WHERE successor_id = ?1 ORDER BY predecessor_id"
    ).map_err(|e| format!("prep preds: {e}"))?
    .query_map(params![task_id], |r| r.get(0))
    .map_err(|e| format!("query preds: {e}"))?
    .collect::<SqlResult<_>>().map_err(|e| format!("row preds: {e}"))?;
    let succs: Vec<i64> = conn.prepare(
        "SELECT successor_id FROM task_links WHERE predecessor_id = ?1 ORDER BY successor_id"
    ).map_err(|e| format!("prep succs: {e}"))?
    .query_map(params![task_id], |r| r.get(0))
    .map_err(|e| format!("query succs: {e}"))?
    .collect::<SqlResult<_>>().map_err(|e| format!("row succs: {e}"))?;
    Ok((preds, succs))
}

pub fn update(conn: &mut Connection, id: i64, input: &TaskInput) -> Result<Task, String> {
    let title = validate_task_input(input)?;
    // Check that exam change doesn't break existing links
    if let Some(new_exam) = input.exam_id {
        let incompatible: i64 = conn.query_row(
            "SELECT COUNT(*) FROM (
                SELECT t.exam_id FROM tasks t
                JOIN task_links l ON (l.predecessor_id = t.id OR l.successor_id = t.id)
                WHERE (l.predecessor_id = ?1 OR l.successor_id = ?1) AND t.id != ?1
                  AND t.exam_id IS NOT NULL AND t.exam_id != ?2
            )",
            params![id, new_exam],
            |r| r.get(0),
        ).unwrap_or(0);
        if incompatible > 0 {
            return Err("Rimuovi prima i link verso task di altri esami".into());
        }
    }
    let tx = conn.transaction().map_err(|e| format!("tx: {e}"))?;
    let changed = tx.execute(
        "UPDATE tasks SET title = ?1, description = ?2, exam_id = ?3, priority = ?4,
                          due_date = ?5, updated_at = datetime('now') WHERE id = ?6",
        params![title, input.description, input.exam_id, input.priority.as_str(), input.due_date, id],
    ).map_err(|e| format!("update task: {e}"))?;
    if changed == 0 { return Err(format!("Task {id} non trovato")); }
    tx.execute("DELETE FROM task_checklist WHERE task_id = ?1", params![id])
        .map_err(|e| format!("delete checklist: {e}"))?;
    for item in &input.checklist {
        tx.execute(
            "INSERT INTO task_checklist (task_id, label, done, position) VALUES (?1, ?2, ?3, ?4)",
            params![id, item.label.trim(), item.done as i64, item.position],
        ).map_err(|e| format!("insert checklist: {e}"))?;
    }
    tx.commit().map_err(|e| format!("commit: {e}"))?;
    get_by_id(conn, id)
}

pub fn delete(conn: &Connection, id: i64) -> Result<(), String> {
    let changed = conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])
        .map_err(|e| format!("delete task: {e}"))?;
    if changed == 0 { return Err(format!("Task {id} non trovato")); }
    Ok(())
}

pub fn set_done(conn: &Connection, id: i64, done: bool) -> Result<(), String> {
    let changed = conn.execute(
        "UPDATE tasks SET done = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![done as i64, id],
    ).map_err(|e| format!("update done: {e}"))?;
    if changed == 0 { return Err(format!("Task {id} non trovato")); }
    Ok(())
}

pub fn set_checklist_item_done(conn: &Connection, item_id: i64, done: bool) -> Result<(), String> {
    let changed = conn.execute(
        "UPDATE task_checklist SET done = ?1 WHERE id = ?2",
        params![done as i64, item_id],
    ).map_err(|e| format!("update checklist item: {e}"))?;
    if changed == 0 { return Err(format!("Checklist item {item_id} non trovato")); }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    fn sample() -> TaskInput {
        TaskInput {
            title: "Scrivere capitolo 1".into(),
            description: "Bozza".into(),
            exam_id: None,
            priority: TaskPriority::Normal,
            due_date: Some("2026-05-20".into()),
            checklist: vec![
                ChecklistItemInput { label: "Outline".into(), done: false, position: 0 },
                ChecklistItemInput { label: "Stesura".into(), done: false, position: 1 },
            ],
        }
    }

    #[test]
    fn create_then_get() {
        let mut conn = open_in_memory().unwrap();
        let t = create(&mut conn, &sample()).unwrap();
        assert_eq!(t.title, "Scrivere capitolo 1");
        assert_eq!(t.checklist.len(), 2);
        assert_eq!(t.checklist[0].label, "Outline");
        assert!(!t.done);
        assert!(t.predecessor_ids.is_empty());
        assert!(t.successor_ids.is_empty());
    }

    #[test]
    fn list_orders_active_first() {
        let mut conn = open_in_memory().unwrap();
        let t1 = create(&mut conn, &sample()).unwrap();
        let mut s2 = sample(); s2.title = "Altra".into();
        let t2 = create(&mut conn, &s2).unwrap();
        set_done(&conn, t1.id, true).unwrap();
        let list = list(&conn).unwrap();
        assert_eq!(list[0].id, t2.id); // non-done first
        assert_eq!(list[1].id, t1.id);
    }

    #[test]
    fn update_replaces_checklist() {
        let mut conn = open_in_memory().unwrap();
        let t = create(&mut conn, &sample()).unwrap();
        let mut next = sample();
        next.title = "Rinominata".into();
        next.checklist = vec![
            ChecklistItemInput { label: "Solo questo".into(), done: true, position: 0 },
        ];
        let upd = update(&mut conn, t.id, &next).unwrap();
        assert_eq!(upd.title, "Rinominata");
        assert_eq!(upd.checklist.len(), 1);
        assert!(upd.checklist[0].done);
    }

    #[test]
    fn delete_cascades_checklist() {
        let mut conn = open_in_memory().unwrap();
        let t = create(&mut conn, &sample()).unwrap();
        delete(&conn, t.id).unwrap();
        let n: i64 = conn.query_row("SELECT COUNT(*) FROM task_checklist", [], |r| r.get(0)).unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn set_done_toggles() {
        let mut conn = open_in_memory().unwrap();
        let t = create(&mut conn, &sample()).unwrap();
        set_done(&conn, t.id, true).unwrap();
        assert!(get_by_id(&conn, t.id).unwrap().done);
        set_done(&conn, t.id, false).unwrap();
        assert!(!get_by_id(&conn, t.id).unwrap().done);
    }

    #[test]
    fn set_checklist_item_done_works() {
        let mut conn = open_in_memory().unwrap();
        let t = create(&mut conn, &sample()).unwrap();
        let first_id = t.checklist[0].id;
        set_checklist_item_done(&conn, first_id, true).unwrap();
        let reread = get_by_id(&conn, t.id).unwrap();
        assert!(reread.checklist[0].done);
        assert!(!reread.checklist[1].done);
    }

    #[test]
    fn delete_missing_id_errors() {
        let conn = open_in_memory().unwrap();
        assert!(delete(&conn, 999).is_err());
    }
}
