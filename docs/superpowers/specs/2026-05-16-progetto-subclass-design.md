# Esame/Progetto Refactor (Subclass + SOLID) — Design Spec

**Status:** Approved (design)
**Date:** 2026-05-16
**Branch:** `feat/tauri-port`
**Previous specs:** `2026-05-16-study-duration-design.md`

## 1. Goal

Riorganizzare il modello in stile OOP: `Progetto` è una sottoclasse di `Esame`. Il campo `ranges` smette di gravare su ogni esame e vive solo in `Progetto`. La logica progetto-specifica (gestione dei range, espansione in giorni, edge detection) viene incapsulata in moduli dedicati. Applicare SOLID.

Risolve la limitazione attuale per cui un esame con una componente "progetto" + un orale richiede due voci distinte: un `Progetto` può ora avere **anche** `appelli` (e study_days) ereditati da `Esame`.

## 2. SOLID — mappa principi → applicazione

| Principio | Applicazione |
|---|---|
| **SRP** | Tre concetti separati: `Esame` (dati base), `Progetto` (ranges + estensione di Esame), e moduli helper distinti (`study-time` per il calcolo t/n, `progetto` per la logica range-specifica). |
| **OCP** | Aggiungere un nuovo `kind` (es. `Tesi`) richiede un nuovo variant nell'enum + nuovo modulo helper. Niente codice esistente viene modificato. |
| **LSP** | `Progetto` è-un `Esame` in tutti i contesti: viene serializzato con tutti i campi di `Esame` + i suoi propri, e ogni operazione su `Esame` funziona su `Progetto`. |
| **ISP** | Componenti che NON necessitano di logica range (ExamRow meta, sezione appelli del modale) consumano solo l'interfaccia base. Componenti range-aware (DayCell, Calendar) usano helper specifici di Progetto. |
| **DIP** | I componenti dipendono dall'astrazione `Exam` (discriminated union), non dalla forma concreta. Helper range-specifici sono importati da `progetto.ts` esplicitamente solo dove servono. |

## 3. Modello

### 3.1 Rust (`src-tauri/src/db/types.rs`)

```rust
/// Dati base condivisi: corrisponde a "Esame" puro.
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

/// Dati di un Progetto = Esame + ranges.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgettoData {
    #[serde(flatten)]
    pub esame: EsameData,
    pub ranges: Vec<ProjectRange>,
}

/// Discriminated union; serde tagga col campo "kind".
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
    pub fn ranges(&self) -> &[ProjectRange] {
        match self {
            Exam::Esame(_) => &[],
            Exam::Progetto(p) => &p.ranges,
        }
    }
}

/// Input mirroring: input di create/update segue la stessa forma.
#[derive(Debug, Clone, Deserialize)]
pub struct EsameInputData {
    pub name: String,
    pub color: String,
    pub passed: bool,
    pub default_study_minutes: i32,
    pub appelli: Vec<String>,
    // NB: study_days NON sono in input (vengono toggleati via comando separato)
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

### 3.2 TypeScript (`src/types.ts`)

```typescript
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

export type Esame = EsameData & { kind: "esame" };
export type Progetto = ProgettoData & { kind: "progetto" };
export type Exam = Esame | Progetto;

// Inputs mirror the same hierarchy (no studyDays — toggled separately)
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

Narrowing helpers exportati da `src/progetto.ts` (vedi §4.2).

## 4. Moduli (SRP applicato)

### 4.1 `src/study-time.ts` (esistente, da generalizzare)

Ospita SOLO logica che concerne il calcolo t/n e i totali. Lavora sull'astrazione `Exam` ma delega l'iterazione dei giorni a moduli specifici quando serve. La funzione `studiedDays(exam)` rimane qui ma per la parte progetto-specifica chiama `expandRanges(p)` da `progetto.ts`.

```typescript
import { isProgetto, expandRanges } from "./progetto";

export function studiedDays(exam: Exam): string[] {
  const base = exam.studyDays.map((s) => s.date);
  if (isProgetto(exam)) {
    // union dei giorni di studio manuali + ogni giorno coperto dai range
    return Array.from(new Set([...base, ...expandRanges(exam)]));
  }
  return base;
}
```

