import type { Exam } from "../../types";
import type { Task, TaskPriority } from "../../task-types";
import { PRIORITY_WEIGHT } from "../../task-domain";

export interface TaskFiltersState {
  hideDone: boolean;
  examId: number | null | "free";
  minPriority: TaskPriority | null;
}

interface Props {
  value: TaskFiltersState;
  onChange: (v: TaskFiltersState) => void;
  exams: Exam[];
}

export function TaskFilters({ value, onChange, exams }: Props) {
  return (
    <div className="todo-filters">
      <div className="pill-group" role="group" aria-label="Mostra completate">
        <button
          type="button"
          className={!value.hideDone ? "on" : ""}
          onClick={() => onChange({ ...value, hideDone: false })}
        >Tutte</button>
        <button
          type="button"
          className={value.hideDone ? "on" : ""}
          onClick={() => onChange({ ...value, hideDone: true })}
        >Solo aperte</button>
      </div>

      <select
        value={value.examId == null ? "all" : value.examId === "free" ? "free" : String(value.examId)}
        onChange={(e) => {
          const v = e.target.value;
          onChange({
            ...value,
            examId: v === "all" ? null : v === "free" ? "free" : Number(v),
          });
        }}
        aria-label="Filtra per esame"
      >
        <option value="all">Tutti gli esami</option>
        <option value="free">Senza esame</option>
        {exams.map((ex) => (
          <option key={ex.id} value={ex.id}>{ex.name}</option>
        ))}
      </select>

      <select
        value={value.minPriority ?? "any"}
        onChange={(e) => {
          const v = e.target.value as "any" | TaskPriority;
          onChange({ ...value, minPriority: v === "any" ? null : v });
        }}
        aria-label="Priorità minima"
      >
        <option value="any">Tutte le priorità</option>
        <option value="normal">Da normal in su</option>
        <option value="high">Da high in su</option>
        <option value="urgent">Solo urgent</option>
      </select>
    </div>
  );
}

export function applyFilters(tasks: Task[], f: TaskFiltersState): Task[] {
  return tasks.filter((t) => {
    if (f.hideDone && t.done) return false;
    if (f.examId === "free" && t.examId != null) return false;
    if (typeof f.examId === "number" && t.examId !== f.examId) return false;
    if (f.minPriority && PRIORITY_WEIGHT[t.priority] < PRIORITY_WEIGHT[f.minPriority]) return false;
    return true;
  });
}
