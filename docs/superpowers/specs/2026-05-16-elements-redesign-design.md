# Internal Elements Redesign — Design Spec

**Status:** Approved (design)
**Date:** 2026-05-16
**Branch:** `feat/tauri-port` (continues from Aurora restyle)
**Previous specs:** `2026-05-16-aurora-restyle-design.md` (Aurora visual layer)

## 1. Goal

Redesign the **internal elements** of the calendar UI (sidebar exam rows + day cell content) so they no longer look like a direct port of the HTML artifact. The Aurora layout/glass shell stays untouched; only the visual language of items inside it changes.

Direction: **Stripe** with horizontal-bands-per-activity. Adaptive cell division based on activity count, dedicated Lucide icons per activity type, banner stack for appelli.

## 2. Sidebar — ExamRow

### 2.1 Current state (to remove)

- Round dot or rounded square indicator
- Name with truncation
- "Esame" / "Progetto" gray/purple chip after the name
- Verbose meta line: `"2 appelli · 4 giorni studio · 6h 30m"`
- Always-visible `Pencil` (edit) and `Trash2` (delete) icon buttons
- `passed` checkbox

### 2.2 New visual

```
┌────────────────────────────────────────┐
│ ▌ Neuroanatomia              2·6h   ☐ │     (active esame)
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│ ▌ Tesina Fisiologia          14g    ☐ │     (active progetto)
└────────────────────────────────────────┘
```

- `border-left: 3px solid <exam.color>` along the entire row height. This single stripe encodes BOTH identity (color) and type implicitly (combined with icon hint in expanded state).
- Name: left-padded `5px` after stripe, truncated.
- Meta: 1 short line, right-aligned, low-opacity (`text-app-muted`). Format:
  - Esame: `${nAppelli}·${totalHours}h` (e.g., `2·6h`) — drops "giorno studio" verbose part. If no studied hours, show only `${nAppelli}` appelli count.
  - Progetto: `${totalDays}g` (e.g., `14g`)
- `passed` checkbox: same as today, right-aligned, accent green.
- Edit/Delete: HIDDEN by default. **Revealed on row hover** via a small `MoreHorizontal` (Lucide) icon button on the right, OR by hovering the row and seeing inline edit/delete icons fade in. **Choice: inline icons, fade in on row hover** (simpler than a popover menu).

### 2.3 Sidebar list ordering

Same as today (alphabetical by name, separating active and passed). No change.

### 2.4 Empty state

Same as today: `"Niente ancora. Aggiungi un esame o un progetto qui sotto."`

## 3. Day cell — `DayCell.tsx`

### 3.1 Conceptual model

A cell has two stacked regions in normal flex flow:

1. **Banner stack** (top, `flex-shrink: 0`): one banner per appello (up to 2 banners visible; if 3+ appelli — rare — overflow indicator `+N` at end of stack).
2. **Band area** (`flex: 1`): the rest. Hosts colored bands for each "activity" (project + study).

### 3.2 Activity = "colored presence" of an item on a day

Per cell, compute the activity list:
- 1 entry per active project whose range covers this day → activity `{kind: "project", color, examId}` with icon `Cpu`.
- 1 entry per active esame whose `studyDays` includes this day → activity `{kind: "study", color, examId}` with icon `BrainCircuit`.

**Sort order:** projects first (alphabetical by name), then studies (alphabetical by name). Project icon thus always appears at the "first" position regardless of layout.

**Cap = 4.** Cells with 5+ activities are **forbidden at the data layer**: the Rust `toggle_study_day` command returns `Err("Massimo 4 attività per giorno (progetti + esami in studio)")` if accepting the toggle would push the count over 4. The FE surfaces this as a toast.

### 3.3 Adaptive split layout

Based on `activities.length`:

