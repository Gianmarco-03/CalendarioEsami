use rusqlite::{params, Connection};
use chrono::{DateTime, Local};

/// Ritorna true se la coppia (kind, key) è stata inserita ora;
/// false se era già presente (notifica già inviata in precedenza).
pub fn try_mark_sent(conn: &Connection, kind: &str, key: &str, when: DateTime<Local>) -> Result<bool, String> {
    let n = conn.execute(
        "INSERT OR IGNORE INTO notification_log (kind, key, sent_at) VALUES (?1, ?2, ?3)",
        params![kind, key, when.to_rfc3339()],
    ).map_err(|e| format!("insert log: {e}"))?;
    Ok(n > 0)
}

/// Per Snooze: imposta sent_at futuro così la prossima decisione lo considera "ancora valido"
/// se è in passato. Riusato dallo scheduler per posticipare un quick_log_prompt.
pub fn defer_until(conn: &Connection, kind: &str, key: &str, when: DateTime<Local>) -> Result<(), String> {
    conn.execute(
        "INSERT INTO notification_log (kind, key, sent_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(kind, key) DO UPDATE SET sent_at = excluded.sent_at",
        params![kind, key, when.to_rfc3339()],
    ).map_err(|e| format!("defer log: {e}"))?;
    Ok(())
}

/// True se la chiave esiste e sent_at è nel futuro (snooze attivo).
pub fn is_snoozed(conn: &Connection, kind: &str, key: &str, now: DateTime<Local>) -> Result<bool, String> {
    let row: Option<String> = conn.query_row(
        "SELECT sent_at FROM notification_log WHERE kind = ?1 AND key = ?2",
        params![kind, key],
        |r| r.get(0),
    ).ok();
    match row {
        Some(s) => {
            let t = DateTime::parse_from_rfc3339(&s)
                .map_err(|e| format!("parse sent_at: {e}"))?
                .with_timezone(&Local);
            Ok(t > now)
        }
        None => Ok(false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use chrono::Duration;

    #[test]
    fn first_mark_succeeds_second_fails() {
        let conn = open_in_memory().unwrap();
        let now = Local::now();
        assert!(try_mark_sent(&conn, "study_reminder", "study_reminder:2026-05-18", now).unwrap());
        assert!(!try_mark_sent(&conn, "study_reminder", "study_reminder:2026-05-18", now).unwrap());
    }

    #[test]
    fn different_keys_independent() {
        let conn = open_in_memory().unwrap();
        let now = Local::now();
        assert!(try_mark_sent(&conn, "study_reminder", "k1", now).unwrap());
        assert!(try_mark_sent(&conn, "study_reminder", "k2", now).unwrap());
    }

    #[test]
    fn defer_creates_future_snooze() {
        let conn = open_in_memory().unwrap();
        let now = Local::now();
        defer_until(&conn, "quick_log_prompt", "quick_log_prompt:2026-05-18:18:00", now + Duration::hours(1)).unwrap();
        assert!(is_snoozed(&conn, "quick_log_prompt", "quick_log_prompt:2026-05-18:18:00", now).unwrap());
    }

    #[test]
    fn snooze_expires() {
        let conn = open_in_memory().unwrap();
        let now = Local::now();
        defer_until(&conn, "quick_log_prompt", "k", now - Duration::minutes(1)).unwrap();
        assert!(!is_snoozed(&conn, "quick_log_prompt", "k", now).unwrap());
    }
}
