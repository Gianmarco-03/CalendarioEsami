# Popup Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ridisegnare i 5 modali (`Modal`, `DayModal`, `ExamModal`, `SettingsModal`, `ImportModal`) con struttura header/body-scrollabile/footer-sticky, accent bar superiore, larghezza adattiva, e cleanup completo dei colori hardcoded a token theme-aware.

**Architecture:** Estendo il wrapper `Modal` con 4 nuove prop opzionali (`icon`, `accent`, `size`, `footer`) per controllare struttura e dimensione. Estraggo un componente `ModalButton` con 3 varianti unificate. Aggiungo token CSS `--color-app-danger-*` e `--color-app-focus-ring` (light + dark). Ogni modale figlio è poi migrato a usare le nuove prop e i token.

**Tech Stack:** React 19 + TypeScript 5.8 + Vite 7 + Tailwind CSS 4 + lucide-react (per le icone). Niente test suite nel progetto — la validazione è `npm run build` (typecheck + bundle) + smoke test visivo via `npm run dev`.

**Spec di riferimento:** `docs/superpowers/specs/2026-05-17-popup-restyle-design.md`

---

## File Structure

| File | Action | Responsabilità |
|------|--------|----------------|
| `src/index.css` | Modify | Aggiungere 4 nuovi token (`danger`, `danger-soft`, `danger-fg`, `focus-ring`) in `@theme` e `.dark`. Estendere `.glass-input` con shape + focus ring. |
| `src/components/ModalButton.tsx` | **New** | Componente bottone con 3 varianti `primary` / `secondary` / `danger`. |
| `src/components/Modal.tsx` | Rewrite | Wrapper con nuove prop `icon`, `accent`, `size`, `footer`. Tre zone: accent bar + header + body scrollabile + footer sticky. |
| `src/components/SettingsModal.tsx` | Modify | Migrare alla nuova API Modal. Footer con "Fatto" via slot. |
| `src/components/ImportModal.tsx` | Modify | Cleanup hex hardcoded. Migrare alla nuova API. Footer con Annulla/Importa. |
| `src/components/DayModal.tsx` | Modify | Migrare alla nuova API. Study-row con stripe colore esame a sinistra. Footer con "Chiudi". |
| `src/components/ExamModal.tsx` | Modify | Cleanup hex hardcoded (eccetto `PALETTE`). Migrare alla nuova API con `accent={color}` live. Entries come `.entry-row`. Footer con Elimina (left) / Annulla / Salva. |

Ordine d'implementazione: foundation prima (CSS + ModalButton + Modal), poi migrazione modali dal più semplice (`SettingsModal`) al più complesso (`ExamModal`). Ogni modale è committato singolarmente.

---

### Task 1: Aggiungere i nuovi token CSS

**Files:**
- Modify: `src/index.css:5-53` (blocco `@theme`)
- Modify: `src/index.css:55-78` (blocco `.dark`)
- Modify: `src/index.css:97-104` (blocco `.glass-input`)

- [ ] **Step 1: Aggiungere token danger e focus-ring al blocco `@theme` (light)**

Apri `src/index.css`. Dopo la riga `--color-app-accent-hover: #0e1730;` (riga 26), inserisci prima del commento `/* Ambient layer (Aurora) */`:

```css
  /* Danger (delete actions) */
  --color-app-danger: #c0392b;
  --color-app-danger-soft: rgba(192, 57, 43, 0.10);
  --color-app-danger-fg: #c0392b;

  /* Focus ring (input + buttons) */
  --color-app-focus-ring: rgba(70, 130, 240, 0.35);

```

- [ ] **Step 2: Aggiungere gli stessi token al blocco `.dark`**

Apri `src/index.css`. Dopo la riga `--color-app-accent-hover: #ffffff;` nel blocco `.dark` (riga 72), inserisci prima della riga `--aurora-1`:

```css

  --color-app-danger: #ff6b5a;
  --color-app-danger-soft: rgba(255, 107, 90, 0.15);
  --color-app-danger-fg: #ff8b7d;

  --color-app-focus-ring: rgba(70, 130, 240, 0.55);

```

- [ ] **Step 3: Estendere `.glass-input` con shape + focus**

