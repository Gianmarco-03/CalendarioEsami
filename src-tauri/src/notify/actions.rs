use chrono::{Duration, Local};
use rusqlite::Connection;
use crate::db;
use crate::notify::dedup;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QuickLogAction {
    LogMinutes(i32),
    Snooze(i64), // minuti
}

impl QuickLogAction {
    pub fn from_id(id: &str) -> Option<Self> {
        match id {
            "log15" => Some(Self::LogMinutes(15)),
            "log30" => Some(Self::LogMinutes(30)),
            "log60" => Some(Self::LogMinutes(60)),
            "snooze60" => Some(Self::Snooze(60)),
            _ => None,
        }
    }
}

/// Applica un'azione: registra minuti sull'esame "più recente" o posticipa la prompt corrente.
pub fn apply(conn: &Connection, action: QuickLogAction, prompt_dedup_key: &str) -> Result<(), String> {
    match action {
        QuickLogAction::LogMinutes(m) => {
            let exam_id = recent_active_exam(conn)?
                .ok_or_else(|| "Nessun esame attivo".to_string())?;
            let today = Local::now().date_naive().format("%Y-%m-%d").to_string();
            // Crea la riga se mancante (best-effort: toggle solo per esami; per progetti
            // set_study_day_minutes upserta da solo se nel range).
            let _ = db::exams::toggle_study_day(conn, exam_id, &today);
            db::exams::set_study_day_minutes(conn, exam_id, &today, Some(m))?;
            Ok(())
        }
        QuickLogAction::Snooze(min) => {
            let when = Local::now() + Duration::minutes(min);
            dedup::defer_until(conn, "quick_log_prompt", prompt_dedup_key, when)
        }
    }
}

/// Esame attivo (non passed) usato più di recente, basato sulla MAX(date) in study_days.
/// Fallback: primo esame attivo per nome.
pub fn recent_active_exam(conn: &Connection) -> Result<Option<i64>, String> {
    let last: Option<i64> = conn.query_row(
        "SELECT e.id FROM exams e
         JOIN study_days s ON s.exam_id = e.id
         WHERE e.passed = 0
         ORDER BY s.date DESC, s.exam_id DESC
         LIMIT 1",
        [],
        |r| r.get(0),
    ).ok();
    if last.is_some() { return Ok(last); }
    let first: Option<i64> = conn.query_row(
        "SELECT id FROM exams WHERE passed = 0 ORDER BY name COLLATE NOCASE LIMIT 1",
        [],
        |r| r.get(0),
    ).ok();
    Ok(first)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::db::types::*;

    fn create_esame(conn: &mut Connection, name: &str) -> i64 {
        let i = ExamInput::Esame(EsameInputData {
            name: name.into(), color: "#112233".into(), icon: "book-open".into(),
            passed: false, default_study_minutes: 60, appelli: vec![],
        });
        db::exams::create(conn, &i).unwrap().id()
    }

    #[test]
    fn recent_active_falls_back_to_first_by_name() {
        let mut conn = open_in_memory().unwrap();
        let _id1 = create_esame(&mut conn, "Zeta");
        let _id2 = create_esame(&mut conn, "Alfa");
        let id = recent_active_exam(&conn).unwrap().unwrap();
        let n: String = conn.query_row("SELECT name FROM exams WHERE id=?1", [id], |r| r.get(0)).unwrap();
        assert_eq!(n, "Alfa");
    }

    #[test]
    fn recent_active_uses_last_study_day() {
        let mut conn = open_in_memory().unwrap();
        let zeta = create_esame(&mut conn, "Zeta");
        let _alfa = create_esame(&mut conn, "Alfa");
        db::exams::toggle_study_day(&conn, zeta, "2026-05-10").unwrap();
        let id = recent_active_exam(&conn).unwrap().unwrap();
        assert_eq!(id, zeta);
    }

    #[test]
    fn apply_log_minutes_writes_today() {
        let mut conn = open_in_memory().unwrap();
        let id = create_esame(&mut conn, "X");
        apply(&conn, QuickLogAction::LogMinutes(30), "k").unwrap();
        let today = chrono::Local::now().date_naive().format("%Y-%m-%d").to_string();
        let m: Option<i32> = conn.query_row(
            "SELECT minutes FROM study_days WHERE exam_id = ?1 AND date = ?2",
            [&id.to_string(), &today], |r| r.get(0),
        ).unwrap();
        assert_eq!(m, Some(30));
    }

    #[test]
    fn apply_snooze_defers() {
        let conn = open_in_memory().unwrap();
        apply(&conn, QuickLogAction::Snooze(60), "quick_log_prompt:2026-05-18:18:00").unwrap();
        let now = chrono::Local::now();
        assert!(dedup::is_snoozed(&conn, "quick_log_prompt", "quick_log_prompt:2026-05-18:18:00", now).unwrap());
    }
}
