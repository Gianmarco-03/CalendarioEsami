pub mod db;
pub mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = commands::build_state(app)
                .map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_exams,
            commands::create_exam,
            commands::update_exam,
            commands::delete_exam,
            commands::set_exam_passed,
            commands::toggle_study_day,
            commands::search_exams,
            commands::import_artifact_json,
            commands::get_setting,
            commands::set_setting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
