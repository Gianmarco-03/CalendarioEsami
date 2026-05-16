import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Exam, ExamInput } from "./types";
import * as db from "./db";
import { useToast } from "./toast";

interface ExamsContextValue {
  exams: Exam[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  refetch: () => Promise<void>;
  create: (input: ExamInput) => Promise<Exam | null>;
  update: (id: number, input: ExamInput) => Promise<Exam | null>;
  remove: (id: number) => Promise<boolean>;
  setPassed: (id: number, passed: boolean) => Promise<boolean>;
  toggleStudyDay: (examId: number, date: string) => Promise<boolean | null>;
}

const ExamsContext = createContext<ExamsContextValue | null>(null);

export function ExamsProvider({ children }: { children: ReactNode }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const toast = useToast();

  const refetch = useCallback(async () => {
    try {
      const list = searchQuery.trim()
        ? await db.searchExams(searchQuery)
        : await db.listExams();
      setExams(list);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, toast]);

  useEffect(() => { void refetch(); }, [refetch]);

  const create = useCallback(async (input: ExamInput) => {
    try {
      const e = await db.createExam(input);
      await refetch();
      return e;
    } catch (err) { toast.error(String(err)); return null; }
  }, [refetch, toast]);

  const update = useCallback(async (id: number, input: ExamInput) => {
    try {
      const e = await db.updateExam(id, input);
      await refetch();
      return e;
    } catch (err) { toast.error(String(err)); return null; }
  }, [refetch, toast]);

  const remove = useCallback(async (id: number) => {
    try {
      await db.deleteExam(id);
      await refetch();
      return true;
    } catch (err) { toast.error(String(err)); return false; }
  }, [refetch, toast]);

  const setPassed = useCallback(async (id: number, passed: boolean) => {
    try {
      await db.setExamPassed(id, passed);
      await refetch();
      return true;
    } catch (err) { toast.error(String(err)); return false; }
  }, [refetch, toast]);

  const toggleStudyDay = useCallback(async (examId: number, date: string) => {
    try {
      const v = await db.toggleStudyDay(examId, date);
      await refetch();
      return v;
    } catch (err) { toast.error(String(err)); return null; }
  }, [refetch, toast]);

  const value = useMemo<ExamsContextValue>(() => ({
    exams, loading, searchQuery, setSearchQuery,
    refetch, create, update, remove, setPassed, toggleStudyDay,
  }), [exams, loading, searchQuery, refetch, create, update, remove, setPassed, toggleStudyDay]);

  return <ExamsContext.Provider value={value}>{children}</ExamsContext.Provider>;
}

export function useExams(): ExamsContextValue {
  const ctx = useContext(ExamsContext);
  if (!ctx) throw new Error("useExams must be inside ExamsProvider");
  return ctx;
}
