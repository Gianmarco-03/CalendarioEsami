use rusqlite::{params, Connection};

pub fn get(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")
        .map_err(|e| format!("prepare: {e}"))?;
    let row = stmt.query_row(params![key], |r| r.get::<_, String>(0));
    match row {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("query: {e}")),
    }
}

pub fn set(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    ).map_err(|e| format!("upsert: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    #[test]
    fn get_missing_returns_none() {
        let conn = open_in_memory().unwrap();
        assert_eq!(get(&conn, "nope").unwrap(), None);
    }

    #[test]
    fn set_then_get() {
        let conn = open_in_memory().unwrap();
        set(&conn, "view.month", "2026-05").unwrap();
        assert_eq!(get(&conn, "view.month").unwrap(), Some("2026-05".into()));
    }

    #[test]
    fn set_upserts() {
        let conn = open_in_memory().unwrap();
        set(&conn, "k", "a").unwrap();
        set(&conn, "k", "b").unwrap();
        assert_eq!(get(&conn, "k").unwrap(), Some("b".into()));
    }
}
