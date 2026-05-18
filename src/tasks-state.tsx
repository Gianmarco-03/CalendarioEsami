import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Task, TaskInput } from "./task-types";
import * as db from "./db";
import { useToast } from "./toast";

interface TasksContextValue {
  tasks: Task[];
  loading: boolean;
  refetch: () => Promise<void>;
  create: (input: TaskInput) => Promise<Task | null>;
  update: (id: number, input: TaskInput) => Promise<Task | null>;
  remove: (id: number) => Promise<boolean>;
  setDone: (id: number, done: boolean) => Promise<boolean>;
  addLink: (predId: number, succId: number) => Promise<boolean>;
  removeLink: (predId: number, succId: number) => Promise<boolean>;
  setChecklistItemDone: (itemId: number, done: boolean) => Promise<boolean>;
}

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const refetch = useCallback(async () => {
    try {
      const list = await db.listTasks();
      setTasks(list);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void refetch(); }, [refetch]);

  const create = useCallback(async (input: TaskInput) => {
    try {
      const t = await db.createTask(input);
      await refetch();
      return t;
    } catch (err) { toast.error(String(err)); return null; }
  }, [refetch, toast]);

  const update = useCallback(async (id: number, input: TaskInput) => {
    try {
      const t = await db.updateTask(id, input);
      await refetch();
      return t;
    } catch (err) { toast.error(String(err)); return null; }
  }, [refetch, toast]);

  const remove = useCallback(async (id: number) => {
    try {
      await db.deleteTask(id);
      await refetch();
      return true;
    } catch (err) { toast.error(String(err)); return false; }
  }, [refetch, toast]);

  const setDone = useCallback(async (id: number, done: boolean) => {
    try {
      await db.setTaskDone(id, done);
      await refetch();
      return true;
    } catch (err) { toast.error(String(err)); return false; }
  }, [refetch, toast]);

  const addLink = useCallback(async (predId: number, succId: number) => {
    try {
      await db.addTaskLink(predId, succId);
      await refetch();
      return true;
    } catch (err) { toast.error(String(err)); return false; }
  }, [refetch, toast]);

  const removeLink = useCallback(async (predId: number, succId: number) => {
    try {
      await db.removeTaskLink(predId, succId);
      await refetch();
      return true;
    } catch (err) { toast.error(String(err)); return false; }
  }, [refetch, toast]);

  const setChecklistItemDone = useCallback(async (itemId: number, done: boolean) => {
    try {
      await db.setChecklistItemDone(itemId, done);
      await refetch();
      return true;
    } catch (err) { toast.error(String(err)); return false; }
  }, [refetch, toast]);

  const value = useMemo<TasksContextValue>(() => ({
    tasks, loading, refetch, create, update, remove, setDone,
    addLink, removeLink, setChecklistItemDone,
  }), [tasks, loading, refetch, create, update, remove, setDone, addLink, removeLink, setChecklistItemDone]);

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be inside TasksProvider");
  return ctx;
}
