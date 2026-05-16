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
  if (e.kind === "progetto") {
    const tot = e.ranges.reduce((s, r) => s + rangeDays(r.start, r.end), 0);
    return `${tot}g`;
  }
  const nApp = e.appelli.length;
  const totMinutes = e.studyDays.reduce((s, d) => s + (d.minutes ?? 0), 0);
  if (totMinutes > 0) {
    const h = Math.floor(totMinutes / 60);
    const m = totMinutes % 60;
    const timePart = h > 0 ? (m > 0 ? `${h}h${m}m` : `${h}h`) : `${m}m`;
    return `${nApp}·${timePart}`;
  }
  return `${nApp}`;
}

export function ExamRow({ exam, onEdit }: ExamRowProps) {
  const { setPassed, remove } = useExams();

  const classes = [
    "exam-row-redesign",
    "lift-hover",
    exam.passed ? "passed" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      style={{ ["--ec" as string]: exam.color } as React.CSSProperties}
    >
      <span className="exam-row-redesign-stripe" />
      <span className="exam-row-redesign-name">{exam.name}</span>
      <span className="exam-row-redesign-meta">{metaText(exam)}</span>
      <label
        className="flex items-center cursor-pointer shrink-0"
        title={exam.kind === "progetto" ? "Segna come completato" : "Segna come superato"}
      >
        <input
          type="checkbox"
          checked={exam.passed}
          onChange={(e) => void setPassed(exam.id, e.target.checked)}
          className="w-[15px] h-[15px] cursor-pointer accent-[#2f9e57]"
        />
      </label>
      <div className="exam-row-redesign-actions">
        <button
          type="button"
          onClick={() => onEdit(exam.id)}
          title="Modifica"
          aria-label="Modifica"
        ><Pencil size={13} /></button>
        <button
          type="button"
          title="Elimina"
          aria-label="Elimina"
          onClick={() => {
            if (confirm(`Eliminare "${exam.name}"?`)) void remove(exam.id);
          }}
        ><Trash2 size={13} /></button>
      </div>
    </div>
  );
}