`countPresences`, `effectiveMinutes`, `totalMinutes`, `formatHM`, `durationOptions` restano qui. Operano su `Exam` (LSP).

### 4.2 `src/progetto.ts` (NUOVO)

Tutta la logica range-specifica.

```typescript
import type { Exam, Progetto, ProjectRange } from "./types";

export function isProgetto(e: Exam): e is Progetto {
  return e.kind === "progetto";
}

/** Espande tutti i range di un progetto nei singoli YYYY-MM-DD coperti (dedup). */
export function expandRanges(p: Progetto): string[] {
  const seen = new Set<string>();
  for (const r of p.ranges) {
    const start = new Date(r.start);
    const end = new Date(r.end);
    const cursor = new Date(start);
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      seen.add(`${y}-${m}-${d}`);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return Array.from(seen);
}

/** Numero totale di giorni unici coperti dai range. */
export function totalRangeDays(p: Progetto): number {
  return expandRanges(p).length;
}

/** Se un giorno è dentro almeno un range del progetto. */
export function dateInAnyRange(p: Progetto, dayKey: string): boolean {
  return p.ranges.some((r) => dayKey >= r.start && dayKey <= r.end);
}

/** Edge detection per le stripe di inizio/fine. */
export interface ProjectEdges {
  start: boolean;
  end: boolean;
  startColor: string | null;
  endColor: string | null;
}
export function computeProjectEdges(p: Progetto, dayKey: string): ProjectEdges {
  let start = false, end = false;
  let startColor: string | null = null, endColor: string | null = null;
  for (const r of p.ranges) {
    if (r.start === dayKey) { start = true; startColor = p.color; }
    if (r.end === dayKey)   { end = true;   endColor = p.color; }
  }
  return { start, end, startColor, endColor };
}
```

### 4.3 `src-tauri/src/db/progetto.rs` (NUOVO)

Helpers Rust per la logica range. Per ora minimale (CRUD resta in exams.rs perché tocca più tabelle).

```rust
use crate::db::types::{Progetto, ProjectRange};
use chrono::NaiveDate;

/// Espande tutti i range di un Progetto in YYYY-MM-DD unici.
pub fn expand_ranges(p: &ProgettoData) -> Vec<String> {
    let mut seen = std::collections::BTreeSet::new();
    for r in &p.ranges {
        if let (Ok(start), Ok(end)) = (
            NaiveDate::parse_from_str(&r.start, "%Y-%m-%d"),
            NaiveDate::parse_from_str(&r.end, "%Y-%m-%d"),
        ) {
            let mut d = start;
            while d <= end {
                seen.insert(d.format("%Y-%m-%d").to_string());
                if let Some(next) = d.succ_opt() { d = next; } else { break; }
            }
        }
    }
    seen.into_iter().collect()
}

/// Numero di giorni unici coperti dai range del progetto.
pub fn total_range_days(p: &Progetto) -> usize {
    expand_ranges(p).len()
}
```

### 4.4 `src-tauri/src/db/exams.rs`

CRUD si adatta al nuovo `Exam` enum. Le funzioni `create`, `update`, `list`, `get_by_id`, `search` accettano/restituiscono `ExamInput`/`Exam` enum. Il database mantiene la sua struttura attuale (kind + tabelle separate appelli/ranges/study_days).

`build_exam(...)` cambia firma: riceve `kind_str` e in base ad esso costruisce variant `Esame` o `Progetto`:

```rust
fn build_exam(
    conn: &Connection,
    id, name, color, kind_str, passed, dsm,
) -> Result<Exam, String> {
    let appelli = load_appelli(conn, id)?;
    let study_days = load_study_days(conn, id)?;
    let base = EsameData { id, name, color, passed, default_study_minutes: dsm, appelli, study_days };
    match kind_str {
        "esame"    => Ok(Exam::Esame(base)),
        "progetto" => {
            let ranges = load_ranges(conn, id)?;
            Ok(Exam::Progetto(ProgettoData { esame: base, ranges }))
        }
        other => Err(format!("kind sconosciuto: {other}")),
    }
}
```

## 5. Validazione (`src-tauri/src/db/types.rs`)

