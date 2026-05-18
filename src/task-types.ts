export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface ChecklistItem {
  id: number;
  label: string;
  done: boolean;
  position: number;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  examId: number | null;
  priority: TaskPriority;
  dueDate: string | null;
  done: boolean;
  checklist: ChecklistItem[];
  predecessorIds: number[];
  successorIds: number[];
}

export interface ChecklistItemInput {
  label: string;
  done: boolean;
  position: number;
}

export interface TaskInput {
  title: string;
  description: string;
  examId: number | null;
  priority: TaskPriority;
  dueDate: string | null;
  checklist: ChecklistItemInput[];
}

export interface Chain {
  rootId: number;
  tasks: Task[];
  pathKey: string;
}
