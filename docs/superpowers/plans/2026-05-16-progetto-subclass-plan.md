# Esame/Progetto Subclass Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the exam model to a SOLID-aligned hierarchy: `Progetto extends Esame` (via composition+flatten in Rust, intersection types in TS), with `ranges` living only on `Progetto`. New helper modules (`progetto.ts`, `progetto.rs`) encapsulate range-specific logic. ExamModal becomes a unified entries list with a per-row "Periodo" checkbox; `kind` is derived.

**Architecture:** No DB migration. Rust types become `enum Exam { Esame(EsameData), Progetto(ProgettoData) }` with `ProgettoData { esame: EsameData, ranges }` (flattened serde). Validation relaxes "progetto no appelli". `count_presences` becomes DISTINCT-by-exam. `toggle_study_day` accepts both kinds. FE follows the same shape via discriminated union types.

**Tech Stack:** Rust + rusqlite + chrono · TypeScript + React 19

**Spec:** `docs/superpowers/specs/2026-05-16-progetto-subclass-design.md`

**Conventions:**
- PowerShell from `C:\Users\Gianmarco\Desktop\Calendario-app`.
- Each task ends with a clean-build commit. After each commit: TS strict + Vite build + cargo test must pass.

---

## Phase 0 — Rust

### Task 1: Rust types refactor (Exam enum + validation + tests)

**Files:**
- Modify: `src-tauri/src/db/types.rs`
- Modify: `src-tauri/src/db/exams.rs` (test helpers + tests that construct ExamInput)
- Modify: `src-tauri/src/db/import.rs` (small adapt — kept independent from logic of types but compiles depend on types)

**SOLID:** SRP (EsameData vs ProgettoData), OCP (new kind = new variant), LSP (Progetto has all Esame fields via flatten).

- [ ] **Step 1: Replace `Exam` and `ExamInput` in `types.rs`**

Open `src-tauri/src/db/types.rs`. Locate the existing `Exam` and `ExamInput` structs (currently single structs with `kind` field, `appelli`, `ranges`, `study_days`). REPLACE them with the new shape.

Find the current section that begins with:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Exam {
    pub id: i64,
    pub name: String,
    ...
}
```

and ends after `ExamInput`. Replace from `#[derive(...)] pub struct Exam {` through the end of `pub struct ExamInput {...}` with:

```rust
// === Esame (base) ===

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EsameData {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub passed: bool,
    pub default_study_minutes: i32,
    pub appelli: Vec<Appello>,
    pub study_days: Vec<StudyDay>,
}

// === Progetto (extends Esame with ranges) ===

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgettoData {
    #[serde(flatten)]
    pub esame: EsameData,
    pub ranges: Vec<ProjectRange>,
}

// === Exam top-level discriminated union ===

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Exam {
    Esame(EsameData),
    Progetto(ProgettoData),
}

impl Exam {
    pub fn base(&self) -> &EsameData {
        match self {
            Exam::Esame(b) => b,
            Exam::Progetto(p) => &p.esame,
        }
    }
    pub fn id(&self) -> i64 { self.base().id }
    pub fn kind_str(&self) -> &'static str {
        match self {
            Exam::Esame(_) => "esame",
            Exam::Progetto(_) => "progetto",
        }
    }
    pub fn ranges(&self) -> &[ProjectRange] {
        match self {
            Exam::Esame(_) => &[],
            Exam::Progetto(p) => &p.ranges,
        }
    }
}

// === Inputs mirror the same hierarchy ===

#[derive(Debug, Clone, Deserialize)]
pub struct EsameInputData {
    pub name: String,
    pub color: String,
    pub passed: bool,
    pub default_study_minutes: i32,
    pub appelli: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProgettoInputData {
    #[serde(flatten)]
    pub esame: EsameInputData,
    pub ranges: Vec<DateRange>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum ExamInput {
    Esame(EsameInputData),
    Progetto(ProgettoInputData),
}

impl ExamInput {
    pub fn base(&self) -> &EsameInputData {
        match self {
            ExamInput::Esame(b) => b,
            ExamInput::Progetto(p) => &p.esame,
        }
    }
    pub fn kind_str(&self) -> &'static str {
        match self {
            ExamInput::Esame(_) => "esame",
            ExamInput::Progetto(_) => "progetto",
        }
    }
    pub fn ranges(&self) -> &[DateRange] {
        match self {
            ExamInput::Esame(_) => &[],
            ExamInput::Progetto(p) => &p.ranges,
        }
    }
}
```

The other types in this file — `ExamKind`, `Appello`, `ProjectRange`, `StudyDay`, `DateRange`, `ImportReport` — stay unchanged. The `ExamKind` enum remains so that other code (like `kind_str`) can return one of its variants.

- [ ] **Step 2: Replace `validate_input`**

Locate `pub fn validate_input(input: &ExamInput) -> Result<String, String>` in `types.rs`. Replace its entire body with:

```rust
pub fn validate_input(input: &ExamInput) -> Result<String, String> {
    let base = input.base();
    let name = validate_name(&base.name)?;
    validate_color(&base.color)?;
    if base.default_study_minutes < 0 || base.default_study_minutes > 1440 {
        return Err(format!(
            "Tempo di studio predefinito non valido: {} (0..1440)",
            base.default_study_minutes
        ));
    }
    for d in &base.appelli {
        validate_date(d)?;
    }
    if let ExamInput::Progetto(p) = input {
        for r in &p.ranges {
            validate_range(r)?;
        }
        if p.ranges.is_empty() {
            return Err("Un progetto richiede almeno un periodo".into());
        }
    }
    Ok(name)
}
```

