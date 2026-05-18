import { useState, type DragEvent } from "react";
import { Plus } from "lucide-react";
import type { Chain, Task } from "../../task-types";
import { nextActionable } from "../../task-domain";
import { useTasks } from "../../tasks-state";
import { useExams } from "../../state";
import { wouldCreateCycle } from "../../dag-validator";
import { isLinkExamCompatible } from "../../link-validator";

// Module-level transient drag state (singolo drag attivo a volta — più semplice di un Context).
let currentDraggedId: number | null = null;

interface Props {
  chain: Chain;
  onEditTask: (id: number) => void;
  onAddSuccessor: (predId: number) => void;
}

export function ChainRow({ chain, onEditTask, onAddSuccessor }: Props) {
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
          onAddSuccessor={() => onAddSuccessor(t.id)}
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
  onAddSuccessor: () => void;
}

function ChainNode({ task, isNextActionable, isLast, onEdit, onAddSuccessor }: ChainNodeProps) {
  const { tasks, setDone, setChecklistItemDone, addLink } = useTasks();
  const { exams } = useExams();
  const [isDropTarget, setIsDropTarget] = useState(false);

  const exam = task.examId != null ? exams.find((e) => e.id === task.examId) ?? null : null;
  const markerColor = exam?.color ?? "var(--ink-50)";

  /** Validità del drop "dragged → target=task" (target diventa predecessore). */
  const isValidDrop = (draggedId: number): boolean => {
    if (draggedId === task.id) return false;
    if (task.successorIds.includes(draggedId)) return false; // già linkato
    const dragged = tasks.find((t) => t.id === draggedId);
    if (!dragged) return false;
    if (!isLinkExamCompatible(task, dragged)) return false;
    if (wouldCreateCycle(tasks, task.id, draggedId)) return false;
    return true;
  };

  const onDragStart = (e: DragEvent<HTMLDivElement>) => {
    currentDraggedId = task.id;
    e.dataTransfer.setData("application/x-todo-task-id", String(task.id));
    // "linkMove" abilita sia "link" (drop su altro ChainNode) sia "move" (detach su view).
    e.dataTransfer.effectAllowed = "linkMove";
    console.debug("[todo:dnd] dragStart", { taskId: task.id, title: task.title });
  };

  const onDragEnd = () => {
    currentDraggedId = null;
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (currentDraggedId == null) return;
    // Claim l'evento per il chain-node, anche quando il drop sarebbe invalido —
    // così non bubble al detach-handler della TodoView (che offrirebbe il drop sbagliato).
    e.stopPropagation();
    if (!isValidDrop(currentDraggedId)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "link";
    if (!isDropTarget) setIsDropTarget(true);
  };

  const onDragLeave = () => setIsDropTarget(false);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    // Stop il bubble per impedire alla TodoView di interpretarlo come "detach".
    e.stopPropagation();
    e.preventDefault();
    setIsDropTarget(false);
    const raw = e.dataTransfer.getData("application/x-todo-task-id");
    const draggedId = Number(raw);
    console.debug("[todo:dnd] drop on ChainNode", { target: task.id, dragged: draggedId, valid: isValidDrop(draggedId) });
    if (!Number.isFinite(draggedId) || !isValidDrop(draggedId)) return;
    // task = bersaglio del drop = predecessore. draggedId = successore.
    void addLink(task.id, draggedId);
  };

  const className = [
    "chain-node",
    task.done ? "done" : "",
    isNextActionable && !task.done ? "next-actionable" : "",
    isLast ? "is-last" : "",
    isDropTarget ? "drop-target" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={className}
      style={{ ["--marker-color" as string]: markerColor } as React.CSSProperties}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="chain-node-rail">
        <button
          type="button"
          className="chain-node-marker"
          onClick={() => void setDone(task.id, !task.done)}
          aria-label={task.done ? `Riapri ${task.title}` : `Segna ${task.title} come fatta`}
          aria-pressed={task.done}
          draggable={false}
        />
        {!isLast && <div className="chain-connector" aria-hidden />}
      </div>
      <div className="chain-node-content">
        <div className="chain-node-head">
          <span
            className="chain-node-title"
            onClick={onEdit}
            onKeyDown={(e) => { if (e.key === "Enter") onEdit(); }}
            role="button"
            tabIndex={0}
          >
            {task.title}
          </span>
          <button
            type="button"
            className="chain-node-add-next"
            onClick={(e) => { e.stopPropagation(); onAddSuccessor(); }}
            aria-label={`Crea una task successiva di ${task.title}`}
            title="Crea task successiva"
            draggable={false}
          >
            <Plus size={12} />
          </button>
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
