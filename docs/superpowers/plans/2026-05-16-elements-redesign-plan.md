# Internal Elements Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the artifact-style ExamRow and DayCell content (dots/chips/pills/study-dots) with a Stripe-direction design: adaptive band layout per activity count, dedicated icons (Cpu/BrainCircuit), banner stack for appelli, simpler exam rows with hover-revealed actions.

**Architecture:** Pure FE rewrite of `DayCell.tsx` + `ExamRow.tsx` against new CSS classes added to `src/index.css`. One Rust validation change in `src-tauri/src/db/exams.rs` to enforce the 4-activity-per-day cap. No schema, no Tauri command signature changes.

**Tech Stack:** React 19 + TypeScript + Tailwind CSS v4 + Lucide React (`Cpu`, `BrainCircuit`, `MoreHorizontal`); Rust + rusqlite for the cap validation.

**Spec:** `docs/superpowers/specs/2026-05-16-elements-redesign-design.md`

**Conventions:**
- Commands run in PowerShell from `C:\Users\Gianmarco\Desktop\Calendario-app`.
- Verify after every task with `npx tsc --noEmit` and `npm run build` (FE) and `cargo test --manifest-path src-tauri/Cargo.toml` (when Rust changes).
- One commit per task. Conventional commits.

---

## Phase 0 — Foundations

### Task 1: Add new CSS classes for cell + exam row redesign

**Files:**
- Modify: `src/index.css` (append a new `@layer components { … }` block at the end)
- Modify: `src/index.css` `:root` and `.dark` to add `--cell-band-sep` token

Adds the styling system that subsequent tasks consume. No React file is touched yet — these classes are dormant until Tasks 2 and 3 apply them.

- [ ] **Step 1: Append band-separator tokens to existing token blocks**

Open `src/index.css`. Inside the `@theme { … }` block, after the existing `--blur-medium: 12px;` line and before `/* Exam palette - INVARIATA */`, INSERT:

```css
  /* Cell band separator (theme-aware) */
  --cell-band-sep: rgba(70, 130, 240, 0.15);
```

Inside the `.dark { … }` block, after the existing `--aurora-3: rgba(70, 130, 240, 0.30);` line, INSERT:

```css
  --cell-band-sep: rgba(255, 255, 255, 0.10);
```

- [ ] **Step 2: Append the new `@layer components` block at the END of `src/index.css`**

After the existing `/* ============ Aurora ambient layer ============ */` section (the last content in the file), append:

