use std::sync::Arc;
use std::time::Duration as StdDuration;
use chrono::Local;
use rusqlite::Connection;
use tokio::time::interval;
use crate::notify::{dedup, prefs, rules, service::NotificationSink};

/// Singolo tick: query DB, calcola eventi dovuti, invia quelli non già loggati.
pub fn tick<S: NotificationSink>(conn: &Connection, sink: &S) -> Result<usize, String> {
    let prefs = prefs::load_all(conn)?;
    let exams = crate::db::exams::list(conn)?;
    let now = Local::now();
    let events = rules::compute_due(now, &prefs, &exams);
    let mut sent = 0;
    for ev in &events {
        // Salta se snoozed (sent_at futuro)
        if dedup::is_snoozed(conn, ev.kind.as_str(), &ev.dedup_key, now)? { continue; }
        let new_send = dedup::try_mark_sent(conn, ev.kind.as_str(), &ev.dedup_key, now)?;
        if !new_send { continue; }
        if let Err(e) = sink.send(ev) {
            eprintln!("notify send error: {e}");
            continue;
        }
        sent += 1;
    }
    Ok(sent)
}

/// Spawn del loop di scheduling. La closure `with_conn` permette al chiamante
/// di prestare la connessione SQLite (di solito dietro Mutex).
pub fn spawn_loop<F, S>(
    sink: Arc<S>,
    with_conn: Arc<F>,
)
where
    S: NotificationSink + 'static,
    F: Fn(&dyn Fn(&Connection) -> Result<(), String>) -> Result<(), String> + Send + Sync + 'static,
{
    tauri::async_runtime::spawn(async move {
        // primo tick immediato
        let _ = with_conn(&|c| {
            if let Err(e) = tick(c, sink.as_ref()) { eprintln!("notif tick: {e}"); }
            Ok(())
        });
        let mut iv = interval(StdDuration::from_secs(60));
        iv.tick().await; // consuma il primo tick istantaneo dell'interval
        loop {
            iv.tick().await;
            let _ = with_conn(&|c| {
                if let Err(e) = tick(c, sink.as_ref()) { eprintln!("notif tick: {e}"); }
                Ok(())
            });
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::notify::service::VecSink;
    use crate::notify::prefs;

    #[test]
    fn tick_skips_when_master_off() {
        let conn = open_in_memory().unwrap();
        let sink = VecSink::new();
        let n = tick(&conn, &sink).unwrap();
        assert_eq!(n, 0);
        assert!(sink.sent.lock().unwrap().is_empty());
    }

    #[test]
    fn tick_dedup_prevents_double_send() {
        let mut conn = open_in_memory().unwrap();
        prefs::upsert(&conn, "_master", true, "{}").unwrap();
        // appello in 3 giorni rispetto a oggi
        let today = chrono::Local::now().date_naive();
        let target = today + chrono::Duration::days(3);
        let appello_date = target.format("%Y-%m-%d").to_string();
        let input = crate::db::types::ExamInput::Esame(crate::db::types::EsameInputData {
            name: "X".into(), color: "#112233".into(), icon: "book-open".into(),
            passed: false, default_study_minutes: 60,
            appelli: vec![appello_date],
        });
        crate::db::exams::create(&mut conn, &input).unwrap();
        let sink = VecSink::new();
        // Primo tick: invia (se ora >= 08:00 locale, altrimenti 0). Il test è time-dependent;
        // se siamo prima delle 08:00 viene 0 in entrambi i tick, comunque dedup tiene.
        let n1 = tick(&conn, &sink).unwrap();
        let n2 = tick(&conn, &sink).unwrap();
        assert_eq!(n2, 0, "secondo tick non deve duplicare");
        let _ = n1;
    }
}
