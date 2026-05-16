# Restyle "Aurora" — Design Spec

**Status:** Approved (design)
**Date:** 2026-05-16
**Branch:** `feat/tauri-port` (continues from existing port)
**Previous specs:** `2026-05-16-calendario-appelli-tauri-design.md` (initial port)

## 1. Goal

Restyle visivo dell'app **Calendario Appelli e Studio** con un linguaggio "Aurora": glass su base scura (default) con singola macchia ambient blu, controparte chiara coerente. Sostituisce il design "Refined" attuale.

**Out of scope (esplicitamente):** layout, struttura DOM, componenti React, schema DB, comandi Tauri, librerie, palette dei 12 colori esami. Cambiano solo CSS, tokens, e una manciata di mini-componenti decorativi (ambient gradient layer + minor motion). L'app continua a funzionare identica funzionalmente; cambia solo come appare.

## 2. Direzione

| Dimensione | Scelta |
|---|---|
| Direzione | Glass / Modern |
| Sub-variant | Aurora (single-color ambient) |
| Tema chiaro | Aurora Light coerente (NON pastel-Vision-OS) |
| Motion | Subtle drift |

## 3. Token CSS (`src/index.css`)

Sostituisce i token attuali. La struttura `@theme {}` + `.dark { … }` resta invariata; cambiano i valori e si aggiungono token per il gradient ambient.

### 3.1 Light (default `@theme`)

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
  --aurora-3: rgba(255, 180, 200, 0.13); /* hint warm to break monotony */

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

### 3.2 Dark (`.dark { … }`)

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

## 4. Ambient layer

Un nuovo elemento `<div className="aurora-bg" aria-hidden />` viene aggiunto come **primo figlio** dell'app root in `App.tsx`, posizionato `fixed inset-0 -z-10 pointer-events-none`. Contiene tre `<div className="aurora-blob aurora-blob-N" />` con i tre `--aurora-N`.

```css
.aurora-bg {
  position: fixed; inset: 0; z-index: -10;
  pointer-events: none; overflow: hidden;
}
.aurora-blob {
  position: absolute; border-radius: 50%;
  filter: blur(60px);
  will-change: transform, opacity;
}
.aurora-blob-1 {
  top: -10%; left: -5%; width: 60vw; height: 60vw;
  background: radial-gradient(circle, var(--aurora-1) 0%, transparent 60%);
  animation: aurora-drift-1 14s ease-in-out infinite;
}
.aurora-blob-2 {
  bottom: -15%; right: -10%; width: 70vw; height: 70vw;
  background: radial-gradient(circle, var(--aurora-2) 0%, transparent 55%);
  animation: aurora-drift-2 18s ease-in-out infinite;
}
.aurora-blob-3 {
  top: 30%; right: 5%; width: 40vw; height: 40vw;
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
  .aurora-blob-1, .aurora-blob-2, .aurora-blob-3 { animation: none !important; }
}
```

Il blur è dichiarato in CSS (`filter: blur(60px)`) anziché via `backdrop-filter` perché qui stiamo sfumando il BLOB stesso. Il glass effect sulle superfici sopra (sidebar/main/celle) usa `backdrop-filter: blur(var(--blur-strong))` come oggi.

## 5. Classi `@layer components`

Aggiunte in `index.css` per ridurre ripetizione:

```css
@layer components {
  .glass-panel {
    background: var(--color-app-card);
    backdrop-filter: blur(var(--blur-strong)) saturate(160%);
    border: 1px solid var(--color-app-border);
    transition: background-color .25s, border-color .25s;
  }
  .glass-input {
    background: var(--color-app-input-bg);
    border: 1px solid var(--color-app-input-border);
    color: var(--color-app-fg);
  }
  .glass-input::placeholder { color: var(--color-app-muted); }

  .lift-hover {
    transition: transform .18s ease, box-shadow .18s ease, background-color .18s ease;
  }
  .lift-hover:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(70, 130, 240, 0.15);
  }
  .dark .lift-hover:hover {
    box-shadow: 0 4px 14px rgba(70, 130, 240, 0.25);
  }

  @media (prefers-reduced-motion: reduce) {
    .lift-hover { transition: none; }
    .lift-hover:hover { transform: none; box-shadow: none; }
  }
}
```

## 6. Componenti React — modifiche minime

### 6.1 `App.tsx`