```css
/* ============ Element redesign — cell + exam row ============ */

@layer components {
  /* === Day cell — base layout container === */
  .cell-redesign {
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--color-app-cell);
    border: 1px solid var(--color-app-cell-border);
    border-radius: 8px;
    min-height: 60px;
    width: 100%;
    height: 100%;
    text-align: left;
  }

  .cell-redesign.today {
    border-color: color-mix(in srgb, var(--color-app-fg) 40%, transparent);
  }
  .cell-redesign.today.empty {
    background: color-mix(in srgb, var(--color-app-fg) 8%, transparent);
  }

  .cell-redesign.empty {
    align-items: center;
    justify-content: center;
  }

  /* === Banner stack (appelli) === */
  .cell-redesign .banners {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    z-index: 5;
  }
  .cell-redesign .banner {
    background: var(--banner-bg);
    color: #fff;
    font-size: 9.5px;
    font-weight: 700;
    padding: 2px 5px;
    line-height: 1.2;
    display: flex;
    align-items: center;
    gap: 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cell-redesign .banner + .banner {
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }
  .cell-redesign .banner-dot {
    width: 3.5px;
    height: 3.5px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.95);
    flex-shrink: 0;
  }
  .cell-redesign .banner-overflow {
    background: var(--color-app-soft);
    color: var(--color-app-muted);
    font-weight: 600;
  }

  /* === Band area (activities) === */
  .cell-redesign .band-area {
    flex: 1;
    min-height: 0;
    position: relative;
    display: flex;
  }
  .cell-redesign .band-area.split-1 { flex-direction: column; }
  .cell-redesign .band-area.split-2 { flex-direction: column; }
  .cell-redesign .band-area.split-3 { flex-direction: row; }
  .cell-redesign .band-area.split-4 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  }

  .cell-redesign .band {
    flex: 1;
    position: relative;
    min-height: 0;
    min-width: 0;
    background: color-mix(in srgb, var(--bc) 30%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cell-redesign .band-icon {
    color: var(--bc);
    width: 12px;
    height: 12px;
    filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.4));
  }
  :root:not(.dark) .cell-redesign .band-icon {
    filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.5));
  }

  .cell-redesign .band-area.split-2 .band + .band {
    border-top: 1px solid var(--cell-band-sep);
  }
  .cell-redesign .band-area.split-3 .band + .band {
    border-left: 1px solid var(--cell-band-sep);
  }
  .cell-redesign .band-area.split-4 .band {
    border-right: 1px solid var(--cell-band-sep);
    border-bottom: 1px solid var(--cell-band-sep);
  }
  .cell-redesign .band-area.split-4 .band:nth-child(2),
  .cell-redesign .band-area.split-4 .band:nth-child(4) { border-right: none; }
  .cell-redesign .band-area.split-4 .band:nth-child(3),
  .cell-redesign .band-area.split-4 .band:nth-child(4) { border-bottom: none; }

  /* === Project edge stripes === */
  .cell-redesign.proj-start::before {
    content: "";
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--proj-start-color);
    z-index: 4;
    pointer-events: none;
  }
  .cell-redesign.proj-end::after {
    content: "";
    position: absolute;
    right: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--proj-end-color);
    z-index: 4;
    pointer-events: none;
  }

  /* === Day number === */
  .cell-redesign .cell-num {
    position: absolute;
    bottom: 3px;
    right: 5px;
    z-index: 6;
    font-size: 10px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.85);
    text-shadow: 0 0 4px rgba(0, 0, 0, 0.6);
  }
  :root:not(.dark) .cell-redesign .cell-num {
    color: rgba(26, 37, 64, 0.85);
    text-shadow: 0 0 4px rgba(255, 255, 255, 0.8);
  }
  .cell-redesign.today .cell-num { font-weight: 800; }
  .cell-redesign.empty .cell-num {
    position: static;
    font-size: 14px;
    color: var(--color-app-muted);
    text-shadow: none;
  }

  /* === Exam row (sidebar) — redesign === */
  .exam-row-redesign {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px 6px 0;
    border-radius: 6px;
    background: var(--color-app-soft);
    border: 1px solid var(--color-app-border);
    margin-bottom: 6px;
    position: relative;
    overflow: hidden;
  }
  .exam-row-redesign.passed { opacity: 0.65; }
  .exam-row-redesign-stripe {
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--ec);
  }
  .exam-row-redesign-name {
    flex: 1;
    min-width: 0;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--color-app-fg);
    margin-left: 9px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .exam-row-redesign.passed .exam-row-redesign-name {
    text-decoration: line-through;
  }
  .exam-row-redesign-meta {
    font-size: 10px;
    color: var(--color-app-muted);
    flex-shrink: 0;
  }
  .exam-row-redesign-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.18s ease;
  }
  .exam-row-redesign:hover .exam-row-redesign-actions,
  .exam-row-redesign:focus-within .exam-row-redesign-actions {
    opacity: 1;
  }
  .exam-row-redesign-actions button {
    padding: 3px;
    border-radius: 4px;
    color: var(--color-app-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .exam-row-redesign-actions button:hover {
    background: var(--color-app-hover);
    color: var(--color-app-fg);
  }

  @media (prefers-reduced-motion: reduce) {
    .exam-row-redesign-actions {
      opacity: 1;
      transition: none;
    }
  }
}
```

- [ ] **Step 3: Build verification**

```powershell
npm run build
```

Expected: build succeeds. CSS bundle grows by ~2 KB. Note the new size.

(No TypeScript change — no `tsc --noEmit` needed for this CSS-only task.)

- [ ] **Step 4: Commit**

```powershell
git add src/index.css
git commit -m "style(elements): add cell-redesign + exam-row-redesign component classes

Introduces the styling system for the next-gen DayCell and ExamRow:
- cell-redesign: flex-column layout for banners + band-area + day number
- band-area split-1/2/3/4 with adaptive flex/grid layouts
- banner stack with overflow indicator
- project edge stripes (proj-start/proj-end)
- exam-row-redesign with hover-revealed actions
- new --cell-band-sep token (theme-aware)

No consumer code uses these classes yet."
```

---

## Phase 1 — Rust validation cap

### Task 2: Add `count_presences` helper and 4-activity cap in `toggle_study_day`

