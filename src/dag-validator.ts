import type { Task } from "./task-types";
import { buildIndex } from "./task-domain";

/** True se aggiungere edge pred→succ creerebbe un ciclo (o self-loop). */
export function wouldCreateCycle(tasks: Task[], pred: number, succ: number): boolean {
  if (pred === succ) return true;
  const idx = buildIndex(tasks);
  const stack: number[] = [succ];
  const seen = new Set<number>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === pred) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const t = idx.get(cur);
    if (!t) continue;
    for (const s of t.successorIds) stack.push(s);
  }
  return false;
}
