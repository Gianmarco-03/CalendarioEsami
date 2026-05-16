# Aurora Restyle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the "Aurora" visual restyle (glass surfaces over a single-color blue ambient layer) to the existing Tauri calendar app, in both dark (default) and light themes, with subtle motion. Pure CSS + token changes; no structural / schema / API impact.

**Architecture:** Update CSS variables in `src/index.css` (theme tokens + new `@layer components` for `glass-panel` and `lift-hover`). Mount a fixed ambient gradient layer with 3 animated blobs in `App.tsx`. Apply new component classes to existing React components — no React structural changes, only class swaps.

**Tech Stack:** Tailwind CSS v4 (`@theme`, `@custom-variant`, `@layer components`), React 19, vanilla CSS keyframes.

**Spec:** `docs/superpowers/specs/2026-05-16-aurora-restyle-design.md`

**Conventions for this plan:**

- All commands assume PowerShell on Windows, cwd = `C:\Users\Gianmarco\Desktop\Calendario-app`.
- Every task ends with a commit. Commit messages use conventional commits (`feat`, `style`, `chore`, `docs`).
- Verification: `npx tsc --noEmit` and `npm run build`. Both must pass after each task.
- Visual verification is left for the final task (Task 6) — intermediate tasks are verified via build/TS only because Tauri dev server is long-running.

---

## Phase 0 — Foundations

### Task 1: Replace theme tokens with Aurora palette

**Files:**
- Modify: `src/index.css` (the entire `@theme {}` block and the entire `.dark { … }` block)

This task rewrites the design tokens. The visual feel of the app will shift immediately — components that already use semantic class names (`bg-app-card`, `text-app-fg`, etc.) automatically pick up the new look. Surfaces become semi-transparent on this task even though there's no ambient layer behind them yet (Task 2 adds it).

- [ ] **Step 1: Open the file and locate the two blocks**

Open `src/index.css`. You'll see:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-app-bg: #f4f5f7;
  ...
}

.dark {
  --color-app-bg: #0b0d12;
  ...
}

@layer base { ... }

