# Popup Restyle — Design Spec

**Date:** 2026-05-17
**Status:** Approved (pending implementation plan)
**Scope:** Visual + structural redesign dei 5 modali dell'app (`Modal`, `DayModal`, `ExamModal`, `SettingsModal`, `ImportModal`). Nessuna modifica alla logica applicativa.

---

## Motivation

I popup attuali soffrono di tre problemi:

1. **Dark mode rotto in più punti.** `ExamModal` e `ImportModal` usano colori hardcoded (`#d6d9e0`, `#6b7280`, `#2f3545`, `#c0392b`, `#fdf1ef`, `#eef0f3`, `#2f6fb3`) che non rispondono al token theme-aware esistente. Il risultato in `.dark` è una serie di superfici grigio-chiaro fuori contesto.
2. **Gerarchia visiva piatta.** Header, body e azioni si fondono in un'unica colonna senza separatori. Nei modali lunghi (`ExamModal` con molte entries) le azioni primarie scorrono fuori vista perché non c'è footer sticky.
3. **Larghezza fissa 380px.** Stretta per `ExamModal` (entries date + range affiancate), eccessiva per `SettingsModal`.

Il redesign mantiene l'estetica esistente (glass + aurora) ma introduce una struttura a tre zone (header / body scrollabile / footer sticky), accent bar superiore, sezioni divise da hairline, larghezza adattiva, e ripulisce tutti i colori hardcoded a token theme-aware.

## Out of scope

- Logica applicativa: validazione, salvataggio, toggle studio, import, ecc. invariati
- Aree non-modal dell'app: calendario, sidebar, toast — non toccate
- Nuove feature: niente nuovi campi, nuovi flow, nuove animazioni complesse
- Rifattorizzazione del sistema di stato (`useExams`, `useTheme`)
- A11y oltre i fondamentali già presenti (escape-to-close, aria-label sul close button)

---

## Design

### A) Struttura del `Modal` wrapper

Tre zone fisse, separate da bordi sottili `border-app-border`:

```
+----------------------------------+
| [accent bar 4px]                 |  <- 4px, colore = prop `accent` (default app-accent)
+----------------------------------+
|  [icon] Titolo            [X]    |  <- header non scrollabile
+==================================+
|                                  |
|   <children scrollabili>         |  <- max-height: 60vh, padding 18px, gap 16px tra sezioni
|                                  |
+==================================+
|  [opt: distruttivo]  [sec][pri]  |  <- footer non scrollabile
+----------------------------------+
```

#### Props del componente `Modal`

```ts
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  icon?: LucideIcon;                    // NEW — icon a sinistra del titolo nell'header
  accent?: string;                      // NEW — colore CSS per la accent bar; default: var(--color-app-accent)
  size?: "sm" | "md" | "lg" | "xl";     // NEW — default "md"
  footer?: ReactNode;                   // NEW — slot per le azioni; se omesso il footer non viene renderizzato
}
```

#### Mapping size → max-width

| size | max-width | Modale di riferimento |
|------|-----------|----------------------|
| `sm` | 360px     | `SettingsModal`       |
| `md` | 420px     | `DayModal`            |
| `lg` | 480px     | `ExamModal`           |
| `xl` | 520px     | `ImportModal`         |

Tutti hanno `width: 100%` con il `max-width` indicato, padding orizzontale del backdrop a `p-5` come oggi.

#### Body scrollabile

- `max-height: 60vh` sul body (non sul modal intero come oggi `max-h-[88vh]`). Così header e footer restano sempre visibili anche con contenuti lunghi.
- `overflow-y: auto` con scrollbar custom sottile (6px, `app-border`).
- Padding `18px` (oggi `px-4 pb-4 pt-1` — meno uniforme).
- Layout `flex flex-col gap-4` per spaziare i children. Le "sezioni" del body (vedi sotto) si auto-spaziano.

#### Footer non scrollabile