`validate_input` lavora su `ExamInput`:

```rust
pub fn validate_input(input: &ExamInput) -> Result<String, String> {
    let base = input.base();
    let name = validate_name(&base.name)?;
    validate_color(&base.color)?;
    if base.default_study_minutes < 0 || base.default_study_minutes > 1440 { ... }
    for d in &base.appelli { validate_date(d)?; }
    if let ExamInput::Progetto(p) = input {
        for r in &p.ranges { validate_range(r)?; }
        if p.ranges.is_empty() {
            return Err("Un progetto richiede almeno un periodo".into());
        }
    }
    Ok(name)
}
```

**Cambiamento netto rispetto al modello vecchio:**
- ❌ RIMOSSO: "Un esame non può avere ranges" (non più necessario: gli Esami non hanno il campo ranges)
- ❌ RIMOSSO: "Un progetto non può avere appelli" (un Progetto può ora avere appelli, ereditati da Esame)
- ✅ MANTENUTO: "Un progetto richiede almeno un periodo"

## 6. Toggle study day — accettare anche progetti

`toggle_study_day` attualmente rifiuta di toggleare studio su un `kind = 'progetto'`. Ora deve accettare entrambi i kind:

```rust
let exam_exists: bool = conn.query_row(
    "SELECT 1 FROM exams WHERE id = ?1",  // rimosso AND kind = 'esame'
    params![exam_id],
    |_| Ok(true),
).unwrap_or(false);
if !exam_exists {
    return Err(format!("Esame {exam_id} non esistente"));
}
```

Rationale: un Progetto può ora avere study_days extra (es. "studio in più fuori dai range").

## 7. count_presences — count DISTINCT per exam

Con la nuova capacità per cui un `Progetto` può avere range covering D AND study_day toggleato su D, conteresti 2 presenze per lo stesso esame. Cambio:

```rust
let n_total: i64 = conn.query_row(
    "SELECT COUNT(DISTINCT e.id) FROM exams e
     WHERE e.passed = 0 AND e.id IN (
         SELECT exam_id FROM study_days WHERE date = ?1
         UNION
         SELECT exam_id FROM project_ranges WHERE ?1 BETWEEN start_date AND end_date
     )",
    params![date],
    |r| r.get(0),
).map_err(|e| format!("count: {e}"))?;
Ok(n_total as usize)
```

Uguale per il client TS `countPresences`: contare esami distinti che hanno range covering D o studyDay su D.

## 8. DayCell — 1 banda per esame con priorità range

`buildActivities` adatta:

```typescript
function buildActivities(D, exams) {
  const activities = [];
  for (const e of exams) {
    if (e.passed) continue;
    const inRange = isProgetto(e) && dateInAnyRange(e, D);
    const hasStudy = e.studyDays.some(s => s.date === D);
    if (inRange) {
      activities.push({ kind: "project", color: e.color, examId: e.id, examName: e.name });
    } else if (hasStudy) {
      activities.push({ kind: "study", color: e.color, examId: e.id, examName: e.name });
    }
  }
  // sorting: projects first by name, then studies by name (invariato)
  return activities;
}
```

**Regola di priorità:** range > study_day per lo stesso esame. Icona `Cpu` se range copre D, altrimenti `BrainCircuit` (studio manuale).

`computeProjectEdges` ora cammina solo sui `Progetto` (helper da `progetto.ts`).

`buildBanners` accetta `Exam` (entrambi i kind possono avere appelli).

## 9. ExamModal — lista unificata con checkbox per riga

**Cambio rispetto alla versione precedente:** elimino il segmented control "Esame / Progetto" in cima. Le sezioni "Appelli" e "Periodi" si fondono in una **singola lista** dove ogni riga ha un checkbox che la trasforma da appello (singola data) in periodo (data inizio + fine). Il `kind` (Esame vs Progetto) viene **derivato** dalla composizione delle righe: se ≥1 riga è "periodo" → kind = `progetto`, altrimenti `esame`.

### 9.1 Struttura del modale

- Titolo: derivato dalla composizione corrente delle entries.
  - 0 entries "periodo" → "Nuovo esame" / "Modifica esame"
  - ≥1 entry "periodo" → "Nuovo progetto" / "Modifica progetto"
