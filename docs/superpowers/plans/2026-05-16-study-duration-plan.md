# Default Study Duration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `default_study_minutes` (t) to each exam. Effective minutes per (exam, day) = `t/n` where n is count of study activities active that day. Projects act as "multi-day exams" for the t/n model but keep visual rendering.

**Architecture:** Migration 003 adds the column. Rust types/CRUD/validation gain the new field. TS types + db.ts boundary mapping. New `src/study-time.ts` helper module computes `countPresences`, `effectiveMinutes`, `totalMinutes`, `formatHM` for ExamRow meta and DayModal display. ExamModal grows a duration dropdown. DayModal shows the computed minutes as the input placeholder.

**Tech Stack:** Rust (rusqlite) · TypeScript · React (Lucide already covers icons)

**Spec:** `docs/superpowers/specs/2026-05-16-study-duration-design.md`

**Conventions:**
- PowerShell from `C:\Users\Gianmarco\Desktop\Calendario-app`.
- Each task ends with a commit. `npm run build` + `npx tsc --noEmit` for FE; `cargo test --manifest-path src-tauri/Cargo.toml` for Rust.

---

## Phase 0 — Schema

### Task 1: Migration 003 + Rust types

**Files:**
- Create: `src-tauri/src/db/migrations/003_default_study_minutes.sql`
- Modify: `src-tauri/src/db/mod.rs` (append entry to `MIGRATIONS` slice)
- Modify: `src-tauri/src/db/types.rs` (add `default_study_minutes` field + validation)

- [ ] **Step 1: Create migration SQL**

Create `src-tauri/src/db/migrations/003_default_study_minutes.sql`:

```sql
ALTER TABLE exams ADD COLUMN default_study_minutes INTEGER NOT NULL DEFAULT 60;
```

- [ ] **Step 2: Register migration in `mod.rs`**

Open `src-tauri/src/db/mod.rs`. The `MIGRATIONS` slice currently contains 2 entries (001_init, 002_study_minutes). Add a third entry. The whole slice should look like:

```rust
const MIGRATIONS: &[(&str, &str)] = &[
    ("001_init", include_str!("migrations/001_init.sql")),
    ("002_study_minutes", include_str!("migrations/002_study_minutes.sql")),
    ("003_default_study_minutes", include_str!("migrations/003_default_study_minutes.sql")),
];
```

(Only the third tuple line is new. Leave the existing two as-is.)

- [ ] **Step 3: Add `default_study_minutes` to `Exam` and `ExamInput`**

Open `src-tauri/src/db/types.rs`. Locate the `Exam` struct and the `ExamInput` struct.

`Exam` currently has these fields in order:
`id`, `name`, `color`, `kind`, `passed`, `appelli`, `ranges`, `study_days`.

Insert a new field `default_study_minutes: i32` between `passed` and `appelli`. Updated struct:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Exam {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub kind: ExamKind,
    pub passed: bool,
    pub default_study_minutes: i32,
    pub appelli: Vec<Appello>,
    pub ranges: Vec<ProjectRange>,
    pub study_days: Vec<StudyDay>,
}
```

`ExamInput` similarly — insert `default_study_minutes: i32` between `passed` and `appelli`:

```rust
#[derive(Debug, Clone, Deserialize)]
pub struct ExamInput {
    pub name: String,
    pub color: String,
    pub kind: ExamKind,
    pub passed: bool,
    pub default_study_minutes: i32,
    pub appelli: Vec<String>,
    pub ranges: Vec<DateRange>,
}
```

- [ ] **Step 4: Add validation in `validate_input`**

In `src-tauri/src/db/types.rs`, locate `pub fn validate_input(input: &ExamInput) -> Result<String, String>`. After the existing `validate_color(&input.color)?;` line and before the `for d in &input.appelli` block, INSERT:

```rust
    if input.default_study_minutes < 0 || input.default_study_minutes > 1440 {
        return Err(format!(
            "Tempo di studio predefinito non valido: {} (0..1440)",
            input.default_study_minutes
        ));
    }
```

- [ ] **Step 5: Add a validation test**

In the `#[cfg(test)] mod tests` block of `types.rs`, after the last existing test `progetto_with_appelli_rejected`, INSERT:

