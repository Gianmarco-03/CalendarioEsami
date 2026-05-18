# Suite di notifiche — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere notifiche desktop, system tray, quick-log popup via hotkey e una sottosezione "Notifiche" nelle impostazioni con master toggle (default OFF).

**Architecture:** Modulo Rust `notify/` con scheduler tokio (tick 60s) + logica pura testabile in `rules.rs` + dedup su tabella SQL. Modulo `quicklog/` per finestra secondaria Tauri + tray icon. Frontend: componenti dedicati `NotificationsSettings` / `SystemSettings`, finestra `quicklog` sullo stesso bundle Vite (routing per label).

**Tech Stack:** Tauri 2, Rust + tokio, `tauri-plugin-notification`, `tauri-plugin-global-shortcut`, `tauri-plugin-autostart`, React 19, rusqlite, chrono.

**Spec di riferimento:** `docs/superpowers/specs/2026-05-18-notifications-suite-design.md`

---

## Task 1: Aggiungere dipendenze Cargo e plugin Tauri

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `package.json`

- [ ] **Step 1: Aggiungere dipendenze Rust**

Sostituire la sezione `[dependencies]` di `src-tauri/Cargo.toml` con:

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-opener = "2"
tauri-plugin-notification = "2"
tauri-plugin-global-shortcut = "2"
tauri-plugin-autostart = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.32", features = ["bundled", "chrono"] }
chrono = { version = "0.4", features = ["serde"] }
regex = "1"
once_cell = "1"
thiserror = "1"
tokio = { version = "1", features = ["sync", "time", "macros", "rt"] }
```

- [ ] **Step 2: Estendere le capabilities**

Sostituire `src-tauri/capabilities/default.json` con:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window and quicklog",
  "windows": ["main", "quicklog"],
  "permissions": [
    "core:default",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-focus",
    "core:window:allow-close",
    "core:webview:allow-create-webview-window",
    "opener:default",
    "notification:default",
    "notification:allow-notify",
    "notification:allow-request-permission",
    "notification:allow-is-permission-granted",
    "global-shortcut:default",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "global-shortcut:allow-is-registered",
    "autostart:default",
    "autostart:allow-enable",
    "autostart:allow-disable",
    "autostart:allow-is-enabled"
  ]
}
```

- [ ] **Step 3: Aggiungere deps JS**

Aggiungere a `package.json` sotto `dependencies`:

```json
"@tauri-apps/plugin-notification": "^2",
"@tauri-apps/plugin-global-shortcut": "^2",
"@tauri-apps/plugin-autostart": "^2"
```

- [ ] **Step 4: Installare**

Esegui:
```
npm install
cd src-tauri ; cargo fetch ; cd ..
```
Atteso: nessun errore, `Cargo.lock` aggiornato, `package-lock.json` aggiornato.

- [ ] **Step 5: Commit**

```
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/capabilities/default.json package.json package-lock.json
git commit -m "feat(notifications): aggiungi plugin Tauri (notification, global-shortcut, autostart) e tokio"
```

---

## Task 2: Migration 005_notifications

**Files:**
- Create: `src-tauri/src/db/migrations/005_notifications.sql`
- Modify: `src-tauri/src/db/mod.rs`

- [ ] **Step 1: Creare il file SQL**

Contenuto di `src-tauri/src/db/migrations/005_notifications.sql`:

```sql
CREATE TABLE IF NOT EXISTS notification_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT    NOT NULL,
  key         TEXT    NOT NULL,
  sent_at     TEXT    NOT NULL,
  UNIQUE(kind, key)
);

CREATE INDEX IF NOT EXISTS idx_notification_log_sent
  ON notification_log(sent_at DESC);

CREATE TABLE IF NOT EXISTS notification_prefs (
  kind        TEXT    PRIMARY KEY,
  enabled     INTEGER NOT NULL DEFAULT 1,
  config_json TEXT    NOT NULL DEFAULT '{}'
);
```

- [ ] **Step 2: Registrare la migration**

In `src-tauri/src/db/mod.rs` sostituire la costante `MIGRATIONS` con:

```rust
const MIGRATIONS: &[(&str, &str)] = &[
    ("001_init", include_str!("migrations/001_init.sql")),
    ("002_study_minutes", include_str!("migrations/002_study_minutes.sql")),
    ("003_default_study_minutes", include_str!("migrations/003_default_study_minutes.sql")),
    ("004_exam_icon", include_str!("migrations/004_exam_icon.sql")),
    ("005_notifications", include_str!("migrations/005_notifications.sql")),
];
```

E aggiornare il test `migrations_apply_on_empty_db` (stesso file) per riflettere le nuove tabelle:

```rust
assert_eq!(
    tables,
    vec![
        "appelli", "exams", "notification_log", "notification_prefs",
        "project_ranges", "settings", "study_days"
    ]
);
```

- [ ] **Step 3: Eseguire i test e verificare**

Esegui (dalla root del repo):
```
cd src-tauri ; cargo test --lib db::tests ; cd ..
```
Atteso: tutti i test passano (incl. `migrations_apply_on_empty_db`, `migrations_are_idempotent`).

- [ ] **Step 4: Commit**

```
git add src-tauri/src/db/migrations/005_notifications.sql src-tauri/src/db/mod.rs
git commit -m "feat(notifications): migration 005 (notification_log, notification_prefs)"
```

---

## Task 3: Modulo notify/types.rs

**Files:**
- Create: `src-tauri/src/notify/mod.rs` (provvisorio, solo declarations)
- Create: `src-tauri/src/notify/types.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Registrare il modulo**

In `src-tauri/src/lib.rs` aggiungere subito sotto `pub mod commands;`:

```rust
pub mod notify;
```

- [ ] **Step 2: Creare `notify/mod.rs` con le declarations**

Contenuto di `src-tauri/src/notify/mod.rs`:

```rust
pub mod types;
```

- [ ] **Step 3: Scrivere `notify/types.rs`**

Contenuto di `src-tauri/src/notify/types.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NotifKind {
    ExamImminent,
    ProjectStart,
    ProjectDeadline,
    StudyReminder,
    StudyMissed,
    StreakMilestone,
    QuickLogPrompt,
}

impl NotifKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ExamImminent     => "exam_imminent",
            Self::ProjectStart     => "project_start",
            Self::ProjectDeadline  => "project_deadline",
            Self::StudyReminder    => "study_reminder",
            Self::StudyMissed      => "study_missed",
            Self::StreakMilestone  => "streak_milestone",
            Self::QuickLogPrompt   => "quick_log_prompt",
        }
    }

    pub fn all() -> &'static [NotifKind] {
        &[
            Self::ExamImminent, Self::ProjectStart, Self::ProjectDeadline,
            Self::StudyReminder, Self::StudyMissed, Self::StreakMilestone,
            Self::QuickLogPrompt,
        ]
    }

    pub fn default_enabled(self) -> bool { true }
}

/// Una notifica concreta che lo scheduler deve inviare.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NotifEvent {
    pub kind: NotifKind,
    /// Chiave univoca per dedup (es. "exam_imminent:42:7:T-3")
    pub dedup_key: String,
    pub title: String,
    pub body: String,
    /// Solo per QuickLogPrompt: include azioni cliccabili.
    pub with_actions: bool,
    /// Se Some, percorso a file audio nel bundle (es. "streak.wav").
    pub sound: Option<String>,
}

/// Preferenze persistite. `config_json` è un blob libero per tipo.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NotifPref {
    pub enabled: bool,
    pub config_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct NotifPrefs {
    /// Chiave = NotifKind::as_str(). Anche pseudo-chiavi: "_master", "_autostart",
    /// "_minimize_to_tray", "_quicklog_hotkey".
    pub entries: HashMap<String, NotifPref>,
}

impl NotifPrefs {
    pub fn is_enabled(&self, kind: NotifKind) -> bool {
        self.entries.get(kind.as_str())
            .map(|p| p.enabled)
            .unwrap_or_else(|| kind.default_enabled())
    }

    pub fn master_enabled(&self) -> bool {
        self.entries.get("_master").map(|p| p.enabled).unwrap_or(false)
    }

    pub fn autostart_enabled(&self) -> bool {
        self.entries.get("_autostart").map(|p| p.enabled).unwrap_or(false)
    }

    pub fn minimize_to_tray(&self) -> bool {
        self.entries.get("_minimize_to_tray").map(|p| p.enabled).unwrap_or(true)
    }

    pub fn config<T: for<'de> Deserialize<'de>>(&self, kind: NotifKind) -> Option<T> {
        let raw = &self.entries.get(kind.as_str())?.config_json;
        serde_json::from_str(raw).ok()
    }

    pub fn config_raw(&self, kind_str: &str) -> Option<&str> {
        self.entries.get(kind_str).map(|p| p.config_json.as_str())
    }
}

