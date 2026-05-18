# To-Do — sezione DAG con ordinamento per pertinenza (Phase 1 / Core)

**Status:** Draft (design)
**Date:** 2026-05-18
**Branch:** `feat/tauri-port`
**Previous specs:**
- `2026-05-17-statistiche-design.md` (Strategy pattern, OCP/DIP setup)
- `2026-05-17-popup-restyle-design.md`
- `2026-05-16-progetto-subclass-design.md`

## 0. Phasing

"Full optional" decomposto in fasi indipendenti, ognuna con proprio spec/plan. **Questa spec è la Phase 1 (Core)**.

| Fase | Scope | Stato |
|---|---|---|
| **1 — Core (questa)** | CRUD task, link DAG, esame ≤1, priorità, due date, checklist embedded, done, vista timeline-per-pertinenza, ordering & enumeration come strategy pattern | **questa spec** |
| 2 — Coach agenda | Strategie di ordering avanzate (peso minuti studiati, deadline esame, streak) | future |
| 3 — Reminder | Integrazione con `notification_log` per task con `due_date` | future |
| 4 — Ricorrenze | Template task ripetuti (daily/weekly study) | future |
| 5 — Stats hook | Contributo task fatti nelle metriche di Statistiche | future |

Le interface di estensione (`OrderingStrategy`, `ChainEnumerator`) vengono dichiarate **ora** come open extension points, ma in Phase 1 esiste una sola implementazione di default per ciascuna.

## 1. Goal

Sostituire il placeholder `TodoView.tsx` con una sezione **To-do** completa che:
- Permette CRUD su task (titolo, descrizione, priorità, due date, ≤1 esame, checklist embedded, done).
- Permette di linkare task in relazione **"prima A POI B"** (predecessore → successore), formando un **DAG** per esame (o cross-esame quando ≥1 task è senza esame).
- Mostra le task come **sequenze di azioni**: enumera i path massimali del DAG, ripete i nodi condivisi in catene diverse, mantiene `done` allineato (singola istanza DB).
- Ordina le catene per **pertinenza** (default: priorità + prossimità due date della prima task non-done della catena). Nessun ordinamento per data calendariale.
- È costruita su strategy pattern coerente con `SuggestedStrategy` già nel codebase (OCP/DIP).

## 2. Concetti chiave

### 2.1 Task

Entità singola con identità stabile. Una task può comparire in più catene contemporaneamente — è sempre **la stessa istanza DB**. Marcarla `done` la mostra `done` ovunque.

### 2.2 Link (edge predecessore → successore)

Relazione orientata fra due task: `A → B` significa "fare A POI fare B".

**Vincoli sul link:**
- Aciclicità globale: il grafo deve restare un DAG (no cicli, anche indiretti).
- Esame-compatibilità: due task possono essere linkate se
  - entrambe hanno lo stesso `exam_id`, OPPURE
  - almeno una delle due ha `exam_id = NULL` (task "libera").

Una task **non può** linkarsi a se stessa (self-loop vietato).

### 2.3 Catena (chain)

Sequenza di task `[t1, t2, …, tn]` che corrisponde a un path orientato nel DAG. Una catena è "massimale" se `t1` non ha predecessori e `tn` non ha successori (path root→leaf).

### 2.4 Convergenza e divergenza

- **Divergenza**: una task ha più successori. Genera più catene che partono dallo stesso prefisso.
- **Convergenza**: una task ha più predecessori. Compare in più catene massimali che condividono il suffisso da quella task in poi.

In entrambi i casi: la task condivisa è **ripetuta visivamente** in ogni catena che la attraversa. La sua identità DB resta una sola — `done` è coerente in tutte le occorrenze.

### 2.5 Pertinenza (ordering)

Per Phase 1: il **primo task non-`done` di una catena** ne determina lo score (default).

```
score(chain) = priorityWeight[nextActionable.priority] * 1000
             + dueProximityScore(nextActionable.due_date)
             + recencyTiebreak
```

Catene interamente `done` → score `-Infinity` (in coda o nascoste a seconda del filtro).

## 3. Database — nuova migration `006_tasks.sql`

