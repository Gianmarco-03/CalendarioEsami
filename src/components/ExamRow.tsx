import type { Exam } from "../types";
import { useExams } from "../state";
import { Pencil, Trash2 } from "lucide-react";
import { suggestedTotalMinutes } from "../study-time";
import { formatHM } from "../study-time-format";
import { useSuggestedStrategy, type SuggestedStrategy } from "../suggested-strategy";
import { isProgetto, totalRangeDays } from "../progetto";
import { iconFor } from "../exam-icons";

interface ExamRowProps {
  exam: Exam;
  onEdit: (id: number) => void;
  selected?: boolean;
  onSelect?: () => void;
}

function metaText(exam: Exam, allExams: Exam[], strategy: SuggestedStrategy): string {
  if (isProgetto(exam)) {
    const totDays = totalRangeDays(exam);
    const totMin = suggestedTotalMinutes(exam, allExams, strategy);
    const time = formatHM(totMin);
    return time ? `${totDays}g · ${time}` : `${totDays}g`;
  }
  const nApp = exam.appelli.length;
  const totMin = suggestedTotalMinutes(exam, allExams, strategy);
  const time = formatHM(totMin);
  return time ? `${nApp}·${time}` : `${nApp}`;
}

export function ExamRow({ exam, onEdit, selected, onSelect }: ExamRowProps) {
  const { setPassed, remove, exams } = useExams();
  const strategy = useSuggestedStrategy();
  const Icon = iconFor(exam.icon);

  const classes = [
    "exam-row",
    exam.passed ? "passed" : "",
    selected ? "selected" : "",
  ].filter(Boolean).join(" ");

  const handleRowClick: React.MouseEventHandler<HTMLDivElement> | undefined = onSelect
    ? (e) => {
        const target = e.target as HTMLElement;
        if (target.closest("button") || target.closest("input")) return;
        onSelect();
      }
    : undefined;

  return (
    <div
      className={classes}
      style={{ ["--ec" as string]: exam.color } as React.CSSProperties}
      onClick={handleRowClick}
      role={onSelect ? "button" : undefined}
      aria-pressed={onSelect ? selected : undefined}
    >
      <span className="exam-row-stripe" />
      <span className="exam-row-icon">
        <Icon size={12} strokeWidth={1.75} />
      </span>
      <span className="exam-row-name">{exam.name}</span>
      <span className="exam-row-meta">{metaText(exam, exams, strategy)}</span>
      <input
        type="checkbox"
        className="exam-row-checkbox"
        checked={exam.passed}
        onChange={(e) => void setPassed(exam.id, e.target.checked)}
        onClick={(e) => e.stopPropagation()}
        title={exam.kind === "progetto" ? "Segna come completato" : "Segna come superato"}
        aria-label={exam.kind === "progetto" ? "Completato" : "Superato"}
      />
      <div className="exam-row-actions">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(exam.id); }}
          title="Modifica"
          aria-label="Modifica"
        ><Pencil size={12} /></button>
        <button
          type="button"
          title="Elimina"
          aria-label="Elimina"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Eliminare "${exam.name}"?`)) void remove(exam.id);
          }}
        ><Trash2 size={12} /></button>
      </div>
    </div>
  );
}