// ---------- config payloads per i tipi che ne hanno ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExamImminentCfg {
    pub offsets: Vec<i64>, // giorni: es. [7, 3, 1, 0]; 0 = mattina dell'appello
    #[serde(default = "default_eight")]
    pub hour: u32,        // ora del giorno per T-7/T-3/T-1
    #[serde(default = "default_seven_thirty")]
    pub morning_hour: u32, // ora per T-0
    #[serde(default = "default_morning_min")]
    pub morning_minute: u32,
}
impl Default for ExamImminentCfg {
    fn default() -> Self {
        Self { offsets: vec![7,3,1,0], hour: 8, morning_hour: 7, morning_minute: 30 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDeadlineCfg {
    pub offsets: Vec<i64>, // [3, 1, 0]
    #[serde(default = "default_eight")]
    pub hour: u32,
}
impl Default for ProjectDeadlineCfg {
    fn default() -> Self { Self { offsets: vec![3,1,0], hour: 8 } }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudyReminderCfg {
    pub times: Vec<String>, // ["HH:MM", ...]
}
impl Default for StudyReminderCfg {
    fn default() -> Self { Self { times: vec!["18:00".into()] } }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudyMissedCfg {
    pub hour: u32,
    pub minute: u32,
    pub weekdays_only: bool,
}
impl Default for StudyMissedCfg {
    fn default() -> Self { Self { hour: 22, minute: 0, weekdays_only: true } }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickLogPromptCfg {
    pub times: Vec<String>, // default vuoto
}
impl Default for QuickLogPromptCfg {
    fn default() -> Self { Self { times: vec![] } }
}

fn default_eight() -> u32 { 8 }
fn default_seven_thirty() -> u32 { 7 }
fn default_morning_min() -> u32 { 30 }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn master_default_off() {
        let p = NotifPrefs::default();
        assert!(!p.master_enabled());
        assert!(!p.autostart_enabled());
        assert!(p.minimize_to_tray()); // default ON
    }

    #[test]
    fn kind_default_on() {
        let p = NotifPrefs::default();
        for k in NotifKind::all() {
            assert!(p.is_enabled(*k), "kind {:?} should default ON", k);
        }
    }

    #[test]
    fn kind_str_roundtrip() {
        for k in NotifKind::all() {
            let s = k.as_str();
            assert!(!s.is_empty());
            assert!(s.chars().all(|c| c.is_ascii_lowercase() || c == '_'));
        }
    }

    #[test]
    fn config_parses_when_present() {
        let mut p = NotifPrefs::default();
        p.entries.insert("study_reminder".into(), NotifPref {
            enabled: true,
            config_json: r#"{"times":["09:00","19:00"]}"#.into(),
        });
        let cfg: StudyReminderCfg = p.config(NotifKind::StudyReminder).unwrap();
        assert_eq!(cfg.times, vec!["09:00".to_string(), "19:00".to_string()]);
    }
}
```

- [ ] **Step 4: Run tests**

```
cd src-tauri ; cargo test --lib notify::types ; cd ..
```
Atteso: 4 test passati.

- [ ] **Step 5: Commit**

```
git add src-tauri/src/lib.rs src-tauri/src/notify/
git commit -m "feat(notifications): tipi NotifKind/NotifEvent/NotifPrefs + config payloads"
```

---

## Task 4: Modulo notify/prefs.rs (CRUD su DB)

**Files:**
- Create: `src-tauri/src/notify/prefs.rs`
- Modify: `src-tauri/src/notify/mod.rs`

- [ ] **Step 1: Registrare il sottomodulo**

In `src-tauri/src/notify/mod.rs`:

```rust
pub mod types;
pub mod prefs;
```

- [ ] **Step 2: Scrivere `notify/prefs.rs`**

Contenuto:

```rust
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
```

- [ ] **Step 3: Run tests**

```
cd src-tauri ; cargo test --lib notify::prefs ; cd ..
```
Atteso: 3 test passati.

- [ ] **Step 4: Commit**

```
git add src-tauri/src/notify/
git commit -m "feat(notifications): CRUD su tabella notification_prefs"
```

---

## Task 5: Modulo notify/dedup.rs

**Files:**
- Create: `src-tauri/src/notify/dedup.rs`
- Modify: `src-tauri/src/notify/mod.rs`

- [ ] **Step 1: Registrare il sottomodulo**

In `src-tauri/src/notify/mod.rs`:

```rust
pub mod types;
pub mod prefs;
pub mod dedup;
```

- [ ] **Step 2: Scrivere `notify/dedup.rs`**

Contenuto:

```rust
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
```

- [ ] **Step 3: Run tests**

```
cd src-tauri ; cargo test --lib notify::dedup ; cd ..
```
Atteso: 4 test passati.

- [ ] **Step 4: Commit**

```
git add src-tauri/src/notify/
git commit -m "feat(notifications): dedup via notification_log con supporto snooze"
```

---

## Task 6: notify/rules.rs — parte 1 (helpers + appelli + progetti)

**Files:**
- Create: `src-tauri/src/notify/rules.rs`
- Modify: `src-tauri/src/notify/mod.rs`

- [ ] **Step 1: Registrare il sottomodulo**

In `src-tauri/src/notify/mod.rs`:

```rust
pub mod types;
pub mod prefs;
pub mod dedup;
pub mod rules;
```

- [ ] **Step 2: Scrivere `notify/rules.rs` (versione iniziale)**

Contenuto:

```rust
use chrono::{DateTime, Datelike, Duration, Local, NaiveDate, TimeZone, Timelike};
use crate::db::types::Exam;
use crate::notify::types::*;

/// Helper: parse "YYYY-MM-DD" → NaiveDate. None se invalido.
fn parse_date(s: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()
}

/// Helper: data del momento "now".
fn today(now: DateTime<Local>) -> NaiveDate { now.date_naive() }

/// Helper: scattante una notifica al `target_time` se `now >= target_time` e siamo nello stesso giorno
/// (così evitiamo che notifiche pianificate per oggi 08:00 partano alle 23:59 di ieri o domani).
fn time_due_today(now: DateTime<Local>, hour: u32, minute: u32) -> bool {
    let target = Local.with_ymd_and_hms(now.year(), now.month(), now.day(), hour, minute, 0)
        .single();
    match target {
        Some(t) => now >= t,
        None => false,
    }
}

/// Notifiche di tipo "esame imminente": per ogni appello attivo, per ogni offset configurato.
pub fn rule_exam_imminent(
    now: DateTime<Local>,
    cfg: &ExamImminentCfg,
    exams: &[Exam],
) -> Vec<NotifEvent> {
    let today = today(now);
    let mut out = Vec::new();
    for exam in exams.iter().filter(|e| !e.base().passed) {
        for ap in &exam.base().appelli {
            let Some(d) = parse_date(&ap.date) else { continue };
            for offset in &cfg.offsets {
                let target = d - Duration::days(*offset);
                if target != today { continue; }
                let due = if *offset == 0 {
                    time_due_today(now, cfg.morning_hour, cfg.morning_minute)
                } else {
                    time_due_today(now, cfg.hour, 0)
                };
                if !due { continue; }
                let label = if *offset == 0 { "T-0".into() } else { format!("T-{}", offset) };
                let body = if *offset == 0 {
                    format!("Oggi è il giorno dell'appello di {}.", exam.base().name)
                } else if *offset == 1 {
                    format!("Domani appello di {}.", exam.base().name)
                } else {
                    format!("Fra {} giorni appello di {}.", offset, exam.base().name)
                };
                out.push(NotifEvent {
                    kind: NotifKind::ExamImminent,
                    dedup_key: format!("exam_imminent:{}:{}:{}", exam.base().id, ap.id, label),
                    title: "Esame imminente".into(),
                    body,
                    with_actions: false,
                    sound: None,
                });
            }
        }
    }
    out
}

pub fn rule_project_start(
    now: DateTime<Local>,
    cfg: &ProjectDeadlineCfg, // riusa solo `hour`
    exams: &[Exam],
) -> Vec<NotifEvent> {
    let today = today(now);
    if !time_due_today(now, cfg.hour, 0) { return vec![]; }
    let mut out = Vec::new();
    for exam in exams.iter().filter(|e| !e.base().passed) {
        for r in exam.ranges() {
            let Some(start) = parse_date(&r.start) else { continue };
            if start != today { continue; }
            out.push(NotifEvent {
                kind: NotifKind::ProjectStart,
                dedup_key: format!("project_start:{}:{}", exam.base().id, r.id),
                title: "Progetto iniziato".into(),
                body: format!("Inizia oggi il periodo per {}.", exam.base().name),
                with_actions: false,
                sound: None,
            });
        }
    }
    out
}

pub fn rule_project_deadline(
    now: DateTime<Local>,
    cfg: &ProjectDeadlineCfg,
    exams: &[Exam],
) -> Vec<NotifEvent> {
    let today = today(now);
    if !time_due_today(now, cfg.hour, 0) { return vec![]; }
    let mut out = Vec::new();
    for exam in exams.iter().filter(|e| !e.base().passed) {
        let ranges = exam.ranges();
        let Some(last) = ranges.last() else { continue };
        let Some(end) = parse_date(&last.end) else { continue };
        for offset in &cfg.offsets {
            let target = end - Duration::days(*offset);
            if target != today { continue; }
            let label = if *offset == 0 { "T-0".into() } else { format!("T-{}", offset) };
            let body = if *offset == 0 {
                format!("Consegna oggi: {}.", exam.base().name)
            } else if *offset == 1 {
                format!("Domani scade {}.", exam.base().name)
            } else {
                format!("Fra {} giorni scade {}.", offset, exam.base().name)
            };
            out.push(NotifEvent {
                kind: NotifKind::ProjectDeadline,
                dedup_key: format!("project_deadline:{}:{}:{}", exam.base().id, last.id, label),
                title: "Deadline progetto".into(),
                body,
                with_actions: false,
                sound: None,
            });
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::types::*;

    fn dt(y: i32, m: u32, d: u32, h: u32, mi: u32) -> DateTime<Local> {
        Local.with_ymd_and_hms(y, m, d, h, mi, 0).unwrap()
    }

    fn esame_with_appello(id: i64, ap_id: i64, name: &str, ap_date: &str) -> Exam {
        Exam::Esame(EsameData {
            id, name: name.into(), color: "#112233".into(), icon: "book-open".into(),
            passed: false, default_study_minutes: 60,
            appelli: vec![Appello { id: ap_id, date: ap_date.into() }],
            study_days: vec![],
        })
    }

    fn progetto(id: i64, range_id: i64, name: &str, start: &str, end: &str) -> Exam {
        Exam::Progetto(ProgettoData {
            esame: EsameData {
                id, name: name.into(), color: "#112233".into(), icon: "book-open".into(),
                passed: false, default_study_minutes: 60,
                appelli: vec![], study_days: vec![],
            },
            ranges: vec![ProjectRange { id: range_id, start: start.into(), end: end.into() }],
        })
    }

    #[test]
    fn exam_imminent_fires_at_t_minus_3_at_08() {
        let now = dt(2026, 5, 18, 8, 0);
        let cfg = ExamImminentCfg::default();
        let exams = vec![esame_with_appello(1, 7, "Neuro", "2026-05-21")];
        let evs = rule_exam_imminent(now, &cfg, &exams);
        assert_eq!(evs.len(), 1);
        assert_eq!(evs[0].dedup_key, "exam_imminent:1:7:T-3");
    }

    #[test]
    fn exam_imminent_silent_before_08() {
        let now = dt(2026, 5, 18, 7, 59);
        let cfg = ExamImminentCfg::default();
        let exams = vec![esame_with_appello(1, 7, "Neuro", "2026-05-21")];
        assert!(rule_exam_imminent(now, &cfg, &exams).is_empty());
    }

    #[test]
    fn exam_imminent_t_zero_uses_morning_time() {
        let now = dt(2026, 5, 18, 7, 30);
        let cfg = ExamImminentCfg::default();
        let exams = vec![esame_with_appello(1, 7, "Neuro", "2026-05-18")];
        let evs = rule_exam_imminent(now, &cfg, &exams);
        assert_eq!(evs.len(), 1);
        assert!(evs[0].dedup_key.ends_with(":T-0"));
    }

    #[test]
    fn exam_imminent_skips_passed() {
        let now = dt(2026, 5, 18, 8, 0);
        let cfg = ExamImminentCfg::default();
        let mut e = esame_with_appello(1, 7, "Neuro", "2026-05-21");
        if let Exam::Esame(ref mut b) = e { b.passed = true; }
        assert!(rule_exam_imminent(now, &cfg, &[e]).is_empty());
    }

    #[test]
    fn project_start_fires_on_start_date() {
        let now = dt(2026, 5, 18, 8, 0);
        let cfg = ProjectDeadlineCfg::default();
        let p = progetto(2, 9, "Tesi", "2026-05-18", "2026-06-10");
        let evs = rule_project_start(now, &cfg, &[p]);
        assert_eq!(evs.len(), 1);
        assert_eq!(evs[0].dedup_key, "project_start:2:9");
    }

    #[test]
    fn project_deadline_fires_at_t_minus_1() {
        let now = dt(2026, 5, 18, 8, 0);
        let cfg = ProjectDeadlineCfg::default();
        let p = progetto(2, 9, "Tesi", "2026-05-01", "2026-05-19");
        let evs = rule_project_deadline(now, &cfg, &[p]);
        assert_eq!(evs.len(), 1);
        assert_eq!(evs[0].dedup_key, "project_deadline:2:9:T-1");
    }

    #[test]
    fn project_deadline_only_last_range() {
        let now = dt(2026, 5, 18, 8, 0);
        let cfg = ProjectDeadlineCfg::default();
        let p = Exam::Progetto(ProgettoData {
            esame: EsameData {
                id: 2, name: "Tesi".into(), color: "#112233".into(), icon: "book-open".into(),
                passed: false, default_study_minutes: 60,
                appelli: vec![], study_days: vec![],
            },
            ranges: vec![
                ProjectRange { id: 9,  start: "2026-04-01".into(), end: "2026-05-18".into() }, // oggi
                ProjectRange { id: 10, start: "2026-05-25".into(), end: "2026-06-10".into() }, // futuro = last
            ],
        });
        let evs = rule_project_deadline(now, &cfg, &[p]);
        // last range termina 2026-06-10 → oggi (2026-05-18) non è T-3/T-1/T-0 → nessuna notifica
        assert!(evs.is_empty());
    }
}
```

- [ ] **Step 3: Run tests**

```
cd src-tauri ; cargo test --lib notify::rules ; cd ..
```
Atteso: 7 test passati.

- [ ] **Step 4: Commit**

```
git add src-tauri/src/notify/
git commit -m "feat(notifications): rules per esami imminenti, inizio e deadline progetti"
```

---

## Task 7: notify/rules.rs — parte 2 (studio, streak, quick log)

**Files:**
- Modify: `src-tauri/src/notify/rules.rs`

- [ ] **Step 1: Aggiungere `rule_study_reminder`, `rule_study_missed`, `rule_streak_milestone`, `rule_quick_log_prompt`**

Aggiungere alla fine di `notify/rules.rs` (prima del modulo `tests`):

```rust
fn parse_hhmm(s: &str) -> Option<(u32, u32)> {
    let mut it = s.split(':');
    let h: u32 = it.next()?.parse().ok()?;
    let m: u32 = it.next()?.parse().ok()?;
    if h < 24 && m < 60 { Some((h, m)) } else { None }
}

fn total_minutes_today(exams: &[Exam], today: NaiveDate) -> i64 {
    let today_s = today.format("%Y-%m-%d").to_string();
    let mut tot: i64 = 0;
    for e in exams.iter().filter(|e| !e.base().passed) {
        for sd in &e.base().study_days {
            if sd.date == today_s {
                tot += sd.minutes.unwrap_or(0) as i64;
            }
        }
    }
    tot
}

fn any_active_exams(exams: &[Exam]) -> bool {
    exams.iter().any(|e| !e.base().passed)
}

pub fn rule_study_reminder(
    now: DateTime<Local>,
    cfg: &StudyReminderCfg,
    exams: &[Exam],
) -> Vec<NotifEvent> {
    if !any_active_exams(exams) { return vec![]; }
    let today = today(now);
    if total_minutes_today(exams, today) > 0 { return vec![]; }
    let mut out = Vec::new();
    for t in &cfg.times {
        let Some((h, m)) = parse_hhmm(t) else { continue };
        if !time_due_today(now, h, m) { continue; }
        out.push(NotifEvent {
            kind: NotifKind::StudyReminder,
            dedup_key: format!("study_reminder:{}:{}", today.format("%Y-%m-%d"), t),
            title: "Promemoria studio".into(),
            body: "Non hai ancora registrato studio per oggi.".into(),
            with_actions: false,
            sound: None,
        });
    }
    out
}

pub fn rule_study_missed(
    now: DateTime<Local>,
    cfg: &StudyMissedCfg,
    exams: &[Exam],
) -> Vec<NotifEvent> {
    if !any_active_exams(exams) { return vec![]; }
    let today = today(now);
    if cfg.weekdays_only {
        // chrono: Mon=1, Sun=7
        let wd = today.weekday().number_from_monday();
        if wd > 5 { return vec![]; }
    }
    if !time_due_today(now, cfg.hour, cfg.minute) { return vec![]; }
    if total_minutes_today(exams, today) > 0 { return vec![]; }
    vec![NotifEvent {
        kind: NotifKind::StudyMissed,
        dedup_key: format!("study_missed:{}", today.format("%Y-%m-%d")),
        title: "Giornata senza studio".into(),
        body: "Oggi non hai registrato minuti su nessun esame attivo.".into(),
        with_actions: false,
        sound: None,
    }]
}

/// Calcola lo streak corrente (giorni consecutivi con almeno 1 minuto su qualunque esame attivo)
/// fino a `today` incluso, con un look-back massimo di 200 giorni.
fn current_streak(exams: &[Exam], today: NaiveDate) -> i64 {
    let mut day = today;
    let mut count: i64 = 0;
    for _ in 0..200 {
        let day_s = day.format("%Y-%m-%d").to_string();
        let any: bool = exams.iter().filter(|e| !e.base().passed).any(|e| {
            e.base().study_days.iter().any(|sd| sd.date == day_s && sd.minutes.unwrap_or(0) > 0)
        });
        if any {
            count += 1;
            day = day.pred_opt().unwrap_or(day);
        } else {
            break;
        }
    }
    count
}

pub fn rule_streak_milestone(
    now: DateTime<Local>,
    exams: &[Exam],
) -> Vec<NotifEvent> {
    const MILESTONES: &[i64] = &[7, 14, 30, 60, 100];
    let streak = current_streak(exams, today(now));
    if !MILESTONES.contains(&streak) { return vec![]; }
    // Fire solo se siamo dopo le 09:00 (evita disturbo a mezzanotte se l'utente aggiorna in piena notte)
    if !time_due_today(now, 9, 0) { return vec![]; }
    vec![NotifEvent {
        kind: NotifKind::StreakMilestone,
        dedup_key: format!("streak_milestone:{}", streak),
        title: format!("{} giorni di streak!", streak),
        body: format!("Hai studiato {} giorni di fila. Continua così.", streak),
        with_actions: false,
        sound: Some("streak.wav".into()),
    }]
}

pub fn rule_quick_log_prompt(
    now: DateTime<Local>,
    cfg: &QuickLogPromptCfg,
    exams: &[Exam],
) -> Vec<NotifEvent> {
    if !any_active_exams(exams) { return vec![]; }
    let today = today(now);
    let mut out = Vec::new();
    for t in &cfg.times {
        let Some((h, m)) = parse_hhmm(t) else { continue };
        if !time_due_today(now, h, m) { continue; }
        out.push(NotifEvent {
            kind: NotifKind::QuickLogPrompt,
            dedup_key: format!("quick_log_prompt:{}:{}", today.format("%Y-%m-%d"), t),
            title: "Quanto hai studiato?".into(),
            body: "Tocca un bottone per registrare i minuti.".into(),
            with_actions: true,
            sound: None,
        });
    }
    out
}

/// Entry point unico: applica tutte le rules in base alle prefs.
pub fn compute_due(
    now: DateTime<Local>,
    prefs: &NotifPrefs,
    exams: &[Exam],
) -> Vec<NotifEvent> {
    if !prefs.master_enabled() { return vec![]; }
    let mut out = Vec::new();
    if prefs.is_enabled(NotifKind::ExamImminent) {
        let cfg: ExamImminentCfg = prefs.config(NotifKind::ExamImminent).unwrap_or_default();
        out.extend(rule_exam_imminent(now, &cfg, exams));
    }
    if prefs.is_enabled(NotifKind::ProjectStart) {
        let cfg: ProjectDeadlineCfg = prefs.config(NotifKind::ProjectStart).unwrap_or_default();
        out.extend(rule_project_start(now, &cfg, exams));
    }
    if prefs.is_enabled(NotifKind::ProjectDeadline) {
        let cfg: ProjectDeadlineCfg = prefs.config(NotifKind::ProjectDeadline).unwrap_or_default();
        out.extend(rule_project_deadline(now, &cfg, exams));
    }
    if prefs.is_enabled(NotifKind::StudyReminder) {
        let cfg: StudyReminderCfg = prefs.config(NotifKind::StudyReminder).unwrap_or_default();
        out.extend(rule_study_reminder(now, &cfg, exams));
    }
    if prefs.is_enabled(NotifKind::StudyMissed) {
        let cfg: StudyMissedCfg = prefs.config(NotifKind::StudyMissed).unwrap_or_default();
        out.extend(rule_study_missed(now, &cfg, exams));
    }
    if prefs.is_enabled(NotifKind::StreakMilestone) {
        out.extend(rule_streak_milestone(now, exams));
    }
    if prefs.is_enabled(NotifKind::QuickLogPrompt) {
        let cfg: QuickLogPromptCfg = prefs.config(NotifKind::QuickLogPrompt).unwrap_or_default();
        out.extend(rule_quick_log_prompt(now, &cfg, exams));
    }
    out
}
```

- [ ] **Step 2: Aggiungere test al modulo `tests` (in fondo a `notify/rules.rs`)**

Aggiungere prima del `}` finale di `mod tests {`:

```rust
    fn esame_with_studyday(id: i64, name: &str, date: &str, minutes: Option<i32>) -> Exam {
        Exam::Esame(EsameData {
            id, name: name.into(), color: "#112233".into(), icon: "book-open".into(),
            passed: false, default_study_minutes: 60,
            appelli: vec![],
            study_days: vec![StudyDay { date: date.into(), minutes }],
        })
    }

    #[test]
    fn study_reminder_fires_when_no_minutes_today() {
        let now = dt(2026, 5, 18, 18, 0);
        let cfg = StudyReminderCfg::default();
        let e = Exam::Esame(EsameData {
            id: 1, name: "X".into(), color: "#112233".into(), icon: "book-open".into(),
            passed: false, default_study_minutes: 60,
            appelli: vec![], study_days: vec![],
        });
        let evs = rule_study_reminder(now, &cfg, &[e]);
        assert_eq!(evs.len(), 1);
    }

    #[test]
    fn study_reminder_silent_when_studied() {
        let now = dt(2026, 5, 18, 18, 0);
        let cfg = StudyReminderCfg::default();
        let e = esame_with_studyday(1, "X", "2026-05-18", Some(30));
        assert!(rule_study_reminder(now, &cfg, &[e]).is_empty());
    }

    #[test]
    fn study_missed_fires_weekday_evening() {
        // 2026-05-18 è un lunedì
        let now = dt(2026, 5, 18, 22, 0);
        let cfg = StudyMissedCfg::default();
        let e = Exam::Esame(EsameData {
            id: 1, name: "X".into(), color: "#112233".into(), icon: "book-open".into(),
            passed: false, default_study_minutes: 60,
            appelli: vec![], study_days: vec![],
        });
        let evs = rule_study_missed(now, &cfg, &[e]);
        assert_eq!(evs.len(), 1);
    }

    #[test]
    fn study_missed_silent_weekend() {
        // 2026-05-23 è un sabato
        let now = dt(2026, 5, 23, 22, 0);
        let cfg = StudyMissedCfg::default();
        let e = Exam::Esame(EsameData {
            id: 1, name: "X".into(), color: "#112233".into(), icon: "book-open".into(),
            passed: false, default_study_minutes: 60,
            appelli: vec![], study_days: vec![],
        });
        assert!(rule_study_missed(now, &cfg, &[e]).is_empty());
    }

    #[test]
    fn streak_milestone_at_7() {
        let now = dt(2026, 5, 18, 10, 0);
        // 7 giorni consecutivi fino a oggi
        let mut sd = Vec::new();
        for off in 0..7 {
            let d = NaiveDate::from_ymd_opt(2026, 5, 18).unwrap() - Duration::days(off);
            sd.push(StudyDay { date: d.format("%Y-%m-%d").to_string(), minutes: Some(30) });
        }
        let e = Exam::Esame(EsameData {
            id: 1, name: "X".into(), color: "#112233".into(), icon: "book-open".into(),
            passed: false, default_study_minutes: 60,
            appelli: vec![], study_days: sd,
        });
        let evs = rule_streak_milestone(now, &[e]);
        assert_eq!(evs.len(), 1);
        assert_eq!(evs[0].dedup_key, "streak_milestone:7");
    }

    #[test]
    fn streak_not_at_milestone_silent() {
        let now = dt(2026, 5, 18, 10, 0);
        let mut sd = Vec::new();
        for off in 0..5 {
            let d = NaiveDate::from_ymd_opt(2026, 5, 18).unwrap() - Duration::days(off);
            sd.push(StudyDay { date: d.format("%Y-%m-%d").to_string(), minutes: Some(30) });
        }
        let e = Exam::Esame(EsameData {
            id: 1, name: "X".into(), color: "#112233".into(), icon: "book-open".into(),
            passed: false, default_study_minutes: 60,
            appelli: vec![], study_days: sd,
        });
        assert!(rule_streak_milestone(now, &[e]).is_empty());
    }

    #[test]
    fn compute_due_respects_master_off() {
        let now = dt(2026, 5, 18, 8, 0);
        let prefs = NotifPrefs::default(); // master OFF
        let exams = vec![esame_with_appello(1, 7, "Neuro", "2026-05-21")];
        assert!(compute_due(now, &prefs, &exams).is_empty());
    }

    #[test]
    fn compute_due_runs_when_master_on() {
        let now = dt(2026, 5, 18, 8, 0);
        let mut prefs = NotifPrefs::default();
        prefs.entries.insert("_master".into(), NotifPref { enabled: true, config_json: "{}".into() });
        let exams = vec![esame_with_appello(1, 7, "Neuro", "2026-05-21")];
        let evs = compute_due(now, &prefs, &exams);
        assert!(evs.iter().any(|e| e.kind == NotifKind::ExamImminent));
    }
```

- [ ] **Step 3: Run tests**

```
cd src-tauri ; cargo test --lib notify::rules ; cd ..
```
Atteso: 15 test totali passati.

- [ ] **Step 4: Commit**

```
git add src-tauri/src/notify/rules.rs
git commit -m "feat(notifications): rules per studio, streak, quick log + entry compute_due"
```

---

## Task 8: NotificationService trait + scheduler

**Files:**
- Create: `src-tauri/src/notify/service.rs`
- Create: `src-tauri/src/notify/scheduler.rs`
- Modify: `src-tauri/src/notify/mod.rs`

- [ ] **Step 1: Aggiornare `notify/mod.rs`**

Sostituire con:

```rust
pub mod types;
pub mod prefs;
pub mod dedup;
pub mod rules;
pub mod service;
pub mod scheduler;
```

- [ ] **Step 2: Scrivere `notify/service.rs`**

Contenuto:

```rust
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use crate::notify::types::NotifEvent;

/// Astrazione iniettabile per i test.
pub trait NotificationSink: Send + Sync + 'static {
    fn send(&self, ev: &NotifEvent) -> Result<(), String>;
}

pub struct TauriSink {
    pub app: AppHandle,
}

impl NotificationSink for TauriSink {
    fn send(&self, ev: &NotifEvent) -> Result<(), String> {
        let mut b = self.app.notification().builder()
            .title(&ev.title)
            .body(&ev.body);
        if let Some(s) = &ev.sound {
            b = b.sound(s);
        }
        // Per le azioni cliccabili (with_actions=true) servirebbe registrare ActionTypeId nel
        // notification center di Windows via tauri_plugin_notification::register_action_types,
        // chiamato al setup() della app. Vedi notify::actions per i payload.
        b.show().map_err(|e| format!("notif: {e}"))
    }
}

#[cfg(test)]
pub struct VecSink {
    pub sent: std::sync::Mutex<Vec<NotifEvent>>,
}

#[cfg(test)]
impl VecSink {
    pub fn new() -> Self { Self { sent: std::sync::Mutex::new(vec![]) } }
}

#[cfg(test)]
impl NotificationSink for VecSink {
    fn send(&self, ev: &NotifEvent) -> Result<(), String> {
        self.sent.lock().unwrap().push(ev.clone());
        Ok(())
    }
}
```

- [ ] **Step 3: Scrivere `notify/scheduler.rs`**

Contenuto:

```rust
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
```

- [ ] **Step 4: Run tests**

```
cd src-tauri ; cargo test --lib notify::scheduler ; cd ..
```
Atteso: 2 test passati.

- [ ] **Step 5: Commit**

```
git add src-tauri/src/notify/
git commit -m "feat(notifications): NotificationSink trait + tokio tick loop"
```

---

## Task 9: notify/actions.rs (handler azioni cliccabili)

**Files:**
- Create: `src-tauri/src/notify/actions.rs`
- Modify: `src-tauri/src/notify/mod.rs`

- [ ] **Step 1: Registrare il sottomodulo**

In `src-tauri/src/notify/mod.rs` aggiungere:

```rust
pub mod actions;
```

- [ ] **Step 2: Scrivere `notify/actions.rs`**

Contenuto:

```rust
use chrono::{Duration, Local};
use rusqlite::Connection;
use crate::db;
use crate::notify::dedup;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QuickLogAction {
    LogMinutes(i32),
    Snooze(i64), // minuti
}

impl QuickLogAction {
    pub fn from_id(id: &str) -> Option<Self> {
        match id {
            "log15" => Some(Self::LogMinutes(15)),
            "log30" => Some(Self::LogMinutes(30)),
            "log60" => Some(Self::LogMinutes(60)),
            "snooze60" => Some(Self::Snooze(60)),
            _ => None,
        }
    }
}

/// Applica un'azione: registra minuti sull'esame "più recente" o posticipa la prompt corrente.
pub fn apply(conn: &Connection, action: QuickLogAction, prompt_dedup_key: &str) -> Result<(), String> {
    match action {
        QuickLogAction::LogMinutes(m) => {
            let exam_id = recent_active_exam(conn)?
                .ok_or_else(|| "Nessun esame attivo".to_string())?;
            let today = Local::now().date_naive().format("%Y-%m-%d").to_string();
            // Crea la riga se mancante (best-effort: toggle solo per esami; per progetti
            // set_study_day_minutes upserta da solo se nel range).
            let _ = db::exams::toggle_study_day(conn, exam_id, &today);
            db::exams::set_study_day_minutes(conn, exam_id, &today, Some(m))?;
            Ok(())
        }
        QuickLogAction::Snooze(min) => {
            let when = Local::now() + Duration::minutes(min);
            dedup::defer_until(conn, "quick_log_prompt", prompt_dedup_key, when)
        }
    }
}

/// Esame attivo (non passed) usato più di recente, basato sulla MAX(date) in study_days.
/// Fallback: primo esame attivo per nome.
pub fn recent_active_exam(conn: &Connection) -> Result<Option<i64>, String> {
    let last: Option<i64> = conn.query_row(
        "SELECT e.id FROM exams e
         JOIN study_days s ON s.exam_id = e.id
         WHERE e.passed = 0
         ORDER BY s.date DESC, s.exam_id DESC
         LIMIT 1",
        [],
        |r| r.get(0),
    ).ok();
    if last.is_some() { return Ok(last); }
    let first: Option<i64> = conn.query_row(
        "SELECT id FROM exams WHERE passed = 0 ORDER BY name COLLATE NOCASE LIMIT 1",
        [],
        |r| r.get(0),
    ).ok();
    Ok(first)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::db::types::*;

    fn create_esame(conn: &mut Connection, name: &str) -> i64 {
        let i = ExamInput::Esame(EsameInputData {
            name: name.into(), color: "#112233".into(), icon: "book-open".into(),
            passed: false, default_study_minutes: 60, appelli: vec![],
        });
        db::exams::create(conn, &i).unwrap().id()
    }

    #[test]
    fn recent_active_falls_back_to_first_by_name() {
        let mut conn = open_in_memory().unwrap();
        let _id1 = create_esame(&mut conn, "Zeta");
        let _id2 = create_esame(&mut conn, "Alfa");
        let id = recent_active_exam(&conn).unwrap().unwrap();
        let n: String = conn.query_row("SELECT name FROM exams WHERE id=?1", [id], |r| r.get(0)).unwrap();
        assert_eq!(n, "Alfa");
    }

    #[test]
    fn recent_active_uses_last_study_day() {
        let mut conn = open_in_memory().unwrap();
        let zeta = create_esame(&mut conn, "Zeta");
        let _alfa = create_esame(&mut conn, "Alfa");
        db::exams::toggle_study_day(&conn, zeta, "2026-05-10").unwrap();
        let id = recent_active_exam(&conn).unwrap().unwrap();
        assert_eq!(id, zeta);
    }

    #[test]
    fn apply_log_minutes_writes_today() {
        let mut conn = open_in_memory().unwrap();
        let id = create_esame(&mut conn, "X");
        apply(&conn, QuickLogAction::LogMinutes(30), "k").unwrap();
        let today = chrono::Local::now().date_naive().format("%Y-%m-%d").to_string();
        let m: Option<i32> = conn.query_row(
            "SELECT minutes FROM study_days WHERE exam_id = ?1 AND date = ?2",
            [&id.to_string(), &today], |r| r.get(0),
        ).unwrap();
        assert_eq!(m, Some(30));
    }

    #[test]
    fn apply_snooze_defers() {
        let conn = open_in_memory().unwrap();
        apply(&conn, QuickLogAction::Snooze(60), "quick_log_prompt:2026-05-18:18:00").unwrap();
        let now = chrono::Local::now();
        assert!(dedup::is_snoozed(&conn, "quick_log_prompt", "quick_log_prompt:2026-05-18:18:00", now).unwrap());
    }
}
```

- [ ] **Step 3: Run tests**

```
cd src-tauri ; cargo test --lib notify::actions ; cd ..
```
Atteso: 4 test passati.

- [ ] **Step 4: Commit**

```
git add src-tauri/src/notify/
git commit -m "feat(notifications): handler azioni quick log (+min, snooze)"
```

---

## Task 10: Comandi Tauri per notifiche e quick log

**Files:**
- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1: Aggiungere i nuovi comandi**

In coda a `src-tauri/src/commands.rs` (prima di `pub fn build_state`) aggiungere:

```rust
use crate::notify::{prefs, scheduler, service::TauriSink, types::{NotifEvent, NotifKind, NotifPrefs}};

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
```

- [ ] **Step 2: Build per verificare la compilazione**

```
cd src-tauri ; cargo build --lib ; cd ..
```
Atteso: build OK (warning ignorabili). NON eseguire `cargo test` ora — la registrazione plugin in `lib.rs` avverrà nel prossimo task.

- [ ] **Step 3: Commit**

```
git add src-tauri/src/commands.rs
git commit -m "feat(notifications): comandi Tauri (prefs, test_send, quicklog_*, force_tick)"
```

---

## Task 11: Integrazione plugin + spawn scheduler in lib.rs

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Sostituire `src-tauri/src/lib.rs` con la versione integrata**

```rust
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
```

- [ ] **Step 2: Non compilare ancora**

Il modulo `quicklog` non esiste ancora: serve il Task 12. Procedere subito.

---

## Task 12: Modulo quicklog (tray + finestra + hotkey)

**Files:**
- Create: `src-tauri/src/quicklog/mod.rs`
- Create: `src-tauri/src/quicklog/tray.rs`

- [ ] **Step 1: Scrivere `src-tauri/src/quicklog/mod.rs`**

```rust
pub mod tray;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

pub const QUICKLOG_LABEL: &str = "quicklog";

pub fn show_or_create(app: &AppHandle) -> tauri::Result<()> {
    if let Some(w) = app.get_webview_window(QUICKLOG_LABEL) {
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(app, QUICKLOG_LABEL, WebviewUrl::App("index.html".into()))
        .title("Quick log studio")
        .inner_size(380.0, 240.0)
        .decorations(false)
        .resizable(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .center()
        .build()?;
    Ok(())
}

pub fn register_hotkey(app: &AppHandle) -> tauri::Result<()> {
    let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyS);
    let app_for_handler = app.clone();
    app.global_shortcut().on_shortcut(shortcut, move |_app, _sc, event| {
        if event.state() == ShortcutState::Pressed {
            let _ = show_or_create(&app_for_handler);
        }
    })?;
    Ok(())
}
```

- [ ] **Step 2: Scrivere `src-tauri/src/quicklog/tray.rs`**

```rust
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

pub fn install(app: &tauri::App) -> tauri::Result<()> {
    let open_app = MenuItemBuilder::with_id("open_app", "Apri app").build(app)?;
    let open_quicklog = MenuItemBuilder::with_id("open_quicklog", "Apri quick log…").build(app)?;
    let toggle_mute = MenuItemBuilder::with_id("toggle_mute", "Disattiva notifiche temporaneamente").build(app)?;
    let quit = MenuItemBuilder::with_id("quit_app", "Esci").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&open_app)
        .item(&open_quicklog)
        .separator()
        .item(&toggle_mute)
        .separator()
        .item(&quit)
        .build()?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Calendario Appelli e Studio")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "open_app" => { show_main(app); }
                "open_quicklog" => { let _ = crate::quicklog::show_or_create(app); }
                "toggle_mute" => {
                    // Toggle master OFF/ON
                    let state = app.state::<crate::commands::AppState>();
                    if let Ok(guard) = state.conn.lock() {
                        if let Ok(conn) = guard.as_ref() {
                            let prefs = crate::notify::prefs::load_all(conn).unwrap_or_default();
                            let new_enabled = !prefs.master_enabled();
                            let _ = crate::notify::prefs::upsert(conn, "_master", new_enabled, "{}");
                        }
                    }
                }
                "quit_app" => { app.exit(0); }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}
```

- [ ] **Step 3: Compilare**

```
cd src-tauri ; cargo build --lib ; cd ..
```
Atteso: build OK.

- [ ] **Step 4: Run dei test Rust complessivi**

```
cd src-tauri ; cargo test --lib ; cd ..
```
Atteso: tutti i test passano (incl. db, notify::*).

- [ ] **Step 5: Commit**

```
git add src-tauri/src/lib.rs src-tauri/src/quicklog/
git commit -m "feat(notifications): tray icon, finestra quicklog, global shortcut Ctrl+Alt+S"
```

---

## Task 13: Configurazione `tauri.conf.json` (asset audio + autostart)

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Create: `src-tauri/assets/streak.wav`

- [ ] **Step 1: Copiare un suono di sistema come asset**

In PowerShell, dalla root del repo:

```
New-Item -ItemType Directory -Force src-tauri\assets
Copy-Item C:\Windows\Media\Alarm05.wav src-tauri\assets\streak.wav
```

Atteso: file `src-tauri/assets/streak.wav` esistente. Se Alarm05.wav non esistesse, sostituirlo con qualsiasi altro `.wav` da `C:\Windows\Media\` (es. `tada.wav`, `chimes.wav`).

- [ ] **Step 2: Estendere `src-tauri/tauri.conf.json`**

Sostituire con:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Calendario Appelli e Studio",
  "version": "0.1.0",
  "identifier": "com.calendario-appelli.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Calendario Appelli e Studio",
        "width": 1100,
        "height": 760,
        "minWidth": 760,
        "minHeight": 600
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "resources": [
      "assets/streak.wav"
    ]
  }
}
```

Nota: l'etichetta `"main"` è ora esplicita; la finestra `quicklog` viene creata runtime in `quicklog/mod.rs`.

- [ ] **Step 3: Commit**

```
git add src-tauri/tauri.conf.json src-tauri/assets/streak.wav
git commit -m "feat(notifications): bundle asset streak.wav + label main esplicita"
```

---

## Task 14: Frontend — wrapper `notifications.ts` + estensione `db.ts`

**Files:**
- Create: `src/notifications.ts`
- Modify: `src/db.ts`

- [ ] **Step 1: Scrivere `src/notifications.ts`**

```ts
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
} from "@tauri-apps/plugin-notification";
import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";

export type NotifKindStr =
  | "exam_imminent" | "project_start" | "project_deadline"
  | "study_reminder" | "study_missed" | "streak_milestone" | "quick_log_prompt";

export const ALL_KINDS: NotifKindStr[] = [
  "exam_imminent", "project_start", "project_deadline",
  "study_reminder", "study_missed", "streak_milestone", "quick_log_prompt",
];

export const KIND_LABELS: Record<NotifKindStr, string> = {
  exam_imminent:    "Esami imminenti",
  project_start:    "Inizio progetti",
  project_deadline: "Deadline progetti",
  study_reminder:   "Promemoria studio",
  study_missed:     "Mancato studio",
  streak_milestone: "Milestone streak",
  quick_log_prompt: "Log rapido programmato",
};

export interface NotifPref { enabled: boolean; config_json: string }
export interface NotifPrefs { entries: Record<string, NotifPref> }

export async function getNotifPrefs(): Promise<NotifPrefs> {
  return await invoke<NotifPrefs>("get_notif_prefs");
}

export async function setNotifPref(kind: string, enabled: boolean, configJson?: string): Promise<void> {
  await invoke("set_notif_pref", { kind, enabled, configJson: configJson ?? "{}" });
}

export async function testSend(kind: NotifKindStr): Promise<void> {
  await invoke("notif_test_send", { kind });
}

export async function forceTick(): Promise<number> {
  return await invoke<number>("notif_force_tick");
}

export async function ensurePermission(): Promise<boolean> {
  if (await isPermissionGranted()) return true;
  const res = await requestPermission();
  return res === "granted";
}

export async function setAutostart(on: boolean): Promise<void> {
  if (on) await enableAutostart(); else await disableAutostart();
}

export async function getAutostart(): Promise<boolean> {
  return await isAutostartEnabled();
}

// ---------- helpers per leggere/scrivere config_json tipati ----------

export interface StudyReminderCfg { times: string[] }
export interface StudyMissedCfg   { hour: number; minute: number; weekdays_only: boolean }
export interface ExamImminentCfg  { offsets: number[]; hour: number; morning_hour: number; morning_minute: number }
export interface ProjectDeadlineCfg { offsets: number[]; hour: number }
export interface QuickLogPromptCfg { times: string[] }

export function parseConfig<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}
```

- [ ] **Step 2: Estendere `src/db.ts`** con i 3 quicklog command

In coda a `src/db.ts` aggiungere:

```ts
export interface ActiveExamLite { id: number; name: string; color: string }

export async function quicklogLog(examId: number, minutes: number): Promise<void> {
  await invoke("quicklog_log", { examId, minutes });
}

export async function quicklogRecentExam(): Promise<number | null> {
  return await invoke<number | null>("quicklog_recent_exam");
}

export async function quicklogActiveExams(): Promise<ActiveExamLite[]> {
  const rows = await invoke<Array<[number, string, string]>>("quicklog_active_exams");
  return rows.map(([id, name, color]) => ({ id, name, color }));
}
```

- [ ] **Step 3: Commit**

```
git add src/notifications.ts src/db.ts
git commit -m "feat(notifications): wrapper TS per prefs/test/quicklog/autostart"
```

---

## Task 15: Frontend — finestra quicklog (routing + UI)

**Files:**
- Modify: `src/main.tsx`
- Create: `src/quicklog.tsx`

- [ ] **Step 1: Aggiornare `src/main.tsx` con routing per label**

Sostituire con:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { QuicklogApp } from "./quicklog";
import { ThemeProvider } from "./theme";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "./index.css";

const label = (() => {
  try { return getCurrentWebviewWindow().label; } catch { return "main"; }
})();

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

if (label === "quicklog") {
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <QuicklogApp />
      </ThemeProvider>
    </React.StrictMode>,
  );
} else {
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </React.StrictMode>,
  );
}
```

- [ ] **Step 2: Creare `src/quicklog.tsx`**

```tsx
import { useEffect, useState } from "react";
import { quicklogActiveExams, quicklogLog, quicklogRecentExam, type ActiveExamLite } from "./db";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export function QuicklogApp() {
  const [exams, setExams] = useState<ActiveExamLite[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [minutes, setMinutes] = useState<string>("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const list = await quicklogActiveExams();
        setExams(list);
        const recent = await quicklogRecentExam();
        setSelectedId(recent ?? list[0]?.id ?? null);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        await getCurrentWebviewWindow().hide();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const log = async (m: number) => {
    if (selectedId == null) { setError("Seleziona un esame"); return; }
    if (m <= 0 || m > 1440) { setError("Minuti 1-1440"); return; }
    setBusy(true); setError(null);
    try {
      await quicklogLog(selectedId, m);
      await getCurrentWebviewWindow().hide();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const m = parseInt(minutes, 10);
    if (Number.isNaN(m)) { setError("Minuti non validi"); return; }
    void log(m);
  };

  return (
    <div
      className="h-screen w-screen flex items-center justify-center p-3"
      style={{ background: "transparent" }}
    >
      <div className="w-full max-w-[360px] rounded-2xl glass-panel shadow-lg p-4 flex flex-col gap-3">
        <div className="text-[11px] uppercase tracking-wider text-app-muted font-semibold">
          Quick log studio
        </div>
        <select
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(parseInt(e.target.value, 10))}
          className="w-full px-2 py-1.5 rounded-md border border-app-input-border bg-app-card text-app-fg text-[13px]"
          disabled={busy || exams.length === 0}
        >
          {exams.length === 0 && <option value="">Nessun esame attivo</option>}
          {exams.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <div className="grid grid-cols-4 gap-2">
          {[15, 30, 60, 90].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => log(m)}
              disabled={busy || selectedId == null}
              className="px-2 py-2 rounded-md bg-app-accent text-app-accent-fg text-[12.5px] font-semibold disabled:opacity-50"
            >
              +{m}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-md border border-app-input-border bg-app-card text-app-fg text-[13px]"
          />
          <button
            type="submit"
            disabled={busy || selectedId == null}
            className="px-3 py-1.5 rounded-md bg-app-accent text-app-accent-fg text-[12.5px] font-semibold disabled:opacity-50"
          >
            OK
          </button>
        </form>
        {error && <div className="text-[11.5px] text-red-600">{error}</div>}
        <div className="text-[10.5px] text-app-muted">ESC chiude — Enter conferma</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```
git add src/main.tsx src/quicklog.tsx
git commit -m "feat(notifications): finestra quicklog (routing per label + UI)"
```

---

## Task 16: Frontend — componente `NotificationsSettings.tsx`

**Files:**
- Create: `src/components/NotificationsSettings.tsx`

- [ ] **Step 1: Scrivere il componente**

```tsx
import { useEffect, useMemo, useState } from "react";
import {
  ALL_KINDS, KIND_LABELS, type NotifKindStr,
  getNotifPrefs, setNotifPref, ensurePermission, testSend,
  parseConfig, type StudyReminderCfg, type StudyMissedCfg, type QuickLogPromptCfg,
  type ExamImminentCfg, type ProjectDeadlineCfg,
} from "../notifications";
import { useToast } from "../toast";
import { Bell, BellOff } from "lucide-react";

interface PrefRow { enabled: boolean; configJson: string }
type PrefMap = Record<string, PrefRow>;

export function NotificationsSettings() {
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [prefs, setPrefs] = useState<PrefMap>({});
  const [permError, setPermError] = useState<string | null>(null);

  const masterOn = prefs._master?.enabled ?? false;

  useEffect(() => {
    void (async () => {
      try {
        const p = await getNotifPrefs();
        const m: PrefMap = {};
        for (const [k, v] of Object.entries(p.entries)) {
          m[k] = { enabled: v.enabled, configJson: v.config_json };
        }
        setPrefs(m);
      } catch (e) {
        toast.error(String(e));
      } finally {
        setLoaded(true);
      }
    })();
  }, [toast]);

  const update = async (key: string, next: PrefRow) => {
    setPrefs((p) => ({ ...p, [key]: next }));
    try {
      await setNotifPref(key, next.enabled, next.configJson);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const toggleMaster = async () => {
    if (!masterOn) {
      const ok = await ensurePermission();
      if (!ok) {
        setPermError("Permessi notifiche Windows negati. Abilita le notifiche dell'app dalle impostazioni di sistema.");
        return;
      }
      setPermError(null);
    }
    await update("_master", { enabled: !masterOn, configJson: "{}" });
  };

  if (!loaded) {
    return <div className="text-[12px] text-app-muted">Caricamento preferenze…</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => void toggleMaster()}
        className={
          "flex items-center gap-3 px-3 py-3 rounded-[10px] text-[13px] font-semibold border transition-colors " +
          (masterOn
            ? "bg-app-accent text-app-accent-fg border-app-accent"
            : "bg-app-card text-app-fg border-app-input-border hover:bg-app-hover")
        }
      >
        {masterOn ? <Bell size={18} /> : <BellOff size={18} />}
        {masterOn ? "Notifiche attive" : "Abilita notifiche"}
      </button>
      {permError && (
        <div className="text-[11.5px] text-red-600 leading-relaxed">{permError}</div>
      )}

      <div className={"flex flex-col gap-2 " + (masterOn ? "" : "opacity-50 pointer-events-none select-none")}>
        <div className="text-[11px] uppercase tracking-wider text-app-muted font-semibold mt-2">Tipi di notifica</div>
        {ALL_KINDS.map((k) => (
          <KindRow
            key={k}
            kind={k}
            pref={prefs[k] ?? { enabled: true, configJson: "{}" }}
            onChange={(next) => void update(k, next)}
          />
        ))}
        <div className="pt-2 border-t border-app-border">
          <button
            type="button"
            onClick={async () => { try { await testSend("study_reminder"); toast.info("Inviata"); } catch (e) { toast.error(String(e)); } }}
            className="text-[12px] underline text-app-accent"
          >
            Invia notifica di test
          </button>
        </div>
      </div>
    </div>
  );
}

function KindRow({ kind, pref, onChange }: { kind: NotifKindStr; pref: PrefRow; onChange: (p: PrefRow) => void }) {
  const setEnabled = (enabled: boolean) => onChange({ ...pref, enabled });
  const setConfig  = (configJson: string) => onChange({ ...pref, configJson });

  return (
    <div className="flex flex-col gap-1 py-1.5">
      <label className="flex items-center gap-2 text-[12.5px]">
        <input
          type="checkbox"
          checked={pref.enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>{KIND_LABELS[kind]}</span>
      </label>
      {pref.enabled && <KindConfig kind={kind} json={pref.configJson} onJson={setConfig} />}
    </div>
  );
}

function KindConfig({ kind, json, onJson }: { kind: NotifKindStr; json: string; onJson: (j: string) => void }) {
  if (kind === "study_reminder")   return <TimesEditor cfg={parseConfig<StudyReminderCfg>(json,   { times: ["18:00"] })} onChange={(c) => onJson(JSON.stringify(c))} />;
  if (kind === "quick_log_prompt") return <TimesEditor cfg={parseConfig<QuickLogPromptCfg>(json, { times: [] })}        onChange={(c) => onJson(JSON.stringify(c))} />;
  if (kind === "study_missed")     return <StudyMissedEditor cfg={parseConfig<StudyMissedCfg>(json, { hour: 22, minute: 0, weekdays_only: true })} onChange={(c) => onJson(JSON.stringify(c))} />;
  if (kind === "exam_imminent")    return <OffsetsEditor offsets={parseConfig<ExamImminentCfg>(json, { offsets: [7,3,1,0], hour: 8, morning_hour: 7, morning_minute: 30 }).offsets} allowed={[7,3,1,0]} onChange={(offs) => { const cfg = parseConfig<ExamImminentCfg>(json, { offsets: [7,3,1,0], hour: 8, morning_hour: 7, morning_minute: 30 }); onJson(JSON.stringify({ ...cfg, offsets: offs })); }} />;
  if (kind === "project_deadline") return <OffsetsEditor offsets={parseConfig<ProjectDeadlineCfg>(json, { offsets: [3,1,0], hour: 8 }).offsets} allowed={[3,1,0]} onChange={(offs) => { const cfg = parseConfig<ProjectDeadlineCfg>(json, { offsets: [3,1,0], hour: 8 }); onJson(JSON.stringify({ ...cfg, offsets: offs })); }} />;
  return null;
}

function TimesEditor({ cfg, onChange }: { cfg: { times: string[] }; onChange: (c: { times: string[] }) => void }) {
  const [draft, setDraft] = useState("18:00");
  return (
    <div className="flex items-center gap-2 pl-6 flex-wrap">
      {cfg.times.map((t, i) => (
        <span key={i} className="inline-flex items-center gap-1 text-[11.5px] bg-app-hover px-2 py-0.5 rounded">
          {t}
          <button
            type="button"
            onClick={() => onChange({ times: cfg.times.filter((_, j) => j !== i) })}
            className="text-app-muted hover:text-red-500"
          >✕</button>
        </span>
      ))}
      <input
        type="time"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="px-1.5 py-0.5 rounded border border-app-input-border bg-app-card text-app-fg text-[11.5px]"
      />
      <button
        type="button"
        onClick={() => { if (draft && !cfg.times.includes(draft)) onChange({ times: [...cfg.times, draft] }); }}
        className="text-[11.5px] underline text-app-accent"
      >+ aggiungi</button>
    </div>
  );
}

function StudyMissedEditor({ cfg, onChange }: { cfg: StudyMissedCfg; onChange: (c: StudyMissedCfg) => void }) {
  const hhmm = `${String(cfg.hour).padStart(2,"0")}:${String(cfg.minute).padStart(2,"0")}`;
  return (
    <div className="flex items-center gap-3 pl-6">
      <input
        type="time"
        value={hhmm}
        onChange={(e) => {
          const [h, m] = e.target.value.split(":").map((x) => parseInt(x, 10));
          onChange({ ...cfg, hour: h, minute: m });
        }}
        className="px-1.5 py-0.5 rounded border border-app-input-border bg-app-card text-app-fg text-[11.5px]"
      />
      <label className="text-[11.5px] inline-flex items-center gap-1">
        <input
          type="checkbox"
          checked={cfg.weekdays_only}
          onChange={(e) => onChange({ ...cfg, weekdays_only: e.target.checked })}
        />
        solo feriali
      </label>
    </div>
  );
}

function OffsetsEditor({ offsets, allowed, onChange }: { offsets: number[]; allowed: number[]; onChange: (o: number[]) => void }) {
  const toggle = (n: number) => {
    const has = offsets.includes(n);
    onChange(has ? offsets.filter((x) => x !== n) : [...offsets, n].sort((a, b) => b - a));
  };
  return (
    <div className="flex items-center gap-2 pl-6 flex-wrap">
      {allowed.map((n) => (
        <label key={n} className="text-[11.5px] inline-flex items-center gap-1">
          <input type="checkbox" checked={offsets.includes(n)} onChange={() => toggle(n)} />
          {n === 0 ? "mattina" : `${n}gg`}
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add src/components/NotificationsSettings.tsx
git commit -m "feat(notifications): pannello sottosezione Notifiche con master + per-kind config"
```

---

## Task 17: Frontend — componente `SystemSettings.tsx`

**Files:**
- Create: `src/components/SystemSettings.tsx`

- [ ] **Step 1: Scrivere il componente**

```tsx
import { useEffect, useState } from "react";
import { getAutostart, setAutostart, getNotifPrefs, setNotifPref } from "../notifications";
import { useToast } from "../toast";

export function SystemSettings() {
  const toast = useToast();
  const [autostart, setAuto] = useState(false);
  const [minimize, setMinimize] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setAuto(await getAutostart());
        const p = await getNotifPrefs();
        setMinimize(p.entries["_minimize_to_tray"]?.enabled ?? true);
      } catch (e) {
        toast.error(String(e));
      } finally {
        setLoaded(true);
      }
    })();
  }, [toast]);

  const toggleAuto = async () => {
    const next = !autostart;
    try {
      await setAutostart(next);
      await setNotifPref("_autostart", next);
      setAuto(next);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const toggleMinimize = async () => {
    const next = !minimize;
    try {
      await setNotifPref("_minimize_to_tray", next);
      setMinimize(next);
    } catch (e) {
      toast.error(String(e));
    }
  };

  if (!loaded) return <div className="text-[12px] text-app-muted">Caricamento…</div>;

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" checked={autostart} onChange={toggleAuto} />
        Avvia con Windows
      </label>
      <label className="flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" checked={minimize} onChange={toggleMinimize} />
        Minimizza in tray invece di chiudere
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add src/components/SystemSettings.tsx
git commit -m "feat(notifications): sottosezione App e sistema (autostart + minimize-to-tray)"
```

---

## Task 18: Refactor `SettingsModal.tsx`

**Files:**
- Modify: `src/components/SettingsModal.tsx`

- [ ] **Step 1: Sostituire `src/components/SettingsModal.tsx`**

```tsx
import { Modal } from "./Modal";
import { ModalButton } from "./ModalButton";
import { useTheme } from "../theme";
import { Sun, Moon, Settings as SettingsIcon } from "lucide-react";
import { NotificationsSettings } from "./NotificationsSettings";
import { SystemSettings } from "./SystemSettings";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();

  const footer = (
    <>
      <div className="flex-1" />
      <ModalButton variant="primary" onClick={onClose}>Fatto</ModalButton>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Impostazioni"
      icon={SettingsIcon}
      size="sm"
      footer={footer}
    >
      <Section title="Tema">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={
              "flex flex-col items-center justify-center gap-2 px-3 py-[18px] " +
              "rounded-[10px] text-[12.5px] font-semibold border transition-colors " +
              (theme === "light"
                ? "bg-app-accent text-app-accent-fg border-app-accent"
                : "bg-app-card text-app-fg border-app-input-border hover:bg-app-hover")
            }
          >
            <Sun size={22} /> Chiaro
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={
              "flex flex-col items-center justify-center gap-2 px-3 py-[18px] " +
              "rounded-[10px] text-[12.5px] font-semibold border transition-colors " +
              (theme === "dark"
                ? "bg-app-accent text-app-accent-fg border-app-accent"
                : "bg-app-card text-app-fg border-app-input-border hover:bg-app-hover")
            }
          >
            <Moon size={22} /> Scuro
          </button>
        </div>
      </Section>

      <Section title="Notifiche">
        <NotificationsSettings />
      </Section>

      <Section title="App e sistema">
        <SystemSettings />
      </Section>

      <Section title="Profilo utente">
        <p className="text-[12px] text-app-muted leading-relaxed m-0">
          In arrivo: nome, avatar, obiettivi di studio settimanali, sincronizzazione locale tra dispositivi.
        </p>
      </Section>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 pt-4 border-t border-app-border first:pt-0 first:border-t-0">
      <div className="text-[11.5px] font-semibold text-app-muted">{title}</div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add src/components/SettingsModal.tsx
git commit -m "refactor(settings): sottosezioni separate (Tema, Notifiche, App e sistema, Profilo)"
```

---

## Task 19: Build completa + smoke test dev mode

**Files:** nessuna modifica al codice.

- [ ] **Step 1: Type check + bundle**

```
npm run build
```
Atteso: build OK, nessun errore TS.

- [ ] **Step 2: Avvio dev**

```
npm run tauri dev
```
Verificare nel log che non compaiano panic Rust né errori di tipo capability negata. La finestra principale si apre normalmente, la tray icon è visibile in basso a destra.

- [ ] **Step 3: Smoke checklist (cliccando nella UI)**

Verificare manualmente:
1. Aprire Impostazioni → la sottosezione "Notifiche" è visibile con master OFF.
2. Cliccare "Abilita notifiche" → richiesta permessi Windows accettata → master diventa ON.
3. Cliccare "Invia notifica di test" → appare un toast Windows (in dev può chiamarsi "PowerShell").
4. Chiudere la finestra principale con la X → la finestra sparisce ma il processo continua (l'app resta in tray).
5. Click sinistro sulla tray icon → la finestra principale riappare.
6. Premere `Ctrl+Alt+S` ovunque → appare la finestra quicklog (380×240, trasparente).
7. Nella quicklog: selezionare un esame attivo (creandone uno prima se mancante) → click `+30` → la finestra si chiude e il giorno corrente risulta loggato con 30 minuti.
8. Nelle Impostazioni → sottosezione "App e sistema" → toggle "Avvia con Windows" ON → verificare in `regedit` (o `Get-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\Run`) la presenza dell'entry per `Calendario Appelli e Studio`.

Se TUTTI i passi sopra passano, smoke OK.

- [ ] **Step 4: Commit (vuoto, milestone)**

```
git commit --allow-empty -m "chore(notifications): smoke test dev mode superato"
```

---

## Task 20: Build MSI + smoke test installato

**Files:** nessuna modifica al codice.

- [ ] **Step 1: Build production MSI**

```
npm run tauri build
```
Atteso: bundle MSI in `src-tauri/target/release/bundle/msi/*.msi`.

- [ ] **Step 2: Installare l'MSI**

Doppio click sull'MSI → installer Windows → completare. Lancia l'app dal menu Start.

- [ ] **Step 3: Smoke installato**

1. Le notifiche di test ora mostrano il nome corretto "Calendario Appelli e Studio" (non più "PowerShell").
2. Le notifiche del tipo "Log rapido programmato" — configura un orario fra 2-3 minuti, attendi, verifica che la notifica appaia con i bottoni `+15` `+30` `+60` `Snooze 1h`.
3. Click su `+30` nella notifica → l'esame "più recente" risulta loggato con 30 minuti (controllare aprendo l'app o via DB browser su `%APPDATA%/com.calendario-appelli.app/calendar.db`).
4. Click su `Snooze 1h` → la notifica viene posticipata di un'ora (verificabile lasciando il PC acceso o forzando con il comando `notif_force_tick`).
5. Reboot Windows → con autostart ON l'app riparte minimizzata in tray e lo scheduler riprende.

- [ ] **Step 4: Commit (vuoto, milestone)**

```
git commit --allow-empty -m "chore(notifications): smoke test su MSI installato superato"
```

---

## Self-review checklist (eseguita)

- **Spec coverage** §2 (7 tipi): ✅ Task 6/7 (rules) + Task 16 (UI per ognuno).
- **Spec §3 architettura**: ✅ Task 3-9 (notify/), Task 12 (quicklog/), Task 2 (migration).
- **Spec §4 DB**: ✅ Task 2 (SQL + dedup keys nei Task 6/7/9).
- **Spec §5 scheduler**: ✅ Task 8 (tick + spawn), Task 11 (wire-up).
- **Spec §6 quicklog**: ✅ Task 12 (hotkey + finestra), Task 15 (UI), Task 12 (tray).
- **Spec §7 autostart/tray**: ✅ Task 11 (on_window_event), Task 17 (toggle UI).
- **Spec §8 suoni**: ✅ Task 13 (asset), Task 7 (Streak con `sound`).
- **Spec §9 UI sottosezione + master**: ✅ Task 16, 17, 18.
- **Spec §10 comandi**: ✅ Task 10 (incl. force_tick aggiunto come bonus per testing).
- **Spec §11 close behaviour**: ✅ Task 11 (`on_window_event` con minimize_to_tray).
- **Spec §13 test**: ✅ unit test in ogni task Rust + smoke manuali Task 19/20.
- **Type consistency**: kind string usati come chiavi DB e in TypeScript sono gli stessi snake_case di `NotifKind::as_str()`. PrefRow campo `configJson` (TS) ↔ `config_json` (Rust serde con HashMap su String) — confermo OK.
- **Placeholder scan**: nessun TBD/TODO; gli "smoke checklist" hanno passi concreti.