```sql
CREATE TABLE tasks (
  id          INTEGER PRIMARY KEY,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  exam_id     INTEGER NULL REFERENCES exams(id) ON DELETE SET NULL,
  priority    TEXT    NOT NULL DEFAULT 'normal'
              CHECK (priority IN ('low','normal','high','urgent')),
  due_date    TEXT    NULL,
  done        INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0,1)),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tasks_exam      ON tasks(exam_id);
CREATE INDEX idx_tasks_due       ON tasks(due_date);
CREATE INDEX idx_tasks_done_prio ON tasks(done, priority);

CREATE TABLE task_links (
  predecessor_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  successor_id   INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (predecessor_id, successor_id),
  CHECK (predecessor_id != successor_id)
);

CREATE INDEX idx_links_succ ON task_links(successor_id);

CREATE TABLE task_checklist (
  id        INTEGER PRIMARY KEY,
  task_id   INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label     TEXT    NOT NULL,
  done      INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0,1)),
  position  INTEGER NOT NULL
);

CREATE INDEX idx_checklist_task ON task_checklist(task_id, position);
```

**Note schema:**
- `exam_id ON DELETE SET NULL`: la task sopravvive alla cancellazione dell'esame (passa a "libera"). Conservativo — l'utente può aver investito lavoro sulla task.
- `task_links ON DELETE CASCADE`: cancellare una task spezza i link senza ricollegamento automatico (predecessori e successori di X non vengono riconnessi). Comportamento esplicito, no magic.
- Self-loop vietato a livello CHECK. Cicli multi-nodo invece NON sono prevenibili in SQL — vincolo applicato in Rust (vedi §5.2).
- Niente `UNIQUE` sui titoli: due task possono avere stesso titolo (caso d'uso: ripetere "leggi cap. successivo" per esami diversi).

## 4. TypeScript types — `src/task-types.ts` (nuovo file)

```typescript
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface ChecklistItem {
  id: number;
  label: string;
  done: boolean;
  position: number;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  examId: number | null;
  priority: TaskPriority;
  dueDate: string | null;        // YYYY-MM-DD
  done: boolean;
  checklist: ChecklistItem[];
  predecessorIds: number[];
  successorIds: number[];
}

export interface ChecklistItemInput {
  label: string;
  done: boolean;
  position: number;
}

export interface TaskInput {
  title: string;
  description: string;
  examId: number | null;
  priority: TaskPriority;
  dueDate: string | null;
  checklist: ChecklistItemInput[];
}

/** Path massimale (root→leaf) nel DAG. */
export interface Chain {
  /** ID del root (per memoization / key React stabile fra render). */
  rootId: number;
  /** Ordinata dalla prima task da fare alla penultima dell'ultima. */
  tasks: Task[];
  /** Path-key univoca: join degli id, es. "3>7>12". Permette stable keys per catene che condividono ID. */
  pathKey: string;
}
```

## 5. Backend Rust — nuovi moduli

### 5.1 Layout file

```
src-tauri/src/db/
├── tasks.rs              ← CRUD task + checklist (questo modulo)
├── task_links.rs         ← link CRUD + DAG validation
├── task_types.rs         ← struct + serde + validation (mirror di task-types.ts)
└── mod.rs                ← +2 pub mod, +1 migration
```

### 5.2 `task_links.rs` — DAG validation

Validazione aciclicità **prima** dell'INSERT di un nuovo link `A → B`:
- DFS forward da `B`. Se durante il DFS si raggiunge `A`, l'edge creerebbe ciclo → errore.
- Complessità: O(V+E) sul sotto-grafo raggiungibile da B. DAG attesi ≤50 task, irrilevante.

```rust
pub fn add_link(conn: &mut Connection, pred: i64, succ: i64) -> Result<(), String> {
    if pred == succ {
        return Err("Una task non può essere predecessore di se stessa".into());
    }
    // Esame compatibility
    let (pred_exam, succ_exam): (Option<i64>, Option<i64>) = conn.query_row(
        "SELECT (SELECT exam_id FROM tasks WHERE id = ?1),
                (SELECT exam_id FROM tasks WHERE id = ?2)",
        params![pred, succ], |r| Ok((r.get(0)?, r.get(1)?))
    ).map_err(|e| format!("lookup tasks: {e}"))?;
    if let (Some(pe), Some(se)) = (pred_exam, succ_exam) {
        if pe != se {
            return Err("Task di esami diversi non possono essere linkate (a meno che una sia libera)".into());
        }
    }
    // Cycle check
    if reachable(conn, succ, pred)? {
        return Err("Il link creerebbe un ciclo".into());
    }
    conn.execute(
        "INSERT OR IGNORE INTO task_links (predecessor_id, successor_id) VALUES (?1, ?2)",
        params![pred, succ],
    ).map_err(|e| format!("insert link: {e}"))?;
    Ok(())
}

fn reachable(conn: &Connection, from: i64, target: i64) -> Result<bool, String> {
    // DFS forward
    let mut stack = vec![from];
    let mut seen = std::collections::HashSet::new();
    while let Some(cur) = stack.pop() {
        if cur == target { return Ok(true); }
        if !seen.insert(cur) { continue; }
        let succs: Vec<i64> = conn.prepare(
            "SELECT successor_id FROM task_links WHERE predecessor_id = ?1"
        ).map_err(|e| format!("prepare reach: {e}"))?
        .query_map(params![cur], |r| r.get(0))
        .map_err(|e| format!("query reach: {e}"))?
        .collect::<Result<_,_>>().map_err(|e| format!("row reach: {e}"))?;
        stack.extend(succs);
    }
    Ok(false)
}
```

### 5.3 Tauri commands (in `src-tauri/src/commands.rs`, registrati in `src-tauri/src/lib.rs`)

```
list_tasks() -> Vec<Task>
get_task(id) -> Task
create_task(input: TaskInput) -> Task
update_task(id, input: TaskInput) -> Task
delete_task(id)
set_task_done(id, done: bool)
add_task_link(pred_id, succ_id)
remove_task_link(pred_id, succ_id)
set_checklist_item_done(item_id, done: bool)
```

Tutti restituiscono `Result<_, String>` come gli esistenti. Pattern wire identico a `exams.rs` (snake_case via serde rename_all). Tutti i comandi vanno aggiunti all'array `invoke_handler` in `lib.rs:60-80`.

### 5.4 Frontend `src/db.ts` — nuove funzioni

Aggiungere wrapper TypeScript identici al pattern esistente (`fromTaskWire`, etc.).

## 6. Frontend — moduli puri (SRP split)

### 6.1 File layout

```
src/
├── task-types.ts             ← types (§4)
├── task-domain.ts            ← aggregazioni pure su Task[]
├── chain-enumerator.ts       ← interface + maximalPathEnumerator + Provider
├── ordering-strategy.ts      ← interface + nextActionableStrategy + Provider
├── dag-validator.ts          ← cycle check pure (preview client prima della call)
├── link-validator.ts         ← compatibilità esame (pure)
└── components/todo/
    ├── TodoView.tsx          ← layout host
    ├── ChainRow.tsx          ← una catena come riga
    ├── TaskCard.tsx          ← singola card
    ├── TaskModal.tsx         ← create/edit + checklist + link picker
    ├── TaskFilters.tsx       ← toolbar (esame, priorità, hide-done)
    ├── LinkPicker.tsx        ← UI per aggiungere/rimuovere link (predecessori/successori)
    └── todo.css
```

### 6.2 `src/task-domain.ts`

Pure functions su `Task[]` + supporto identità.

```typescript
import type { Task } from "./task-types";

export const PRIORITY_WEIGHT: Record<Task["priority"], number> = {
  low: 0, normal: 1, high: 2, urgent: 3,
};

export function isActionable(t: Task): boolean { return !t.done; }

export function buildIndex(tasks: Task[]): Map<number, Task> {
  const m = new Map<number, Task>();
  for (const t of tasks) m.set(t.id, t);
  return m;
}

/** Task senza predecessori → root del DAG. */
export function roots(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.predecessorIds.length === 0);
}

/** Prima task non-done lungo `chainTasks`, o null se tutta done. */
export function nextActionable(chainTasks: Task[]): Task | null {
  return chainTasks.find(isActionable) ?? null;
}

/** Days fra oggi e dueDate. Negativo = scaduto. Null se no dueDate. */
export function daysUntilDue(t: Task, today: string): number | null {
  if (!t.dueDate) return null;
  const a = new Date(today).getTime();
  const b = new Date(t.dueDate).getTime();
  return Math.round((b - a) / 86_400_000);
}
```

### 6.3 `src/chain-enumerator.ts`

```typescript
import { createContext, useContext } from "react";
import type { Task, Chain } from "./task-types";
import { buildIndex, roots } from "./task-domain";

export interface ChainEnumerator {
  readonly label: string;
  enumerate(tasks: Task[]): Chain[];
}

/** Default: DFS forward da ogni root, emette ogni maximal path. Cap a `maxChains`. */
export function maximalPathEnumerator(opts: { maxChains?: number } = {}): ChainEnumerator {
  const cap = opts.maxChains ?? 200;
  return {
    label: "maximal-paths",
    enumerate(tasks) {
      const index = buildIndex(tasks);
      const out: Chain[] = [];
      const dfs = (path: Task[]) => {
        if (out.length >= cap) return;
        const tail = path[path.length - 1];
        if (tail.successorIds.length === 0) {
          out.push({
            rootId: path[0].id,
            tasks: path,
            pathKey: path.map((t) => t.id).join(">"),
          });
          return;
        }
        for (const sid of tail.successorIds) {
          const next = index.get(sid);
          if (!next) continue;             // edge orfana — tolleriamo
          if (path.some((p) => p.id === next.id)) continue; // safety: skip cycle
          dfs([...path, next]);
        }
      };
      for (const r of roots(tasks)) dfs([r]);
      return out;
    },
  };
}

export const ChainEnumeratorContext = createContext<ChainEnumerator>(maximalPathEnumerator());
export const useChainEnumerator = (): ChainEnumerator => useContext(ChainEnumeratorContext);
```

Contratto LSP:
- Output non-null.
- Ogni `Chain.tasks` non vuoto.
- Ogni `Chain` rappresenta un **simple path** (no ripetizione di ID dentro la singola catena — la ripetizione cross-catene è invece il comportamento desiderato).

### 6.4 `src/ordering-strategy.ts`

```typescript
import { createContext, useContext } from "react";
import type { Task, Chain } from "./task-types";
import { nextActionable, daysUntilDue, PRIORITY_WEIGHT } from "./task-domain";

export interface OrderingStrategy {
  readonly label: string;
  scoreChain(chain: Chain, today: string): number;
}

/** Default: prima task non-done determina lo score. */
export const nextActionableStrategy: OrderingStrategy = {
  label: "next-actionable",
  scoreChain(chain, today) {
    const a = nextActionable(chain.tasks);
    if (!a) return Number.NEGATIVE_INFINITY;        // catena tutta done
    const prio = PRIORITY_WEIGHT[a.priority] * 1000;
    const d = daysUntilDue(a, today);
    const due = d == null ? 0 : Math.max(0, 30 - d) * 10; // più vicina → più alta
    return prio + due;
  },
};

export function sortChains(chains: Chain[], strategy: OrderingStrategy, today: string): Chain[] {
  return [...chains].sort((a, b) => strategy.scoreChain(b, today) - strategy.scoreChain(a, today));
}

export const OrderingStrategyContext = createContext<OrderingStrategy>(nextActionableStrategy);
export const useOrderingStrategy = (): OrderingStrategy => useContext(OrderingStrategyContext);
```

Contratto LSP:
- `scoreChain → number` finito o `NEGATIVE_INFINITY` esplicito per catene done-only.
- Higher = più pertinente, in cima all'elenco.
- Deterministico (stesso input → stesso output).

### 6.5 `src/dag-validator.ts` (client-side preview)

```typescript
import type { Task } from "./task-types";
import { buildIndex } from "./task-domain";

/** True se aggiungere edge pred→succ creerebbe ciclo. */
export function wouldCreateCycle(tasks: Task[], pred: number, succ: number): boolean {
  if (pred === succ) return true;
  const idx = buildIndex(tasks);
  const stack = [succ];
  const seen = new Set<number>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === pred) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const t = idx.get(cur);
    if (!t) continue;
    for (const s of t.successorIds) stack.push(s);
  }
  return false;
}
```

Usato dal `LinkPicker` per disabilitare opzioni che farebbero ciclo. Backend Rust resta l'arbiter finale (preview client = solo UX).

### 6.6 `src/link-validator.ts`

```typescript
import type { Task } from "./task-types";

export function isLinkExamCompatible(a: Task, b: Task): boolean {
  if (a.examId == null || b.examId == null) return true;
  return a.examId === b.examId;
}
```

## 7. State management — `src/tasks-state.tsx` (nuovo file)

Pattern simmetrico a `state.tsx` (ExamsContext).

```typescript
interface TasksContextValue {
  tasks: Task[];
  loading: boolean;
  refetch: () => Promise<void>;
  create: (input: TaskInput) => Promise<Task | null>;
  update: (id: number, input: TaskInput) => Promise<Task | null>;
  remove: (id: number) => Promise<boolean>;
  setDone: (id: number, done: boolean) => Promise<boolean>;
  addLink: (predId: number, succId: number) => Promise<boolean>;
  removeLink: (predId: number, succId: number) => Promise<boolean>;
  setChecklistItemDone: (itemId: number, done: boolean) => Promise<boolean>;
}
```

`App.tsx` wrappa `<TasksProvider>` dentro `<ExamsProvider>` (i task possono leggere esami via `useExams`).

## 8. UI — `TodoView` e figli

### 8.1 `components/todo/TodoView.tsx`

```tsx
export function TodoView() {
  const { tasks } = useTasks();
  const { exams } = useExams();
  const enumerator = useChainEnumerator();
  const strategy = useOrderingStrategy();
  const today = ymd(new Date());

  const [filters, setFilters] = useState<TaskFiltersState>({ hideDone: false, examId: null, minPriority: null });
  const [editing, setEditing] = useState<{ mode: "create" } | { mode: "edit"; id: number } | null>(null);

  const filtered = useMemo(() => applyFilters(tasks, filters), [tasks, filters]);
  const chains = useMemo(() => enumerator.enumerate(filtered), [enumerator, filtered]);
  const sorted = useMemo(() => sortChains(chains, strategy, today), [chains, strategy, today]);

  return (
    <div className="todo-view view-enter">
      <TaskFilters value={filters} onChange={setFilters} exams={exams} />
      {sorted.length === 0
        ? <EmptyState />
        : <div className="chain-list">
            {sorted.map((c) => (
              <ChainRow key={c.pathKey} chain={c} onEdit={(id) => setEditing({ mode: "edit", id })} />
            ))}
          </div>}
      <FloatingNewButton onClick={() => setEditing({ mode: "create" })} />
      <TaskModal state={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
```

Lo stato del modal vive in `TodoView` (non in `App.tsx`) per evitare prop drilling: `TaskModal` ha bisogno solo di `tasks-state.tsx` e `exams-state.tsx` via hook. `App.tsx` non sa nulla del modal task — diversamente da `ExamModal` che è gestito a livello `Shell` perché aperto sia da `Sidebar` che dall'`ExamRow` di altre view.

### 8.2 `components/todo/ChainRow.tsx`

Una catena = riga orizzontale di `TaskCard`, scrollabile se overflowa, con frecce `→` tra una card e la successiva. Mantiene lo stile mono+nero.

```tsx
export function ChainRow({ chain }: { chain: Chain }) {
  return (
    <div className="chain-row">
      {chain.tasks.map((t, i) => (
        <Fragment key={`${chain.pathKey}@${i}`}>
          <TaskCard task={t} chainPathKey={chain.pathKey} />
          {i < chain.tasks.length - 1 && <span className="chain-arrow" aria-hidden>→</span>}
        </Fragment>
      ))}
    </div>
  );
}
```

Stessa task in catene diverse usa `key={chainPathKey@position}` — React deve poter distinguere le istanze rendering. L'identità DB resta `task.id`.

### 8.3 `components/todo/TaskCard.tsx`

```
┌────────────────────────────────────┐
│ ▣  Scrivere capitolo 2             │  ← checkbox done, title
│ ── Tesi Fisiologia · ▢ 2/5 · 14m   │  ← exam color stripe, checklist, due
└────────────────────────────────────┘
```

Click sulla card → apre `TaskModal` in edit. Click sulla checkbox → toggle `done`.

Stato visivo:
- `done` → opacity 0.45, line-through sul titolo.
- `nextActionable` della catena → border accent (`var(--brand-edge)`).
- Priorità `urgent` → pill rossa-tenue (`var(--danger-soft)`).
- Priorità `high` → pill warn (`var(--warn-soft)`).
- `normal`/`low` → nessuna pill.

### 8.4 `components/todo/TaskModal.tsx`

Riusa `Modal` esistente. Sezioni:
1. Titolo (input)
2. Descrizione (textarea, opzionale)
3. Esame (select fra `exams`, opzione "Nessuno")
4. Priorità (pill segmentate: low/normal/high/urgent)
5. Due date (input date, opzionale)
6. Checklist (lista riordinabile di item label + done + add/remove)
7. **Link**: `LinkPicker` per predecessori e successori
8. Footer: Salva / Elimina (in edit)

### 8.5 `components/todo/LinkPicker.tsx`

Per ciascuna direzione (predecessori / successori):
- Lista esistente con bottone `×` per unlink.
- Combobox per aggiungere: lista filtrata di task disponibili (escluse self, già linkate, incompatibili per esame, ciclo-creanti — calcolo client via `dag-validator` + `link-validator`).

### 8.6 `components/todo/TaskFilters.tsx`

Pill segmentate stile `SectionSwitcher`:
- `[ Tutti / Solo non fatti ]`
- Select esame (Tutti / esame X / esame Y / Liberi)
- `[ Tutte le priorità / Da normal in su / Solo high+urgent ]`

### 8.7 Empty state

Stesso pattern dell'attuale `TodoView` placeholder:
```
[icona ListTodo]
Nessuna task per ora
"+ Nuovo task" per iniziare
```

## 9. Sidebar e routing

`Sidebar` già instrada su `section === "todo"`. Nessuna modifica al routing. `TodoView` non riceve props nuove.

## 10. CSS — `src/components/todo/todo.css`

Token riusati (`--panel`, `--card`, `--border-strong`, `--brand-edge`, etc.). Nuovi solo selettori `.todo-view`, `.chain-row`, `.chain-arrow`, `.task-card`, `.prio-pill`, `.link-picker`. Tema dark coerente con il resto (Nexo Note, mono+nero).

`.chain-row`:
- `display: flex; align-items: stretch; overflow-x: auto`
- `padding: 10px 12px` background `var(--panel)` border `var(--border)` `border-radius: var(--radius-lg)`
- Stack verticale: `.chain-list` `display: flex; flex-direction: column; gap: 10px`

`.task-card`:
- min-width 220px max-width 280px
- `var(--card)` border `var(--border-strong)` radius `var(--radius-md)`
- transitions: `transform var(--motion-fast)`, hover `transform: translateY(-1px)`

`.chain-arrow`:
- font-family mono, color `var(--muted)`, padding `0 8px`, align-self center

## 11. Modulo `App.tsx` — modifiche

Aggiungere `<TasksProvider>` dentro `<ExamsProvider>`. `TodoView` non riceve props.

```tsx
<ToastProvider>
  <ExamsProvider>
    <TasksProvider>
      <Shell />
    </TasksProvider>
  </ExamsProvider>
</ToastProvider>
```

## 12. Cosa NON cambia

- Schema `exams`, `appelli`, `study_days`, `project_ranges` invariato.
- `Calendar`, `DayModal`, `StatsView`, `Settings`, `Import` invariati.
- `SuggestedStrategy` e tutta la sezione Statistiche invariate.
- Pattern wire snake_case → camelCase invariato.
- Aurora-glass / Nexo theme invariati.

## 13. Out of scope (Phase 1)

- **Smart agenda avanzato** (peso minuti studiati, deadline esame): è Phase 2. Resta dietro `OrderingStrategy`.
- **Reminder push** sulle due date: è Phase 3.
- **Ricorrenze** (task settimanali / giornaliere): è Phase 4.
- **Contributo task alle metriche Statistiche**: è Phase 5.
- **Drag-and-drop riordinamento** delle task dentro la catena (in alternativa al LinkPicker).
- **Visualizzazione grafo DAG** con nodi/archi disegnati (oltre alle catene linearizzate).
- **Bulk operations** (multi-select done/delete).
- **Search testuale** sulle task.
- **Tag / etichette arbitrarie**.
- **Soft delete / archive**.
- **Undo/redo**.
- **Sub-task come task figli** (gerarchia separata). Per ora resta la checklist embedded.

## 14. Open items / decisioni da confermare in plan

| Item | Default proposto |
|---|---|
| Cancellazione di una task in mezzo a una catena: ricollega pred↔succ? | **No** — i link sono espliciti dell'utente; cancellando una task si spezza la catena (l'utente decide se ricollegare). |
| Edit di `exam_id` di una task che ha già link: cosa succede ai link che violerebbero `isLinkExamCompatible`? | Backend rifiuta l'update con errore esplicito; UI mostra messaggio "Rimuovi prima i link incompatibili". |
| Catena con cap raggiunto (200): mostrare warning UI? | Sì — banner `"Troppe catene possibili. Mostrate prime 200."` Plan implementativo: copy + componente. |
| Persistenza preferenza filtri fra reload? | Out of scope Phase 1 (in-memory). |
| Floating new button vs bottone in toolbar? | Floating bottom-right (FAB-style minimalista). |