```rust
    #[test]
    fn default_study_minutes_out_of_range_rejected() {
        let mut i = ExamInput {
            name: "x".into(),
            color: "#112233".into(),
            kind: ExamKind::Esame,
            passed: false,
            default_study_minutes: -1,
            appelli: vec![],
            ranges: vec![],
        };
        assert!(validate_input(&i).is_err());

        i.default_study_minutes = 1441;
        assert!(validate_input(&i).is_err());

        i.default_study_minutes = 0;
        assert!(validate_input(&i).is_ok());  // 0 is valid (no auto-study)

        i.default_study_minutes = 1440;
        assert!(validate_input(&i).is_ok());
    }
```

- [ ] **Step 6: Update test helpers**

Open `src-tauri/src/db/exams.rs`. Inside `#[cfg(test)] mod tests`, locate the helpers `pub(super) fn sample_esame()` and `pub(super) fn sample_progetto()`. Both build an `ExamInput`. Add `default_study_minutes: 60` to each ExamInput literal.

Current `sample_esame()`:
```rust
pub(super) fn sample_esame() -> ExamInput {
    ExamInput {
        name: "Neuroanatomia".into(),
        color: "#E8543F".into(),
        kind: ExamKind::Esame,
        passed: false,
        appelli: vec!["2026-06-15".into(), "2026-07-10".into()],
        ranges: vec![],
    }
}
```

Updated:
```rust
pub(super) fn sample_esame() -> ExamInput {
    ExamInput {
        name: "Neuroanatomia".into(),
        color: "#E8543F".into(),
        kind: ExamKind::Esame,
        passed: false,
        default_study_minutes: 60,
        appelli: vec!["2026-06-15".into(), "2026-07-10".into()],
        ranges: vec![],
    }
}
```

Same for `sample_progetto()`: add `default_study_minutes: 60` between `passed` and `appelli`.

Also update any other `ExamInput { ... }` literals in tests. They appear inside the body of:
- `create_rejects_invalid_input` test (literal with `name: "".into()` — add `default_study_minutes: 60`)
- `esame_with_ranges_rejected`, `progetto_without_ranges_rejected`, `progetto_with_appelli_rejected` in `types.rs` test module
- `count_presences_counts_studies_and_projects` test (literal with `name: "Tesi v2".into()` — add `default_study_minutes: 60`)
- The two literals inside `toggle_study_day_rejects_when_already_4_presences` and `toggle_study_day_off_always_allowed_even_at_cap` (the loops creating `input` — `input.default_study_minutes` is not set anywhere, so the loop fails to compile after Step 3. Fix: after the line `let mut input = sample_esame();` no extra change needed because `sample_esame()` is updated; but the literal in the 5th-exam check `let mut input5 = sample_esame();` is also covered).

Use `Grep` to find every `ExamInput {` in the Rust codebase and add the field to each literal that doesn't go through `sample_esame()`/`sample_progetto()` first.

Inside `src-tauri/src/db/types.rs` test module specifically, the 3 literals `esame_with_ranges_rejected`, `progetto_without_ranges_rejected`, `progetto_with_appelli_rejected` need the new field. Example:

```rust
    let i = ExamInput {
        name: "x".into(),
        color: "#112233".into(),
        kind: ExamKind::Esame,
        passed: false,
        default_study_minutes: 60,
        appelli: vec![],
        ranges: vec![...],
    };
```

- [ ] **Step 7: Update `exams::create` / `update` / `build_exam` to persist and load the new column**

Open `src-tauri/src/db/exams.rs`. In `pub fn create(conn: &mut Connection, input: &ExamInput)`:

Current INSERT:
```rust
tx.execute(
    "INSERT INTO exams (name, color, kind, passed) VALUES (?1, ?2, ?3, ?4)",
    params![name, input.color, input.kind.as_str(), input.passed as i64],
).map_err(...)?;
```

Replace with:
```rust
tx.execute(
    "INSERT INTO exams (name, color, kind, passed, default_study_minutes) VALUES (?1, ?2, ?3, ?4, ?5)",
    params![name, input.color, input.kind.as_str(), input.passed as i64, input.default_study_minutes],
).map_err(...)?;
```

In `pub fn update(conn: &mut Connection, id: i64, input: &ExamInput)`:

