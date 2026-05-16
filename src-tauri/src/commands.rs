use std::sync::{Mutex, MutexGuard};
use tauri::{Manager, State};
use rusqlite::Connection;

use crate::db;
use crate::db::types::*;

pub struct AppState {
    pub conn: Mutex<Result<Connection, String>>,
}

fn lock<'a>(state: &'a State<AppState>) -> Result<MutexGuard<'a, Result<Connection, String>>, String> {
    state.conn.lock().map_err(|e| format!("lock: {e}"))
}

#[tauri::command]
pub fn db_status(state: State<AppState>) -> Result<(), String> {
    let guard = lock(&state)?;
    guard.as_ref().map(|_| ()).map_err(|e| e.clone())
}

#[tauri::command]
pub fn list_exams(state: State<AppState>) -> Result<Vec<Exam>, String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    db::exams::list(conn)
}

#[tauri::command]
pub fn create_exam(state: State<AppState>, input: ExamInput) -> Result<Exam, String> {
    let mut guard = lock(&state)?;
    let conn = guard.as_mut().map_err(|e| e.clone())?;
    db::exams::create(conn, &input)
}

#[tauri::command]
pub fn update_exam(state: State<AppState>, id: i64, input: ExamInput) -> Result<Exam, String> {
    let mut guard = lock(&state)?;
    let conn = guard.as_mut().map_err(|e| e.clone())?;
    db::exams::update(conn, id, &input)
}

#[tauri::command]
pub fn delete_exam(state: State<AppState>, id: i64) -> Result<(), String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    db::exams::delete(conn, id)
}

#[tauri::command]
pub fn set_exam_passed(state: State<AppState>, id: i64, passed: bool) -> Result<(), String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    db::exams::set_passed(conn, id, passed)
}

#[tauri::command]
pub fn toggle_study_day(state: State<AppState>, exam_id: i64, date: String) -> Result<bool, String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    db::exams::toggle_study_day(conn, exam_id, &date)
}

#[tauri::command]
pub fn set_study_day_minutes(
    state: State<AppState>,
    exam_id: i64,
    date: String,
    minutes: Option<i32>,
) -> Result<(), String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    db::exams::set_study_day_minutes(conn, exam_id, &date, minutes)
}

#[tauri::command]
pub fn search_exams(state: State<AppState>, query: String) -> Result<Vec<Exam>, String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    db::exams::search(conn, &query)
}

#[tauri::command]
pub fn import_artifact_json(state: State<AppState>, payload: String) -> Result<ImportReport, String> {
    let mut guard = lock(&state)?;
    let conn = guard.as_mut().map_err(|e| e.clone())?;
    db::import::import_artifact_json(conn, &payload)
}

#[tauri::command]
pub fn get_setting(state: State<AppState>, key: String) -> Result<Option<String>, String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    db::settings::get(conn, &key)
}

#[tauri::command]
pub fn set_setting(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    db::settings::set(conn, &key, &value)
}

pub fn build_state(app: &tauri::App) -> AppState {
    let result = (|| -> Result<Connection, String> {
        let dir = app.path().app_data_dir().map_err(|e| format!("app_data_dir: {e}"))?;
        let db_path = dir.join("calendar.db");
        db::open(&db_path).map_err(|e| format!("open db {}: {e}", db_path.display()))
    })();
    AppState { conn: Mutex::new(result) }
}
