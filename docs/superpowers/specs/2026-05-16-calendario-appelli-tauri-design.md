# Calendario Appelli & Studio — Tauri Desktop App

**Status:** Approved (design)
**Date:** 2026-05-16
**Source artifact:** `C:\Users\Gianmarco\Documents\Claude\Artifacts\calendario-appelli-studio\index.html`

## 1. Goal

Portare l'artifact HTML/JS "Calendario Appelli & Studio" a una desktop app Tauri 2.x
multipiattaforma, offline-first, con persistenza locale in SQLite.

Il porting è **fedele al dominio dell'artifact** (esami con appelli e giorni di studio,
progetti con periodi pluri-giorno, flag `passed` per nascondere voci completate, vista
mese unica). Non è un calendario eventi generico: niente RRULE, niente
title/description/location/all_day, niente vista settimana o giorno, niente drag-to-move,
niente categorie esplicite.

L'unica aggiunta funzionale rispetto all'artifact è una **ricerca per nome** nella
sidebar.

## 2. Stack

- **Frontend:** React 18 + TypeScript (strict) + Vite + **Tailwind CSS v4** (via
  plugin Vite ufficiale `@tailwindcss/vite`). Tailwind copre layout, spacing,
  tipografia, colori statici, transizioni e future animazioni. I background
  dinamici color-per-esame (gradient delle celle, project bar, study dot, appello
  pill) restano come `style={{ background: ... }}` inline sui componenti — inevitabile
  con qualsiasi framework CSS perché il colore proviene da dati runtime.
- **Backend:** Rust + `rusqlite` dietro comandi Tauri 2.x custom. **Non** si usa
  `tauri-plugin-sql`: si vuole tenere SQL fuori dal TS, avere validazione tipizzata
  e ritornare `Result<T, String>` con messaggi parlanti.
- **Migrations:** pragma `user_version` + file SQL versionati in
  `src-tauri/src/db/migrations/`. Niente librerie extra.