## 15. File touched (riepilogo)

**Nuovi backend:**
- `src-tauri/src/db/migrations/006_tasks.sql`
- `src-tauri/src/db/task_types.rs`
- `src-tauri/src/db/tasks.rs`
- `src-tauri/src/db/task_links.rs`

**Modificati backend:**
- `src-tauri/src/db/mod.rs` (+2 `pub mod`, +1 migration)
- `src-tauri/src/main.rs` (registrazione comandi Tauri)

**Nuovi frontend:**
- `src/task-types.ts`
- `src/task-domain.ts`
- `src/chain-enumerator.ts`
- `src/ordering-strategy.ts`
- `src/dag-validator.ts`
- `src/link-validator.ts`
- `src/tasks-state.tsx`
- `src/components/todo/TodoView.tsx` (riscrittura — oggi è placeholder)
- `src/components/todo/ChainRow.tsx`
- `src/components/todo/TaskCard.tsx`
- `src/components/todo/TaskModal.tsx`
- `src/components/todo/TaskFilters.tsx`
- `src/components/todo/LinkPicker.tsx`
- `src/components/todo/todo.css`

**Modificati frontend:**
- `src/db.ts` (wrapper per i nuovi comandi)
- `src/App.tsx` (`<TasksProvider>` wrapper)