Apri `src/index.css`. Sostituisci l'intero blocco `.glass-input` esistente (righe ~97-104) con:

```css
  .glass-input {
    background: var(--color-app-input-bg);
    border: 1px solid var(--color-app-input-border);
    color: var(--color-app-fg);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
    font-family: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .glass-input::placeholder {
    color: var(--color-app-muted);
  }
  .glass-input:focus {
    outline: none;
    border-color: var(--color-app-accent);
    box-shadow: 0 0 0 3px var(--color-app-focus-ring);
  }
```

- [ ] **Step 4: Verifica build typescript + bundle**

Run: `npm run build`
Expected: build passes senza errori. Tailwind genererà le utility `bg-app-danger`, `bg-app-danger-soft`, `text-app-danger-fg`, `border-app-danger`, `outline-app-focus-ring` automaticamente grazie al `@theme` block.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "feat(theme): add danger + focus-ring tokens, extend .glass-input"
```

---

### Task 2: Creare il componente `ModalButton`

**Files:**
- Create: `src/components/ModalButton.tsx`

- [ ] **Step 1: Scrivere il componente**

Crea il file `src/components/ModalButton.tsx` con questo contenuto:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger";

interface ModalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: Variant;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-app-accent text-app-accent-fg border-app-accent hover:bg-app-accent-hover",
  secondary:
    "bg-app-card text-app-fg border-app-input-border hover:bg-app-hover",
  danger:
    "bg-app-danger-soft text-app-danger-fg border-transparent hover:bg-app-danger/20",
};

const BASE =
  "inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg " +
  "text-[12.5px] font-semibold border transition-colors active:scale-[0.98] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus-ring " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export function ModalButton({
  variant,
  className,
  children,
  type = "button",
  ...rest
}: ModalButtonProps) {
  const cls = [BASE, VARIANT_CLASSES[variant], className].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Verifica build**

Run: `npm run build`
Expected: passa. Il componente non è ancora usato — niente errori "unused" perché esportato.

- [ ] **Step 3: Commit**

```bash
git add src/components/ModalButton.tsx
git commit -m "feat(ui): add ModalButton with primary/secondary/danger variants"
```

---

### Task 3: Rewrite del wrapper `Modal`

**Files:**
- Rewrite: `src/components/Modal.tsx`

- [ ] **Step 1: Riscrivere `Modal.tsx`**

Sostituisci l'intero contenuto di `src/components/Modal.tsx` con:

```tsx
import { useEffect, type ReactNode, type ComponentType } from "react";
import { X } from "lucide-react";

