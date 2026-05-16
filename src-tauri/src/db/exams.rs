use rusqlite::{params, Connection, Result as SqlResult};
use crate::db::types::*;

pub fn create(conn: &mut Connection, input: &ExamInput) -> Result<Exam, String> {
    let name = validate_input(input)?;
    let tx = conn.transaction().map_err(|e| format!("tx: {e}"))?;
    tx.execute(
        "INSERT INTO exams (name, color, kind, passed) VALUES (?1, ?2, ?3, ?4)",
        params![name, input.color, input.kind.as_str(), input.passed as i64],
    ).map_err(|e| format!("insert exam: {e}"))?;
    let id = tx.last_insert_rowid();
    for d in &input.appelli {
        tx.execute(
            "INSERT INTO appelli (exam_id, date) VALUES (?1, ?2)",
            params![id, d],
        ).map_err(|e| format!("insert appello: {e}"))?;
    }
    for r in &input.ranges {
        tx.execute(
            "INSERT INTO project_ranges (exam_id, start_date, end_date) VALUES (?1, ?2, ?3)",
            params![id, r.start, r.end],
        ).map_err(|e| format!("insert range: {e}"))?;
    }
    tx.commit().map_err(|e| format!("commit: {e}"))?;
    get_by_id(conn, id)
}

pub fn list(conn: &Connection) -> Result<Vec<Exam>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color, kind, passed FROM exams ORDER BY name COLLATE NOCASE"
    ).map_err(|e| format!("prepare: {e}"))?;
    let rows = stmt.query_map([], |r| {
        Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?,
            r.get::<_, String>(3)?, r.get::<_, i64>(4)?))
    }).map_err(|e| format!("query: {e}"))?;
    let mut out = Vec::new();
    for row in rows {
        let (id, name, color, kind_str, passed) = row.map_err(|e| format!("row: {e}"))?;
        out.push(build_exam(conn, id, name, color, &kind_str, passed != 0)?);
    }
    Ok(out)
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Exam, String> {
    let (name, color, kind_str, passed): (String, String, String, i64) = conn.query_row(
        "SELECT name, color, kind, passed FROM exams WHERE id = ?1",
        params![id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
    ).map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => format!("Esame {id} non trovato"),
        e => format!("select exam: {e}"),
    })?;
    build_exam(conn, id, name, color, &kind_str, passed != 0)
}

fn build_exam(
    conn: &Connection,
    id: i64,
    name: String,
    color: String,
    kind_str: &str,
    passed: bool,
) -> Result<Exam, String> {
    let kind = ExamKind::from_str(kind_str)?;
    let appelli = load_appelli(conn, id)?;
    let ranges = load_ranges(conn, id)?;
    let study_days = load_study_days(conn, id)?;
    Ok(Exam { id, name, color, kind, passed, appelli, ranges, study_days })
}

fn load_appelli(conn: &Connection, exam_id: i64) -> Result<Vec<Appello>, String> {
    let mut stmt = conn.prepare("SELECT id, date FROM appelli WHERE exam_id = ?1 ORDER BY date")
        .map_err(|e| format!("prepare appelli: {e}"))?;
    let rows: SqlResult<Vec<Appello>> = stmt.query_map(params![exam_id], |r| {
        Ok(Appello { id: r.get(0)?, date: r.get(1)? })
    }).and_then(|it| it.collect());
    rows.map_err(|e| format!("query appelli: {e}"))
}

fn load_ranges(conn: &Connection, exam_id: i64) -> Result<Vec<ProjectRange>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, start_date, end_date FROM project_ranges WHERE exam_id = ?1 ORDER BY start_date"
    ).map_err(|e| format!("prepare ranges: {e}"))?;
    let rows: SqlResult<Vec<ProjectRange>> = stmt.query_map(params![exam_id], |r| {
        Ok(ProjectRange { id: r.get(0)?, start: r.get(1)?, end: r.get(2)? })
    }).and_then(|it| it.collect());
    rows.map_err(|e| format!("query ranges: {e}"))
}