**Files:**
- Modify: `src-tauri/src/db/exams.rs`

Add a helper that counts active presences (projects covering a day + studies on a day), then use it inside `toggle_study_day` to refuse turning study ON when the day already has 4 presences.

- [ ] **Step 1: Write failing tests**

Open `src-tauri/src/db/exams.rs`. Inside the existing `#[cfg(test)] mod tests` block, after the existing tests (the last one is `search_filters_by_name`), append:

```rust
    #[test]
    fn count_presences_empty_day() {
        let conn = open_in_memory().unwrap();
        assert_eq!(count_presences(&conn, "2026-06-15").unwrap(), 0);
    }

    #[test]
    fn count_presences_counts_studies_and_projects() {
        let mut conn = open_in_memory().unwrap();

        // Esame 1 with study on 2026-06-15
        let e1 = create(&mut conn, &sample_esame()).unwrap();
        toggle_study_day(&conn, e1.id, "2026-06-15").unwrap();

        // Esame 2 with study on 2026-06-15
        let mut input2 = sample_esame();
        input2.name = "Fisiologia".into();
        input2.color = "#2E86C1".into();
        input2.appelli = vec!["2026-08-01".into()];
        let e2 = create(&mut conn, &input2).unwrap();
        toggle_study_day(&conn, e2.id, "2026-06-15").unwrap();

        // Progetto covering 2026-06-15
        let proj = create(&mut conn, &sample_progetto()).unwrap(); // 2026-05-01..2026-05-15 by default
        let mut proj_input = ExamInput {
            name: proj.name.clone(),
            color: proj.color.clone(),
            kind: ExamKind::Progetto,
            passed: false,
            appelli: vec![],
            ranges: vec![DateRange { start: "2026-06-10".into(), end: "2026-06-20".into() }],
        };
        proj_input.name = "Tesi v2".into();
        let _ = update(&mut conn, proj.id, &proj_input).unwrap();

        // Total presences on 2026-06-15: 2 studies + 1 project = 3
        assert_eq!(count_presences(&conn, "2026-06-15").unwrap(), 3);
    }

    #[test]
    fn toggle_study_day_rejects_when_already_4_presences() {
        let mut conn = open_in_memory().unwrap();

        // Create 4 esami all with study on the same date
        let date = "2026-06-15";
        for i in 0..4 {
            let mut input = sample_esame();
            input.name = format!("Esame {}", i);
            input.appelli = vec!["2026-08-01".into()];
            input.color = match i {
                0 => "#E8543F".into(),
                1 => "#2E86C1".into(),
                2 => "#27AE60".into(),
                _ => "#F39C12".into(),
            };
            let e = create(&mut conn, &input).unwrap();
            toggle_study_day(&conn, e.id, date).unwrap();
        }
        assert_eq!(count_presences(&conn, date).unwrap(), 4);

        // 5th esame, attempting to toggle study on same date → should fail
        let mut input5 = sample_esame();
        input5.name = "Esame 5".into();
        input5.color = "#8E44AD".into();
        input5.appelli = vec!["2026-08-01".into()];
        let e5 = create(&mut conn, &input5).unwrap();
        let result = toggle_study_day(&conn, e5.id, date);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("Massimo 4"), "expected cap error, got: {err}");
    }

    #[test]
    fn toggle_study_day_off_always_allowed_even_at_cap() {
        let mut conn = open_in_memory().unwrap();

        let date = "2026-06-15";
        let mut first_id = 0;
        for i in 0..4 {
            let mut input = sample_esame();
            input.name = format!("Esame {}", i);
            input.appelli = vec!["2026-08-01".into()];
            input.color = match i {
                0 => "#E8543F".into(),
                1 => "#2E86C1".into(),
                2 => "#27AE60".into(),
                _ => "#F39C12".into(),
            };
            let e = create(&mut conn, &input).unwrap();
            toggle_study_day(&conn, e.id, date).unwrap();
            if i == 0 { first_id = e.id; }
        }
        // Toggle OFF the first study should succeed even though cell is at cap
        let result = toggle_study_day(&conn, first_id, date);
        assert_eq!(result.unwrap(), false); // toggle returned new state = false (now off)
    }
```

