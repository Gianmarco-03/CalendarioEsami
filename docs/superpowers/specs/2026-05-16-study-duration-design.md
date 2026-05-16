# Default study duration + project-as-multi-day-exam unification

**Status:** Approved (design)
**Date:** 2026-05-16
**Branch:** `feat/tauri-port`
**Previous specs:** `2026-05-16-elements-redesign-design.md`

## 1. Goal

Aggiungere un **tempo di studio giornaliero predefinito** (`t`) per ogni esame. I minuti effettivi di studio per ogni (esame, giorno) sono `t/n` dove `n` è il numero di "cose da studiare" attive quel giorno. Riformulare i progetti come "esami multi-giorno": stessa colonna `default_study_minutes`, stesso conteggio in `n`, ma rappresentazione sul calendario invariata.

## 2. Modello

### 2.1 Concetti

- **Esame** (`kind = "esame"`): ha appelli + study_days (toggle manuale per ogni giorno). Studio attivo SE l'utente ha toggleato lo studio per quel giorno.
- **Progetto** (`kind = "progetto"`): "esame multi-giorno". Ha ranges di date. Studio attivo IMPLICITAMENTE su ogni giorno che ricade in uno dei suoi ranges. NON ha study_days separati.
- **Default study minutes (t)**: campo per ogni esame (sia esami sia progetti). Range `0..=1440` (24h max). Default `60` minuti per nuovi esami; il valore `0` significa "no auto-study time" (non contribuisce ai totali).

### 2.2 Conteggio presenze (n) per giorno

`n(giorno D)` = numero totale di "presenze" attive quel giorno =
- numero di **esami** non-passed con `D` in `studyDays` (study toggleato)
- **+** numero di **progetti** non-passed con `D` dentro uno dei loro `ranges`

Identico a quanto già implementato in `count_presences` (Rust) e usato per il cap 4-attività.

### 2.3 Formula minuti effettivi

Per ogni coppia (esame X, giorno Y) dove X "studia" Y (toggle per esame, o range-covers per progetto):

```
effective_minutes(X, Y) =
  X.studyDays[Y].minutes  if non-null (manual override, solo per esami)
  X.default_study_minutes / n(Y)  altrimenti
```

**Calcolo dinamico**: nessuno storage statico dei minuti calcolati. Ogni rendering ricalcola sulla base dello stato corrente.

**Override manuale (esami)**: la colonna `study_days.minutes` resta nullable. Se non-null sovrascrive la formula. Per progetti l'override non esiste (i progetti non hanno righe in `study_days` — la loro "studio" è implicito nei range).

## 3. Schema — migration 003

```sql
-- src-tauri/src/db/migrations/003_default_study_minutes.sql
ALTER TABLE exams ADD COLUMN default_study_minutes INTEGER NOT NULL DEFAULT 60;
```

SQLite permette `ALTER TABLE ADD COLUMN NOT NULL DEFAULT N` se `N` è un literal. Esistenti righe ricevono `60`. Schema version sale a `3`.

## 4. Tipi

### 4.1 Rust (`src-tauri/src/db/types.rs`)

Aggiungere campo a `Exam` e `ExamInput`:

```rust
pub struct Exam {
    // ... esistenti ...
    pub default_study_minutes: i32,  // NEW
    // ... appelli, ranges, study_days ...
}

pub struct ExamInput {
    pub name: String,
    pub color: String,
    pub kind: ExamKind,
    pub passed: bool,
    pub default_study_minutes: i32,  // NEW
    pub appelli: Vec<String>,
    pub ranges: Vec<DateRange>,
}
```

Validazione in `validate_input`:

```rust
if input.default_study_minutes < 0 || input.default_study_minutes > 1440 {
    return Err(format!(
        "Tempo di studio predefinito non valido: {} (0..1440)",
        input.default_study_minutes
    ));
}
```

### 4.2 CRUD (`src-tauri/src/db/exams.rs`)

INSERT / UPDATE / SELECT di `exams` aggiornati per includere la nuova colonna. `build_exam` ne fa hydrate.

### 4.3 TS (`src/types.ts`)

```typescript
export interface Exam {
  // ... esistenti ...
  defaultStudyMinutes: number;  // NEW
  // ...
}

export interface ExamInput {
  // ...
  defaultStudyMinutes: number;  // NEW
  // ...
}
```

### 4.4 Boundary mapping (`src/db.ts`)

`fromWire()` mappa `default_study_minutes` → `defaultStudyMinutes` (oltre al già esistente `study_days` → `studyDays`):

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

## 5. UI

### 5.1 ExamModal — nuovo campo

Aggiungere una sezione dopo "Colore" (e prima di Appelli/Periodi):

```
Tempo di studio giornaliero
[Dropdown: 1h]
I minuti effettivi sono t/n, dove n è il numero di esami
attivi (esami in studio + progetti in corso) quel giorno.
```

Dropdown options (15 minuti step, da 0 a 8h = 33 voci):

- `0` → "Nessun tempo predefinito"
- `15` → "15m"
- `30` → "30m"
- `45` → "45m"
- `60` → "1h"
- `75` → "1h 15m"
- `90` → "1h 30m"
- … step `+15min` …
- `480` → "8h"

Default selezionato:
- Creazione: `60` (1h)
- Modifica: valore corrente dell'esame

