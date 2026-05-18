# Statistiche — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sezione "Statistiche" completa con doppio grafico effettivo/consigliato, streak, heatmap annuale, breakdown per-esame e quick-log giornaliero — sostituendo il placeholder corrente. Backend strategy pattern OCP/DIP-compliant per la formula del "consigliato".

**Architecture:** `study-time.ts` splittato in 3 file (aggregazioni dominio / strategy abstraction / format helpers). Strategy pattern: `SuggestedStrategy` interface + `tOverNStrategy` default impl, iniettata via `SuggestedStrategyContext` React. Componenti Stats consumano la strategia via `useSuggestedStrategy()` hook. Chart SVG hand-rolled (port di `Graph7Days` da appunti_app), adattato tema aurora-glass. Backend Rust: `set_study_day_minutes` diventa upsert per supportare log su progetti.

**Tech Stack:** TypeScript 5.8, React 19, Vite 7, Tauri 2, Rust (rusqlite), Tailwind 4. Nessun test framework TS — verifica via `tsc --noEmit` + `cargo test` + smoke test in `npm run dev`.

**Spec di riferimento:** `docs/superpowers/specs/2026-05-17-statistiche-design.md`

---

## File Structure

**Nuovi:**
- `src/suggested-strategy.ts` — interface + default impl + React context + hook
- `src/study-time-format.ts` — `formatHM`, `durationOptions`, `rangeDays`
- `src/components/stats/stats-chart.css` — tutti gli stili della sezione Stats
- `src/components/stats/RangeSelector.tsx`
- `src/components/stats/ChartModeToggle.tsx`
- `src/components/stats/KpiCards.tsx`
- `src/components/stats/TodayQuickLog.tsx`
- `src/components/stats/StudyChart.tsx`
- `src/components/stats/YearHeatmap.tsx`
- `src/components/stats/PerExamBars.tsx`

**Modificati:**
- `src-tauri/src/db/exams.rs` — upsert `set_study_day_minutes` + test
- `src/study-time.ts` — riscrittura (rimosso `effectiveMinutes`, rinominato `totalMinutes`, nuovi helpers)
- `src/components/StatsView.tsx` — riscrittura completa
- `src/components/DayModal.tsx` — `useSuggestedStrategy` + label
- `src/components/ExamRow.tsx` — `useSuggestedStrategy` + helper rename
- `src/components/ExamModal.tsx` — import path `durationOptions`
- `src/App.tsx` — passa `onDayClick={setDayKey}` a `StatsView`
- `src/index.css` — variabile `--color-stats-actual`

---

## Task 1: Backend upsert per `set_study_day_minutes`

**Goal:** Permettere INSERT di righe `study_days` per progetti (range-coperti) tramite questa funzione, mantenendo l'UPDATE behavior per esami.

**Files:**
- Modify: `src-tauri/src/db/exams.rs:111-126`
- Test: same file (cargo test in `#[cfg(test)] mod tests`)

- [ ] **Step 1: Aggiornare la funzione `set_study_day_minutes`**

Sostituire l'intera funzione corrente (righe 111-126) con:

```rust
pub fn set_study_day_minutes(conn: &Connection, exam_id: i64, date: &str, minutes: Option<i32>) -> Result<(), String> {
    crate::db::types::validate_date(date)?;
    if let Some(m) = minutes {
        if m < 0 || m > 24 * 60 {
            return Err(format!("Minuti non validi: {m} (0..1440)"));
        }
    }
    // 1) Try UPDATE — fast path per esami (riga creata da toggle) e progetti già loggati.
    let changed = conn.execute(
        "UPDATE study_days SET minutes = ?1 WHERE exam_id = ?2 AND date = ?3",
        params![minutes, exam_id, date],
    ).map_err(|e| format!("update minutes: {e}"))?;
    if changed > 0 { return Ok(()); }

    // 2) Nessuna riga — INSERT consentito solo per progetti con range coprente il giorno.
    let kind: String = conn.query_row(
        "SELECT kind FROM exams WHERE id = ?1",
        params![exam_id],
        |r| r.get(0),
    ).map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => format!("Esame {exam_id} non esistente"),
        e => format!("select kind: {e}"),
    })?;
    if kind != "progetto" {
        return Err(format!("Giorno di studio {date} non trovato per esame {exam_id}"));
    }
    let covered: bool = conn.query_row(
        "SELECT 1 FROM project_ranges WHERE exam_id = ?1 AND ?2 BETWEEN start_date AND end_date LIMIT 1",
        params![exam_id, date],
        |_| Ok(true),
    ).unwrap_or(false);
    if !covered {
        return Err(format!("Progetto {exam_id} non copre il giorno {date}"));
    }
    conn.execute(
        "INSERT INTO study_days (exam_id, date, minutes) VALUES (?1, ?2, ?3)",
        params![exam_id, date, minutes],
    ).map_err(|e| format!("insert minutes: {e}"))?;
    Ok(())
}
```

- [ ] **Step 2: Aggiungere test cargo per il nuovo behavior**

Aprire `src-tauri/src/db/exams.rs`, individuare la sezione `#[cfg(test)] mod tests { ... }` (intorno alla riga 422). Aggiungere questi test dopo `set_study_day_minutes_rejects_out_of_range`:

```rust
#[test]
fn set_study_day_minutes_upserts_for_progetto_in_range() {
    let conn = crate::db::open_in_memory().unwrap();
    // Crea un progetto con range che copre 2026-06-15
    let input = ProgettoInput {
        base: EsameInputBase {
            name: "Tesi".into(), color: "#1F8A4C".into(), icon: "Cpu".into(),
            passed: false, default_study_minutes: 60, appelli: vec![],
        },
        ranges: vec![DateRange { start: "2026-06-01".into(), end: "2026-06-30".into() }],
    };
    let p = create(&mut crate::db::open_in_memory().unwrap(), &ExamInput::Progetto(input.clone())).unwrap();
    // Riapri stesso DB? No — single conn lifetime. Riscriviamo con stesso conn.
    let mut conn = crate::db::open_in_memory().unwrap();
    let p = create(&mut conn, &ExamInput::Progetto(input)).unwrap();
    // Set minutes su giorno coperto dal range → INSERT
    set_study_day_minutes(&conn, p.id(), "2026-06-15", Some(45)).unwrap();
    let reread = get_by_id(&conn, p.id()).unwrap();
    let sd = reread.study_days().iter().find(|s| s.date == "2026-06-15").unwrap();
    assert_eq!(sd.minutes, Some(45));
    // Set nuovo valore sullo stesso giorno → UPDATE
    set_study_day_minutes(&conn, p.id(), "2026-06-15", Some(120)).unwrap();
    let reread = get_by_id(&conn, p.id()).unwrap();
    let sd = reread.study_days().iter().find(|s| s.date == "2026-06-15").unwrap();
    assert_eq!(sd.minutes, Some(120));
}

#[test]
fn set_study_day_minutes_rejects_progetto_out_of_range() {
    let input = ProgettoInput {
        base: EsameInputBase {
            name: "Tesi".into(), color: "#1F8A4C".into(), icon: "Cpu".into(),
            passed: false, default_study_minutes: 60, appelli: vec![],
        },
        ranges: vec![DateRange { start: "2026-06-01".into(), end: "2026-06-30".into() }],
    };
    let mut conn = crate::db::open_in_memory().unwrap();
    let p = create(&mut conn, &ExamInput::Progetto(input)).unwrap();
    let err = set_study_day_minutes(&conn, p.id(), "2026-07-15", Some(45)).unwrap_err();
    assert!(err.contains("non copre"), "got: {err}");
}

#[test]
fn set_study_day_minutes_rejects_esame_without_toggle() {
    // Esame senza toggle: la riga study_days non esiste → ritorna error originale.
    let input = EsameInput {
        base: EsameInputBase {
            name: "Fisica".into(), color: "#2E86C1".into(), icon: "Atom".into(),
            passed: false, default_study_minutes: 60, appelli: vec!["2026-06-01".into()],
        },
    };
    let mut conn = crate::db::open_in_memory().unwrap();
    let e = create(&mut conn, &ExamInput::Esame(input)).unwrap();
    let err = set_study_day_minutes(&conn, e.id(), "2026-06-15", Some(45)).unwrap_err();
    assert!(err.contains("non trovato"), "got: {err}");
}
```

**Note**: i nomi esatti dei tipi (`ProgettoInput`, `EsameInputBase`, `ExamInput::Progetto`, ecc.) e dei metodi (`p.id()`, `reread.study_days()`) potrebbero differire — verificare con i test esistenti nella stessa sezione `tests` e copiare il pattern già usato (es. `set_study_day_minutes_works` alla riga 422 mostra come ottenere un esame in test).

- [ ] **Step 3: Run tests**

```bash
cd src-tauri && cargo test --lib
```

Expected: tutti i test passano (originali + 3 nuovi).

Se i test nuovi non compilano per nomi sbagliati: aprire `src-tauri/src/db/exams.rs` test esistenti e ricopiare il pattern usato (i test usano helper diversi a seconda di come sono strutturati i tipi).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/db/exams.rs
git commit -m "feat(db): set_study_day_minutes upsert per progetti in range"
```

---

## Task 2: Create `src/suggested-strategy.ts`

**Goal:** Astrazione `SuggestedStrategy` + impl default `tOverNStrategy` + React context + hook.

**Files:**
- Create: `src/suggested-strategy.ts`

- [ ] **Step 1: Scrivere il file**

```typescript
import { createContext, useContext } from "react";
import type { Exam } from "./types";
import { countPresences } from "./study-time";

/**
 * Strategia per calcolare i "minuti consigliati" per (esame, giorno).
 * Implementazione di default: t/n. Estendibile (coach AI, pesi, formula adattiva)
 * senza modificare i consumer.
 */