- **Package manager:** npm (pnpm non installato sulla macchina di sviluppo).
- **Lingua UI:** italiano (come l'artifact).

## 3. Domain model

L'artifact ha due tipi di voce, entrambe rappresentate nella stessa lista:

- **Esame** — ha N **appelli** (date d'esame singole) e N **giorni di studio** marcati
  cliccando sul calendario.
- **Progetto** — ha N **periodi** (range start-end di date) e nessun appello/giorno di
  studio.

Ogni voce ha: nome, colore (palette di 12), flag `passed`. Quando `passed=true` la voce
sparisce dal calendario ma resta in sidebar nella sezione "Completati".

Il colore di una voce **tinte le celle del calendario** nei giorni rilevanti
(opacity 0.30 se singola voce, gradient diagonale se più voci sullo stesso giorno).

## 4. SQLite schema (`001_init.sql`)

```sql
CREATE TABLE exams (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  color       TEXT    NOT NULL,                       -- "#RRGGBB"
  kind        TEXT    NOT NULL CHECK (kind IN ('esame','progetto')),
  passed      INTEGER NOT NULL DEFAULT 0 CHECK (passed IN (0,1)),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE appelli (
  id       INTEGER PRIMARY KEY,
  exam_id  INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  date     TEXT    NOT NULL,                          -- YYYY-MM-DD
  UNIQUE (exam_id, date)
);
CREATE INDEX idx_appelli_date ON appelli(date);

CREATE TABLE project_ranges (
  id          INTEGER PRIMARY KEY,
  exam_id     INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  start_date  TEXT    NOT NULL,
  end_date    TEXT    NOT NULL,
  CHECK (end_date >= start_date)
);
CREATE INDEX idx_ranges ON project_ranges(start_date, end_date);

CREATE TABLE study_days (
  exam_id  INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  date     TEXT    NOT NULL,
  PRIMARY KEY (exam_id, date)
);
CREATE INDEX idx_study_date ON study_days(date);

CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
```

Differenze chiave rispetto al modello in-memory dell'artifact:

- ID interi (autoincrement) invece dei `uid()` random — più puliti per le FK.
- `appelli`, `ranges`, `studyDays` normalizzati in tabelle separate (non JSON arrays).
- Constraint `CHECK` su `kind`, `passed`, e `end_date >= start_date`.
- `ON DELETE CASCADE` per pulire automaticamente le sotto-righe.

## 5. Tauri command surface

Tutti i comandi ritornano `Result<T, String>`. Validazione lato Rust prima della query.

| Comando | Input | Output |
|---|---|---|
| `list_exams` | — | `Vec<Exam>` con appelli/ranges/study_days nested |
| `create_exam` | `ExamInput` | `Exam` |
| `update_exam` | `id: i64, ExamInput` | `Exam` |
| `delete_exam` | `id: i64` | `()` |
| `set_exam_passed` | `id: i64, passed: bool` | `()` |
| `toggle_study_day` | `exam_id: i64, date: String` | `bool` (nuovo stato) |
| `search_exams` | `query: String` | `Vec<Exam>` (LIKE case-insensitive su `name`) |
| `import_artifact_json` | `payload: String` | `ImportReport { inserted, skipped, errors }` |
| `get_setting` | `key: String` | `Option<String>` |
| `set_setting` | `key: String, value: String` | `()` |

### `ExamInput`

```rust
struct ExamInput {
  name: String,           // trim, deve essere non vuoto dopo trim
  color: String,          // regex ^#[0-9A-Fa-f]{6}$
  kind: ExamKind,         // enum { Esame, Progetto }
  passed: bool,
  appelli: Vec<String>,   // date YYYY-MM-DD parsabili con NaiveDate
  ranges: Vec<DateRange>, // start <= end, date parsabili
}
```

### Regole di business

- `name.trim()` non vuoto, max 200 caratteri.
- `color` deve matchare `^#[0-9A-Fa-f]{6}$`.
- Tutte le date devono essere parsabili come `chrono::NaiveDate` (formato `YYYY-MM-DD`).
- Se `kind = Progetto`, `ranges.len() >= 1`. Se `kind = Esame`, `ranges` deve essere
  vuoto (qualsiasi range fornito viene rigettato — errore esplicito, non silenzioso).
- Se `kind = Progetto`, `appelli` deve essere vuoto (stesso trattamento).
- `study_days` non è mai accettato come input di `create_exam`/`update_exam`: si
  modificano solo via `toggle_study_day`. Una `update_exam` lascia i `study_days`
  esistenti intatti.

## 6. Import dall'artifact

Bottone "Importa da artifact" nella sidebar, sotto i bottoni `+ Esame` / `+ Progetto`.
Apre un modale con `<textarea>` dove l'utente incolla il JSON estratto dal localStorage
dell'artifact (chiave `appelliStudio_v1`).

Il comando `import_artifact_json` parsa il payload, valida ogni voce, e fa insert in
una transazione. Voci con stesso nome di un esame esistente vengono **saltate** (non
sovrascritte) e contate in `skipped`. Risultato mostrato in toast.

Formato accettato (compatibile con `loadState`/`migrate` dell'artifact):

```json
{
  "exams": [
    {
      "id": "xxx", "name": "...", "color": "#RRGGBB",
      "type": "esame" | "progetto",
      "passed": false,
      "appelli": [{"id":"...","date":"YYYY-MM-DD"}, ...],
      "ranges":  [{"id":"...","start":"YYYY-MM-DD","end":"YYYY-MM-DD"}, ...],
      "studyDays": ["YYYY-MM-DD", ...]
    },
    ...
  ]
}
```

Gli `id` dell'artifact vengono ignorati (riassegnati internamente).

L'import applica la stessa validazione di `create_exam` (§5). Voci che falliscono la
validazione (date malformate, colore non valido, esame con `ranges`, progetto con
`appelli`, progetto senza `ranges`, nome vuoto) vengono **saltate** e contate in
`skipped`. Lista degli errori inclusa nel `ImportReport` per mostrarli all'utente.

## 7. Frontend layout

```
src/
  main.tsx
  App.tsx                  # layout 2-colonne, monta provider e modali
  state.tsx                # ExamsContext + useExams(), refetch on mutation
  toast.tsx                # ToastContext + useToast()
  db.ts                    # thin client su invoke(): listExams, createExam, ...
  types.ts                 # Exam, Appello, DateRange, ExamKind, ImportReport
  date.ts                  # ymd, parseYmd, inRange, tint, buildMonthGrid
  index.css                # @import "tailwindcss"; + @theme {} con palette esami
                           #   + minimi @layer components (es. .cell-base hover ring)
  components/
    Sidebar.tsx            # ricerca + lista attivi + sezione "Completati"
    ExamRow.tsx
    Calendar.tsx           # header navigazione + grid 7×N
    DayCell.tsx            # background tinted, project bars, study dots, appelli pills
    DayModal.tsx           # toggle studio per esame, info appelli/progetti
    ExamModal.tsx          # crea/modifica esame o progetto
    ImportModal.tsx        # textarea + bottone "Importa"
    Toast.tsx              # banner top-right, auto-dismiss 4s
```

### Styling

- Tailwind v4 via `@tailwindcss/vite`. Configurazione CSS-first in `index.css` con
  blocco `@theme {}` per esporre la palette dei 12 colori esame come custom
  properties riutilizzabili.
- Layout/spacing/typography/border via classi Tailwind utility direttamente in
  JSX.
- Background dinamici (cella tinta, project bar, study dot, appello pill, swatch
  del modale) → `style={{ background: ... }}` inline, perché il colore è dato
  runtime e Tailwind non genera utilities per valori arbitrari runtime.
- Pattern ricorrenti che meritano nome semantico (es. cella calendario con stato
  today/empty/hover) → `@layer components` con `@apply` in `index.css`.

### Comportamento

Identico all'artifact, dettagli:

- **Settimana inizia di lunedì** (come l'artifact: `(getDay() + 6) % 7`).
- **Click su cella giorno** → `DayModal` con toggle "Sto studiando per…" per ogni esame
  attivo + info-box per appelli/progetti di quel giorno.
- **Modali**: chiudibili con `Escape`, click su backdrop, o `✕`.
- **Eliminazione**: nativo `confirm()`, come nell'artifact.
- **Mese label**: localizzato italiano (`MONTHS` array).
- **Cella "oggi"**: numero in pillola scura come l'artifact.
- **Ricerca**: input nella sidebar; filtra solo `activeExams` per `name` case-insensitive.
  La sezione "Completati" non è filtrata (raramente la si cerca; coerente con UX semplice).

## 8. Error handling

- Ogni `invoke()` in `db.ts` è wrappato in try/catch; in caso di errore chiama
  `toast.error(message)`. Il messaggio è la `String` ritornata dal comando Tauri.
- Errori critici (DB inaccessibile all'avvio) bloccano l'app con uno schermo full-page
  che mostra il messaggio e suggerisce di chiudere/riaprire.
- Validazione Rust ritorna messaggi user-facing in italiano (es.
  `"Il nome non può essere vuoto"`, `"end_date precede start_date"`).

## 9. Migrations

```rust
const MIGRATIONS: &[(&str, &str)] = &[
  ("001_init", include_str!("migrations/001_init.sql")),
];

fn migrate(conn: &mut Connection) -> Result<()> {
  let current: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
  for (i, (_name, sql)) in MIGRATIONS.iter().enumerate() {
    let version = (i + 1) as i64;
    if current < version {
      let tx = conn.transaction()?;
      tx.execute_batch(sql)?;
      tx.pragma_update(None, "user_version", version)?;
      tx.commit()?;
    }
  }
  Ok(())
}
```

`PRAGMA foreign_keys = ON` viene impostato all'apertura della connessione.

## 10. DB file location

Percorso: `app_data_dir() / "calendar.db"`.

Con bundle identifier `com.calendario-appelli.app`, su Windows finisce in
`%APPDATA%\com.calendario-appelli.app\calendar.db`.

La directory viene creata se non esiste prima di aprire la connessione.

## 11. Tests

**Rust unit test** in `src-tauri/src/db/exams.rs`:

- Usa `Connection::open_in_memory()`, esegue migrations, poi:
  1. Crea un esame con 2 appelli → verifica `list_exams` lo ritorna correttamente.
  2. Aggiorna nome/colore → rilegge → verifica modifiche persistite.
  3. Toggle study day → rilegge → verifica toggle on/off.
  4. Set `passed=true` → rilegge → verifica flag.
  5. Delete esame → verifica cascata (appelli e study_days spariti).
- Test di validazione separati: nome vuoto, colore malformato, data malformata,
  end < start, progetto senza ranges, esame con ranges.
- Smoke test di `import_artifact_json`: parsa un payload con due voci (una esame,
  un progetto) + una voce invalida; verifica `inserted=2`, `skipped=1`, e che le
  voci buone siano in DB.

Eseguibili con `cargo test --manifest-path src-tauri/Cargo.toml`.

Nessun test FE in questa fase.

## 12. Project tree

Lo scaffold Tauri viene applicato **direttamente sul working directory**
`C:\Users\Gianmarco\Desktop\Calendario-app` (niente sotto-cartella `calendar-desktop/`).
Il nome del progetto Tauri resta `calendar-desktop` solo per `package.json`,
`Cargo.toml`, e bundle identifier — il filesystem è piatto:

```
Calendario-app/                    # working dir = project root
├── package.json
├── tsconfig.json                  # strict: true, noImplicitAny, strictNullChecks
├── vite.config.ts
├── index.html
├── README.md
├── docs/
│   └── superpowers/
│       ├── specs/
│       │   └── 2026-05-16-calendario-appelli-tauri-design.md  # questo file
│       └── plans/
│           └── 2026-05-16-calendario-appelli-tauri-plan.md    # implementation plan
├── src/                           # vedi §7
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── build.rs
    ├── icons/
    └── src/
        ├── main.rs                # entrypoint (calls lib::run())
        ├── lib.rs                 # tauri::Builder, setup, register commands
        ├── commands.rs            # #[tauri::command] handlers, thin layer over db
        └── db/
            ├── mod.rs             # Connection, migrate, AppState
            ├── exams.rs           # CRUD + validation + unit tests
            ├── settings.rs        # get/set
            ├── import.rs          # import_artifact_json
            └── migrations/
                └── 001_init.sql
```

## 13. Build & run

```powershell
# dev (hot reload, apre la finestra Tauri)
npm install
npm run tauri dev

# build di rilascio (installer in src-tauri/target/release/bundle/)
npm run tauri build
```

A fine implementazione: avvio l'app, faccio screenshot del calendario vuoto e con un
esame di prova.

## 14. Out of scope (v1)

- RRULE / ricorrenze.
- Viste settimana e giorno.
- Drag-to-move di appelli/ranges sul calendario.
- Editing inline su cella (resta tramite modale, come l'artifact).
- Sync remoto, OAuth, backup cloud.
- Categorie multiple oltre `esame`/`progetto`.
- Notifiche di sistema (toast in-app sì, system tray no).
- i18n: l'app resta solo in italiano.
- Test del frontend (E2E / componenti).
- Auto-update.

## 15. Open items risolti

1. Scope: porta fedele del dominio esame/progetto/studio — **confermato**.
2. Stack DB: rusqlite + comandi custom — **confermato**.
3. Ricerca: filtro per nome nella sidebar — **confermato**.
4. Import dati esistenti: incluso, bottone "Importa da artifact" — **confermato**.
5. Bundle identifier: `com.calendario-appelli.app` — **confermato**.