- Renderizzato solo se la prop `footer` è valorizzata.
- `border-top: 1px solid app-border`.
- Padding `12px 18px`.
- Layout `flex items-center gap-2`. Convenzione: le azioni distruttive (Elimina) vanno a sinistra; secondarie + primaria a destra usando uno spacer `flex-1`.

#### Animazione

- Modal entrata: applico la `@keyframes fade-in` esistente (opacity + translateY 4px), durata 180ms.
- Backdrop: fade-in opacità 150ms.
- Rispetto di `prefers-reduced-motion: reduce` (già presente nel CSS — estendo la regola).

#### Comportamento invariato

- Chiusura con Escape (già implementato).
- Chiusura cliccando sul backdrop (già implementato).
- Focus trap: **non implementato** né oggi né nel redesign (out of scope).

---

### B) Token CSS — cleanup e nuove definizioni

Tutti i colori hardcoded nei file modale vengono sostituiti con token esistenti o nuovi. Tabella di mapping:

| File / Hardcoded | Sostituito con |
|---|---|
| `ExamModal` `#6b7280` (label muted) | `text-app-muted` |
| `ExamModal` `#d6d9e0` (border input) | `border-app-input-border` |
| `ExamModal` `#aeb4c0` (focus outline) | `outline-app-accent/40` (via nuovo `--color-app-focus-ring`) |
| `ExamModal` `#1f2430` (swatch selezionata) | `border-app-fg` |
| `ExamModal` `#2f6fb3` ("Aggiungi data") | `text-app-accent` |
| `ExamModal` `#2f3545`/`#1f2430` (bottone Salva) | `bg-app-accent` / `bg-app-accent-hover` |
| `ExamModal` `#e7c3bd` (border Elimina) / `#c0392b` (testo) / `#fdf1ef` (hover bg) | nuovo `--color-app-danger-*` |
| `ImportModal` `#eef0f3` (bg `<code>`) | `bg-app-soft` |
| `ImportModal` `#d6d9e0` (border) | `border-app-input-border` |
| `ImportModal` `#2f3545`/`#1f2430` (bottone Importa) | `bg-app-accent`/`bg-app-accent-hover` |
| `ImportModal` `#f4f5f7` (hover Annulla) | `bg-app-hover` |

#### Nuovi token in `src/index.css`

Light theme (`@theme`):

```css
--color-app-danger: #c0392b;
--color-app-danger-soft: rgba(192, 57, 43, 0.10);
--color-app-danger-fg: #c0392b;
--color-app-focus-ring: rgba(70, 130, 240, 0.35);
```

Dark theme (`.dark`):

```css
--color-app-danger: #ff6b5a;
--color-app-danger-soft: rgba(255, 107, 90, 0.15);
--color-app-danger-fg: #ff8b7d;
--color-app-focus-ring: rgba(70, 130, 240, 0.55);
```

Nota: i nomi `--color-app-danger*` diventano automaticamente classi Tailwind utility (`bg-app-danger-soft`, `text-app-danger-fg`, `border-app-danger`, ecc.) grazie al `@theme` block esistente.

#### Estensione di `.glass-input` (in `@layer components`)

Oggi `.glass-input` definisce solo background/border/color/placeholder. Estendo con i parametri di shape/focus per uniformare tutti i campi:

```css
.glass-input {
  background: var(--color-app-input-bg);
  border: 1px solid var(--color-app-input-border);
  color: var(--color-app-fg);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.glass-input:focus {
  outline: none;
  border-color: var(--color-app-accent);
  box-shadow: 0 0 0 3px var(--color-app-focus-ring);
}
```

Tutti gli input/textarea/select nei modali useranno `.glass-input`.

---

### C) Bottoni unificati

Estraggo un componente leggero in `src/components/ModalButton.tsx` (o utility classes equivalenti se preferito in fase di plan) con tre varianti:

