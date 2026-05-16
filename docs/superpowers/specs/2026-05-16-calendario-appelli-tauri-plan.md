# Calendario Appelli & Studio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare l'artifact `index.html` "Calendario Appelli & Studio" a una desktop app Tauri 2.x con persistenza SQLite, fedele al dominio originale (esami/appelli/studio + progetti/ranges + flag passed, vista mese), TS strict + Tailwind v4.

**Architecture:** Frontend React 18 + TypeScript + Tailwind v4 in `src/`, backend Rust + rusqlite in `src-tauri/`. Tutte le mutazioni passano da `invoke()` su comandi Tauri tipizzati che ritornano `Result<T, String>`. DB SQLite single-file in `app_data_dir/calendar.db`. Migrations via `PRAGMA user_version`. Tutta la validazione lato Rust.

**Tech Stack:** Tauri 2.x · React 18 · TypeScript (strict) · Vite · Tailwind CSS v4 · Rust · rusqlite · chrono · serde

**Spec:** `docs/superpowers/specs/2026-05-16-calendario-appelli-tauri-design.md`

**Conventions for this plan:**

- All shell commands assume PowerShell on Windows, cwd = `C:\Users\Gianmarco\Desktop\Calendario-app`.
- Every task ends with a commit. Commit messages use conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
- Rust tests: `cargo test --manifest-path src-tauri/Cargo.toml`. Run from project root.
- After each task, the project MUST compile (`npm run build` for FE, `cargo build --manifest-path src-tauri/Cargo.toml` for BE). If a task only touches Rust, only run cargo build; if only TS, only run vite build/tsc.

---

## Phase 0 — Bootstrap

### Task 1: Scaffold Tauri 2.x React-TS project into working directory

**Files:**
- Create: many (entire project skeleton)
- Modify: `docs/superpowers/specs/2026-05-16-calendario-appelli-tauri-design.md` is preserved (already on disk)

The `create-tauri-app` CLI creates a project in a subdirectory; we then flatten it into the current root because the user wants a flat layout.

- [ ] **Step 1: Verify current state**

```powershell
Get-ChildItem -Force | Select-Object Name
```

Expected output includes only `.git/` and `docs/`. No `package.json`, no `src/`, no `src-tauri/`.

- [ ] **Step 2: Stash the `docs/` directory and `.git/` is preserved**

Both already exist. The scaffold won't touch them as long as we generate in a sub-folder first.

- [ ] **Step 3: Run the scaffold in a temp sub-folder**

```powershell
npm create tauri-app@latest -- --yes --template react-ts --manager npm --identifier com.calendario-appelli.app _scaffold_tmp
```

Expected: a directory `_scaffold_tmp/` appears with `package.json`, `src/`, `src-tauri/`, `index.html`, `vite.config.ts`, `tsconfig.json`, `.gitignore`, etc. Project name in `package.json` will be `_scaffold_tmp` — we'll fix that.

If the CLI prompts despite `--yes`, answer: name `calendar-desktop`, identifier `com.calendario-appelli.app`, frontend `React`, UI `TypeScript`, package manager `npm`.

- [ ] **Step 4: Move scaffold contents up one level**

```powershell
Get-ChildItem -Path "_scaffold_tmp" -Force | Move-Item -Destination "." -Force
Remove-Item "_scaffold_tmp" -Force
```

Expected: project files now in working dir root. `_scaffold_tmp/` gone.

- [ ] **Step 5: Fix project name in package.json**

Edit `package.json`: change `"name": "_scaffold_tmp"` to `"name": "calendar-desktop"`.

- [ ] **Step 6: Fix project name in src-tauri/Cargo.toml**

Edit `src-tauri/Cargo.toml`: change `name = "_scaffold_tmp"` (in `[package]` and `[lib]` and `[[bin]]` if present) to `name = "calendar-desktop"`. Update `default-run` if present.

- [ ] **Step 7: Fix tauri.conf.json**

Edit `src-tauri/tauri.conf.json`:
- `"productName": "Calendario Appelli & Studio"`
- `"identifier": "com.calendario-appelli.app"`
- Under `"app" > "windows"`: set `"title": "Calendario Appelli & Studio"`, `"width": 1100`, `"height": 760`, `"minWidth": 760`, `"minHeight": 600`.

- [ ] **Step 8: Verify install + dev server boots**

```powershell
npm install
```

Expected: `node_modules/` populated, no errors.

```powershell
npm run tauri dev
```

Expected: Rust crate compiles (first run takes 5-10 min), Vite dev server starts, the default Tauri "Welcome" window appears.

Close the window (Ctrl+C in terminal).

- [ ] **Step 9: Commit**

```powershell
git add -A
git commit -m "chore: scaffold Tauri 2.x React-TS project

- Bundle identifier com.calendario-appelli.app
- Product name 'Calendario Appelli & Studio'
- Window 1100x760, min 760x600"
```

---

### Task 2: Add Tailwind CSS v4 via Vite plugin

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create/Modify: `src/index.css` (replace any default content)
- Modify: `src/main.tsx` (verify it imports `index.css`)

- [ ] **Step 1: Install Tailwind v4 + Vite plugin**

```powershell
npm install -D tailwindcss @tailwindcss/vite
```

Expected: `tailwindcss` and `@tailwindcss/vite` added to `devDependencies`.

- [ ] **Step 2: Register the plugin in `vite.config.ts`**

Open `vite.config.ts`. Add `import tailwindcss from "@tailwindcss/vite"` at top. Add `tailwindcss()` to the `plugins` array. Final shape:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_"],
});
```

Preserve any `server.host` / `server.hmr` lines the scaffold generated.

- [ ] **Step 3: Replace `src/index.css` with Tailwind directives + theme**

```css
@import "tailwindcss";

@theme {
  --color-app-bg: #f4f5f7;
  --color-app-fg: #1f2430;
  --color-app-muted: #8b91a1;
  --color-app-border: #e5e7ec;

  --color-exam-1:  #E8543F;
  --color-exam-2:  #2E86C1;
  --color-exam-3:  #27AE60;
  --color-exam-4:  #8E44AD;
  --color-exam-5:  #F39C12;
  --color-exam-6:  #16A0A0;
  --color-exam-7:  #D81B7A;
  --color-exam-8:  #5D6D7E;
  --color-exam-9:  #C0392B;
  --color-exam-10: #1F8A4C;
  --color-exam-11: #7D5FFF;
  --color-exam-12: #E67E22;
}

@layer base {
  html, body { background: var(--color-app-bg); color: var(--color-app-fg); }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
}
```

- [ ] **Step 4: Confirm `index.css` is imported**

Open `src/main.tsx`. Ensure `import "./index.css";` is present. If the scaffold imported `App.css` or similar, replace with `index.css`. Delete unused `App.css` if it exists.

- [ ] **Step 5: Smoke check Tailwind by adding a utility-classed element**

Open `src/App.tsx`. Replace the body with:

```tsx
function App() {
  return (
    <div className="p-8 text-2xl font-bold text-app-fg">
      Tailwind v4 ok 🎉
    </div>
  );
}
export default App;
```

- [ ] **Step 6: Run dev, verify the element renders styled**

```powershell
npm run tauri dev
```

Expected: window shows "Tailwind v4 ok 🎉" in large bold font on light background. Close window.

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m "feat: add Tailwind CSS v4 via Vite plugin

Includes @theme palette of 12 exam colors and app-level CSS variables.
Smoke-tested in dev window."
```

---

## Phase 1 — Rust DB layer

### Task 3: Add Rust dependencies for DB and validation

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add deps to `[dependencies]`**

Open `src-tauri/Cargo.toml`. Add under `[dependencies]` (alongside existing `tauri`, `serde`, etc.):

```toml
rusqlite = { version = "0.32", features = ["bundled", "chrono"] }
chrono = { version = "0.4", features = ["serde"] }
regex = "1"
once_cell = "1"
thiserror = "1"
```

- [ ] **Step 2: Build to verify deps resolve**

```powershell
cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: compiles cleanly. First time will pull and compile rusqlite (slow, ~2-5 min).

- [ ] **Step 3: Commit**

```powershell
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: add rusqlite, chrono, regex, thiserror deps"
```

---

### Task 4: SQL migration file + migration runner

**Files:**
- Create: `src-tauri/src/db/migrations/001_init.sql`
- Create: `src-tauri/src/db/mod.rs`
- Modify: `src-tauri/src/lib.rs` (declare `mod db;`)

- [ ] **Step 1: Create the migration SQL**

Create `src-tauri/src/db/migrations/001_init.sql`:

```sql
CREATE TABLE exams (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  color       TEXT    NOT NULL,
  kind        TEXT    NOT NULL CHECK (kind IN ('esame','progetto')),
  passed      INTEGER NOT NULL DEFAULT 0 CHECK (passed IN (0,1)),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE appelli (
  id       INTEGER PRIMARY KEY,
  exam_id  INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  date     TEXT    NOT NULL,
  UNIQUE (exam_id, date)
);
CREATE INDEX idx_appelli_date ON appelli(date);

CREATE TABLE project_ranges (
  id          INTEGER PRIMARY KEY,
  exam_id     INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  start_date  TEXT    NOT NULL,
  end_date    TEXT    NOT NULL,
  CHECK (end_date >= start_date)
);
CREATE INDEX idx_ranges ON project_ranges(start_date, end_date);

CREATE TABLE study_days (
  exam_id  INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  date     TEXT    NOT NULL,
  PRIMARY KEY (exam_id, date)
);
CREATE INDEX idx_study_date ON study_days(date);

CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
```

- [ ] **Step 2: Create `src-tauri/src/db/mod.rs` with the migration runner**

```rust
use rusqlite::{Connection, Result};

pub mod exams;
pub mod settings;
pub mod import;

const MIGRATIONS: &[(&str, &str)] = &[
    ("001_init", include_str!("migrations/001_init.sql")),
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
        assert_eq!(v, 1);
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
        assert_eq!(v, 1);
    }
}
```

- [ ] **Step 3: Create empty stub modules so `mod.rs` compiles**

Create `src-tauri/src/db/exams.rs`:

```rust
// Populated in subsequent tasks.
```

Create `src-tauri/src/db/settings.rs`:

```rust
// Populated in subsequent tasks.
```

Create `src-tauri/src/db/import.rs`:

```rust
// Populated in subsequent tasks.
```

- [ ] **Step 4: Wire `db` module in `src-tauri/src/lib.rs`**

Open `src-tauri/src/lib.rs`. Near the top of the file, add:

```rust
pub mod db;
```

(Keep the existing `tauri::Builder` setup intact.)

- [ ] **Step 5: Run tests**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml db::tests
```

Expected: `migrations_apply_on_empty_db` and `migrations_are_idempotent` both pass.

- [ ] **Step 6: Commit**

```powershell
git add src-tauri/src/db src-tauri/src/lib.rs
git commit -m "feat(db): migrations infra + 001_init schema

PRAGMA user_version-based migration runner; idempotent; in-memory test helper."
```

---

### Task 5: Domain types and validation helpers

**Files:**
- Create: `src-tauri/src/db/types.rs`
- Modify: `src-tauri/src/db/mod.rs` (add `pub mod types;`)

- [ ] **Step 1: Write failing tests for validation**

