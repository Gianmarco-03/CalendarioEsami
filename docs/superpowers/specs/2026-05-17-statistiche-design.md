# Statistiche — sezione completa con doppio grafico effettivo/consigliato

**Status:** Approved (design)
**Date:** 2026-05-17
**Branch:** `feat/tauri-port`
**Previous specs:**
- `2026-05-16-study-duration-design.md` (modello t/n, defaultStudyMinutes)
- `2026-05-16-progetto-subclass-design.md`
- `2026-05-16-aurora-restyle-design.md`
- `2026-05-17-popup-restyle-design.md`

## 1. Goal

Sostituire il placeholder `StatsView.tsx` con una sezione **Statistiche** scrollable che mostra:
- streak giornaliera + altre KPI
- input rapido del tempo studiato oggi
- **doppio grafico** effettivo (loggato dall'utente) vs consigliato (formula `t/n`), con toggle linea/barre, range temporale variabile e today-marker
- heatmap calendario annuale
- breakdown per esame con barre effettivo/consigliato

Riusare il pattern visivo del chart `Graph7Days` di `appunti_app/FrontEnd/src/react/components/studyPlan/`, adattato al tema aurora-glass.

## 2. Cambio semantico di `study_days.minutes` (prerequisito)

**Stato attuale** (post `2026-05-16-study-duration-design.md`):
`study_days.minutes` = "override manuale del consigliato". Null → applica formula `t/n`.

**Nuovo significato:**
`study_days.minutes` = **minuti effettivamente studiati** (log di realtà, **non** override del pianificato).
- `null` = giorno marcato come "studio per X" ma non quantificato (non si conta nei totali effettivi).
- valore numerico = minuti effettivamente fatti dall'utente quel giorno.

Il "consigliato" non è più derivato da `minutes` ma sempre da `t/n`.

### 2.1 Impatto sul comportamento

| Componente | Prima | Dopo |
|---|---|---|
| `effectiveMinutes()` | override-or-formula | **rimosso**, sostituito da `actualMinutes` + `SuggestedStrategy.compute` |
| `totalMinutes()` (sidebar meta) | somma override-or-formula | somma via strategia ("totale consigliato", vista di pianificazione) |
| DayModal input | "manuale/auto" | placeholder = `${suggested}`, label "consigliato: 60m" |
| Cap 4 attività (Rust `count_presences`) | invariato | invariato |
| Formula `t/n` | hardcoded in `effectiveMinutes` | dietro l'interfaccia `SuggestedStrategy` (vedi §3) |

### 2.2 Schema database

**Nessuna migration.** Stesso schema. Solo cambio di semantica + JSDoc su `StudyDay.minutes`.

I dati esistenti (qualunque valore non-null già in `study_days.minutes`) restano leggibili come "minuti effettivi": è un'interpretazione retroattiva accettabile dato che oggi il campo è praticamente inutilizzato (l'app non offre ancora un UX per loggare il tempo effettivo).

## 3. Architettura: strategy + file split

### 3.1 Goal di design

- **OCP**: la formula del "consigliato" è dietro un'interfaccia. Aggiungere strategie nuove (coach AI, pesi per priorità, formula adattiva) = nuova classe/oggetto, **zero** modifiche ai consumer.
- **DIP**: componenti dipendono dall'astrazione `SuggestedStrategy` via context/hook, non dalla funzione concreta.
- **SRP**: `study-time.ts` (oggi monolitico) splittato in 3 file per asse di cambiamento.

### 3.2 Split di `study-time.ts` in 3 file

| File | Responsibility | Cambia quando… |
|---|---|---|
| `src/suggested-strategy.ts` | Astrazione `SuggestedStrategy` + impl di default `tOverNStrategy` + React context | si aggiunge una nuova strategia |
| `src/study-time.ts` | Aggregazioni di dominio: `actualMinutes`, `countPresences`, `studiedDays`, `dailyTotals`, `suggestedTotalMinutes`, `currentStreak`, `bestStreak` | cambiano regole di aggregazione |
| `src/study-time-format.ts` | Pure helpers: `formatHM`, `durationOptions` + `DurationOption`, `rangeDays` | cambiano formati o utility di data |