fn load_study_days(conn: &Connection, exam_id: i64) -> Result<Vec<StudyDay>, String> {
    let mut stmt = conn.prepare(
        "SELECT date, minutes FROM study_days WHERE exam_id = ?1 ORDER BY date"
    ).map_err(|e| format!("prepare study_days: {e}"))?;
    let rows: SqlResult<Vec<StudyDay>> = stmt.query_map(params![exam_id], |r| {
        Ok(StudyDay { date: r.get(0)?, minutes: r.get(1)? })
    }).and_then(|it| it.collect());
    rows.map_err(|e| format!("query study_days: {e}"))
}

pub fn set_study_day_minutes(conn: &Connection, exam_id: i64, date: &str, minutes: Option<i32>) -> Result<(), String> {
    crate::db::types::validate_date(date)?;
    if let Some(m) = minutes {
        if m < 0 || m > 24 * 60 {
            return Err(format!("Minuti non validi: {m} (0..1440)"));
        }
    }
    let changed = conn.execute(
        "UPDATE study_days SET minutes = ?1 WHERE exam_id = ?2 AND date = ?3",
        params![minutes, exam_id, date],
    ).map_err(|e| format!("update minutes: {e}"))?;
    if changed == 0 {
        return Err(format!("Giorno di studio {date} non trovato per esame {exam_id}"));
    }
    Ok(())
}

pub fn update(conn: &mut Connection, id: i64, input: &ExamInput) -> Result<Exam, String> {
    let name = validate_input(input)?;
    let tx = conn.transaction().map_err(|e| format!("tx: {e}"))?;
    let changed = tx.execute(
        "UPDATE exams SET name = ?1, color = ?2, kind = ?3, passed = ?4,
                          updated_at = datetime('now') WHERE id = ?5",
        params![name, input.color, input.kind.as_str(), input.passed as i64, id],
    ).map_err(|e| format!("update exam: {e}"))?;
    if changed == 0 {
        return Err(format!("Esame {id} non trovato"));
    }
    tx.execute("DELETE FROM appelli WHERE exam_id = ?1", params![id])
        .map_err(|e| format!("delete appelli: {e}"))?;
    tx.execute("DELETE FROM project_ranges WHERE exam_id = ?1", params![id])
        .map_err(|e| format!("delete ranges: {e}"))?;
    for d in &input.appelli {
        tx.execute("INSERT INTO appelli (exam_id, date) VALUES (?1, ?2)", params![id, d])
            .map_err(|e| format!("insert appello: {e}"))?;
    }
    for r in &input.ranges {
        tx.execute(
            "INSERT INTO project_ranges (exam_id, start_date, end_date) VALUES (?1, ?2, ?3)",
            params![id, r.start, r.end],
        ).map_err(|e| format!("insert range: {e}"))?;
    }
    tx.commit().map_err(|e| format!("commit: {e}"))?;
    get_by_id(conn, id)
}

pub fn delete(conn: &Connection, id: i64) -> Result<(), String> {
    let changed = conn.execute("DELETE FROM exams WHERE id = ?1", params![id])
        .map_err(|e| format!("delete: {e}"))?;
    if changed == 0 {
        return Err(format!("Esame {id} non trovato"));
    }
    Ok(())
}

pub fn set_passed(conn: &Connection, id: i64, passed: bool) -> Result<(), String> {
    let changed = conn.execute(
        "UPDATE exams SET passed = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![passed as i64, id],
    ).map_err(|e| format!("update passed: {e}"))?;
    if changed == 0 {
        return Err(format!("Esame {id} non trovato"));
    }
    Ok(())
}

