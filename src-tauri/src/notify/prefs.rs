use rusqlite::{params, Connection};
use crate::notify::types::{NotifPref, NotifPrefs};

pub fn load_all(conn: &Connection) -> Result<NotifPrefs, String> {
    let mut stmt = conn.prepare("SELECT kind, enabled, config_json FROM notification_prefs")
        .map_err(|e| format!("prepare prefs: {e}"))?;
    let rows = stmt.query_map([], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?, r.get::<_, String>(2)?))
    }).map_err(|e| format!("query prefs: {e}"))?;
    let mut out = NotifPrefs::default();
    for row in rows {
        let (kind, enabled, cfg) = row.map_err(|e| format!("row: {e}"))?;
        out.entries.insert(kind, NotifPref { enabled: enabled != 0, config_json: cfg });
    }
    Ok(out)
}

pub fn upsert(conn: &Connection, kind: &str, enabled: bool, config_json: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO notification_prefs (kind, enabled, config_json) VALUES (?1, ?2, ?3)
         ON CONFLICT(kind) DO UPDATE SET enabled = excluded.enabled, config_json = excluded.config_json",
        params![kind, enabled as i64, config_json],
    ).map_err(|e| format!("upsert pref: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    #[test]
    fn load_empty_returns_default() {
        let conn = open_in_memory().unwrap();
        let p = load_all(&conn).unwrap();
        assert!(p.entries.is_empty());
    }

    #[test]
    fn upsert_then_load() {
        let conn = open_in_memory().unwrap();
        upsert(&conn, "_master", true, "{}").unwrap();
        upsert(&conn, "study_reminder", true, r#"{"times":["18:00"]}"#).unwrap();
        let p = load_all(&conn).unwrap();
        assert!(p.master_enabled());
        assert_eq!(
            p.config_raw("study_reminder").unwrap(),
            r#"{"times":["18:00"]}"#
        );
    }

    #[test]
    fn upsert_overwrites() {
        let conn = open_in_memory().unwrap();
        upsert(&conn, "_master", true, "{}").unwrap();
        upsert(&conn, "_master", false, "{}").unwrap();
        let p = load_all(&conn).unwrap();
        assert!(!p.master_enabled());
    }
}
