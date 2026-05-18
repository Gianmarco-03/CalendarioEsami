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

/** Task con `dueDate === dayKey`. Per default include solo quelle non-done. */
export function tasksDueOn(tasks: Task[], dayKey: string, opts: { includeDone?: boolean } = {}): Task[] {
  return tasks.filter((t) => t.dueDate === dayKey && (opts.includeDone || !t.done));
}

/** Mappa `dueDate → Task[]` per scan efficiente del Calendar (1 pass). */
export function tasksByDueDate(tasks: Task[], opts: { includeDone?: boolean } = {}): Map<string, Task[]> {
  const m = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    if (!opts.includeDone && t.done) continue;
    const arr = m.get(t.dueDate) ?? [];
    arr.push(t);
    m.set(t.dueDate, arr);
  }
  return m;
}

/** Conta le task che soddisfano il predicato. */
export function countTasks(tasks: Task[], pred: (t: Task) => boolean): number {
  let n = 0;
  for (const t of tasks) if (pred(t)) n++;
  return n;
}
