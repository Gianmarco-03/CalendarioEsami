# Handoff — claendario · Nexo Note restyle

## Overview

Restyle completo dell'app desktop `claendario` (calendario appelli + studio universitario, Tauri 2.x + React 19 + TypeScript) seguendo il design system **Nexo Note** — minimal-black, Syne + JetBrains Mono + Instrument Serif, grana tessile, colori-utente come firma (puntini, rail, fill morbidi), chrome monocromo.

Lo scope copre tutte le superfici principali:
- **Sidebar** (modalità Calendario / Stats / Settings)
- **Calendar** (grid mensile con DayCell ridisegnata)
- **Stats** (KPI, chart, heatmap, per-exam bars)
- **Day modal** (quick-log studio)
- **Exam modal** (create/edit, scaled-down rispetto a quello reale)
- **Settings** (5 tab placeholders)
- **Todo** (placeholder WIP)

---

## About the Design Files

I file in questa cartella sono **una reference di design realizzata in HTML/JSX** — un prototipo cliccabile che mostra l'aspetto e le interazioni intese, **non codice di produzione da copiare 1:1**.

Il task è **riprodurre questi design nell'ambiente esistente del codebase Calendario-app**:
- React 19 + TypeScript
- Tailwind v4 con `@theme` block in `src/index.css`
- Lucide-react per le icone
- SQLite via Tauri per persistenza
- I componenti vivono in `src/components/`, gli stili globali in `src/index.css`

Non sostituire l'architettura. **Adatta** i token, gli stili e i pattern visivi al sistema esistente.

---

## Fidelity

**High-fidelity (hifi)** — colori, tipografia, spaziature, raggi, ombre e interazioni sono finali. Il developer dovrebbe ricreare l'UI pixel-perfect usando i pattern del codebase (Tailwind v4 + classi custom in `@layer components`).

---

## Visual direction · Nexo Note

