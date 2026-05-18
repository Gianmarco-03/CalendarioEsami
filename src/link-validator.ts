import type { Task } from "./task-types";

/** Due task sono link-compatibili se condividono esame oppure se almeno una è libera. */
export function isLinkExamCompatible(a: Task, b: Task): boolean {
  if (a.examId == null || b.examId == null) return true;
  return a.examId === b.examId;
}
