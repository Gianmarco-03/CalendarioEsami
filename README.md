# Calendario Appelli & Studio

Desktop app per tracciare esami universitari, appelli, giorni di studio, e progetti pluri-giorno. Tauri 2.x + React + TypeScript + SQLite. Offline-first, niente sync remoto.

## Prerequisiti

- Node.js ≥ 20
- Rust toolchain (`rustc`, `cargo`) — installa tramite [rustup](https://rustup.rs/)
- Windows: WebView2 (preinstallato su Windows 11) e Microsoft C++ Build Tools

## Comandi

```powershell
npm install            # installa dipendenze JS
npm run tauri dev      # avvio in modalità sviluppo (hot reload + finestra Tauri)
npm run tauri build    # produce installer di rilascio in src-tauri/target/release/bundle/
```

## Dove vive il database

SQLite single-file in:

- **Windows:** `%APPDATA%\com.calendario-appelli.app\calendar.db`
- **macOS:** `~/Library/Application Support/com.calendario-appelli.app/calendar.db`
- **Linux:** `~/.local/share/com.calendario-appelli.app/calendar.db`

Schema migrato automaticamente all'avvio via `PRAGMA user_version`.

## Test

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

Copre il layer DB: CRUD esami/progetti, validazione, toggle studio, import JSON. 28 test.

## Importare dati dall'artifact HTML

Bottone **"Importa da artifact"** nella sidebar. Apri l'artifact HTML originale, esegui in console:

```js
copy(localStorage.getItem("appelliStudio_v1"))
```

Incolla nella textarea del modal e conferma. Voci con nome già presente vengono saltate.

## Documentazione di design

- Spec: `docs/superpowers/specs/2026-05-16-calendario-appelli-tauri-design.md`
- Plan: `docs/superpowers/plans/2026-05-16-calendario-appelli-tauri-plan.md`