export interface SuggestedStrategy {
  /** Etichetta umana per UI / tooltip (es. "t/n", "Coach AI"). */
  readonly label: string;
  /** Minuti consigliati per studiare `exam` il giorno `dayKey`, dato il contesto `allExams`. */
  compute(exam: Exam, dayKey: string, allExams: Exam[]): number;
}

/** Strategia di default: t/n (t = defaultStudyMinutes, n = countPresences). */
export const tOverNStrategy: SuggestedStrategy = {
  label: "t/n",
  compute(exam, dayKey, allExams) {
    const t = exam.defaultStudyMinutes;
    if (t === 0) return 0;
    const n = countPresences(dayKey, allExams);
    if (n === 0) return 0;
    return Math.round(t / n);
  },
};

export const SuggestedStrategyContext = createContext<SuggestedStrategy>(tOverNStrategy);
export const useSuggestedStrategy = (): SuggestedStrategy => useContext(SuggestedStrategyContext);
```

- [ ] **Step 2: Verifica typecheck**

```bash
npx tsc --noEmit
```

Expected: errori solo nei file che ancora importano `effectiveMinutes` da `study-time.ts` (DayModal, ExamRow). Niente errori in `suggested-strategy.ts` o `study-time.ts` (perché `countPresences` esiste ancora). Se questo è il caso, procedi; verranno risolti nei task successivi.

- [ ] **Step 3: Commit**

```bash
git add src/suggested-strategy.ts
git commit -m "feat(stats): SuggestedStrategy abstraction + tOverN default"
```

---

## Task 3: Create `src/study-time-format.ts`

**Goal:** Estrarre `formatHM`, `durationOptions`, `DurationOption` da `study-time.ts` + aggiungere `rangeDays`.

**Files:**
- Create: `src/study-time-format.ts`

- [ ] **Step 1: Scrivere il file**

```typescript
import { ymd, parseYmd } from "./date";