---

## Appendice A — SOLID self-check (rigoroso)

Audit puntuale dell'architettura proposta. Per ogni principio: cosa è soddisfatto, dove sono i bordi sottili, e quali rischi residui restano accettati.

### A.1 Single Responsibility

| Modulo | Responsabilità unica | Cambia quando… |
|---|---|---|
| `task-types.ts` | Definizioni di tipi (Task, Chain, input) | cambia la forma dei dati |
| `task-domain.ts` | Aggregazioni e helper puri (root, nextActionable, daysUntilDue, isActionable) | cambiano le regole di aggregazione del dominio |
| `chain-enumerator.ts` | Trasformazione DAG → list di Chain | cambia l'algoritmo di enumerazione |
| `ordering-strategy.ts` | Score di pertinenza di una Chain | cambiano i criteri di "cosa fare prima" |
| `dag-validator.ts` | Check di aciclicità client-side | cambiano le regole di validazione strutturale |
| `link-validator.ts` | Check di compatibilità esame | cambiano le regole di compatibilità semantica |
| `tasks-state.tsx` | Bridge React state ↔ backend | cambia il pattern di sync state |
| `tasks.rs` | CRUD persistenza task + checklist | cambia lo schema o le operazioni di base |
| `task_links.rs` | CRUD edge + DAG validation server-side | cambia la rappresentazione/validazione del grafo |