- [ ] **Step 2: Run tests to verify they fail (count_presences is not defined yet)**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml db::exams::tests::count_presences 2>&1 | tail -10
```

Expected: compilation error `cannot find function 'count_presences' in this scope`. The 4 new tests cannot even build because `count_presences` doesn't exist.

- [ ] **Step 3: Add `count_presences` and update `toggle_study_day`**

Open `src-tauri/src/db/exams.rs`. Locate the existing `pub fn toggle_study_day` function. **Before** it (between `pub fn set_passed` and `pub fn toggle_study_day`), INSERT:

```rust
/// Counts active presences for a given date:
///   - one per active esame with a study_day on `date`
///   - one per active progetto whose ranges cover `date`
/// "Active" = `passed = 0`. Used to enforce the 4-presence-per-day cap.
pub fn count_presences(conn: &Connection, date: &str) -> Result<usize, String> {
    crate::db::types::validate_date(date)?;

    let n_studies: i64 = conn.query_row(
        "SELECT COUNT(*) FROM study_days sd
         JOIN exams e ON e.id = sd.exam_id
         WHERE sd.date = ?1 AND e.passed = 0 AND e.kind = 'esame'",
        params![date],
        |r| r.get(0),
    ).map_err(|e| format!("count studies: {e}"))?;

    let n_projects: i64 = conn.query_row(
        "SELECT COUNT(*) FROM project_ranges pr
         JOIN exams e ON e.id = pr.exam_id
         WHERE pr.start_date <= ?1 AND pr.end_date >= ?1
           AND e.passed = 0 AND e.kind = 'progetto'",
        params![date],
        |r| r.get(0),
    ).map_err(|e| format!("count projects: {e}"))?;

    Ok((n_studies + n_projects) as usize)
}
```

Then locate the body of `toggle_study_day`. The current implementation is:

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
```

Replace it with this version that adds the cap check in the INSERT branch (after `exam_exists` check, before the actual INSERT):

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
        // Enforce the 4-activity-per-day cap before adding.
        let current = count_presences(conn, date)?;
        if current >= 4 {
            return Err("Massimo 4 attività per giorno (progetti + esami in studio)".into());
        }
        conn.execute(
            "INSERT INTO study_days (exam_id, date) VALUES (?1, ?2)",
            params![exam_id, date],
        ).map_err(|e| format!("insert study: {e}"))?;
        Ok(true)
    }
}
```

- [ ] **Step 4: Run the 4 new tests**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml db::exams::tests::count_presences 2>&1 | tail -10
cargo test --manifest-path src-tauri/Cargo.toml db::exams::tests::toggle_study_day 2>&1 | tail -10
```

Expected: all 4 new tests pass. Full test suite count should now be 35 (was 31).

- [ ] **Step 5: Run the FULL Rust test suite to confirm no regressions**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | grep "test result:" | head -3
```

Expected: `35 passed; 0 failed`.

- [ ] **Step 6: Commit**

```powershell
git add src-tauri/src/db/exams.rs
git commit -m "feat(db): 4-activity-per-day cap + count_presences helper

count_presences returns total of active studies + active project ranges
covering a date. toggle_study_day rejects adding a study when current
presences >= 4, returning 'Massimo 4 attività per giorno (...)'.

Off-toggles still allowed. 4 new tests; 35 total Rust tests now."
```

---

## Phase 2 — Frontend: DayCell rewrite

### Task 3: Build the activity / appello derivation helpers in `DayCell.tsx`

**Files:**
- Modify: `src/components/DayCell.tsx`

Rewrites the cell from scratch. The new file replaces the current DayCell entirely. This task ONLY changes DayCell — Calendar.tsx wiring stays the same (it already passes `day`, `exams`, `onClick`).

- [ ] **Step 1: Rewrite `src/components/DayCell.tsx` end-to-end**

Replace the entire contents of `src/components/DayCell.tsx` with:

```tsx
import type { Exam } from "../types";
import type { MonthGridDay } from "../date";
import { inRange } from "../date";
import { Cpu, BrainCircuit } from "lucide-react";

interface DayCellProps {
  day: MonthGridDay;
  exams: Exam[]; // active only (passed=false), as filtered by parent
  onClick: (key: string) => void;
}

interface Activity {
  kind: "project" | "study";
  color: string;
  examId: number;
  examName: string;
}

interface BannerItem {
  color: string;
  examName: string;
}

interface ProjectEdges {
  start: boolean;
  end: boolean;
  startColor: string | null;
  endColor: string | null;
}