- **Nome** (input testo)
- **Colore** (palette swatches)
- **Tempo di studio giornaliero** (dropdown)
- **Date d'esame / Periodi** (lista unificata):
  - Ogni riga (in ordine):
    - Checkbox a sinistra, label "Periodo"
    - Input(s) di data:
      - Checkbox OFF → 1 `<input type="date">` (singola data = appello)
      - Checkbox ON → 2 `<input type="date">` affiancati (inizio + fine = periodo)
    - Bottone `✕` rimuovi a destra
  - Bottone link "+ Aggiungi data" sotto la lista
- **Elimina** (solo edit) + **Salva**

### 9.2 Stato React (`src/components/ExamModal.tsx`)

```typescript
type Entry =
  | { uid: string; type: "appello"; date: string }
  | { uid: string; type: "range"; start: string; end: string };

const [entries, setEntries] = useState<Entry[]>([]);
const [name, setName] = useState("");
const [color, setColor] = useState(PALETTE[0]);
const [defaultMinutes, setDefaultMinutes] = useState(60);
// NIENTE useState<ExamKind>: il kind è derivato.

// Derive
const derivedKind: ExamKind = entries.some((e) => e.type === "range")
  ? "progetto"
  : "esame";
```

`uid` è un ID locale (es. `Math.random().toString(36).slice(2,9)`) per la stable key React; **non viene serializzato** verso il DB (gli ID veri vengono ricreati dal Rust dopo l'insert).

### 9.3 Inizializzazione

Su create (`!editing`):
- `initialKind === "esame"` → `entries = [{ uid, type: "appello", date: "" }]`
- `initialKind === "progetto"` → `entries = [{ uid, type: "range", start: "", end: "" }]`

(Il prop `initialKind` resta utile come hint ai bottoni "+ Esame" / "+ Progetto" della Sidebar.)

Su edit (`editing` definito):

```typescript
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
```

### 9.4 Toggle checkbox (cambio di tipo riga)

```typescript
function toggleEntryType(uid: string) {
  setEntries((prev) => prev.map((e) => {
    if (e.uid !== uid) return e;
    if (e.type === "appello") {
      // appello → range: preserva la data come start
      return { uid, type: "range", start: e.date, end: "" };
    } else {
      // range → appello: tiene lo start come date
      return { uid, type: "appello", date: e.start };
    }
  }));
}
```

### 9.5 Save handler

```typescript
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

  const baseInput = {
    name: trimmed,
    color,
    passed: editing?.passed ?? false,
    defaultStudyMinutes: defaultMinutes,
    appelli: cleanAppelli,
  };

  const input: ExamInput = kind === "progetto"
    ? { kind: "progetto", ...baseInput, ranges: cleanRanges }
    : { kind: "esame", ...baseInput };

  const result = editing
    ? await update(editing.id, input)
    : await create(input);
  if (result) { toast.success(editing ? "Modifiche salvate" : "Aggiunto"); onClose(); }
};
```

### 9.6 Rendering di una riga (esempio)

```tsx
{entries.map((entry) => (
  <div key={entry.uid} className="flex items-center gap-2 mb-2">
    <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-app-muted">
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
        className="flex-1 px-2 py-1.5 text-[12.5px] glass-input rounded-lg"
      />
    ) : (
      <>
        <input
          type="date"
          value={entry.start}
          onChange={(ev) => updateEntry(entry.uid, { start: ev.target.value })}
          className="flex-1 min-w-0 px-2 py-1.5 text-[12.5px] glass-input rounded-lg"
        />
        <span className="text-[10px] text-app-muted shrink-0">→</span>
        <input
          type="date"
          value={entry.end}
          onChange={(ev) => updateEntry(entry.uid, { end: ev.target.value })}
          className="flex-1 min-w-0 px-2 py-1.5 text-[12.5px] glass-input rounded-lg"
        />
      </>
    )}

    <button
      type="button"
      onClick={() => removeEntry(entry.uid)}
      className="p-1 text-app-muted hover:bg-app-hover rounded"
      aria-label="Rimuovi"
    ><XIcon size={14} /></button>
  </div>
))}
```

### 9.7 Validazione lato FE (pre-invio)

Nessuna nuova validazione: la combinazione corrente di filtri (`!!e.date`, `!!e.start`) scarta righe vuote. Se l'utente ha solo una riga vuota, l'input arriva al Rust con appelli/ranges vuoti — il backend permette un esame "placeholder" (kind = esame, nessun appello, nessun range), che è accettato.

Caso "Un progetto richiede almeno un periodo" del backend: ora non scatta mai perché se ranges è vuoto, il kind diventa esame.

## 10. ExamRow + DayModal

Adattamenti minimi:

- `ExamRow metaText(exam, allExams)`: progetto mostra `${totalRangeDays(p)}g · ${formatHM(totalMinutes)}`. Esame mostra `${nApp}·${formatHM(totalMinutes)}` come prima. (Importa `totalRangeDays` da `progetto.ts`.)
- `DayModal`: lista delle voci toggleabili include SIA esami SIA progetti (prima escludeva i progetti). Il toggle riflette lo stato di `study_days` (NON lo stato di range coverage). Concretamente:
  - Esame: toggle on/off = aggiunge/rimuove study_day, come oggi.
  - Progetto: toggle on/off = aggiunge/rimuove study_day, come per gli esami. Il bg colorato della cella resta determinato dal range coverage (priorità range), quindi spuntare il toggle in un giorno già dentro un range non cambia il visivo. Caso d'uso: registrare ore extra di studio sul progetto in un giorno *fuori* dal range (es. settimana di preparazione orale post-progetto).
  - Per chiarire UX: header della sezione resta `Sto studiando per…` per entrambi i kind.

## 11. Schema

Nessun cambiamento. Lo schema esistente (kind, project_ranges, study_days, exams) accomoda già il modello rivisto. Nessuna migration 004.

## 12. Import JSON

Backward compat: i payload con `type: "esame"` e `type: "progetto"` continuano a funzionare. Per i `progetto`, gli appelli (se presenti nel JSON) ora vengono **accettati** invece di scartati. Cambio in `import.rs`:

```rust
// rimuovi il controllo che scartava appelli per progetti
```

E la costruzione di `ExamInput` segue la nuova forma enum.

## 13. Cosa NON cambia

- Schema DB
- Calendar layout / Aurora
- Cap 4-attività per giorno (basato su count_presences DISTINCT, conta esami distinti)
- Settings / theme / glass-panel / lift-hover
- Tipi `Appello`, `StudyDay`, `ProjectRange`, `DateRange`, `ExamKind` (l'enum stringa esiste ancora come tipo per il discriminator)
- Default study minutes feature (sopravvive intatta)
- ImportModal flow

## 14. Out of scope

- Multipli kind oltre Esame/Progetto (Tesi, Esercitazione, ecc.).
- Conversione Esame → Progetto in editing (richiede UX dedicata; per ora va eliminato e ricreato).
- Helper Rust più sofisticati in `progetto.rs` (per ora ospita solo `expand_ranges`, `total_range_days`).
- Test unitari per `progetto.ts` (TS): il modulo è semplice abbastanza da essere coperto via i test esistenti del DayCell/ExamRow integration.

## 15. Open items risolti

| Item | Decisione |
|---|---|
| `ranges` su ogni esame | NO — solo su Progetto |
| Hierarchy semantica | `Progetto extends Esame` |
| Encapsulation | `progetto.ts` modulo dedicato per logica range |
| Validazione | progetto può avere appelli ora |
| toggle_study_day | accetta entrambi i kind |
| count_presences | DISTINCT per exam ID |
| DayCell priorità | range > study_day per stesso esame |
| Migration schema | non necessaria |
| Backward compat import | sì, type="progetto" con appelli ora funziona |
| ExamModal segmented control | RIMOSSO — kind derivato dalle entries |
| Lista appelli/periodi | unificata, checkbox "Periodo" per riga |
| Titolo modale | dinamico: "esame"/"progetto" basato su entries correnti |
| Toggle appello ↔ periodo | preserva la data (start = data appello quando si attiva il checkbox) |