/** Format "1h30m" / "45m" / "2h" / "" (per 0). */
export function formatHM(minutes: number): string {
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

export interface DurationOption {
  value: number;
  label: string;
}

/**
 * Dropdown options for default_study_minutes input.
 * 15-min step from 0 to 480 (8h max). 0 = "no auto-study".
 */
export function durationOptions(): DurationOption[] {
  const out: DurationOption[] = [{ value: 0, label: "Nessun tempo predefinito" }];
  for (let m = 15; m <= 480; m += 15) {
    out.push({ value: m, label: formatHM(m) });
  }
  return out;
}

/** Elenco YYYY-MM-DD inclusivo tra start e end (timezone-safe via parseYmd/ymd locali). */
export function rangeDays(start: string, end: string): string[] {
  const out: string[] = [];
  const cursor = parseYmd(start);
  const stop = parseYmd(end);
  while (cursor <= stop) {
    out.push(ymd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
```

- [ ] **Step 2: Verifica typecheck**

```bash
npx tsc --noEmit
```

Expected: stesso stato di Task 2 step 2 (errori solo in consumer di `effectiveMinutes`).

- [ ] **Step 3: Commit**

```bash
git add src/study-time-format.ts
git commit -m "feat(stats): split format helpers + rangeDays in study-time-format.ts"
```

---

## Task 4: Riscrivere `src/study-time.ts`

**Goal:** Rimuovere `effectiveMinutes`, rinominare `totalMinutes`, aggiungere helpers nuovi per stats. Spostare format helpers in `study-time-format.ts`.

**Files:**
- Modify: `src/study-time.ts` (intera riscrittura)

- [ ] **Step 1: Sostituire il file con questa versione**

```typescript
import type { Exam } from "./types";
import type { SuggestedStrategy } from "./suggested-strategy";
import { isProgetto, expandRanges } from "./progetto";
import { ymd, parseYmd } from "./date";

/**
 * Count "study activities" active on a given day, DISTINCT per exam:
 *   - +1 per active exam with EITHER a studyDay on this date OR a range covering it.
 * Identical semantics to Rust's db::exams::count_presences (DISTINCT by exam ID).
 */
export function countPresences(dayKey: string, exams: Exam[]): number {
  let n = 0;
  for (const e of exams) {
    if (e.passed) continue;
    const hasStudy = e.studyDays.some((s) => s.date === dayKey);
    const hasRange = isProgetto(e) && e.ranges.some((r) => dayKey >= r.start && dayKey <= r.end);
    if (hasStudy || hasRange) n++;
  }
  return n;
}

/** True se l'esame "studia" il giorno (toggle oppure range progetto). */
export function isStudying(exam: Exam, dayKey: string): boolean {
  if (exam.studyDays.some((s) => s.date === dayKey)) return true;
  if (isProgetto(exam) && exam.ranges.some((r) => dayKey >= r.start && dayKey <= r.end)) return true;
  return false;
}

/** Minuti effettivamente loggati (0 se non quantificato). */
export function actualMinutes(exam: Exam, dayKey: string): number {
  return exam.studyDays.find((s) => s.date === dayKey)?.minutes ?? 0;
}

/**
 * Iterate every day where `exam` is "being studied":
 *   - Always include manual studyDay entries.
 *   - For progetti: also include every date inside any range (deduped).
 * Yields YYYY-MM-DD strings.
 */
export function studiedDays(exam: Exam): string[] {
  const base = exam.studyDays.map((s) => s.date);
  if (isProgetto(exam)) {
    return Array.from(new Set([...base, ...expandRanges(exam)]));
  }
  return base;
}

/** Somma minuti effettivi del giorno across tutti gli esami attivi che studiano D. */
export function dailyActual(allExams: Exam[], dayKey: string): number {
  let sum = 0;
  for (const e of allExams) {
    if (e.passed) continue;
    if (!isStudying(e, dayKey)) continue;
    sum += actualMinutes(e, dayKey);
  }
  return sum;
}

/** Somma minuti consigliati del giorno (delegando alla strategia). */
export function dailySuggested(
  allExams: Exam[],
  dayKey: string,
  strategy: SuggestedStrategy
): number {
  let sum = 0;
  for (const e of allExams) {
    if (e.passed) continue;
    if (!isStudying(e, dayKey)) continue;
    sum += strategy.compute(e, dayKey, allExams);
  }
  return sum;
}

/** Coppia effettivo/consigliato (composizione). */
export function dailyTotals(
  allExams: Exam[],
  dayKey: string,
  strategy: SuggestedStrategy
): { actual: number; suggested: number } {
  return {
    actual: dailyActual(allExams, dayKey),
    suggested: dailySuggested(allExams, dayKey, strategy),
  };
}

/** Totale consigliato per un esame su tutti i suoi studied days. */
export function suggestedTotalMinutes(
  exam: Exam,
  allExams: Exam[],
  strategy: SuggestedStrategy
): number {
  return studiedDays(exam).reduce(
    (s, d) => s + strategy.compute(exam, d, allExams),
    0
  );
}

/** Streak corrente: giorni consecutivi fino a oggi con dailyActual > 0. */
export function currentStreak(allExams: Exam[], today: string): number {
  let count = 0;
  const cursor = parseYmd(today);
  while (count <= 365 * 3) {
    const key = ymd(cursor);
    if (dailyActual(allExams, key) > 0) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return count;
}

/** Best streak su tutto lo storico (giorni con minuti > 0). */
export function bestStreak(allExams: Exam[]): number {
  const dates = new Set<string>();
  for (const e of allExams) {
    if (e.passed) continue;
    for (const sd of e.studyDays) {
      if ((sd.minutes ?? 0) > 0) dates.add(sd.date);
    }
  }
  if (dates.size === 0) return 0;
  const sorted = Array.from(dates).sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseYmd(sorted[i - 1]);
    const next = parseYmd(sorted[i]);
    const diff = (+next - +prev) / 86_400_000;
    if (diff === 1) {
      cur++;
      best = Math.max(best, cur);
    } else {
      cur = 1;
    }
  }
  return best;
}
```

- [ ] **Step 2: Verifica typecheck**

```bash
npx tsc --noEmit
```

Expected: errori in `DayModal.tsx` (usa `effectiveMinutes`), `ExamRow.tsx` (usa `totalMinutes`), `ExamModal.tsx` (importa `durationOptions` dal vecchio path). Tutti verranno sistemati nei task 5/6/7.

- [ ] **Step 3: Commit**

```bash
git add src/study-time.ts
git commit -m "refactor(study-time): split out format/strategy + add stats helpers"
```

---

## Task 5: Update `src/components/DayModal.tsx`

**Goal:** Usare `useSuggestedStrategy()` invece di `effectiveMinutes`. Label "consigliato Xm" invece di "manuale/auto".

**Files:**
- Modify: `src/components/DayModal.tsx`

- [ ] **Step 1: Aggiornare imports e logica**

Sostituire la riga 6 (import `effectiveMinutes`):

```typescript
import { countPresences } from "../study-time";
import { useSuggestedStrategy } from "../suggested-strategy";
```

Subito dopo la firma `export function DayModal(...)` e dopo `const { exams, toggleStudyDay, setStudyDayMinutes } = useExams();`, aggiungere:

```typescript
const strategy = useSuggestedStrategy();
```

Sostituire la riga (~81) `const computed = effectiveMinutes(e, dayKey, active);` con:

```typescript
const suggested = strategy.compute(e, dayKey, active);
```

Aggiornare i riferimenti a `computed` → `suggested` nello stesso `studyTargets.map` (linee 78-134):
- `placeholder={String(computed)}` → `placeholder={String(suggested)}`
- `title={isOverride ? ... : ...}` → vedi sotto

Sostituire il blocco `title` dell'input numerico con:

```typescript
title={
  studyEntry?.minutes != null
    ? `Hai studiato ${studyEntry.minutes} min. Consigliato: ${suggested}m`
    : `Consigliato: ${suggested}m. Inserisci quanto hai studiato.`
}
```

Sostituire lo `<span>` di hint (riga ~119):

```jsx
<span className="text-[9.5px] whitespace-nowrap">
  consigliato {suggested}m
</span>
```

(Rimuovere la variabile `isOverride` e il riferimento a `n` se la `n` non è più usata. Verificare: `countPresences` può rimanere usata se serve in title; altrimenti rimuovere anche quell'import.)

- [ ] **Step 2: Verifica typecheck**

```bash
npx tsc --noEmit
```

Expected: errori solo in `ExamRow.tsx` e `ExamModal.tsx`.

- [ ] **Step 3: Smoke test UI**

```bash
npm run tauri dev
```

Apri il modale di un giorno qualsiasi, verifica che il numerico mostra "consigliato Xm" e che l'edit funziona. Chiudi.

- [ ] **Step 4: Commit**

```bash
git add src/components/DayModal.tsx
git commit -m "refactor(day-modal): use SuggestedStrategy + 'consigliato' label"
```

---

## Task 6: Update `src/components/ExamRow.tsx`

**Goal:** Usare `useSuggestedStrategy()` + `suggestedTotalMinutes`. Aggiornare import di `formatHM` al nuovo path.

**Files:**
- Modify: `src/components/ExamRow.tsx`

- [ ] **Step 1: Leggere il file per individuare gli usi**

```bash
# Non eseguire — è solo per orientarsi. Leggere il file:
```

Identificare l'import attuale di `totalMinutes` e `formatHM` da `../study-time`.

- [ ] **Step 2: Aggiornare imports e usi**

Sostituire l'import esistente da `../study-time` con:

```typescript
import { suggestedTotalMinutes } from "../study-time";
import { formatHM } from "../study-time-format";
import { useSuggestedStrategy } from "../suggested-strategy";
```

Dentro il componente `ExamRow`, aggiungere all'inizio:

```typescript
const strategy = useSuggestedStrategy();
```

E sostituire ogni `totalMinutes(exam, allExams)` con `suggestedTotalMinutes(exam, allExams, strategy)`.

- [ ] **Step 3: Verifica typecheck**

```bash
npx tsc --noEmit
```

Expected: solo errore in `ExamModal.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/ExamRow.tsx
git commit -m "refactor(exam-row): use SuggestedStrategy + suggestedTotalMinutes"
```

---

## Task 7: Update `src/components/ExamModal.tsx`

**Goal:** Aggiornare import di `durationOptions` (e `DurationOption` se importato) al nuovo path.

**Files:**
- Modify: `src/components/ExamModal.tsx`

- [ ] **Step 1: Cambiare import path**

Cercare l'import attuale (probabilmente `import { durationOptions ... } from "../study-time";`) e cambiarlo in:

```typescript
import { durationOptions } from "../study-time-format";
// se anche DurationOption è importato:
import type { DurationOption } from "../study-time-format";
```

- [ ] **Step 2: Verifica typecheck**

```bash
npx tsc --noEmit
```

Expected: **nessun errore**. Il refactor della parte di "study-time" è ora compilante.

- [ ] **Step 3: Smoke test UI**

```bash
npm run tauri dev
```

Apri ExamModal (crea/modifica esame), verifica che il dropdown "Tempo di studio giornaliero" ha le opzioni.

- [ ] **Step 4: Commit**

```bash
git add src/components/ExamModal.tsx
git commit -m "refactor(exam-modal): import durationOptions from study-time-format"
```

---

## Task 8: CSS variable `--color-stats-actual`

**Goal:** Aggiungere la variabile per il colore "effettivo" del chart in entrambi i temi.

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Aggiungere variabili**

Nel blocco `@theme { ... }` (light theme, intorno alla riga 5-60), aggiungere prima della chiusura `}`:

```css
  /* Stats — colore "effettivo" del chart globale (distinto da accent) */
  --color-stats-actual: #2E86C1;
```

Nel blocco `.dark { ... }` (dark theme, intorno alla riga 63-92), aggiungere prima della chiusura:

```css
  --color-stats-actual: #5fa9e8;
```

- [ ] **Step 2: Verifica build CSS**

```bash
npx tsc --noEmit
npm run build
```

Expected: build passa.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(stats): add --color-stats-actual CSS variable"
```

---

## Task 9: Create `src/components/stats/stats-chart.css`

**Goal:** Tutto il CSS della sezione Stats (chart + heatmap + per-exam bars + KPI cards + animazioni).

**Files:**
- Create: `src/components/stats/stats-chart.css`

- [ ] **Step 1: Creare la directory e scrivere il file**

```css
/* ============ Stats Toolbar ============ */
.stats-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-shrink: 0;
}

/* ============ Range pill selector ============ */
.range-pills {
  position: relative;
  display: inline-flex;
  padding: 4px;
  background: var(--color-app-soft);
  border-radius: 999px;
}
.range-pill-bg {
  position: absolute;
  top: 4px;
  bottom: 4px;
  background: var(--color-app-accent);
  border-radius: 999px;
  transition: left 0.3s cubic-bezier(0.22, 1, 0.36, 1), width 0.3s;
  z-index: 0;
}
.range-pill {
  position: relative;
  z-index: 1;
  padding: 6px 14px;
  border: 0;
  background: transparent;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--color-app-muted);
  cursor: pointer;
  transition: color 0.2s;
  border-radius: 999px;
}
.range-pill.active {
  color: var(--color-app-accent-fg);
}

/* ============ Chart mode toggle ============ */
.mode-toggle {
  display: inline-flex;
  padding: 3px;
  background: var(--color-app-soft);
  border-radius: 999px;
}
.mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--color-app-muted);
  cursor: pointer;
  transition: all 0.2s;
}
.mode-btn.active {
  background: var(--color-app-card);
  color: var(--color-app-fg);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

/* ============ KPI cards ============ */
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 18px;
}
.kpi-card {
  padding: 14px 16px;
  border-radius: 16px;
  background: var(--color-app-card);
  border: 1px solid var(--color-app-border);
  backdrop-filter: blur(var(--blur-strong)) saturate(160%);
  -webkit-backdrop-filter: blur(var(--blur-strong)) saturate(160%);
  transition: transform 0.2s, box-shadow 0.2s;
  position: relative;
  overflow: hidden;
}
.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(70, 130, 240, 0.15);
}
.kpi-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-app-muted);
  margin-bottom: 8px;
}
.kpi-icon-wrap {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-app-soft);
  color: var(--color-app-fg);
}
.kpi-card.streak .kpi-icon-wrap {
  background: rgba(255, 120, 80, 0.15);
  color: #ff7050;
}
.kpi-card.streak .flame {
  animation: flame-flicker 2.4s ease-in-out infinite;
  transform-origin: center;
  display: inline-flex;
}
@keyframes flame-flicker {
  0%, 100% { transform: scale(1) rotate(-1deg); }
  50%      { transform: scale(1.08) rotate(1deg); }
}
@media (prefers-reduced-motion: reduce) {
  .kpi-card.streak .flame { animation: none; }
}
.kpi-label {
  font-size: 11.5px;
  font-weight: 600;
}
.kpi-value {
  font-size: 26px;
  font-weight: 720;
  letter-spacing: -0.02em;
  color: var(--color-app-fg);
  line-height: 1;
}
.kpi-unit {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--color-app-muted);
  margin-left: 4px;
}
.kpi-sub {
  margin-top: 6px;
  font-size: 10.5px;
  color: var(--color-app-muted);
}

/* ============ Today Quick Log ============ */
.quick-log {
  padding: 14px 16px;
  border-radius: 16px;
  margin-bottom: 18px;
  background: var(--color-app-card);
  border: 1px solid var(--color-app-border);
  backdrop-filter: blur(var(--blur-strong)) saturate(160%);
  -webkit-backdrop-filter: blur(var(--blur-strong)) saturate(160%);
}
.ql-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.ql-title {
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-app-fg);
}
.ql-sub {
  font-size: 11px;
  color: var(--color-app-muted);
}
.ql-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ql-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--color-app-cell);
  border: 1px solid var(--color-app-cell-border);
  border-radius: 10px;
  position: relative;
  overflow: hidden;
}
.ql-stripe {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
}
.ql-name {
  flex: 1;
  font-size: 12.5px;
  font-weight: 600;
  padding-left: 8px;
  color: var(--color-app-fg);
}
.ql-input {
  width: 60px;
  padding: 5px 8px;
  border: 1px solid var(--color-app-input-border);
  border-radius: 6px;
  font-size: 12px;
  text-align: right;
  background: var(--color-app-input-bg);
  color: var(--color-app-fg);
}
.ql-suggested {
  font-size: 10.5px;
  color: var(--color-app-muted);
  min-width: 90px;
  text-align: right;
}
.ql-min {
  font-size: 11px;
  color: var(--color-app-muted);
}

/* ============ Study Chart container ============ */
.stats-chart {
  padding: 18px;
  border-radius: 18px;
  margin-bottom: 18px;
  background: var(--color-app-card);
  border: 1px solid var(--color-app-border);
  backdrop-filter: blur(var(--blur-strong)) saturate(160%);
  -webkit-backdrop-filter: blur(var(--blur-strong)) saturate(160%);
}
.stats-chart__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
}
.stats-chart__title {
  font-size: 14px;
  font-weight: 650;
  color: var(--color-app-fg);
}
.stats-chart__subtitle {
  font-size: 11.5px;
  color: var(--color-app-muted);
  margin-top: 2px;
}
.stats-chart__metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}
.stats-chart__metric {
  padding: 10px 12px;
  background: var(--color-app-cell);
  border: 1px solid var(--color-app-cell-border);
  border-radius: 12px;
}
.stats-chart__cm-head {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--color-app-muted);
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 6px;
}
.stats-chart__cm-icon-wrap {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-app-soft);
  color: var(--color-app-fg);
}
.stats-chart__cm-value {
  font-size: 18px;
  font-weight: 720;
  letter-spacing: -0.02em;
  color: var(--color-app-fg);
  line-height: 1;
}
.stats-chart__cm-unit {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-app-muted);
  margin-left: 3px;
}
.stats-chart__legend {
  display: flex;
  gap: 18px;
  font-size: 11px;
  color: var(--color-app-muted);
  margin-bottom: 8px;
  padding: 0 2px;
}
.stats-chart__legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.stats-chart__legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--color-stats-actual);
}
.stats-chart__legend-dash {
  width: 16px;
  height: 2px;
  background: repeating-linear-gradient(
    90deg,
    var(--color-app-fg) 0 5px,
    transparent 5px 9px
  );
}
.stats-chart__legend-bar {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: var(--color-app-fg);
  box-shadow: 0 0 0 1px var(--color-app-border);
}

/* ============ Chart SVG ============ */
.stats-chart__svg-wrap {
  position: relative;
  min-height: 280px;
  padding: 12px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.1));
  border: 1px solid var(--color-app-cell-border);
  border-radius: 14px;
  overflow: hidden;
}
.dark .stats-chart__svg-wrap {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01));
}
.stats-chart__svg {
  display: block;
  width: 100%;
  height: 100%;
}
.stats-chart__grid-line {
  stroke: var(--color-app-cell-border);
  stroke-dasharray: 4 8;
}
.stats-chart__axis-line {
  stroke: var(--color-app-border);
}
.stats-chart__y-label,
.stats-chart__x-label {
  fill: var(--color-app-muted);
  font-size: 10.5px;
  font-weight: 500;
}
.stats-chart__today-line {
  stroke: var(--color-app-fg);
  stroke-opacity: 0.30;
  stroke-width: 1;
  stroke-dasharray: 4 3;
}
.stats-chart__today-badge {
  fill: var(--color-app-fg);
  fill-opacity: 0.6;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.stats-chart__area {
  opacity: 0.92;
}
.stats-chart__line {
  fill: none;
  stroke: var(--color-stats-actual);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.stats-chart__ref-line {
  fill: none;
  stroke: var(--color-app-fg);
  stroke-opacity: 0.85;
  stroke-width: 2.5;
  stroke-dasharray: 8 5;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}
.stats-chart__ref-point {
  fill: var(--color-app-fg);
  stroke: var(--color-app-card);
  stroke-width: 1.5;
  pointer-events: none;
}
.stats-chart__actual-point {
  fill: var(--color-stats-actual);
  transition: r 0.2s ease;
  cursor: pointer;
}
.stats-chart__bar {
  transition: opacity 0.3s, transform 0.3s;
  transform-origin: center bottom;
  cursor: pointer;
}
.stats-chart__bar--actual {
  fill: var(--color-stats-actual);
}
.stats-chart__bar--reference {
  fill: var(--color-app-fg);
  fill-opacity: 0.85;
  stroke: var(--color-app-card);
  stroke-width: 1.2;
}
.stats-chart__bar.is-future {
  opacity: 0.45;
}
.stats-chart__tooltip-box {
  fill: var(--color-app-card);
  stroke: var(--color-app-border);
  stroke-width: 1;
}
.stats-chart__tooltip-title {
  fill: var(--color-app-fg);
  font-size: 12px;
  font-weight: 700;
}
.stats-chart__tooltip-value {
  fill: var(--color-app-fg);
  font-size: 11px;
  font-weight: 600;
}
.stats-chart__tooltip-ref {
  fill: var(--color-app-muted);
  font-size: 10px;
  font-weight: 500;
  font-style: italic;
}

/* ============ Year Heatmap ============ */
.heatmap-section {
  padding: 18px;
  border-radius: 18px;
  margin-bottom: 18px;
  background: var(--color-app-card);
  border: 1px solid var(--color-app-border);
  backdrop-filter: blur(var(--blur-strong)) saturate(160%);
  -webkit-backdrop-filter: blur(var(--blur-strong)) saturate(160%);
}
.heatmap-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  color: var(--color-app-muted);
}
.heatmap-legend-cells {
  display: flex;
  gap: 3px;
}
.heatmap-grid {
  display: grid;
  grid-template-columns: 24px repeat(53, minmax(8px, 1fr));
  gap: 3px;
  align-items: center;
}
.heatmap-month {
  font-size: 9.5px;
  color: var(--color-app-muted);
  text-align: center;
  line-height: 11px;
}
.heatmap-day-label {
  font-size: 9px;
  color: var(--color-app-muted);
  text-align: right;
  padding-right: 4px;
  height: 11px;
  line-height: 11px;
}
.hm-cell {
  width: 100%;
  height: 11px;
  border-radius: 2.5px;
  background: rgba(70, 130, 240, 0.10);
  transition: transform 0.15s;
  cursor: pointer;
}
.heatmap-legend .hm-cell {
  width: 11px;
  cursor: default;
}
.hm-cell:hover { transform: scale(1.4); }
.heatmap-legend .hm-cell:hover { transform: none; }
.hm-0 { background: rgba(70, 130, 240, 0.08); }
.hm-1 { background: rgba(70, 130, 240, 0.30); }
.hm-2 { background: rgba(70, 130, 240, 0.55); }
.hm-3 { background: rgba(46, 134, 193, 0.80); }
.hm-4 { background: #1a2540; }
.dark .hm-0 { background: rgba(255, 255, 255, 0.04); }
.dark .hm-1 { background: rgba(95, 169, 232, 0.25); }
.dark .hm-2 { background: rgba(95, 169, 232, 0.55); }
.dark .hm-3 { background: rgba(95, 169, 232, 0.80); }
.dark .hm-4 { background: #5fa9e8; }

/* ============ Per-exam bars ============ */
.per-exam {
  padding: 18px;
  border-radius: 18px;
  background: var(--color-app-card);
  border: 1px solid var(--color-app-border);
  backdrop-filter: blur(var(--blur-strong)) saturate(160%);
  -webkit-backdrop-filter: blur(var(--blur-strong)) saturate(160%);
  margin-bottom: 4px;
}
.pe-title {
  font-size: 14px;
  font-weight: 650;
  margin-bottom: 14px;
  color: var(--color-app-fg);
}
.pe-row { margin-bottom: 12px; }
.pe-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 12px;
}
.pe-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--color-app-fg);
}
.pe-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.pe-numbers {
  font-size: 11.5px;
  color: var(--color-app-muted);
}
.pe-numbers .strong {
  color: var(--color-app-fg);
  font-weight: 700;
}
.pe-bar-bg {
  position: relative;
  height: 14px;
  background: var(--color-app-soft);
  border-radius: 7px;
  overflow: hidden;
}
.pe-bar-ref {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  background: repeating-linear-gradient(
    90deg,
    color-mix(in srgb, var(--color-app-fg) 40%, transparent) 0 4px,
    transparent 4px 7px
  );
  border-right: 2px dashed color-mix(in srgb, var(--color-app-fg) 80%, transparent);
  border-radius: 7px;
}
.pe-bar-actual {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  border-radius: 7px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
  .range-pill-bg,
  .pe-bar-actual,
  .stats-chart__bar,
  .stats-chart__actual-point {
    transition: none;
  }
}
```

- [ ] **Step 2: Verifica che il file sia importabile (no error a vite)**

Verrà importato da `StatsView.tsx` o dai componenti — per ora basta che esista.

- [ ] **Step 3: Commit**

```bash
git add src/components/stats/stats-chart.css
git commit -m "feat(stats): styles for stats chart, heatmap, per-exam bars"
```

---

## Task 10: Create `src/components/stats/RangeSelector.tsx`

**Goal:** Pill selector animato per intervalli temporali.

**Files:**
- Create: `src/components/stats/RangeSelector.tsx`

- [ ] **Step 1: Scrivere il file**

```tsx
import { useLayoutEffect, useRef, useState } from "react";

export type StatsRange = "7g" | "30g" | "mese" | "anno" | "tutto";

interface RangeOption {
  id: StatsRange;
  label: string;
}

const OPTIONS: RangeOption[] = [
  { id: "7g", label: "7g" },
  { id: "30g", label: "30g" },
  { id: "mese", label: "Mese" },
  { id: "anno", label: "Anno" },
  { id: "tutto", label: "Tutto" },
];

interface Props {
  value: StatsRange;
  onChange: (r: StatsRange) => void;
}

export function RangeSelector({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Record<StatsRange, HTMLButtonElement | null>>({
    "7g": null, "30g": null, mese: null, anno: null, tutto: null,
  });
  const [pill, setPill] = useState<{ left: number; width: number }>({ left: 4, width: 0 });

  useLayoutEffect(() => {
    const btn = btnRefs.current[value];
    const container = containerRef.current;
    if (!btn || !container) return;
    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    setPill({ left: bRect.left - cRect.left, width: bRect.width });
  }, [value]);

  return (
    <div ref={containerRef} className="range-pills">
      <span
        aria-hidden
        className="range-pill-bg"
        style={{ left: pill.left, width: pill.width }}
      />
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          ref={(el) => { btnRefs.current[opt.id] = el; }}
          type="button"
          onClick={() => onChange(opt.id)}
          className={"range-pill" + (opt.id === value ? " active" : "")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

Inoltre, aggiungere in fondo allo stesso file il helper `resolveRange`:

```typescript
import { ymd, parseYmd } from "../../date";

export function resolveRange(range: StatsRange, today: string): { start: string; end: string } {
  const todayDate = parseYmd(today);
  if (range === "7g") {
    const start = new Date(todayDate);
    start.setDate(start.getDate() - 6);
    return { start: ymd(start), end: today };
  }
  if (range === "30g") {
    const start = new Date(todayDate);
    start.setDate(start.getDate() - 29);
    return { start: ymd(start), end: today };
  }
  if (range === "mese") {
    const y = todayDate.getFullYear();
    const m = todayDate.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    return { start: ymd(new Date(y, m, 1)), end: ymd(new Date(y, m, lastDay)) };
  }
  if (range === "anno") {
    const y = todayDate.getFullYear();
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
  // "tutto" — caller decide il vero start (min studyDay); qui ritorniamo un placeholder.
  // Convenzione: chi consuma "tutto" lo gestisce esternamente.
  return { start: "1970-01-01", end: today };
}
```

Spostare l'import in cima (sopra `useLayoutEffect`):

```typescript
import { useLayoutEffect, useRef, useState } from "react";
import { ymd, parseYmd } from "../../date";
```

- [ ] **Step 2: Verifica typecheck**

```bash
npx tsc --noEmit
```

Expected: nessun errore (il componente è autoconsistente).

- [ ] **Step 3: Commit**

```bash
git add src/components/stats/RangeSelector.tsx
git commit -m "feat(stats): RangeSelector + resolveRange helper"
```

---

## Task 11: Create `src/components/stats/ChartModeToggle.tsx`

**Goal:** Toggle pill linea/barre con icone Lucide.

**Files:**
- Create: `src/components/stats/ChartModeToggle.tsx`

- [ ] **Step 1: Scrivere il file**

```tsx
import { TrendingUp, BarChart3 } from "lucide-react";

export type ChartMode = "line" | "bars";

interface Props {
  value: ChartMode;
  onChange: (m: ChartMode) => void;
}

export function ChartModeToggle({ value, onChange }: Props) {
  return (
    <div className="mode-toggle" role="group" aria-label="Modalità grafico">
      <button
        type="button"
        onClick={() => onChange("line")}
        className={"mode-btn" + (value === "line" ? " active" : "")}
        aria-pressed={value === "line"}
      >
        <TrendingUp size={13} />
        Linea
      </button>
      <button
        type="button"
        onClick={() => onChange("bars")}
        className={"mode-btn" + (value === "bars" ? " active" : "")}
        aria-pressed={value === "bars"}
      >
        <BarChart3 size={13} />
        Barre
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verifica typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/stats/ChartModeToggle.tsx
git commit -m "feat(stats): ChartModeToggle line/bars"
```

---

## Task 12: Create `src/components/stats/KpiCards.tsx`

**Goal:** 4 cards (streak, tot studiato, media giorno, esami passati).

**Files:**
- Create: `src/components/stats/KpiCards.tsx`

- [ ] **Step 1: Scrivere il file**

```tsx
import { Flame, Clock, TrendingUp, GraduationCap } from "lucide-react";
import type { Exam } from "../../types";
import { dailyActual, currentStreak, bestStreak } from "../../study-time";
import { rangeDays, formatHM } from "../../study-time-format";

interface Props {
  exams: Exam[];
  today: string;
  rangeStart: string;
  rangeEnd: string;
}

export function KpiCards({ exams, today, rangeStart, rangeEnd }: Props) {
  const streak = currentStreak(exams, today);
  const best = bestStreak(exams);
  const days = rangeDays(rangeStart, rangeEnd);
  const totalActual = days.reduce((s, d) => s + dailyActual(exams, d), 0);
  const avgPerDay = days.length > 0 ? Math.round(totalActual / days.length) : 0;
  const passed = exams.filter((e) => e.passed).length;
  const total = exams.length;

  return (
    <div className="kpi-strip">
      <div className="kpi-card streak">
        <div className="kpi-head">
          <div className="kpi-icon-wrap">
            <span className="flame"><Flame size={15} /></span>
          </div>
          <span className="kpi-label">Streak attuale</span>
        </div>
        <div className="kpi-value">{streak}<span className="kpi-unit">giorni</span></div>
        {best > 0 && <div className="kpi-sub">best: {best}g</div>}
      </div>

      <div className="kpi-card">
        <div className="kpi-head">
          <div className="kpi-icon-wrap"><Clock size={15} /></div>
          <span className="kpi-label">Tot studiato</span>
        </div>
        <div className="kpi-value">{formatHM(totalActual) || "0"}</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-head">
          <div className="kpi-icon-wrap"><TrendingUp size={15} /></div>
          <span className="kpi-label">Media / giorno</span>
        </div>
        <div className="kpi-value">{formatHM(avgPerDay) || "0"}</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-head">
          <div className="kpi-icon-wrap"><GraduationCap size={15} /></div>
          <span className="kpi-label">Esami passati</span>
        </div>
        <div className="kpi-value">{passed}<span className="kpi-unit">di {total}</span></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verifica typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/stats/KpiCards.tsx
git commit -m "feat(stats): KpiCards (streak, tot, avg, passed)"
```

---

## Task 13: Create `src/components/stats/TodayQuickLog.tsx`

**Goal:** Quick log dei minuti studiati oggi, esame per esame.

**Files:**
- Create: `src/components/stats/TodayQuickLog.tsx`

- [ ] **Step 1: Scrivere il file**

```tsx
import { useState } from "react";
import { NotebookPen, ChevronDown, ChevronRight } from "lucide-react";
import type { Exam } from "../../types";
import { useExams } from "../../state";
import { useSuggestedStrategy } from "../../suggested-strategy";
import { isStudying, actualMinutes } from "../../study-time";

interface Props {
  exams: Exam[];
  today: string;
}

export function TodayQuickLog({ exams, today }: Props) {
  const { setStudyDayMinutes } = useExams();
  const strategy = useSuggestedStrategy();
  const studyingToday = exams.filter((e) => !e.passed && isStudying(e, today));
  const [open, setOpen] = useState(studyingToday.length > 0);

  if (studyingToday.length === 0) return null;

  return (
    <div className="quick-log">
      <button
        type="button"
        className="ql-head"
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", background: "transparent", border: 0, padding: 0, cursor: "pointer" }}
      >
        <div className="ql-title">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <NotebookPen size={14} />
          Oggi · Quanto hai studiato?
        </div>
        <div className="ql-sub">{studyingToday.length} attivit{studyingToday.length === 1 ? "à" : "à"}</div>
      </button>
      {open && (
        <div className="ql-list">
          {studyingToday.map((e) => {
            const current = actualMinutes(e, today);
            const suggested = strategy.compute(e, today, exams);
            return (
              <div key={e.id} className="ql-item">
                <span className="ql-stripe" style={{ background: e.color }} />
                <span className="ql-name">{e.name}</span>
                <input
                  type="number"
                  min={0}
                  max={1440}
                  step={5}
                  className="ql-input"
                  defaultValue={current > 0 ? current : ""}
                  placeholder={String(suggested)}
                  onBlur={(ev) => {
                    const raw = ev.target.value;
                    const m = raw === "" ? null : Math.max(0, Math.min(1440, parseInt(raw, 10) || 0));
                    void setStudyDayMinutes(e.id, today, m);
                  }}
                  aria-label={`Minuti studiati per ${e.name}`}
                />
                <span className="ql-min">m</span>
                <span className="ql-suggested">consigliato {suggested}m</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verifica typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/stats/TodayQuickLog.tsx
git commit -m "feat(stats): TodayQuickLog input minuti effettivi"
```

---

## Task 14: Create `src/components/stats/StudyChart.tsx`

**Goal:** SVG chart hand-rolled (port di `Graph7Days`), supporta line/bars, doppia serie effettivo+consigliato, generalizzato per N punti.

**Files:**
- Create: `src/components/stats/StudyChart.tsx`

- [ ] **Step 1: Scrivere il file**

```tsx
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Activity, TrendingUp } from "lucide-react";

export type ChartMode = "line" | "bars";

export interface DayPoint {
  date: string;
  label: string;
  minutes: number;
}

interface Props {
  data: DayPoint[];
  referenceData?: DayPoint[];
  viewMode: ChartMode;
  todayIndex?: number;
  title?: string;
  subtitle?: string;
  animationKey?: string | number;
}

const SVG_W = 800;
const SVG_H = 320;
const PL = 50;
const PR = 18;
const PT = 18;
const PB = 36;
const CW = SVG_W - PL - PR;
const CH = SVG_H - PT - PB;
const AXIS_TICKS = 5;
const LINE_DRAW = "stroke-dashoffset 1.6s cubic-bezier(0.22, 1, 0.36, 1)";

function niceStep(v: number) {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const r = v / mag;
  if (r <= 1) return mag;
  if (r <= 2) return 2 * mag;
  if (r <= 5) return 5 * mag;
  return 10 * mag;
}
function getScaleMax(maxV: number) {
  if (maxV <= 0) return 1;
  const target = maxV < 5 ? maxV : maxV * 1.08;
  const step = niceStep(target / (AXIS_TICKS - 1));
  return step * (AXIS_TICKS - 1);
}
function fmt(v: number) { return Number.isInteger(v) ? `${v}` : v.toFixed(0); }

type Point = { x: number; y: number };
function buildPoints(values: number[], scaleMax: number): Point[] {
  return values.map((v, i) => ({
    x: PL + (i / Math.max(1, values.length - 1)) * CW,
    y: PT + (1 - v / scaleMax) * CH,
  }));
}
function smoothPath(pts: Point[], area = false) {
  if (pts.length < 2) return "";
  let p = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const cp1x = prev.x + (cur.x - prev.x) * 0.35;
    const cp1y = prev.y;
    const cp2x = cur.x - (next ? (next.x - cur.x) * 0.18 : 0);
    const cp2y = cur.y;
    p += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${cur.x},${cur.y}`;
  }
  if (area) {
    p += ` L ${pts[pts.length - 1].x},${PT + CH}`;
    p += ` L ${PL},${PT + CH} Z`;
  }
  return p;
}

function decimateLabels(data: DayPoint[]): string[] {
  const n = data.length;
  if (n <= 14) return data.map((d) => d.label);
  // mostra ogni N etichetta
  const stride = Math.ceil(n / 12);
  return data.map((d, i) => (i % stride === 0 ? d.label : ""));
}

export function StudyChart({ data, referenceData, viewMode, todayIndex, title, subtitle, animationKey }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [chartVisible, setChartVisible] = useState(false);
  const lineRef = useRef<SVGPathElement | null>(null);
  const uid = useId().replace(/:/g, "");
  const gradId = `stats-grad-${uid}`;
  const clipId = `stats-clip-${uid}`;

  const values = useMemo(() => data.map((d) => d.minutes), [data]);
  const refValues = useMemo(() => referenceData?.map((d) => d.minutes) ?? [], [referenceData]);
  const hasRef = refValues.some((v) => v > 0);
  const scaleMax = useMemo(
    () => getScaleMax(Math.max(0, ...values, ...refValues)),
    [values, refValues]
  );
  const pts = useMemo(() => buildPoints(values, scaleMax), [values, scaleMax]);
  const refPts = useMemo(() => hasRef ? buildPoints(refValues, scaleMax) : [], [hasRef, refValues, scaleMax]);
  const labels = useMemo(() => decimateLabels(data), [data]);

  const metrics = useMemo(() => {
    if (values.length === 0) return { peak: 0, growth: 0, average: 0 };
    const peak = Math.max(...values);
    const average = values.reduce((s, v) => s + v, 0) / values.length;
    const growth = values[values.length - 1] - values[0];
    return { peak, average, growth };
  }, [values]);

  const animationToken = useMemo(() => {
    return `${animationKey ?? "x"}|${viewMode}|${values.join(",")}|${refValues.join(",")}`;
  }, [animationKey, viewMode, values, refValues]);

  useLayoutEffect(() => {
    setChartVisible(false);
    setHovered(null);
    if (lineRef.current) {
      lineRef.current.style.transition = "none";
      lineRef.current.style.strokeDasharray = "";
      lineRef.current.style.strokeDashoffset = "0";
      lineRef.current.style.opacity = "0";
    }
  }, [animationToken]);

  useEffect(() => {
    if (viewMode === "bars") {
      const id = window.setTimeout(() => setChartVisible(true), 120);
      return () => window.clearTimeout(id);
    }
    const el = lineRef.current;
    if (!el) return;
    let raf = 0, to = 0;
    try {
      const len = el.getTotalLength();
      el.style.transition = "none";
      el.style.strokeDasharray = `${len}`;
      el.style.strokeDashoffset = `${len}`;
      el.style.opacity = "1";
      el.getBoundingClientRect();
      raf = window.requestAnimationFrame(() => {
        el.style.transition = LINE_DRAW;
        el.style.strokeDashoffset = "0";
        to = window.setTimeout(() => setChartVisible(true), 220);
      });
    } catch {
      el.style.opacity = "1";
      setChartVisible(true);
    }
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      if (to) window.clearTimeout(to);
    };
  }, [viewMode, animationToken]);

  const ticks = useMemo(() => {
    const arr: { value: number; y: number }[] = [];
    for (let i = 0; i < AXIS_TICKS; i++) {
      const ratio = i / (AXIS_TICKS - 1);
      arr.push({ value: scaleMax * (1 - ratio), y: PT + ratio * CH });
    }
    return arr;
  }, [scaleMax]);

  const linePath = useMemo(
    () => (viewMode === "line" ? smoothPath(pts, false) : ""),
    [viewMode, pts]
  );
  const areaPath = useMemo(
    () => (viewMode === "line" ? smoothPath(pts, true) : ""),
    [viewMode, pts]
  );
  const refPath = useMemo(
    () => (viewMode === "line" && hasRef ? smoothPath(refPts, false) : ""),
    [viewMode, hasRef, refPts]
  );

  const barW = Math.min(28, (CW / Math.max(1, data.length)) * 0.28);
  const overlayW = barW * 0.74;
  const baseY = PT + CH;
  const tIdx = todayIndex !== undefined && todayIndex >= 0 && todayIndex < pts.length ? todayIndex : -1;

  return (
    <div className="stats-chart">
      {(title || subtitle) && (
        <div className="stats-chart__head">
          <div>
            {title && <div className="stats-chart__title">{title}</div>}
            {subtitle && <div className="stats-chart__subtitle">{subtitle}</div>}
          </div>
        </div>
      )}

      <div className="stats-chart__metrics">
        <div className="stats-chart__metric">
          <div className="stats-chart__cm-head">
            <span className="stats-chart__cm-icon-wrap"><ArrowUp size={13} /></span>
            <span>Picco</span>
          </div>
          <div className="stats-chart__cm-value">{fmt(metrics.peak)}<span className="stats-chart__cm-unit">min</span></div>
        </div>
        <div className="stats-chart__metric">
          <div className="stats-chart__cm-head">
            <span className="stats-chart__cm-icon-wrap"><TrendingUp size={13} /></span>
            <span>Crescita</span>
          </div>
          <div className="stats-chart__cm-value">
            {metrics.growth > 0 ? `+${fmt(metrics.growth)}` : fmt(metrics.growth)}
            <span className="stats-chart__cm-unit">min</span>
          </div>
        </div>
        <div className="stats-chart__metric">
          <div className="stats-chart__cm-head">
            <span className="stats-chart__cm-icon-wrap"><Activity size={13} /></span>
            <span>Media</span>
          </div>
          <div className="stats-chart__cm-value">{fmt(metrics.average)}<span className="stats-chart__cm-unit">min</span></div>
        </div>
      </div>

      {hasRef && (
        <div className="stats-chart__legend">
          <span className="stats-chart__legend-item">
            <span className="stats-chart__legend-dot" />
            Effettivo
          </span>
          <span className="stats-chart__legend-item">
            <span className={viewMode === "bars" ? "stats-chart__legend-bar" : "stats-chart__legend-dash"} />
            Consigliato
          </span>
        </div>
      )}

      <div className="stats-chart__svg-wrap">
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="xMidYMid meet" className="stats-chart__svg">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-stats-actual)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="var(--color-stats-actual)" stopOpacity="0.02" />
            </linearGradient>
            <clipPath id={clipId}>
              <rect x="0" y="0" width={chartVisible ? SVG_W : 0} height={SVG_H} style={{ transition: "width 1.4s cubic-bezier(0.22, 1, 0.36, 1)" }} />
            </clipPath>
          </defs>

          {ticks.map((t, i) => (
            <g key={i}>
              <text x={PL - 10} y={t.y + 4} textAnchor="end" className="stats-chart__y-label">{fmt(t.value)}</text>
              <line x1={PL} y1={t.y} x2={SVG_W - PR} y2={t.y} className="stats-chart__grid-line" />
            </g>
          ))}
          <line x1={PL} y1={baseY} x2={SVG_W - PR} y2={baseY} className="stats-chart__axis-line" />

          {tIdx >= 0 && (
            <g>
              <line x1={pts[tIdx].x} y1={PT} x2={pts[tIdx].x} y2={baseY} className="stats-chart__today-line" />
              <text x={pts[tIdx].x} y={PT - 4} textAnchor="middle" className="stats-chart__today-badge">oggi</text>
            </g>
          )}

          {viewMode === "line" && (
            <>
              <path d={areaPath} clipPath={`url(#${clipId})`} className="stats-chart__area" style={{ fill: `url(#${gradId})` }} />
              <path ref={lineRef} d={linePath} className="stats-chart__line" />
              {hasRef && refPath && (
                <>
                  <path d={refPath} className="stats-chart__ref-line" clipPath={`url(#${clipId})`} />
                  {refPts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={chartVisible ? 3 : 0} className="stats-chart__ref-point" />
                  ))}
                </>
              )}
              {pts.map((p, i) => {
                const isFuture = tIdx >= 0 && i > tIdx;
                return (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={hovered === i ? 5 : 3.5}
                    className={`stats-chart__actual-point${isFuture ? " is-future" : ""}`}
                    style={{ opacity: isFuture ? 0.4 : (chartVisible ? 1 : 0), transitionDelay: `${820 + i * 70}ms` }}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })}
            </>
          )}

          {viewMode === "bars" && data.map((d, i) => {
            const isFuture = tIdx >= 0 && i > tIdx;
            const a = d.minutes;
            const r = referenceData?.[i]?.minutes ?? 0;
            const aH = a > 0 ? Math.max(2, (a / scaleMax) * CH) : 0;
            const rH = r > 0 ? Math.max(2, (r / scaleMax) * CH) : 0;
            const aLower = a <= r;
            const aBar = { h: aH, w: aLower ? overlayW : barW, y: baseY - aH };
            const rBar = { h: rH, w: aLower ? barW : overlayW, y: baseY - rH };
            const layers = aLower
              ? [{ ...rBar, cls: "stats-chart__bar stats-chart__bar--reference" }, { ...aBar, cls: "stats-chart__bar stats-chart__bar--actual" }]
              : [{ ...aBar, cls: "stats-chart__bar stats-chart__bar--actual" }, { ...rBar, cls: "stats-chart__bar stats-chart__bar--reference" }];
            const x = pts[i].x;
            return (
              <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                {layers.filter((l) => l.h > 0).map((l, j) => (
                  <rect
                    key={j}
                    x={x - l.w / 2}
                    y={l.y}
                    width={l.w}
                    height={l.h}
                    rx={6}
                    className={`${l.cls}${isFuture ? " is-future" : ""}`}
                    style={{ opacity: chartVisible ? (isFuture ? 0.45 : 1) : 0, transform: chartVisible ? "scaleY(1)" : "scaleY(0.35)", transitionDelay: `${180 + i * 70}ms` }}
                  />
                ))}
              </g>
            );
          })}

          {labels.map((lbl, i) => (
            lbl ? (
              <text key={i} x={pts[i].x} y={SVG_H - 12} textAnchor="middle" className="stats-chart__x-label">{lbl}</text>
            ) : null
          ))}

          {hovered !== null && pts[hovered] && (
            <g>
              <rect
                x={Math.max(PL, Math.min(SVG_W - PR - 128, pts[hovered].x - 64))}
                y={10}
                width={128}
                height={hasRef ? 74 : 58}
                rx={12}
                className="stats-chart__tooltip-box"
              />
              <text
                x={Math.max(PL + 64, Math.min(SVG_W - PR - 64, pts[hovered].x))}
                y={31}
                textAnchor="middle"
                className="stats-chart__tooltip-title"
              >{data[hovered].label}</text>
              <text
                x={Math.max(PL + 64, Math.min(SVG_W - PR - 64, pts[hovered].x))}
                y={50}
                textAnchor="middle"
                className="stats-chart__tooltip-value"
              >{fmt(data[hovered].minutes)} min</text>
              {hasRef && referenceData && (
                <text
                  x={Math.max(PL + 64, Math.min(SVG_W - PR - 64, pts[hovered].x))}
                  y={67}
                  textAnchor="middle"
                  className="stats-chart__tooltip-ref"
                >≈ {fmt(referenceData[hovered].minutes)} consigliato</text>
              )}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verifica typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/stats/StudyChart.tsx
git commit -m "feat(stats): StudyChart (port di Graph7Days, light theme)"
```

---

## Task 15: Create `src/components/stats/YearHeatmap.tsx`

**Goal:** Griglia 7×53 con livelli di intensità basati su `dailyActual` annuale.

**Files:**
- Create: `src/components/stats/YearHeatmap.tsx`

- [ ] **Step 1: Scrivere il file**

```tsx
import { useMemo } from "react";
import type { Exam } from "../../types";
import { dailyTotals } from "../../study-time";
import { useSuggestedStrategy } from "../../suggested-strategy";
import { formatHM } from "../../study-time-format";
import { ymd, parseYmd } from "../../date";

interface Props {
  exams: Exam[];
  year: number;
  onDayClick: (dayKey: string) => void;
}

const MONTH_LETTERS = ["G", "F", "M", "A", "M", "G", "L", "A", "S", "O", "N", "D"];

interface CellData {
  date: string;
  actual: number;
  suggested: number;
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

export function YearHeatmap({ exams, year, onDayClick }: Props) {
  const strategy = useSuggestedStrategy();
  const today = ymd(new Date());

  // Costruisce 53 colonne × 7 righe. Col 0 = settimana che contiene 1 gennaio.
  const { weeks, monthMarkers } = useMemo(() => {
    const jan1 = new Date(year, 0, 1);
    const dec31 = new Date(year, 11, 31);
    // Trova lunedì della settimana che contiene jan1 (può essere dell'anno prec.).
    const dow = (jan1.getDay() + 6) % 7; // Lun=0
    const startMonday = new Date(jan1);
    startMonday.setDate(jan1.getDate() - dow);

    // Calcola tutte le celle e accumula max(actual) per scaling.
    let maxActual = 0;
    const cells: (CellData | null)[][] = []; // [week][day0..6]
    const cursor = new Date(startMonday);
    while (cursor <= dec31) {
      const week: (CellData | null)[] = [];
      for (let d = 0; d < 7; d++) {
        if (cursor.getFullYear() !== year) {
          week.push(null);
        } else {
          const key = ymd(cursor);
          const { actual, suggested } = dailyTotals(exams, key, strategy);
          if (actual > maxActual) maxActual = actual;
          const future = key > today;
          week.push({ date: key, actual, suggested, level: 0, future });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      cells.push(week);
    }

    // Assegna i livelli (5 step linear su maxActual).
    if (maxActual > 0) {
      for (const w of cells) {
        for (const c of w) {
          if (!c || c.future) continue;
          const ratio = c.actual / maxActual;
          if (ratio === 0) c.level = 0;
          else if (ratio < 0.25) c.level = 1;
          else if (ratio < 0.5) c.level = 2;
          else if (ratio < 0.75) c.level = 3;
          else c.level = 4;
        }
      }
    }

    // Trova le settimane in cui inizia un mese (per la riga di label).
    const monthCols: (string | null)[] = cells.map((w) => {
      const first = w.find((c) => c && parseYmd(c.date).getDate() <= 7);
      if (!first) return null;
      const d = parseYmd(first.date);
      // Mostra solo se è la prima settimana del mese visibile.
      if (d.getDate() <= 7) return MONTH_LETTERS[d.getMonth()];
      return null;
    });

    return { weeks: cells, monthMarkers: monthCols };
  }, [exams, year, strategy, today]);

  return (
    <div className="heatmap-section">
      <div className="heatmap-head">
        <div className="stats-chart__title">{year} · Heatmap studio</div>
        <div className="heatmap-legend">
          meno
          <div className="heatmap-legend-cells">
            <div className="hm-cell hm-0" />
            <div className="hm-cell hm-1" />
            <div className="hm-cell hm-2" />
            <div className="hm-cell hm-3" />
            <div className="hm-cell hm-4" />
          </div>
          più
        </div>
      </div>
      <div className="heatmap-grid" style={{ gridTemplateColumns: `24px repeat(${weeks.length}, minmax(8px, 1fr))` }}>
        <div />
        {monthMarkers.map((m, i) => (
          <div key={`mh-${i}`} className="heatmap-month">{m ?? ""}</div>
        ))}
        {[0, 1, 2, 3, 4, 5, 6].map((row) => (
          <RowFragment key={row} row={row} weeks={weeks} onDayClick={onDayClick} />
        ))}
      </div>
    </div>
  );
}

function RowFragment({ row, weeks, onDayClick }: { row: number; weeks: (CellData | null)[][]; onDayClick: (d: string) => void }) {
  const labels = ["", "M", "", "G", "", "S", ""];
  return (
    <>
      <div className="heatmap-day-label">{labels[row]}</div>
      {weeks.map((w, wi) => {
        const cell = w[row];
        if (!cell) return <div key={`empty-${wi}-${row}`} />;
        const title = cell.future
          ? cell.date
          : `${cell.date} · ${formatHM(cell.actual) || "0m"} studiati${cell.suggested > 0 ? ` (consigliato ${formatHM(cell.suggested)})` : ""}`;
        return (
          <div
            key={`${wi}-${row}`}
            className={`hm-cell hm-${cell.future ? 0 : cell.level}`}
            title={title}
            onClick={() => !cell.future && onDayClick(cell.date)}
            role="button"
            aria-label={title}
          />
        );
      })}
    </>
  );
}
```

- [ ] **Step 2: Verifica typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/stats/YearHeatmap.tsx
git commit -m "feat(stats): YearHeatmap (53x7 grid, 5 livelli, click → DayModal)"
```

---

## Task 16: Create `src/components/stats/PerExamBars.tsx`

**Goal:** Lista esami con doppia barra effettivo (color) / consigliato (dashed) limitato al range.

**Files:**
- Create: `src/components/stats/PerExamBars.tsx`

- [ ] **Step 1: Scrivere il file**

```tsx
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Exam } from "../../types";
import { useSuggestedStrategy } from "../../suggested-strategy";
import { actualMinutes, studiedDays } from "../../study-time";
import { formatHM, rangeDays } from "../../study-time-format";

interface Props {
  exams: Exam[];
  rangeStart: string;
  rangeEnd: string;
}

interface ExamStat {
  exam: Exam;
  actual: number;
  suggested: number;
}

export function PerExamBars({ exams, rangeStart, rangeEnd }: Props) {
  const strategy = useSuggestedStrategy();
  const [showPassed, setShowPassed] = useState(false);

  const { active, passed, maxBar } = useMemo(() => {
    const days = new Set(rangeDays(rangeStart, rangeEnd));
    const compute = (e: Exam): ExamStat => {
      let actual = 0;
      let suggested = 0;
      for (const d of studiedDays(e)) {
        if (!days.has(d)) continue;
        actual += actualMinutes(e, d);
        suggested += strategy.compute(e, d, exams);
      }
      return { exam: e, actual, suggested };
    };
    const activeStats = exams.filter((e) => !e.passed).map(compute);
    activeStats.sort((a, b) => b.actual - a.actual);
    const passedStats = exams.filter((e) => e.passed).map(compute);
    passedStats.sort((a, b) => b.actual - a.actual);
    const maxBar = Math.max(
      0,
      ...activeStats.map((s) => Math.max(s.actual, s.suggested)),
      ...passedStats.map((s) => Math.max(s.actual, s.suggested))
    );
    return { active: activeStats, passed: passedStats, maxBar };
  }, [exams, rangeStart, rangeEnd, strategy]);

  if (active.length === 0 && passed.length === 0) return null;

  return (
    <div className="per-exam">
      <div className="pe-title">Per esame</div>
      {active.map((s) => <ExamBarRow key={s.exam.id} stat={s} maxBar={maxBar} />)}

      {passed.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowPassed((v) => !v)}
            className="pe-title"
            style={{ marginTop: 16, background: "transparent", border: 0, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            {showPassed ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Completati ({passed.length})
          </button>
          {showPassed && passed.map((s) => <ExamBarRow key={s.exam.id} stat={s} maxBar={maxBar} />)}
        </>
      )}
    </div>
  );
}

function ExamBarRow({ stat, maxBar }: { stat: ExamStat; maxBar: number }) {
  const { exam, actual, suggested } = stat;
  const refW = maxBar > 0 ? (suggested / maxBar) * 100 : 0;
  const actW = maxBar > 0 ? (actual / maxBar) * 100 : 0;
  const pct = suggested > 0 ? Math.round((actual / suggested) * 100) : null;

  return (
    <div className="pe-row">
      <div className="pe-head">
        <div className="pe-name">
          <span className="pe-dot" style={{ background: exam.color }} />
          {exam.name}
        </div>
        <div className="pe-numbers">
          <span className="strong">{formatHM(actual) || "0m"}</span>
          {suggested > 0 && (
            <> / {formatHM(suggested)} consigliate{pct !== null && <> · {pct}%</>}</>
          )}
        </div>
      </div>
      <div className="pe-bar-bg">
        <div className="pe-bar-ref" style={{ width: `${refW}%` }} />
        <div className="pe-bar-actual" style={{ width: `${actW}%`, background: exam.color }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verifica typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/stats/PerExamBars.tsx
git commit -m "feat(stats): PerExamBars effettivo vs consigliato"
```

---

## Task 17: Rewrite `src/components/StatsView.tsx`

**Goal:** Layout host che orchestra tutti i sotto-componenti.

**Files:**
- Modify: `src/components/StatsView.tsx` (riscrittura completa)

- [ ] **Step 1: Sostituire l'intero file con questa versione**

```tsx
import { useMemo, useState } from "react";
import { useExams } from "../state";
import { useSuggestedStrategy } from "../suggested-strategy";
import { dailyTotals } from "../study-time";
import { rangeDays } from "../study-time-format";
import { ymd, parseYmd } from "../date";
import { RangeSelector, resolveRange, type StatsRange } from "./stats/RangeSelector";
import { ChartModeToggle, type ChartMode } from "./stats/ChartModeToggle";
import { KpiCards } from "./stats/KpiCards";
import { TodayQuickLog } from "./stats/TodayQuickLog";
import { StudyChart, type DayPoint } from "./stats/StudyChart";
import { YearHeatmap } from "./stats/YearHeatmap";
import { PerExamBars } from "./stats/PerExamBars";
import "./stats/stats-chart.css";

interface Props {
  onDayClick: (dayKey: string) => void;
}

export function StatsView({ onDayClick }: Props) {
  const { exams } = useExams();
  const strategy = useSuggestedStrategy();
  const today = ymd(new Date());
  const [range, setRange] = useState<StatsRange>("7g");
  const [mode, setMode] = useState<ChartMode>("line");

  // Risolvi range; "tutto" → start = primo studyDay con log, end = oggi.
  const { start, end } = useMemo(() => {
    if (range !== "tutto") return resolveRange(range, today);
    const allDates: string[] = [];
    for (const e of exams) {
      if (e.passed) continue;
      for (const sd of e.studyDays) {
        if ((sd.minutes ?? 0) > 0) allDates.push(sd.date);
      }
    }
    if (allDates.length === 0) return { start: today, end: today };
    allDates.sort();
    return { start: allDates[0], end: today };
  }, [range, today, exams]);

  // Build series. Per "anno" e "tutto" lunghi: aggrega per settimana se > 60 giorni.
  const { data, referenceData, todayIndex } = useMemo(() => {
    const days = rangeDays(start, end);
    const aggregate = days.length > 60;
    if (!aggregate) {
      const data: DayPoint[] = days.map((d) => ({
        date: d,
        label: formatDayLabel(d, range),
        minutes: dailyTotals(exams, d, strategy).actual,
      }));
      const referenceData: DayPoint[] = days.map((d) => ({
        date: d,
        label: formatDayLabel(d, range),
        minutes: dailyTotals(exams, d, strategy).suggested,
      }));
      const todayIndex = days.indexOf(today);
      return { data, referenceData, todayIndex: todayIndex >= 0 ? todayIndex : undefined };
    }
    // Aggregate by week. Bucket key = monday of the week containing the day.
    const buckets = new Map<string, { actual: number; suggested: number }>();
    const order: string[] = [];
    for (const d of days) {
      const dt = parseYmd(d);
      const dow = (dt.getDay() + 6) % 7;
      dt.setDate(dt.getDate() - dow);
      const key = ymd(dt);
      if (!buckets.has(key)) {
        buckets.set(key, { actual: 0, suggested: 0 });
        order.push(key);
      }
      const b = buckets.get(key)!;
      const dt2 = dailyTotals(exams, d, strategy);
      b.actual += dt2.actual;
      b.suggested += dt2.suggested;
    }
    const data: DayPoint[] = order.map((k) => ({
      date: k,
      label: formatWeekLabel(k),
      minutes: buckets.get(k)!.actual,
    }));
    const referenceData: DayPoint[] = order.map((k) => ({
      date: k,
      label: formatWeekLabel(k),
      minutes: buckets.get(k)!.suggested,
    }));
    // todayIndex = bucket della settimana corrente
    const todayMonday = (() => {
      const dt = parseYmd(today);
      const dow = (dt.getDay() + 6) % 7;
      dt.setDate(dt.getDate() - dow);
      return ymd(dt);
    })();
    const todayIndex = order.indexOf(todayMonday);
    return { data, referenceData, todayIndex: todayIndex >= 0 ? todayIndex : undefined };
  }, [exams, strategy, start, end, range, today]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-2">
      <div className="stats-toolbar">
        <RangeSelector value={range} onChange={setRange} />
        <ChartModeToggle value={mode} onChange={setMode} />
      </div>

      <KpiCards exams={exams} today={today} rangeStart={start} rangeEnd={end} />

      <TodayQuickLog exams={exams} today={today} />

      <StudyChart
        data={data}
        referenceData={referenceData}
        viewMode={mode}
        todayIndex={todayIndex}
        title="Effettivo vs Consigliato"
        subtitle="tempo che hai loggato vs quello suggerito dalla formula"
        animationKey={`${range}-${mode}`}
      />

      <YearHeatmap exams={exams} year={Number(today.slice(0, 4))} onDayClick={onDayClick} />

      <PerExamBars exams={exams} rangeStart={start} rangeEnd={end} />
    </div>
  );
}

const WEEKDAYS_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MONTHS_SHORT = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

function formatDayLabel(dayKey: string, range: StatsRange): string {
  const d = parseYmd(dayKey);
  if (range === "7g") return WEEKDAYS_SHORT[(d.getDay() + 6) % 7];
  if (range === "30g" || range === "mese") return String(d.getDate());
  // anno / tutto (non-aggregated branch — rare): mostra "1 Gen"
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function formatWeekLabel(mondayKey: string): string {
  const d = parseYmd(mondayKey);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}
```

- [ ] **Step 2: Verifica typecheck**

```bash
npx tsc --noEmit
```

Expected: errore in `App.tsx` perché ora `StatsView` richiede `onDayClick` prop.

- [ ] **Step 3: Commit**

```bash
git add src/components/StatsView.tsx
git commit -m "feat(stats): StatsView rewrite (toolbar, kpi, log, chart, heatmap, per-exam)"
```

---

## Task 18: Update `src/App.tsx`

**Goal:** Passare `onDayClick={setDayKey}` a `StatsView` per permettere click sulla heatmap.

**Files:**
- Modify: `src/App.tsx:82`

- [ ] **Step 1: Modificare la riga del rendering di StatsView**

Sostituire:

```tsx
{section === "stats" && <StatsView />}
```

con:

```tsx
{section === "stats" && <StatsView onDayClick={setDayKey} />}
```

- [ ] **Step 2: Verifica typecheck**

```bash
npx tsc --noEmit
```

Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(stats): pass onDayClick to StatsView for heatmap day-click"
```

---

## Task 19: Build + smoke test finale

**Goal:** Verifica end-to-end che tutto compila e funziona.

- [ ] **Step 1: Typecheck + build**

```bash
npx tsc --noEmit
npm run build
```

Expected: build passa senza errori.

- [ ] **Step 2: Test Rust**

```bash
cd src-tauri && cargo test --lib
```

Expected: tutti i test passano (incluso i 3 nuovi).

- [ ] **Step 3: Smoke test UI**

```bash
npm run tauri dev
```

Manuale (tutti devono funzionare senza crash):
1. Apri app → ok
2. Click "Statistiche" nel SectionSwitcher → carica la pagina
3. Pill range "7g" → vedi 7 punti sul chart
4. Click "30g" → 30 punti, animazione pillola
5. Toggle "Barre" → cambia visualizzazione
6. Hover su un punto/barra → tooltip
7. KPI cards mostrano streak/totali/passati (anche se 0)
8. TodayQuickLog mostra solo se ci sono attività oggi; modifica un input → blur → valore salvato (verifica refetch o reload manuale per ora)
9. Heatmap mostra tutto l'anno; click su una cella passata → apre DayModal di quel giorno
10. Per esame: barre con effettivo+consigliato
11. Switch dark mode (se possibile via DevTools / preferenza OS) → tutto leggibile

Per ogni problema visivo: prendere screenshot e iterare (non parte del plan questo, è parte dell'esecuzione).

- [ ] **Step 4: Final commit (se ci sono fix dell'ultimo miglio)**

Solo se necessario:

```bash
git add -A
git commit -m "fix(stats): smoke test adjustments"
```

---

## Spec coverage check

| Spec section | Task |
|---|---|
| §2 Semantic shift `study_days.minutes` | Task 4 (rimuove `effectiveMinutes` ramo override) + Task 5 (DayModal label) |
| §3.1-3.3 Strategy abstraction | Task 2 |
| §3.4 study-time.ts rewrite | Task 4 |
| §3.5 study-time-format.ts | Task 3 |
| §3.6 rimuove/rinomina | Task 4 |
| §3.7 aggiornamenti chiamanti | Task 5, 6, 7 |
| §3.8 SOLID self-check | (design-only, nessun task) |
| §4 Layout single scrollable | Task 17 |
| §5.1 RangeSelector | Task 10 |
| §5.2 ChartModeToggle | Task 11 |
| §5.3 KpiCards | Task 12 |
| §5.4 TodayQuickLog | Task 13 (frontend) + Task 1 (backend upsert) |
| §5.5 StudyChart | Task 14 |
| §5.6 YearHeatmap | Task 15 |
| §5.7 PerExamBars | Task 16 |
| §6.1 study-time | Task 4 |
| §6.2 DayModal | Task 5 |
| §6.3 ExamRow | Task 6 |
| §6.4 StatsView | Task 17 |
| §6.5 App.tsx | Task 18 |
| §7 Stats CSS | Task 9 |
| §8 Streak rules | Task 4 (`currentStreak`, `bestStreak`) + Task 12 (UI) |
| §9 Color scheme | Task 8 (CSS var) + Task 9 (uso nei stili) |
| §10 Cosa NON cambia | (verifica negativa, nessun task) |
| §11 Out of scope | (esplicito, nessun task) |
| §12 Open items | Task 1 (upsert decisione) |
| §13 File touched | tutti i task |