function buildActivities(dayKey: string, exams: Exam[]): Activity[] {
  const projects: Activity[] = [];
  const studies: Activity[] = [];
  for (const e of exams) {
    if (e.kind === "progetto") {
      const inAnyRange = e.ranges.some((r) => inRange(dayKey, r.start, r.end));
      if (inAnyRange) {
        projects.push({ kind: "project", color: e.color, examId: e.id, examName: e.name });
      }
    } else {
      const hasStudy = e.studyDays.some((s) => s.date === dayKey);
      if (hasStudy) {
        studies.push({ kind: "study", color: e.color, examId: e.id, examName: e.name });
      }
    }
  }
  projects.sort((a, b) => a.examName.localeCompare(b.examName));
  studies.sort((a, b) => a.examName.localeCompare(b.examName));
  return [...projects, ...studies];
}

function buildBanners(dayKey: string, exams: Exam[]): BannerItem[] {
  const out: BannerItem[] = [];
  for (const e of exams) {
    if (e.kind !== "esame") continue;
    for (const a of e.appelli) {
      if (a.date === dayKey) {
        out.push({ color: e.color, examName: e.name });
      }
    }
  }
  out.sort((a, b) => a.examName.localeCompare(b.examName));
  return out;
}

function computeProjectEdges(dayKey: string, exams: Exam[]): ProjectEdges {
  let start = false;
  let end = false;
  let startColor: string | null = null;
  let endColor: string | null = null;
  for (const e of exams) {
    if (e.kind !== "progetto") continue;
    for (const r of e.ranges) {
      if (r.start === dayKey) { start = true; startColor = e.color; }
      if (r.end === dayKey)   { end = true;   endColor = e.color; }
    }
  }
  return { start, end, startColor, endColor };
}

export function DayCell({ day, exams, onClick }: DayCellProps) {
  const activities = buildActivities(day.key, exams);
  const banners = buildBanners(day.key, exams);
  const edges = computeProjectEdges(day.key, exams);

  const splitN = Math.min(activities.length, 4);
  const visibleBanners = banners.slice(0, 2);
  const overflowCount = banners.length - visibleBanners.length;

  const classes = [
    "cell-redesign",
    "lift-hover",
    "focus-visible:outline-2",
    "focus-visible:outline-app-muted",
    "focus-visible:outline-offset-[-2px]",
    day.isToday ? "today" : "",
    activities.length === 0 && banners.length === 0 ? "empty" : "",
    edges.start ? "proj-start" : "",
    edges.end ? "proj-end" : "",
  ].filter(Boolean).join(" ");

  const cellStyle: React.CSSProperties = {};
  if (edges.startColor) cellStyle["--proj-start-color" as never] = edges.startColor;
  if (edges.endColor)   cellStyle["--proj-end-color"   as never] = edges.endColor;

  return (
    <button
      type="button"
      onClick={() => onClick(day.key)}
      className={classes}
      style={cellStyle}
    >
      {(visibleBanners.length > 0 || overflowCount > 0) && (
        <div className="banners">
          {visibleBanners.map((b, i) => (
            <div
              key={`b-${i}-${b.examName}`}
              className="banner"
              style={{ "--banner-bg": b.color } as React.CSSProperties}
              title={`Appello: ${b.examName}`}
            >
              <span className="banner-dot" />
              <span>{b.examName}</span>
            </div>
          ))}
          {overflowCount > 0 && (
            <div className="banner banner-overflow">+{overflowCount} altri</div>
          )}
        </div>
      )}

      {activities.length > 0 && (
        <div className={`band-area split-${splitN}`}>
          {activities.slice(0, 4).map((a, i) => (
            <div
              key={`a-${i}-${a.examId}`}
              className="band"
              style={{ "--bc": a.color } as React.CSSProperties}
              title={a.kind === "project" ? `Progetto: ${a.examName}` : `Studio: ${a.examName}`}
            >
              {a.kind === "project"
                ? <Cpu className="band-icon" />
                : <BrainCircuit className="band-icon" />}
            </div>
          ))}
        </div>
      )}

      <span className="cell-num">{day.day}</span>
    </button>
  );
}
```

- [ ] **Step 2: TypeScript check**

```powershell
npx tsc --noEmit 2>&1 | tail -10
```

Expected: zero errors. (If `lucide-react`'s `Cpu` or `BrainCircuit` aren't exported, the build will complain — both are standard Lucide icons present in `lucide-react` v0.300+. The project's existing imports of other Lucide icons confirm the package is installed.)

- [ ] **Step 3: Production build**

```powershell
npm run build 2>&1 | tail -7
```

Expected: build succeeds. Note CSS+JS bundle sizes.

- [ ] **Step 4: Commit**

```powershell
git add src/components/DayCell.tsx
git commit -m "feat(fe): rewrite DayCell with adaptive band layout