| N | Layout | CSS approach |
|---|---|---|
| 0 | No band area visible. Cell shows just the day number. | `.band-area` not rendered |
| 1 | Full band area, one icon centered | `.split-1` (flex column, single child) |
| 2 | Two horizontal bands top/bottom | `.split-2` (`flex-direction: column`) |
| 3 | Three vertical bands left/middle/right | `.split-3` (`flex-direction: row`) |
| 4 | 2×2 grid (TL, TR, BL, BR) | `.split-4` (`display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr`) |

Each band: `background: color-mix(in srgb, <activity.color> 30%, transparent)`, with the activity's icon centered.

Borders between bands: thin separator `1px solid rgba(255,255,255,0.10)` (dark theme) / `1px solid rgba(70,130,240,0.15)` (light theme). Direction depends on split.

### 3.4 Banners (appelli)

For each appello on this day, render one `.banner` inside the `.banners` stack at the top of the cell:

```
┌────────────────────────────┐
│ ● Neuroanat                │  ← banner row (~14px tall)
├────────────────────────────┤
│ <band-area>                │
│                            │
│                       12 │ (← day number, bottom-right)
└────────────────────────────┘
```

- Banner: `background: <exam.color>`, white text, full width edge-to-edge, padding `2px 5px`, font-size `9.5px` (slightly smaller than current), font-weight `700`.
- Prefix: 3.5px white dot before the name.
- Separator between stacked banners: `inset 0 1px 0 rgba(255,255,255,.15)`.
- Maximum visible: 2. If 3+ appelli, render the first 2 + an overflow row `+N altri` styled like a banner but without color (dim `rgba(255,255,255,.10)` background).

### 3.5 Project edge stripes

Cell-level (NOT band-level), absolute positioning, `z-index: 4`:
- Project START day: `4px` colored stripe along the LEFT edge of the cell (top-to-bottom).
- Project END day: `4px` colored stripe along the RIGHT edge.
- Start AND end same day: both stripes.

These sit above the bands but below the day number's text-shadow protection.

### 3.6 Day number

- Position: `absolute; bottom: 3px; right: 5px`.
- Font-size: `10px`, weight `700`.
- Color: `rgba(255, 255, 255, 0.85)` in dark / `rgba(26, 37, 64, 0.85)` in light.
- `text-shadow: 0 0 4px rgba(0, 0, 0, 0.6)` in dark / `0 0 4px rgba(255, 255, 255, 0.8)` in light — to maintain contrast over any band color.
- Empty cell (no activities, no banners): number centered, larger (`14px`), no text-shadow.

### 3.7 Today indicator

Today's cell **always** has a stronger border (`var(--color-app-fg)` at 40% alpha) regardless of content, so it stays identifiable. When the cell is empty AND today, it also gets a `bg-app-card` tint (lighter than other empty cells). When today has activities or banners, the bands/banners take the visible area but the stronger border still marks the cell.

```css
.cell.today { border-color: color-mix(in srgb, var(--color-app-fg) 40%, transparent); }
.cell.today.empty { background: color-mix(in srgb, var(--color-app-fg) 8%, transparent); }
```

The day number stays bold (`font-weight: 800`) on today regardless of content state.

## 4. Icons

Both from `lucide-react`:

| Activity | Icon | Color | Size |
|---|---|---|---|
| Project (range day) | `Cpu` | `<exam.color>` | `12px` in cell, `16px` in showcase / hover preview |
| Study (toggle day) | `BrainCircuit` | `<exam.color>` | `12px` in cell |

Stroke width `2.2` (Lucide default is 2; bumped slightly for legibility at small size). Icons centered in their band via `display: flex; align-items: center; justify-content: center`.

`filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.4))` in dark / no shadow in light — protects icon contrast over its band's tinted background.

## 5. Data-layer constraint (Rust)

### 5.1 The 4-activity cap

Add a helper in `src-tauri/src/db/exams.rs`:

```rust
/// Counts presences for an exam on a given day:
///   - project: number of active project ranges covering `date`
///   - study: number of esami with `date` in their study_days
/// Returns the total. Used to enforce the UI's 4-presence cap.
pub fn count_presences(conn: &Connection, date: &str) -> Result<usize, String>;
```

