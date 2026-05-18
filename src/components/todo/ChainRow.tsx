import type { Chain, Task } from "../../task-types";
import { nextActionable } from "../../task-domain";
import { useTasks } from "../../tasks-state";
import { useExams } from "../../state";

interface Props {
  chain: Chain;
  onEditTask: (id: number) => void;
}

export function ChainRow({ chain, onEditTask }: Props) {
  const next = nextActionable(chain.tasks);
  const nextId = next?.id ?? null;
  return (
    <div className="chain-row">
      {chain.tasks.map((t, i) => (
        <ChainNode
          key={`${chain.pathKey}@${i}`}
          task={t}
          isNextActionable={t.id === nextId}
          isLast={i === chain.tasks.length - 1}
          onEdit={() => onEditTask(t.id)}
        />
      ))}
    </div>
  );
}

interface ChainNodeProps {
  task: Task;
  isNextActionable: boolean;
  isLast: boolean;
  onEdit: () => void;
}

function ChainNode({ task, isNextActionable, isLast, onEdit }: ChainNodeProps) {
  const { setDone, setChecklistItemDone } = useTasks();
  const { exams } = useExams();
  const exam = task.examId != null ? exams.find((e) => e.id === task.examId) ?? null : null;
  const markerColor = exam?.color ?? "var(--ink-50)";

  const className = [
    "chain-node",
    task.done ? "done" : "",
    isNextActionable && !task.done ? "next-actionable" : "",
    isLast ? "is-last" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={className} style={{ ["--marker-color" as string]: markerColor } as React.CSSProperties}>
      <div className="chain-node-rail">
        <button
          type="button"
          className="chain-node-marker"
          onClick={() => void setDone(task.id, !task.done)}
          aria-label={task.done ? `Riapri ${task.title}` : `Segna ${task.title} come fatta`}
          aria-pressed={task.done}
        />
        {!isLast && <div className="chain-connector" aria-hidden />}
      </div>
      <div className="chain-node-content">
        <div
          className="chain-node-head"
          onClick={onEdit}
          onKeyDown={(e) => { if (e.key === "Enter") onEdit(); }}
          role="button"
          tabIndex={0}
        >
          <span className="chain-node-title">{task.title}</span>
          <div className="chain-node-meta">
            {exam && <span>{exam.name}</span>}
            {task.dueDate && <span>{formatDueShort(task.dueDate)}</span>}
            {task.priority === "high" && <span className="prio-pill high">alta</span>}
            {task.priority === "urgent" && <span className="prio-pill urgent">urgente</span>}
          </div>
        </div>
        {task.checklist.length > 0 && (
          <ul className="chain-checklist">
            {task.checklist.map((item) => (
              <li key={item.id} className={`chain-checklist-item ${item.done ? "done" : ""}`}>
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => void setChecklistItemDone(item.id, !item.done)}
                  aria-label={item.label}
                />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatDueShort(yyyy_mm_dd: string): string {
  const d = new Date(yyyy_mm_dd);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}