- Sorts activities: projects first (alphabetical), studies after (alphabetical)
- Splits band-area 1=full / 2=horiz / 3=vert / 4=grid based on count
- Caps visible activities and banners at 4 and 2 respectively (+N overflow)
- Cpu icon for projects, BrainCircuit for studies, color = exam color
- Project edge stripes (proj-start/proj-end) via cell modifier classes
- Day number absolute bottom-right with text-shadow; empty cell centers it"
```

---

## Phase 3 — Frontend: ExamRow rewrite

### Task 4: Rewrite `ExamRow.tsx` with stripe + hover-revealed actions

**Files:**
- Modify: `src/components/ExamRow.tsx`

Removes the dot/square indicator and type chip; replaces with a colored left stripe. Meta string becomes terse (`2·6h` instead of `2 appelli · 4 giorni studio · 6h 30m`). Edit/delete buttons fade in on hover/focus.

- [ ] **Step 1: Rewrite `src/components/ExamRow.tsx` end-to-end**

Replace the entire contents of `src/components/ExamRow.tsx` with:

```tsx
import type { Exam } from "../types";
import { useExams } from "../state";
import { Pencil, Trash2 } from "lucide-react";

interface ExamRowProps {
  exam: Exam;
  onEdit: (id: number) => void;
}