In `toggle_study_day`:
- If the toggle would ADD a study (current state = absent), check `count_presences` BEFORE inserting. If it would reach 5+, return `Err("Massimo 4 attività per giorno (progetti + esami in studio)")`.
- Toggle OFF is always allowed.

Similarly:
- `create_exam` / `update_exam` for a project: if any day inside the new ranges would already have 4 presences (excluding the project itself if updating), reject with `Err("Il periodo del progetto colliderebbe: ci sono giorni con già 4 attività attive")`. List of conflicting dates included in the error string (max first 3 dates).

This is a hard cap at the data layer. The FE doesn't need to pre-check — it shows the error toast verbatim.

### 5.2 Migration

No DB migration needed — this is pure runtime validation on existing schema.

## 6. Frontend implementation

### 6.1 `DayCell.tsx` rewrite

```tsx
interface Activity {
  kind: "project" | "study";
  color: string;
  examId: number;
  examName: string;
}

interface Appello {
  color: string;
  examName: string;
}

// Inside DayCell, derived from props:
const activities: Activity[] = buildActivities(day.key, exams);     // already-sorted
const appelli: Appello[] = buildAppelli(day.key, exams);
const projectEdges = computeProjectEdges(day.key, exams);  // { start: boolean, end: boolean }

const splitClass = `split-${Math.min(activities.length, 4)}`;
```

JSX structure:

```tsx
<button class="cell ${today ? 'today' : ''} ${activities.length === 0 ? 'empty' : ''}
                ${projectEdges.start ? 'proj-start' : ''}
                ${projectEdges.end ? 'proj-end' : ''}">
  {appelli.length > 0 && (
    <div class="banners">
      {appelli.slice(0, 2).map(a => (
        <div class="banner" style={{ background: a.color }}>
          <span class="banner-dot" />
          {a.examName}
        </div>
      ))}
      {appelli.length > 2 && (
        <div class="banner banner-overflow">+{appelli.length - 2} altri</div>
      )}
    </div>
  )}
  {activities.length > 0 && (
    <div class="band-area ${splitClass}">
      {activities.map(a => (
        <div class="band" style={{ '--bc': a.color }}>
          {a.kind === 'project'
            ? <Cpu className="band-icon" />
            : <BrainCircuit className="band-icon" />}
        </div>
      ))}
    </div>
  )}
  <span class="cell-num">{day.day}</span>
</button>
```

Inline `style={{ '--bc': a.color }}` because tints are per-activity-color and Tailwind can't generate them all.

### 6.2 `ExamRow.tsx` redesign

```tsx
<div className="exam-row lift-hover" style={{ '--ec': exam.color }}>
  <div class="exam-row-stripe" />
  <span class="exam-row-name">{exam.name}</span>
  <span class="exam-row-meta">{metaText(exam)}</span>
  <input type="checkbox" .../>
  <div class="exam-row-actions">
    <button onClick={onEdit}><Pencil size={13} /></button>
    <button onClick={onDelete}><Trash2 size={13} /></button>
  </div>
</div>
```

CSS: `.exam-row-actions` is `opacity: 0` by default, `opacity: 1` on `.exam-row:hover`, with a smooth `transition: opacity 0.18s ease`. `prefers-reduced-motion: reduce` → `opacity: 1` always (always visible to avoid surprise).

Meta text helper:

```ts
function metaText(e: Exam): string {
  if (e.kind === "progetto") {
    const totDays = e.ranges.reduce(
      (s, r) => s + (Math.round((+new Date(r.end) - +new Date(r.start)) / 86_400_000) + 1),
      0
    );
    return `${totDays}g`;
  }
  const nApp = e.appelli.length;
  const totMinutes = e.studyDays.reduce((s, d) => s + (d.minutes ?? 0), 0);
  if (totMinutes > 0) {
    const h = Math.floor(totMinutes / 60);
    const m = totMinutes % 60;
    return `${nApp}·${h > 0 ? `${h}h` : ''}${m > 0 ? `${m}m` : ''}`.replace(/·$/, '');
  }
  return `${nApp}`;
}
```