Direzione delle import: `suggested-strategy.ts` → `study-time.ts` (per `countPresences`) e `study-time.ts` → `suggested-strategy.ts` (per il tipo `SuggestedStrategy`, type-only). Per evitare cicli runtime, `study-time.ts` **non importa** `tOverNStrategy` — riceve la strategia come parametro dai chiamanti.

### 3.3 `src/suggested-strategy.ts`

```typescript
import { createContext, useContext } from "react";
import type { Exam } from "./types";
import { countPresences } from "./study-time";

/**
 * Strategia per calcolare i "minuti consigliati" per (esame, giorno).
 * Implementazione di default: t/n. Estendibile (coach AI, pesi, formula adattiva) senza
 * modificare i consumer.
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

`App.tsx` avvolge l'app in `<SuggestedStrategyContext.Provider value={tOverNStrategy}>` (o omette il Provider — il `createContext(tOverNStrategy)` già fornisce default). Per cambio strategia globale: cambiare il `value` del Provider.

### 3.4 `src/study-time.ts` (riscritto)

```typescript
import type { Exam } from "./types";
import type { SuggestedStrategy } from "./suggested-strategy";
import { isProgetto, expandRanges } from "./progetto";

/** Conta presenze studio sul giorno (DISTINCT per exam_id). Identico a Rust `count_presences`. */
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

/** Minuti effettivamente loggati (0 se non quantificato). */
export function actualMinutes(exam: Exam, dayKey: string): number {
  return exam.studyDays.find((s) => s.date === dayKey)?.minutes ?? 0;
}

/** Iteratore dei giorni in cui un esame "studia" (toggle + range). */
export function studiedDays(exam: Exam): string[] {
  const base = exam.studyDays.map((s) => s.date);
  if (isProgetto(exam)) {
    return Array.from(new Set([...base, ...expandRanges(exam)]));
  }
  return base;
}

