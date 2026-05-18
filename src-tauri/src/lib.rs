pub mod db;
pub mod commands;
pub mod notify;
pub mod quicklog;

use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            let state = commands::build_state(app);
            app.manage(state);

            // Tray icon + menu
            quicklog::tray::install(app)?;

            // Global hotkey per quicklog
            quicklog::register_hotkey(app.handle())?;

            // Scheduler notifiche
            let sink = Arc::new(crate::notify::service::TauriSink { app: app.handle().clone() });
            let handle = app.handle().clone();
            let with_conn = Arc::new(move |f: &dyn Fn(&rusqlite::Connection) -> Result<(), String>| -> Result<(), String> {
                let state = handle.state::<commands::AppState>();
                let guard = state.conn.lock().map_err(|e| format!("lock: {e}"))?;
                let conn = guard.as_ref().map_err(|e| e.clone())?;
                f(conn)
            });
            crate::notify::scheduler::spawn_loop(sink, with_conn);

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    // Se prefs.minimize_to_tray, intercetta la chiusura
                    let app = window.app_handle();
                    let state = app.state::<commands::AppState>();
                    let minimize = state.conn.lock().ok()
                        .and_then(|g| g.as_ref().ok().and_then(|c| crate::notify::prefs::load_all(c).ok()))
                        .map(|p| p.minimize_to_tray())
                        .unwrap_or(true);
                    if minimize {
                        let _ = window.hide();
                        api.prevent_close();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::db_status,
            commands::list_exams,
            commands::create_exam,
            commands::update_exam,
            commands::delete_exam,
            commands::set_exam_passed,
            commands::toggle_study_day,
            commands::set_study_day_minutes,
            commands::search_exams,
            commands::import_artifact_json,
            commands::get_setting,
            commands::set_setting,
            commands::get_notif_prefs,
            commands::set_notif_pref,
            commands::notif_test_send,
            commands::notif_force_tick,
            commands::quicklog_log,
            commands::quicklog_recent_exam,
            commands::quicklog_active_exams,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