Create `src-tauri/src/db/types.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExamKind {
    Esame,
    Progetto,
}

impl ExamKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            ExamKind::Esame => "esame",
            ExamKind::Progetto => "progetto",
        }
    }
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "esame" => Ok(ExamKind::Esame),
            "progetto" => Ok(ExamKind::Progetto),
            other => Err(format!("kind sconosciuto: {other}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateRange {
    pub start: String, // YYYY-MM-DD
    pub end: String,   // YYYY-MM-DD
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Appello {
    pub id: i64,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectRange {
    pub id: i64,
    pub start: String,
    pub end: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Exam {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub kind: ExamKind,
    pub passed: bool,
    pub appelli: Vec<Appello>,
    pub ranges: Vec<ProjectRange>,
    pub study_days: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExamInput {
    pub name: String,
    pub color: String,
    pub kind: ExamKind,
    pub passed: bool,
    pub appelli: Vec<String>,
    pub ranges: Vec<DateRange>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportReport {
    pub inserted: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

// ---------- Validation ----------

use once_cell::sync::Lazy;
use regex::Regex;
static COLOR_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^#[0-9A-Fa-f]{6}$").unwrap());

pub fn validate_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Il nome non può essere vuoto".into());
    }
    if trimmed.chars().count() > 200 {
        return Err("Il nome supera i 200 caratteri".into());
    }
    Ok(trimmed.to_string())
}

pub fn validate_color(color: &str) -> Result<(), String> {
    if !COLOR_RE.is_match(color) {
        return Err(format!("Colore non valido: {color} (atteso #RRGGBB)"));
    }
    Ok(())
}

pub fn validate_date(s: &str) -> Result<(), String> {
    chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| format!("Data non valida: {s} (atteso YYYY-MM-DD)"))
}

pub fn validate_range(r: &DateRange) -> Result<(), String> {
    validate_date(&r.start)?;
    validate_date(&r.end)?;
    if r.end < r.start {
        return Err(format!("end_date {} precede start_date {}", r.end, r.start));
    }
    Ok(())
}

pub fn validate_input(input: &ExamInput) -> Result<String, String> {
    let name = validate_name(&input.name)?;
    validate_color(&input.color)?;
    for d in &input.appelli {
        validate_date(d)?;
    }
    for r in &input.ranges {
        validate_range(r)?;
    }
    match input.kind {
        ExamKind::Esame => {
            if !input.ranges.is_empty() {
                return Err("Un esame non può avere ranges (sono solo per i progetti)".into());
            }
        }
        ExamKind::Progetto => {
            if !input.appelli.is_empty() {
                return Err("Un progetto non può avere appelli (sono solo per gli esami)".into());
            }
            if input.ranges.is_empty() {
                return Err("Un progetto richiede almeno un periodo".into());
            }
        }
    }
    Ok(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn name_empty_rejected() {
        assert!(validate_name("").is_err());
        assert!(validate_name("   ").is_err());
    }

    #[test]
    fn name_trimmed() {
        assert_eq!(validate_name("  hi  ").unwrap(), "hi");
    }

    #[test]
    fn color_format() {
        assert!(validate_color("#1A2B3C").is_ok());
        assert!(validate_color("#abcdef").is_ok());
        assert!(validate_color("1A2B3C").is_err());
        assert!(validate_color("#GG2B3C").is_err());
        assert!(validate_color("#123").is_err());
    }

    #[test]
    fn date_format() {
        assert!(validate_date("2026-05-16").is_ok());
        assert!(validate_date("2026-5-16").is_err());
        assert!(validate_date("16/05/2026").is_err());
    }

    #[test]
    fn range_end_before_start() {
        let r = DateRange { start: "2026-05-20".into(), end: "2026-05-10".into() };
        assert!(validate_range(&r).is_err());
    }

    #[test]
    fn esame_with_ranges_rejected() {
        let i = ExamInput {
            name: "x".into(),
            color: "#112233".into(),
            kind: ExamKind::Esame,
            passed: false,
            appelli: vec![],
            ranges: vec![DateRange { start: "2026-01-01".into(), end: "2026-01-02".into() }],
        };
        assert!(validate_input(&i).is_err());
    }

    #[test]
    fn progetto_without_ranges_rejected() {
        let i = ExamInput {
            name: "x".into(),
            color: "#112233".into(),
            kind: ExamKind::Progetto,
            passed: false,
            appelli: vec![],
            ranges: vec![],
        };
        assert!(validate_input(&i).is_err());
    }

    #[test]
    fn progetto_with_appelli_rejected() {
        let i = ExamInput {
            name: "x".into(),
            color: "#112233".into(),
            kind: ExamKind::Progetto,
            passed: false,
            appelli: vec!["2026-01-01".into()],
            ranges: vec![DateRange { start: "2026-01-01".into(), end: "2026-01-02".into() }],
        };
        assert!(validate_input(&i).is_err());
    }
}
```

- [ ] **Step 2: Declare module in `db/mod.rs`**

Add to top of `src-tauri/src/db/mod.rs`:

```rust
pub mod types;
```

- [ ] **Step 3: Run validation tests**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml db::types
```

Expected: all 8 tests pass.

- [ ] **Step 4: Commit**

```powershell
git add src-tauri/src/db
git commit -m "feat(db): domain types + validators

ExamKind, DateRange, Appello, ProjectRange, Exam, ExamInput, ImportReport.
Validators with italian error messages. 8 unit tests."
```

---

### Task 6: exams::create + exams::list (CRUD foundation)

**Files:**
- Modify: `src-tauri/src/db/exams.rs`

- [ ] **Step 1: Write failing test for create + list round-trip**

Replace `src-tauri/src/db/exams.rs` content with:

```rust
use rusqlite::{params, Connection, Result as SqlResult};
use crate::db::types::*;

pub fn create(conn: &mut Connection, input: &ExamInput) -> Result<Exam, String> {
    let name = validate_input(input)?;
    let tx = conn.transaction().map_err(|e| format!("tx: {e}"))?;
    tx.execute(
        "INSERT INTO exams (name, color, kind, passed) VALUES (?1, ?2, ?3, ?4)",
        params![name, input.color, input.kind.as_str(), input.passed as i64],
    ).map_err(|e| format!("insert exam: {e}"))?;
    let id = tx.last_insert_rowid();
    for d in &input.appelli {
        tx.execute(
            "INSERT INTO appelli (exam_id, date) VALUES (?1, ?2)",
            params![id, d],
        ).map_err(|e| format!("insert appello: {e}"))?;
    }
    for r in &input.ranges {
        tx.execute(
            "INSERT INTO project_ranges (exam_id, start_date, end_date) VALUES (?1, ?2, ?3)",
            params![id, r.start, r.end],
        ).map_err(|e| format!("insert range: {e}"))?;
    }
    tx.commit().map_err(|e| format!("commit: {e}"))?;
    get_by_id(conn, id)
}

pub fn list(conn: &Connection) -> Result<Vec<Exam>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color, kind, passed FROM exams ORDER BY name COLLATE NOCASE"
    ).map_err(|e| format!("prepare: {e}"))?;
    let rows = stmt.query_map([], |r| {
        Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?,
            r.get::<_, String>(3)?, r.get::<_, i64>(4)?))
    }).map_err(|e| format!("query: {e}"))?;
    let mut out = Vec::new();
    for row in rows {
        let (id, name, color, kind_str, passed) = row.map_err(|e| format!("row: {e}"))?;
        out.push(build_exam(conn, id, name, color, &kind_str, passed != 0)?);
    }
    Ok(out)
}

pub fn get_by_id(conn: &Connection, id: i64) -> Result<Exam, String> {
    let (name, color, kind_str, passed): (String, String, String, i64) = conn.query_row(
        "SELECT name, color, kind, passed FROM exams WHERE id = ?1",
        params![id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
    ).map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => format!("Esame {id} non trovato"),
        e => format!("select exam: {e}"),
    })?;
    build_exam(conn, id, name, color, &kind_str, passed != 0)
}

fn build_exam(
    conn: &Connection,
    id: i64,
    name: String,
    color: String,
    kind_str: &str,
    passed: bool,
) -> Result<Exam, String> {
    let kind = ExamKind::from_str(kind_str)?;
    let appelli = load_appelli(conn, id)?;
    let ranges = load_ranges(conn, id)?;
    let study_days = load_study_days(conn, id)?;
    Ok(Exam { id, name, color, kind, passed, appelli, ranges, study_days })
}

fn load_appelli(conn: &Connection, exam_id: i64) -> Result<Vec<Appello>, String> {
    let mut stmt = conn.prepare("SELECT id, date FROM appelli WHERE exam_id = ?1 ORDER BY date")
        .map_err(|e| format!("prepare appelli: {e}"))?;
    let rows: SqlResult<Vec<Appello>> = stmt.query_map(params![exam_id], |r| {
        Ok(Appello { id: r.get(0)?, date: r.get(1)? })
    }).and_then(|it| it.collect());
    rows.map_err(|e| format!("query appelli: {e}"))
}

fn load_ranges(conn: &Connection, exam_id: i64) -> Result<Vec<ProjectRange>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, start_date, end_date FROM project_ranges WHERE exam_id = ?1 ORDER BY start_date"
    ).map_err(|e| format!("prepare ranges: {e}"))?;
    let rows: SqlResult<Vec<ProjectRange>> = stmt.query_map(params![exam_id], |r| {
        Ok(ProjectRange { id: r.get(0)?, start: r.get(1)?, end: r.get(2)? })
    }).and_then(|it| it.collect());
    rows.map_err(|e| format!("query ranges: {e}"))
}

fn load_study_days(conn: &Connection, exam_id: i64) -> Result<Vec<String>, String> {
    let mut stmt = conn.prepare("SELECT date FROM study_days WHERE exam_id = ?1 ORDER BY date")
        .map_err(|e| format!("prepare study_days: {e}"))?;
    let rows: SqlResult<Vec<String>> = stmt.query_map(params![exam_id], |r| r.get(0))
        .and_then(|it| it.collect());
    rows.map_err(|e| format!("query study_days: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    fn sample_esame() -> ExamInput {
        ExamInput {
            name: "Neuroanatomia".into(),
            color: "#E8543F".into(),
            kind: ExamKind::Esame,
            passed: false,
            appelli: vec!["2026-06-15".into(), "2026-07-10".into()],
            ranges: vec![],
        }
    }

    fn sample_progetto() -> ExamInput {
        ExamInput {
            name: "Tesina Fisiologia".into(),
            color: "#27AE60".into(),
            kind: ExamKind::Progetto,
            passed: false,
            appelli: vec![],
            ranges: vec![DateRange { start: "2026-05-01".into(), end: "2026-05-15".into() }],
        }
    }

    #[test]
    fn create_and_get_esame() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_esame()).unwrap();
        assert_eq!(e.name, "Neuroanatomia");
        assert_eq!(e.kind, ExamKind::Esame);
        assert_eq!(e.appelli.len(), 2);
        assert_eq!(e.appelli[0].date, "2026-06-15");
        assert!(e.ranges.is_empty());
        assert!(e.study_days.is_empty());
        assert!(!e.passed);
    }

    #[test]
    fn create_progetto() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_progetto()).unwrap();
        assert_eq!(e.kind, ExamKind::Progetto);
        assert_eq!(e.ranges.len(), 1);
        assert_eq!(e.ranges[0].start, "2026-05-01");
        assert_eq!(e.ranges[0].end, "2026-05-15");
    }

    #[test]
    fn list_returns_all_sorted_by_name() {
        let mut conn = open_in_memory().unwrap();
        create(&mut conn, &sample_progetto()).unwrap();
        create(&mut conn, &sample_esame()).unwrap();
        let list = list(&conn).unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].name, "Neuroanatomia"); // N < T
        assert_eq!(list[1].name, "Tesina Fisiologia");
    }

    #[test]
    fn create_rejects_invalid_input() {
        let mut conn = open_in_memory().unwrap();
        let bad = ExamInput {
            name: "".into(), color: "#000000".into(),
            kind: ExamKind::Esame, passed: false,
            appelli: vec![], ranges: vec![],
        };
        assert!(create(&mut conn, &bad).is_err());
    }
}
```

- [ ] **Step 2: Run the new tests**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml db::exams
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```powershell
git add src-tauri/src/db/exams.rs
git commit -m "feat(db): exams::create + list + get_by_id

Round-trip CRUD with nested appelli/ranges/study_days hydration.
Sorted by name COLLATE NOCASE. 4 unit tests."
```

---

### Task 7: exams::update + delete + set_passed

**Files:**
- Modify: `src-tauri/src/db/exams.rs`

- [ ] **Step 1: Append the three functions**

Append to `src-tauri/src/db/exams.rs` (after `load_study_days`, before the `#[cfg(test)]` block):

