import type { Exam } from "../types";
import { useExams } from "../state";
import { Pencil, Trash2 } from "lucide-react";
import { totalMinutes, formatHM } from "../study-time";
import { isProgetto, totalRangeDays } from "../progetto";

interface ExamRowProps {
  exam: Exam;
  onEdit: (id: number) => void;
}

function metaText(exam: Exam, allExams: Exam[]): string {
  if (isProgetto(exam)) {
    const totDays = totalRangeDays(exam);
    const totMin = totalMinutes(exam, allExams);
    const time = formatHM(totMin);
    return time ? `${totDays}g · ${time}` : `${totDays}g`;
  }
  const nApp = exam.appelli.length;
  const totMin = totalMinutes(exam, allExams);
  const time = formatHM(totMin);
  return time ? `${nApp}·${time}` : `${nApp}`;
}

export function ExamRow({ exam, onEdit }: ExamRowProps) {
  const { setPassed, remove, exams } = useExams();

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
      <span className="exam-row-redesign-meta">{metaText(exam, exams)}</span>
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