| Aspetto | Valore |
|---|---|
| **Background** | `#000` con radial atmospherics + grana SVG fractalNoise @ 2.5% opacità |
| **Type display** | Syne 700/800, negative tracking (-0.04em a 28-44px, -0.08em a hero) |
| **Type UI** | JetBrains Mono 400-800 — body, label, numeri, metadata |
| **Type editorial** | Instrument Serif italic — per quote / accent, raramente |
| **Accent** | **Bianco** (#fafafa) — è l'unico accent del sistema. Niente blu/viola. |
| **Colori utente** | Solo come firma: puntini, rail 2-3px, fill `color-mix` morbidi. Mai sul chrome (bottoni/input/menu restano monocromi). |
| **Border** | `rgba(255,255,255,0.06)` (hairline) / `0.12` (strong) |
| **Divisori interni cella** | `rgba(255,255,255,0.22)` (tra bande) · `rgba(255,255,255,0.34)` (sotto numero giorno) · spessore **2px** |
| **Radius** | 6 / 10 / 14 / 20 / 999 — quattro step, nient'altro |
| **Shadow** | Sparse, con inset highlight `inset 0 1px 0 rgba(255,255,255,0.06)` per "glass edge" |
| **Motion** | 160ms / 240ms / 380ms — `cubic-bezier(0.22,1,0.36,1)` standard |

I token completi sono in `nexo-tokens.css`. **Portare TUTTI questi token nel `@theme` di `src/index.css`** sostituendo i token chiari attuali (light glass + aurora).

---

## File-by-file mapping al codebase target

Ogni file del prototipo corrisponde a uno o più file del codebase. Sotto la mappatura suggerita:

| Prototipo | Target nel codebase | Note |
|---|---|---|
| `nexo-tokens.css` | `src/index.css` (`@theme` block) | Sostituire tutti i token `--color-app-*`, aurora, dark. Aggiungere `--cell-divider`, `--cell-divider-top`, `--cell-divider-w`. |
| `styles.css` | `src/index.css` (`@layer components` + utility classes) | I selettori non-tailwind (`.cell`, `.banner`, `.band-area`, `.modal-panel`, etc.) vanno in `@layer components`. |
| `data.js` | n/a — i dati veri vengono da `db.ts` / `state.tsx` | Solo sample data. Ignora. |
| `components.jsx` (Modal) | `src/components/Modal.tsx` | Aggiornare con: kicker overhead, accent bar 3px, Syne 20px nel titolo, padding 18px. |
| `sidebar.jsx` | `src/components/Sidebar.tsx`, `ExamRow.tsx`, `SectionSwitcher.tsx` | Vedi sotto "Sidebar redesign". |
| `calendar.jsx` | `src/components/Calendar.tsx`, `CalendarHeader.tsx`, `DayCell.tsx`, `Legend.tsx` | Vedi sotto "Day cell redesign" — è il pezzo più importante. |
| `stats.jsx` | `src/components/StatsView.tsx` + tutto `src/components/stats/*` | Vedi sotto "Stats redesign". |
| `modals.jsx` (DayModal) | `src/components/DayModal.tsx` | Vedi sotto. |
| `modals.jsx` (ExamModal) | `src/components/ExamModal.tsx` | Solo restyle del chrome — la logica appelli/range va mantenuta. |
| `todo-settings.jsx` | `src/components/TodoView.tsx`, `SettingsView.tsx` + tabs | Restyle solo, niente cambi funzionali. |
| `app.jsx` | `src/App.tsx` | Cambia il chrome esterno: layout (Inset/Atelier/Glass come tweak persistito o scelta progettuale). |
| `tweaks-panel.jsx` | **NON portare nel codebase reale** | È solo per la demo prototipo, serve a switchare opzioni live. |
| `assets/logo.png` | `public/logo.png` (o equivalente in `src-tauri/icons/`) | Sostituisce il logo Tauri/Vite |

---

## Layout

Tre varianti esplorate nel prototipo via Tweak. **Scegliere "Inset" come default** (è quello che è apparso più "Nexo" durante la review):

### A · Inset frame (consigliato)
Un unico panel arrotondato (radius 20px) che racchiude sidebar+main, separati da una hairline verticale `rgba(255,255,255,0.06)`. Il panel ha background `rgba(5,5,5,0.96)`, border `1px solid rgba(255,255,255,0.06)`, shadow `lg + inset highlight`, backdrop-blur 14px. Margin esterno 14px su tutti i lati.

CSS reference: `.layout-inset` in `styles.css`.

### B · Atelier (alternativa editoriale)
Full-bleed senza chrome. Sidebar = colonna sinistra fissa, separata dal main solo da una `border-right: 1px solid rgba(255,255,255,0.06)`. Nessun rounded corner, nessun padding esterno.

### C · Glass dual (non scelta)
Due pannelli flottanti separati da gap 14px — pattern macOS. **Sconsigliato** per Nexo (rompe l'unità della superficie).

---

## Sidebar redesign

### Layout sidebar (260-290px wide)

```
┌──────────────────────────┐
│ 🅰 claendario            │  brand: Syne 18px 800, lowercase, logo 22px
├──────────────────────────┤
│ [📅 Calendario][📊][To-do]│  section switcher: segmented control, mono 11px, animated pill
├──────────────────────────┤
│ ESAMI · PROGETTI         │  kicker: mono 10px 700, letter-spacing 0.18em, uppercase, muted
│ Clicca un giorno…        │  helper: mono 11px 500, line-height 1.5, ink-70
├──────────────────────────┤
│ 🔍 Cerca esame…          │  search: mono 12px, bg rgba(0,0,0,0.4), border hairline, radius 10
├──────────────────────────┤
│ ┃⚛ Meccanica R.   3·8h 󠀀 │  exam row (vedi sotto)
│ ┃Σ Analisi III   2·7h  │
│ …                        │
├──────────────────────────┤
│ COMPLETATI            1  │  divider 16px gap, kicker + pill counter
│ ┃FILOSOFIA D. (passed)   │
├──────────────────────────┤
│ [+ Esame] [+ Progetto]   │  bottom row: primary white-on-black + secondary outline
│ ⬇ Importa da artifact    │  import-btn: ghost mono 11px
├──────────────────────────┤
│ 🅰 Giovanni B.       ⚙   │  footer: avatar 26px + meta + settings cog
│   locale · ok            │
└──────────────────────────┘
```

### Exam row anatomy

| Proprietà | Valore |
|---|---|
| Layout | Flex row, gap 8px, padding `8px 10px 8px 12px`, radius 10px |
| Background | `rgba(255,255,255,0.018)` default, `rgba(255,255,255,0.06)` selected, `var(--hover)` su hover |
| Border | `1px solid rgba(255,255,255,0.06)` default, `color-mix(in srgb, var(--ec) 38%, var(--border-strong))` selected |
| Stripe (left) | 2px (3px se selected), full-height meno 8px top/bottom, background `var(--ec)` (user color), border-radius 999 |
| Icon | 22×22 wrapper, radius 6, bg `color-mix(in srgb, var(--ec) 14%, transparent)`, color `var(--ec)`, lucide stroke 1.75 size 12 |
| Name | Mono 12.5px 600, ellipsis su overflow |
| Meta | Mono 10px 600, muted, tabular-nums (formato: `3·8h` per esami, `29g` per progetti) |
| Checkbox | 14×14, border-strong, radius 4, su check diventa bianco con tick nero |
| Actions (edit/trash) | Opacity 0 → 1 su `:hover`/`:focus-within`, 22×22 ghost button |
| Passed state | `opacity: 0.45`, name `text-decoration: line-through` |

### Section switcher (segmented)

3 segmenti (Calendario / Statistiche / To-do) con pill animato:
- Container: `padding: 4px`, `background: rgba(255,255,255,0.025)`, `border: 1px solid rgba(255,255,255,0.06)`, `radius: 10px`
- Pill: assoluto, `background: rgba(255,255,255,0.06)`, `border: 1px solid rgba(255,255,255,0.12)`, `radius: 8px`, `box-shadow: inset 0 1px 0 rgba(255,255,255,0.12)`
- Transizione del pill: `left/width 240ms cubic-bezier(0.22,1,0.36,1)` — usare `useLayoutEffect` per misurare le posizioni dei bottoni
- Bottone attivo: `color: var(--text)` (white), inattivo: `color: var(--ink-70)`, hover non-attivo: `color: var(--ink-90)`
- Bottone: mono 11px 600, icon 12, gap 6, padding `7px 4px`

---

## Day cell redesign (★ pezzo critico)

### Anatomia della cella

```
┌──────────────────────────┐
│ OGGI                  18 │  cell-head: padding 5/9px, min-height 26px,
│                          │  align center, justify space-between
├══════════════════════════┤  divisore SOPRA, brighter: 2px var(--cell-divider-top) (0.34 white)
│ ● MECCANICA RAZIONALE    │  banner (appello) — opzionale, full-width
├──────────────────────────┤  divisore tra banners: 2px var(--cell-divider) (0.22 white)
│ ● ANALISI III            │  altro banner
├══════════════════════════┤  divisore sopra band-area: 2px var(--cell-divider-top)
│                          │
│         ⚛               │  band: full fill con color-mix bg + icon centrato
│                          │
└──────────────────────────┘
```

### Banner (appello — esame nella giornata)
- Full-width, `padding: 3px 8px`, NO radius (bleed edge-to-edge dentro il cell radius)
- Background: `color-mix(in srgb, var(--bc) 22%, transparent)` (var(--bc) = exam color)
- Dot 5×5 a sinistra: `background: var(--bc)`, `box-shadow: 0 0 0 2px color-mix(... 22%, transparent)`
- Testo: mono `clamp(8px, 8.5cqh, 11px)` 700, uppercase, letter-spacing 0.04em
- Overflow `+N altri` (banner-overflow): bg transparent, lowercase, mono 9.5px 600 muted

### Band area · split logic

**La cella divide lo spazio attività in base al numero di attività del giorno:**

| Numero attività | Layout | CSS |
|---|---|---|
| 1 | Single fill | `flex-direction: column` |
| 2 | Stack verticale (sopra/sotto) | `flex-direction: column` + `border-top: 2px var(--cell-divider)` tra bande |
| 3 | 3 colonne (side-by-side) | `flex-direction: row` + `border-left: 2px var(--cell-divider)` tra bande |
| 4 | Griglia 2×2 (4 quadrati) | `display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr` + border destro/inferiore su prima riga/colonna |
| 5+ | Mostra primi 4 — niente "+N" sulle bande, le bande restanti sono "perse" | (decidi come gestire — il prototipo taglia a 4) |

### Band fill

| Tipo | Background | Icon color |
|---|---|---|
| `project` (range in corso) | `color-mix(in srgb, var(--bc) 22%, transparent)` | `#fff` (bianco), opacity 0.95 |
| `study` (studio loggato) | `color-mix(in srgb, var(--bc) 10%, transparent)` | `var(--bc)` (exam color), opacity 0.9 |

Icon size scala con container query: `width: clamp(12px, min(45cqh, 45cqw), 30px)` — fondamentale per leggibilità su celle di varie altezze.

### Today state
- `border-color: rgba(255,255,255,0.30)` (vs 0.06 default)
- `box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 0 0 1px rgba(255,255,255,0.05)` (extra ring)
- Badge "OGGI" in alto a sinistra del cell-head: mono 8.5px 700, letter-spacing 0.18em, bg `var(--text)` (white), color `#000`, padding `2px 5px`, radius 4
- Day-num: `color: var(--text)` (white), `font-weight: 800` (vs 700 default)

### Project edge stripes
Quando una cella è inizio o fine di un range progetto:
- `.proj-stripe-l`: span absolute, `left:0, top:0, bottom:0, width:3px`, `background: var(--proj-start-color)` (user-color del progetto)
- `.proj-stripe-r`: idem ma `right:0`, `background: var(--proj-end-color)`
- z-index 4 (sopra le bande, sotto banner+day-num)

### Day number
- Family: Syne 700, font-size 17px (default), -0.04em tracking, tabular-nums
- Color: `var(--ink-80)` (default), `var(--ink-60)` (weekend), `var(--text)` 800 (today)
- Posizione: dentro `.cell-head` allineato a destra (NON absolute come prima)

### Hover
- `transform: translateY(-1px)`
- `border-color: rgba(255,255,255,0.14)`
- `background: rgba(15,15,15,0.7)` (cell bg si schiarisce leggermente)
- Transizione 160ms con `cubic-bezier(0.22,1,0.36,1)`

### Density (Tweak — esponilo nelle Settings dell'app reale)
- **Compatto**: gap 4px tra celle, radius 6, cell-head min-height 22px, day-num 14px
- **Comodo** (default): gap 10px, radius 14, cell-head min-height 30px, day-num 20px
- **Default** (intermedio): gap 8px, radius 10, cell-head min-height 26px, day-num 17px (è quello che vedi nel prototipo)

---

## Calendar header

```
CALENDARIO · A.A. 2025–26                              ← →
maggio 2026                                       [OGGI]
● oggi è lunedì 18 maggio  ·  clicca un giorno per loggare
```

- Kicker: mono 10px 700, letter-spacing 0.22em, uppercase, muted, margin-bottom 8px
- Title: Syne 38px 800, letter-spacing -0.04em, **lowercase** (importante: rompe la convenzione, dà il vibe editoriale Nexo)
- Year span: `color: var(--ink-70)` (più chiaro del mese), font-weight 700
- Subtitle: mono 12px muted, con live-dot 5×5 white + shadow + separatori `·`
- Nav buttons: 32×32, radius 10, border hairline, bg `rgba(255,255,255,0.02)`, hover `var(--hover)`
- Today button: 32 height, mono 10px 700, letter-spacing 0.18em, uppercase, bg `var(--panel-raised)`, border-strong, inset highlight

### Header style variants (Tweak)
- **Hero** (Syne 64px) — per landing/onboarding, troppo enfatico per app uso quotidiano
- **Measured** (Syne 38px) — **default consigliato**
- **Sober** (mono 18px capitalize) — minimalismo estremo, niente kicker né subtitle

---

## Stats redesign

### Hero (sostituisce il titolone)

```
┌─────┐  STATISTICHE · VISTA GLOBALE        (oppure: · esame)
│  🌐 │  Globale                            (oppure: nome esame in user color)
└─────┘
```

- Swatch 44×44, radius 10, bg `color-mix(... 18%)`, border `color-mix(... 35%)`, color = exam color (o white per Globale)
- Kicker mono 10px 700 tracked
- H1: Syne 28px 800, -0.04em, white o user-color (`.colored`)

### Range selector
Segmented control: 7g · 30g · Mese · Anno · Tutto. Mono 11px 600 uppercase, padding `6px 12px`. Active: bg `rgba(255,255,255,0.08)`, inset highlight.

### KPI grid (4 cards)

```
┌──────────┬──────────┬──────────┬──────────┐
│ TOTALE   │ OGGI     │ MEDIA    │ STREAK   │
│ 14h 30m  │ 80 min   │ 67 min/g │ 8 giorni │
│ consigl. │ ▲ corso  │ periodo  │ no pausa │
└──────────┴──────────┴──────────┴──────────┘
```

- Container: `display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border); border-radius: 14`
- KPI: bg `var(--panel)`, padding `16px 18px`
- Label: mono 10px 700 letter-spacing 0.18em uppercase muted
- Number: Syne 30px 700, -0.03em, tabular-nums
- Unit: mono 11px muted, baseline-aligned
- Delta: mono 10px, success/danger color o ink-80

### Today quick log
Una card per esame: stripe user-color, icon wrapper, name, "X min loggati" o "non loggato", checkmark a destra. Layout `repeat(auto-fill, minmax(220px, 1fr))`.

### Study chart (effettivo vs consigliato)
SVG inline, 800×220 viewBox, preserveAspectRatio="none". Vedi `StudyChart` in `stats.jsx`:
- Y gridlines: `stroke: rgba(255,255,255,0.05)`, axis labels mono 9.5px
- Suggested bars (sfondo): fill `rgba(255,255,255,0.10)`, larghi
- Actual bars (foreground): fill `var(--ink-90)` o user-color, larghi 1/2 dei suggested, centrati
- Today marker: linea verticale tratteggiata 2-3px, `var(--text)`, opacity 0.5
- Gradient fill area: linear-gradient bianco→trasparente 0.35→0

### Year heatmap
GitHub-style. 53 col × 7 righe (lun-dom), celle 12×12, gap 3. Intensità calcolata via `color-mix` su user-color base (o white per Globale): `color-mix(in srgb, baseColor (10+70*pct)%, transparent)`. Click → apre DayModal del giorno.

### Per-exam bars
Solo in modalità Globale. Lista di esami con: dot 8 user-color + nome + track 5px alto + percentage + valore totale. Ordinati per minuti decrescenti.

---

## Day modal

```
┌──────────────────────────────────────────┐
│ ━━━━━━━━━━━ accent bar 3px ━━━━━━━━━━━ │  user color o white per Globale
├──────────────────────────────────────────┤
│ 📅 OGGI                              ✕   │  kicker + close
│    Lunedì 18 maggio 2026                 │  Syne 20px 700
├──────────────────────────────────────────┤
│ ● Meccanica Razionale         APPELLO    │  info-line per ogni appello/progetto-in-corso
│ ● Tesi triennale           PROGETTO ON   │
├──────────────────────────────────────────┤
│ STO STUDIANDO PER…                       │
│                                          │
│ ┃Meccanica Raz.  🕐 [60] ~ 60m  ☑       │  study-row: stripe + name + minutes + sugg + checkbox
│ ┃Analisi III     🕐 [80] ~ 60m  ☑       │
│ ┃Storia Antica                  ☐       │  unchecked: no input visible
├──────────────────────────────────────────┤
│ ⌘S salva · ESC chiudi          [Chiudi] │
└──────────────────────────────────────────┘
```

- Modal panel: bg `var(--panel-overlay)`, border `var(--border-strong)`, radius 20, shadow popover (xl + inset-strong)
- Overlay: `rgba(0,0,0,0.65)` + `backdrop-filter: blur(8px)`
- Animation entry: `modal-enter 240ms cubic-bezier(0.18,0.9,0.32,1)` (opacity + translateY 12 → 0 + scale 0.985 → 1)

---

## Settings

- Sidebar in modalità settings: pulsante "Torna all'app" (mono 11px ghost, icon `arrow-left`), brand + titolo "Impostazioni", helper, nav list (5 tab)
- Tab active: bg `rgba(255,255,255,0.06)`, border-strong, inset highlight
- Main pane settings: page-head misurato, contenuto in setting-card (panel + radius 14 + edge-inset)
- `toggle`: switch custom 36×20, background `rgba(255,255,255,0.08)` → `var(--text)` on, dot `var(--text)` → `#000` on
- 5 tab: Personalizzazione · Notifiche · Dati & backup · Sistema · Informazioni

---

## Animation & motion

| Durata | Uso |
|---|---|
| 160ms | Hover, press, color transitions |
| 240ms | Section switch pill, modal enter, view-enter |
| 380ms | Slow surface entries (raro) |

Tutte usano `cubic-bezier(0.22, 1, 0.36, 1)` (var(--ease-standard)) di default. Per entries più morbide: `cubic-bezier(0.18, 0.9, 0.32, 1)` (var(--ease-soft)). Per tap feedback con slight overshoot: `cubic-bezier(0.2, 0.9, 0.2, 1.12)` (var(--ease-snappy)).

`view-enter` (su section change): `opacity 0 + translateY(8px) → 1 + 0` over 260ms.

**Honor `prefers-reduced-motion`** — disabilita tutte le animazioni quando attivo.

---

## Icons

Lucide-react (già nel codebase). Stroke-width **1.75** di default, **1.5** per icon ≥24px. Color `var(--ink-80)` di default, `var(--text)` quando attivo. Mai filled. Mai colorati col brand (il brand è bianco).

Le icone esame nel prototipo (atom, sigma, beaker, scale, landmark, feather, globe, etc.) sono SVG inline ricreate. Nel codebase usa direttamente lucide-react: `Atom`, `Sigma`, `BookOpen`, `FlaskConical`, `Scale`, `Landmark`, `Feather`, `Globe`, etc.

---

## Atmosfera

- **Grana**: SVG inline `feTurbulence baseFrequency="0.9"` @ 2.5% opacity, applicata su `body::after` fisso. **Non discutibile** — è ciò che impedisce a `#000` di leggere come void morto.
- **Atmospherics**: due radial-gradient bianchi a bassissima opacità (2.5% e 1.8%) angolati a 18/10 e 90/90. Applicati su un `.atmos` fixed div con z-index -2.
- **Backdrop-blur 14px** sui panel principali — invisibile su nero pieno, importante quando popover si sovrappongono a immagini/contenuto.

Tweak per disabilitare grana / bagliore (utile per debug ma di default ON).

---

## Componenti chiave da portare

Ordine consigliato di implementazione (dal più importante al meno):

1. **Token block** in `src/index.css` — sostituisci `@theme { --color-app-* }` con i token Nexo. Aggiungi i tre nuovi: `--cell-divider`, `--cell-divider-top`, `--cell-divider-w`.
2. **Body atmosphere** — grain overlay + radial atmospherics. Vedi `nexo-tokens.css` (body::after) e `styles.css` (.atmos).
3. **Font import** — Google Fonts: Syne, JetBrains Mono, Instrument Serif. Già nel link in `nexo-tokens.css`.
4. **DayCell.tsx** — questo è il componente più impattante. Implementa la cell-head, split logic 1/2/3/4, banners, project stripes, today badge.
5. **Calendar.tsx + CalendarHeader.tsx** — header con Syne lowercase + kicker + subtitle + nav buttons.
6. **Sidebar.tsx + ExamRow.tsx + SectionSwitcher.tsx** — segmented control animato, exam row con stripe + icon wrapper + checkbox custom.
7. **Modal.tsx** — kicker overhead + accent bar + Syne title + animation. Tutti gli usi (DayModal, ExamModal, ImportModal) ereditano.
8. **DayModal.tsx** — kicker "OGGI" / "GIORNATA", info-line cards, study-row con stripe.
9. **StatsView + sotto-componenti** — hero swatch + range selector + KPI grid + chart + heatmap.
10. **SettingsView + tabs** — restyle leggero, mantiene la struttura.
11. **App.tsx** — scegli layout (consiglio Inset). Rimuovi aurora-bg blobs (sostituiti da grana + atmospherics).

---

## State management (logica esistente)

**Non toccare la logica.** I prototipi usano sample data e `useState` locale per chiarezza, ma nel codebase:
- `state.tsx` → `ExamsProvider` con `useExams()` resta invariato
- `db.ts` → schema SQLite resta invariato
- `progetto.ts`, `study-time.ts`, `suggested-strategy.ts` → tutto invariato
- `notifications.ts` → invariato

Stai solo cambiando il **chrome**.

---

## Design tokens (riferimento rapido)

### Colors core
```css
--ink-0: #000000;
--ink-05: #050505;
--ink-10: #0a0a0a;
--ink-15: #111111;
--ink-20: #1a1a1a;
--ink-30: #222222;
--ink-50: #444444;
--ink-60: #666666;
--ink-70: #888888;
--ink-80: #bdbdbd;
--ink-90: #dedede;
--ink-100: #fafafa;  /* primary text — NON #ffffff */
--ink-pure: #ffffff; /* riservato: brand mark, focus ring */
```

### Semantic
```css
--bg: #000;
--panel: rgba(5, 5, 5, 0.96);
--panel-raised: rgba(10, 10, 10, 0.98);
--panel-overlay: rgba(17, 17, 17, 0.92);
--text: var(--ink-100);
--muted: var(--ink-70);
--border: rgba(255, 255, 255, 0.06);
--border-strong: rgba(255, 255, 255, 0.12);
--hover: rgba(255, 255, 255, 0.04);
--pressed: rgba(255, 255, 255, 0.08);
--brand: var(--ink-pure);
--danger: #a88890;  /* mauve, non rosso */
--success: #c8c8c0; /* warm bone */
--warn: #d4c49a;    /* pale wheat */
```

### Cell-specific (nuovi)
```css
--cell-divider: rgba(255, 255, 255, 0.22);     /* tra bande */
--cell-divider-top: rgba(255, 255, 255, 0.34); /* sotto numero giorno (più chiaro) */
--cell-divider-w: 2px;                         /* spessore */
```

### Spacing scale (4pt base)
4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96

### Radius scale
6 (chip) / 10 (button, input, small card) / 14 (card, panel, tree item) / 20 (modal, hero) / 999 (pill)

### Type scale
11 / 12 / 13 / 14 / 16 / 20 / 28 / 44 / clamp(3.2rem, 9vw, 6.4rem) hero

---

## User-assigned colors

Il prototipo mantiene la palette esami esistente (familiar al user):

```
#E8543F · #2E86C1 · #27AE60 · #8E44AD
#F39C12 · #16A0A0 · #D81B7A · #5D6D7E
#C0392B · #1F8A4C · #7D5FFF · #E67E22
```

I colori utente sono **firma**, non tema:
- ✅ Dot 5-12px adiacente al nome
- ✅ Rail/stripe 2-3px sui bordi delle entity row
- ✅ Banner fill (`color-mix 22%`)
- ✅ Band fill (`color-mix 10-22%`)
- ✅ Progress bar fill nei plan
- ✅ Heatmap intensity base
- ❌ Mai sul background di una card intera
- ❌ Mai sul testo del body
- ❌ Mai sui bottoni/input/menu (chrome resta monocromo)

---

## Italian copy · voce Nexo Note

L'app è italiana. Il prototipo ha polished la voce leggermente:
- Kicker tracked-out uppercase: `STUDIO · PROGETTI`, `CALENDARIO · A.A. 2025–26`, `OGGI · QUICK LOG`
- Frasi tagliate, senza esclamativi: "oggi è lunedì 18 maggio · clicca un giorno per loggare lo studio"
- Pulsanti azione: imperativi brevi: "Chiudi", "Annulla", "Salva", "Esporta"
- Sentence case sempre (mai Title Case in prose)
- Niente emoji nel UI

Mantieni il tone esistente del codebase — il prototipo è solo allineamento.

---

## Files in this bundle

```
design_handoff_nexo_restyle/
├── README.md                ← questo file
├── Calendario.html          ← entry HTML del prototipo (apri questo)
├── nexo-tokens.css          ← token Nexo Note completi (porta in src/index.css @theme)
├── styles.css               ← styles app-specific (porta sotto @layer components)
├── data.js                  ← sample data (solo per il proto, ignora)
├── tweaks-panel.jsx         ← controlli runtime (non portare nel codebase)
├── components.jsx           ← Modal + helpers
├── sidebar.jsx              ← Sidebar + ExamRow + SectionSwitcher
├── calendar.jsx             ← Calendar + DayCell + Legend + CalendarHeader
├── stats.jsx                ← StatsView + KpiCards + StudyChart + YearHeatmap + PerExamBars
├── modals.jsx               ← DayModal + ExamModal
├── todo-settings.jsx        ← TodoView + SettingsView (5 tabs)
├── app.jsx                  ← Shell wiring
├── assets/
│   └── logo.png             ← brand mark
└── screenshots/             ← reference visiva (vedi sotto)
    ├── 01-calendar-default.png    Calendario · stile cella "Soffuso" (default)
    ├── 02-cell-piene.png          Variante cella "Pieno" (bande color-fill forte)
    ├── 03-cell-firma.png          Variante cella "Firma" (solo dot/bar, no bande)
    ├── 04-day-modal.png           Quick-log studio per il giorno corrente
    ├── 05-stats-globale.png       Vista statistiche · Globale (KPI + chart + heatmap)
    ├── 06-settings.png            Impostazioni · tab Personalizzazione
    └── 07-layout-atelier.png      Layout alternativo "Atelier" (full-bleed)
```

---

## Test plan suggested

Una volta portato:

1. **Sidebar** — apri/chiudi search, conferma il pill animato del section switcher, prova selezione esame in modalità Stats, verifica hover/passed state
2. **Calendar** — naviga tra mesi (chevron + Oggi), verifica today badge solo sulla cella del giorno corrente, verifica le 4 modalità split (1/2/3/4 attività), verifica project stripes su start/end range
3. **Day modal** — clic su una cella, conferma layout, edit minuti, toggle studio
4. **Stats** — switch tra Globale e esame singolo, prova tutti i 5 range (7g/30g/mese/anno/tutto), verifica chart che cambia con accent color
5. **A11y** — `prefers-reduced-motion` disabilita animazioni, focus ring visibile su tutti i controlli (2px white outline + 2px offset)
6. **Italiano** — tutto il copy è in italiano, niente exclamation marks aggiunti dalla generazione

Eventuali screenshot sono nella cartella `screenshots/` — sette viste numerate. Aprili come reference visiva mentre porti il codice.
