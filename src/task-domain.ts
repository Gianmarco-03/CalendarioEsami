import type { Task, TaskPriority } from "./task-types";

export const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  urgent: 3,
};

export function isActionable(t: Task): boolean {
  return !t.done;
}

export function buildIndex(tasks: Task[]): Map<number, Task> {
  const m = new Map<number, Task>();
  for (const t of tasks) m.set(t.id, t);
  return m;
}

/** Task senza predecessori → root del DAG (rispetto a `tasks` passate). */
export function roots(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.predecessorIds.length === 0);
}

/** Prima task non-done lungo `chainTasks`, o null se tutta done. */
export function nextActionable(chainTasks: Task[]): Task | null {
  return chainTasks.find(isActionable) ?? null;
}

/** Days fra `today` e `t.dueDate`. Negativo = già scaduto. Null se no dueDate. */
export function daysUntilDue(t: Task, today: string): number | null {
  if (!t.dueDate) return null;
  const a = new Date(today).getTime();
  const b = new Date(t.dueDate).getTime();
  return Math.round((b - a) / 86_400_000);
}