Stesso campo per esami E progetti (è un "esame multi-giorno").

### 5.2 DayModal — minuti computati come placeholder

Per ogni esame con studio attivo nel giorno:

```
[●] Neuroanatomia    [ ⏱ 60 ] m   (auto: 60m = 120/2)
```

- L'input minuti resta editabile (manual override).
- Quando vuoto, placeholder mostra il valore della formula (es. `60`).
- Hint label accanto all'input mostra `(auto: ${computed}m = ${t}/${n})` se il valore è dalla formula, niente se è override esplicito.
- Cambiare l'input scrive un override in `study_days.minutes`. Cancellare l'input (svuotare) chiama `setStudyDayMinutes(examId, date, null)` → torna alla formula.

### 5.3 ExamRow meta — totali via formula

Helper TS in nuovo file `src/study-time.ts`:

```typescript
export function countPresences(dayKey: string, exams: Exam[]): number {
  let n = 0;
  for (const e of exams) {
    if (e.passed) continue;
    if (e.kind === "esame" && e.studyDays.some((s) => s.date === dayKey)) n++;
    if (e.kind === "progetto" && e.ranges.some((r) => dayKey >= r.start && dayKey <= r.end)) n++;
  }
  return n;
}

export function effectiveMinutes(exam: Exam, dayKey: string, allExams: Exam[]): number {
  // Manual override (solo esami)
  if (exam.kind === "esame") {
    const sd = exam.studyDays.find((s) => s.date === dayKey);
    if (sd?.minutes != null) return sd.minutes;
  }
  // Formula t/n
  const t = exam.defaultStudyMinutes;
  if (t === 0) return 0;
  const n = countPresences(dayKey, allExams);
  if (n === 0) return 0;
  return Math.round(t / n);
}

export function totalMinutes(exam: Exam, allExams: Exam[]): number {
  if (exam.kind === "esame") {
    return exam.studyDays.reduce((s, sd) => s + effectiveMinutes(exam, sd.date, allExams), 0);
  }
  // progetto: somma su ogni giorno di ogni range
  let tot = 0;
  for (const r of exam.ranges) {
    let cursor = new Date(r.start);
    const end = new Date(r.end);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      tot += effectiveMinutes(exam, key, allExams);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return tot;
}

export function formatHM(minutes: number): string {
  if (minutes === 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}
```

ExamRow `metaText()`:

```typescript
function metaText(exam: Exam, allExams: Exam[]): string {
  if (exam.kind === "progetto") {
    const totDays = exam.ranges.reduce(
      (s, r) => s + Math.max(1, Math.round((+new Date(r.end) - +new Date(r.start)) / 86_400_000) + 1), 0
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

ExamRow consuma `allExams` da `useExams().exams`.

### 5.4 Import (JSON da artifact)

Estendere `ArtifactExam` per leggere `defaultStudyMinutes` opzionale (se assente → 60):

```rust
#[derive(Deserialize)]
struct ArtifactExam {
    // ... esistenti ...
    #[serde(rename = "defaultStudyMinutes", default = "default_60")]
    default_study_minutes: i32,
}
fn default_60() -> i32 { 60 }
```

## 6. Cosa NON cambia

- Schema `study_days.minutes` (resta nullable, override manuale solo per esami).
- Comportamento `toggle_study_day` (toggle ON/OFF + cap 4 attività). I minuti effettivi sono computati lato FE, non lato DB.
- Calendar grid layout / DayCell visivo (V7b: bande, banner appelli, icone Cpu/BrainCircuit).
- Sidebar ExamRow layout (stripe + name + meta + actions). Solo il TESTO del meta cambia (formula al posto del raw sum).
- Aurora theme, motion, glass-panel.

## 7. Migrazione comportamento esistente

- Tutti i 31+ test Rust esistenti devono passare. I test che creano `ExamInput` aggiungeranno il campo `default_study_minutes: 60` (default sensato).
- Le righe esistenti in `exams` ricevono `default_study_minutes = 60` via il `DEFAULT` della migration.
- I `study_days` esistenti con `minutes` non-null restano override; con `null` ora usano la formula t/n.

## 8. Cap 4-attività

Resta invariato: il cap è basato su `count_presences` (Rust) che già conta studi + progetti. Nessuna interazione col nuovo campo `default_study_minutes`.

## 9. Open items risolti

| Item | Decisione |
|---|---|
| Calcolo statico vs dinamico | Dinamico (sempre computato) |
| Override manuale | Preservato (solo esami, via `study_days.minutes`) |
| Range default time | 0..=1440 min (0 = no auto-study) |
| Default per nuovi esami | 60 (1h) |
| Default per progetti | Stesso modello: 60 (1h) |
| Input UI | Dropdown 15min step, 0..480 (8h max nel dropdown) |
| Progetti contribuiscono a n | Sì |
| Import JSON: default mancante | 60 |

## 10. Out of scope

- Override minuti per progetti (i progetti non hanno study_days; la loro "studio" è completamente formula-driven).
- Modificare il default time per giorno specifico (es. "questo giorno valore diverso") — questa è la funzione del manual override; il default time è SOLO una proprietà dell'esame.
- Visualizzazione minuti calcolati nelle celle del calendario (resta nel DayModal e nella sidebar meta).
- Notifiche o reminder basati sul tempo studiato.