**SRP a rischio**: `task-domain.ts` raccoglie helpers eterogenei (`isActionable`, `roots`, `nextActionable`, `daysUntilDue`, `PRIORITY_WEIGHT`). È accettato perché: tutti operano su `Task[]`/`Task`, tutti sono pure functions, e tutti cambierebbero contestualmente se cambia la forma di `Task`. Soglia di split: se il file supera ~150 LOC o serve aggiungere helper che dipendono solo da una sotto-feature, splittare in `task-time.ts` (date helpers) e `task-graph.ts` (root/next).

**SRP esplicitamente non rispettato e perché**: `task_links.rs` contiene SIA la persistenza dei link SIA la validazione DAG (`reachable`/`add_link`). Sono accoppiati a livello di transazione (per evitare TOCTOU) — splittare creerebbe interfacce inutilmente complicate sul tipo `Connection`. Accettato.

### A.2 Open / Closed

**Aggiunta di una nuova `OrderingStrategy`** ("voglio pesare per minuti studiati"):
1. Nuovo file `src/strategies/study-weighted-ordering.ts` che implementa `OrderingStrategy`.
2. Provider nel root: `<OrderingStrategyContext.Provider value={studyWeightedStrategy}>`.
3. **Zero modifiche** a: `chain-enumerator.ts`, `TodoView`, `ChainRow`, `TaskCard`, `task-domain.ts`.