/** True se l'esame "studia" il giorno (toggle oppure range). */
function isStudying(exam: Exam, dayKey: string): boolean {
  if (exam.studyDays.some((s) => s.date === dayKey)) return true;
  if (isProgetto(exam) && exam.ranges.some((r) => dayKey >= r.start && dayKey <= r.end)) return true;
  return false;
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

/** Coppia effettivo/consigliato (composizione di `dailyActual` + `dailySuggested`). */
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

/** Totale consigliato per un esame su tutti i suoi studied days. Rimpiazza il vecchio `totalMinutes`. */
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

/**
 * Streak corrente: giorni consecutivi fino a oggi con `dailyActual > 0`.
 * Non dipende dalla strategia (basa su tempo loggato, non sul consigliato).
 */
export function currentStreak(allExams: Exam[], today: string): number {
  let count = 0;
  const cursor = new Date(today);
  while (count <= 365 * 3) {
    const key = cursor.toISOString().slice(0, 10);
    if (dailyActual(allExams, key) > 0) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return count;
}

/** Best streak su tutto lo storico (giorni con minuti > 0). Non dipende dalla strategia. */
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
  let best = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const next = new Date(sorted[i]);
    const diff = (+next - +prev) / 86_400_000;
    if (diff === 1) { cur++; best = Math.max(best, cur); }
    else cur = 1;
  }
  return best;
}
```

Nota SRP: `dailyActual` (no strategy) e `dailySuggested` (strategy required) sono separati per riflettere assi di cambiamento diversi. `dailyTotals` resta come composizione utile per UI che mostra entrambi (KpiCards, StudyChart, YearHeatmap tooltip). `currentStreak` usa solo `dailyActual` — non richiede strategia.

### 3.5 `src/study-time-format.ts`

```typescript
/** Format "1h30m" / "45m" / "2h" / "" (per 0). */
export function formatHM(minutes: number): string {
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

export interface DurationOption { value: number; label: string; }

/** Dropdown options 0..480 min step 15. */
export function durationOptions(): DurationOption[] {
  const out: DurationOption[] = [{ value: 0, label: "Nessun tempo predefinito" }];
  for (let m = 15; m <= 480; m += 15) {
    out.push({ value: m, label: formatHM(m) });
  }
  return out;
}

/** Elenco YYYY-MM-DD inclusivo tra start e end. */
export function rangeDays(start: string, end: string): string[] {
  const out: string[] = [];
  const cursor = new Date(start);
  const stop = new Date(end);
  while (cursor <= stop) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
```

### 3.6 Cosa rimuovere o rinominare

- `effectiveMinutes` (in `study-time.ts`) → **rimuovere**. Chiamanti passano alla strategia.
- `totalMinutes` → **rinominare** in `suggestedTotalMinutes` con signature `(exam, allExams, strategy)`.
- `formatHM`, `durationOptions`, `DurationOption` → **spostare** in `study-time-format.ts`. Tutti gli import esistenti vanno aggiornati.

### 3.7 Aggiornamenti chiamanti

Pattern generale per ogni consumer:

```typescript
const strategy = useSuggestedStrategy();
const suggested = strategy.compute(exam, dayKey, allExams);
// oppure
const { actual, suggested } = dailyTotals(allExams, dayKey, strategy);
```

Componenti:
- **`DayModal.tsx`**:
  - Import: `useSuggestedStrategy` da `./suggested-strategy`. Rimuovere import di `effectiveMinutes`.
  - `const strategy = useSuggestedStrategy()` all'inizio del componente.
  - Sostituire `effectiveMinutes(e, dayKey, active)` → `strategy.compute(e, dayKey, active)`.
  - Rinominare variabile `computed` → `suggested`.
  - Label `manuale` / `auto Xm` → `consigliato Xm`. Title (§6.2).
- **`ExamRow.tsx`**:
  - `const strategy = useSuggestedStrategy()`.
  - `totalMinutes(exam, allExams)` → `suggestedTotalMinutes(exam, allExams, strategy)`.
- **`StatsView.tsx`** e figli:
  - `KpiCards`, `TodayQuickLog`, `PerExamBars`, `YearHeatmap` ottengono `strategy` via hook ciascuno (oppure StatsView la grabba e la passa via prop — equivalente; default proposto: ognuno fa hook proprio per simmetria).
- **`App.tsx`**:
  - Decisione: usare il default del context (`createContext(tOverNStrategy)`) senza Provider esplicito. Se in futuro la strategia diventa dinamica (es. da settings), aggiungere `<SuggestedStrategyContext.Provider value={...}>` attorno a `<Shell />`.

### 3.8 SOLID self-check

| Principio | Status | Note |
|---|---|---|
| **S** Single Responsibility | ✓ | `study-time.ts` (aggregazioni dominio) / `suggested-strategy.ts` (logica del consigliato) / `study-time-format.ts` (pure formatting). `dailyActual` e `dailySuggested` separati per ragioni di cambiamento diverse. |
| **O** Open/Closed | ✓ | Per nuova strategia (es. `coachAIStrategy`): nuovo oggetto che implementa `SuggestedStrategy`, swap nel Provider. Zero modifiche a `study-time.ts`, `StudyChart`, `KpiCards`, ecc. |
| **L** Liskov | ✓ | Qualsiasi `SuggestedStrategy` impl deve rispettare il contratto: `compute → number ≥ 0`. Banale (no gerarchia profonda). |
| **I** Interface Segregation | ✓ | `SuggestedStrategy` ha 2 membri (`compute`, `label`). Niente metodi opzionali. Funzioni di dominio richiedono solo i parametri che usano (`dailyActual` non chiede strategy). |
| **D** Dependency Inversion | ✓ | Componenti dipendono da `SuggestedStrategy` (astrazione) via `useSuggestedStrategy()`. Concrete impl iniettata dal Provider. Funzioni pure ricevono strategy come parametro (no global import della concreta). |

**Estensione futura tipica** ("voglio una strategia adattiva che pesa per giorni rimanenti all'appello"):
1. Creare `src/strategies/adaptive-strategy.ts` con `export const adaptiveStrategy: SuggestedStrategy = {...}`.
2. Aggiungere setting UI in `SettingsModal` per scegliere strategia.
3. `App.tsx`: stato `[strategy, setStrategy]`, Provider value = strategy.
4. **Zero modifiche** a: `study-time.ts`, `StudyChart`, `KpiCards`, `TodayQuickLog`, `YearHeatmap`, `PerExamBars`, `DayModal`, `ExamRow`.

## 4. Layout — single scrollable page

`StatsView.tsx` diventa il layout host. Verticalmente, dall'alto:

1. **Toolbar** (sticky-ish, ma per ora normale): `<RangeSelector>` + `<ChartModeToggle>` (la toggle è funzionalmente accoppiata al grafico, ma la posizionamo nella toolbar globale).
2. **KPI strip** (`<KpiCards>`): 4 cards in griglia 4-col.
3. **Today Quick Log** (`<TodayQuickLog>`): collapsable card con input minuti per ogni esame attivo oggi.
4. **Study Chart** (`<StudyChart>`): port di `Graph7Days`, con header + metric cards + SVG.
5. **Year Heatmap** (`<YearHeatmap>`): griglia 7×53 con livelli di intensità.
6. **Per-exam bars** (`<PerExamBars>`): lista esami attivi + completati, ciascuno con doppia barra.

Scroll verticale dentro `<main>` (già scrollabile-friendly).

## 5. Componenti — struttura

### 5.1 `components/stats/RangeSelector.tsx`

```typescript
export type StatsRange = "7g" | "30g" | "mese" | "anno" | "tutto";

interface Props { value: StatsRange; onChange: (r: StatsRange) => void; }
```

Pill animata stile `SectionSwitcher` (pillola che scorre tra opzioni con `useLayoutEffect`). Default: `"7g"`.

`resolveRange(range, today)` (helper):
- `"7g"` → ultimi 7 giorni inclusi oggi
- `"30g"` → ultimi 30 giorni
- `"mese"` → mese corrente (1 → ultimo del mese)
- `"anno"` → anno corrente (1 gen → 31 dic). In modalità anno il chart aggrega per **settimana** (52-53 punti) per leggibilità.
- `"tutto"` → da min(studyDay) a oggi; se sopra ~180 giorni aggrega per settimana, altrimenti per giorno.

### 5.2 `components/stats/ChartModeToggle.tsx`

```typescript
interface Props { value: "line" | "bars"; onChange: (m: "line" | "bars") => void; }
```

Toggle pillola tra "Linea" e "Barre" (icone Lucide `TrendingUp` e `BarChart3`).

### 5.3 `components/stats/KpiCards.tsx`

```typescript
interface Props { exams: Exam[]; today: string; rangeStart: string; rangeEnd: string; }
```

Hook: `const strategy = useSuggestedStrategy();`

4 cards in `grid-cols-4 gap-3`:
1. **Streak attuale** (icona `Flame`, sfondo `rgba(255,120,80,0.15)`, fiamma animata `flame-flicker`). Valore = `currentStreak(exams, today)`. Sotto, piccolo: `best: ${bestStreak(exams)}g`.
2. **Tot studiato** (range): somma di `dailyTotals(exams, d, strategy).actual` per `d` in `rangeDays(start, end)`. Format `Xh Ym`.
3. **Media / giorno** (range): tot / `rangeDays.length`. Format `Xh Ym`.
4. **Esami passati**: `passed.length` / `exams.length`.

Hover: `lift-hover` (already defined in index.css).

### 5.4 `components/stats/TodayQuickLog.tsx`

```typescript
interface Props { exams: Exam[]; today: string; }
```

Hook: `const strategy = useSuggestedStrategy();`

Card collapsable. Default aperto se ci sono esami attivi oggi che studiano (`studyDays` o range). Lista esami che studiano oggi:

```
● Neuroanatomia  [60] m    consigliato 60m
```

- Input controllato che chiama `setStudyDayMinutes(examId, today, value)`.
- "consigliato 60m" = `strategy.compute(exam, today, exams)` formattato con `formatHM`.
- **Esami**: mostrati se hanno studio toggleato per oggi.
- **Progetti**: mostrati se un range copre oggi. Per loggare l'effettivo serve inserire una riga in `study_days(exam_id, date, minutes)`.
  - Backend Rust `set_study_day_minutes`: la verifica nel plan implementativo controllerà se la query attuale è un `UPDATE` su row esistente o un `INSERT OR REPLACE`. Se è solo update, va trasformato in upsert (con `minutes` nullable per non rompere la semantica "toggle senza valore" degli esami).
  - **Cap 4-attività**: NON impattato. `count_presences` (Rust) usa OR tra studyDay e range — un progetto con range coprente oggi è già contato 1; aggiungere una row in `study_days` per quello stesso progetto/giorno non duplica il count grazie alla semantica DISTINCT per exam_id.

### 5.5 `components/stats/StudyChart.tsx`

Port di `Graph7Days.tsx`. **Differenze rispetto all'originale:**

- Prop interfaccia identica (`data`, `referenceData`, `viewMode`, `todayIndex`, ecc.) tranne `color` che riceve default da CSS variable `--app-accent` invece di rosso.
- Generalizzato per **N punti** (oggi hardcoda 7): griglia, label X, animazioni adattate. Per N > 14 le label X si diradano (ogni 5 per 30 giorni, mese-iniziale per anno).
- CSS classes rinominate `weekly-chart__*` → `stats-chart__*`.
- Tema chiaro (vedi §7).
- Toggle linea/barre **non incluso** (vive in `<ChartModeToggle>` esterno, già nella toolbar). Lo `StudyChart` accetta `viewMode` come prop controllato.

Dati che riceve da `StatsView` (lo `StudyChart` rimane agnostico — non importa né `useSuggestedStrategy` né `dailyTotals`):
```typescript
const strategy = useSuggestedStrategy();
const days = rangeDays(rangeStart, rangeEnd);
const data = days.map(d => ({
  date: d, label: formatLabel(d, range),
  minutes: dailyTotals(exams, d, strategy).actual
}));
const referenceData = days.map(d => ({
  date: d, label: formatLabel(d, range),
  minutes: dailyTotals(exams, d, strategy).suggested
}));
const todayIndex = days.indexOf(today); // -1 → undefined se today non è nel range
```

Il chart vede solo `number[]` — non sa cosa sia `t/n` o `strategy`. Future strategie passano dai chiamanti senza toccare `StudyChart`.

Per la modalità "anno" (aggregazione settimanale): `dataAggregated = data per settimana, somma minutes`. Today index = settimana corrente.

### 5.6 `components/stats/YearHeatmap.tsx`

```typescript
interface Props { exams: Exam[]; year: number; onDayClick: (dayKey: string) => void; }
```

Hook: `const strategy = useSuggestedStrategy();`

Griglia 7 righe × 53 colonne. Ogni cella = un giorno dell'anno (column = settimana ISO, row = giorno della settimana, lunedì=0).

- Color level (5 livelli): `actual / max(actual_in_year)` × 4, arrotondato a `0..4`. `actual` viene da `dailyTotals(exams, day, strategy).actual` ma serve solo come check di presenza — la color intensity non dipende dal "consigliato".
- Classi: `.hm-0` (giorno senza studio o futuro) … `.hm-4` (intensità massima). Background palette: tinte di `--app-accent` (`rgba(70,130,240,0.08)` → `#1a2540`).
- Tooltip native `title="DD MMM · Xh Ym studiati (consigliato Yh Zm)"` — il consigliato qui viene da `dailyTotals(...).suggested`.
- Click cella → callback `onDayClick(dayKey)`, che da `StatsView` apre il `DayModal` (passando dayKey via stato condiviso o `useExams`-like). **Approccio**: `StatsView` non gestisce il DayModal direttamente — espone callback verso `App.tsx` (nuova prop `onDayClick`) che già gestisce `dayKey` state.
- Label mesi sopra (G F M A M G L A S O N D) allineate alla prima settimana del mese.
- Label giorni a sinistra (Lun/Mer/Ven mostrati, gli altri vuoti per non sovraffollare).

Anno mostrato: `year = today.getFullYear()`. Per ora niente navigazione anno (out of scope).

### 5.7 `components/stats/PerExamBars.tsx`

```typescript
interface Props { exams: Exam[]; rangeStart: string; rangeEnd: string; }
```

Per ogni esame attivo (non passed), una riga:

```
●  Neuroanatomia                   18h 30m / 24h consigliate
[████░░░░░░░░░░░░░░░░░░░░░░░░░░░] 77%
```

- `pe-bar-bg`: track grigio
- `pe-bar-ref`: barra "consigliato" larghezza relativa (max barra = max(consigliato) tra tutti gli esami)
- `pe-bar-actual`: barra colore esame sopra
- Width transitions con `cubic-bezier(0.22, 1, 0.36, 1)` 600ms (animazione mount)

Hook: `const strategy = useSuggestedStrategy();`

Calcoli (limitati al range, helper inline o estratti se riusabili):
- `actualForExam(e, days)` = `Σ actualMinutes(e, d)` per d in `days ∩ studiedDays(e)`
- `suggestedForExam(e, days, allExams)` = `Σ strategy.compute(e, d, allExams)` per d in `days ∩ studiedDays(e)`
- Percentuale `actual / suggested * 100` (se suggested=0 mostra solo "Xh studiate")
- Ordinamento: per `actual` decrescente

Sotto, una sezione collapsable "Completati" con esami passed (uguale schema, ma `actual` su tutta la loro storia).

## 6. Aggiornamenti a componenti esistenti

### 6.1 `src/study-time.ts` + nuovi file

Vedere §3 (split in 3 file + strategy abstraction). Riepilogo modifiche al file esistente: rimuovere `effectiveMinutes`, rinominare `totalMinutes` → `suggestedTotalMinutes` (con strategy), spostare `formatHM`/`durationOptions` in `study-time-format.ts`, aggiungere helpers nuovi.

### 6.2 `src/components/DayModal.tsx`

- Import: `useSuggestedStrategy` da `../suggested-strategy`. Rimuovere import di `effectiveMinutes`.
- `const strategy = useSuggestedStrategy();` all'inizio del componente.
- Sostituire `effectiveMinutes(e, dayKey, active)` → `strategy.compute(e, dayKey, active)`.
- Rinominare variabile `computed` → `suggested`.
- Label `manuale` / `auto Xm` → `consigliato Xm` (sempre).
- Title del tooltip dell'input:
  - se valore presente: `Hai studiato X minuti. Consigliato: ${suggested}m`
  - se vuoto: `Consigliato: ${suggested}m. Inserisci quanto hai studiato.` (la `formula ${t}/${n}` può essere mostrata solo se `strategy.label === "t/n"` — ma per ora generalizziamo: niente formula nel tooltip)

### 6.3 `src/components/ExamRow.tsx`

- `const strategy = useSuggestedStrategy();`
- `totalMinutes(exam, allExams)` → `suggestedTotalMinutes(exam, allExams, strategy)`.
- Nessuna modifica visiva.

### 6.4 `src/components/StatsView.tsx`

Riscrittura completa (oggi è placeholder). Skeleton:

```tsx
export function StatsView({ onDayClick }: { onDayClick: (d: string) => void }) {
  const { exams } = useExams();
  const today = todayKey();
  const [range, setRange] = useState<StatsRange>("7g");
  const [mode, setMode] = useState<"line" | "bars">("line");
  const { start, end } = resolveRange(range, today);
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-2 flex flex-col gap-4">
      <Toolbar>
        <RangeSelector value={range} onChange={setRange} />
        <ChartModeToggle value={mode} onChange={setMode} />
      </Toolbar>
      <KpiCards exams={exams} today={today} rangeStart={start} rangeEnd={end} />
      <TodayQuickLog exams={exams} today={today} />
      <StudyChart exams={exams} range={range} viewMode={mode} rangeStart={start} rangeEnd={end} today={today} />
      <YearHeatmap exams={exams} year={Number(today.slice(0,4))} onDayClick={onDayClick} />
      <PerExamBars exams={exams} rangeStart={start} rangeEnd={end} />
    </div>
  );
}
```

### 6.5 `src/App.tsx`

- `<StatsView />` riceve `onDayClick={setDayKey}` (riusa il `dayKey` state esistente).

## 7. Stili — port `Graph7Days` al tema aurora-glass

Spostiamo le classes da `weekly-chart__*` (dark theme nero) a `stats-chart__*` (light theme glass-panel).

### 7.1 Trasformazioni principali

| Origine (dark) | Adattamento (light/aurora) |
|---|---|
| `background: rgba(0,0,0,0.88)` | `background: rgba(255,255,255,0.72)` (var glass-panel) |
| `border: 1px solid rgba(255,255,255,0.08)` | `border: 1px solid rgba(70,130,240,0.18)` |
| `color: #fff` (titles) | `color: var(--color-app-fg)` |
| `rgba(255,255,255,0.05)` (cards bg) | `rgba(255,255,255,0.55)` |
| `rgba(255,255,255,0.52)` (subtitle) | `var(--color-app-muted)` |
| `rgba(255,255,255,0.08)` (grid-line) | `rgba(70,130,240,0.10)` |
| `weekly-chart__ref-line` white-dashed | scuro: `stroke: rgba(26,37,64,0.85)` con stessa pattern dashed |
| `weekly-chart__ref-point` white fill | scuro: `fill: var(--color-app-fg)` |
| `weekly-chart__tooltip-box` white fill | invariato (resta tooltip chiaro) |
| `weekly-chart__bar--reference` fill `rgba(255,255,255,0.88)` | `fill: rgba(26,37,64,0.85)` con stroke chiaro per separazione |
| `weekly-chart__legend-dash` (white pattern) | scuro: `var(--color-app-fg)` pattern |

### 7.2 File CSS

Nuovo file `src/components/stats/stats-chart.css` (importato dal componente). Riusa le animazioni (`reveal-rect`, `flame-flicker`, etc.) e i transition timing originali.

Anche i selettori dark-mode: la CSS variable `--color-app-fg` cambia da sola tra light e `.dark`, quindi la maggior parte degli stili è dark-mode-friendly out of the box. Cure puntuali:

- `.stats-chart__ref-line` in dark → `stroke: rgba(255,255,255,0.96)` (come originale)
- `.stats-chart__bar--reference` in dark → fill bianco originale
- Cioè: condizionare su `.dark .stats-chart__...` quando serve.

## 8. Streak — regole esatte

- "Giorno conta" se `dailyTotals(d).actual > 0`.
- **Current streak**: parte da oggi, scende all'indietro fino al primo zero. Cap safety a 3 anni (~1095 giorni).
- **Best streak**: scan su tutto il range di studyDays con minuti > 0, max sequenza consecutiva.
- No "skip weekend", no "freeze cards", no tolleranze.
- Visualizzazione: numero grande + `Flame` icon (Lucide) con animazione `flame-flicker` 2.4s. Sotto: `best: Xg`.

## 9. Color scheme

- **Effettivo (actual)**: usa `--color-app-accent` (default `#1a2540` light / `#e7ebf2` dark) come base, ma per il chart preferiamo un colore più "vivo" che si stacchi dal fondo glass. Aggiungiamo CSS variable nuova:
  - `--color-stats-actual: #2E86C1` (light) / `--color-stats-actual: #5fa9e8` (dark)
- **Consigliato (reference)**: `var(--color-app-fg)` (scuro in light, chiaro in dark) con dash pattern.
- **Per-exam bars**: usa `exam.color` direttamente per la barra `actual`. Barra consigliata `var(--color-app-fg)` con dash.

## 10. Cosa NON cambia

- Schema database (nessuna migration).
- Backend Rust API `toggle_study_day`, `set_study_day_minutes`: invariati come signature. **Possibile estensione richiesta**: `set_study_day_minutes` deve accettare exam_id di un progetto anche senza prima `toggle_study_day`. Verificare nel plan implementativo se ciò richiede una modifica Rust o se è già supportato.
- Calendar, DayCell, Modal, Settings, Import: invariati.
- Aurora theme, glass-panel utility classes: invariati (la sezione li riusa).
- `defaultStudyMinutes` e formula `t/n`: invariati. Sono il "consigliato".

## 11. Out of scope (esplicito)

- Goal/target hours custom per esame (es. "voglio raggiungere 100h prima dell'appello").
- Notifiche / reminder.
- Esportazione CSV/PDF.
- Forecast predittivo ("a questo ritmo finirai X il giorno Y").
- Streak gamification: badge, freeze cards, milestone celebrations.
- Navigazione anno nella heatmap (sempre anno corrente).
- Comparison view tra esami in stile radar/spider.
- Persistenza preferenza `range` / `mode` tra reload (oggi è in-memory).
- Streak con tolleranza weekend o "rest days".

## 12. Open items / decisioni da confermare in plan

| Item | Default proposto |
|---|---|
| Progetti in TodayQuickLog: log effettivo richiede insert in `study_days`? | Sì. Backend va testato e adattato se serve. |
| Aggregazione settimanale per range "anno": dove vive? | In `StudyChart` (riceve range come prop e decide internamente). |
| Soglia "tutto" per aggregare settimanalmente | 180 giorni. |
| Colore per `actual` nel chart globale | `#2E86C1` (blu medio, distinto dall'accento scuro). |
| Mese-label sulla heatmap | Mostra iniziale (G/F/M/...) sopra la prima settimana del mese. |

## 13. File touched (riepilogo)

**Nuovi:**
- `src/suggested-strategy.ts` (interface + `tOverNStrategy` default + context + hook)
- `src/study-time-format.ts` (split: `formatHM`, `durationOptions`, `rangeDays`)
- `src/components/stats/RangeSelector.tsx`
- `src/components/stats/ChartModeToggle.tsx`
- `src/components/stats/KpiCards.tsx`
- `src/components/stats/TodayQuickLog.tsx`
- `src/components/stats/StudyChart.tsx`
- `src/components/stats/YearHeatmap.tsx`
- `src/components/stats/PerExamBars.tsx`
- `src/components/stats/stats-chart.css`

**Modificati:**
- `src/study-time.ts` (rimuove `effectiveMinutes`, rinomina `totalMinutes` → `suggestedTotalMinutes` con strategy param, sposta format helpers in `study-time-format.ts`, aggiunge `actualMinutes`/`dailyTotals`/`currentStreak`/`bestStreak`)
- `src/components/StatsView.tsx` (riscrittura completa)
- `src/components/DayModal.tsx` (usa `useSuggestedStrategy` + label)
- `src/components/ExamRow.tsx` (usa `useSuggestedStrategy` + helper rename)
- `src/components/ExamModal.tsx` (import `durationOptions` da nuovo path `study-time-format`)
- `src/App.tsx` (passa `onDayClick` a `StatsView`)
- `src/index.css` (nuova CSS variable: `--color-stats-actual`)

**Eventualmente da modificare** (decisione in plan):
- `src-tauri/src/db/exams.rs` (`set_study_day_minutes` upsert se non già tale, per supportare log su progetti)