@keyframes fade-in { ... }
```

You're replacing the contents of `@theme { … }` and `.dark { … }` only. Leave the `@import`, `@custom-variant`, `@layer base`, and `@keyframes fade-in` blocks untouched (in this task).

- [ ] **Step 2: Replace `@theme` block**

Replace the entire `@theme { … }` block with:

```css
@theme {
  /* Base / surfaces */
  --color-app-bg: #eef3fb;
  --color-app-card: rgba(255, 255, 255, 0.72);
  --color-app-cell: rgba(255, 255, 255, 0.60);
  --color-app-cell-border: rgba(70, 130, 240, 0.10);
  --color-app-soft: rgba(70, 130, 240, 0.10);
  --color-app-hover: rgba(70, 130, 240, 0.08);

  /* Borders */
  --color-app-border: rgba(70, 130, 240, 0.18);
  --color-app-input-bg: #ffffff;
  --color-app-input-border: rgba(70, 130, 240, 0.18);

  /* Text */
  --color-app-fg: #1a2540;
  --color-app-muted: #5a6585;

  /* Accent */
  --color-app-accent: #1a2540;
  --color-app-accent-fg: #ffffff;
  --color-app-accent-hover: #0e1730;

  /* Ambient layer (Aurora) */
  --aurora-1: rgba(70, 130, 240, 0.20);
  --aurora-2: rgba(120, 180, 255, 0.15);
  --aurora-3: rgba(255, 180, 200, 0.13);

  /* Blur intensities */
  --blur-strong: 16px;
  --blur-medium: 12px;

  /* Exam palette - INVARIATA */
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
```

- [ ] **Step 3: Replace `.dark` block**

Replace the entire `.dark { … }` block with:

```css
.dark {
  --color-app-bg: #060916;
  --color-app-card: rgba(20, 25, 45, 0.55);
  --color-app-cell: rgba(255, 255, 255, 0.025);
  --color-app-cell-border: rgba(255, 255, 255, 0.06);
  --color-app-soft: rgba(255, 255, 255, 0.06);
  --color-app-hover: rgba(255, 255, 255, 0.10);

  --color-app-border: rgba(255, 255, 255, 0.08);
  --color-app-input-bg: rgba(255, 255, 255, 0.06);
  --color-app-input-border: rgba(255, 255, 255, 0.10);

  --color-app-fg: #e7ebf2;
  --color-app-muted: rgba(255, 255, 255, 0.55);

  --color-app-accent: #e7ebf2;
  --color-app-accent-fg: #060916;
  --color-app-accent-hover: #ffffff;

  --aurora-1: rgba(70, 130, 240, 0.55);
  --aurora-2: rgba(40, 100, 200, 0.40);
  --aurora-3: rgba(70, 130, 240, 0.30);
}
```

Notes:
- `--color-app-card` becomes semi-transparent. Components currently using `bg-app-card` will look "see-through" until Task 2 adds the ambient backdrop. This is expected, not a bug.
- `--color-exam-*` is preserved — the 12 exam colors don't change.

- [ ] **Step 4: TypeScript + build verification**

Run:

```powershell
npx tsc --noEmit
```

Expected: zero errors (CSS changes shouldn't affect TS, but verifying).

Run:

```powershell
npm run build
```

Expected: build succeeds, you'll see `dist/assets/index-*.css` and `dist/assets/index-*.js` produced. The CSS size may change slightly.

- [ ] **Step 5: Commit**

```powershell
git add src/index.css
git commit -m "style(aurora): rewrite theme tokens for Aurora palette

Light: bg #eef3fb + glass surfaces (rgba .72 card, .60 cell) on blue-tinted
borders. Dark: bg #060916 + glass surfaces (rgba .55 card, .025 cell).
Adds --aurora-1/2/3 ambient color tokens and --blur-strong/medium intensities.
Exam palette (12 colors) preserved."
```

---

### Task 2: Add Aurora ambient gradient layer + keyframes

**Files:**
- Modify: `src/index.css` (append keyframes + ambient layer styles)
- Modify: `src/App.tsx` (mount `<AuroraBackground/>` as first root child)

Adds a fixed, full-viewport ambient background with 3 slowly-drifting blue blobs that bleed through the glass surfaces.

- [ ] **Step 1: Append ambient CSS to `src/index.css`**

Open `src/index.css`. At the very end of the file (after the existing `@keyframes fade-in`), append:

```css
/* ============ Aurora ambient layer ============ */

.aurora-bg {
  position: fixed;
  inset: 0;
  z-index: -10;
  pointer-events: none;
  overflow: hidden;
}

.aurora-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  will-change: transform, opacity;
}

.aurora-blob-1 {
  top: -10%;
  left: -5%;
  width: 60vw;
  height: 60vw;
  background: radial-gradient(circle, var(--aurora-1) 0%, transparent 60%);
  animation: aurora-drift-1 14s ease-in-out infinite;
}

.aurora-blob-2 {
  bottom: -15%;
  right: -10%;
  width: 70vw;
  height: 70vw;
  background: radial-gradient(circle, var(--aurora-2) 0%, transparent 55%);
  animation: aurora-drift-2 18s ease-in-out infinite;
}

.aurora-blob-3 {
  top: 30%;
  right: 5%;
  width: 40vw;
  height: 40vw;
  background: radial-gradient(circle, var(--aurora-3) 0%, transparent 60%);
  animation: aurora-drift-3 22s ease-in-out infinite;
  opacity: 0.7;
}

@keyframes aurora-drift-1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(8%, 6%) scale(1.08); }
}
@keyframes aurora-drift-2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(-6%, -4%) scale(0.95); }
}
@keyframes aurora-drift-3 {
  0%, 100% { transform: translate(0, 0); opacity: 0.7; }
  50%      { transform: translate(4%, -3%); opacity: 0.9; }
}

