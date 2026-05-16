use rusqlite::{Connection, Result};

pub mod exams;
pub mod settings;
pub mod import;
pub mod types;
pub mod progetto;

const MIGRATIONS: &[(&str, &str)] = &[
    ("001_init", include_str!("migrations/001_init.sql")),
    ("002_study_minutes", include_str!("migrations/002_study_minutes.sql")),
    ("003_default_study_minutes", include_str!("migrations/003_default_study_minutes.sql")),
];

pub fn open(path: &std::path::Path) -> Result<Connection> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CANTOPEN),
                Some(format!("create dir {parent:?}: {e}")),
            )
        })?;
    }
    let mut conn = Connection::open(path)?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    migrate(&mut conn)?;
    Ok(conn)
}

pub fn open_in_memory() -> Result<Connection> {
    let mut conn = Connection::open_in_memory()?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    migrate(&mut conn)?;
    Ok(conn)
}

fn migrate(conn: &mut Connection) -> Result<()> {
    let current: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    for (i, (_name, sql)) in MIGRATIONS.iter().enumerate() {
        let version = (i + 1) as i64;
        if current < version {
            let tx = conn.transaction()?;
            tx.execute_batch(sql)?;
            tx.pragma_update(None, "user_version", version)?;
            tx.commit()?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_apply_on_empty_db() {
        let conn = open_in_memory().expect("open in-memory");
        let v: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(v, MIGRATIONS.len() as i64);
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            .unwrap()
            .query_map([], |r| r.get::<_, String>(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert_eq!(tables, vec!["appelli", "exams", "project_ranges", "settings", "study_days"]);
    }

    #[test]
    fn migrations_are_idempotent() {
        let mut conn = open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        migrate(&mut conn).unwrap();
        let v: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(v, MIGRATIONS.len() as i64);
    }

    #[test]
    fn study_days_has_minutes_column() {
        let conn = open_in_memory().unwrap();
        // PRAGMA table_info returns rows: cid, name, type, notnull, dflt_value, pk
        let cols: Vec<String> = conn
            .prepare("PRAGMA table_info(study_days)")
            .unwrap()
            .query_map([], |r| r.get::<_, String>(1))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert!(cols.contains(&"minutes".to_string()), "got cols: {cols:?}");
    }
}
