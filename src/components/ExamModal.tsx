import { useEffect, useState } from "react";
import type { Exam, ExamKind, ExamInput, EsameInputData, ProgettoInputData } from "../types";
import { useExams } from "../state";
import { useToast } from "../toast";
import { Modal } from "./Modal";
import { ModalButton } from "./ModalButton";
import { X as XIcon, Plus, Minus, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { isProgetto } from "../progetto";
import { formatHM } from "../study-time-format";
import { EXAM_ICONS, DEFAULT_ICON_SLUG, FEATURED_ICON_SLUGS } from "../exam-icons";

const STUDY_STEP_MIN = 15;
const STUDY_MAX_MIN = 720;

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
  const [icon, setIcon] = useState<string>(DEFAULT_ICON_SLUG);
  const [iconQuery, setIconQuery] = useState("");
  const [iconExpanded, setIconExpanded] = useState(false);
  const [defaultMinutes, setDefaultMinutes] = useState<number>(60);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setColor(editing.color);
      setIcon(editing.icon || DEFAULT_ICON_SLUG);
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
      setIcon(DEFAULT_ICON_SLUG);
      setDefaultMinutes(60);
      if (initialKind === "progetto") {
        setEntries([{ uid: newUid(), type: "range", start: "", end: "" }]);
      } else {
        setEntries([{ uid: newUid(), type: "appello", date: "" }]);
      }
    }
    setIconQuery("");
    // Expand picker se l'icona corrente non è tra le featured (così l'utente la vede subito).
    const currentIcon = editing?.icon || DEFAULT_ICON_SLUG;
    setIconExpanded(!FEATURED_ICON_SLUGS.has(currentIcon));
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
      icon,
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
        <div className="flex items-center justify-between gap-2">
          <label className="text-[11.5px] font-semibold text-app-muted">Icona</label>
          {(iconExpanded || iconQuery.trim()) && (
            <input
              type="text"
              value={iconQuery}
              onChange={(e) => setIconQuery(e.target.value)}
              placeholder="Cerca…"
              className="glass-input !py-1 !px-2 !text-[11.5px] max-w-[140px]"
            />
          )}
        </div>
        <div
          className={
            "flex flex-wrap gap-1.5 " +
            (iconExpanded || iconQuery.trim() ? "max-h-[180px] overflow-y-auto" : "")
          }
        >
          {(() => {
            const q = iconQuery.trim().toLowerCase();
            const showAll = iconExpanded || !!q;
            const pool = showAll
              ? EXAM_ICONS
              : EXAM_ICONS.filter((e) => FEATURED_ICON_SLUGS.has(e.slug));
            const filtered = q
              ? pool.filter(
                  (e) => e.label.toLowerCase().includes(q) || e.slug.includes(q),
                )
              : pool;
            if (filtered.length === 0) {
              return (
                <span className="text-[11.5px] text-app-muted py-1">
                  Nessuna icona trovata.
                </span>
              );
            }
            return filtered.map(({ slug, label, Icon }) => {
              const selected = icon === slug;
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => setIcon(slug)}
                  title={label}
                  aria-label={label}
                  aria-pressed={selected}
                  className={
                    "w-[32px] h-[32px] rounded-lg cursor-pointer border-2 transition-transform hover:scale-110 flex items-center justify-center bg-app-soft " +
                    (selected ? "border-app-fg" : "border-transparent")
                  }
                  style={selected ? { color, borderColor: color } : undefined}
                >
                  <Icon size={16} />
                </button>
              );
            });
          })()}
          {!iconQuery.trim() && (
            <button
              type="button"
              onClick={() => setIconExpanded((v) => !v)}
              aria-label={iconExpanded ? "Mostra meno" : "Mostra altre"}
              title={iconExpanded ? "Mostra meno" : "Mostra altre"}
              aria-expanded={iconExpanded}
              className="w-[32px] h-[32px] rounded-lg cursor-pointer border-2 border-transparent transition-transform hover:scale-110 flex items-center justify-center bg-app-soft text-app-muted hover:text-app-fg"
            >
              {iconExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-4 border-t border-app-border">
        <div className="flex items-center justify-between gap-3">
          <label className="text-[11.5px] font-semibold text-app-muted">
            Tempo di studio giornaliero
          </label>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() =>
                setDefaultMinutes((m) => Math.max(0, m - STUDY_STEP_MIN))
              }
              disabled={defaultMinutes <= 0}
              aria-label="Diminuisci"
              className="w-7 h-7 rounded-md flex items-center justify-center bg-app-soft border border-app-border text-app-fg hover:bg-app-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Minus size={13} />
            </button>
            <span
              className="min-w-[64px] text-center text-[12.5px] font-semibold tabular-nums select-none"
              aria-live="polite"
            >
              {defaultMinutes === 0 ? "—" : formatHM(defaultMinutes)}
            </span>
            <button
              type="button"
              onClick={() =>
                setDefaultMinutes((m) =>
                  Math.min(STUDY_MAX_MIN, m + STUDY_STEP_MIN),
                )
              }
              disabled={defaultMinutes >= STUDY_MAX_MIN}
              aria-label="Aumenta"
              className="w-7 h-7 rounded-md flex items-center justify-center bg-app-soft border border-app-border text-app-fg hover:bg-app-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
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
