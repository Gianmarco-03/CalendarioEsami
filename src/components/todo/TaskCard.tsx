import type { Task } from "../../task-types";
import { useTasks } from "../../tasks-state";
import { useExams } from "../../state";

interface Props {
  task: Task;
  isNextActionable: boolean;
  onEdit: () => void;
}

export function TaskCard({ task, isNextActionable, onEdit }: Props) {
  const { setDone } = useTasks();
  const { exams } = useExams();
  const exam = task.examId != null ? exams.find((e) => e.id === task.examId) ?? null : null;
  const stripeColor = exam?.color ?? "var(--ink-50)";

  const checklistDoneCount = task.checklist.filter((c) => c.done).length;
  const hasChecklist = task.checklist.length > 0;

  const className = [
    "task-card",
    isNextActionable && !task.done ? "next-actionable" : "",
    task.done ? "done" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={className}
      onClick={onEdit}
      onKeyDown={(e) => { if (e.key === "Enter") onEdit(); }}
      role="button"
      tabIndex={0}
    >
      <div className="task-card-top">
        <span className="task-card-stripe" style={{ background: stripeColor }} />
        <input
          type="checkbox"
          className="task-checkbox"
          checked={task.done}
          onClick={(e) => e.stopPropagation()}
          onChange={() => void setDone(task.id, !task.done)}
          aria-label={`Segna ${task.title} come fatto`}
        />
        <span className="task-title">{task.title}</span>
      </div>
      <div className="task-card-meta">
        {exam && <span>{exam.name}</span>}
        {hasChecklist && <span>▢ {checklistDoneCount}/{task.checklist.length}</span>}
        {task.dueDate && <span>{formatDueShort(task.dueDate)}</span>}
        {task.priority === "high" && <span className="prio-pill high">alta</span>}
        {task.priority === "urgent" && <span className="prio-pill urgent">urgente</span>}
      </div>
    </div>
  );
}

function formatDueShort(yyyy_mm_dd: string): string {
  const d = new Date(yyyy_mm_dd);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}
