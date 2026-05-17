use rusqlite::{params, Connection, Result as SqlResult};
use crate::db::types::*;

pub fn create(conn: &mut Connection, input: &ExamInput) -> Result<Exam, String> {
    let name = validate_input(input)?;
    let base = input.base();
    let tx = conn.transaction().map_err(|e| format!("tx: {e}"))?;
    tx.execute(
        "INSERT INTO exams (name, color, icon, kind, passed, default_study_minutes) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![name, base.color, base.icon, input.kind_str(), base.passed as i64, base.default_study_minutes],
    ).map_err(|e| format!("insert exam: {e}"))?;
    let id = tx.last_insert_rowid();
    for d in &base.appelli {
        tx.execute(
            "INSERT INTO appelli (exam_id, date) VALUES (?1, ?2)",
            params![id, d],
        ).map_err(|e| format!("insert appello: {e}"))?;
    }
    for r in input.ranges() {
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
        "SELECT id, name, color, icon, kind, passed, default_study_minutes FROM exams ORDER BY name COLLATE NOCASE"
    ).map_err(|e| format!("prepare: {e}"))?;
    let rows = stmt.query_map([], |r| {
        Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?,
            r.get::<_, String>(3)?, r.get::<_, String>(4)?, r.get::<_, i64>(5)?, r.get::<_, i32>(6)?))
    }).map_err(|e| format!("query: {e}"))?;
    let mut out = Vec::new();
    for row in rows {
        let (id, name, color, icon, kind_str, passed, dsm) = row.map_err(|e| format!("row: {e}"))?;
        out.push(build_exam(conn, id, name, color, icon, &kind_str, passed != 0, dsm)?);
    }
    Ok(out)
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Exam, String> {
    let (name, color, icon, kind_str, passed, dsm): (String, String, String, String, i64, i32) = conn.query_row(
        "SELECT name, color, icon, kind, passed, default_study_minutes FROM exams WHERE id = ?1",
        params![id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)),
    ).map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => format!("Esame {id} non trovato"),
        e => format!("select exam: {e}"),
    })?;
    build_exam(conn, id, name, color, icon, &kind_str, passed != 0, dsm)
}

fn build_exam(
    conn: &Connection,
    id: i64,
    name: String,
    color: String,
    icon: String,
    kind_str: &str,
    passed: bool,
    default_study_minutes: i32,
) -> Result<Exam, String> {
    let appelli = load_appelli(conn, id)?;
    let study_days = load_study_days(conn, id)?;
    let base = EsameData {
        id, name, color, icon, passed, default_study_minutes, appelli, study_days,
    };
    match kind_str {
        "esame" => Ok(Exam::Esame(base)),
        "progetto" => {
            let ranges = load_ranges(conn, id)?;
            Ok(Exam::Progetto(ProgettoData { esame: base, ranges }))
        }
        other => Err(format!("kind sconosciuto: {other}")),
    }
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
    // 1) Try UPDATE — fast path per esami (riga creata da toggle) e progetti già loggati.
    let changed = conn.execute(
        "UPDATE study_days SET minutes = ?1 WHERE exam_id = ?2 AND date = ?3",
        params![minutes, exam_id, date],
    ).map_err(|e| format!("update minutes: {e}"))?;
    if changed > 0 { return Ok(()); }

    // 2) Nessuna riga — INSERT consentito solo per progetti con range coprente il giorno.
    let kind: String = conn.query_row(
        "SELECT kind FROM exams WHERE id = ?1",
        params![exam_id],
        |r| r.get(0),
    ).map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => format!("Esame {exam_id} non esistente"),
        e => format!("select kind: {e}"),
    })?;
    if kind != "progetto" {
        return Err(format!("Giorno di studio {date} non trovato per esame {exam_id}"));
    }
    let covered: bool = conn.query_row(
        "SELECT 1 FROM project_ranges WHERE exam_id = ?1 AND ?2 BETWEEN start_date AND end_date LIMIT 1",
        params![exam_id, date],
        |_| Ok(true),
    ).unwrap_or(false);
    if !covered {
        return Err(format!("Progetto {exam_id} non copre il giorno {date}"));
    }
    conn.execute(
        "INSERT INTO study_days (exam_id, date, minutes) VALUES (?1, ?2, ?3)",
        params![exam_id, date, minutes],
    ).map_err(|e| format!("insert minutes: {e}"))?;
    Ok(())
}