Current UPDATE:
```rust
let changed = tx.execute(
    "UPDATE exams SET name = ?1, color = ?2, kind = ?3, passed = ?4,
                      updated_at = datetime('now') WHERE id = ?5",
    params![name, input.color, input.kind.as_str(), input.passed as i64, id],
).map_err(...)?;
```

Replace with:
```rust
let changed = tx.execute(
    "UPDATE exams SET name = ?1, color = ?2, kind = ?3, passed = ?4,
                      default_study_minutes = ?5, updated_at = datetime('now') WHERE id = ?6",
    params![name, input.color, input.kind.as_str(), input.passed as i64, input.default_study_minutes, id],
).map_err(...)?;
```

In `pub fn list(conn: &Connection)`:

Current prepare:
```rust
let mut stmt = conn.prepare(
    "SELECT id, name, color, kind, passed FROM exams ORDER BY name COLLATE NOCASE"
)
```

Replace with:
```rust
let mut stmt = conn.prepare(
    "SELECT id, name, color, kind, passed, default_study_minutes FROM exams ORDER BY name COLLATE NOCASE"
)
```

Then the `query_map` closure currently is:
```rust
let rows = stmt.query_map([], |r| {
    Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?,
        r.get::<_, String>(3)?, r.get::<_, i64>(4)?))
}).map_err(...)?;
```

Replace with:
```rust
let rows = stmt.query_map([], |r| {
    Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?,
        r.get::<_, String>(3)?, r.get::<_, i64>(4)?, r.get::<_, i32>(5)?))
}).map_err(...)?;
```

And the for-loop that destructures the tuple. Current:
```rust
for row in rows {
    let (id, name, color, kind_str, passed) = row.map_err(|e| format!("row: {e}"))?;
    out.push(build_exam(conn, id, name, color, &kind_str, passed != 0)?);
}
```

Replace with:
```rust
for row in rows {
    let (id, name, color, kind_str, passed, dsm) = row.map_err(|e| format!("row: {e}"))?;
    out.push(build_exam(conn, id, name, color, &kind_str, passed != 0, dsm)?);
}
```

Same change in `pub fn search(conn: &Connection, query: &str)`: extend the SELECT, query_map closure, and the for-loop the exact same way.

In `pub fn get_by_id(conn: &Connection, id: i64)`:

Current:
```rust
let (name, color, kind_str, passed): (String, String, String, i64) = conn.query_row(
    "SELECT name, color, kind, passed FROM exams WHERE id = ?1",
    params![id],
    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
).map_err(...)?;
build_exam(conn, id, name, color, &kind_str, passed != 0)
```

Replace with:
```rust
let (name, color, kind_str, passed, dsm): (String, String, String, i64, i32) = conn.query_row(
    "SELECT name, color, kind, passed, default_study_minutes FROM exams WHERE id = ?1",
    params![id],
    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
).map_err(...)?;
build_exam(conn, id, name, color, &kind_str, passed != 0, dsm)
```

In `fn build_exam(...)`:

Current signature:
```rust
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
```

Replace with:
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
    let kind = ExamKind::from_str(kind_str)?;
    let appelli = load_appelli(conn, id)?;
    let ranges = load_ranges(conn, id)?;
    let study_days = load_study_days(conn, id)?;
    Ok(Exam { id, name, color, kind, passed, default_study_minutes, appelli, ranges, study_days })
}
```

- [ ] **Step 8: Update import.rs to accept `defaultStudyMinutes` JSON field**

Open `src-tauri/src/db/import.rs`. Locate `struct ArtifactExam`. Add a new field `default_study_minutes: i32` with serde defaults.

First, add the helper function at module top-level (right after the imports or before the structs):

```rust
fn default_60() -> i32 { 60 }
```

Then modify `ArtifactExam`:

```rust
#[derive(Deserialize)]
struct ArtifactExam {
    name: String,
    color: String,
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    passed: bool,
    #[serde(rename = "defaultStudyMinutes", default = "default_60")]
    default_study_minutes: i32,
    #[serde(default)]
    appelli: Vec<ArtifactAppello>,
    #[serde(default)]
    ranges: Vec<ArtifactRange>,
    #[serde(rename = "studyDays", default)]
    study_days: Vec<String>,
}
```

Then in `import_artifact_json`, the construction of `ExamInput` currently:
```rust
let input = ExamInput {
    name: ae.name.clone(),
    color: ae.color.clone(),
    kind,
    passed: ae.passed,
    appelli,
    ranges,
};
```

Replace with:
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

- [ ] **Step 9: Run all Rust tests**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | grep "test result:" | head -3
```

