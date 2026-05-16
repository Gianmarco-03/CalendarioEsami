import { useEffect, useState } from "react";
import type { Exam, ExamKind, ExamInput, EsameInputData, ProgettoInputData } from "../types";
import { useExams } from "../state";
import { useToast } from "../toast";
import { Modal } from "./Modal";
import { X as XIcon, Plus } from "lucide-react";
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

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="mb-3">
        <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wide mb-1.5">
          {isProj ? "Nome progetto" : "Nome esame"}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isProj ? "es. Tesina di Fisiologia" : "es. Neuroanatomia"}
          autoFocus
          className="w-full px-2.5 py-2 border border-[#d6d9e0] rounded-lg text-[13px] focus:outline-2 focus:outline-[#aeb4c0]"
        />
      </div>

      <div className="mb-3">
        <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wide mb-1.5">Colore</label>
        <div className="flex flex-wrap gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={
                "w-[26px] h-[26px] rounded-lg cursor-pointer border-2 " +
                (color === c ? "border-[#1f2430] shadow-[inset_0_0_0_2px_white]" : "border-transparent")
              }
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-[11px] font-bold text-app-muted uppercase tracking-wide mb-1.5">
          Tempo di studio giornaliero
        </label>
        <select
          value={defaultMinutes}
          onChange={(e) => setDefaultMinutes(parseInt(e.target.value, 10))}
          className="w-full px-2.5 py-2 border border-app-input-border rounded-lg text-[13px] bg-app-input-bg text-app-fg focus:outline-2 focus:outline-app-muted"
        >
          {durationOptions().map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <p className="mt-1 text-[10.5px] text-app-muted leading-relaxed">
          I minuti effettivi sono <code>t/n</code>, dove <code>n</code> è il numero di esami
          attivi (esami in studio + progetti in corso) quel giorno.
        </p>
      </div>

      <div className="mb-3">
        <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wide mb-1.5">
          Date d'esame / Periodi
        </label>
        {entries.map((entry) => (
          <div key={entry.uid} className="flex items-center gap-2 mb-2">
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
                className="flex-1 px-2 py-1.5 text-[12.5px] border border-app-input-border bg-app-input-bg text-app-fg rounded-lg"
              />
            ) : (
              <>
                <input
                  type="date"
                  value={entry.start}
                  onChange={(ev) => updateEntry(entry.uid, { start: ev.target.value })}
                  className="flex-1 min-w-0 px-2 py-1.5 text-[12.5px] border border-app-input-border bg-app-input-bg text-app-fg rounded-lg"
                />
                <span className="text-[10px] text-app-muted shrink-0">→</span>
                <input
                  type="date"
                  value={entry.end}
                  onChange={(ev) => updateEntry(entry.uid, { end: ev.target.value })}
                  className="flex-1 min-w-0 px-2 py-1.5 text-[12.5px] border border-app-input-border bg-app-input-bg text-app-fg rounded-lg"
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
        <button
          type="button"
          onClick={addAppello}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2f6fb3] hover:underline"
        ><Plus size={12} /> Aggiungi data</button>
      </div>

      <div className="flex gap-2 mt-2">
        {editing && (
          <button
            type="button"
            onClick={handleDelete}
            className="flex-1 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold border border-[#e7c3bd] text-[#c0392b] hover:bg-[#fdf1ef]"
          >Elimina</button>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold bg-[#2f3545] text-white border border-[#2f3545] hover:bg-[#1f2430]"
        >Salva</button>
      </div>
    </Modal>
  );
}