```tsx
interface ModalButtonProps {
  variant: "primary" | "secondary" | "danger";
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  children: ReactNode;
}
```

| variant | Classi |
|---------|--------|
| `primary` | `bg-app-accent text-app-accent-fg border-app-accent hover:bg-app-accent-hover` |
| `secondary` | `bg-app-card text-app-fg border-app-input-border hover:bg-app-hover` |
| `danger` | `bg-app-danger-soft text-app-danger-fg border-transparent hover:bg-app-danger/20` |

Tutte: `inline-flex items-center justify-content-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-semibold border transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/40 disabled:opacity-50 disabled:cursor-not-allowed`.

Un quarto stile minore (`btn-link`) per "Aggiungi data" resta una semplice classe utility: `text-[12px] font-semibold text-app-accent hover:underline inline-flex items-center gap-1 bg-transparent border-none p-0`.

---

### D) Sezioni del body

Nuova classe utility o sub-componente `<Section>` per dare ai blocchi di form una gerarchia visiva senza incartarli in card pesanti. Tra una sezione e la successiva: hairline + spacing.

Markup di riferimento:

```tsx
<div className="flex flex-col gap-2 pt-4 mt-4 border-t border-app-border first:pt-0 first:mt-0 first:border-t-0">
  <div className="text-[11.5px] font-semibold text-app-muted">Nome esame</div>
  <input className="glass-input" ... />
</div>
```

Note:

- Label: case normale (non più UPPERCASE), `font-semibold` invece di `font-bold`, no `tracking-wide`, no `uppercase`. Risultato: meno aggressivo, più leggibile.
- Le sezioni non si racchiudono in card per evitare il "nested glass". Il glass è sul modal esterno; dentro è flat.

---

### E) Modifiche per-modal

#### `Modal.tsx` (wrapper)

Riscritto per implementare A (struttura + props nuove). Backward compat: i call site esistenti che non passano `icon`/`accent`/`size`/`footer` continuano a funzionare con default. **Tuttavia**, tutti i call site verranno aggiornati a passare almeno `footer` (per spostare i bottoni dentro la nuova zona sticky), quindi la backward compat è transitoria.

#### `DayModal.tsx`

- `size="md"`, `icon={Calendar}`, `accent` lasciato default (no colore esame: questo modale non è legato a un singolo esame).
- Banner info appelli/progetti: rimane ma trasformato in `.info-banner` con border-radius 10px e padding più generoso.
- Lista "Sto studiando per…":
  - Ogni riga è una "study-row" con stripe colorato a sinistra (3px, colore esame) — analoga a `.exam-row-redesign` della sidebar per coerenza visiva.
  - Padding `8px 12px 8px 16px` (offset per la stripe).
  - Background `bg-app-soft`, border `border-app-border`, border-radius 8px.
- Footer: un solo bottone "Chiudi" (primary), allineato a destra.

#### `ExamModal.tsx`

- `size="lg"`, `icon={editing ? Pencil : Plus}`, `accent={color}` — la accent bar si aggiorna in tempo reale quando l'utente cambia colore (anteprima visiva istantanea).
- Sezione "Nome esame", "Colore", "Tempo di studio giornaliero", "Date d'esame / Periodi" — ciascuna in un blocco con label normal-case.
- Swatch colore: 30×30, gap 8px. Selected = border `border-app-fg` 2px + box-shadow inset 2px `var(--color-app-card)`.
- Entries date: ciascuna riga è una `.entry-row` (`bg-app-soft`, `border-app-border`, `rounded-lg`, padding `8px 10px`). Mantiene la checkbox "Periodo" + input(s) + remove button.
- Footer: `[Elimina]` (danger, solo se editing) — spacer — `[Annulla]` (secondary) — `[Salva]` (primary).
- Note: si aggiunge un bottone "Annulla" (oggi non c'è — c'è solo X e Salva). Equivale a `onClose()`.

#### `SettingsModal.tsx`