Expected: `37 passed; 0 failed` (35 existing + 1 new validation test + 1 new... actually 36; the existing 35 + 1 new = 36. Plus migrations_apply_on_empty_db and migrations_are_idempotent need to assert `MIGRATIONS.len()` which already auto-adjusts to 3. So expected total: 36).

If a test fails because some `ExamInput` literal is missing the new field, find it via `cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | grep "missing field"` and add `default_study_minutes: 60` to it.

- [ ] **Step 10: Commit**

```powershell
git add src-tauri/src/db/migrations/003_default_study_minutes.sql src-tauri/src/db src-tauri/Cargo.lock
git commit -m "feat(db): default_study_minutes column + Rust types

Migration 003 adds INTEGER NOT NULL DEFAULT 60 column to exams table.
Exam and ExamInput grow the field. validate_input checks 0..=1440.
CRUD (create/update/list/get_by_id/search) persists and loads it.
import_artifact_json accepts optional defaultStudyMinutes (default 60).

Test helpers updated; 1 new validation test."
```

---

## Phase 1 — Frontend types + boundary

### Task 2: Update TS types and db.ts mapping

**Files:**
- Modify: `src/types.ts`
- Modify: `src/db.ts`

- [ ] **Step 1: Add `defaultStudyMinutes` to TS types**

Open `src/types.ts`. Locate `Exam` and `ExamInput`. Add `defaultStudyMinutes: number` to both.

Updated:
```typescript
export interface Exam {
  id: number;
  name: string;
  color: string;
  kind: ExamKind;
  passed: boolean;
  defaultStudyMinutes: number;
  appelli: Appello[];
  ranges: ProjectRange[];
  studyDays: StudyDay[];
}

export interface ExamInput {
  name: string;
  color: string;
  kind: ExamKind;
  passed: boolean;
  defaultStudyMinutes: number;
  appelli: string[];
  ranges: DateRangeInput[];
}
```

- [ ] **Step 2: Update `db.ts` boundary mapping**

Open `src/db.ts`. Locate the type `ExamWire` and the function `fromWire`. Current:

```typescript
type ExamWire = Omit<Exam, "studyDays"> & { study_days: StudyDay[] };

function fromWire(e: ExamWire): Exam {
  const { study_days, ...rest } = e;
  return { ...rest, studyDays: study_days };
}
```

Replace with:

```typescript
type ExamWire = Omit<Exam, "studyDays" | "defaultStudyMinutes"> & {
  study_days: StudyDay[];
  default_study_minutes: number;
};

function fromWire(e: ExamWire): Exam {
  const { study_days, default_study_minutes, ...rest } = e;
  return { ...rest, studyDays: study_days, defaultStudyMinutes: default_study_minutes };
}
```

- [ ] **Step 3: TypeScript check**

```powershell
npx tsc --noEmit 2>&1 | tail -10
```

