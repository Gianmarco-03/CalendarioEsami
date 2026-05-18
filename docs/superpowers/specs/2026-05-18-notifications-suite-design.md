# Suite di notifiche per Calendario Appelli e Studio

**Data:** 2026-05-18
**Stato:** Approvato, pronto per writing-plans
**Branch suggerito:** `feat/notifications-suite`

## 1. Obiettivo

Aggiungere notifiche desktop native (Windows toast) per ricordare all'utente:
- appelli e deadline di progetto in arrivo,
- di studiare se non l'ha già fatto,
- traguardi di continuità (streak).

Includere inoltre meccanismi rapidi per registrare il tempo di studio **senza dover aprire la finestra principale**:
- azioni cliccabili dentro alcune notifiche,
- popup richiamabile via hotkey globale,
- menu nella system tray.

L'app è ad uso personale del singolo sviluppatore (Windows), quindi installazione via MSI e autostart sono accettabili.

## 2. Suite di notifiche (7 tipi)

| # | Tipo | Trigger | Default ON? |
|---|------|---------|-------------|
| 1 | **Esame imminente** | per ogni appello: T-7gg, T-3gg, T-1gg (08:00), e mattina dell'appello (07:30) | ✅ |
| 2 | **Progetto: inizio range** | mattina (08:00) del primo giorno di ogni `ProjectRange` | ✅ |
| 3 | **Progetto: deadline** | T-3gg, T-1gg, e giorno della consegna (mattina) — l'ultimo giorno del `ProjectRange` finale | ✅ |
| 4 | **Promemoria studio** | ogni giorno, eventualemente più volte al giorno. Configurabile (default **1** notifica alle **18:00**) se nessun esame attivo ha minuti registrati per oggi | ✅ |
| 5 | **Mancato studio** | sera (default **22:00**), giorni feriali, se totale minuti del giorno = 0 e ci sono esami attivi | ✅ |
| 6 | **Milestone streak** | al raggiungimento di 7 / 14 / 30 / 60 / 100 giorni consecutivi con ≥1 esame studiato | ✅ |
| 7 | **Log rapido programmato** | orari configurabili (default lista vuota — l'utente li aggiunge); notifica con azioni `+15 / +30 / +60 / Snooze` | ✅ |

Note:
- Le notifiche 1, 2, 3 si calcolano per ciascun esame/progetto attivo (`passed = false`).
- "Esame attivo" = `passed = false`.
- Lo streak si calcola sui giorni con `SUM(study_days.minutes) > 0` su tutti gli esami attivi.


## 3. Architettura

### 3.1 Layout Rust (`src-tauri/src/`)

```
notify/
  mod.rs           — NotificationService pubblico, spawn del loop al setup()
  scheduler.rs     — tokio task: tick ogni 60s → query DB → rules → dedup → send
  rules.rs         — funzioni pure: dato (oggi, prefs, exam) → Vec<NotifEvent>
  dedup.rs         — read/write su notification_log per evitare doppi invii
  types.rs         — NotifKind, NotifEvent, NotifPrefs, NotifAction
  actions.rs       — handler per le azioni cliccabili (+15min, snooze, ecc.)
quicklog/
  mod.rs           — gestione finestra popup secondaria + global hotkey
  tray.rs          — system tray con submenu esami attivi
```

### 3.2 Plugin Tauri

Aggiungere a `Cargo.toml`:
- `tauri-plugin-notification = "2"`
- `tauri-plugin-global-shortcut = "2"`
- `tauri-plugin-autostart = "2"`

La tray icon è supportata nativamente dal core Tauri 2 (`tauri::tray`).

### 3.3 Capabilities (`src-tauri/capabilities/default.json`)

Aggiungere ai permissions:
- `notification:default`
- `notification:allow-notify`
- `notification:allow-request-permission`
- `notification:allow-is-permission-granted`
- `global-shortcut:default`
- `autostart:default`

## 4. Database

### 4.1 Migration `005_notifications.sql`

```sql
-- Log delle notifiche inviate (per dedup)
CREATE TABLE IF NOT EXISTS notification_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT    NOT NULL,         -- es. "exam_imminent", "study_reminder"
  key         TEXT    NOT NULL,         -- es. "exam_imminent:42:T-3" oppure "study_reminder:2026-05-18"
  sent_at     TEXT    NOT NULL,         -- ISO 8601
  UNIQUE(kind, key)
);

CREATE INDEX IF NOT EXISTS idx_notification_log_sent
  ON notification_log(sent_at DESC);

-- Preferenze notifiche (override dei default)
CREATE TABLE IF NOT EXISTS notification_prefs (
  kind        TEXT    PRIMARY KEY,      -- corrisponde a NotifKind
  enabled     INTEGER NOT NULL DEFAULT 1,
  config_json TEXT    NOT NULL DEFAULT '{}'  -- es. {"time":"18:00"} per study_reminder
);
```

### 4.2 Chiavi di dedup per tipo

| Tipo | Schema chiave |
|---|---|
| `exam_imminent` | `exam_imminent:{exam_id}:{appello_id}:{offset}` (offset ∈ `T-7,T-3,T-1,T-0`) |
| `project_start` | `project_start:{exam_id}:{range_id}` |
| `project_deadline` | `project_deadline:{exam_id}:{range_id}:{offset}` |
| `study_reminder` | `study_reminder:{YYYY-MM-DD}` |
| `study_missed` | `study_missed:{YYYY-MM-DD}` |
| `streak_milestone` | `streak_milestone:{N}` (N ∈ 7,14,30,60,100) |
| `quick_log_prompt` | `quick_log_prompt:{YYYY-MM-DD}:{HH:MM}` |

L'unique constraint su `(kind, key)` rende `INSERT OR IGNORE` la primitiva di dedup.

## 5. Scheduler

Loop in `notify/scheduler.rs`:

```text
ogni 60 secondi:
  1. carica NotifPrefs da DB
  2. carica tutti gli esami attivi
  3. chiama rules::compute_due(now, prefs, exams) -> Vec<NotifEvent>
  4. per ogni evento:
     a. tenta INSERT OR IGNORE su notification_log
     b. se inserito (cioè non già inviato), chiama notification_service.send(event)
```

Il tick è abbastanza fitto da:
- non perdere notifiche al minuto preciso (es. 18:00),
- essere abbastanza largo da non saturare CPU (~0% di idle).

All'avvio dell'app il loop esegue **subito** un primo tick, così le notifiche perse mentre l'app era chiusa (es. 18:00 reminder, oggi, e adesso sono le 19:30) vengono recuperate — purché ancora rilevanti per il giorno corrente (la chiave include la data).

### 5.1 Logica `rules.rs` (pura, testabile)

Per ogni tipo, una funzione che dato `(now: DateTime, prefs, exams_snapshot)` ritorna i `NotifEvent` dovuti.

Esempio firma:
```rust
pub fn compute_due(
    now: DateTime<Local>,
    prefs: &NotifPrefs,
    exams: &[Exam],
) -> Vec<NotifEvent>;
```

Vincolo: **nessun accesso a DB o a Tauri** dentro `rules.rs`. Test unitari con `cargo test` senza tokio/SQLite.

## 6. Quick log

### 6.1 Global hotkey (`Ctrl+Alt+S`)

- Registrata via `tauri-plugin-global-shortcut` allo startup.
- Hotkey è configurabile in `notification_prefs` con kind `quick_log_hotkey`.
- Pressione → mostra/foca la finestra `quicklog` (vedi sotto).

### 6.2 Finestra `quicklog`

Finestra Tauri secondaria definita in `tauri.conf.json`:
- `label`: `"quicklog"`
- `width`: 380, `height`: 240
- `decorations`: false, `resizable`: false, `transparent`: true, `alwaysOnTop`: true, `skipTaskbar`: true
- `visible`: false (si mostra solo via hotkey o tray)
- `center`: true

UI (`src/quicklog.tsx` + `quicklog.html`):
- Dropdown "Esame" pre-popolato con esami attivi, default = ultimo usato.
- Bottoni rapidi: `+15` `+30` `+60` `+90`.
- Input numerico libero "minuti" + bottone OK.
- ESC chiude, Enter conferma.
- Dopo conferma: toast di feedback "Loggato Xmin su [Nome]" + chiude.

### 6.3 System tray

Icona tray sempre presente quando l'app è in esecuzione. Click destro:
```
Calendario Appelli e Studio
├── Apri app
├── Log studio  ►  [Esame A]  ►  +15min
│                                 +30min
│                                 +60min
│                                 +90min
│                                 Personalizzato…  (apre quicklog)
│                  [Esame B]  ►  …
│                  ────────
│                  Apri quick log…
├── ────────
├── Disattiva notifiche temporaneamente
└── Esci
```

Click sinistro su icona = apre app (toggle show/hide).

### 6.4 Azioni cliccabili nelle notifiche (#7)

La notifica "Log rapido programmato" mostra i bottoni `+15min`, `+30min`, `+60min`, `Snooze 1h`.

Implementazione:
- Richiede AppUserModelID registrato → arriva automaticamente quando l'app è **installata via MSI** (`tauri build`, output bundle MSI).
- In dev mode i bottoni non appaiono (limitazione Windows), ma la notifica resta visibile.
- Le azioni emettono un event Tauri raccolto da `actions.rs` che:
  - per `+Xmin`: chiama `db::exams::set_study_day_minutes` per **l'ultimo esame su cui c'è stata attività** (fallback: primo esame attivo).
  - per `Snooze 1h`: inserisce una voce in `notification_log` con `sent_at = now + 1h` per posticipare (lo scheduler la rispetta).

## 7. Autostart e tray persistence

- `tauri-plugin-autostart` registra l'app per partire al login Windows.
- Toggle "Avvia con Windows" nella sottosezione **App e sistema** delle impostazioni (default **OFF**: l'utente deve attivarlo esplicitamente, coerente con la filosofia del master toggle notifiche).
- Quando l'app parte all'autostart: nasconde la finestra principale, lascia solo tray icon. Loop notifiche attivo.
- Click X sulla finestra principale = **minimizza in tray**, non chiude. Solo "Esci" dal tray chiude davvero.

## 8. Suoni

- Tipi 1–5, 7: suono default Windows (nessuna config esplicita).
- Tipo 6 (milestone streak): file `assets/streak.wav` incluso nel bundle, passato come `sound` alla notifica.

## 9. UI: pannello impostazioni notifiche

### 9.1 Struttura della SettingsModal

La `SettingsModal` esistente viene riorganizzata in **sottosezioni distinte** con header dedicati e separatori, montate verticalmente nello stesso modal:

```
Impostazioni
├── ▸ Tema                           (esistente)
├── ▸ Notifiche                      (NUOVA — sottosezione apposita)
├── ▸ App e sistema                  (NUOVA — autostart, tray)
└── ▸ Profilo utente                 (placeholder esistente)
```

La sezione **Notifiche** è implementata in `src/components/NotificationsSettings.tsx` (componente dedicato), importata e renderizzata dentro `SettingsModal.tsx`. Stessa cosa per "App e sistema" (componente `SystemSettings.tsx`).

Questo isolamento serve a:
- mantenere `SettingsModal.tsx` corto e leggibile,
- testare/iterare la UI delle notifiche in modo indipendente,
- preparare il terreno se in futuro la lista cresce (split in tabs).

### 9.2 Master toggle (gate globale)

In cima alla sottosezione Notifiche c'è un **master toggle "Abilita notifiche"** che funge da gate:

- **Default: OFF**. L'utente deve attivare esplicitamente le notifiche al primo uso — niente notifiche a sorpresa.
- Quando il master è OFF: lo scheduler non parte (o resta idle senza inviare). I sotto-toggle sono visibili ma disabilitati visivamente (grigi/non cliccabili), e il loro stato salvato è preservato per quando il master viene riattivato.
- Quando il master è ON: lo scheduler parte. Vengono richiesti i permessi notifiche di Windows (`requestPermission()`) se non già concessi. Se l'utente nega, mostra inline banner di errore.
- La preferenza master è salvata in `notification_prefs` con `kind = "_master"`.

### 9.3 Layout della sottosezione Notifiche

```
Notifiche
│
├── ☐ Abilita notifiche                              ← MASTER, default OFF
│   (quando OFF, tutto sotto è disabilitato/grigio)
│
├── ─── Tipi di notifica ───
├── ☑ Esami imminenti       [offsets: ☑7gg ☑3gg ☑1gg ☑mattina]
├── ☑ Inizio progetti
├── ☑ Deadline progetti     [offsets: ☑3gg ☑1gg ☑giorno]
├── ☑ Promemoria studio     [orari: 18:00 ✕]  [+ aggiungi orario]
├── ☑ Mancato studio        [ora: 22:00 ▼]   [☑ solo feriali]
├── ☑ Milestone streak      [🔊 con suono]
├── ☑ Log rapido programmato [orari: + aggiungi]
│
├── ─── Quick log ───
├── Hotkey quick log: [Ctrl+Alt+S]  [Cambia]
│
└── [Invia notifica di test]                          ← chiama notif_test_send
```

I default ON/OFF dei singoli tipi sono quelli della tabella in §2. Restano ON di default ma **invisibili finché il master non viene attivato**.

### 9.4 Layout della sottosezione App e sistema

```
App e sistema
├── ☑ Avvia con Windows
└── ☑ Minimizza in tray invece di chiudere
```

Anche queste preferenze sono salvate in `notification_prefs` con kind dedicati (`_autostart`, `_minimize_to_tray`) per riusare lo stesso storage senza creare una nuova tabella.

### 9.5 Persistenza

Tutte le preferenze (incluso master, sotto-tipi, hotkey, autostart, minimize-to-tray) sono persistite nella tabella `notification_prefs` tramite i comandi dedicati `get_notif_prefs` / `set_notif_pref` (vedi sezione 10). I comandi `get_setting` / `set_setting` esistenti restano riservati ad altre impostazioni globali (tema, ecc.).

## 10. Comandi Tauri da aggiungere

- `get_notif_prefs() -> NotifPrefs`
- `set_notif_pref(kind, enabled, config_json)`
- `notif_test_send(kind)` — invia notifica fittizia per testare permessi/UI
- `quicklog_log(exam_id, minutes)` — usato dalla finestra quicklog
- `quicklog_recent_exam() -> Option<i64>` — ultimo esame loggato (per default tray)

## 11. Comportamento on app close

- Default: chiudere finestra principale = minimizza in tray, scheduler continua.
- Solo "Esci" da tray menu termina davvero il processo.
- Se l'utente disattiva "Minimizza in tray", la chiusura termina il processo (e di conseguenza salta le notifiche fino al prossimo avvio).

## 12. Vincoli e note

- **Dev mode**: i toast su Windows appaiono come "PowerShell" generico e senza azioni cliccabili. Test reali = `tauri build` + installazione MSI.
- **Permessi notifiche Windows**: richiesti al primo avvio via `requestPermission()`. Se negati, mostrare banner nella UI.
- **Time zone**: tutto in `Local` (`chrono::Local`). Niente UTC nel calcolo "oggi".
- **DST**: trascurabile per uso personale.
- **Concorrenza**: lo scheduler accede al DB tramite `AppState.conn` (stesso `Mutex` esistente). Tick di 60s = nessuna contesa reale.

## 13. Test

- **Unit**: `rules.rs` con casi tabulati per ogni `NotifKind` (incl. edge: esame oggi, streak appena rotto, range che inizia oggi, ecc.).
- **Smoke manuale** post-build:
  1. Installa MSI.
  2. Crea esame con appello fra 3 giorni → reset orologio sistema o `notif_test_send` → verifica toast e azioni.
  3. Verifica quicklog popup (hotkey + tray).
  4. Verifica streak (forza date in DB, riavvia app).

## 14. Out of scope (future work)

- **C — Widget always-on-top**: mini-finestra galleggiante con esame del giorno e bottoni quick log. Tutta l'infrastruttura (popup, comandi quicklog) sarà già in piedi, quindi è additivo. Da rivalutare dopo qualche settimana di uso.
- Notifiche schedulate dal Windows Task Scheduler senza app aperta (oggi non serve: autostart + tray copre il caso).
- Sincronizzazione preferenze tra dispositivi.
- Azioni custom oltre quelle di #7.
- Suoni custom configurabili dall'utente (oggi solo asset built-in per milestone).

## 15. Riepilogo plugin/file nuovi

**Cargo deps:** `tauri-plugin-notification`, `tauri-plugin-global-shortcut`, `tauri-plugin-autostart`.

**Nuovi file Rust:** `notify/{mod,scheduler,rules,dedup,types,actions}.rs`, `quicklog/{mod,tray}.rs`, `db/migrations/005_notifications.sql`.

**Nuovi file frontend:** `src/components/NotificationsSettings.tsx`, `src/components/SystemSettings.tsx`, `src/quicklog.tsx`, `src/quicklog.html`, `src/notifications.ts`.

**File modificati:** `src-tauri/src/lib.rs` (setup loop + plugin), `src-tauri/src/commands.rs` (nuovi comandi), `src-tauri/tauri.conf.json` (finestra quicklog + tray + bundle), `src-tauri/capabilities/default.json` (permessi), `src/components/SettingsModal.tsx` (sezione notifiche).
