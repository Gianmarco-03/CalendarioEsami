use std::sync::Mutex;
use tauri::{Manager, State};
use rusqlite::Connection;

use crate::db;
use crate::db::types::*;

pub struct AppState {
    pub conn: Mutex<Connection>,
}

#[tauri::command]
pub fn list_exams(state: State<AppState>) -> Result<Vec<Exam>, String> {
    let conn = state.conn.lock().map_err(|e| format!("lock: {e}"))?;
    db::exams::list(&conn)
}

#[tauri::command]
pub fn create_exam(state: State<AppState>, input: ExamInput) -> Result<Exam, String> {
    let mut conn = state.conn.lock().map_err(|e| format!("lock: {e}"))?;
    db::exams::create(&mut conn, &input)
}

#[tauri::command]
pub fn update_exam(state: State<AppState>, id: i64, input: ExamInput) -> Result<Exam, String> {
    let mut conn = state.conn.lock().map_err(|e| format!("lock: {e}"))?;
    db::exams::update(&mut conn, id, &input)
}

#[tauri::command]
pub fn delete_exam(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| format!("lock: {e}"))?;
    db::exams::delete(&conn, id)
}

#[tauri::command]
pub fn set_exam_passed(state: State<AppState>, id: i64, passed: bool) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| format!("lock: {e}"))?;
    db::exams::set_passed(&conn, id, passed)
}

#[tauri::command]
pub fn toggle_study_day(state: State<AppState>, exam_id: i64, date: String) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| format!("lock: {e}"))?;
    db::exams::toggle_study_day(&conn, exam_id, &date)
}

#[tauri::command]
pub fn search_exams(state: State<AppState>, query: String) -> Result<Vec<Exam>, String> {
    let conn = state.conn.lock().map_err(|e| format!("lock: {e}"))?;
    db::exams::search(&conn, &query)
}

#[tauri::command]
pub fn import_artifact_json(state: State<AppState>, payload: String) -> Result<ImportReport, String> {
    let mut conn = state.conn.lock().map_err(|e| format!("lock: {e}"))?;
    db::import::import_artifact_json(&mut conn, &payload)
}

#[tauri::command]
pub fn get_setting(state: State<AppState>, key: String) -> Result<Option<String>, String> {
    let conn = state.conn.lock().map_err(|e| format!("lock: {e}"))?;
    db::settings::get(&conn, &key)
}

#[tauri::command]
pub fn set_setting(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| format!("lock: {e}"))?;
    db::settings::set(&conn, &key, &value)
}

pub fn build_state(app: &tauri::App) -> Result<AppState, String> {
    let dir = app.path().app_data_dir().map_err(|e| format!("app_data_dir: {e}"))?;
    let db_path = dir.join("calendar.db");
    let conn = db::open(&db_path).map_err(|e| format!("open db: {e}"))?;
    Ok(AppState { conn: Mutex::new(conn) })
}