type Size = "sm" | "md" | "lg" | "xl";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  icon?: ComponentType<{ size?: number; className?: string }>;
  accent?: string;
  size?: Size;
  footer?: ReactNode;
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: "max-w-[360px]",
  md: "max-w-[420px]",
  lg: "max-w-[480px]",
  xl: "max-w-[520px]",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  icon: Icon,
  accent,
  size = "md",
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const accentColor = accent ?? "var(--color-app-accent)";

  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 backdrop-blur-md flex items-center justify-center p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={
          "text-app-fg rounded-2xl w-full max-h-[88vh] overflow-hidden " +
          "shadow-2xl glass-panel flex flex-col " +
          SIZE_CLASSES[size]
        }
        style={{ animation: "fade-in 180ms ease-out" }}
      >
        {/* Accent bar */}
        <div
          className="h-[4px] w-full shrink-0"
          style={{ background: accentColor, transition: "background-color 200ms" }}
        />

        {/* Header */}
        <div className="flex items-center gap-2.5 px-[18px] pt-3.5 pb-3 border-b border-app-border shrink-0">
          {Icon && (
            <Icon
              size={18}
              className="shrink-0"
            />
          )}
          <h3 className="text-[14.5px] font-bold leading-snug m-0 flex-1 min-w-0 truncate">
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="text-app-muted p-1 rounded hover:bg-app-hover hover:text-app-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus-ring"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body scrollabile */}
        <div className="px-[18px] py-[18px] overflow-y-auto flex-1 min-h-0 flex flex-col gap-4">
          {children}
        </div>

        {/* Footer sticky (opzionale) */}
        {footer && (
          <div className="flex items-center gap-2 px-[18px] py-3 border-t border-app-border shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
```

Nota tecnica: il colore icona nell'header NON usa `accentColor` per evitare l'effetto "icona invisibile" quando l'accent coincide col background. Resta `text-app-fg` di default.

- [ ] **Step 2: Verifica build**

Run: `npm run build`
Expected: passa. I 4 call site esistenti (`DayModal`, `ExamModal`, `SettingsModal`, `ImportModal`) chiamano `<Modal open onClose title>...</Modal>` senza passare `icon`/`accent`/`size`/`footer` — tutte opzionali, defaults sicuri. Build verde.

- [ ] **Step 3: Smoke test visivo**

Run: `npm run dev` (lascia girare). Apri il browser sull'URL Vite (es. `http://localhost:1420`).

Manualmente: apri ciascuno dei 4 modali (sidebar → Settings, Import, click su un giorno, click su un esame). Verifica che:
- Si aprano correttamente
- Si chiudano con Escape e click su backdrop
- Mostrino accent bar di 4px col colore `app-accent` di default
- Mostrino il divider sotto l'header

Se i bottoni "Salva/Elimina/Fatto/Importa" che oggi sono dentro il body appaiono ancora dentro lo scroll (perché non sono ancora migrati al footer), è OK — verrà sistemato nei task successivi.

Ferma `npm run dev` con `Ctrl+C` quando hai finito di guardare.

- [ ] **Step 4: Commit**

```bash
git add src/components/Modal.tsx
git commit -m "feat(ui): redesign Modal wrapper with accent bar, icon, size, footer slot"
```

---

### Task 4: Migrare `SettingsModal`

**Files:**
- Modify: `src/components/SettingsModal.tsx`

- [ ] **Step 1: Riscrivere `SettingsModal.tsx`**

Sostituisci l'intero contenuto di `src/components/SettingsModal.tsx` con:

```tsx
import { Modal } from "./Modal";
import { ModalButton } from "./ModalButton";
import { useTheme } from "../theme";
import { Sun, Moon, Settings as SettingsIcon } from "lucide-react";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();

  const footer = (
    <>
      <div className="flex-1" />
      <ModalButton variant="primary" onClick={onClose}>Fatto</ModalButton>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Impostazioni"
      icon={SettingsIcon}
      size="sm"
      footer={footer}
    >
      <div className="flex flex-col gap-2">
        <div className="text-[11.5px] font-semibold text-app-muted">Tema</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={
              "flex flex-col items-center justify-center gap-2 px-3 py-[18px] " +
              "rounded-[10px] text-[12.5px] font-semibold border transition-colors " +
              (theme === "light"
                ? "bg-app-accent text-app-accent-fg border-app-accent"
                : "bg-app-card text-app-fg border-app-input-border hover:bg-app-hover")
            }
          >
            <Sun size={22} /> Chiaro
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={
              "flex flex-col items-center justify-center gap-2 px-3 py-[18px] " +
              "rounded-[10px] text-[12.5px] font-semibold border transition-colors " +
              (theme === "dark"
                ? "bg-app-accent text-app-accent-fg border-app-accent"
                : "bg-app-card text-app-fg border-app-input-border hover:bg-app-hover")
            }
          >
            <Moon size={22} /> Scuro
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-4 border-t border-app-border">
        <div className="text-[11.5px] font-semibold text-app-muted">Profilo utente</div>
        <p className="text-[12px] text-app-muted leading-relaxed m-0">
          In arrivo: nome, avatar, obiettivi di studio settimanali, sincronizzazione locale tra dispositivi.
        </p>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Verifica build**

Run: `npm run build`
Expected: passa senza errori.

- [ ] **Step 3: Smoke test visivo**

Run: `npm run dev`. Apri SettingsModal. Verifica:
- Larghezza ~360px
- Icon "Settings" a sinistra del titolo
- Due card tema (chiaro/scuro) con icona grande
- Toggle tema funzionante (cambia tema effettivamente)
- "Fatto" nel footer sticky in basso a destra
- In dark mode: tutto leggibile, nessuna superficie grigio-chiaro fuori contesto

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsModal.tsx
git commit -m "refactor(fe): SettingsModal uses new Modal API + sticky footer"
```

---

### Task 5: Migrare `ImportModal`

**Files:**
- Modify: `src/components/ImportModal.tsx`

- [ ] **Step 1: Riscrivere `ImportModal.tsx`**

Sostituisci l'intero contenuto di `src/components/ImportModal.tsx` con:

```tsx
import { useState } from "react";
import { importArtifactJson } from "../db";
import { useExams } from "../state";
import { useToast } from "../toast";
import { Modal } from "./Modal";
import { ModalButton } from "./ModalButton";
import { Download } from "lucide-react";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportModal({ open, onClose }: ImportModalProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { refetch } = useExams();
  const toast = useToast();

  const handleImport = async () => {
    if (!text.trim()) { toast.error("Incolla il JSON dell'artifact"); return; }
    setBusy(true);
    try {
      const report = await importArtifactJson(text);
      toast.success(`Importati ${report.inserted}, saltati ${report.skipped}`);
      if (report.errors.length > 0) {
        for (const err of report.errors.slice(0, 5)) toast.info(err);
      }
      await refetch();
      onClose();
      setText("");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <>
      <div className="flex-1" />
      <ModalButton variant="secondary" onClick={onClose}>Annulla</ModalButton>
      <ModalButton variant="primary" disabled={busy} onClick={handleImport}>
        {busy ? "Importazione…" : "Importa"}
      </ModalButton>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importa da artifact"
      icon={Download}
      size="xl"
      footer={footer}
    >
      <p className="text-[11.5px] text-app-muted leading-relaxed m-0">
        Incolla il valore di{" "}
        <code className="bg-app-soft rounded px-1 py-[1px] text-[10.5px]">appelliStudio_v1</code>{" "}
        dal localStorage dell'artifact HTML. Le voci con nome già presente verranno saltate.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{"exams":[…]}'
        rows={9}
        className="glass-input font-mono resize-y"
      />
    </Modal>
  );
}
```

- [ ] **Step 2: Verifica build**

Run: `npm run build`
Expected: passa senza errori.

- [ ] **Step 3: Smoke test visivo**

Run: `npm run dev`. Apri ImportModal (sidebar → bottone Import). Verifica:
- Larghezza ~520px (più largo)
- Icon "Download" a sinistra del titolo
- Help text con `<code>` su background `app-soft`
- Textarea con font monospace
- Footer sticky con [Annulla] [Importa] a destra
- Bottone Importa disabilitato durante busy (incolla un JSON vuoto e prova)
- In dark mode: textarea, code, bordi tutti coerenti col tema

- [ ] **Step 4: Commit**

```bash
git add src/components/ImportModal.tsx
git commit -m "refactor(fe): ImportModal cleanup hardcoded colors + new Modal API"
```

---

### Task 6: Migrare `DayModal`

**Files:**
- Modify: `src/components/DayModal.tsx`

- [ ] **Step 1: Riscrivere `DayModal.tsx`**

Sostituisci l'intero contenuto di `src/components/DayModal.tsx` con:

```tsx
import { useExams } from "../state";
import { inRange, parseYmd } from "../date";
import { Modal } from "./Modal";
import { ModalButton } from "./ModalButton";
import { Clock, Calendar } from "lucide-react";
import { effectiveMinutes, countPresences } from "../study-time";
import { isProgetto } from "../progetto";

interface DayModalProps {
  open: boolean;
  dayKey: string | null;
  onClose: () => void;
}

export function DayModal({ open, dayKey, onClose }: DayModalProps) {
  const { exams, toggleStudyDay, setStudyDayMinutes } = useExams();
  if (!dayKey) return null;

  const date = parseYmd(dayKey);
  const titleRaw = date.toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const title = titleRaw.charAt(0).toUpperCase() + titleRaw.slice(1);

  const active = exams.filter((e) => !e.passed);
  const infoLines: { color: string; text: string }[] = [];
  for (const e of active) {
    for (const a of e.appelli) {
      if (a.date === dayKey) infoLines.push({ color: e.color, text: `Appello: ${e.name}` });
    }
    if (isProgetto(e)) {
      if (e.ranges.some((r) => inRange(dayKey, r.start, r.end))) {
        infoLines.push({ color: e.color, text: `Progetto in corso: ${e.name}` });
      }
    }
  }

  const studyTargets = active;

  const footer = (
    <>
      <div className="flex-1" />
      <ModalButton variant="primary" onClick={onClose}>Chiudi</ModalButton>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={Calendar}
      size="md"
      footer={footer}
    >
      {infoLines.length > 0 && (
        <div className="bg-app-soft border border-app-border rounded-[10px] px-3 py-2.5 flex flex-col gap-1.5">
          {infoLines.map((ln, i) => (
            <div key={i} className="text-[12px] font-semibold text-app-fg flex items-center gap-2">
              <span className="w-[10px] h-[10px] rounded-full shrink-0" style={{ background: ln.color }} />
              {ln.text}
            </div>
          ))}
        </div>
      )}

      {studyTargets.length === 0 ? (
        <div className="text-[12px] text-app-muted py-1.5">
          {infoLines.length > 0
            ? "Nessun esame per cui segnare lo studio."
            : "Nessun esame attivo. Aggiungine uno dalla barra laterale."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="text-[11.5px] font-semibold text-app-muted">
            Sto studiando per…
          </div>
          {studyTargets.map((e) => {
            const studyEntry = e.studyDays.find((s) => s.date === dayKey);
            const studying = !!studyEntry;
            const computed = effectiveMinutes(e, dayKey, active);
            const t = e.defaultStudyMinutes;
            const n = countPresences(dayKey, active);
            const isOverride = studyEntry?.minutes != null;
            return (
              <div
                key={e.id}
                className="relative flex items-center gap-2 pl-4 pr-3 py-2 border border-app-border rounded-lg bg-app-soft overflow-hidden"
              >
                <span
                  className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{ background: e.color }}
                />
                <span className="flex-1 text-[13px] font-semibold text-app-fg truncate">{e.name}</span>

                {studying && (
                  <div className="flex items-center gap-1 text-app-muted">
                    <Clock size={12} />
                    <input
                      type="number"
                      min={0}
                      max={1440}
                      step={5}
                      placeholder={String(computed)}
                      value={studyEntry.minutes ?? ""}
                      onChange={(ev) => {
                        const raw = ev.target.value;
                        const m = raw === "" ? null : Math.max(0, Math.min(1440, parseInt(raw, 10) || 0));
                        void setStudyDayMinutes(e.id, dayKey, m);
                      }}
                      className="w-14 glass-input !py-1 !px-1.5 !text-[12px]"
                      aria-label={`Minuti di studio per ${e.name}`}
                      title={
                        isOverride
                          ? `Manuale (formula: ${computed}m = ${t}/${n})`
                          : `Auto (${computed}m = ${t}/${n}). Modifica per override.`
                      }
                    />
                    <span className="text-[9.5px] whitespace-nowrap">
                      {isOverride ? "manuale" : `auto ${computed}m`}
                    </span>
                  </div>
                )}

                <input
                  type="checkbox"
                  checked={studying}
                  onChange={() => void toggleStudyDay(e.id, dayKey)}
                  className="w-[17px] h-[17px] cursor-pointer shrink-0"
                  aria-label={`Studio per ${e.name}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
```

Nota: `!py-1 !px-1.5 !text-[12px]` usa l'`!important` di Tailwind per override delle utility più ampie di `.glass-input`. Necessario per il campo "minuti" che è più piccolo dei input standard.

- [ ] **Step 2: Verifica build**

Run: `npm run build`
Expected: passa senza errori.

- [ ] **Step 3: Smoke test visivo**

Run: `npm run dev`. Click su una cella del calendario con almeno un esame attivo. Verifica:
- Larghezza ~420px
- Icon "Calendar" a sinistra della data
- Info banner (se presente: appelli/progetti) con dot colorati
- Lista "Sto studiando per…" — ogni riga con stripe di 3px sul bordo sinistro col colore dell'esame
- Toggle studio funziona (la check riempie/svuota il giorno)
- Input minuti (quando studying = true) tema-aware, sottile, con auto/manuale
- Footer sticky "Chiudi" a destra
- Dark mode: tutto coerente

- [ ] **Step 4: Commit**

```bash
git add src/components/DayModal.tsx
git commit -m "refactor(fe): DayModal uses new Modal API + study-row stripe"
```

---

### Task 7: Migrare `ExamModal`

**Files:**
- Modify: `src/components/ExamModal.tsx`

- [ ] **Step 1: Riscrivere `ExamModal.tsx`**

Sostituisci l'intero contenuto di `src/components/ExamModal.tsx` con:

```tsx
import { useEffect, useState } from "react";
import type { Exam, ExamKind, ExamInput, EsameInputData, ProgettoInputData } from "../types";
import { useExams } from "../state";
import { useToast } from "../toast";
import { Modal } from "./Modal";
import { ModalButton } from "./ModalButton";
import { X as XIcon, Plus, Pencil } from "lucide-react";
import { durationOptions } from "../study-time";
import { isProgetto } from "../progetto";

const PALETTE = [
  "#E8543F", "#2E86C1", "#27AE60", "#8E44AD", "#F39C12", "#16A0A0",
  "#D81B7A", "#5D6D7E", "#C0392B", "#1F8A4C", "#7D5FFF", "#E67E22",
];

interface ExamModalProps {
  open: boolean;
  onClose: () => void;
  editing: Exam | null;
  initialKind: ExamKind;
}

type Entry =
  | { uid: string; type: "appello"; date: string }
  | { uid: string; type: "range"; start: string; end: string };

function newUid(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function ExamModal({ open, onClose, editing, initialKind }: ExamModalProps) {
  const { create, update, remove, exams } = useExams();
  const toast = useToast();

  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [defaultMinutes, setDefaultMinutes] = useState<number>(60);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setColor(editing.color);
      setDefaultMinutes(editing.defaultStudyMinutes);
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
    } else {
      setName("");
      const used = new Set(exams.map((e) => e.color));
      setColor(PALETTE.find((c) => !used.has(c)) ?? PALETTE[exams.length % PALETTE.length]);
      setDefaultMinutes(60);
      if (initialKind === "progetto") {
        setEntries([{ uid: newUid(), type: "range", start: "", end: "" }]);
      } else {
        setEntries([{ uid: newUid(), type: "appello", date: "" }]);
      }
    }
  }, [open, editing, initialKind, exams]);

  if (!open) return null;

  const derivedKind: ExamKind = entries.some((e) => e.type === "range") ? "progetto" : "esame";
  const isProj = derivedKind === "progetto";
  const title = editing
    ? (isProj ? "Modifica progetto" : "Modifica esame")
    : (isProj ? "Nuovo progetto" : "Nuovo esame");

  const toggleEntryType = (uid: string) => {
    setEntries((prev) => prev.map((e) => {
      if (e.uid !== uid) return e;
      if (e.type === "appello") {
        return { uid, type: "range", start: e.date, end: "" };
      } else {
        return { uid, type: "appello", date: e.start };
      }
    }));
  };

  const updateEntry = (uid: string, patch: Partial<Omit<Entry, "uid" | "type">>) => {
    setEntries((prev) => prev.map((e) => (e.uid === uid ? { ...e, ...patch } as Entry : e)));
  };

  const removeEntry = (uid: string) => {
    setEntries((prev) => prev.filter((e) => e.uid !== uid));
  };

  const addAppello = () => {
    setEntries((prev) => [...prev, { uid: newUid(), type: "appello", date: "" }]);
  };

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

    const baseInput: EsameInputData = {
      name: trimmed,
      color,
      passed: editing?.passed ?? false,
      defaultStudyMinutes: defaultMinutes,
      appelli: cleanAppelli,
    };

    let input: ExamInput;
    if (kind === "progetto") {
      const projInput: ProgettoInputData = { ...baseInput, ranges: cleanRanges };
      input = { kind: "progetto", ...projInput };
    } else {
      input = { kind: "esame", ...baseInput };
    }

    const result = editing
      ? await update(editing.id, input)
      : await create(input);
    if (result) {
      toast.success(editing ? "Modifiche salvate" : "Aggiunto");
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (confirm(`Eliminare "${editing.name}"?`)) {
      if (await remove(editing.id)) {
        toast.success("Eliminato");
        onClose();
      }
    }
  };

  const footer = (
    <>
      {editing && (
        <ModalButton variant="danger" onClick={handleDelete}>Elimina</ModalButton>
      )}
      <div className="flex-1" />
      <ModalButton variant="secondary" onClick={onClose}>Annulla</ModalButton>
      <ModalButton variant="primary" onClick={handleSave}>Salva</ModalButton>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={editing ? Pencil : Plus}
      accent={color}
      size="lg"
      footer={footer}
    >
      <div className="flex flex-col gap-2">
        <label className="text-[11.5px] font-semibold text-app-muted">
          {isProj ? "Nome progetto" : "Nome esame"}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isProj ? "es. Tesina di Fisiologia" : "es. Neuroanatomia"}
          autoFocus
          className="glass-input"
        />
      </div>

      <div className="flex flex-col gap-2 pt-4 border-t border-app-border">
        <label className="text-[11.5px] font-semibold text-app-muted">Colore</label>
        <div className="flex flex-wrap gap-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={
                "w-[30px] h-[30px] rounded-lg cursor-pointer border-2 transition-transform hover:scale-110 " +
                (color === c
                  ? "border-app-fg shadow-[inset_0_0_0_2px_var(--color-app-card)]"
                  : "border-transparent")
              }
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-4 border-t border-app-border">
        <label className="text-[11.5px] font-semibold text-app-muted">
          Tempo di studio giornaliero
        </label>
        <select
          value={defaultMinutes}
          onChange={(e) => setDefaultMinutes(parseInt(e.target.value, 10))}
          className="glass-input"
        >
          {durationOptions().map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <p className="text-[10.5px] text-app-muted leading-relaxed m-0">
          I minuti effettivi sono{" "}
          <code className="bg-app-soft rounded px-1 py-[1px] text-[10px]">t/n</code>, dove{" "}
          <code className="bg-app-soft rounded px-1 py-[1px] text-[10px]">n</code> è il numero di esami
          attivi (esami in studio + progetti in corso) quel giorno.
        </p>
      </div>

      <div className="flex flex-col gap-2 pt-4 border-t border-app-border">
        <label className="text-[11.5px] font-semibold text-app-muted">
          Date d'esame / Periodi
        </label>
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <div
              key={entry.uid}
              className="flex items-center gap-2 px-2.5 py-2 bg-app-soft border border-app-border rounded-lg"
            >
              <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-app-muted shrink-0">
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
                  className="flex-1 glass-input !py-1.5 !px-2 !text-[12.5px]"
                />
              ) : (
                <>
                  <input
                    type="date"
                    value={entry.start}
                    onChange={(ev) => updateEntry(entry.uid, { start: ev.target.value })}
                    className="flex-1 min-w-0 glass-input !py-1.5 !px-2 !text-[12.5px]"
                  />
                  <span className="text-[10px] text-app-muted shrink-0">→</span>
                  <input
                    type="date"
                    value={entry.end}
                    onChange={(ev) => updateEntry(entry.uid, { end: ev.target.value })}
                    className="flex-1 min-w-0 glass-input !py-1.5 !px-2 !text-[12.5px]"
                  />
                </>
              )}
              <button
                type="button"
                onClick={() => removeEntry(entry.uid)}
                className="p-1 rounded text-app-muted hover:bg-app-hover hover:text-app-fg"
                title="Rimuovi"
                aria-label="Rimuovi"
              ><XIcon size={14} /></button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addAppello}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-app-accent hover:underline bg-transparent border-none p-0 self-start mt-1"
        ><Plus size={12} /> Aggiungi data</button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Verifica build**