- Aggiungere `<div className="aurora-bg" aria-hidden><div className="aurora-blob aurora-blob-1"/><div className="aurora-blob aurora-blob-2"/><div className="aurora-blob aurora-blob-3"/></div>` come primo figlio del root div.
- Cambiare `bg-app-bg` su root da opaco a `bg-[var(--color-app-bg)]` (il valore semantico è già nei token; non cambia nulla, ma esplicita l'uso del CSS var).
- Main panel: aggiungere classe `glass-panel` accanto a quelle esistenti (rimuovere `bg-app-card border-app-border` che sono ora dentro `glass-panel`).

### 6.2 `Sidebar.tsx`

- Sostituire `bg-app-card border border-app-border` con `glass-panel`.

### 6.3 `Modal.tsx`

- Background overlay: aumentare blur a `backdrop-blur-md` (`backdrop-filter: blur(8px)`) e bg overlay più traslucido `bg-black/30` (`rgba(0,0,0,0.30)`).
- Modal container: usare `glass-panel` invece di `bg-app-card border border-app-border`.

### 6.4 `DayCell.tsx`

- Cella base: aggiungere `lift-hover` alla classe; rimuovere le classi `hover:outline-*` (sostituite dal `lift-hover` + box-shadow).
- Background della cella resta `bg-app-cell` (token aggiornato).

### 6.5 `Calendar.tsx`, `CalendarHeader.tsx`

- Nessun cambio strutturale. I bottoni `bg-app-card hover:bg-app-hover` continuano a funzionare con i nuovi token (che ora restituiscono valori glass).

### 6.6 `Toast.tsx`

- Toast: aggiungere `backdrop-filter: blur(12px)` e cambiare bg da solido (`bg-red-50`) a semi-trasparente con tinta colore (`bg-red-500/15`).

### 6.7 `SectionSwitcher.tsx`

- Pill di selezione: aggiungere `backdrop-filter: blur(8px)` per coerenza. Background già `bg-app-card`.

### 6.8 `ExamRow.tsx`

- Aggiungere `lift-hover` alla riga; il bg semi-trasparente `bg-app-soft` già lavora bene con l'ambient sottostante.

## 7. Cosa NON cambia

- Layout (sidebar 290px + main, switcher in cima sidebar, settings gear in basso a destra).
- Icone Lucide (set, dimensioni, stroke).
- Schema DB / migrations / comandi Tauri / logica TypeScript.
- Tipografia (system font stack).
- Palette dei 12 colori esami.
- Comportamento dei toast (4s autodismiss).
- Behavior modale (Escape, backdrop click, focus).

## 8. Accessibilità

- `prefers-reduced-motion: reduce` disabilita tutte le animazioni dell'ambient layer e del lift-hover.
- Contrasto testo verificato manualmente nelle due varianti:
  - Dark: `#e7ebf2` su `rgba(20,25,45,.55)` blended su `#060916` → ~12:1 (AAA).
  - Light: `#1a2540` su `rgba(255,255,255,.72)` blended su `#eef3fb` → ~13:1 (AAA).
- Per evitare leggibilità degradata sopra l'aurora-blob più saturato (dark, alpha .55), le superfici glass mantengono background ≥ .55 alpha + blur 16px che attenua il colore sottostante.

## 9. Performance

- 3 blob animati con `transform`/`opacity` (composited): ~1% CPU sostenuto in idle.
- `will-change: transform, opacity` su `.aurora-blob` per promuovere a layer GPU.
- `backdrop-filter: blur(16px)` su 3 superfici (sidebar, main, modali) — supportato su WebView2 (Windows 11) senza fallback.

## 10. Migrazione palette esami

Nessuna. La palette resta invariata, l'app non richiede a chi importa dati una mappatura nuova. Lo stesso esame mantiene lo stesso colore in entrambi i temi.

## 11. Open items risolti

1. Direzione: Glass / Modern → **confermato**.
2. Sub-variant: Aurora → **confermato**.
3. Light mode: Aurora Light coerente → **confermato**.
4. Motion: Subtle drift → **confermato**.

## 12. Out of scope (v1 del restyle)

- Per-exam ambient: l'aurora-1 cambia colore in base agli esami attivi (interessante, ma rischia di rendere l'app "rumorosa"; valutabile in v2).
- Custom user accent: utente che sceglie il colore ambient nelle settings (estensione naturale post-v1).
- Statistiche/To-do views: restano placeholder; il loro design dedicato è un'altra spec.
- Effetto noise/grana sul background: skip per scope.
- Modal entrance animation oltre al fade-in attuale: skip.
