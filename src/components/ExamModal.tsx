import { useEffect, useState } from "react";
import type { Exam, ExamKind, ExamInput, DateRangeInput } from "../types";
import { useExams } from "../state";
import { useToast } from "../toast";
import { Modal } from "./Modal";
import { durationOptions } from "../study-time";
import { Calendar as CalendarIcon, FolderKanban, X as XIcon, Plus } from "lucide-react";

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

export function ExamModal({ open, onClose, editing, initialKind }: ExamModalProps) {
  const { create, update, remove, exams } = useExams();
  const toast = useToast();

  const [kind, setKind] = useState<ExamKind>(initialKind);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [defaultMinutes, setDefaultMinutes] = useState<number>(60);
  const [appelli, setAppelli] = useState<string[]>([""]);
  const [ranges, setRanges] = useState<DateRangeInput[]>([{ start: "", end: "" }]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setKind(editing.kind);
      setName(editing.name);
      setColor(editing.color);
      setDefaultMinutes(editing.defaultStudyMinutes);
      setAppelli(editing.appelli.length ? editing.appelli.map((a) => a.date) : [""]);
      setRanges(editing.ranges.length ? editing.ranges.map((r) => ({ start: r.start, end: r.end })) : [{ start: "", end: "" }]);
    } else {
      setKind(initialKind);
      setName("");
      setDefaultMinutes(60);
      const used = new Set(exams.map((e) => e.color));
      setColor(PALETTE.find((c) => !used.has(c)) ?? PALETTE[exams.length % PALETTE.length]);
      setAppelli([""]);
      setRanges([{ start: "", end: "" }]);
    }
  }, [open, editing, initialKind, exams]);

  if (!open) return null;

  const isProj = kind === "progetto";
  const title = editing
    ? (isProj ? "Modifica progetto" : "Modifica esame")
    : (isProj ? "Nuovo progetto" : "Nuovo esame");

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error("Inserisci un nome."); return; }
    const cleanAppelli = appelli.filter((d) => d).sort();
    const cleanRanges: DateRangeInput[] = ranges
      .filter((r) => r.start)
      .map((r) => {
        let { start, end } = r;
        if (!end) end = start;
        if (end < start) [start, end] = [end, start];
        return { start, end };
      })
      .sort((a, b) => a.start.localeCompare(b.start));

    if (isProj && cleanRanges.length === 0) {
      toast.error("Inserisci almeno una data di inizio per il progetto.");
      return;
    }

    const input: ExamInput = {
      name: trimmed,
      color,
      kind,
      passed: editing?.passed ?? false,
      defaultStudyMinutes: defaultMinutes,
      appelli: isProj ? [] : cleanAppelli,
      ranges: isProj ? cleanRanges : [],
    };

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
      <div className="mb-3 flex border border-[#d6d9e0] rounded-lg overflow-hidden">
        {(["esame", "progetto"] as ExamKind[]).map((k, i) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={
              "flex-1 flex items-center justify-center gap-1.5 py-2 text-[12.5px] font-semibold " +
              (kind === k ? "bg-[#2f3545] text-white" : "bg-white text-[#6b7280]") +
              (i === 0 ? "" : " border-l border-[#d6d9e0]")
            }
          >
            {k === "esame" ? <><CalendarIcon size={14} /> Esame</> : <><FolderKanban size={14} /> Progetto</>}
          </button>
        ))}
      </div>

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
        <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wide mb-1.5">
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

      {!isProj && (
        <div className="mb-3">
          <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wide mb-1.5">
            Appelli (date d'esame)
          </label>
          {appelli.map((d, i) => (
            <div key={i} className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[11px] text-app-muted w-[58px] shrink-0">Appello {i + 1}</span>
              <input
                type="date"
                value={d}
                onChange={(e) => setAppelli(appelli.map((x, j) => (j === i ? e.target.value : x)))}
                className="flex-1 px-2.5 py-2 border border-[#d6d9e0] rounded-lg text-[13px]"
              />
              <button
                type="button"
                onClick={() => setAppelli(appelli.filter((_, j) => j !== i))}
                className="p-1 rounded text-[#6b7280] hover:bg-[#eef0f3]"
                title="Rimuovi"
                aria-label="Rimuovi"
              ><XIcon size={14} /></button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setAppelli([...appelli, ""])}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2f6fb3] hover:underline"
          ><Plus size={12} /> Aggiungi appello</button>
        </div>
      )}

      {isProj && (
        <div className="mb-3">
          <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wide mb-1.5">
            Periodi del progetto
          </label>
          {ranges.map((r, i) => (
            <div key={i} className="flex items-center gap-1 mb-1.5">
              <span className="text-[11px] text-app-muted shrink-0">Dal</span>
              <input
                type="date"
                value={r.start}
                onChange={(e) => setRanges(ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
                className="flex-1 min-w-0 px-2 py-2 border border-[#d6d9e0] rounded-lg text-[13px]"
              />
              <span className="text-[11px] text-app-muted shrink-0">al</span>
              <input
                type="date"
                value={r.end}
                onChange={(e) => setRanges(ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                className="flex-1 min-w-0 px-2 py-2 border border-[#d6d9e0] rounded-lg text-[13px]"
              />
              <button
                type="button"
                onClick={() => setRanges(ranges.filter((_, j) => j !== i))}
                className="p-1 rounded text-[#6b7280] hover:bg-[#eef0f3]"
                title="Rimuovi"
                aria-label="Rimuovi"
              ><XIcon size={14} /></button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRanges([...ranges, { start: "", end: "" }])}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2f6fb3] hover:underline"
          ><Plus size={12} /> Aggiungi periodo</button>
        </div>
      )}

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