(Removes verbose ` appelli` / ` giorno studio` text. Just numbers + `·` separator + optional `h/m` suffix.)

### 6.3 `index.css` additions

New `@layer components` block (appended below existing `glass-panel`/`lift-hover`):

```css
@layer components {
  /* === Day cell === */
  .cell {
    /* existing base from Aurora restyle: padding, border, bg, etc. */
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .cell .banners {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    z-index: 5;
  }
  .cell .banner {
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
  .cell .banner + .banner { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15); }
  .cell .banner-dot {
    width: 3.5px; height: 3.5px; border-radius: 50%;
    background: rgba(255, 255, 255, 0.95);
    flex-shrink: 0;
  }
  .cell .banner-overflow {
    background: var(--color-app-soft);  /* theme-aware via token */
    color: var(--color-app-muted);
    font-weight: 600;
  }

  .cell .band-area {
    flex: 1;
    min-height: 0;
    position: relative;
    display: flex;
  }
  .cell .band-area.split-1 { flex-direction: column; }
  .cell .band-area.split-2 { flex-direction: column; }
  .cell .band-area.split-3 { flex-direction: row; }
  .cell .band-area.split-4 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  }

  .cell .band {
    flex: 1;
    position: relative;
    min-height: 0;
    min-width: 0;
    background: color-mix(in srgb, var(--bc) 30%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cell .band-icon {
    color: var(--bc);
    width: 12px;
    height: 12px;
    filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.4));
  }
  /* light mode: weaker shadow */
  :not(.dark) .cell .band-icon {
    filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.5));
  }

  .cell .band-area.split-2 .band + .band { border-top: 1px solid var(--cell-band-sep); }
  .cell .band-area.split-3 .band + .band { border-left: 1px solid var(--cell-band-sep); }
  .cell .band-area.split-4 .band {
    border-right: 1px solid var(--cell-band-sep);
    border-bottom: 1px solid var(--cell-band-sep);
  }
  .cell .band-area.split-4 .band:nth-child(2),
  .cell .band-area.split-4 .band:nth-child(4) { border-right: none; }
  .cell .band-area.split-4 .band:nth-child(3),
  .cell .band-area.split-4 .band:nth-child(4) { border-bottom: none; }

  /* Project edge stripes */
  .cell.proj-start::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--proj-start-color);
    z-index: 4;
  }
  .cell.proj-end::after {
    content: "";
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--proj-end-color);
    z-index: 4;
  }

  .cell-num {
    position: absolute;
    bottom: 3px;
    right: 5px;
    z-index: 6;
    font-size: 10px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.85);
    text-shadow: 0 0 4px rgba(0, 0, 0, 0.6);
  }
  :not(.dark) .cell-num {
    color: rgba(26, 37, 64, 0.85);
    text-shadow: 0 0 4px rgba(255, 255, 255, 0.8);
  }
  .cell.empty .cell-num {
    position: static;
    font-size: 14px;
    color: var(--color-app-muted);
    text-shadow: none;
    align-self: center;
    margin: auto;
  }
  .cell.empty { align-items: center; justify-content: center; }

  /* === Exam row === */
  .exam-row {
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
  .exam-row-stripe {
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--ec);
  }
  .exam-row-name {
    flex: 1;
    min-width: 0;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--color-app-fg);
    margin-left: 9px; /* 3px stripe + 6px gap */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .exam-row.passed .exam-row-name { text-decoration: line-through; opacity: 0.65; }
  .exam-row-meta {
    font-size: 10px;
    color: var(--color-app-muted);
    flex-shrink: 0;
  }
  .exam-row-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.18s ease;
  }
  .exam-row:hover .exam-row-actions { opacity: 1; }
  .exam-row-actions button {
    padding: 3px;
    border-radius: 4px;
    color: var(--color-app-muted);
  }
  .exam-row-actions button:hover {
    background: var(--color-app-hover);
    color: var(--color-app-fg);
  }
  @media (prefers-reduced-motion: reduce) {
    .exam-row-actions { opacity: 1; transition: none; }
  }
}

/* Band separator color responds to theme */
:root { --cell-band-sep: rgba(70, 130, 240, 0.15); }
.dark  { --cell-band-sep: rgba(255, 255, 255, 0.10); }
```

