use std::sync::{Mutex, MutexGuard};
use tauri::{Manager, State};
use rusqlite::Connection;

use crate::db;
use crate::db::types::*;
use crate::db::task_types::*;
use crate::notify::{prefs, scheduler, service::TauriSink, types::{NotifEvent, NotifKind, NotifPrefs}};

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

#[tauri::command]
pub fn get_notif_prefs(state: State<AppState>) -> Result<NotifPrefs, String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    prefs::load_all(conn)
}

#[tauri::command]
pub fn set_notif_pref(
    state: State<AppState>,
    kind: String,
    enabled: bool,
    #[allow(non_snake_case)] configJson: Option<String>,
) -> Result<(), String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    let cfg = configJson.unwrap_or_else(|| "{}".into());
    prefs::upsert(conn, &kind, enabled, &cfg)
}

#[tauri::command]
pub fn notif_test_send(app: tauri::AppHandle, kind: String) -> Result<(), String> {
    use crate::notify::service::NotificationSink;
    let sink = TauriSink { app };
    let ev = NotifEvent {
        kind: parse_kind(&kind)?,
        dedup_key: format!("test:{}", chrono::Local::now().timestamp_millis()),
        title: "Test notifica".into(),
        body: format!("Notifica di prova per il tipo {kind}."),
        with_actions: false,
        sound: None,
    };
    sink.send(&ev)
}

fn parse_kind(s: &str) -> Result<NotifKind, String> {
    for k in NotifKind::all() {
        if k.as_str() == s { return Ok(*k); }
    }
    Err(format!("kind sconosciuto: {s}"))
}

#[tauri::command]
pub fn quicklog_log(state: State<AppState>, exam_id: i64, minutes: i32) -> Result<(), String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    let today = chrono::Local::now().date_naive().format("%Y-%m-%d").to_string();
    let _ = crate::db::exams::toggle_study_day(conn, exam_id, &today);
    crate::db::exams::set_study_day_minutes(conn, exam_id, &today, Some(minutes))
}

#[tauri::command]
pub fn quicklog_recent_exam(state: State<AppState>) -> Result<Option<i64>, String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    crate::notify::actions::recent_active_exam(conn)
}

#[tauri::command]
pub fn quicklog_active_exams(state: State<AppState>) -> Result<Vec<(i64, String, String)>, String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    let mut stmt = conn.prepare(
        "SELECT id, name, color FROM exams WHERE passed = 0 ORDER BY name COLLATE NOCASE"
    ).map_err(|e| format!("prepare: {e}"))?;
    let rows = stmt.query_map([], |r| {
        Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?))
    }).map_err(|e| format!("query: {e}"))?;
    let mut out = Vec::new();
    for r in rows { out.push(r.map_err(|e| format!("row: {e}"))?); }
    Ok(out)
}

#[tauri::command]
pub fn notif_force_tick(app: tauri::AppHandle, state: State<AppState>) -> Result<usize, String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    let sink = TauriSink { app };
    scheduler::tick(conn, &sink)
}

#[tauri::command]
pub fn list_tasks(state: State<AppState>) -> Result<Vec<Task>, String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    crate::db::tasks::list(conn)
}

#[tauri::command]
pub fn get_task(state: State<AppState>, id: i64) -> Result<Task, String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    crate::db::tasks::get_by_id(conn, id)
}

#[tauri::command]
pub fn create_task(state: State<AppState>, input: TaskInput) -> Result<Task, String> {
    let mut guard = lock(&state)?;
    let conn = guard.as_mut().map_err(|e| e.clone())?;
    crate::db::tasks::create(conn, &input)
}

#[tauri::command]
pub fn update_task(state: State<AppState>, id: i64, input: TaskInput) -> Result<Task, String> {
    let mut guard = lock(&state)?;
    let conn = guard.as_mut().map_err(|e| e.clone())?;
    crate::db::tasks::update(conn, id, &input)
}

#[tauri::command]
pub fn delete_task(state: State<AppState>, id: i64) -> Result<(), String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    crate::db::tasks::delete(conn, id)
}

#[tauri::command]
pub fn set_task_done(state: State<AppState>, id: i64, done: bool) -> Result<(), String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    crate::db::tasks::set_done(conn, id, done)
}

#[tauri::command]
pub fn set_checklist_item_done(state: State<AppState>, item_id: i64, done: bool) -> Result<(), String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    crate::db::tasks::set_checklist_item_done(conn, item_id, done)
}

#[tauri::command]
pub fn add_task_link(state: State<AppState>, pred_id: i64, succ_id: i64) -> Result<(), String> {
    let mut guard = lock(&state)?;
    let conn = guard.as_mut().map_err(|e| e.clone())?;
    crate::db::task_links::add_link(conn, pred_id, succ_id)
}

#[tauri::command]
pub fn remove_task_link(state: State<AppState>, pred_id: i64, succ_id: i64) -> Result<(), String> {
    let guard = lock(&state)?;
    let conn = guard.as_ref().map_err(|e| e.clone())?;
    crate::db::task_links::remove_link(conn, pred_id, succ_id)
}

pub fn build_state(app: &tauri::App) -> AppState {
    let result = (|| -> Result<Connection, String> {
        let dir = app.path().app_data_dir().map_err(|e| format!("app_data_dir: {e}"))?;
        let db_path = dir.join("calendar.db");
        db::open(&db_path).map_err(|e| format!("open db {}: {e}", db_path.display()))
    })();
    AppState { conn: Mutex::new(result) }
}