Run: `npm run build`
Expected: passa senza errori.

- [ ] **Step 3: Smoke test visivo**

Run: `npm run dev`. Crea un nuovo esame dalla sidebar. Poi modificane uno esistente. Verifica:
- Larghezza ~480px
- Accent bar in alto col **colore dell'esame** scelto — cambia in tempo reale cliccando un'altra swatch
- Icon Plus (nuovo) o Pencil (modifica) a sinistra del titolo
- 4 sezioni separate da hairline: Nome, Colore (12 swatch 30px), Tempo studio, Date/Periodi
- Swatch selezionata: bordo `app-fg` + shadow inset bianco/card
- Entries date come mini-card su `bg-app-soft`
- Toggle "Periodo" trasforma in range con freccia →
- "+ Aggiungi data" come link accent
- Footer: [Elimina] (solo in edit, danger color) a sinistra; [Annulla][Salva] a destra
- Salva → toast + chiusura
- Elimina → confirm browser + toast + chiusura
- Dark mode: tutto coerente, niente colori grigio-chiaro fuori contesto

- [ ] **Step 4: Commit**

```bash
git add src/components/ExamModal.tsx
git commit -m "refactor(fe): ExamModal cleanup hardcoded + live accent + Annulla button"
```

---

### Task 8: Verifica finale acceptance criteria