### 6.4 `types.ts`

No changes. Existing `Exam` already has `studyDays: StudyDay[]`, `appelli`, `ranges`, `color`, `kind`, etc.

### 6.5 `db.ts`

No changes to existing wrappers. The new validation error from `toggle_study_day` flows through as a thrown error → caught by `ExamsProvider` → surfaced as toast (existing pattern).

## 7. What stays unchanged

- Aurora layout (sidebar 290px, main panel, glass surfaces, drift)
- Section switcher
- Settings/Day/Import modals (functional + styling)
- Settings gear bottom-right
- Calendar header (prev/next/Oggi)
- Weekday row labels
- DB schema, migrations
- Tauri commands list (`toggle_study_day` signature unchanged — only its validation tightens)
- Theme system (Aurora dark + light)
- Exam color palette (12 colors)
- Settings modal theme picker
- ImportModal flow

## 8. Visual examples (per V7b mockup)

### 8.1 Activity count → layout

| N | Layout |
|---|---|
| 0 | empty cell, day number centered |
| 1 | full cell, 1 icon centered |
| 2 | top/bottom 50/50 |
| 3 | left/middle/right 33/33/33 |
| 4 | 2×2 quadrants |
| 5+ | data-layer rejection |

### 8.2 With banners

Banner stack at top (1 banner = ~14px, 2 banners = ~28px). Band-area takes the remaining `flex: 1` height. Internal split proportions (50/50, 33/33/33, 2×2) are calculated on the remaining height, NOT on full cell height.

## 9. Performance / a11y

- `band-icon` is a Lucide stroke icon at 12×12 → ~2 KB SVG each, GPU compositable.
- `color-mix(in srgb, var(--bc) 30%, transparent)` is a single composite, no JS computation.
- `prefers-reduced-motion`: hover-reveal of exam-row actions falls back to always-visible.
- Hover-revealed actions remain reachable by keyboard (`tab` focuses them, focus state opens via `:focus-within`).

```css
.exam-row:focus-within .exam-row-actions { opacity: 1; }
```

## 10. Out of scope (v1 of this redesign)

- ⛔ Banner overflow indicator behavior with 3+ appelli is rare enough that we ship "+N altri" but don't make it interactive (clicking doesn't expand). v2 could open the day modal pre-scrolled to appelli.
- ⛔ Custom user choice of icon per esame.
- ⛔ Drag-to-reorder activities within a multi-band cell.
- ⛔ Animated transitions when bands change count (split-2 → split-3) — left as instant.
- ⛔ Sidebar: collapsible groups (Tutti / Per stato / Per data prossima). Same flat list as today.

## 11. Open items — all resolved

| Item | Decision |
|---|---|
| Sub-direction (Pill / Stripe / Airy) | **Stripe** |
| Studio mantiene area colorata | sì |
| Distinzione esame ≠ studio | banner per appello + icone diverse (Cpu vs BrainCircuit) per banda |
| Progetto sempre visibile in combinazioni | sì, sempre una banda dedicata |
| Icona attività | `Cpu` (progetto), `BrainCircuit` (studio) |
| Banner spinge giù le bande | sì, normal-flow flex children |
| Cap attività per giorno | 4 max, enforced lato Rust |
| Cell split per N | 1=pieno, 2=orizzontale, 3=verticale, 4=2×2, 5+=vietato |