**Aggiunta di un nuovo `ChainEnumerator`** ("voglio collassare il prefisso done"):
1. Nuovo `collapseDoneEnumerator` che implementa `ChainEnumerator`.
2. Provider swap.
3. **Zero modifiche** a UI o a `ordering-strategy.ts`.

**Aggiunta di un nuovo campo task** (es. `tag: string[]`):
- Richiede migration + estensione di `Task` type + form. Non è "extension" — è modifica strutturale. OCP non si applica a dati. Accettato.

**Aggiunta di un nuovo stato task** (es. "in pausa"): richiederebbe modifica di `done: boolean` → `status: enum`. Anche qui modifica strutturale del modello, non un'estensione comportamentale. Out of scope Phase 1.

### A.3 Liskov Substitution

Contratti formali pubblicati nel file di interface:

`OrderingStrategy.scoreChain(chain, today): number`
- Deve restituire `number` finito **oppure** `Number.NEGATIVE_INFINITY` per catene done-only (per consentire l'ordinamento stabile in coda).
- Deve essere **deterministico**: `(chain, today)` identici → score identico.
- Higher = "più pertinente" semantica universale per tutte le impl.
- **Non deve** lanciare. Implementazioni che falliscono devono restituire un fallback.

`ChainEnumerator.enumerate(tasks): Chain[]`
- Output non-null, lunghezza ≥ 0.
- Ogni `Chain.tasks` non vuoto.
- Ogni `Chain` è un **simple path** (no ID ripetuti dentro la singola catena).
- IDs di ogni task in `Chain.tasks` devono esistere in `tasks` passato in input (no IDs orfani).
- `pathKey` univoca per la posizione della catena (basta join degli ID).

**Rischio LSP residuo**: un enumerator pigro che assume non-vuotezza di `tasks.successorIds` per ogni nodo non-leaf può crashare se la lista è inconsistente. Mitigazione: ogni enumerator dichiarato come pure e total — deve tollerare edge orfani (vedi default che fa `if (!next) continue`).

### A.4 Interface Segregation

- `OrderingStrategy`: 2 membri (`label`, `scoreChain`). Nessun metodo opzionale.
- `ChainEnumerator`: 2 membri (`label`, `enumerate`). Nessun opzionale.
- `TasksContextValue` (state): ~9 membri. **Borderline ISP** — un componente che usa solo `tasks` deve "vedere" anche `addLink`. Mitigazione: stessa convenzione del `ExamsContext` esistente. Splittare in più context (read-only vs write-actions) sarebbe puristico ma rompe simmetria col codebase. Accettato.
- Funzioni pure: ricevono solo i parametri che usano (`isActionable(task)`, `nextActionable(tasks)`, `daysUntilDue(task, today)`). No "god functions".

### A.5 Dependency Inversion

| Componente | Dipende da | Iniettato via |
|---|---|---|
| `TodoView` | `ChainEnumerator`, `OrderingStrategy`, `TasksContextValue` | hooks (`useChainEnumerator`, `useOrderingStrategy`, `useTasks`) |
| `LinkPicker` | `wouldCreateCycle` (pure), `isLinkExamCompatible` (pure), `useTasks` | import puro + hook |
| `TaskModal` | `useTasks`, `useExams` | hook |
| `chain-enumerator.ts` default impl | `task-domain.ts` (roots, buildIndex) | import puro (pure → pure) |
| `ordering-strategy.ts` default impl | `task-domain.ts` (nextActionable, daysUntilDue, PRIORITY_WEIGHT) | import puro (pure → pure) |
| Backend `task_links.rs` | `tasks` table | SQL diretto (DIP non si applica al layer SQL stesso) |

**Tutti i moduli React di alto livello dipendono da astrazioni** (hooks su Context, interfacce, pure functions iniettabili). Le concrete impl di strategy/enumerator vivono in moduli separati e sono swappabili via Provider.

### A.6 Rischi residui accettati

1. **Esplosione combinatoria delle catene**: DAG con grosse divergenze + convergenze genera path massimali esponenziali. Mitigato da cap 200 + warning, ma resta una limitazione architettonica della scelta "ripeti il nodo condiviso in ogni catena". L'utente l'ha richiesta esplicitamente.
2. **Inconsistenza DAG in finestra di race**: il client preview (`dag-validator.ts`) può divergere dal backend se due tab aprono la stessa app e creano link in parallelo. Tauri è single-window per default — accettato.
3. **`task_links` CASCADE su delete task**: i predecessori non vengono ricollegati ai successori. Confermato come comportamento desiderato (no magic).
4. **Score determinismo**: `nextActionableStrategy` usa `today` come parametro — passa attraverso `useTasks`/`TodoView`. Se `today` cambia (mezzanotte), l'ordinamento si aggiorna al prossimo re-render. Accettato.

### A.7 Estensione futura tipica (Phase 2 — Coach AI)

"Voglio una strategia che pesa per minuti studiati e prossimità appello esame":

1. Creare `src/strategies/coach-ordering.ts`:
   ```typescript
   export function coachStrategy(exams: Exam[]): OrderingStrategy { ... }
   ```
2. In `App.tsx`: leggere setting / context per scegliere strategia, wrappare in Provider.
3. **Zero modifiche** a: `chain-enumerator.ts`, `ordering-strategy.ts` (default), `TodoView`, `ChainRow`, `TaskCard`, `task-domain.ts`, `tasks-state.tsx`.

L'estensione tocca **solo** il file nuovo + il Provider nel root. È il test pratico che OCP/DIP sono soddisfatti.