```rust
pub fn update(conn: &mut Connection, id: i64, input: &ExamInput) -> Result<Exam, String> {
    let name = validate_input(input)?;
    let tx = conn.transaction().map_err(|e| format!("tx: {e}"))?;
    let changed = tx.execute(
        "UPDATE exams SET name = ?1, color = ?2, kind = ?3, passed = ?4,
                          updated_at = datetime('now') WHERE id = ?5",
        params![name, input.color, input.kind.as_str(), input.passed as i64, id],
    ).map_err(|e| format!("update exam: {e}"))?;
    if changed == 0 {
        return Err(format!("Esame {id} non trovato"));
    }
    // Replace appelli/ranges atomically. study_days are preserved.
    tx.execute("DELETE FROM appelli WHERE exam_id = ?1", params![id])
        .map_err(|e| format!("delete appelli: {e}"))?;
    tx.execute("DELETE FROM project_ranges WHERE exam_id = ?1", params![id])
        .map_err(|e| format!("delete ranges: {e}"))?;
    for d in &input.appelli {
        tx.execute("INSERT INTO appelli (exam_id, date) VALUES (?1, ?2)", params![id, d])
            .map_err(|e| format!("insert appello: {e}"))?;
    }
    for r in &input.ranges {
        tx.execute(
            "INSERT INTO project_ranges (exam_id, start_date, end_date) VALUES (?1, ?2, ?3)",
            params![id, r.start, r.end],
        ).map_err(|e| format!("insert range: {e}"))?;
    }
    tx.commit().map_err(|e| format!("commit: {e}"))?;
    get_by_id(conn, id)
}

pub fn delete(conn: &Connection, id: i64) -> Result<(), String> {
    let changed = conn.execute("DELETE FROM exams WHERE id = ?1", params![id])
        .map_err(|e| format!("delete: {e}"))?;
    if changed == 0 {
        return Err(format!("Esame {id} non trovato"));
    }
    Ok(())
}

pub fn set_passed(conn: &Connection, id: i64, passed: bool) -> Result<(), String> {
    let changed = conn.execute(
        "UPDATE exams SET passed = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![passed as i64, id],
    ).map_err(|e| format!("update passed: {e}"))?;
    if changed == 0 {
        return Err(format!("Esame {id} non trovato"));
    }
    Ok(())
}
```

- [ ] **Step 2: Append tests inside `mod tests`**

Append before the closing `}` of `mod tests`:

```rust
#[test]
fn update_replaces_appelli() {
    let mut conn = open_in_memory().unwrap();
    let e = create(&mut conn, &sample_esame()).unwrap();
    let mut next = sample_esame();
    next.name = "Neuroanat. (rinominato)".into();
    next.appelli = vec!["2026-09-01".into()];
    let updated = update(&mut conn, e.id, &next).unwrap();
    assert_eq!(updated.name, "Neuroanat. (rinominato)");
    assert_eq!(updated.appelli.len(), 1);
    assert_eq!(updated.appelli[0].date, "2026-09-01");
}

#[test]
fn update_preserves_study_days() {
    let mut conn = open_in_memory().unwrap();
    let e = create(&mut conn, &sample_esame()).unwrap();
    conn.execute(
        "INSERT INTO study_days (exam_id, date) VALUES (?1, ?2)",
        params![e.id, "2026-06-01"],
    ).unwrap();
    let updated = update(&mut conn, e.id, &sample_esame()).unwrap();
    assert_eq!(updated.study_days, vec!["2026-06-01"]);
}

#[test]
fn delete_cascades_to_appelli_and_study_days() {
    let mut conn = open_in_memory().unwrap();
    let e = create(&mut conn, &sample_esame()).unwrap();
    conn.execute(
        "INSERT INTO study_days (exam_id, date) VALUES (?1, ?2)",
        params![e.id, "2026-06-01"],
    ).unwrap();
    delete(&conn, e.id).unwrap();
    let n_app: i64 = conn.query_row("SELECT COUNT(*) FROM appelli", [], |r| r.get(0)).unwrap();
    let n_sd:  i64 = conn.query_row("SELECT COUNT(*) FROM study_days", [], |r| r.get(0)).unwrap();
    assert_eq!(n_app, 0);
    assert_eq!(n_sd, 0);
}

#[test]
fn delete_missing_id_errors() {
    let conn = open_in_memory().unwrap();
    assert!(delete(&conn, 999).is_err());
}

#[test]
fn set_passed_toggles() {
    let mut conn = open_in_memory().unwrap();
    let e = create(&mut conn, &sample_esame()).unwrap();
    set_passed(&conn, e.id, true).unwrap();
    assert!(get_by_id(&conn, e.id).unwrap().passed);
    set_passed(&conn, e.id, false).unwrap();
    assert!(!get_by_id(&conn, e.id).unwrap().passed);
}
```

- [ ] **Step 3: Run tests**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml db::exams
```

Expected: 9 tests pass (4 from previous task + 5 new).

- [ ] **Step 4: Commit**

```powershell
git add src-tauri/src/db/exams.rs
git commit -m "feat(db): exams::update + delete + set_passed

Update preserves study_days (replaces only appelli/ranges).
Delete cascades via FK ON DELETE CASCADE. 5 new tests."
```

---

### Task 8: toggle_study_day + search

**Files:**
- Modify: `src-tauri/src/db/exams.rs`

- [ ] **Step 1: Append both functions**

Append before `#[cfg(test)]`:

```rust
pub fn toggle_study_day(conn: &Connection, exam_id: i64, date: &str) -> Result<bool, String> {
    crate::db::types::validate_date(date)?;
    let exists: bool = conn.query_row(
        "SELECT 1 FROM study_days WHERE exam_id = ?1 AND date = ?2",
        params![exam_id, date],
        |_| Ok(true),
    ).unwrap_or(false);
    if exists {
        conn.execute(
            "DELETE FROM study_days WHERE exam_id = ?1 AND date = ?2",
            params![exam_id, date],
        ).map_err(|e| format!("delete study: {e}"))?;
        Ok(false)
    } else {
        let exam_exists: bool = conn.query_row(
            "SELECT 1 FROM exams WHERE id = ?1 AND kind = 'esame'",
            params![exam_id],
            |_| Ok(true),
        ).unwrap_or(false);
        if !exam_exists {
            return Err(format!("Esame {exam_id} non esistente o è un progetto"));
        }
        conn.execute(
            "INSERT INTO study_days (exam_id, date) VALUES (?1, ?2)",
            params![exam_id, date],
        ).map_err(|e| format!("insert study: {e}"))?;
        Ok(true)
    }
}

pub fn search(conn: &Connection, query: &str) -> Result<Vec<Exam>, String> {
    let q = query.trim();
    if q.is_empty() {
        return list(conn);
    }
    let mut stmt = conn.prepare(
        "SELECT id, name, color, kind, passed FROM exams
         WHERE name LIKE ?1 COLLATE NOCASE
         ORDER BY name COLLATE NOCASE"
    ).map_err(|e| format!("prepare search: {e}"))?;
    let pattern = format!("%{q}%");
    let rows = stmt.query_map(params![pattern], |r| {
        Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?,
            r.get::<_, String>(3)?, r.get::<_, i64>(4)?))
    }).map_err(|e| format!("query: {e}"))?;
    let mut out = Vec::new();
    for row in rows {
        let (id, name, color, kind_str, passed) = row.map_err(|e| format!("row: {e}"))?;
        out.push(build_exam(conn, id, name, color, &kind_str, passed != 0)?);
    }
    Ok(out)
}
```

- [ ] **Step 2: Add tests**

Append inside `mod tests`:

```rust
#[test]
fn toggle_study_day_on_then_off() {
    let mut conn = open_in_memory().unwrap();
    let e = create(&mut conn, &sample_esame()).unwrap();
    assert!(toggle_study_day(&conn, e.id, "2026-06-01").unwrap());
    assert_eq!(get_by_id(&conn, e.id).unwrap().study_days, vec!["2026-06-01"]);
    assert!(!toggle_study_day(&conn, e.id, "2026-06-01").unwrap());
    assert!(get_by_id(&conn, e.id).unwrap().study_days.is_empty());
}

#[test]
fn toggle_study_day_rejects_on_progetto() {
    let mut conn = open_in_memory().unwrap();
    let e = create(&mut conn, &sample_progetto()).unwrap();
    assert!(toggle_study_day(&conn, e.id, "2026-06-01").is_err());
}

#[test]
fn search_filters_by_name() {
    let mut conn = open_in_memory().unwrap();
    create(&mut conn, &sample_esame()).unwrap();
    create(&mut conn, &sample_progetto()).unwrap();
    let r = search(&conn, "tesi").unwrap();
    assert_eq!(r.len(), 1);
    assert_eq!(r[0].name, "Tesina Fisiologia");
    let r2 = search(&conn, "").unwrap();
    assert_eq!(r2.len(), 2);
}
```

- [ ] **Step 3: Run tests**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml db::exams
```

Expected: 12 tests pass.

- [ ] **Step 4: Commit**

```powershell
git add src-tauri/src/db/exams.rs
git commit -m "feat(db): toggle_study_day + search

toggle returns new state; rejects projects.
search is case-insensitive LIKE on name; empty query returns full list."
```

---

### Task 9: settings::get + set

**Files:**
- Modify: `src-tauri/src/db/settings.rs`

- [ ] **Step 1: Write module + tests**

Replace `src-tauri/src/db/settings.rs`:

```rust
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
```

- [ ] **Step 2: Run tests**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml db::settings
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```powershell
git add src-tauri/src/db/settings.rs
git commit -m "feat(db): settings get + set (upsert)"
```

---

### Task 10: import::import_artifact_json

**Files:**
- Modify: `src-tauri/src/db/import.rs`

- [ ] **Step 1: Write the import module + tests**

Replace `src-tauri/src/db/import.rs`:

```rust
use rusqlite::Connection;
use serde::Deserialize;
use crate::db::types::*;
use crate::db::exams;

#[derive(Deserialize)]
struct ArtifactRoot {
    exams: Vec<ArtifactExam>,
}

#[derive(Deserialize)]
struct ArtifactExam {
    name: String,
    color: String,
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    passed: bool,
    #[serde(default)]
    appelli: Vec<ArtifactAppello>,
    #[serde(default)]
    ranges: Vec<ArtifactRange>,
    #[serde(rename = "studyDays", default)]
    study_days: Vec<String>,
}

#[derive(Deserialize)]
struct ArtifactAppello { date: String }

#[derive(Deserialize)]
struct ArtifactRange { start: String, end: Option<String> }

pub fn import_artifact_json(conn: &mut Connection, payload: &str) -> Result<ImportReport, String> {
    let root: ArtifactRoot = serde_json::from_str(payload)
        .map_err(|e| format!("JSON non parsabile: {e}"))?;
    let mut report = ImportReport { inserted: 0, skipped: 0, errors: vec![] };

    for ae in root.exams {
        let kind = match ExamKind::from_str(&ae.kind) {
            Ok(k) => k,
            Err(e) => { report.skipped += 1; report.errors.push(format!("{}: {e}", ae.name)); continue; }
        };

        if name_exists(conn, &ae.name)? {
            report.skipped += 1;
            report.errors.push(format!("'{}' già presente, saltato", ae.name));
            continue;
        }

        let ranges: Vec<DateRange> = ae.ranges.iter().map(|r| DateRange {
            start: r.start.clone(),
            end: r.end.clone().unwrap_or_else(|| r.start.clone()),
        }).collect();
        let appelli: Vec<String> = ae.appelli.iter().map(|a| a.date.clone()).collect();

        let input = ExamInput {
            name: ae.name.clone(),
            color: ae.color.clone(),
            kind,
            passed: ae.passed,
            appelli,
            ranges,
        };

        match exams::create(conn, &input) {
            Ok(exam) => {
                // Re-apply study days (skipping invalid dates silently to avoid one bad item poisoning all)
                for d in &ae.study_days {
                    if let Err(e) = exams::toggle_study_day(conn, exam.id, d) {
                        report.errors.push(format!("'{}': study day {d}: {e}", ae.name));
                    }
                }
                report.inserted += 1;
            }
            Err(e) => {
                report.skipped += 1;
                report.errors.push(format!("'{}': {e}", ae.name));
            }
        }
    }

    Ok(report)
}