**Files:** nessuna modifica — solo validazione.

- [ ] **Step 1: Grep verifica nessun hex hardcoded residuo (eccetto PALETTE)**

Run (PowerShell):

```powershell
Select-String -Path "src\components\Modal.tsx","src\components\DayModal.tsx","src\components\SettingsModal.tsx","src\components\ImportModal.tsx","src\components\ModalButton.tsx" -Pattern '#[0-9a-fA-F]{3,6}'
```

Expected: **zero match** in questi 5 file.

Per `ExamModal.tsx` (che contiene `PALETTE` legittimamente):

```powershell
Select-String -Path "src\components\ExamModal.tsx" -Pattern '#[0-9a-fA-F]{3,6}' | Where-Object { $_.Line -notmatch 'PALETTE|//' }
```

Expected: zero match (i 12 hex devono apparire SOLO dentro la costante `PALETTE`).

- [ ] **Step 2: Build production**

Run: `npm run build`
Expected: typescript verde, vite bundle senza errori. Output in `dist/`.

- [ ] **Step 3: Smoke test completo**

Run: `npm run dev`. Sequenza:

1. Light mode: apri tutti e 4 i modali, verifica struttura (accent bar + header + body + footer), interagisci con almeno un controllo per modale.
2. Toggle dark mode via SettingsModal.
3. Riapri tutti i modali in dark: nessuna superficie grigio-chiaro inattesa, contrasti leggibili, accent bar visibile, focus ring visibile su input/bottoni.
4. ExamModal con molte date: aggiungi 8-10 entries. Header e footer rimangono visibili, scrolla solo il body interno.
5. ExamModal: cambia colore — l'accent bar superiore cambia istantaneamente.
6. Tutti i bottoni: hover, focus (Tab), click — feedback consistenti.
7. Premi Esc su ogni modale: si chiude.