- `size="sm"`, `icon={Settings}`, `accent` default.
- Sezione "Tema": due `.theme-card` (Chiaro / Scuro) come oggi ma con padding maggiore (18×12), icona 22px, border-radius 10px. Selected = `bg-app-accent text-app-accent-fg`.
- Sezione "Profilo utente": testo `.help-text` (mantenuto invariato).
- Footer: `[Fatto]` (primary), allineato a destra.

#### `ImportModal.tsx`

- `size="xl"`, `icon={Download}`, `accent` default.
- Help text inline (paragrafo iniziale) con `<code>` su `bg-app-soft`.
- Textarea: `.glass-input` con `font-mono`, rows 9.
- Footer: `[Annulla]` (secondary) — `[Importa]` (primary, disabled durante busy).

---

### F) Animazioni e a11y

- `fade-in` su `.modal-panel` (180ms).
- Backdrop: `transition: opacity 150ms ease` sul container backdrop.
- Bottoni: `transition: background 150ms`, `active:scale-[0.98]`.
- `:focus-visible` ring di 3px `var(--color-app-focus-ring)` su input e bottoni.
- `prefers-reduced-motion: reduce` → disabilita scale e fade (estendo `@media` esistente).

---

## File toccati

| File | Tipo |
|------|------|
| `src/index.css` | Modify (nuovi token danger + focus-ring, estensione `.glass-input`) |
| `src/components/Modal.tsx` | Rewrite (nuova struttura + props) |
| `src/components/ModalButton.tsx` | New (componente bottoni) |
| `src/components/DayModal.tsx` | Modify (usa nuove props + classi + study-row stripe) |
| `src/components/ExamModal.tsx` | Modify (cleanup hardcoded, usa nuove props + entry-row + bottone Annulla) |
| `src/components/SettingsModal.tsx` | Modify (usa nuove props + footer slot) |
| `src/components/ImportModal.tsx` | Modify (cleanup hardcoded, usa nuove props + footer slot) |
| `.gitignore` | Modify (aggiungere `.superpowers/` se non presente) |

Nessuna modifica a `state.ts`, `db.ts`, `types.ts`, `progetto.ts`, `study-time.ts`, `theme.ts`, `toast.ts`.

---

## Acceptance criteria

1. Tutti e 5 i modali rispondono correttamente al toggle light/dark senza superfici grigio-chiaro residue.
2. `ExamModal` con 6+ entries: l'header con titolo + close e il footer con Salva/Annulla/Elimina restano visibili senza scroll della finestra del modal; scrolla solo il body interno.
3. Cambiando colore nell'`ExamModal`, la accent bar superiore si aggiorna immediatamente.
4. Tutti i bottoni nei modali appartengono a una delle tre varianti `primary` / `secondary` / `danger`, con stati `:hover`, `:focus-visible`, `:disabled` consistenti.
5. Nessun colore hex hardcoded resta nei 5 file modale per superfici/border/testo, **eccetto** la costante `PALETTE` in `ExamModal.tsx` (è la design palette esami, deve restare hardcoded e allineata a `--color-exam-*` in `index.css`). Tutto il resto deve usare token theme-aware.
6. Larghezza dei modali rispetta il mapping size (sm 360 / md 420 / lg 480 / xl 520).
7. `prefers-reduced-motion: reduce` disabilita le animazioni di scale/fade.
8. La build TypeScript passa (`npm run build` o equivalente) senza nuovi errori.

## Non-criteria (esplicitamente non richiesti)

- Focus trap interno al modal
- Animazione di uscita (slide/fade-out) sul close — la chiusura resta istantanea
- Routing/URL persistence per i modali aperti
- Test E2E (gli unit/integration test attuali, se presenti, devono continuare a passare; non si aggiungono nuovi test in questo lavoro)

---

## Open questions

Nessuna — design approvato in sessione di brainstorming il 2026-05-17.