fn name_exists(conn: &Connection, name: &str) -> Result<bool, String> {
    let n = conn.query_row(
        "SELECT 1 FROM exams WHERE name = ?1 COLLATE NOCASE",
        rusqlite::params![name],
        |_| Ok(true),
    );
    match n {
        Ok(_) => Ok(true),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(false),
        Err(e) => Err(format!("check name: {e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    const PAYLOAD: &str = r#"{
        "exams": [
            { "name": "Neuro", "color": "#E8543F", "type": "esame", "passed": false,
              "appelli": [{"date":"2026-06-15"}], "ranges": [], "studyDays": ["2026-06-01"] },
            { "name": "Tesina", "color": "#27AE60", "type": "progetto", "passed": false,
              "appelli": [], "ranges": [{"start":"2026-05-01","end":"2026-05-15"}], "studyDays": [] },
            { "name": "BAD", "color": "not-a-color", "type": "esame", "appelli": [], "ranges": [], "studyDays": [] }
        ]
    }"#;

    #[test]
    fn import_inserts_two_skips_one() {
        let mut conn = open_in_memory().unwrap();
        let report = import_artifact_json(&mut conn, PAYLOAD).unwrap();
        assert_eq!(report.inserted, 2);
        assert_eq!(report.skipped, 1);
        let list = exams::list(&conn).unwrap();
        assert_eq!(list.len(), 2);
        let neuro = list.iter().find(|e| e.name == "Neuro").unwrap();
        assert_eq!(neuro.appelli.len(), 1);
        assert_eq!(neuro.study_days, vec!["2026-06-01"]);
    }

    #[test]
    fn import_skips_duplicate_names() {
        let mut conn = open_in_memory().unwrap();
        import_artifact_json(&mut conn, PAYLOAD).unwrap();
        let report = import_artifact_json(&mut conn, PAYLOAD).unwrap();
        assert_eq!(report.inserted, 0);
        assert_eq!(report.skipped, 3);
    }

    #[test]
    fn import_rejects_invalid_json() {
        let mut conn = open_in_memory().unwrap();
        assert!(import_artifact_json(&mut conn, "not json").is_err());
    }
}
```

- [ ] **Step 2: Ensure `serde_json` is in deps**

Open `src-tauri/Cargo.toml`. Should already have `serde_json` from the scaffold. If not, add `serde_json = "1"`.

- [ ] **Step 3: Run tests**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml db::import
```

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```powershell
git add src-tauri/src/db/import.rs src-tauri/Cargo.toml
git commit -m "feat(db): import_artifact_json with skip-on-duplicate

Accepts artifact's localStorage format. Skips invalid items
into report.skipped + errors list. 3 unit tests."
```

---

## Phase 2 — Tauri command surface

### Task 11: Register commands and AppState

**Files:**
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create the commands module**

Create `src-tauri/src/commands.rs`:

```rust
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
```

- [ ] **Step 2: Wire commands into `lib.rs`**

Open `src-tauri/src/lib.rs`. Replace the `run` function body so it looks like:

```rust
pub mod db;
pub mod commands;

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
```

If `tauri_plugin_opener` isn't registered by the scaffold, omit that line. Don't add new plugins beyond what the scaffold gave us.

- [ ] **Step 3: Build to verify it compiles**

```powershell
cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: compiles cleanly.

- [ ] **Step 4: Run full Rust test suite**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all DB tests still pass (>= 20 tests total across db modules).

- [ ] **Step 5: Commit**

```powershell
git add src-tauri/src
git commit -m "feat(tauri): register 10 commands + AppState

Commands wrap db::{exams,settings,import} with a single Mutex<Connection>
guarding the SQLite connection. DB lives in app_data_dir/calendar.db."
```

---

## Phase 3 — Frontend foundation

### Task 12: TypeScript domain types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write the types**

Create `src/types.ts`:

```typescript
export type ExamKind = "esame" | "progetto";

export interface Appello {
  id: number;
  date: string; // YYYY-MM-DD
}

export interface ProjectRange {
  id: number;
  start: string;
  end: string;
}

export interface Exam {
  id: number;
  name: string;
  color: string;
  kind: ExamKind;
  passed: boolean;
  appelli: Appello[];
  ranges: ProjectRange[];
  studyDays: string[];
}

export interface DateRangeInput {
  start: string;
  end: string;
}

export interface ExamInput {
  name: string;
  color: string;
  kind: ExamKind;
  passed: boolean;
  appelli: string[];
  ranges: DateRangeInput[];
}

export interface ImportReport {
  inserted: number;
  skipped: number;
  errors: string[];
}
```

Note: the Rust side serializes `study_days` (snake_case) but serde's default rename is preserved — we map at the `db.ts` layer below, so TS uses `studyDays`.

- [ ] **Step 2: Build TS to verify**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```powershell
git add src/types.ts
git commit -m "feat(fe): domain TypeScript types

Exam, ExamInput, ImportReport, Appello, ProjectRange, ExamKind."
```

---

### Task 13: db.ts thin client over invoke()

**Files:**
- Create: `src/db.ts`

- [ ] **Step 1: Write the client**

Create `src/db.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";
import type { Exam, ExamInput, ImportReport } from "./types";

type ExamWire = Omit<Exam, "studyDays"> & { study_days: string[] };

function fromWire(e: ExamWire): Exam {
  const { study_days, ...rest } = e;
  return { ...rest, studyDays: study_days };
}

export async function listExams(): Promise<Exam[]> {
  const wire = await invoke<ExamWire[]>("list_exams");
  return wire.map(fromWire);
}

export async function createExam(input: ExamInput): Promise<Exam> {
  const wire = await invoke<ExamWire>("create_exam", { input });
  return fromWire(wire);
}

export async function updateExam(id: number, input: ExamInput): Promise<Exam> {
  const wire = await invoke<ExamWire>("update_exam", { id, input });
  return fromWire(wire);
}

export async function deleteExam(id: number): Promise<void> {
  await invoke("delete_exam", { id });
}

export async function setExamPassed(id: number, passed: boolean): Promise<void> {
  await invoke("set_exam_passed", { id, passed });
}

export async function toggleStudyDay(examId: number, date: string): Promise<boolean> {
  return await invoke<boolean>("toggle_study_day", { examId, date });
}

export async function searchExams(query: string): Promise<Exam[]> {
  const wire = await invoke<ExamWire[]>("search_exams", { query });
  return wire.map(fromWire);
}

export async function importArtifactJson(payload: string): Promise<ImportReport> {
  return await invoke<ImportReport>("import_artifact_json", { payload });
}

export async function getSetting(key: string): Promise<string | null> {
  const v = await invoke<string | null>("get_setting", { key });
  return v;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await invoke("set_setting", { key, value });
}
```

- [ ] **Step 2: Verify TS**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```powershell
git add src/db.ts
git commit -m "feat(fe): db.ts thin client over Tauri invoke()

Wraps all 10 commands. Maps study_days (snake) -> studyDays (camel)
at the boundary so the rest of the FE uses camelCase."
```

---

### Task 14: Toast context + component

**Files:**
- Create: `src/toast.tsx`

- [ ] **Step 1: Write the context + component**

Create `src/toast.tsx`:

```tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastVariant = "error" | "success" | "info";
interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  error: (msg: string) => void;
  success: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((variant: ToastVariant, message: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, variant, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value: ToastContextValue = {
    error: (m) => push("error", m),
    success: (m) => push("success", m),
    info: (m) => push("info", m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className={
              "pointer-events-auto rounded-lg px-4 py-2 text-sm font-medium shadow-lg border " +
              (t.variant === "error"
                ? "bg-red-50 border-red-200 text-red-900"
                : t.variant === "success"
                ? "bg-green-50 border-green-200 text-green-900"
                : "bg-blue-50 border-blue-200 text-blue-900")
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}
```

- [ ] **Step 2: Build to verify**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```powershell
git add src/toast.tsx
git commit -m "feat(fe): ToastProvider + useToast hook

Top-right stacked toasts with 4s auto-dismiss. Variants error/success/info."
```

---

### Task 15: Exams context with refetch on mutation

**Files:**
- Create: `src/state.tsx`

- [ ] **Step 1: Write the context**

Create `src/state.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Exam, ExamInput } from "./types";
import * as db from "./db";
import { useToast } from "./toast";

interface ExamsContextValue {
  exams: Exam[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  refetch: () => Promise<void>;
  create: (input: ExamInput) => Promise<Exam | null>;
  update: (id: number, input: ExamInput) => Promise<Exam | null>;
  remove: (id: number) => Promise<boolean>;
  setPassed: (id: number, passed: boolean) => Promise<boolean>;
  toggleStudyDay: (examId: number, date: string) => Promise<boolean | null>;
}

const ExamsContext = createContext<ExamsContextValue | null>(null);

export function ExamsProvider({ children }: { children: ReactNode }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const toast = useToast();

  const refetch = useCallback(async () => {
    try {
      const list = searchQuery.trim()
        ? await db.searchExams(searchQuery)
        : await db.listExams();
      setExams(list);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, toast]);

  useEffect(() => { void refetch(); }, [refetch]);

  const create = useCallback(async (input: ExamInput) => {
    try {
      const e = await db.createExam(input);
      await refetch();
      return e;
    } catch (err) { toast.error(String(err)); return null; }
  }, [refetch, toast]);

  const update = useCallback(async (id: number, input: ExamInput) => {
    try {
      const e = await db.updateExam(id, input);
      await refetch();
      return e;
    } catch (err) { toast.error(String(err)); return null; }
  }, [refetch, toast]);

  const remove = useCallback(async (id: number) => {
    try {
      await db.deleteExam(id);
      await refetch();
      return true;
    } catch (err) { toast.error(String(err)); return false; }
  }, [refetch, toast]);

  const setPassed = useCallback(async (id: number, passed: boolean) => {
    try {
      await db.setExamPassed(id, passed);
      await refetch();
      return true;
    } catch (err) { toast.error(String(err)); return false; }
  }, [refetch, toast]);

  const toggleStudyDay = useCallback(async (examId: number, date: string) => {
    try {
      const v = await db.toggleStudyDay(examId, date);
      await refetch();
      return v;
    } catch (err) { toast.error(String(err)); return null; }
  }, [refetch, toast]);

  const value = useMemo<ExamsContextValue>(() => ({
    exams, loading, searchQuery, setSearchQuery,
    refetch, create, update, remove, setPassed, toggleStudyDay,
  }), [exams, loading, searchQuery, refetch, create, update, remove, setPassed, toggleStudyDay]);

  return <ExamsContext.Provider value={value}>{children}</ExamsContext.Provider>;
}

export function useExams(): ExamsContextValue {
  const ctx = useContext(ExamsContext);
  if (!ctx) throw new Error("useExams must be inside ExamsProvider");
  return ctx;
}
```

- [ ] **Step 2: TypeScript check**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```powershell
git add src/state.tsx
git commit -m "feat(fe): ExamsProvider + useExams hook

Centralized state with refetch-on-mutation. Errors flow to toast."
```

---

### Task 16: Date helpers

**Files:**
- Create: `src/date.ts`

- [ ] **Step 1: Write helpers**

Create `src/date.ts`:

```typescript
export const MONTHS_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

export const WEEKDAYS_IT_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYmd(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function inRange(key: string, start: string, end: string): boolean {
  return key >= start && key <= end;
}

export function tint(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export interface MonthGridDay {
  key: string;
  day: number;
  isToday: boolean;
  col: number; // 0..6, Monday=0
}

export interface MonthGrid {
  year: number;
  month: number; // 0..11
  leadingBlanks: number;
  days: MonthGridDay[];
}

export function buildMonthGrid(year: number, month: number): MonthGrid {
  const first = new Date(year, month, 1);
  const leadingBlanks = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = ymd(new Date());
  const days: MonthGridDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    days.push({
      key: ymd(date),
      day: d,
      isToday: ymd(date) === todayKey,
      col: (leadingBlanks + d - 1) % 7,
    });
  }
  return { year, month, leadingBlanks, days };
}
```

- [ ] **Step 2: TS check**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```powershell
git add src/date.ts
git commit -m "feat(fe): date helpers (ymd, parseYmd, inRange, tint, buildMonthGrid)

Monday-first week, italian month/weekday labels."
```

---

## Phase 4 — UI build-out

### Task 17: App shell wires providers and a placeholder layout

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx` (if needed)

- [ ] **Step 1: Update `App.tsx`**

Replace `src/App.tsx`:

```tsx
import { ExamsProvider } from "./state";
import { ToastProvider } from "./toast";

function Shell() {
  return (
    <div className="min-h-screen bg-app-bg text-app-fg p-4">
      <div className="max-w-[1100px] mx-auto flex gap-4 items-start">
        <aside className="w-[290px] shrink-0 rounded-2xl bg-white border border-app-border shadow-sm p-4">
          <h2 className="font-semibold text-[15px] mb-1">Esami e progetti</h2>
          <p className="text-[11.5px] text-app-muted leading-relaxed mb-3">
            Clicca un giorno per segnare lo studio. I <b>progetti</b> sono esami che durano più giorni.
            Spunta la casella quando hai superato/completato.
          </p>
          <div className="text-sm text-app-muted">Sidebar (in arrivo)</div>
        </aside>
        <main className="flex-1 min-w-0 rounded-2xl bg-white border border-app-border shadow-sm p-4">
          <h1 className="text-base font-semibold mb-3">📅 Calendario Appelli &amp; Studio</h1>
          <div className="text-sm text-app-muted">Calendario (in arrivo)</div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ExamsProvider>
        <Shell />
      </ExamsProvider>
    </ToastProvider>
  );
}
```

- [ ] **Step 2: Run dev, verify layout**

```powershell
npm run tauri dev
```

Expected: two-column layout (290px sidebar, flexible main), styled with the artifact's tones. No exam data yet. Close window.

- [ ] **Step 3: Commit**

```powershell
git add src/App.tsx
git commit -m "feat(fe): app shell with providers + 2-column layout

Sidebar + main, both styled like the artifact (white cards on f4f5f7)."
```

---

### Task 18: Sidebar with empty state + add buttons

**Files:**
- Create: `src/components/Sidebar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create Sidebar**

Create `src/components/Sidebar.tsx`:

```tsx
import { useExams } from "../state";

interface SidebarProps {
  onAdd: (kind: "esame" | "progetto") => void;
}

export function Sidebar({ onAdd }: SidebarProps) {
  const { exams, loading, searchQuery, setSearchQuery } = useExams();
  const active = exams.filter((e) => !e.passed);
  const passed = exams.filter((e) => e.passed);

  return (
    <aside className="w-[290px] shrink-0 rounded-2xl bg-white border border-app-border shadow-sm p-4">
      <h2 className="font-semibold text-[15px] mb-1">Esami e progetti</h2>
      <p className="text-[11.5px] text-app-muted leading-relaxed mb-3">
        Clicca un giorno per segnare lo studio. I <b>progetti</b> sono esami che durano più giorni.
        Spunta la casella quando hai superato/completato.
      </p>

      <input
        type="text"
        placeholder="Cerca…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full mb-3 px-3 py-1.5 text-[12.5px] border border-[#d6d9e0] rounded-lg focus:outline-2 focus:outline-[#aeb4c0]"
      />

      <div>
        {loading && <div className="text-[12px] text-app-muted">Caricamento…</div>}
        {!loading && active.length === 0 && exams.length === 0 && (
          <div className="text-[12px] text-app-muted py-1.5">
            Niente ancora. Aggiungi un esame o un progetto qui sotto.
          </div>
        )}
        {!loading && active.length === 0 && exams.length > 0 && searchQuery.trim() && (
          <div className="text-[12px] text-app-muted py-1.5">Nessun esame attivo corrisponde alla ricerca.</div>
        )}
        {/* ExamRow rendering added in Task 19 */}
      </div>

      <div className="flex gap-2 mt-1">
        <button
          onClick={() => onAdd("esame")}
          className="flex-1 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold bg-[#2f3545] text-white border border-[#2f3545] hover:bg-[#1f2430]"
        >
          + Esame
        </button>
        <button
          onClick={() => onAdd("progetto")}
          className="flex-1 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold bg-white text-[#2f3545] border border-[#d6d9e0] hover:bg-[#f4f5f7]"
        >
          + Progetto
        </button>
      </div>

      {passed.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-bold text-app-muted uppercase tracking-wide mb-2">Completati</div>
          {/* Passed ExamRows added in Task 19 */}
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: Wire into App.tsx**

Replace `Shell()` in `src/App.tsx`:

```tsx
import { useState } from "react";
import { ExamsProvider } from "./state";
import { ToastProvider } from "./toast";
import { Sidebar } from "./components/Sidebar";

function Shell() {
  const [, setModalKind] = useState<"esame" | "progetto" | null>(null);
  return (
    <div className="min-h-screen bg-app-bg text-app-fg p-4">
      <div className="max-w-[1100px] mx-auto flex gap-4 items-start">
        <Sidebar onAdd={(k) => setModalKind(k)} />
        <main className="flex-1 min-w-0 rounded-2xl bg-white border border-app-border shadow-sm p-4">
          <h1 className="text-base font-semibold mb-3">📅 Calendario Appelli &amp; Studio</h1>
          <div className="text-sm text-app-muted">Calendario (in arrivo)</div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ExamsProvider>
        <Shell />
      </ExamsProvider>
    </ToastProvider>
  );
}
```

The `setModalKind` will be hooked up in Task 20.

- [ ] **Step 3: Dev verify**

```powershell
npm run tauri dev
```

Expected: sidebar shows title, hint, search box, empty-state line, two add buttons. Close window.

- [ ] **Step 4: Commit**

```powershell
git add src/components/Sidebar.tsx src/App.tsx
git commit -m "feat(fe): Sidebar shell with search + add buttons"
```

---

### Task 19: ExamRow component + wire into Sidebar

**Files:**
- Create: `src/components/ExamRow.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Create ExamRow**

Create `src/components/ExamRow.tsx`:

```tsx
import type { Exam } from "../types";
import { useExams } from "../state";

interface ExamRowProps {
  exam: Exam;
  onEdit: (id: number) => void;
}

function rangeDays(start: string, end: string): number {
  const s = new Date(start); const e = new Date(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
}

function metaText(e: Exam): string {
  const isProj = e.kind === "progetto";
  if (e.passed) return isProj ? "Completato" : "Superato";
  if (isProj) {
    const tot = e.ranges.reduce((s, r) => s + rangeDays(r.start, r.end), 0);
    let s = `${tot} giorn${tot === 1 ? "o" : "i"}`;
    if (e.ranges.length > 1) s += ` · ${e.ranges.length} periodi`;
    return s;
  }
  const nApp = e.appelli.length;
  const nStudy = e.studyDays.length;
  return `${nApp} appell${nApp === 1 ? "o" : "i"} · ${nStudy} giorn${nStudy === 1 ? "o" : "i"} studio`;
}

export function ExamRow({ exam, onEdit }: ExamRowProps) {
  const { setPassed, remove } = useExams();
  const isProj = exam.kind === "progetto";

  return (
    <div className={
      "flex items-center gap-2 p-2 rounded-lg border border-[#eef0f3] mb-1.5 bg-[#fcfcfd] " +
      (exam.passed ? "opacity-65" : "")
    }>
      <span
        className={"shrink-0 " + (isProj ? "w-[13px] h-[13px] rounded" : "w-[13px] h-[13px] rounded-full")}
        style={{ background: exam.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={
            "text-[13px] font-semibold truncate min-w-0 " +
            (exam.passed ? "line-through" : "")
          }>{exam.name}</span>
          <span className={
            "text-[8.5px] font-bold uppercase tracking-wider rounded px-1 shrink-0 " +
            (isProj ? "bg-[#ede7fb] text-[#6b4fb0]" : "bg-[#eef0f3] text-[#7b8190]")
          }>
            {isProj ? "Progetto" : "Esame"}
          </span>
        </div>
        <div className="text-[10.5px] text-app-muted mt-px">{metaText(exam)}</div>
      </div>
      <label className="flex items-center cursor-pointer" title={isProj ? "Segna come completato" : "Segna come superato"}>
        <input
          type="checkbox"
          checked={exam.passed}
          onChange={(e) => void setPassed(exam.id, e.target.checked)}
          className="w-[15px] h-[15px] cursor-pointer accent-[#2f9e57]"
        />
      </label>
      <button
        type="button"
        onClick={() => onEdit(exam.id)}
        title="Modifica"
        className="text-[13px] px-1 py-0.5 rounded text-[#6b7280] hover:bg-[#eef0f3]"
      >✎</button>
      <button
        type="button"
        title="Elimina"
        onClick={() => {
          if (confirm(`Eliminare "${exam.name}"?`)) void remove(exam.id);
        }}
        className="text-[13px] px-1 py-0.5 rounded text-[#6b7280] hover:bg-[#eef0f3]"
      >🗑</button>
    </div>
  );
}
```

- [ ] **Step 2: Update Sidebar to render rows**

Edit `src/components/Sidebar.tsx`. Change props:

```tsx
interface SidebarProps {
  onAdd: (kind: "esame" | "progetto") => void;
  onEdit: (id: number) => void;
}

export function Sidebar({ onAdd, onEdit }: SidebarProps) {
```

Add `import { ExamRow } from "./ExamRow";` at top.

Replace the comment `{/* ExamRow rendering added in Task 19 */}` with:

```tsx
{active.map((e) => <ExamRow key={e.id} exam={e} onEdit={onEdit} />)}
```

Replace `{/* Passed ExamRows added in Task 19 */}` with:

```tsx
{passed.map((e) => <ExamRow key={e.id} exam={e} onEdit={onEdit} />)}
```

- [ ] **Step 3: Update App to pass `onEdit` (no-op for now)**

Edit `src/App.tsx`: change `<Sidebar onAdd={...} />` to `<Sidebar onAdd={(k) => setModalKind(k)} onEdit={() => {}} />`. The edit handler is hooked up in Task 20.

- [ ] **Step 4: Dev verify**

```powershell
npm run tauri dev
```

Expected: still no exam data (no add modal yet), but compiles. Close window.

- [ ] **Step 5: Commit**

```powershell
git add src/components src/App.tsx
git commit -m "feat(fe): ExamRow with passed/edit/delete controls"
```

---

### Task 20: ExamModal — create + edit, both kinds

**Files:**
- Create: `src/components/ExamModal.tsx`
- Create: `src/components/Modal.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create reusable Modal wrapper**

Create `src/components/Modal.tsx`:

```tsx
import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 bg-[rgba(20,24,40,0.42)] flex items-center justify-center p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-[380px] max-w-full max-h-[88vh] overflow-auto shadow-2xl">
        <div className="flex items-start justify-between px-4 pt-4 pb-2">
          <h3 className="text-[14.5px] font-semibold leading-snug m-0">{title}</h3>
          <button
            onClick={onClose}
            className="text-[18px] leading-none text-[#6b7280] px-1.5 py-1 rounded hover:bg-[#eef0f3]"
          >✕</button>
        </div>
        <div className="px-4 pb-4 pt-1">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ExamModal**

Create `src/components/ExamModal.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { Exam, ExamKind, ExamInput, DateRangeInput } from "../types";
import { useExams } from "../state";
import { useToast } from "../toast";
import { Modal } from "./Modal";

const PALETTE = [
  "#E8543F", "#2E86C1", "#27AE60", "#8E44AD", "#F39C12", "#16A0A0",
  "#D81B7A", "#5D6D7E", "#C0392B", "#1F8A4C", "#7D5FFF", "#E67E22",
];

interface ExamModalProps {
  open: boolean;
  onClose: () => void;
  editing: Exam | null;          // null = create
  initialKind: ExamKind;         // used when editing is null
}

export function ExamModal({ open, onClose, editing, initialKind }: ExamModalProps) {
  const { create, update, remove, exams } = useExams();
  const toast = useToast();

  const [kind, setKind] = useState<ExamKind>(initialKind);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [appelli, setAppelli] = useState<string[]>([""]);
  const [ranges, setRanges] = useState<DateRangeInput[]>([{ start: "", end: "" }]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setKind(editing.kind);
      setName(editing.name);
      setColor(editing.color);
      setAppelli(editing.appelli.length ? editing.appelli.map((a) => a.date) : [""]);
      setRanges(editing.ranges.length ? editing.ranges.map((r) => ({ start: r.start, end: r.end })) : [{ start: "", end: "" }]);
    } else {
      setKind(initialKind);
      setName("");
      const used = new Set(exams.map((e) => e.color));
      setColor(PALETTE.find((c) => !used.has(c)) ?? PALETTE[exams.length % PALETTE.length]);
      setAppelli([""]);
      setRanges([{ start: "", end: "" }]);
    }
  }, [open, editing, initialKind, exams]);

  if (!open) return null;

  const isProj = kind === "progetto";
  const title = editing
    ? (isProj ? "Modifica progetto" : "Modifica esame")
    : (isProj ? "Nuovo progetto" : "Nuovo esame");

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error("Inserisci un nome."); return; }
    const cleanAppelli = appelli.filter((d) => d).sort();
    const cleanRanges: DateRangeInput[] = ranges
      .filter((r) => r.start)
      .map((r) => {
        let { start, end } = r;
        if (!end) end = start;
        if (end < start) [start, end] = [end, start];
        return { start, end };
      })
      .sort((a, b) => a.start.localeCompare(b.start));

    if (isProj && cleanRanges.length === 0) {
      toast.error("Inserisci almeno una data di inizio per il progetto.");
      return;
    }

    const input: ExamInput = {
      name: trimmed,
      color,
      kind,
      passed: editing?.passed ?? false,
      appelli: isProj ? [] : cleanAppelli,
      ranges: isProj ? cleanRanges : [],
    };

    const result = editing
      ? await update(editing.id, input)
      : await create(input);
    if (result) {
      toast.success(editing ? "Modifiche salvate" : "Aggiunto");
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (confirm(`Eliminare "${editing.name}"?`)) {
      if (await remove(editing.id)) {
        toast.success("Eliminato");
        onClose();
      }
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {/* type segmented */}
      <div className="mb-3 flex border border-[#d6d9e0] rounded-lg overflow-hidden">
        {(["esame", "progetto"] as ExamKind[]).map((k, i) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={
              "flex-1 py-2 text-[12.5px] font-semibold " +
              (kind === k ? "bg-[#2f3545] text-white" : "bg-white text-[#6b7280]") +
              (i === 0 ? "" : " border-l border-[#d6d9e0]")
            }
          >
            {k === "esame" ? "📅 Esame" : "📋 Progetto"}
          </button>
        ))}
      </div>

      {/* name */}
      <div className="mb-3">
        <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wide mb-1.5">
          {isProj ? "Nome progetto" : "Nome esame"}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isProj ? "es. Tesina di Fisiologia" : "es. Neuroanatomia"}
          autoFocus
          className="w-full px-2.5 py-2 border border-[#d6d9e0] rounded-lg text-[13px] focus:outline-2 focus:outline-[#aeb4c0]"
        />
      </div>

      {/* color */}
      <div className="mb-3">
        <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wide mb-1.5">Colore</label>
        <div className="flex flex-wrap gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={
                "w-[26px] h-[26px] rounded-lg cursor-pointer border-2 " +
                (color === c ? "border-[#1f2430] shadow-[inset_0_0_0_2px_white]" : "border-transparent")
              }
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      {/* appelli (only for esame) */}
      {!isProj && (
        <div className="mb-3">
          <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wide mb-1.5">
            Appelli (date d'esame)
          </label>
          {appelli.map((d, i) => (
            <div key={i} className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[11px] text-app-muted w-[58px] shrink-0">Appello {i + 1}</span>
              <input
                type="date"
                value={d}
                onChange={(e) => setAppelli(appelli.map((x, j) => (j === i ? e.target.value : x)))}
                className="flex-1 px-2.5 py-2 border border-[#d6d9e0] rounded-lg text-[13px]"
              />
              <button
                type="button"
                onClick={() => setAppelli(appelli.filter((_, j) => j !== i))}
                className="text-[13px] px-1 py-0.5 rounded text-[#6b7280] hover:bg-[#eef0f3]"
                title="Rimuovi"
              >✕</button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setAppelli([...appelli, ""])}
            className="text-[12px] font-semibold text-[#2f6fb3] hover:underline"
          >+ Aggiungi appello</button>
        </div>
      )}

      {/* ranges (only for progetto) */}
      {isProj && (
        <div className="mb-3">
          <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wide mb-1.5">
            Periodi del progetto
          </label>
          {ranges.map((r, i) => (
            <div key={i} className="flex items-center gap-1 mb-1.5">
              <span className="text-[11px] text-app-muted shrink-0">Dal</span>
              <input
                type="date"
                value={r.start}
                onChange={(e) => setRanges(ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
                className="flex-1 min-w-0 px-2 py-2 border border-[#d6d9e0] rounded-lg text-[13px]"
              />
              <span className="text-[11px] text-app-muted shrink-0">al</span>
              <input
                type="date"
                value={r.end}
                onChange={(e) => setRanges(ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                className="flex-1 min-w-0 px-2 py-2 border border-[#d6d9e0] rounded-lg text-[13px]"
              />
              <button
                type="button"
                onClick={() => setRanges(ranges.filter((_, j) => j !== i))}
                className="text-[13px] px-1 py-0.5 rounded text-[#6b7280] hover:bg-[#eef0f3]"
                title="Rimuovi"
              >✕</button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRanges([...ranges, { start: "", end: "" }])}
            className="text-[12px] font-semibold text-[#2f6fb3] hover:underline"
          >+ Aggiungi periodo</button>
        </div>
      )}

      {/* actions */}
      <div className="flex gap-2 mt-2">
        {editing && (
          <button
            type="button"
            onClick={handleDelete}
            className="flex-1 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold border border-[#e7c3bd] text-[#c0392b] hover:bg-[#fdf1ef]"
          >Elimina</button>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold bg-[#2f3545] text-white border border-[#2f3545] hover:bg-[#1f2430]"
        >Salva</button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 3: Wire ExamModal into App.tsx**

Replace `Shell()` in `src/App.tsx`:

```tsx
import { useState } from "react";
import { ExamsProvider, useExams } from "./state";
import { ToastProvider } from "./toast";
import { Sidebar } from "./components/Sidebar";
import { ExamModal } from "./components/ExamModal";
import type { ExamKind } from "./types";

function Shell() {
  const { exams } = useExams();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<ExamKind>("esame");
  const [editingId, setEditingId] = useState<number | null>(null);

  const editing = editingId !== null ? exams.find((e) => e.id === editingId) ?? null : null;

  const openCreate = (k: ExamKind) => {
    setEditingId(null);
    setModalKind(k);
    setModalOpen(true);
  };
  const openEdit = (id: number) => {
    setEditingId(id);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-fg p-4">
      <div className="max-w-[1100px] mx-auto flex gap-4 items-start">
        <Sidebar onAdd={openCreate} onEdit={openEdit} />
        <main className="flex-1 min-w-0 rounded-2xl bg-white border border-app-border shadow-sm p-4">
          <h1 className="text-base font-semibold mb-3">📅 Calendario Appelli &amp; Studio</h1>
          <div className="text-sm text-app-muted">Calendario (in arrivo)</div>
        </main>
      </div>
      <ExamModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        initialKind={modalKind}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ExamsProvider>
        <Shell />
      </ExamsProvider>
    </ToastProvider>
  );
}
```

- [ ] **Step 4: Dev verify — create an esame end-to-end**

```powershell
npm run tauri dev
```

Manual test:
1. Click "+ Esame", type "Test Esame", pick a color, add an appello date in the future, click "Salva".
2. Sidebar shows the new esame with "1 appello · 0 giorni studio".
3. Click ✎ on the row, change name, save → updated.
4. Click 🗑 on the row, confirm → row disappears.
5. Try "+ Progetto" with no range → toast "Inserisci almeno una data di inizio per il progetto."
6. Add a project with start/end → row appears with "N giorni".

Close window.

- [ ] **Step 5: Commit**

```powershell
git add src/components src/App.tsx
git commit -m "feat(fe): ExamModal create/edit/delete for both kinds

End-to-end CRUD works: sidebar row, modal save, refetch, toast feedback.
Modal close on Escape and backdrop click via shared Modal wrapper."
```

---

### Task 21: Calendar header + month label + nav

**Files:**
- Create: `src/components/CalendarHeader.tsx`
- Create: `src/components/Calendar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create CalendarHeader**

Create `src/components/CalendarHeader.tsx`:

```tsx
import { MONTHS_IT } from "../date";

interface CalendarHeaderProps {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function CalendarHeader({ year, month, onPrev, onNext, onToday }: CalendarHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Mese precedente"
        className="w-[30px] h-[30px] flex items-center justify-center rounded-lg border border-[#d6d9e0] bg-white text-[#2f3545] hover:bg-[#f4f5f7]"
      >‹</button>
      <span className="flex-1 text-[15px] font-bold capitalize">
        {MONTHS_IT[month]} {year}
      </span>
      <button
        type="button"
        onClick={onToday}
        className="h-[30px] px-2.5 rounded-lg border border-[#d6d9e0] bg-white text-[12px] font-semibold text-[#2f3545] hover:bg-[#f4f5f7]"
      >Oggi</button>
      <button
        type="button"
        onClick={onNext}
        aria-label="Mese successivo"
        className="w-[30px] h-[30px] flex items-center justify-center rounded-lg border border-[#d6d9e0] bg-white text-[#2f3545] hover:bg-[#f4f5f7]"
      >›</button>
    </div>
  );
}
```

- [ ] **Step 2: Create Calendar skeleton (header + weekday row + empty grid)**

Create `src/components/Calendar.tsx`:

```tsx
import { useState } from "react";
import { WEEKDAYS_IT_SHORT, buildMonthGrid } from "../date";
import { CalendarHeader } from "./CalendarHeader";

interface CalendarProps {
  onDayClick: (key: string) => void;
}

export function Calendar({ onDayClick }: CalendarProps) {
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const grid = buildMonthGrid(view.y, view.m);

  const prev = () => setView((v) => v.m === 0 ? { y: v.y - 1, m: 11 } : { ...v, m: v.m - 1 });
  const next = () => setView((v) => v.m === 11 ? { y: v.y + 1, m: 0 } : { ...v, m: v.m + 1 });
  const today = () => setView({ y: new Date().getFullYear(), m: new Date().getMonth() });

  return (
    <div>
      <CalendarHeader
        year={grid.year}
        month={grid.month}
        onPrev={prev}
        onNext={next}
        onToday={today}
      />
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEKDAYS_IT_SHORT.map((d) => (
          <div key={d} className="text-[10.5px] font-bold text-app-muted uppercase tracking-wide text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: grid.leadingBlanks }).map((_, i) => (
          <div key={`b${i}`} className="min-h-[94px] border border-transparent bg-transparent" />
        ))}
        {grid.days.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => onDayClick(d.key)}
            className={
              "relative min-h-[94px] p-1 border border-[#ebedf1] rounded-lg bg-white text-left " +
              "hover:outline hover:outline-2 hover:outline-[#c7cbd4] hover:outline-offset-[-2px]"
            }
          >
            <div className={
              "text-[11.5px] font-semibold " +
              (d.isToday
                ? "bg-[#2f3545] text-white w-[19px] h-[19px] rounded-full flex items-center justify-center"
                : "text-[#6b7280]")
            }>{d.day}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire Calendar into App**

Replace the placeholder div in `Shell()` (`<div className="text-sm text-app-muted">Calendario (in arrivo)</div>`) with:

```tsx
<Calendar onDayClick={(key) => { void key; /* DayModal hooked in Task 23 */ }} />
```

Add `import { Calendar } from "./components/Calendar";` at top of `App.tsx`.

- [ ] **Step 4: Dev verify**

```powershell
npm run tauri dev
```

Expected: calendar grid renders for the current month, with weekday headers, leading blanks, day numbers, today highlighted in dark pill. Prev/Next/Oggi work. Close window.

- [ ] **Step 5: Commit**

```powershell
git add src/components src/App.tsx
git commit -m "feat(fe): month calendar grid with prev/next/oggi navigation"
```

---

### Task 22: DayCell colors — bg tint, project bars, study dots, appelli pills

**Files:**
- Create: `src/components/DayCell.tsx`
- Modify: `src/components/Calendar.tsx`

- [ ] **Step 1: Create DayCell**

Create `src/components/DayCell.tsx`:

```tsx
import type { Exam } from "../types";
import { inRange, tint } from "../date";
import type { MonthGridDay } from "../date";

interface DayCellProps {
  day: MonthGridDay;
  exams: Exam[]; // active only
  onClick: (key: string) => void;
}

interface ProjectHit { exam: Exam; start: string; end: string }

export function DayCell({ day, exams, onClick }: DayCellProps) {
  const studyExams = exams.filter((e) =>
    e.kind === "esame" && e.studyDays.includes(day.key)
  );
  const projHits: ProjectHit[] = [];
  for (const e of exams) {
    if (e.kind !== "progetto") continue;
    for (const r of e.ranges) {
      if (inRange(day.key, r.start, r.end)) {
        projHits.push({ exam: e, start: r.start, end: r.end });
      }
    }
  }
  const appelliToday = exams.filter((e) =>
    e.kind === "esame" && e.appelli.some((a) => a.date === day.key)
  );

  // Background union
  const colored: Exam[] = [];
  for (const e of studyExams) if (!colored.includes(e)) colored.push(e);
  for (const h of projHits) if (!colored.includes(h.exam)) colored.push(h.exam);

  let bg: string | undefined;
  if (colored.length === 1) {
    bg = tint(colored[0].color, 0.30);
  } else if (colored.length > 1) {
    const step = 100 / colored.length;
    const stops = colored.map((e, i) =>
      `${tint(e.color, 0.34)} ${i * step}% ${(i + 1) * step}%`
    ).join(", ");
    bg = `linear-gradient(135deg, ${stops})`;
  }

  return (
    <button
      type="button"
      onClick={() => onClick(day.key)}
      style={bg ? { background: bg } : undefined}
      className={
        "relative min-h-[94px] p-1 border border-[#ebedf1] rounded-lg bg-white text-left overflow-hidden " +
        "hover:outline hover:outline-2 hover:outline-[#c7cbd4] hover:outline-offset-[-2px]"
      }
    >
      <div className={
        "text-[11.5px] font-semibold " +
        (day.isToday
          ? "bg-[#2f3545] text-white w-[19px] h-[19px] rounded-full flex items-center justify-center"
          : "text-[#6b7280]")
      }>{day.day}</div>

      {/* project bars */}
      {projHits.map((h, idx) => {
        const isStart = h.start === day.key;
        const isEnd = h.end === day.key;
        const showLabel = isStart || day.col === 0 || day.day === 1;
        return (
          <div
            key={`p${idx}-${h.exam.id}`}
            className="-mx-1 px-1.5 py-[1.5px] text-[9px] font-bold text-white leading-snug truncate"
            style={{
              background: h.exam.color,
              borderTopLeftRadius: isStart ? 5 : 0,
              borderBottomLeftRadius: isStart ? 5 : 0,
              borderTopRightRadius: isEnd ? 5 : 0,
              borderBottomRightRadius: isEnd ? 5 : 0,
              marginTop: idx === 0 ? 3 : 0,
            }}
            title={`Progetto: ${h.exam.name}`}
          >{showLabel ? h.exam.name : " "}</div>
        );
      })}

      {/* study dots */}
      {studyExams.length > 0 && (
        <div className="absolute top-1 right-1 flex gap-0.5 flex-wrap max-w-[50%] justify-end">
          {studyExams.map((e) => (
            <span
              key={e.id}
              className="w-[7px] h-[7px] rounded-full"
              style={{ background: e.color, boxShadow: "0 0 0 1px rgba(255,255,255,0.7)" }}
              title={`Studio: ${e.name}`}
            />
          ))}
        </div>
      )}

      {/* appelli pills */}
      {appelliToday.length > 0 && (
        <div className="absolute left-[3px] right-[3px] bottom-[3px] flex flex-col gap-[2px]">
          {appelliToday.map((e) => (
            <div
              key={e.id}
              className="text-[9px] font-bold text-white px-1 py-px rounded truncate"
              style={{ background: e.color }}
              title={`Appello: ${e.name}`}
            >📌 {e.name}</div>
          ))}
        </div>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Use DayCell in Calendar**

Edit `src/components/Calendar.tsx`. Add at top:

```tsx
import { useExams } from "../state";
import { DayCell } from "./DayCell";
```

Replace the day-rendering loop:

```tsx
{grid.days.map((d) => (
  <DayCell key={d.key} day={d} exams={activeExams} onClick={onDayClick} />
))}
```

Inside `Calendar()` before the return, add:

```tsx
const { exams } = useExams();
const activeExams = exams.filter((e) => !e.passed);
```

Delete the inline `<button>` day-rendering block that's been replaced.

- [ ] **Step 3: Dev verify with sample data**

```powershell
npm run tauri dev
```

Manual test:
1. Create an esame "Test" with an appello on a date in the current month → appello pill appears on that day with 📌 and name.
2. Open the day modal (will fail in next task — for now just verify pills render).
3. Create a progetto "Tesi" spanning ~7 days in the current month → project bar appears with name at start and continuation in cells without label.
4. Verify two-color cell when an esame study day overlaps a progetto range (add study day directly via PowerShell SQLite or wait until Task 23 to test interactively).

Close window.

- [ ] **Step 4: Commit**

```powershell
git add src/components
git commit -m "feat(fe): DayCell with tinted bg, project bars, study dots, appelli pills

Background blends multiple exams via diagonal gradient (artifact behavior).
Project bars label at start-of-range or start-of-row, blank otherwise."
```

---

### Task 23: DayModal — info-box + study toggles

**Files:**
- Create: `src/components/DayModal.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/Calendar.tsx` (now `onDayClick` is wired in App)

- [ ] **Step 1: Create DayModal**

Create `src/components/DayModal.tsx`:

```tsx
import { useExams } from "../state";
import { inRange, parseYmd } from "../date";
import { Modal } from "./Modal";

interface DayModalProps {
  open: boolean;
  dayKey: string | null;
  onClose: () => void;
}

export function DayModal({ open, dayKey, onClose }: DayModalProps) {
  const { exams, toggleStudyDay } = useExams();
  if (!dayKey) return null;

  const date = parseYmd(dayKey);
  const titleRaw = date.toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const title = titleRaw.charAt(0).toUpperCase() + titleRaw.slice(1);

  const active = exams.filter((e) => !e.passed);
  const infoLines: { color: string; text: string }[] = [];
  for (const e of active) {
    if (e.kind === "esame") {
      for (const a of e.appelli) {
        if (a.date === dayKey) infoLines.push({ color: e.color, text: `Appello: ${e.name}` });
      }
    } else {
      if (e.ranges.some((r) => inRange(dayKey, r.start, r.end))) {
        infoLines.push({ color: e.color, text: `Progetto in corso: ${e.name}` });
      }
    }
  }

  const studyEsami = active.filter((e) => e.kind === "esame");

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {infoLines.length > 0 && (
        <div className="bg-[#fbf7ee] border border-[#f0e6cf] rounded-lg px-2.5 py-2 mb-3">
          {infoLines.map((ln, i) => (
            <div key={i} className="text-[12px] font-semibold flex items-center gap-1.5 mt-1 first:mt-0">
              <span className="w-[10px] h-[10px] rounded-full" style={{ background: ln.color }} />
              {ln.text}
            </div>
          ))}
        </div>
      )}

      {studyEsami.length === 0 ? (
        <div className="text-[12px] text-app-muted py-1.5">
          {infoLines.length > 0
            ? "Nessun esame per cui segnare lo studio."
            : "Nessun esame attivo. Aggiungine uno dalla barra laterale."}
        </div>
      ) : (
        <>
          <div className="text-[11px] font-bold text-[#6b7280] uppercase tracking-wide mb-2">
            Sto studiando per…
          </div>
          {studyEsami.map((e) => {
            const studying = e.studyDays.includes(dayKey);
            return (
              <label
                key={e.id}
                className="flex items-center gap-2 px-2.5 py-2 border border-[#eef0f3] rounded-lg mb-1.5 cursor-pointer hover:bg-[#f7f8fa]"
              >
                <span className="w-3 h-3 rounded-full" style={{ background: e.color }} />
                <span className="flex-1 text-[13px] font-semibold">{e.name}</span>
                <input
                  type="checkbox"
                  checked={studying}
                  onChange={() => void toggleStudyDay(e.id, dayKey)}
                  className="w-[17px] h-[17px] cursor-pointer"
                />
              </label>
            );
          })}
        </>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Wire into App**

Edit `src/App.tsx`. Add `import { DayModal } from "./components/DayModal";`. In `Shell()` add state:

```tsx
const [dayKey, setDayKey] = useState<string | null>(null);
```

Pass `onDayClick={setDayKey}` to `<Calendar />` (replacing the no-op). At the bottom of the Shell JSX, before the closing fragment/div, add:

```tsx
<DayModal open={dayKey !== null} dayKey={dayKey} onClose={() => setDayKey(null)} />
```

- [ ] **Step 3: Dev verify**

```powershell
npm run tauri dev
```

Manual test:
1. Click any day → DayModal opens with the localized italian title.
2. Toggle "Sto studiando per…" on an esame → cell gets a study dot. Toggle off → dot disappears.
3. Day with an appello → info-box shows it. Day inside a progetto range → info-box shows "Progetto in corso".
4. Escape closes the modal.

Close window.

- [ ] **Step 4: Commit**

```powershell
git add src/components src/App.tsx
git commit -m "feat(fe): DayModal with appelli info-box and study-day toggles

Click a cell to mark/unmark studio for each active esame on that day."
```

---

### Task 24: Legend

**Files:**
- Create: `src/components/Legend.tsx`
- Modify: `src/components/Calendar.tsx`

- [ ] **Step 1: Create Legend**

Create `src/components/Legend.tsx`:

```tsx
import { useExams } from "../state";

export function Legend() {
  const { exams } = useExams();
  const active = exams.filter((e) => !e.passed);

  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 mt-3.5 pt-3 border-t border-[#eef0f3]">
      {active.length === 0 ? (
        <span className="text-[11.5px] text-app-muted">
          Aggiungi un esame o un progetto per iniziare.
        </span>
      ) : (
        active.map((e) => (
          <div key={e.id} className="flex items-center gap-1.5 text-[11.5px] text-[#555b69]">
            <span
              className={"w-[11px] h-[11px] " + (e.kind === "progetto" ? "rounded" : "rounded-full")}
              style={{ background: e.color }}
            />
            {e.name}
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Render in Calendar**

Edit `src/components/Calendar.tsx`. Add `import { Legend } from "./Legend";` at top. Add `<Legend />` after the closing `</div>` of the calendar grid (still inside the outer `<div>`).

- [ ] **Step 3: Dev verify**

```powershell
npm run tauri dev
```

Expected: legend at the bottom shows all active esami/progetti with their color swatch (round for esame, rounded square for progetto). Close window.

- [ ] **Step 4: Commit**

```powershell
git add src/components
git commit -m "feat(fe): legend below calendar (round=esame, square=progetto)"
```

---

### Task 25: ImportModal

**Files:**
- Create: `src/components/ImportModal.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create ImportModal**

Create `src/components/ImportModal.tsx`:

```tsx
import { useState } from "react";
import { importArtifactJson } from "../db";
import { useExams } from "../state";
import { useToast } from "../toast";
import { Modal } from "./Modal";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportModal({ open, onClose }: ImportModalProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { refetch } = useExams();
  const toast = useToast();

  const handleImport = async () => {
    if (!text.trim()) { toast.error("Incolla il JSON dell'artifact"); return; }
    setBusy(true);
    try {
      const report = await importArtifactJson(text);
      toast.success(`Importati ${report.inserted}, saltati ${report.skipped}`);
      if (report.errors.length > 0) {
        for (const err of report.errors.slice(0, 5)) toast.info(err);
      }
      await refetch();
      onClose();
      setText("");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Importa da artifact">
      <p className="text-[11.5px] text-app-muted mb-2 leading-relaxed">
        Incolla il valore di <code className="bg-[#eef0f3] rounded px-1">appelliStudio_v1</code> dal
        localStorage dell'artifact HTML. Le voci con nome già presente verranno saltate.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{"exams":[…]}'
        rows={10}
        className="w-full px-2 py-2 border border-[#d6d9e0] rounded-lg text-[12px] font-mono"
      />
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold border border-[#d6d9e0] bg-white text-[#2f3545] hover:bg-[#f4f5f7]"
        >Annulla</button>
        <button
          type="button"
          disabled={busy}
          onClick={handleImport}
          className="flex-1 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold bg-[#2f3545] text-white border border-[#2f3545] hover:bg-[#1f2430] disabled:opacity-50"
        >{busy ? "Importazione…" : "Importa"}</button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Add Import button to Sidebar**

Edit `src/components/Sidebar.tsx`. Add to `SidebarProps`:

```tsx
onImport: () => void;
```

In the destructure: `export function Sidebar({ onAdd, onEdit, onImport }: SidebarProps) {`

After the `<div className="flex gap-2 mt-1">` add-buttons block, add:

```tsx
<button
  type="button"
  onClick={onImport}
  className="w-full mt-2 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold border border-[#d6d9e0] bg-white text-[#2f3545] hover:bg-[#f4f5f7]"
>↥ Importa da artifact</button>
```

- [ ] **Step 3: Wire into App**

Edit `src/App.tsx`. Add `import { ImportModal } from "./components/ImportModal";`. Add state:

```tsx
const [importOpen, setImportOpen] = useState(false);
```

Pass `onImport={() => setImportOpen(true)}` to `<Sidebar />`. At the bottom of the Shell tree (alongside `<DayModal>` and `<ExamModal>`):

```tsx
<ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
```

- [ ] **Step 4: Dev verify**

```powershell
npm run tauri dev
```

Manual test:
1. Click "Importa da artifact" → modal opens with textarea.
2. Paste valid JSON like `{"exams":[{"name":"Imp","color":"#27AE60","type":"esame","appelli":[{"date":"2026-07-01"}],"ranges":[],"studyDays":[]}]}` → click "Importa".
3. Toast "Importati 1, saltati 0", row appears in sidebar.
4. Re-import same payload → "Importati 0, saltati 1".

Close window.

- [ ] **Step 5: Commit**

```powershell
git add src/components src/App.tsx
git commit -m "feat(fe): ImportModal accepts artifact localStorage JSON

Skips duplicate names. Shows inserted/skipped count + first 5 errors as info toasts."
```

---

## Phase 5 — Polish

### Task 26: DB init failure full-screen

**Files:**
- Modify: `src/state.tsx` (expose `initError`)
- Modify: `src/App.tsx` (render fallback when init fails)

The DB init happens in Rust at `setup()`. If it fails, Tauri panics — we want the app to still open and show a useful message. So instead of failing in `setup()`, change to lazy-init.

- [ ] **Step 1: Make DB init lazy in Rust**

Edit `src-tauri/src/commands.rs`. Change `AppState`:

```rust
pub struct AppState {
    pub conn: Mutex<Result<Connection, String>>,
}

pub fn build_state(app: &tauri::App) -> AppState {
    let result = (|| -> Result<Connection, String> {
        let dir = app.path().app_data_dir().map_err(|e| format!("app_data_dir: {e}"))?;
        let db_path = dir.join("calendar.db");
        db::open(&db_path).map_err(|e| format!("open db: {e}"))
    })();
    AppState { conn: Mutex::new(result) }
}
```

Replace every `state.conn.lock().map_err(|e| format!("lock: {e}"))?` pattern with a helper. Add at the top of `commands.rs` (after imports):

```rust
fn lock_conn<'a>(state: &'a State<AppState>) -> Result<std::sync::MutexGuard<'a, Result<Connection, String>>, String> {
    let guard = state.conn.lock().map_err(|e| format!("lock: {e}"))?;
    Ok(guard)
}
```

Then in each command, use:

```rust
let mut guard = lock_conn(&state)?;
let conn = guard.as_mut().map_err(|e| e.clone())?;
```

For commands that don't need mutability:

```rust
let guard = lock_conn(&state)?;
let conn = guard.as_ref().map_err(|e| e.clone())?;
```

Apply this pattern to all 10 commands.

Also add a new command:

```rust
#[tauri::command]
pub fn db_status(state: State<AppState>) -> Result<(), String> {
    let guard = state.conn.lock().map_err(|e| format!("lock: {e}"))?;
    guard.as_ref().map(|_| ()).map_err(|e| e.clone())
}
```

Add `db_status` to the `invoke_handler!` list in `lib.rs`.

In `lib.rs` setup, change to:

```rust
.setup(|app| {
    let state = commands::build_state(app);
    app.manage(state);
    Ok(())
})
```

(no error return — the state holds the result).

- [ ] **Step 2: Run cargo build + tests**

```powershell
cargo build --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: compiles, all tests still pass.

- [ ] **Step 3: Surface init error in FE**

Edit `src/db.ts`. Add:

```typescript
export async function dbStatus(): Promise<void> {
  await invoke("db_status");
}
```

Edit `src/state.tsx`. Add to the context value:

```typescript
initError: string | null;
```

In `ExamsProvider`, add state:

```typescript
const [initError, setInitError] = useState<string | null>(null);
```

Change `refetch` to first call `dbStatus()`:

```typescript
const refetch = useCallback(async () => {
  try {
    await db.dbStatus();
    setInitError(null);
    const list = searchQuery.trim()
      ? await db.searchExams(searchQuery)
      : await db.listExams();
    setExams(list);
  } catch (e) {
    setInitError(String(e));
  } finally {
    setLoading(false);
  }
}, [searchQuery]);
```

Remove the toast from the catch in `refetch` (the toast was for transient errors; init errors deserve a full-screen). Other mutations keep the toast pattern.

Add `initError` to the `useMemo` value.

- [ ] **Step 4: Render fallback in App**

Edit `src/App.tsx`. Inside `Shell()`, before the main return:

```tsx
const { initError } = useExams();
if (initError) {
  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-6">
      <div className="max-w-md bg-white rounded-2xl border border-red-200 shadow-lg p-6">
        <h2 className="text-base font-bold text-red-700 mb-2">Errore di inizializzazione database</h2>
        <p className="text-[13px] text-app-fg leading-relaxed mb-3">
          L'app non è riuscita a aprire il database locale. Prova a chiudere e riaprire.
          Se il problema persiste, segnala questo messaggio:
        </p>
        <pre className="text-[11px] bg-[#f4f5f7] border border-[#eef0f3] rounded p-2 overflow-auto">{initError}</pre>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Dev verify (happy path)**

```powershell
npm run tauri dev
```

Expected: app works exactly as before. Close window.

- [ ] **Step 6: Commit**

```powershell
git add src-tauri/src src/db.ts src/state.tsx src/App.tsx
git commit -m "feat: graceful DB init failure handling

Init errors surface as a full-screen banner with the error message instead
of crashing Tauri's setup. db_status command lets the FE detect early."
```

---

### Task 27: README

**Files:**
- Modify: `README.md` (replace scaffold content)

- [ ] **Step 1: Write README**

Replace `README.md`:

````markdown
# Calendario Appelli & Studio

Desktop app per tracciare esami universitari, appelli, giorni di studio, e progetti pluri-giorno. Tauri 2.x + React + TypeScript + SQLite. Offline-first, niente sync remoto.

## Prerequisiti

- Node.js ≥ 20
- Rust toolchain (`rustc`, `cargo`) — installa tramite [rustup](https://rustup.rs/)
- Windows: WebView2 (preinstallato su Windows 11) e Microsoft C++ Build Tools

## Comandi

```powershell
npm install            # installa dipendenze JS
npm run tauri dev      # avvio in modalità sviluppo (hot reload + finestra Tauri)
npm run tauri build    # produce installer di rilascio in src-tauri/target/release/bundle/
```

## Dove vive il database

SQLite single-file in:

- **Windows:** `%APPDATA%\com.calendario-appelli.app\calendar.db`
- **macOS:** `~/Library/Application Support/com.calendario-appelli.app/calendar.db`
- **Linux:** `~/.local/share/com.calendario-appelli.app/calendar.db`

Schema migrato automaticamente all'avvio via `PRAGMA user_version`.

## Test

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

Copre il layer DB: CRUD esami/progetti, validazione, toggle studio, import JSON.

## Importare dati dall'artifact HTML

Bottone **"Importa da artifact"** nella sidebar. Apri l'artifact HTML originale, esegui in console:

```js
copy(localStorage.getItem("appelliStudio_v1"))
```

Incolla nella textarea del modal e conferma. Voci con nome già presente vengono saltate.

## Documentazione di design

- Spec: `docs/superpowers/specs/2026-05-16-calendario-appelli-tauri-design.md`
- Plan: `docs/superpowers/specs/2026-05-16-calendario-appelli-tauri-plan.md`
````

- [ ] **Step 2: Commit**

```powershell
git add README.md
git commit -m "docs: README with prereqs, commands, DB path, import flow"
```

---

## Phase 6 — Build & verify

### Task 28: Full Rust test pass

- [ ] **Step 1: Run all tests**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all tests pass. Count should be ≥ 20:
- `db::tests`: 2 (migrations apply + idempotent)
- `db::types::tests`: 8 (validation)
- `db::exams::tests`: 12 (CRUD + toggle + search)
- `db::settings::tests`: 3
- `db::import::tests`: 3

If any fail, fix before continuing.

- [ ] **Step 2: TypeScript strict check**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Build the production frontend**

```powershell
npm run build
```

Expected: Vite produces `dist/` without warnings/errors. (This is the FE build invoked by `tauri build` internally.)

---

### Task 29: Dev smoke test — manual

- [ ] **Step 1: Launch**

```powershell
npm run tauri dev
```

- [ ] **Step 2: Manual checklist**

Confirm each:

1. ☐ Window opens with empty calendar for current month, current day highlighted.
2. ☐ Sidebar empty-state message visible.
3. ☐ "+ Esame" → modal → name "Verifica" + color + appello date in current month → Salva.
4. ☐ Sidebar shows the row, calendar shows the appello pill on the right day.
5. ☐ Click that day → DayModal shows "Appello: Verifica" + toggle "Sto studiando per…".
6. ☐ Toggle study → study dot appears on the day, sidebar meta updates to "1 appello · 1 giorno studio".
7. ☐ ✎ on row → modal opens prefilled → rename → Salva → updated everywhere.
8. ☐ Checkbox "passed" → row moves to "Completati" section, calendar tints/pills disappear.
9. ☐ Uncheck → returns to active.
10. ☐ 🗑 → confirm → row gone, calendar empties.
11. ☐ "+ Progetto" with a 5-day range → bar appears across cells with name at start.
12. ☐ Search "ver" → filters to "Verifica".
13. ☐ Prev / Next / Oggi navigation works.
14. ☐ Escape closes any open modal. Backdrop click also closes.

If any item fails, fix and re-test before continuing.

- [ ] **Step 3: Take screenshot of empty state**

Close the app. Manually clear the DB to get a fresh empty state:

```powershell
Remove-Item "$env:APPDATA\com.calendario-appelli.app\calendar.db" -ErrorAction SilentlyContinue
```

Relaunch with `npm run tauri dev`. Take a screenshot of the empty window (use Windows Snipping Tool or `Win+Shift+S`). Save as `docs/screenshots/empty.png`.

- [ ] **Step 4: Take screenshot with sample data**

Add an esame "Anatomia Patologica" (color red, 2 appelli in current month) and a progetto "Tesi" spanning a week. Toggle study on 3 days. Take a screenshot. Save as `docs/screenshots/with-sample.png`.

- [ ] **Step 5: Commit screenshots**

```powershell
git add docs/screenshots
git commit -m "docs: add screenshots of empty state and sample data"
```

---

### Task 30: Production bundle

- [ ] **Step 1: Build the bundle**

```powershell
npm run tauri build
```

Expected: takes 5-15 min on first run. Output in `src-tauri/target/release/bundle/`:
- `msi/Calendario Appelli & Studio_0.1.0_x64_en-US.msi`
- `nsis/Calendario Appelli & Studio_0.1.0_x64-setup.exe`

- [ ] **Step 2: Verify installer existence**

```powershell
Get-ChildItem -Recurse src-tauri/target/release/bundle | Select-Object FullName
```

Expected output includes both `.msi` and `-setup.exe` files.

- [ ] **Step 3: Launch the standalone binary (not the installer)**

```powershell
& "src-tauri\target\release\calendar-desktop.exe"
```

Expected: the same app window opens, but pointing at the same DB path (production path, same as dev because identifier matches). Close.

- [ ] **Step 4: Commit nothing — bundle is gitignored**

`src-tauri/target/` should already be in `.gitignore`. Verify:

```powershell
git status
```

Expected: working tree clean. If `target/` shows up, add `src-tauri/target` to `.gitignore` and commit.

---

## Self-review notes (post-write)

- **Spec coverage:** Each spec section §1-§15 maps to tasks:
  - §1 Goal → entire plan
  - §2 Stack → Task 1, 2, 3
  - §3 Domain → Task 5
  - §4 Schema → Task 4
  - §5 Commands → Task 11
  - §6 Import → Task 10, 25
  - §7 Frontend layout → Task 17-25
  - §8 Error handling → Tasks 15, 26 (toast in state.tsx, full-screen in App.tsx)
  - §9 Migrations → Task 4
  - §10 DB path → Task 11 (`build_state`)
  - §11 Tests → Tasks 4-10 + verification in Task 28
  - §12 Project tree → Task 1
  - §13 Build/run → Task 30
  - §14 Out-of-scope → respected throughout (no RRULE, no week/day, no drag, no categories)
- **Type consistency:** TS uses `studyDays` (camel), Rust serializes `study_days` (snake); the mapping happens in `src/db.ts` `fromWire()`. Spec/plan are consistent. `ExamKind` values `"esame" | "progetto"` match Rust's serde rename.
- **No placeholders found** — every code block is complete and runnable. Every step has an exact command with expected output where applicable.
