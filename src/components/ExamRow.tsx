import type { Exam } from "../types";
import { useExams } from "../state";
import { Pencil, Trash2 } from "lucide-react";

interface ExamRowProps {
  exam: Exam;
  onEdit: (id: number) => void;
}

function rangeDays(start: string, end: string): number {
  const s = new Date(start); const e = new Date(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
}

function metaText(e: Exam): string {
  const isProj = e.kind === "progetto";
  if (e.passed) return isProj ? "Completato" : "Superato";
  if (isProj) {
    const tot = e.ranges.reduce((s, r) => s + rangeDays(r.start, r.end), 0);
    let s = `${tot} giorn${tot === 1 ? "o" : "i"}`;
    if (e.ranges.length > 1) s += ` · ${e.ranges.length} periodi`;
    return s;
  }
  const nApp = e.appelli.length;
  const nStudy = e.studyDays.length;
  return `${nApp} appell${nApp === 1 ? "o" : "i"} · ${nStudy} giorn${nStudy === 1 ? "o" : "i"} studio`;
}

export function ExamRow({ exam, onEdit }: ExamRowProps) {
  const { setPassed, remove } = useExams();
  const isProj = exam.kind === "progetto";

  return (
    <div className={
      "flex items-center gap-2 p-2 rounded-lg border border-app-border mb-1.5 bg-app-soft " +
      (exam.passed ? "opacity-65" : "")
    }>
      <span
        className={"shrink-0 " + (isProj ? "w-[13px] h-[13px] rounded" : "w-[13px] h-[13px] rounded-full")}
        style={{ background: exam.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={
            "text-[13px] font-semibold truncate min-w-0 " +
            (exam.passed ? "line-through" : "")
          }>{exam.name}</span>
          <span className={
            "text-[8.5px] font-bold uppercase tracking-wider rounded px-1 shrink-0 " +
            (isProj ? "bg-[#ede7fb] text-[#6b4fb0]" : "bg-[#eef0f3] text-[#7b8190]")
          }>
            {isProj ? "Progetto" : "Esame"}
          </span>
        </div>
        <div className="text-[10.5px] text-app-muted mt-px">{metaText(exam)}</div>
      </div>
      <label className="flex items-center cursor-pointer" title={isProj ? "Segna come completato" : "Segna come superato"}>
        <input
          type="checkbox"
          checked={exam.passed}
          onChange={(e) => void setPassed(exam.id, e.target.checked)}
          className="w-[15px] h-[15px] cursor-pointer accent-[#2f9e57]"
        />
      </label>
      <button
        type="button"
        onClick={() => onEdit(exam.id)}
        title="Modifica"
        aria-label="Modifica"
        className="p-1 rounded text-app-muted hover:bg-app-hover hover:text-app-fg"
      ><Pencil size={14} /></button>
      <button
        type="button"
        title="Elimina"
        aria-label="Elimina"
        onClick={() => {
          if (confirm(`Eliminare "${exam.name}"?`)) void remove(exam.id);
        }}
        className="p-1 rounded text-app-muted hover:bg-app-hover hover:text-app-fg"
      ><Trash2 size={14} /></button>
    </div>
  );
}