@media (prefers-reduced-motion: reduce) {
  .aurora-blob-1,
  .aurora-blob-2,
  .aurora-blob-3 {
    animation: none !important;
  }
}
```

- [ ] **Step 2: Mount the ambient layer in `App.tsx`**

Open `src/App.tsx`. The current `Shell()` function returns (after the `initError` guard):

```tsx
return (
  <div className="h-screen w-screen bg-app-bg text-app-fg p-4 overflow-hidden transition-colors">
    <div className="h-full w-full flex gap-4">
      <Sidebar ... />
      <main ...> ... </main>
    </div>
    <ExamModal ... />
    <DayModal ... />
    <ImportModal ... />
    <SettingsModal ... />
  </div>
);
```

You're injecting an `<div className="aurora-bg">` as the **first child** of the outer `<div>` (before `<div className="h-full w-full flex gap-4">`). The new return:

```tsx
return (
  <div className="h-screen w-screen bg-app-bg text-app-fg p-4 overflow-hidden transition-colors relative">
    <div className="aurora-bg" aria-hidden="true">
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      <div className="aurora-blob aurora-blob-3" />
    </div>
    <div className="relative z-0 h-full w-full flex gap-4">
      <Sidebar
        section={section}
        onSectionChange={setSection}
        onAdd={openCreate}
        onEdit={openEdit}
        onImport={() => setImportOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <main className="flex-1 min-w-0 h-full flex flex-col rounded-2xl bg-app-card border border-app-border shadow-sm p-4 overflow-hidden">
        <h1 className="flex items-center gap-2 text-base font-semibold mb-3 shrink-0">
          {(() => { const I = SECTION_META[section].Icon; return <I size={18} />; })()}
          {SECTION_META[section].label}
        </h1>
        <div key={section} className="flex-1 min-h-0 flex flex-col animate-[fade-in_220ms_ease-out]">
          {section === "calendar" && <Calendar onDayClick={setDayKey} />}
          {section === "stats" && <StatsView />}
          {section === "todo" && <TodoView />}
        </div>
      </main>
    </div>
    <ExamModal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      editing={editing}
      initialKind={modalKind}
    />
    <DayModal open={dayKey !== null} dayKey={dayKey} onClose={() => setDayKey(null)} />
    <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
  </div>
);
```

Key changes:
- Outer `<div>` gains `relative` class (so `aurora-bg` z-index baseline is meaningful).
- New `<div className="aurora-bg" aria-hidden>` with 3 blobs as first child.
- Existing inner `<div className="h-full w-full flex gap-4">` gains `relative z-0` to stack above the ambient layer.

- [ ] **Step 3: Build verification**

```powershell
npx tsc --noEmit
```

Expected: zero errors.

```powershell
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```powershell
git add src/index.css src/App.tsx
git commit -m "feat(aurora): fixed ambient layer with 3 drifting blobs

Three radial-gradient blobs (60vw / 70vw / 40vw) animate on 14/18/22s
loops via @keyframes translate+scale. Filter blur(60px) softens edges.
Respects prefers-reduced-motion. Mounted as fixed -z-10 layer in App.tsx;
existing content gets relative z-0 to render above."
```

---

## Phase 1 — Component classes

### Task 3: Add `glass-panel` and `lift-hover` component utilities

**Files:**
- Modify: `src/index.css` (insert new `@layer components { … }` block)

Introduces two reusable classes used by multiple components in subsequent tasks. Standalone task so that diffs in Tasks 4-7 only contain consumer-side changes.

- [ ] **Step 1: Insert `@layer components` block**

Open `src/index.css`. Find the existing `@layer base { … }` block. Immediately AFTER its closing brace, INSERT this new block (before `@keyframes fade-in`):

```css
@layer components {
  .glass-panel {
    background: var(--color-app-card);
    backdrop-filter: blur(var(--blur-strong)) saturate(160%);
    -webkit-backdrop-filter: blur(var(--blur-strong)) saturate(160%);
    border: 1px solid var(--color-app-border);
    transition: background-color 0.25s, border-color 0.25s;
  }

  .glass-input {
    background: var(--color-app-input-bg);
    border: 1px solid var(--color-app-input-border);
    color: var(--color-app-fg);
  }
  .glass-input::placeholder {
    color: var(--color-app-muted);
  }

  .lift-hover {
    transition:
      transform 0.18s ease,
      box-shadow 0.18s ease,
      background-color 0.18s ease;
  }
  .lift-hover:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(70, 130, 240, 0.15);
  }
  .dark .lift-hover:hover {
    box-shadow: 0 4px 14px rgba(70, 130, 240, 0.25);
  }

  @media (prefers-reduced-motion: reduce) {
    .lift-hover {
      transition: none;
    }
    .lift-hover:hover {
      transform: none;
      box-shadow: none;
    }
  }
}
```

- [ ] **Step 2: Build verification**

```powershell
npm run build
```

Expected: build succeeds. CSS bundle size grows by ~0.4 KB.

- [ ] **Step 3: Commit**

```powershell
git add src/index.css
git commit -m "style(aurora): @layer components glass-panel + lift-hover utilities

glass-panel = bg + backdrop-blur + border in one class for consistent
glass surfaces. lift-hover = subtle translateY(-1px) + soft glow on hover,
respecting prefers-reduced-motion. No consumer code uses them yet."
```

---

### Task 4: Apply `glass-panel` to Sidebar and main panel

**Files:**
- Modify: `src/components/Sidebar.tsx` (sidebar root className)
- Modify: `src/App.tsx` (main panel className)

Swaps the existing `bg-app-card border border-app-border` pattern for the new `glass-panel` class on the two major surfaces.

- [ ] **Step 1: Update Sidebar root className**

Open `src/components/Sidebar.tsx`. Locate the `<aside>` element near the top of the JSX. Its current className is:

```tsx
<aside className="w-[290px] shrink-0 h-full overflow-y-auto rounded-2xl bg-app-card border border-app-border shadow-sm p-4 flex flex-col">
```

Replace with:

```tsx
<aside className="w-[290px] shrink-0 h-full overflow-y-auto rounded-2xl glass-panel shadow-sm p-4 flex flex-col">
```

(`bg-app-card border border-app-border` removed; `glass-panel` added.)

- [ ] **Step 2: Update main panel className in `App.tsx`**

Open `src/App.tsx`. Locate the `<main>` element. Its current className is:

```tsx
<main className="flex-1 min-w-0 h-full flex flex-col rounded-2xl bg-app-card border border-app-border shadow-sm p-4 overflow-hidden">
```

Replace with:

```tsx
<main className="flex-1 min-w-0 h-full flex flex-col rounded-2xl glass-panel shadow-sm p-4 overflow-hidden">
```

- [ ] **Step 3: Build verification**

```powershell
npx tsc --noEmit
```

Expected: zero errors.

```powershell
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```powershell
git add src/components/Sidebar.tsx src/App.tsx
git commit -m "style(aurora): apply glass-panel to Sidebar + main panel

Replaces 'bg-app-card border border-app-border' with single 'glass-panel'
class on the two largest surfaces. Adds backdrop-filter blur 16px
saturate 160% so the ambient layer bleeds through."
```

---

### Task 5: Apply `glass-panel` to Modal container; enhance overlay

**Files:**
- Modify: `src/components/Modal.tsx` (overlay backdrop-blur + container className)

The Modal currently uses `bg-app-card border border-app-border` for its container and a solid backdrop. Switch to `glass-panel` + add a blurred backdrop.

- [ ] **Step 1: Read current Modal**

The current `src/components/Modal.tsx` has:

```tsx
return (
  <div
    className="fixed inset-0 z-40 bg-[rgba(20,24,40,0.42)] flex items-center justify-center p-5"
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    <div className="bg-app-card text-app-fg rounded-2xl w-[380px] max-w-full max-h-[88vh] overflow-auto shadow-2xl border border-app-border">
      …
```

- [ ] **Step 2: Replace overlay + container**

Replace those two lines with:

```tsx
return (
  <div
    className="fixed inset-0 z-40 bg-black/30 backdrop-blur-md flex items-center justify-center p-5"
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    <div className="text-app-fg rounded-2xl w-[380px] max-w-full max-h-[88vh] overflow-auto shadow-2xl glass-panel">
      …
```

Changes:
- Overlay: `bg-[rgba(20,24,40,0.42)]` → `bg-black/30 backdrop-blur-md` (Tailwind utilities; same effect with consistent blur).
- Container: removed `bg-app-card`, `border border-app-border`; added `glass-panel` (which provides bg + border + backdrop-filter).

- [ ] **Step 3: Build verification**

```powershell
npx tsc --noEmit
```

Expected: zero errors.

```powershell
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```powershell
git add src/components/Modal.tsx
git commit -m "style(aurora): glass modal container + blurred overlay

Overlay uses bg-black/30 + backdrop-blur-md (instead of solid rgba).
Container uses glass-panel for consistent translucent surface with
backdrop blur. Visible Aurora ambient bleeds through both layers."
```

---

### Task 6: Apply `lift-hover` to DayCell + ExamRow; remove old outline

**Files:**
- Modify: `src/components/DayCell.tsx` (remove `hover:outline-*`, add `lift-hover`)
- Modify: `src/components/ExamRow.tsx` (add `lift-hover` to row)

DayCell's hover state is currently an outline ring; ExamRow has no hover affordance. Both gain the soft lift+glow.

- [ ] **Step 1: Update DayCell**

Open `src/components/DayCell.tsx`. Locate the `<button>` element. Its current className is:

```tsx
className={
  "relative w-full h-full p-1 border border-app-cell-border rounded-lg bg-app-cell text-app-fg text-left overflow-hidden " +
  "hover:outline hover:outline-2 hover:outline-app-muted hover:outline-offset-[-2px]"
}
```

Replace with:

```tsx
className={
  "lift-hover relative w-full h-full p-1 border border-app-cell-border rounded-lg bg-app-cell text-app-fg text-left overflow-hidden"
}
```

(Removed: `hover:outline hover:outline-2 hover:outline-app-muted hover:outline-offset-[-2px]`. Added: `lift-hover`.)

- [ ] **Step 2: Update ExamRow**

Open `src/components/ExamRow.tsx`. Locate the outer `<div>` of the row. Its current className is:

```tsx
className={
  "flex items-center gap-2 p-2 rounded-lg border border-app-border mb-1.5 bg-app-soft " +
  (exam.passed ? "opacity-65" : "")
}
```

Replace with:

```tsx
className={
  "lift-hover flex items-center gap-2 p-2 rounded-lg border border-app-border mb-1.5 bg-app-soft " +
  (exam.passed ? "opacity-65" : "")
}
```

(Just added `lift-hover` at the start.)

- [ ] **Step 3: Build verification**

```powershell
npx tsc --noEmit
```

Expected: zero errors.

```powershell
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```powershell
git add src/components/DayCell.tsx src/components/ExamRow.tsx
git commit -m "style(aurora): lift-hover micro-interaction on cells and rows

DayCell drops the harsh outline-ring hover for a translateY(-1px) +
soft blue glow. ExamRow gets the same treatment for consistency.
Reduced-motion users see no transform."
```

---

### Task 7: Polish — SectionSwitcher pill + Toast tint + Sidebar/Modal action buttons

**Files:**
- Modify: `src/components/SectionSwitcher.tsx` (pill backdrop-blur)
- Modify: `src/toast.tsx` (variant bgs become translucent + backdrop-blur)

Small polish to make the remaining surfaces consistent with Aurora.

- [ ] **Step 1: Update SectionSwitcher pill**

Open `src/components/SectionSwitcher.tsx`. Locate the `<span>` with class starting `"absolute top-1 bottom-1 ..."`. Its current className is:

```tsx
className="absolute top-1 bottom-1 rounded-lg bg-app-card shadow-sm border border-app-border transition-all duration-300 ease-out"
```

Replace with:

```tsx
className="absolute top-1 bottom-1 rounded-lg glass-panel shadow-sm transition-all duration-300 ease-out"
```

(Removed `bg-app-card border border-app-border` — these are now inside `glass-panel`.)

- [ ] **Step 2: Update Toast variants**

Open `src/toast.tsx`. Locate the toast rendering — the `<div>` with the conditional className that picks variant colors. The current code is:

```tsx
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
```

Replace with:

```tsx
<div
  key={t.id}
  className={
    "pointer-events-auto rounded-lg px-4 py-2 text-sm font-medium shadow-lg border backdrop-blur-md " +
    (t.variant === "error"
      ? "bg-red-500/15 border-red-400/40 text-red-900 dark:text-red-100"
      : t.variant === "success"
      ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-900 dark:text-emerald-100"
      : "bg-sky-500/15 border-sky-400/40 text-sky-900 dark:text-sky-100")
  }
>
  {t.message}
</div>
```

Changes:
- Added `backdrop-blur-md`.
- Backgrounds: solid `*-50` → translucent `*-500/15` (15% alpha) so Aurora bleeds through.
- Border: solid `*-200` → translucent `*-400/40`.
- Text gains `dark:text-*-100` for legibility on dark glass.

- [ ] **Step 3: Build verification**

```powershell
npx tsc --noEmit
```

Expected: zero errors.

```powershell
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```powershell
git add src/components/SectionSwitcher.tsx src/toast.tsx
git commit -m "style(aurora): glass switcher pill + translucent toasts

SectionSwitcher pill uses glass-panel (was bg-app-card + border).
Toasts now bg-*-500/15 + backdrop-blur-md with dark-mode text variants
so the ambient layer shows through. Cohesive look across all surfaces."
```

---

## Phase 2 — Verification

### Task 8: Visual smoke test + final cleanup

**Files:**
- (No source changes expected.)

Confirms the visual result, captures regressions, and addresses any issue found.

- [ ] **Step 1: Run full test + build pass**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all 31 tests still pass (CSS changes don't affect Rust).

```powershell
npx tsc --noEmit
```

Expected: zero errors.

```powershell
npm run build
```

Expected: build succeeds. Note the CSS bundle size — should be roughly 22-25 KB (was ~21 KB pre-restyle; growth from new tokens + keyframes + component classes).

- [ ] **Step 2: Manual visual smoke (controller delegates to user)**

The implementer subagent CANNOT run the GUI. After commits, the controller asks the user to launch `npm run tauri dev` and confirm:

1. The window opens with a visible Aurora ambient (blue gradient blobs) behind glass-frosted sidebar and main panel.
2. Day cells show through to the ambient subtly.
3. Today's pill is still readable.
4. Hover on a day cell produces a soft lift (no harsh outline).
5. Hover on a sidebar exam row also lifts.
6. Open any modal (e.g., + Esame) — backdrop is blurred + dimmed, modal is glass.
7. Toggle dark/light from Settings → both themes look cohesive (same blue accent, different luminance).
8. The ambient blobs visibly drift over ~15 seconds.
9. Toasts (trigger by deleting an exam) are translucent with backdrop blur.

If any item fails, the implementer subagent fixes it via a follow-up commit and re-runs build verification.

- [ ] **Step 3: Final commit if any visual fixes were needed**

If fixes were applied in Step 2:

```powershell
git add -A
git commit -m "fix(aurora): <specific issue> from visual smoke"
```

If no fixes needed: no commit, proceed.

- [ ] **Step 4: Push branch**

```powershell
git push origin feat/tauri-port
```

Expected: pushes all Task 1-7 (+ optional Task 8 fix) commits to the remote.

---

## Self-review notes (post-write)

- **Spec coverage:**
  - §3 tokens (light + dark) → Task 1
  - §4 ambient layer + keyframes → Task 2
  - §5 glass-panel + lift-hover utilities → Task 3
  - §6.1 App.tsx (aurora-bg + main panel) → Tasks 2, 4
  - §6.2 Sidebar.tsx → Task 4
  - §6.3 Modal.tsx (overlay + container) → Task 5
  - §6.4 DayCell.tsx (lift + remove outline) → Task 6
  - §6.5 Calendar/CalendarHeader (no change) → no task needed
  - §6.6 Toast.tsx → Task 7
  - §6.7 SectionSwitcher.tsx → Task 7
  - §6.8 ExamRow.tsx → Task 6
  - §8 accessibility (prefers-reduced-motion) → covered in Tasks 2 + 3 CSS
  - §11 open items → resolved before plan was written
  - §12 out of scope → respected (no tasks attempt these)
- **No placeholders** — every step has either complete code or an exact command with expected output. The single "if any item fails" branch in Task 8 is a real conditional, not a TBD.
- **Type consistency** — `glass-panel`, `lift-hover`, `aurora-bg`, `aurora-blob-*` names are consistent across CSS definitions (Tasks 2, 3) and consumer references (Tasks 4-7). Tailwind utility classes used (`bg-black/30`, `backdrop-blur-md`, `bg-red-500/15`, etc.) are all v4-valid.