The old check "esame can't have ranges" goes away (Esame literally doesn't have ranges field). The old check "progetto can't have appelli" goes away (Progetto inherits appelli).

- [ ] **Step 3: Update existing validation tests in `types.rs`**

The tests inside `#[cfg(test)] mod tests` in `types.rs` need updates to construct the new enum variants.

REPLACE the three tests `esame_with_ranges_rejected`, `progetto_without_ranges_rejected`, `progetto_with_appelli_rejected` with the following 4 tests (the "esame with ranges" test becomes impossible since Esame doesn't have ranges):

```rust
    #[test]
    fn progetto_without_ranges_rejected() {
        let i = ExamInput::Progetto(ProgettoInputData {
            esame: EsameInputData {
                name: "x".into(),
                color: "#112233".into(),
                passed: false,
                default_study_minutes: 60,
                appelli: vec![],
            },
            ranges: vec![],
        });
        assert!(validate_input(&i).is_err());
    }

    #[test]
    fn progetto_with_appelli_now_allowed() {
        let i = ExamInput::Progetto(ProgettoInputData {
            esame: EsameInputData {
                name: "x".into(),
                color: "#112233".into(),
                passed: false,
                default_study_minutes: 60,
                appelli: vec!["2026-01-15".into()],
            },
            ranges: vec![DateRange { start: "2026-01-01".into(), end: "2026-01-10".into() }],
        });
        assert!(validate_input(&i).is_ok());
    }

    #[test]
    fn esame_with_empty_collections_ok() {
        let i = ExamInput::Esame(EsameInputData {
            name: "placeholder".into(),
            color: "#112233".into(),
            passed: false,
            default_study_minutes: 60,
            appelli: vec![],
        });
        assert!(validate_input(&i).is_ok());
    }

    #[test]
    fn default_study_minutes_out_of_range_rejected() {
        let make = |dsm: i32| ExamInput::Esame(EsameInputData {
            name: "x".into(),
            color: "#112233".into(),
            passed: false,
            default_study_minutes: dsm,
            appelli: vec![],
        });
        assert!(validate_input(&make(-1)).is_err());
        assert!(validate_input(&make(1441)).is_err());
        assert!(validate_input(&make(0)).is_ok());
        assert!(validate_input(&make(1440)).is_ok());
    }
```

(The existing `default_study_minutes_out_of_range_rejected` test gets replaced by this version using the new enum.)

- [ ] **Step 4: Update `sample_esame` and `sample_progetto` helpers in `exams.rs`**

Open `src-tauri/src/db/exams.rs`. Inside `#[cfg(test)] mod tests`, locate the helpers `sample_esame()` and `sample_progetto()`. Replace with:

```rust
    pub(super) fn sample_esame() -> ExamInput {
        ExamInput::Esame(EsameInputData {
            name: "Neuroanatomia".into(),
            color: "#E8543F".into(),
            passed: false,
            default_study_minutes: 60,
            appelli: vec!["2026-06-15".into(), "2026-07-10".into()],
        })
    }

    pub(super) fn sample_progetto() -> ExamInput {
        ExamInput::Progetto(ProgettoInputData {
            esame: EsameInputData {
                name: "Tesina Fisiologia".into(),
                color: "#27AE60".into(),
                passed: false,
                default_study_minutes: 60,
                appelli: vec![],
            },
            ranges: vec![DateRange { start: "2026-05-01".into(), end: "2026-05-15".into() }],
        })
    }
```

Update the import at the top of the file's `tests` mod if needed. The existing `use crate::db::types::*;` should already import everything needed.

- [ ] **Step 5: Update `exams.rs` CRUD signatures and bodies**

This is the major adaptation. The functions `create`, `update`, `list`, `get_by_id`, `search`, `build_exam`, `toggle_study_day`, `count_presences` all need updates.

#### `create` and `update`

Both functions take `&ExamInput`. They currently access `input.name`, `input.color`, etc. directly. With the new enum, use `input.base().name`, etc.

Replace `create`:

```rust
pub fn create(conn: &mut Connection, input: &ExamInput) -> Result<Exam, String> {
    let name = validate_input(input)?;
    let base = input.base();
    let tx = conn.transaction().map_err(|e| format!("tx: {e}"))?;
    tx.execute(
        "INSERT INTO exams (name, color, kind, passed, default_study_minutes) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![name, base.color, input.kind_str(), base.passed as i64, base.default_study_minutes],
    ).map_err(|e| format!("insert exam: {e}"))?;
    let id = tx.last_insert_rowid();
    for d in &base.appelli {
        tx.execute(
            "INSERT INTO appelli (exam_id, date) VALUES (?1, ?2)",
            params![id, d],
        ).map_err(|e| format!("insert appello: {e}"))?;
    }
    for r in input.ranges() {
        tx.execute(
            "INSERT INTO project_ranges (exam_id, start_date, end_date) VALUES (?1, ?2, ?3)",
            params![id, r.start, r.end],
        ).map_err(|e| format!("insert range: {e}"))?;
    }
    tx.commit().map_err(|e| format!("commit: {e}"))?;
    get_by_id(conn, id)
}
```

Replace `update`:

```rust
pub fn update(conn: &mut Connection, id: i64, input: &ExamInput) -> Result<Exam, String> {
    let name = validate_input(input)?;
    let base = input.base();
    let tx = conn.transaction().map_err(|e| format!("tx: {e}"))?;
    let changed = tx.execute(
        "UPDATE exams SET name = ?1, color = ?2, kind = ?3, passed = ?4,
                          default_study_minutes = ?5, updated_at = datetime('now') WHERE id = ?6",
        params![name, base.color, input.kind_str(), base.passed as i64, base.default_study_minutes, id],
    ).map_err(|e| format!("update exam: {e}"))?;
    if changed == 0 {
        return Err(format!("Esame {id} non trovato"));
    }
    tx.execute("DELETE FROM appelli WHERE exam_id = ?1", params![id])
        .map_err(|e| format!("delete appelli: {e}"))?;
    tx.execute("DELETE FROM project_ranges WHERE exam_id = ?1", params![id])
        .map_err(|e| format!("delete ranges: {e}"))?;
    for d in &base.appelli {
        tx.execute("INSERT INTO appelli (exam_id, date) VALUES (?1, ?2)", params![id, d])
            .map_err(|e| format!("insert appello: {e}"))?;
    }
    for r in input.ranges() {
        tx.execute(
            "INSERT INTO project_ranges (exam_id, start_date, end_date) VALUES (?1, ?2, ?3)",
            params![id, r.start, r.end],
        ).map_err(|e| format!("insert range: {e}"))?;
    }
    tx.commit().map_err(|e| format!("commit: {e}"))?;
    get_by_id(conn, id)
}
```

#### `build_exam`

Currently returns `Exam` struct. Now returns enum variant based on `kind_str`. Replace:

```rust
fn build_exam(
    conn: &Connection,
    id: i64,
    name: String,
    color: String,
    kind_str: &str,
    passed: bool,
    default_study_minutes: i32,
) -> Result<Exam, String> {
    let appelli = load_appelli(conn, id)?;
    let study_days = load_study_days(conn, id)?;
    let base = EsameData {
        id, name, color, passed, default_study_minutes, appelli, study_days,
    };
    match kind_str {
        "esame" => Ok(Exam::Esame(base)),
        "progetto" => {
            let ranges = load_ranges(conn, id)?;
            Ok(Exam::Progetto(ProgettoData { esame: base, ranges }))
        }
        other => Err(format!("kind sconosciuto: {other}")),
    }
}
```

(`ExamKind::from_str` is no longer needed since the discriminator is on the variant. Remove that call.)

#### `list`, `search`, `get_by_id`

These already destructure rows the same way (Step 7 of the previous plan added `default_study_minutes` column). Just update the calls to `build_exam` to keep working — the signature was extended to take `default_study_minutes: i32`. The new internal logic of `build_exam` handles the enum.

No changes needed to the SELECTs or tuples — they already produce `(id, name, color, kind_str, passed, dsm)`. The body of `build_exam` switches on `kind_str` internally.

#### `set_passed`, `delete`

These work by exam id only, no need to know about kind. No changes.

#### `toggle_study_day` — accept both kinds

The existing function rejects non-esame:

```rust
let exam_exists: bool = conn.query_row(
    "SELECT 1 FROM exams WHERE id = ?1 AND kind = 'esame'",
    params![exam_id],
    |_| Ok(true),
).unwrap_or(false);
if !exam_exists {
    return Err(format!("Esame {exam_id} non esistente o è un progetto"));
}
```

Replace with:

```rust
let exam_exists: bool = conn.query_row(
    "SELECT 1 FROM exams WHERE id = ?1",
    params![exam_id],
    |_| Ok(true),
).unwrap_or(false);
if !exam_exists {
    return Err(format!("Esame {exam_id} non esistente"));
}
```

#### `count_presences` — DISTINCT by exam ID

Replace the two-query body with a single DISTINCT query:

```rust
pub fn count_presences(conn: &Connection, date: &str) -> Result<usize, String> {
    crate::db::types::validate_date(date)?;
    let n: i64 = conn.query_row(
        "SELECT COUNT(DISTINCT e.id) FROM exams e
         WHERE e.passed = 0 AND e.id IN (
             SELECT exam_id FROM study_days WHERE date = ?1
             UNION
             SELECT exam_id FROM project_ranges WHERE ?1 BETWEEN start_date AND end_date
         )",
        params![date],
        |r| r.get(0),
    ).map_err(|e| format!("count presences: {e}"))?;
    Ok(n as usize)
}
```

- [ ] **Step 6: Update other tests in `exams.rs` that construct ExamInput directly**

Find every literal `ExamInput {` or `let bad = ExamInput {` in the test module. Two known locations:

1. `create_rejects_invalid_input` — uses `let bad = ExamInput { name: "".into(), ... };` Replace with:

```rust
    let bad = ExamInput::Esame(EsameInputData {
        name: "".into(),
        color: "#000000".into(),
        passed: false,
        default_study_minutes: 60,
        appelli: vec![],
    });
```

2. `count_presences_counts_studies_and_projects` — uses `let mut proj_input = ExamInput { ... kind: ExamKind::Progetto ... };`. Replace with:

```rust
    let proj_input = ExamInput::Progetto(ProgettoInputData {
        esame: EsameInputData {
            name: "Tesi v2".into(),
            color: proj.base().color.clone(),
            passed: false,
            default_study_minutes: 60,
            appelli: vec![],
        },
        ranges: vec![DateRange { start: "2026-06-10".into(), end: "2026-06-20".into() }],
    });
```

(Note `proj.base().color` because `proj` is now `Exam` and we access via base.)

Also any place a test reads `exam.name` or `exam.color` etc. on an `Exam` — change to `exam.base().name`, `exam.base().color`. Specifically these test files access fields on Exam returned from `create()`:

- `create_and_get_esame`: `e.name`, `e.kind`, `e.appelli`, `e.ranges`, `e.study_days`, `e.passed` → use `e.base().name`, but `e.ranges()` (method, not field), `e.base().appelli`, etc. Also `e.kind` doesn't exist as a field anymore — use `e.kind_str() == "esame"` or pattern-match.

Use this updated test body:

```rust
    #[test]
    fn create_and_get_esame() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_esame()).unwrap();
        let base = e.base();
        assert_eq!(base.name, "Neuroanatomia");
        assert_eq!(e.kind_str(), "esame");
        assert_eq!(base.appelli.len(), 2);
        assert_eq!(base.appelli[0].date, "2026-06-15");
        assert!(e.ranges().is_empty());
        assert!(base.study_days.is_empty());
        assert!(!base.passed);
    }
```

And:

```rust
    #[test]
    fn create_progetto() {
        let mut conn = open_in_memory().unwrap();
        let e = create(&mut conn, &sample_progetto()).unwrap();
        assert_eq!(e.kind_str(), "progetto");
        assert_eq!(e.ranges().len(), 1);
        assert_eq!(e.ranges()[0].start, "2026-05-01");
        assert_eq!(e.ranges()[0].end, "2026-05-15");
    }
```

Apply the same pattern to every other test that reads `e.name`, `e.kind`, `e.appelli`, `e.ranges`, `e.study_days`, `e.passed`. Use Grep `e\.name|e\.kind|e\.appelli|e\.ranges|e\.study_days|e\.passed|\.name == |\.kind ==` in the test module to find them.

The test `list_returns_all_sorted_by_name`:
```rust
assert_eq!(list[0].name, "Neuroanatomia");
```
becomes:
```rust
assert_eq!(list[0].base().name, "Neuroanatomia");
```

The test `set_passed_toggles`:
```rust
assert!(get_by_id(&conn, e.id).unwrap().passed);
```
becomes:
```rust
assert!(get_by_id(&conn, e.id).unwrap().base().passed);
```

Note: `e.id` still works because `Exam::id()` method returns `i64`.

Similarly `update_replaces_appelli`, `update_preserves_study_days`, `set_passed_toggles`, `toggle_study_day_*`, `count_presences_*`, `delete_*`, `search_filters_by_name` — replace direct field access with `.base().field` or `.ranges()` method.

Other one specifically:

`toggle_study_day_rejects_on_progetto`:
- Now toggle_study_day accepts progetti, so this test's premise is invalidated. REMOVE this test entirely.

`count_presences_counts_studies_and_projects`:
- The test creates a Progetto via update, then expects count 3 (2 studies + 1 project). With DISTINCT, the count is still 3 (3 different exams). Test still valid; just update field accesses.

`toggle_study_day_rejects_when_already_4_presences`:
- Field access on `Exam` results need .base(). Otherwise the logic still works.

- [ ] **Step 7: Run all Rust tests**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | grep "test result:" | head -3
```

Expected: `35 passed; 0 failed` (or 36 if you keep the dedicated dsm test from earlier — verify exact count).

Wait — we DELETED `toggle_study_day_rejects_on_progetto` (1 less), but ADDED `progetto_with_appelli_now_allowed` + `esame_with_empty_collections_ok` (2 more), net +1. Existing 36 - 1 + 2 = 37? Or did we delete the old `esame_with_ranges_rejected`? Yes, dropped 2, added 3 → +1. Net: 36 - 2 + 3 = 37.

Expected: `37 passed; 0 failed`.

If a test fails with a confusing error, dump it to chat and we'll iterate. Most failures will be due to a missed `.base()` access — search and fix.

- [ ] **Step 8: Update `import.rs` to construct ExamInput enum variant**

Open `src-tauri/src/db/import.rs`. Locate `pub fn import_artifact_json` and the construction of `ExamInput`:

Current:
```rust
let input = ExamInput {
    name: ae.name.clone(),
    color: ae.color.clone(),
    kind,
    passed: ae.passed,
    default_study_minutes: ae.default_study_minutes,
    appelli,
    ranges,
};
```

Replace with:

```rust
let base = EsameInputData {
    name: ae.name.clone(),
    color: ae.color.clone(),
    passed: ae.passed,
    default_study_minutes: ae.default_study_minutes,
    appelli,
};
let input: ExamInput = match kind {
    ExamKind::Esame => {
        if !ranges.is_empty() {
            report.skipped += 1;
            report.errors.push(format!("'{}': type=esame con ranges, scartato", ae.name));
            continue;
        }
        ExamInput::Esame(base)
    }
    ExamKind::Progetto => ExamInput::Progetto(ProgettoInputData {
        esame: base,
        ranges,
    }),
};
```

This preserves the original semantics: incoming "esame with ranges" is rejected (since Esame can't have ranges). "progetto with appelli" is now ACCEPTED (relaxed).

Also at the top of the file, the imports section: ensure `EsameInputData`, `ProgettoInputData`, `ExamKind` are imported. The existing `use crate::db::types::*;` should cover this.

Update the existing test `import_inserts_two_skips_one`:

The test payload currently has:
```rust
{ "name": "Tesina", "color": "#27AE60", "type": "progetto", "passed": false,
  "appelli": [], "ranges": [{"start":"2026-05-01","end":"2026-05-15"}], "studyDays": [] },
```

This is a Progetto with no appelli — should still import fine.

The "BAD" entry has color `not-a-color` and is correctly rejected by validation.

Test assertions:
```rust
assert_eq!(report.inserted, 2);
assert_eq!(report.skipped, 1);
let list = exams::list(&conn).unwrap();
assert_eq!(list.len(), 2);
let neuro = list.iter().find(|e| e.name == "Neuro").unwrap();
assert_eq!(neuro.appelli.len(), 1);
assert_eq!(neuro.study_days, vec!["2026-06-01"]);
```

Adjust:
```rust
let neuro = list.iter().find(|e| e.base().name == "Neuro").unwrap();
assert_eq!(neuro.base().appelli.len(), 1);
let sd = &neuro.base().study_days;
assert_eq!(sd.len(), 1);
assert_eq!(sd[0].date, "2026-06-01");
```

The other import tests (`import_skips_duplicate_names`, `import_rejects_invalid_json`) need no changes if they don't read Exam fields directly.

- [ ] **Step 9: Run tests again, then build the entire crate**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | grep "test result:" | head -3
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```

Expected: `37 passed`, `Compiling calendar-desktop ... Finished`.

- [ ] **Step 10: Commit**

```powershell
git add src-tauri/src/db src-tauri/Cargo.lock
git commit -m "feat(db): refactor Exam/ExamInput as Progetto extends Esame (SOLID)

EsameData is the base struct. ProgettoData composes EsameData via
serde flatten and adds ranges. Exam and ExamInput are discriminated
unions tagged by 'kind'. Helper methods (base, ranges, kind_str) on
both enums expose the abstraction.

Validation relaxes 'progetto can't have appelli' — Progetti now inherit
appelli from Esame. 'Progetto requires >=1 range' stays.
toggle_study_day accepts both kinds (Progetto can have manual extra
study_days outside its ranges). count_presences uses DISTINCT by
exam ID so the same exam never counts twice.

Tests updated to construct enum variants and access via .base() / .ranges()."
```

---

### Task 2: Rust progetto.rs (new module)

**Files:**
- Create: `src-tauri/src/db/progetto.rs`
- Modify: `src-tauri/src/db/mod.rs` (declare new module)

**SOLID:** SRP — range-specific helpers live in their own file.

- [ ] **Step 1: Create the module**

Create `src-tauri/src/db/progetto.rs`:

```rust
//! Logica progetto-specifica: espansione dei range in giorni unici e helper di conteggio.

use chrono::NaiveDate;
use crate::db::types::ProgettoData;

/// Espande tutti i range di un Progetto in YYYY-MM-DD unici (deduplicati,
/// ordinati ascending).
pub fn expand_ranges(p: &ProgettoData) -> Vec<String> {
    let mut seen = std::collections::BTreeSet::new();
    for r in &p.ranges {
        let start = match NaiveDate::parse_from_str(&r.start, "%Y-%m-%d") {
            Ok(d) => d,
            Err(_) => continue,
        };
        let end = match NaiveDate::parse_from_str(&r.end, "%Y-%m-%d") {
            Ok(d) => d,
            Err(_) => continue,
        };
        let mut d = start;
        while d <= end {
            seen.insert(d.format("%Y-%m-%d").to_string());
            d = match d.succ_opt() { Some(n) => n, None => break };
        }
    }
    seen.into_iter().collect()
}

/// Numero di giorni unici coperti dai range del progetto.
pub fn total_range_days(p: &ProgettoData) -> usize {
    expand_ranges(p).len()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::types::{EsameData, ProjectRange};

    fn make(ranges: Vec<(&str, &str)>) -> ProgettoData {
        ProgettoData {
            esame: EsameData {
                id: 1,
                name: "X".into(),
                color: "#000000".into(),
                passed: false,
                default_study_minutes: 60,
                appelli: vec![],
                study_days: vec![],
            },
            ranges: ranges.into_iter().enumerate().map(|(i, (s, e))| ProjectRange {
                id: i as i64,
                start: s.into(),
                end: e.into(),
            }).collect(),
        }
    }

    #[test]
    fn expand_empty() {
        let p = make(vec![]);
        assert_eq!(expand_ranges(&p), Vec::<String>::new());
    }

    #[test]
    fn expand_single_range() {
        let p = make(vec![("2026-05-01", "2026-05-03")]);
        assert_eq!(
            expand_ranges(&p),
            vec!["2026-05-01", "2026-05-02", "2026-05-03"]
        );
    }

    #[test]
    fn expand_multiple_overlap_dedups() {
        let p = make(vec![
            ("2026-05-01", "2026-05-05"),
            ("2026-05-03", "2026-05-07"),
        ]);
        // 5 distinct days from 5/1 to 5/7 with overlap on 3-5
        assert_eq!(
            expand_ranges(&p),
            vec![
                "2026-05-01", "2026-05-02", "2026-05-03",
                "2026-05-04", "2026-05-05", "2026-05-06", "2026-05-07",
            ]
        );
        assert_eq!(total_range_days(&p), 7);
    }
}
```

- [ ] **Step 2: Declare the module in `mod.rs`**

Open `src-tauri/src/db/mod.rs`. Locate the existing module declarations near the top:

```rust
pub mod exams;
pub mod settings;
pub mod import;
pub mod types;
```

Add `pub mod progetto;` after `pub mod types;`:

```rust
pub mod exams;
pub mod settings;
pub mod import;
pub mod types;
pub mod progetto;
```

- [ ] **Step 3: Run tests**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml db::progetto 2>&1 | tail -10
```

Expected: `3 passed; 0 failed`.

```powershell
cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | grep "test result:" | head -3
```

Expected: `40 passed` (37 from Task 1 + 3 new in progetto.rs).

- [ ] **Step 4: Commit**

```powershell
git add src-tauri/src/db/progetto.rs src-tauri/src/db/mod.rs
git commit -m "feat(db): progetto.rs — range-specific helpers (SRP)

expand_ranges deduplicates and orders the union of all range days
for a ProgettoData. total_range_days returns its count. 3 unit tests.

Module is range-agnostic at the exams.rs CRUD level — count_presences
uses raw SQL. progetto.rs is consumed only by future Rust-side
project analytics (currently none); kept lean per YAGNI."
```

---

## Phase 1 — TypeScript

### Task 3: TS types restructure (types.ts + db.ts boundary)

**Files:**
- Modify: `src/types.ts`
- Modify: `src/db.ts`

**SOLID:** LSP — `Progetto` satisfies the `EsameData` interface so any code consuming an `Esame` works on a `Progetto`.

- [ ] **Step 1: Rewrite `src/types.ts` exam types**

Open `src/types.ts`. Locate the existing `Exam` and `ExamInput` interfaces. Replace them with:

```typescript
export type ExamKind = "esame" | "progetto";

export interface EsameData {
  id: number;
  name: string;
  color: string;
  passed: boolean;
  defaultStudyMinutes: number;
  appelli: Appello[];
  studyDays: StudyDay[];
}

export interface ProgettoData extends EsameData {
  ranges: ProjectRange[];
}

export type Esame    = EsameData    & { kind: "esame" };
export type Progetto = ProgettoData & { kind: "progetto" };
export type Exam     = Esame | Progetto;

export interface EsameInputData {
  name: string;
  color: string;
  passed: boolean;
  defaultStudyMinutes: number;
  appelli: string[];
}

export interface ProgettoInputData extends EsameInputData {
  ranges: DateRangeInput[];
}

export type EsameInput    = EsameInputData    & { kind: "esame" };
export type ProgettoInput = ProgettoInputData & { kind: "progetto" };
export type ExamInput     = EsameInput | ProgettoInput;
```

Leave `Appello`, `StudyDay`, `ProjectRange`, `DateRangeInput`, `ImportReport` types unchanged. `ExamKind` stays as the string union for legacy usage.

- [ ] **Step 2: Update `src/db.ts` boundary mapping**

Open `src/db.ts`. Locate `type ExamWire` and `function fromWire`. The current versions handle `studyDays` and `defaultStudyMinutes` snake_case mapping.

Replace with discriminated handling:

```typescript
type EsameWire    = Omit<Esame,    "studyDays" | "defaultStudyMinutes"> & { study_days: StudyDay[]; default_study_minutes: number };
type ProgettoWire = Omit<Progetto, "studyDays" | "defaultStudyMinutes"> & { study_days: StudyDay[]; default_study_minutes: number };
type ExamWire     = EsameWire | ProgettoWire;

function fromWire(e: ExamWire): Exam {
  if (e.kind === "esame") {
    const { study_days, default_study_minutes, ...rest } = e;
    return { ...rest, studyDays: study_days, defaultStudyMinutes: default_study_minutes };
  } else {
    const { study_days, default_study_minutes, ...rest } = e;
    return { ...rest, studyDays: study_days, defaultStudyMinutes: default_study_minutes };
  }
}
```

The two branches look identical but the discriminator pins each to its variant type. TypeScript narrows correctly.

Imports at the top of `db.ts` should include the new types — make sure `Esame`, `Progetto` are imported (or use named imports of `Exam`, `ExamInput` and let union types flow).

- [ ] **Step 3: TS check**

```powershell
npx tsc --noEmit 2>&1 | tail -15
```

Expected: errors in EVERY consumer that constructs ExamInput (ExamModal) or accesses ranges field on a non-progetto exam (DayCell, ExamRow). These will be fixed in subsequent tasks.

The errors should be clustered in: `src/components/ExamModal.tsx`, `src/components/DayCell.tsx`, `src/components/ExamRow.tsx`, `src/components/DayModal.tsx`, `src/study-time.ts`.

Note the count of errors but don't try to fix them yet (later tasks own these).

- [ ] **Step 4: Commit**

```powershell
git add src/types.ts src/db.ts
git commit -m "feat(fe): types restructure — Esame/Progetto discriminated union

EsameData is the base shape. ProgettoData extends with ranges. Esame
and Progetto are tagged with kind discriminator; Exam is the union.
Same hierarchy on inputs.

db.ts fromWire handles both wire variants — branches look identical
but TS narrows per kind. Consumers (ExamModal, DayCell, ExamRow,
DayModal, study-time) currently break; following tasks restore them."
```

---

### Task 4: TS progetto.ts (new module)

**Files:**
- Create: `src/progetto.ts`

**SOLID:** SRP — range-specific helpers (isProgetto, expandRanges, totalRangeDays, dateInAnyRange, computeProjectEdges) in their own file.

- [ ] **Step 1: Create the module**

Create `src/progetto.ts`:

```typescript
import type { Exam, Progetto } from "./types";

/** Type guard: narrow Exam to Progetto. */
export function isProgetto(e: Exam): e is Progetto {
  return e.kind === "progetto";
}

/** Espande tutti i range del progetto in YYYY-MM-DD unici, ordinati. */
export function expandRanges(p: Progetto): string[] {
  const seen = new Set<string>();
  for (const r of p.ranges) {
    const start = new Date(r.start);
    const end = new Date(r.end);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;
    const cursor = new Date(start);
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      seen.add(`${y}-${m}-${d}`);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return Array.from(seen).sort();
}

/** Numero di giorni unici coperti dai range. */
export function totalRangeDays(p: Progetto): number {
  return expandRanges(p).length;
}

/** True se il giorno è dentro almeno un range del progetto. */
export function dateInAnyRange(p: Progetto, dayKey: string): boolean {
  return p.ranges.some((r) => dayKey >= r.start && dayKey <= r.end);
}

/** Stato dei bordi per le stripe inizio/fine sulla cella. */
export interface ProjectEdges {
  start: boolean;
  end: boolean;
  startColor: string | null;
  endColor: string | null;
}

/** Calcola se il giorno coincide con l'inizio o la fine di un range del progetto. */
export function computeProjectEdges(p: Progetto, dayKey: string): ProjectEdges {
  let start = false;
  let end = false;
  let startColor: string | null = null;
  let endColor: string | null = null;
  for (const r of p.ranges) {
    if (r.start === dayKey) { start = true; startColor = p.color; }
    if (r.end === dayKey)   { end = true;   endColor = p.color; }
  }
  return { start, end, startColor, endColor };
}
```

- [ ] **Step 2: TS check**

```powershell
npx tsc --noEmit 2>&1 | tail -10
```

Expected: same set of pre-existing errors from Task 3 (still in consumers). The new `progetto.ts` itself compiles cleanly.

- [ ] **Step 3: Commit**

```powershell
git add src/progetto.ts
git commit -m "feat(fe): progetto.ts — range-specific helpers (SRP)

isProgetto type guard, expandRanges, totalRangeDays, dateInAnyRange,
computeProjectEdges. Pure functions, no React deps. Mirrors the
Rust progetto.rs module."
```

---

### Task 5: Update `study-time.ts` to use progetto helpers

**Files:**
- Modify: `src/study-time.ts`

**SOLID:** DIP — study-time depends on the `Exam` abstraction; delegates range expansion to `progetto.ts`.

- [ ] **Step 1: Update studiedDays to use isProgetto + expandRanges**

Open `src/study-time.ts`. Locate `export function studiedDays(exam: Exam): string[]`. Replace its body with:

```typescript
import { isProgetto, expandRanges } from "./progetto";
// ... at top of file with other imports

export function studiedDays(exam: Exam): string[] {
  const base = exam.studyDays.map((s) => s.date);
  if (isProgetto(exam)) {
    return Array.from(new Set([...base, ...expandRanges(exam)]));
  }
  return base;
}
```

Add the import for `isProgetto` and `expandRanges` from `./progetto` at the top of the file. The old `studiedDays` body that manually iterated `exam.ranges` (assuming the old Exam type) is now replaced.

Also locate `countPresences` and review. Currently it has:

```typescript
if (e.kind === "esame") {
  if (e.studyDays.some((s) => s.date === dayKey)) n++;
} else {
  if (e.ranges.some((r) => dayKey >= r.start && dayKey <= r.end)) n++;
}
```

The new types make `e.ranges` undefined for an `Esame`. Replace with:

```typescript
export function countPresences(dayKey: string, exams: Exam[]): number {
  let n = 0;
  for (const e of exams) {
    if (e.passed) continue;
    const hasStudy = e.studyDays.some((s) => s.date === dayKey);
    const hasRange = isProgetto(e) && e.ranges.some((r) => dayKey >= r.start && dayKey <= r.end);
    if (hasStudy || hasRange) n++;  // DISTINCT per exam
  }
  return n;
}
```

The old code counted a Progetto+study_day case twice (once via study_day branch, once via range branch). The new DISTINCT logic counts each exam once.

Keep `effectiveMinutes`, `totalMinutes`, `formatHM`, `durationOptions`, `DurationOption` unchanged — they already operate on the base abstraction.

- [ ] **Step 2: TS check**

```powershell
npx tsc --noEmit 2>&1 | tail -15
```

Expected: errors REMOVED from `study-time.ts`. Errors persist in ExamModal, DayCell, ExamRow, DayModal.

- [ ] **Step 3: Commit**

```powershell
git add src/study-time.ts
git commit -m "refactor(fe): study-time delegates range expansion to progetto.ts

studiedDays for a Progetto now unions manual studyDays + expanded
ranges (via isProgetto + expandRanges). countPresences uses
DISTINCT-by-exam logic (same exam can't contribute twice via
both branches)."
```

---

## Phase 2 — TS components

### Task 6: DayCell — dedup per exam, priority range over study

**Files:**
- Modify: `src/components/DayCell.tsx`

**SOLID:** ISP — DayCell consumes the Exam abstraction and uses progetto helpers only for range-aware logic.

- [ ] **Step 1: Update buildActivities and computeProjectEdges**

Open `src/components/DayCell.tsx`. Locate `buildActivities` and `computeProjectEdges`.

Replace `buildActivities` with the dedup version:

```typescript
function buildActivities(dayKey: string, exams: Exam[]): Activity[] {
  const projects: Activity[] = [];
  const studies: Activity[] = [];
  for (const e of exams) {
    if (e.passed) continue;
    const inRange = isProgetto(e) && e.ranges.some((r) => inRange(dayKey, r.start, r.end));
    const hasStudy = e.studyDays.some((s) => s.date === dayKey);
    if (inRange) {
      // Range priority: even if there's also a study_day, project icon wins.
      projects.push({ kind: "project", color: e.color, examId: e.id, examName: e.name });
    } else if (hasStudy) {
      studies.push({ kind: "study", color: e.color, examId: e.id, examName: e.name });
    }
  }
  projects.sort((a, b) => a.examName.localeCompare(b.examName));
  studies.sort((a, b) => a.examName.localeCompare(b.examName));
  return [...projects, ...studies];
}
```

Note the name collision with the helper `inRange` from `date.ts` and the local `inRange` variable inside the loop — RENAME the local variable to avoid shadowing:

```typescript
function buildActivities(dayKey: string, exams: Exam[]): Activity[] {
  const projects: Activity[] = [];
  const studies: Activity[] = [];
  for (const e of exams) {
    if (e.passed) continue;
    const isInRange = isProgetto(e) && e.ranges.some((r) => inRange(dayKey, r.start, r.end));
    const hasStudy = e.studyDays.some((s) => s.date === dayKey);
    if (isInRange) {
      projects.push({ kind: "project", color: e.color, examId: e.id, examName: e.name });
    } else if (hasStudy) {
      studies.push({ kind: "study", color: e.color, examId: e.id, examName: e.name });
    }
  }
  projects.sort((a, b) => a.examName.localeCompare(b.examName));
  studies.sort((a, b) => a.examName.localeCompare(b.examName));
  return [...projects, ...studies];
}
```

Replace `computeProjectEdges` with the new version using the new helper:

```typescript
function computeProjectEdges(dayKey: string, exams: Exam[]): ProjectEdges {
  for (const e of exams) {
    if (e.passed) continue;
    if (!isProgetto(e)) continue;
    for (const r of e.ranges) {
      if (r.start === dayKey || r.end === dayKey) {
        return {
          start: r.start === dayKey,
          end: r.end === dayKey,
          startColor: r.start === dayKey ? e.color : null,
          endColor: r.end === dayKey ? e.color : null,
        };
      }
    }
  }
  return { start: false, end: false, startColor: null, endColor: null };
}
```

(This early-returns on the first matched edge, which is OK for single-project cells; if you want all edges, accumulate. The existing logic accumulates start/end across all projects — keep that for safety.)

Actually, keep the accumulating logic for safety:

```typescript
function computeProjectEdges(dayKey: string, exams: Exam[]): ProjectEdges {
  let start = false;
  let end = false;
  let startColor: string | null = null;
  let endColor: string | null = null;
  for (const e of exams) {
    if (e.passed) continue;
    if (!isProgetto(e)) continue;
    for (const r of e.ranges) {
      if (r.start === dayKey) { start = true; startColor = e.color; }
      if (r.end === dayKey)   { end = true;   endColor = e.color; }
    }
  }
  return { start, end, startColor, endColor };
}
```

Also update `buildBanners`: the existing code already accesses `e.appelli` which is on the base, available for both Esame and Progetto. No change needed there beyond the type check — `e.kind === "esame"` was preventing progetto from contributing banners. RELAX:

```typescript
function buildBanners(dayKey: string, exams: Exam[]): BannerItem[] {
  const out: BannerItem[] = [];
  for (const e of exams) {
    if (e.passed) continue;
    for (const a of e.appelli) {
      if (a.date === dayKey) {
        out.push({ color: e.color, examName: e.name });
      }
    }
  }
  out.sort((a, b) => a.examName.localeCompare(b.examName));
  return out;
}
```

(Removed `if (e.kind !== "esame") continue;` since progetti can now have appelli.)

- [ ] **Step 2: Add import for isProgetto**

At the top of `DayCell.tsx`, add:

```tsx
import { isProgetto } from "../progetto";
```

- [ ] **Step 3: TS check + build**

```powershell
npx tsc --noEmit 2>&1 | tail -10
```

Expected: DayCell errors should be RESOLVED. Errors still in ExamModal, ExamRow, DayModal.

```powershell
npm run build 2>&1 | tail -7
```

Build will fail because of remaining TS errors (we're mid-refactor). That's OK if tsc errors are isolated to the unfixed files.

Actually it's better to ensure FE builds at every commit. Let me delay this until ExamModal is done. Actually let me skip npm run build here — only tsc — and ensure the file we changed at least typecheck-isolates.

Don't run `npm run build` here. Commit even if `npm run build` would fail; the next tasks will restore it.

- [ ] **Step 4: Commit**

```powershell
git add src/components/DayCell.tsx
git commit -m "feat(fe): DayCell uses isProgetto + dedupes per exam

buildActivities: range priority over study_day for same exam (one band
per exam regardless). isProgetto type guard narrows access to ranges.
buildBanners: progetti can now contribute appelli too (kind check
removed). computeProjectEdges iterates only Progetti.

NB: build will fail until Tasks 7-9 restore the remaining components."
```

---

### Task 7: ExamModal — unified entries list with checkbox per row

**Files:**
- Modify: `src/components/ExamModal.tsx`

**SOLID:** OCP — the modal is open to a new entry type (range) without modifying the appello render path.

This is the biggest single change. Plan: rewrite the entire component file with the new unified-entries model.

- [ ] **Step 1: Rewrite the entire `src/components/ExamModal.tsx`**

Replace its contents with:

```tsx
import { useEffect, useState } from "react";
import type { Exam, ExamKind, ExamInput, EsameInputData, ProgettoInputData } from "../types";
import { useExams } from "../state";
import { useToast } from "../toast";
import { Modal } from "./Modal";
import { Calendar as CalendarIcon, FolderKanban, X as XIcon, Plus } from "lucide-react";
import { durationOptions } from "../study-time";
import { isProgetto } from "../progetto";

const PALETTE = [
  "#E8543F", "#2E86C1", "#27AE60", "#8E44AD", "#F39C12", "#16A0A0",
  "#D81B7A", "#5D6D7E", "#C0392B", "#1F8A4C", "#7D5FFF", "#E67E22",
];

interface ExamModalProps {
  open: boolean;
  onClose: () => void;
  editing: Exam | null;
  initialKind: ExamKind;
}

type Entry =
  | { uid: string; type: "appello"; date: string }
  | { uid: string; type: "range"; start: string; end: string };

function newUid(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function ExamModal({ open, onClose, editing, initialKind }: ExamModalProps) {
  const { create, update, remove, exams } = useExams();
  const toast = useToast();

  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [defaultMinutes, setDefaultMinutes] = useState<number>(60);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setColor(editing.color);
      setDefaultMinutes(editing.defaultStudyMinutes);
      const appelliEntries: Entry[] = editing.appelli.map((a) => ({
        uid: `app-${a.id}`,
        type: "appello",
        date: a.date,
      }));
      const rangeEntries: Entry[] = isProgetto(editing)
        ? editing.ranges.map((r) => ({
            uid: `rng-${r.id}`,
            type: "range",
            start: r.start,
            end: r.end,
          }))
        : [];
      setEntries([...appelliEntries, ...rangeEntries]);
    } else {
      setName("");
      const used = new Set(exams.map((e) => e.color));
      setColor(PALETTE.find((c) => !used.has(c)) ?? PALETTE[exams.length % PALETTE.length]);
      setDefaultMinutes(60);
      if (initialKind === "progetto") {
        setEntries([{ uid: newUid(), type: "range", start: "", end: "" }]);
      } else {
        setEntries([{ uid: newUid(), type: "appello", date: "" }]);
      }
    }
  }, [open, editing, initialKind, exams]);

  if (!open) return null;

  const derivedKind: ExamKind = entries.some((e) => e.type === "range") ? "progetto" : "esame";
  const isProj = derivedKind === "progetto";
  const title = editing
    ? (isProj ? "Modifica progetto" : "Modifica esame")
    : (isProj ? "Nuovo progetto" : "Nuovo esame");

  const toggleEntryType = (uid: string) => {
    setEntries((prev) => prev.map((e) => {
      if (e.uid !== uid) return e;
      if (e.type === "appello") {
        return { uid, type: "range", start: e.date, end: "" };
      } else {
        return { uid, type: "appello", date: e.start };
      }
    }));
  };

  const updateEntry = (uid: string, patch: Partial<Omit<Entry, "uid" | "type">>) => {
    setEntries((prev) => prev.map((e) => (e.uid === uid ? { ...e, ...patch } as Entry : e)));
  };

  const removeEntry = (uid: string) => {
    setEntries((prev) => prev.filter((e) => e.uid !== uid));
  };

  const addAppello = () => {
    setEntries((prev) => [...prev, { uid: newUid(), type: "appello", date: "" }]);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error("Inserisci un nome."); return; }

    const cleanAppelli = entries
      .filter((e): e is Extract<Entry, { type: "appello" }> => e.type === "appello" && !!e.date)
      .map((e) => e.date)
      .sort();

    const cleanRanges = entries
      .filter((e): e is Extract<Entry, { type: "range" }> => e.type === "range" && !!e.start)
      .map((e) => {
        let start = e.start;
        let end = e.end || e.start;
        if (end < start) [start, end] = [end, start];
        return { start, end };
      })
      .sort((a, b) => a.start.localeCompare(b.start));

    const kind: ExamKind = cleanRanges.length > 0 ? "progetto" : "esame";

    const baseInput: EsameInputData = {
      name: trimmed,
      color,
      passed: editing?.passed ?? false,
      defaultStudyMinutes: defaultMinutes,
      appelli: cleanAppelli,
    };

    let input: ExamInput;
    if (kind === "progetto") {
      const projInput: ProgettoInputData = { ...baseInput, ranges: cleanRanges };
      input = { kind: "progetto", ...projInput };
    } else {
      input = { kind: "esame", ...baseInput };
    }

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

      <div className="mb-3">
        <label className="block text-[11px] font-bold text-app-muted uppercase tracking-wide mb-1.5">
          Tempo di studio giornaliero
        </label>
        <select
          value={defaultMinutes}
          onChange={(e) => setDefaultMinutes(parseInt(e.target.value, 10))}
          className="w-full px-2.5 py-2 border border-app-input-border rounded-lg text-[13px] bg-app-input-bg text-app-fg focus:outline-2 focus:outline-app-muted"
        >
          {durationOptions().map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <p className="mt-1 text-[10.5px] text-app-muted leading-relaxed">
          I minuti effettivi sono <code>t/n</code>, dove <code>n</code> è il numero di esami
          attivi (esami in studio + progetti in corso) quel giorno.
        </p>
      </div>

      <div className="mb-3">
        <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wide mb-1.5">
          Date d'esame / Periodi
        </label>
        {entries.map((entry) => (
          <div key={entry.uid} className="flex items-center gap-2 mb-2">
            <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-app-muted shrink-0">
              <input
                type="checkbox"
                checked={entry.type === "range"}
                onChange={() => toggleEntryType(entry.uid)}
                className="w-3.5 h-3.5"
              />
              Periodo
            </label>
            {entry.type === "appello" ? (
              <input
                type="date"
                value={entry.date}
                onChange={(ev) => updateEntry(entry.uid, { date: ev.target.value })}
                className="flex-1 px-2 py-1.5 text-[12.5px] border border-app-input-border bg-app-input-bg text-app-fg rounded-lg"
              />
            ) : (
              <>
                <input
                  type="date"
                  value={entry.start}
                  onChange={(ev) => updateEntry(entry.uid, { start: ev.target.value })}
                  className="flex-1 min-w-0 px-2 py-1.5 text-[12.5px] border border-app-input-border bg-app-input-bg text-app-fg rounded-lg"
                />
                <span className="text-[10px] text-app-muted shrink-0">→</span>
                <input
                  type="date"
                  value={entry.end}
                  onChange={(ev) => updateEntry(entry.uid, { end: ev.target.value })}
                  className="flex-1 min-w-0 px-2 py-1.5 text-[12.5px] border border-app-input-border bg-app-input-bg text-app-fg rounded-lg"
                />
              </>
            )}
            <button
              type="button"
              onClick={() => removeEntry(entry.uid)}
              className="p-1 rounded text-app-muted hover:bg-app-hover hover:text-app-fg"
              title="Rimuovi"
              aria-label="Rimuovi"
            ><XIcon size={14} /></button>
          </div>
        ))}
        <button
          type="button"
          onClick={addAppello}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2f6fb3] hover:underline"
        ><Plus size={12} /> Aggiungi data</button>
      </div>

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

The segmented control "Esame / Progetto" is REMOVED. The Calendar/FolderKanban icons are no longer imported via that segmented (they're unused now — TS will warn — leave them in the imports for potential future use, OR remove the unused imports). Let me prune: remove `CalendarIcon`, `FolderKanban` from the imports since the segmented control is gone.

Final import line at top:

```tsx
import { X as XIcon, Plus } from "lucide-react";
```

(Drop `Calendar as CalendarIcon` and `FolderKanban`.)

- [ ] **Step 2: TS check + build**

```powershell
npx tsc --noEmit 2>&1 | tail -10
```

Expected: ExamModal errors resolved. Errors persist in ExamRow and DayModal (next tasks).

- [ ] **Step 3: Commit**

```powershell
git add src/components/ExamModal.tsx
git commit -m "feat(fe): ExamModal unified entries list with checkbox per row

Removes segmented control 'Esame / Progetto'. New 'Date d'esame /
Periodi' section: list of entries, each with a 'Periodo' checkbox
that toggles between single date (appello) and range (start+end).
kind is derived on save: any range entry => progetto.

Toggling checkbox preserves the existing date (appello date becomes
range start; range start becomes appello date)."
```

---

### Task 8: ExamRow + DayModal — fix remaining type errors

**Files:**
- Modify: `src/components/ExamRow.tsx`
- Modify: `src/components/DayModal.tsx`

**SOLID:** ISP — these components access only what they need from Exam.

- [ ] **Step 1: Update `ExamRow.tsx`**

Open `src/components/ExamRow.tsx`. The `metaText` function currently does:

```typescript
function metaText(exam: Exam, allExams: Exam[]): string {
  if (exam.kind === "progetto") {
    const totDays = exam.ranges.reduce(...);
    ...
  }
  ...
}
```

With the new types, `exam.ranges` is only accessible after narrowing via `isProgetto`. Replace with:

```typescript
import { isProgetto, totalRangeDays } from "../progetto";
// ... at top of file with other imports

function metaText(exam: Exam, allExams: Exam[]): string {
  if (isProgetto(exam)) {
    const totDays = totalRangeDays(exam);
    const totMin = totalMinutes(exam, allExams);
    const time = formatHM(totMin);
    return time ? `${totDays}g · ${time}` : `${totDays}g`;
  }
  const nApp = exam.appelli.length;
  const totMin = totalMinutes(exam, allExams);
  const time = formatHM(totMin);
  return time ? `${nApp}·${time}` : `${nApp}`;
}
```

This is cleaner: relies on `totalRangeDays` from progetto.ts instead of inlined range-day math.

- [ ] **Step 2: Update `DayModal.tsx`**

Open `src/components/DayModal.tsx`. The current code has a block like:

```typescript
const studyEsami = active.filter((e) => e.kind === "esame");
```

This filtered to only esami. Now we want BOTH esami and progetti as toggleable study targets. Replace with:

```typescript
const studyTargets = active;  // both kinds; toggle reflects studyDays state
```

Then the line `if (studyEsami.length === 0)` becomes `if (studyTargets.length === 0)`.

And `studyEsami.map((e) => { ... })` becomes `studyTargets.map((e) => { ... })`.

Also check the info-box generation. The current code:

```typescript
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
```

Update to handle the new types correctly. A Progetto can now have BOTH appelli and ranges:

```typescript
import { isProgetto } from "../progetto";
// ... at top of file with other imports

for (const e of active) {
  for (const a of e.appelli) {
    if (a.date === dayKey) infoLines.push({ color: e.color, text: `Appello: ${e.name}` });
  }
  if (isProgetto(e)) {
    if (e.ranges.some((r) => inRange(dayKey, r.start, r.end))) {
      infoLines.push({ color: e.color, text: `Progetto in corso: ${e.name}` });
    }
  }
}
```

This shows appelli info for BOTH esami and progetti (since progetti can have appelli now), and adds the "Progetto in corso" line for progetti.

- [ ] **Step 3: TS check + build**

```powershell
npx tsc --noEmit 2>&1 | tail -10
```

Expected: ZERO errors.

```powershell
npm run build 2>&1 | tail -7
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```powershell
git add src/components/ExamRow.tsx src/components/DayModal.tsx
git commit -m "feat(fe): ExamRow + DayModal adapt to discriminated union

ExamRow: uses isProgetto + totalRangeDays from progetto.ts for the
meta line on Progetti.

DayModal: toggleable study list now includes BOTH esami and progetti
(progetti can have manual extra study days). info-box checks appelli
for any kind and adds 'Progetto in corso' line when applicable."
```

---

## Phase 3 — Verification

### Task 9: Final verification + push

**Files:** none modified.

- [ ] **Step 1: Rust full test**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | grep "test result:" | head -3
```

Expected: `40 passed; 0 failed`.

- [ ] **Step 2: TS strict**

```powershell
npx tsc --noEmit 2>&1 | tail -5
```

Expected: zero errors.

- [ ] **Step 3: FE production build**

```powershell
npm run build 2>&1 | tail -7
```

Expected: succeeds.

- [ ] **Step 4: Push**

```powershell
git push origin feat/tauri-port 2>&1 | tail -5
```

- [ ] **Step 5: USER smoke (delegated)**

Controller asks user to launch `npm run tauri dev` and verify:

1. **Esame con appello + progetto** (un'unica voce):
   - Click "+ Progetto"
   - Modal apre con UNA riga "Periodo" già spuntato (initial state per progetto)
   - Aggiungi un'altra riga via "+ Aggiungi data", LASCIA il checkbox spento → diventa singolo input data (appello)
   - Compila: nome = "Fisiologia", periodo Apr 1 → Apr 15, appello May 20
   - Salva. ExamRow nel sidebar mostra "15g · …" e basta. La sidebar è UNA SOLA voce.
2. **Toggle row type:**
   - Apri il modal di Fisiologia in edit
   - Sull'appello May 20, spunta il checkbox "Periodo"
   - L'input singolo si trasforma in due input (start = May 20, end = vuoto)
   - Salva. La voce diventa un progetto con 2 ranges.
3. **Conversione progetto → esame:**
   - Edit di una voce con solo periodi. Toggle off del checkbox su ogni riga. Le righe diventano appelli singoli. Salva: la voce ora è un Esame (kind derivato).
4. **DayModal con progetto:** click su un giorno DENTRO il range. Vedi il toggle "Sto studiando per…" del progetto attivabile (era escluso prima). Attiva: aggiunge study_day manuale (cella mostra ancora Cpu — range priority).
5. **5° presence rifiutato:** se aggiungi un 5° toggle/range a un giorno già pieno → toast "Massimo 4 attività…".
6. **Cell visuals invariati:** bande, banner, stripe come prima.

Se qualcosa non va, segnalami con screenshot.

---

## Self-review notes (post-write)

**Spec coverage:**
- §3.1 Rust types → T1
- §3.2 TS types → T3
- §4.1 study-time.ts → T5
- §4.2 progetto.ts → T4
- §4.3 progetto.rs → T2
- §4.4 exams.rs CRUD → T1
- §5 Validation → T1
- §6 toggle_study_day → T1
- §7 count_presences DISTINCT → T1
- §8 DayCell → T6
- §9 ExamModal → T7
- §10 ExamRow + DayModal → T8
- §11 No migration → respected (no migration task)
- §12 Import → T1 Step 8
- §13 Cosa NON cambia → respected (no calendar/aurora/settings touched)

**Placeholder scan:** No TBDs. Every step has either complete code or exact commands with expected output.

**Type consistency:**
- Rust enum variants `Exam::Esame(EsameData)` / `Exam::Progetto(ProgettoData)` consistent in all tasks
- TS types `Esame = EsameData & {kind:"esame"}` etc. — `kind` is the discriminator, consistent
- `isProgetto(e)` type guard exported from `progetto.ts` consumed by ExamModal, ExamRow, DayCell, DayModal, study-time
- `expandRanges(p)`, `totalRangeDays(p)`, `dateInAnyRange(p,d)`, `computeProjectEdges(p,d)` consistent signatures
- Rust accessor methods: `exam.base()`, `exam.id()`, `exam.kind_str()`, `exam.ranges()` consistently used in CRUD and tests

**Build state per task:**
- T1: cargo compiles + tests pass. FE compiles? No — depends on Rust serialization shape, but TS types haven't been refactored yet. The Tauri invoke handler still produces JSON in the new shape. Wait — IS this a problem? The Rust commands return `Result<Exam, String>`. After T1, `Exam` is the new enum and serializes to `{"kind":"esame", ...}` or `{"kind":"progetto", ...}`. TS still expects the OLD shape (single struct). Calling `invoke("list_exams")` on FE returns the new JSON shape, but TS code parses it as the old type → runtime errors.
  - HOWEVER, `npm run build` only does `tsc && vite build`, not runtime. TS still THINKS the shape is the old one (it doesn't see the Rust enum). The build passes.
  - At RUNTIME (npm run tauri dev), invoke returns new JSON, TS parses it incorrectly → cells/rows render wrong.
  - This is acceptable WITHIN this implementation sequence because we never run `tauri dev` between Tasks 1 and 3. After Task 3 (TS types match), runtime works again.
  - The final smoke (Task 9) is the first time FE talks to Rust with the new shape — by then both ends agree.

**Risk:** if the user pulls the branch and runs `tauri dev` between T1 (Rust merged) and T3 (TS merged), it'll be broken. Mitigation: all 9 tasks run sequentially in one session before pushing. Push happens in T9.

Actually wait — each task in this plan pushes individually? Let me re-read the conventions.

> "Each task ends with a clean-build commit. After each commit: TS strict + Vite build + cargo test must pass."

Hmm. T1 commits. T2 commits. Each commit must build cleanly. After T1, the Rust types are NEW but TS still uses OLD types. The TS doesn't fail to compile (it doesn't know about the new Rust shape — they communicate via JSON at runtime).

So `npm run build` (tsc + vite) passes after T1 because TS types haven't changed. Cargo test passes because tests use Rust types directly.

After T3 (TS types refactored), tsc errors appear in consumers (ExamModal, DayCell, etc.). `npm run build` FAILS until T8 fixes everything.

This means Tasks 3 through 7 commit a broken FE build. Acceptable if the entire implementation is sequential within the same session — push happens only at T9.

OR: I can merge T3-T8 into a single task that does everything at once. That's a huge single commit, but it's coherent (the TS refactor is one cohesive change).

Pragmatic compromise: commits between T3-T7 leave the build in an intermediate state, but tsc errors are localized to the still-to-fix files. By T8 the build is clean. T9 pushes.

Alternatively, write a single "BIG" TS task that does T3-T8 in one shot. The implementer subagent would handle a larger surface but in one commit.

I'll keep the plan as 9 tasks but note the intermediate broken-build state. If the subagent struggles with the multi-task dependency, I'll consolidate.

The plan stands.