Ferma `npm run dev` con `Ctrl+C`.

- [ ] **Step 4: Commit finale (se ci sono cleanup last-minute)**

Se durante gli smoke test sono emerse piccole regressioni e le hai sistemate, fai un commit:

```bash
git add -A
git commit -m "fix(fe): popup restyle smoke-test fixes"
```

Altrimenti, salta questo step.

---

## Notes for the executor

- **Niente test suite nel progetto.** La validazione è build + visual. Non aggiungere nuovi test in questo lavoro (out of scope nello spec).
- **Tailwind v4 con `@theme`:** i nuovi token in `index.css` diventano automaticamente utility (`bg-app-danger`, `text-app-danger-fg`, ecc.) — non serve `tailwind.config`.
- **`shadow-[inset_0_0_0_2px_var(--color-app-card)]`** è sintassi Tailwind v4 arbitrary value. Già usata altrove nel codebase.
- **`!py-1` (important):** usato dove `.glass-input` impone padding/font più grandi e serve un override locale. Pattern consolidato in Tailwind.
- **Backward compat di `Modal`:** durante l'esecuzione, tra Task 3 (rewrite Modal) e Task 7 (last modale migrato), i modali non ancora migrati avranno i bottoni dentro il body invece che nel footer. Visivamente strano ma funzionale — non rompe niente.
- **Cosa fare se la build fallisce su Tailwind utility non riconosciute** (es. `bg-app-danger-soft`): verifica che i token siano stati aggiunti nel blocco `@theme` (non solo `.dark`) — Tailwind genera le utility dai nomi in `@theme`.