function rangeDays(start: string, end: string): number {
  const s = new Date(start); const e = new Date(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
}

function metaText(e: Exam): string {
  if (e.kind === "progetto") {
    const tot = e.ranges.reduce((s, r) => s + rangeDays(r.start, r.end), 0);
    return `${tot}g`;
  }
  const nApp = e.appelli.length;
  const totMinutes = e.studyDays.reduce((s, d) => s + (d.minutes ?? 0), 0);
  if (totMinutes > 0) {
    const h = Math.floor(totMinutes / 60);
    const m = totMinutes % 60;
    const timePart = h > 0 ? (m > 0 ? `${h}h${m}m` : `${h}h`) : `${m}m`;
    return `${nApp}·${timePart}`;
  }
  return `${nApp}`;
}

export function ExamRow({ exam, onEdit }: ExamRowProps) {
  const { setPassed, remove } = useExams();

  const classes = [
    "exam-row-redesign",
    "lift-hover",
    exam.passed ? "passed" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      style={{ "--ec": exam.color } as React.CSSProperties}
    >
      <span className="exam-row-redesign-stripe" />
      <span className="exam-row-redesign-name">{exam.name}</span>
      <span className="exam-row-redesign-meta">{metaText(exam)}</span>
      <label
        className="flex items-center cursor-pointer shrink-0"
        title={exam.kind === "progetto" ? "Segna come completato" : "Segna come superato"}
      >
        <input
          type="checkbox"
          checked={exam.passed}
          onChange={(e) => void setPassed(exam.id, e.target.checked)}
          className="w-[15px] h-[15px] cursor-pointer accent-[#2f9e57]"
        />
      </label>
      <div className="exam-row-redesign-actions">
        <button
          type="button"
          onClick={() => onEdit(exam.id)}
          title="Modifica"
          aria-label="Modifica"
        ><Pencil size={13} /></button>
        <button
          type="button"
          title="Elimina"
          aria-label="Elimina"
          onClick={() => {
            if (confirm(`Eliminare "${exam.name}"?`)) void remove(exam.id);
          }}
        ><Trash2 size={13} /></button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```powershell
npx tsc --noEmit 2>&1 | tail -10
```

Expected: zero errors.

- [ ] **Step 3: Production build**

```powershell
npm run build 2>&1 | tail -7
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```powershell
git add src/components/ExamRow.tsx
git commit -m "feat(fe): rewrite ExamRow with left stripe + hover actions

Replaces dot/square indicator and type chip with a 3px colored left
stripe. Meta line shortened: '2·6h' instead of '2 appelli · 4 giorni
studio · 6h 30m'. Pencil/Trash2 buttons fade in on row hover/focus
(opacity 0 -> 1 over 0.18s, always visible under prefers-reduced-motion).
'passed' rows have line-through name + reduced opacity."
```

---

## Phase 4 — Verification

### Task 5: Full FE + Rust + bundle verification

**Files:**
- (No source changes — verification only.)

- [ ] **Step 1: Rust tests**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | grep "test result:" | head -3
```

Expected: `35 passed; 0 failed`.

- [ ] **Step 2: TypeScript strict check**

```powershell
npx tsc --noEmit 2>&1 | tail -10
```

Expected: zero errors.

- [ ] **Step 3: FE production build**

```powershell
npm run build 2>&1 | tail -7
```

Expected: build succeeds. CSS bundle should be ~33 KB (was ~30.6 KB before this redesign — growth from `@layer components` additions). JS bundle change is minimal (~+0.5 KB for new Lucide icons).

- [ ] **Step 4: Push branch**

```powershell
git push origin feat/tauri-port 2>&1 | tail -5
```

Expected: pushes Tasks 1-4 commits to remote.

- [ ] **Step 5: Manual visual smoke (USER DELEGATED)**

The controller asks the user to launch `npm run tauri dev` and confirm:

1. Sidebar ExamRow: left colored stripe visible, name and meta on one line, edit/delete buttons appear on hover.
2. Cell with 1 study: full cell tinted with that exam's color, single BrainCircuit icon centered.
3. Cell with 2 studies: top/bottom horizontal split, both tinted, both icons.
4. Cell with 3 activities (1 project + 2 studies): vertical 3-column split, Cpu in leftmost column, BrainCircuits in middle/right.
5. Cell with 4 activities: 2×2 quadrants.
6. Try to add a 5th study to an already-at-4 day → error toast `Massimo 4 attività per giorno (...)`.
7. Cell with an appello: banner with the exam name at top, in the exam's color.
8. Cell that is project start: 3px colored stripe on the LEFT edge.
9. Cell that is project end: 3px stripe on RIGHT edge.
10. Today's cell: bolder border regardless of content; bold day number.
11. Light theme: switch via settings → cell separator borders are blue-tinted; band icons drop a light shadow; day number text is navy with light-shadow.

Any failure → controller dispatches a follow-up fix subagent for the specific issue.

---

## Self-review notes

**Spec coverage check:**
- §2.2 ExamRow new visual → Task 4
- §2.4 Empty state preserved → unchanged in `Sidebar.tsx`, no task needed
- §3 Day cell (banners, band area, splits, edges, day number, today) → Tasks 1 (CSS) + 3 (component)
- §4 Icons (Cpu + BrainCircuit) → Task 3
- §5 4-activity cap (count_presences + toggle_study_day) → Task 2
- §5.2 Migration → none needed, runtime validation only
- §6.3 `index.css` additions → Task 1
- §6.4 types.ts unchanged → no task
- §6.5 db.ts unchanged → no task (validation error flows through existing toast pattern)
- §7 What stays unchanged → respected
- §9 Performance/a11y → CSS includes `prefers-reduced-motion`, focus-within fallback, drop-shadow filter for icon contrast — all in Task 1
- §10 Out of scope → not implemented (banner overflow is non-interactive — done in Task 3)

**Placeholder scan:** No TBDs. Every step has either complete code or an exact command with expected output. The manual smoke step in Task 5 is delegated to the user — that's appropriate.

**Type consistency:**
- `Activity` interface in DayCell.tsx (Task 3) is local; not referenced elsewhere — OK.
- `count_presences(conn: &Connection, date: &str) -> Result<usize, String>` matches its usage inside `toggle_study_day` and in tests (Task 2).
- CSS class names: `cell-redesign`, `band-area`, `band`, `band-icon`, `banners`, `banner`, `banner-dot`, `banner-overflow`, `proj-start`, `proj-end`, `cell-num`, `exam-row-redesign`, `exam-row-redesign-stripe`, `exam-row-redesign-name`, `exam-row-redesign-meta`, `exam-row-redesign-actions` — all consistent between Task 1 (definitions) and Tasks 3/4 (consumers).
- CSS custom properties: `--banner-bg` (set on banner inline), `--bc` (set on band inline), `--ec` (set on exam-row-redesign inline), `--proj-start-color`/`--proj-end-color` (set on cell-redesign inline) — all consistent.