pub fn update(conn: &mut Connection, id: i64, input: &ExamInput) -> Result<Exam, String> {
    let name = validate_input(input)?;
    let base = input.base();
    let tx = conn.transaction().map_err(|e| format!("tx: {e}"))?;
    let changed = tx.execute(
        "UPDATE exams SET name = ?1, color = ?2, icon = ?3, kind = ?4, passed = ?5,
                          default_study_minutes = ?6, updated_at = datetime('now') WHERE id = ?7",
        params![name, base.color, base.icon, input.kind_str(), base.passed as i64, base.default_study_minutes, id],
    ).map_err(|e| format!("update exam: {e}"))?;
    if changed == 0 {
        return Err(format!("Esame {id} non trovato"));
    }
    tx.execute("DELETE FROM appelli WHERE exam_id = ?1", params![id])
        .map_err(|e| format!("delete appelli: {e}"))?;
    tx.execute("DELETE FROM project_ranges WHERE exam_id = ?1", params![id])
        .map_err(|e| format!("delete ranges: {e}"))?;
    for d in &base.appelli {
        tx.execute("INSERT INTO appelli (exam_id, date) VALUES (?1, ?2)", params![id, d])
            .map_err(|e| format!("insert appello: {e}"))?;
    }
    for r in input.ranges() {
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

/// Counts active presences for a given date:
///   - one per active esame with a study_day on `date`
///   - one per active progetto whose ranges cover `date`
/// "Active" = `passed = 0`. Used to enforce the 4-presence-per-day cap.
pub fn count_presences(conn: &Connection, date: &str) -> Result<usize, String> {
    crate::db::types::validate_date(date)?;
    let n: i64 = conn.query_row(
        "SELECT COUNT(DISTINCT e.id) FROM exams e
         WHERE e.passed = 0 AND e.id IN (
             SELECT exam_id FROM study_days WHERE date = ?1
             UNION
             SELECT exam_id FROM project_ranges WHERE ?1 BETWEEN start_date AND end_date
         )",
        params![date],
        |r| r.get(0),
    ).map_err(|e| format!("count presences: {e}"))?;
    Ok(n as usize)
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
            "SELECT 1 FROM exams WHERE id = ?1",
            params![exam_id],
            |_| Ok(true),
        ).unwrap_or(false);
        if !exam_exists {
            return Err(format!("Esame {exam_id} non esistente"));
        }
        // Enforce the 4-activity-per-day cap before adding.
        let current = count_presences(conn, date)?;
        if current >= 4 {
            return Err("Massimo 4 attività per giorno (progetti + esami in studio)".into());
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
        "SELECT id, name, color, icon, kind, passed, default_study_minutes FROM exams
         WHERE name LIKE ?1 COLLATE NOCASE
         ORDER BY name COLLATE NOCASE"
    ).map_err(|e| format!("prepare search: {e}"))?;
    let pattern = format!("%{q}%");
    let rows = stmt.query_map(params![pattern], |r| {
        Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?,
            r.get::<_, String>(3)?, r.get::<_, String>(4)?, r.get::<_, i64>(5)?, r.get::<_, i32>(6)?))
    }).map_err(|e| format!("query: {e}"))?;
    let mut out = Vec::new();
    for row in rows {
        let (id, name, color, icon, kind_str, passed, dsm) = row.map_err(|e| format!("row: {e}"))?;
        out.push(build_exam(conn, id, name, color, icon, &kind_str, passed != 0, dsm)?);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    pub(super) fn sample_esame() -> ExamInput {
        ExamInput::Esame(EsameInputData {
            name: "Neuroanatomia".into(),
            color: "#E8543F".into(),
            icon: "book-open".into(),
            passed: false,
            default_study_minutes: 60,
            appelli: vec!["2026-06-15".into(), "2026-07-10".into()],
        })
    }

    pub(super) fn sample_progetto() -> ExamInput {
        ExamInput::Progetto(ProgettoInputData {
            esame: EsameInputData {
                name: "Tesina Fisiologia".into(),
                color: "#27AE60".into(),
                icon: "book-open".into(),
                passed: false,
                default_study_minutes: 60,
                appelli: vec![],
            },
            ranges: vec![DateRange { start: "2026-05-01".into(), end: "2026-05-15".into() }],
        })
    }

    fn esame_input_with(mut f: impl FnMut(&mut EsameInputData)) -> ExamInput {
        let mut data = EsameInputData {
            name: "Neuroanatomia".into(),
            color: "#E8543F".into(),
            icon: "book-open".into(),
            passed: false,
            default_study_minutes: 60,
            appelli: vec!["2026-06-15".into(), "2026-07-10".into()],
        };
        f(&mut data);
        ExamInput::Esame(data)
    }

    #[test]
    fn create_and_get_esame() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_esame()).unwrap();
        let base = e.base();
        assert_eq!(base.name, "Neuroanatomia");
        assert_eq!(e.kind_str(), "esame");
        assert_eq!(base.appelli.len(), 2);
        assert_eq!(base.appelli[0].date, "2026-06-15");
        assert!(e.ranges().is_empty());
        assert!(base.study_days.is_empty());
        assert!(!base.passed);
    }

    #[test]
    fn create_progetto() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_progetto()).unwrap();
        assert_eq!(e.kind_str(), "progetto");
        assert_eq!(e.ranges().len(), 1);
        assert_eq!(e.ranges()[0].start, "2026-05-01");
        assert_eq!(e.ranges()[0].end, "2026-05-15");
    }

    #[test]
    fn list_returns_all_sorted_by_name() {
        let mut conn = open_in_memory().unwrap();
        create(&mut conn, &sample_progetto()).unwrap();
        create(&mut conn, &sample_esame()).unwrap();
        let list = list(&conn).unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].base().name, "Neuroanatomia");
        assert_eq!(list[1].base().name, "Tesina Fisiologia");
    }

    #[test]
    fn create_rejects_invalid_input() {
        let mut conn = open_in_memory().unwrap();
        let bad = ExamInput::Esame(EsameInputData {
            name: "".into(),
            color: "#000000".into(),
            icon: "book-open".into(),
            passed: false,
            default_study_minutes: 60,
            appelli: vec![],
        });
        assert!(create(&mut conn, &bad).is_err());
    }

    #[test]
    fn update_replaces_appelli() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_esame()).unwrap();
        let next = esame_input_with(|d| {
            d.name = "Neuroanat. (rinominato)".into();
            d.appelli = vec!["2026-09-01".into()];
        });
        let updated = update(&mut conn, e.id(), &next).unwrap();
        let ub = updated.base();
        assert_eq!(ub.name, "Neuroanat. (rinominato)");
        assert_eq!(ub.appelli.len(), 1);
        assert_eq!(ub.appelli[0].date, "2026-09-01");
    }

    #[test]
    fn update_preserves_study_days() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_esame()).unwrap();
        conn.execute(
            "INSERT INTO study_days (exam_id, date) VALUES (?1, ?2)",
            params![e.id(), "2026-06-01"],
        ).unwrap();
        let updated = update(&mut conn, e.id(), &sample_esame()).unwrap();
        let sd = &updated.base().study_days;
        assert_eq!(sd.len(), 1);
        assert_eq!(sd[0].date, "2026-06-01");
    }

    #[test]
    fn delete_cascades_to_appelli_and_study_days() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_esame()).unwrap();
        conn.execute(
            "INSERT INTO study_days (exam_id, date) VALUES (?1, ?2)",
            params![e.id(), "2026-06-01"],
        ).unwrap();
        delete(&conn, e.id()).unwrap();
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
        set_passed(&conn, e.id(), true).unwrap();
        assert!(get_by_id(&conn, e.id()).unwrap().base().passed);
        set_passed(&conn, e.id(), false).unwrap();
        assert!(!get_by_id(&conn, e.id()).unwrap().base().passed);
    }

    #[test]
    fn toggle_study_day_on_then_off() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_esame()).unwrap();
        assert!(toggle_study_day(&conn, e.id(), "2026-06-01").unwrap());
        let after = get_by_id(&conn, e.id()).unwrap();
        let days = &after.base().study_days;
        assert_eq!(days.len(), 1);
        assert_eq!(days[0].date, "2026-06-01");
        assert_eq!(days[0].minutes, None);
        assert!(!toggle_study_day(&conn, e.id(), "2026-06-01").unwrap());
        assert!(get_by_id(&conn, e.id()).unwrap().base().study_days.is_empty());
    }

    #[test]
    fn set_study_day_minutes_works() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_esame()).unwrap();
        toggle_study_day(&conn, e.id(), "2026-06-01").unwrap();
        set_study_day_minutes(&conn, e.id(), "2026-06-01", Some(90)).unwrap();
        let after = get_by_id(&conn, e.id()).unwrap();
        assert_eq!(after.base().study_days[0].minutes, Some(90));
        set_study_day_minutes(&conn, e.id(), "2026-06-01", None).unwrap();
        assert_eq!(get_by_id(&conn, e.id()).unwrap().base().study_days[0].minutes, None);
    }

    #[test]
    fn set_study_day_minutes_rejects_out_of_range() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_esame()).unwrap();
        toggle_study_day(&conn, e.id(), "2026-06-01").unwrap();
        assert!(set_study_day_minutes(&conn, e.id(), "2026-06-01", Some(-1)).is_err());
        assert!(set_study_day_minutes(&conn, e.id(), "2026-06-01", Some(2000)).is_err());
    }

    #[test]
    fn set_study_day_minutes_upserts_for_progetto_in_range() {
        let mut conn = open_in_memory().unwrap();
        // sample_progetto ha range 2026-05-01..2026-05-15
        let p = create(&mut conn, &sample_progetto()).unwrap();
        // Set su giorno coperto → INSERT
        set_study_day_minutes(&conn, p.id(), "2026-05-10", Some(45)).unwrap();
        let reread = get_by_id(&conn, p.id()).unwrap();
        let sd = reread.base().study_days.iter().find(|s| s.date == "2026-05-10").unwrap();
        assert_eq!(sd.minutes, Some(45));
        // Set nuovo valore stesso giorno → UPDATE
        set_study_day_minutes(&conn, p.id(), "2026-05-10", Some(120)).unwrap();
        let reread = get_by_id(&conn, p.id()).unwrap();
        let sd = reread.base().study_days.iter().find(|s| s.date == "2026-05-10").unwrap();
        assert_eq!(sd.minutes, Some(120));
    }

    #[test]
    fn set_study_day_minutes_rejects_progetto_out_of_range() {
        let mut conn = open_in_memory().unwrap();
        let p = create(&mut conn, &sample_progetto()).unwrap();
        // 2026-07-15 è fuori dal range 2026-05-01..2026-05-15
        let err = set_study_day_minutes(&conn, p.id(), "2026-07-15", Some(45)).unwrap_err();
        assert!(err.contains("non copre"), "got: {err}");
    }

    #[test]
    fn set_study_day_minutes_rejects_esame_without_toggle() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_esame()).unwrap();
        // Nessun toggle_study_day → la riga non esiste, l'esame non è progetto → errore.
        let err = set_study_day_minutes(&conn, e.id(), "2026-06-15", Some(45)).unwrap_err();
        assert!(err.contains("non trovato"), "got: {err}");
    }

    #[test]
    fn search_filters_by_name() {
        let mut conn = open_in_memory().unwrap();
        create(&mut conn, &sample_esame()).unwrap();
        create(&mut conn, &sample_progetto()).unwrap();
        let r = search(&conn, "tesi").unwrap();
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].base().name, "Tesina Fisiologia");
        let r2 = search(&conn, "").unwrap();
        assert_eq!(r2.len(), 2);
    }

    #[test]
    fn count_presences_empty_day() {
        let conn = open_in_memory().unwrap();
        assert_eq!(count_presences(&conn, "2026-06-15").unwrap(), 0);
    }

    #[test]
    fn count_presences_counts_studies_and_projects() {
        let mut conn = open_in_memory().unwrap();

        // Esame 1 with study on 2026-06-15
        let e1 = create(&mut conn, &sample_esame()).unwrap();
        toggle_study_day(&conn, e1.id(), "2026-06-15").unwrap();

        // Esame 2 with study on 2026-06-15
        let input2 = esame_input_with(|d| {
            d.name = "Fisiologia".into();
            d.color = "#2E86C1".into();
            d.appelli = vec!["2026-08-01".into()];
        });
        let e2 = create(&mut conn, &input2).unwrap();
        toggle_study_day(&conn, e2.id(), "2026-06-15").unwrap();

        // Progetto covering 2026-06-15
        let proj = create(&mut conn, &sample_progetto()).unwrap();
        let proj_input = ExamInput::Progetto(ProgettoInputData {
            esame: EsameInputData {
                name: "Tesi v2".into(),
                color: proj.base().color.clone(),
                icon: "book-open".into(),
                passed: false,
                default_study_minutes: 60,
                appelli: vec![],
            },
            ranges: vec![DateRange { start: "2026-06-10".into(), end: "2026-06-20".into() }],
        });
        let _ = update(&mut conn, proj.id(), &proj_input).unwrap();

        // Total presences on 2026-06-15: 2 studies + 1 project = 3
        assert_eq!(count_presences(&conn, "2026-06-15").unwrap(), 3);
    }

    #[test]
    fn toggle_study_day_rejects_when_already_4_presences() {
        let mut conn = open_in_memory().unwrap();

        // Create 4 esami all with study on the same date
        let date = "2026-06-15";
        for i in 0..4 {
            let color: String = match i {
                0 => "#E8543F".into(),
                1 => "#2E86C1".into(),
                2 => "#27AE60".into(),
                _ => "#F39C12".into(),
            };
            let input = esame_input_with(|d| {
                d.name = format!("Esame {}", i);
                d.appelli = vec!["2026-08-01".into()];
                d.color = color.clone();
            });
            let e = create(&mut conn, &input).unwrap();
            toggle_study_day(&conn, e.id(), date).unwrap();
        }
        assert_eq!(count_presences(&conn, date).unwrap(), 4);

        // 5th esame, attempting to toggle study on same date → should fail
        let input5 = esame_input_with(|d| {
            d.name = "Esame 5".into();
            d.color = "#8E44AD".into();
            d.appelli = vec!["2026-08-01".into()];
        });
        let e5 = create(&mut conn, &input5).unwrap();
        let result = toggle_study_day(&conn, e5.id(), date);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("Massimo 4"), "expected cap error, got: {err}");
    }

    #[test]
    fn toggle_study_day_off_always_allowed_even_at_cap() {
        let mut conn = open_in_memory().unwrap();

        let date = "2026-06-15";
        let mut first_id = 0;
        for i in 0..4 {
            let color: String = match i {
                0 => "#E8543F".into(),
                1 => "#2E86C1".into(),
                2 => "#27AE60".into(),
                _ => "#F39C12".into(),
            };
            let input = esame_input_with(|d| {
                d.name = format!("Esame {}", i);
                d.appelli = vec!["2026-08-01".into()];
                d.color = color.clone();
            });
            let e = create(&mut conn, &input).unwrap();
            toggle_study_day(&conn, e.id(), date).unwrap();
            if i == 0 { first_id = e.id(); }
        }
        // Toggle OFF the first study should succeed even though cell is at cap
        let result = toggle_study_day(&conn, first_id, date);
        assert_eq!(result.unwrap(), false);
    }
}