Expected: TS errors everywhere `ExamInput` is constructed without `defaultStudyMinutes`. List them. Currently there are 2 such places: `src/components/ExamModal.tsx` (one in `handleSave`) and `src/components/ImportModal.tsx` (none — Import sends raw text, the FE doesn't construct ExamInput for import). The ExamModal compile error is expected — it'll be fixed in Task 3.

Note these errors and proceed. (Don't try to fix yet; Task 3 owns ExamModal.)

- [ ] **Step 4: Commit**

```powershell
git add src/types.ts src/db.ts
git commit -m "feat(fe): add defaultStudyMinutes to Exam/ExamInput types

Updates ExamWire and fromWire in db.ts to translate snake_case
default_study_minutes from Rust to camelCase defaultStudyMinutes
on the FE side. ExamModal (next task) is currently broken due to
missing field in ExamInput literal."
```

---

## Phase 2 — Frontend helpers

### Task 3: Create `src/study-time.ts` helper module

**Files:**
- Create: `src/study-time.ts`

Pure module with no React dependencies — just types and functions. Used by ExamRow, DayModal, and potentially future components.

- [ ] **Step 1: Create the module**

Create `src/study-time.ts`:

```typescript
import type { Exam } from "./types";

/**
 * Count "study activities" active on a given day:
 *   - +1 per active esame with a studyDay entry on this date
 *   - +1 per active progetto whose range covers this date
 * Identical semantics to Rust's db::exams::count_presences.
 */
export function countPresences(dayKey: string, exams: Exam[]): number {
  let n = 0;
  for (const e of exams) {
    if (e.passed) continue;
    if (e.kind === "esame") {
      if (e.studyDays.some((s) => s.date === dayKey)) n++;
    } else {
      if (e.ranges.some((r) => dayKey >= r.start && dayKey <= r.end)) n++;
    }
  }
  return n;
}

/**
 * Effective minutes for studying `exam` on `dayKey`.
 *   - For esami: a non-null `studyDays[d].minutes` is a manual override and wins.
 *   - Otherwise: t/n, where t = exam.defaultStudyMinutes and n = countPresences.
 *   - Returns 0 if t === 0 (no auto-study) or n === 0 (no activities, defensive).
 */
export function effectiveMinutes(exam: Exam, dayKey: string, allExams: Exam[]): number {
  if (exam.kind === "esame") {
    const entry = exam.studyDays.find((s) => s.date === dayKey);
    if (entry && entry.minutes != null) return entry.minutes;
  }
  const t = exam.defaultStudyMinutes;
  if (t === 0) return 0;
  const n = countPresences(dayKey, allExams);
  if (n === 0) return 0;
  return Math.round(t / n);
}

/**
 * Iterate every day where `exam` is "being studied":
 *   - For esami: each studyDay entry.
 *   - For progetti: each date inside any of their ranges.
 * Yields YYYY-MM-DD strings.
 */
export function studiedDays(exam: Exam): string[] {
  if (exam.kind === "esame") {
    return exam.studyDays.map((s) => s.date);
  }
  const out: string[] = [];
  for (const r of exam.ranges) {
    const start = new Date(r.start);
    const end = new Date(r.end);
    const cursor = new Date(start);
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      out.push(`${y}-${m}-${d}`);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return out;
}

/**
 * Total effective study minutes for an exam, across all its studied days.
 */
export function totalMinutes(exam: Exam, allExams: Exam[]): number {
  return studiedDays(exam).reduce(
    (sum, day) => sum + effectiveMinutes(exam, day, allExams),
    0
  );
}

/**
 * Format minutes as compact "1h30m" / "45m" / "2h" / "" (for 0).
 */
export function formatHM(minutes: number): string {
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

/**
 * Dropdown options for default_study_minutes input.
 * 15-min step from 0 to 480 (8h max). 0 = "no auto-study".
 */
export interface DurationOption {
  value: number;
  label: string;
}

export function durationOptions(): DurationOption[] {
  const out: DurationOption[] = [{ value: 0, label: "Nessun tempo predefinito" }];
  for (let m = 15; m <= 480; m += 15) {
    out.push({ value: m, label: formatHM(m) });
  }
  return out;
}
```

- [ ] **Step 2: TypeScript check**

```powershell
npx tsc --noEmit 2>&1 | tail -10
```

Expected: same errors as Task 2 (ExamModal still broken). The new file `study-time.ts` itself compiles clean.

- [ ] **Step 3: Commit**

```powershell
git add src/study-time.ts
git commit -m "feat(fe): study-time.ts helpers (countPresences, effectiveMinutes, totalMinutes, formatHM, durationOptions)

Pure module, no React deps. Mirrors Rust count_presences and computes
the t/n formula client-side. studiedDays iterates per-day for both
esami (study_days entries) and progetti (each date in ranges).
durationOptions returns dropdown items in 15-min steps from 0 to 8h."
```

---

## Phase 3 — UI integration

### Task 4: ExamModal — add duration dropdown

**Files:**
- Modify: `src/components/ExamModal.tsx`

- [ ] **Step 1: Read current state holding**

Open `src/components/ExamModal.tsx`. Locate the state declarations near the top of the component body:

```tsx
const [kind, setKind] = useState<ExamKind>(initialKind);
const [name, setName] = useState("");
const [color, setColor] = useState(PALETTE[0]);
const [appelli, setAppelli] = useState<string[]>([""]);
const [ranges, setRanges] = useState<DateRangeInput[]>([{ start: "", end: "" }]);
```

Add a new state for the default study minutes:

```tsx
const [defaultMinutes, setDefaultMinutes] = useState<number>(60);
```

- [ ] **Step 2: Initialize defaultMinutes in the useEffect that hydrates from `editing`**

Locate the `useEffect(() => { … }, [open, editing, initialKind, exams])` block. Inside the `if (editing)` branch, after `setKind(editing.kind);` and the other setters, add:

```tsx
setDefaultMinutes(editing.defaultStudyMinutes);
```

In the `else` branch (creating a new exam), after the existing setters, add:

```tsx
setDefaultMinutes(60);
```

- [ ] **Step 3: Add the dropdown after the Color section, before the Appelli/Ranges sections**

Locate the JSX block for Color (it contains `{PALETTE.map((c) => (`). After its closing `</div>` (the swatches wrapper closing), and BEFORE the `{!isProj && (` block (appelli section), INSERT:

```tsx
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
```

- [ ] **Step 4: Add the import for durationOptions**

At the top of `ExamModal.tsx`, the imports section. Add:

```tsx
import { durationOptions } from "../study-time";
```

(Adjacent to existing `import { Modal } from "./Modal";` etc.)

- [ ] **Step 5: Include `defaultStudyMinutes` in the saved `ExamInput`**

Locate the `handleSave` function. The current ExamInput construction:

```tsx
const input: ExamInput = {
  name: trimmed,
  color,
  kind,
  passed: editing?.passed ?? false,
  appelli: isProj ? [] : cleanAppelli,
  ranges: isProj ? cleanRanges : [],
};
```

Replace with:

```tsx
const input: ExamInput = {
  name: trimmed,
  color,
  kind,
  passed: editing?.passed ?? false,
  defaultStudyMinutes: defaultMinutes,
  appelli: isProj ? [] : cleanAppelli,
  ranges: isProj ? cleanRanges : [],
};
```

- [ ] **Step 6: TypeScript + build**

```powershell
npx tsc --noEmit 2>&1 | tail -10
```

Expected: zero errors (ExamModal now passes the field).

```powershell
npm run build 2>&1 | tail -7
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```powershell
git add src/components/ExamModal.tsx
git commit -m "feat(fe): ExamModal — default study duration dropdown

New 'Tempo di studio giornaliero' select with 15-min options from 0
(Nessun tempo predefinito) to 8h. Hydrates from editing.defaultStudyMinutes
or defaults to 60. Saved into ExamInput.defaultStudyMinutes."
```

---

### Task 5: ExamRow — meta uses computed totals

**Files:**
- Modify: `src/components/ExamRow.tsx`

- [ ] **Step 1: Update imports**

At the top of `src/components/ExamRow.tsx`, the existing imports. Add:

```tsx
import { totalMinutes, formatHM } from "../study-time";
```

(Adjacent to existing imports.)

Also `useExams` already imported — confirm. We'll use `exams` from it as `allExams`.

- [ ] **Step 2: Replace the local `metaText` helper**

Locate the current `function metaText(e: Exam): string { … }` near the top of the file. Replace its entire body with:

```tsx
function metaText(exam: Exam, allExams: Exam[]): string {
  if (exam.kind === "progetto") {
    const totDays = exam.ranges.reduce(
      (s, r) => s + Math.max(1, Math.round((+new Date(r.end) - +new Date(r.start)) / 86_400_000) + 1),
      0
    );
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

Note the function now takes `allExams` as a second argument.

The local `rangeDays` helper that used to exist in this file is no longer needed (replaced by the inline reduce above) — REMOVE it.

- [ ] **Step 3: Update the call site to pass `allExams`**

Inside the `ExamRow` component, locate the call `metaText(exam)`. Currently:

```tsx
<span className="exam-row-redesign-meta">{metaText(exam)}</span>
```

Replace with:

```tsx
<span className="exam-row-redesign-meta">{metaText(exam, exams)}</span>
```

And inside the component body, replace:

```tsx
const { setPassed, remove } = useExams();
```

with:

```tsx
const { setPassed, remove, exams } = useExams();
```

- [ ] **Step 4: TypeScript + build**

```powershell
npx tsc --noEmit 2>&1 | tail -10
```

Expected: zero errors.

```powershell
npm run build 2>&1 | tail -7
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```powershell
git add src/components/ExamRow.tsx
git commit -m "feat(fe): ExamRow meta uses computed t/n totals

Replaces the local studyDays.minutes sum with totalMinutes from
study-time.ts. For progetti the meta now shows '14g · 2h30m' instead
of just '14g'. For esami: '2·3h' from the formula.

Reads all exams via useExams() to compute n per day."
```

---

### Task 6: DayModal — show computed minutes as placeholder + hint

**Files:**
- Modify: `src/components/DayModal.tsx`

- [ ] **Step 1: Update imports**

At the top of `src/components/DayModal.tsx`, the existing imports. Add:

```tsx
import { effectiveMinutes, countPresences } from "../study-time";
```

- [ ] **Step 2: Compute placeholders and hints in the render**

Locate the `studyEsami.map((e) => { … })` block. The current implementation:

```tsx
{studyEsami.map((e) => {
  const studyEntry = e.studyDays.find((s) => s.date === dayKey);
  const studying = !!studyEntry;
  return (
    <div key={e.id} className="...">
      <span className="..." style={{ background: e.color }} />
      <span className="...">{e.name}</span>

      {studying && (
        <div className="flex items-center gap-1 text-app-muted">
          <Clock size={12} />
          <input ... value={studyEntry.minutes ?? ""} ... />
        </div>
      )}

      <input
        type="checkbox"
        checked={studying}
        onChange={() => void toggleStudyDay(e.id, dayKey)}
        className="..."
      />
    </div>
  );
})}
```

Replace the inside of the map callback with:

```tsx
{studyEsami.map((e) => {
  const studyEntry = e.studyDays.find((s) => s.date === dayKey);
  const studying = !!studyEntry;
  const computed = effectiveMinutes(e, dayKey, active);
  const t = e.defaultStudyMinutes;
  const n = countPresences(dayKey, active);
  const isOverride = studyEntry?.minutes != null;
  return (
    <div
      key={e.id}
      className="flex items-center gap-2 px-2.5 py-2 border border-app-border rounded-lg mb-1.5 hover:bg-app-hover"
    >
      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: e.color }} />
      <span className="flex-1 text-[13px] font-semibold text-app-fg truncate">{e.name}</span>

      {studying && (
        <div className="flex items-center gap-1 text-app-muted">
          <Clock size={12} />
          <input
            type="number"
            min={0}
            max={1440}
            step={5}
            placeholder={String(computed)}
            value={studyEntry.minutes ?? ""}
            onChange={(ev) => {
              const raw = ev.target.value;
              const m = raw === "" ? null : Math.max(0, Math.min(1440, parseInt(raw, 10) || 0));
              void setStudyDayMinutes(e.id, dayKey, m);
            }}
            className="w-14 px-1.5 py-1 text-[12px] text-app-fg bg-app-input-bg border border-app-input-border rounded"
            aria-label={`Minuti di studio per ${e.name}`}
            title={
              isOverride
                ? `Manuale (formula: ${computed}m = ${t}/${n})`
                : `Auto (${computed}m = ${t}/${n}). Modifica per override.`
            }
          />
          <span className="text-[9.5px] whitespace-nowrap">
            {isOverride ? "manuale" : `auto ${computed}m`}
          </span>
        </div>
      )}

      <input
        type="checkbox"
        checked={studying}
        onChange={() => void toggleStudyDay(e.id, dayKey)}
        className="w-[17px] h-[17px] cursor-pointer shrink-0"
        aria-label={`Studio per ${e.name}`}
      />
    </div>
  );
})}
```

Key changes vs current code:
- Compute `computed = effectiveMinutes(e, dayKey, active)`, `t = e.defaultStudyMinutes`, `n = countPresences(dayKey, active)`, `isOverride = studyEntry?.minutes != null`.
- Input `placeholder` is now the computed minutes string (was `"min"`).
- Input `title` (tooltip) explains override vs auto.
- New small text label after the input: `"manuale"` (orange-ish via class) or `"auto ${computed}m"` (muted).

- [ ] **Step 3: TypeScript + build**

```powershell
npx tsc --noEmit 2>&1 | tail -10
```

Expected: zero errors.

```powershell
npm run build 2>&1 | tail -7
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```powershell
git add src/components/DayModal.tsx
git commit -m "feat(fe): DayModal shows computed t/n as placeholder + label

For each esame with study active on the day, the minutes input now
shows the formula's result as placeholder (auto = t/n). A small
label next to the input says 'auto Xm' or 'manuale' depending on
whether study_days.minutes is null or set. Tooltip explains the
breakdown."
```

---

## Phase 4 — Verification

### Task 7: Full verification + push

- [ ] **Step 1: Rust test pass**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | grep "test result:" | head -3
```

Expected: `36 passed; 0 failed` (35 existing + 1 new validation test).

- [ ] **Step 2: TypeScript strict**

```powershell
npx tsc --noEmit 2>&1 | tail -10
```

Expected: zero errors.

- [ ] **Step 3: FE build**

```powershell
npm run build 2>&1 | tail -7
```

Expected: build succeeds. Bundle size approximately same (small text additions only).

- [ ] **Step 4: Push branch**

```powershell
git push origin feat/tauri-port 2>&1 | tail -5
```

Expected: 6 new commits pushed.

- [ ] **Step 5: USER smoke test**

Controller asks user to launch `npm run tauri dev` and verify:

1. Create a new esame: dropdown defaults to "1h". Save.
2. Open the saved esame: dropdown shows "1h".
3. Edit and change to "30m". Save. Reopen: shows "30m".
4. Create another esame with 1h default. Create a project covering today + 6 days with 1h default.
5. Mark study for both esami on today. ExamRow meta of esame1 shows `~30m` (60/2 if no project active) — wait, project is active today too so n=3 → 60/3 = 20m. So `~20m`.
6. Toggle off the project's range from today (edit project). Re-check: n=2, so ~30m.
7. In DayModal of today, open and confirm the input shows placeholder "20" or "30" depending on state. Confirm small "auto Xm" label appears.
8. Type "60" into the override input. Confirm label changes to "manuale". ExamRow meta now reflects 60m for that day.
9. Clear the input (delete characters). Confirm label returns to "auto Xm" and ExamRow meta returns to t/n.
10. Cell visuals (Cpu, BrainCircuit, banners) UNCHANGED.

Any visual regression → fix subagent.

---

## Self-review notes (post-write)

**Spec coverage:**
- §3 Migration → Task 1 step 1
- §4.1 Rust types → Task 1 steps 3, 6, 7
- §4.2 CRUD → Task 1 step 7
- §4.3 TS types → Task 2 step 1
- §4.4 Boundary mapping → Task 2 step 2
- §5.1 ExamModal dropdown → Task 4
- §5.2 DayModal placeholder + label → Task 6
- §5.3 ExamRow meta totals → Task 5
- §5.4 Import accepts defaultStudyMinutes → Task 1 step 8
- §6 What doesn't change → respected (no schema beyond migration 003, no toggle_study_day behavior, no calendar grid visuals, no Aurora)
- §7 Migration default = 60 → Task 1 step 1 (`DEFAULT 60`)
- §8 Cap unchanged → no task needed (no code touches that)
- §10 Out of scope → none implemented

**Placeholder scan:** No TBDs. Every step has either complete code or an exact command.

**Type consistency:**
- Rust `default_study_minutes: i32` <-> TS `defaultStudyMinutes: number` <-> wire `default_study_minutes: number`.
- `countPresences` (TS) mirrors `count_presences` (Rust): both count esami with study + progetti with range coverage on a day.
- Helper module exports: `countPresences`, `effectiveMinutes`, `studiedDays`, `totalMinutes`, `formatHM`, `durationOptions`, `DurationOption`.
- All consumers (`ExamRow`, `DayModal`) use the same helpers.

**Edge cases:**
- `defaultStudyMinutes === 0` → `effectiveMinutes` returns 0 → ExamRow meta omits time → reads as `2·` (no time suffix). Acceptable; the formatter returns `""` for 0.
- Project with no ranges: shouldn't happen (validation rejects), but if it does, `studiedDays` returns `[]` and totalMinutes is 0. Safe.
- Overlapping ranges within one project: double-counts days. Edge case noted in spec §10 but unaddressed in implementation. Acceptable for v1.