pub fn toggle_study_day(conn: &Connection, exam_id: i64, date: &str) -> Result<bool, String> {
    crate::db::types::validate_date(date)?;
    let exists: bool = conn.query_row(
        "SELECT 1 FROM study_days WHERE exam_id = ?1 AND date = ?2",
        params![exam_id, date],
        |_| Ok(true),
    ).unwrap_or(false);
    if exists {
        conn.execute(
            "DELETE FROM study_days WHERE exam_id = ?1 AND date = ?2",
            params![exam_id, date],
        ).map_err(|e| format!("delete study: {e}"))?;
        Ok(false)
    } else {
        let exam_exists: bool = conn.query_row(
            "SELECT 1 FROM exams WHERE id = ?1 AND kind = 'esame'",
            params![exam_id],
            |_| Ok(true),
        ).unwrap_or(false);
        if !exam_exists {
            return Err(format!("Esame {exam_id} non esistente o è un progetto"));
        }
        conn.execute(
            "INSERT INTO study_days (exam_id, date) VALUES (?1, ?2)",
            params![exam_id, date],
        ).map_err(|e| format!("insert study: {e}"))?;
        Ok(true)
    }
}

pub fn search(conn: &Connection, query: &str) -> Result<Vec<Exam>, String> {
    let q = query.trim();
    if q.is_empty() {
        return list(conn);
    }
    let mut stmt = conn.prepare(
        "SELECT id, name, color, kind, passed FROM exams
         WHERE name LIKE ?1 COLLATE NOCASE
         ORDER BY name COLLATE NOCASE"
    ).map_err(|e| format!("prepare search: {e}"))?;
    let pattern = format!("%{q}%");
    let rows = stmt.query_map(params![pattern], |r| {
        Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?,
            r.get::<_, String>(3)?, r.get::<_, i64>(4)?))
    }).map_err(|e| format!("query: {e}"))?;
    let mut out = Vec::new();
    for row in rows {
        let (id, name, color, kind_str, passed) = row.map_err(|e| format!("row: {e}"))?;
        out.push(build_exam(conn, id, name, color, &kind_str, passed != 0)?);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    pub(super) fn sample_esame() -> ExamInput {
        ExamInput {
            name: "Neuroanatomia".into(),
            color: "#E8543F".into(),
            kind: ExamKind::Esame,
            passed: false,
            appelli: vec!["2026-06-15".into(), "2026-07-10".into()],
            ranges: vec![],
        }
    }

    pub(super) fn sample_progetto() -> ExamInput {
        ExamInput {
            name: "Tesina Fisiologia".into(),
            color: "#27AE60".into(),
            kind: ExamKind::Progetto,
            passed: false,
            appelli: vec![],
            ranges: vec![DateRange { start: "2026-05-01".into(), end: "2026-05-15".into() }],
        }
    }

    #[test]
    fn create_and_get_esame() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_esame()).unwrap();
        assert_eq!(e.name, "Neuroanatomia");
        assert_eq!(e.kind, ExamKind::Esame);
        assert_eq!(e.appelli.len(), 2);
        assert_eq!(e.appelli[0].date, "2026-06-15");
        assert!(e.ranges.is_empty());
        assert!(e.study_days.is_empty());
        assert!(!e.passed);
    }

    #[test]
    fn create_progetto() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_progetto()).unwrap();
        assert_eq!(e.kind, ExamKind::Progetto);
        assert_eq!(e.ranges.len(), 1);
        assert_eq!(e.ranges[0].start, "2026-05-01");
        assert_eq!(e.ranges[0].end, "2026-05-15");
    }

    #[test]
    fn list_returns_all_sorted_by_name() {
        let mut conn = open_in_memory().unwrap();
        create(&mut conn, &sample_progetto()).unwrap();
        create(&mut conn, &sample_esame()).unwrap();
        let list = list(&conn).unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].name, "Neuroanatomia");
        assert_eq!(list[1].name, "Tesina Fisiologia");
    }

    #[test]
    fn create_rejects_invalid_input() {
        let mut conn = open_in_memory().unwrap();
        let bad = ExamInput {
            name: "".into(), color: "#000000".into(),
            kind: ExamKind::Esame, passed: false,
            appelli: vec![], ranges: vec![],
        };
        assert!(create(&mut conn, &bad).is_err());
    }

    #[test]
    fn update_replaces_appelli() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_esame()).unwrap();
        let mut next = sample_esame();
        next.name = "Neuroanat. (rinominato)".into();
        next.appelli = vec!["2026-09-01".into()];
        let updated = update(&mut conn, e.id, &next).unwrap();
        assert_eq!(updated.name, "Neuroanat. (rinominato)");
        assert_eq!(updated.appelli.len(), 1);
        assert_eq!(updated.appelli[0].date, "2026-09-01");
    }

    #[test]
    fn update_preserves_study_days() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_esame()).unwrap();
        conn.execute(
            "INSERT INTO study_days (exam_id, date) VALUES (?1, ?2)",
            params![e.id, "2026-06-01"],
        ).unwrap();
        let updated = update(&mut conn, e.id, &sample_esame()).unwrap();
        assert_eq!(updated.study_days.len(), 1);
        assert_eq!(updated.study_days[0].date, "2026-06-01");
    }

    #[test]
    fn delete_cascades_to_appelli_and_study_days() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_esame()).unwrap();
        conn.execute(
            "INSERT INTO study_days (exam_id, date) VALUES (?1, ?2)",
            params![e.id, "2026-06-01"],
        ).unwrap();
        delete(&conn, e.id).unwrap();
        let n_app: i64 = conn.query_row("SELECT COUNT(*) FROM appelli", [], |r| r.get(0)).unwrap();
        let n_sd:  i64 = conn.query_row("SELECT COUNT(*) FROM study_days", [], |r| r.get(0)).unwrap();
        assert_eq!(n_app, 0);
        assert_eq!(n_sd, 0);
    }

    #[test]
    fn delete_missing_id_errors() {
        let conn = open_in_memory().unwrap();
        assert!(delete(&conn, 999).is_err());
    }

    #[test]
    fn set_passed_toggles() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_esame()).unwrap();
        set_passed(&conn, e.id, true).unwrap();
        assert!(get_by_id(&conn, e.id).unwrap().passed);
        set_passed(&conn, e.id, false).unwrap();
        assert!(!get_by_id(&conn, e.id).unwrap().passed);
    }

    #[test]
    fn toggle_study_day_on_then_off() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_esame()).unwrap();
        assert!(toggle_study_day(&conn, e.id, "2026-06-01").unwrap());
        let days = get_by_id(&conn, e.id).unwrap().study_days;
        assert_eq!(days.len(), 1);
        assert_eq!(days[0].date, "2026-06-01");
        assert_eq!(days[0].minutes, None);
        assert!(!toggle_study_day(&conn, e.id, "2026-06-01").unwrap());
        assert!(get_by_id(&conn, e.id).unwrap().study_days.is_empty());
    }

    #[test]
    fn set_study_day_minutes_works() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_esame()).unwrap();
        toggle_study_day(&conn, e.id, "2026-06-01").unwrap();
        set_study_day_minutes(&conn, e.id, "2026-06-01", Some(90)).unwrap();
        let days = get_by_id(&conn, e.id).unwrap().study_days;
        assert_eq!(days[0].minutes, Some(90));
        set_study_day_minutes(&conn, e.id, "2026-06-01", None).unwrap();
        assert_eq!(get_by_id(&conn, e.id).unwrap().study_days[0].minutes, None);
    }

    #[test]
    fn set_study_day_minutes_rejects_out_of_range() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_esame()).unwrap();
        toggle_study_day(&conn, e.id, "2026-06-01").unwrap();
        assert!(set_study_day_minutes(&conn, e.id, "2026-06-01", Some(-1)).is_err());
        assert!(set_study_day_minutes(&conn, e.id, "2026-06-01", Some(2000)).is_err());
    }

    #[test]
    fn toggle_study_day_rejects_on_progetto() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_progetto()).unwrap();
        assert!(toggle_study_day(&conn, e.id, "2026-06-01").is_err());
    }

    #[test]
    fn search_filters_by_name() {
        let mut conn = open_in_memory().unwrap();
        create(&mut conn, &sample_esame()).unwrap();
        create(&mut conn, &sample_progetto()).unwrap();
        let r = search(&conn, "tesi").unwrap();
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].name, "Tesina Fisiologia");
        let r2 = search(&conn, "").unwrap();
        assert_eq!(r2.len(), 2);
    }
}
