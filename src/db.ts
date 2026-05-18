import { invoke } from "@tauri-apps/api/core";
import type { Exam, Esame, Progetto, ExamInput, ImportReport, StudyDay } from "./types";
import type { Task, TaskInput } from "./task-types";

type EsameWire    = Omit<Esame,    "studyDays" | "defaultStudyMinutes"> & { study_days: StudyDay[]; default_study_minutes: number };
type ProgettoWire = Omit<Progetto, "studyDays" | "defaultStudyMinutes"> & { study_days: StudyDay[]; default_study_minutes: number };
type ExamWire     = EsameWire | ProgettoWire;

function fromWire(e: ExamWire): Exam {
  if (e.kind === "esame") {
    const { study_days, default_study_minutes, ...rest } = e;
    return { ...rest, studyDays: study_days, defaultStudyMinutes: default_study_minutes };
  } else {
    const { study_days, default_study_minutes, ...rest } = e;
    return { ...rest, studyDays: study_days, defaultStudyMinutes: default_study_minutes };
  }
}

export async function dbStatus(): Promise<void> {
  await invoke("db_status");
}

export async function listExams(): Promise<Exam[]> {
  const wire = await invoke<ExamWire[]>("list_exams");
  return wire.map(fromWire);
}

export async function createExam(input: ExamInput): Promise<Exam> {
  const wire = await invoke<ExamWire>("create_exam", { input });
  return fromWire(wire);
}

export async function updateExam(id: number, input: ExamInput): Promise<Exam> {
  const wire = await invoke<ExamWire>("update_exam", { id, input });
  return fromWire(wire);
}

export async function deleteExam(id: number): Promise<void> {
  await invoke("delete_exam", { id });
}

export async function setExamPassed(id: number, passed: boolean): Promise<void> {
  await invoke("set_exam_passed", { id, passed });
}

export async function toggleStudyDay(examId: number, date: string): Promise<boolean> {
  return await invoke<boolean>("toggle_study_day", { examId, date });
}

export async function setStudyDayMinutes(examId: number, date: string, minutes: number | null): Promise<void> {
  await invoke("set_study_day_minutes", { examId, date, minutes });
}

export async function searchExams(query: string): Promise<Exam[]> {
  const wire = await invoke<ExamWire[]>("search_exams", { query });
  return wire.map(fromWire);
}

export async function importArtifactJson(payload: string): Promise<ImportReport> {
  return await invoke<ImportReport>("import_artifact_json", { payload });
}

export async function getSetting(key: string): Promise<string | null> {
  return await invoke<string | null>("get_setting", { key });
}

export async function setSetting(key: string, value: string): Promise<void> {
  await invoke("set_setting", { key, value });
}

export interface ActiveExamLite { id: number; name: string; color: string }

export async function quicklogLog(examId: number, minutes: number): Promise<void> {
  await invoke("quicklog_log", { examId, minutes });
}

export async function quicklogRecentExam(): Promise<number | null> {
  return await invoke<number | null>("quicklog_recent_exam");
}

export async function quicklogActiveExams(): Promise<ActiveExamLite[]> {
  const rows = await invoke<Array<[number, string, string]>>("quicklog_active_exams");
  return rows.map(([id, name, color]) => ({ id, name, color }));
}

// ---------- Tasks ----------
// Wire types: backend usa snake_case via serde rename_all="camelCase"
// quindi Task arriva già in camelCase. Nessuna transform necessaria.

export async function listTasks(): Promise<Task[]> {
  return await invoke<Task[]>("list_tasks");
}

export async function getTask(id: number): Promise<Task> {
  return await invoke<Task>("get_task", { id });
}

export async function createTask(input: TaskInput): Promise<Task> {
  return await invoke<Task>("create_task", { input });
}

export async function updateTask(id: number, input: TaskInput): Promise<Task> {
  return await invoke<Task>("update_task", { id, input });
}

export async function deleteTask(id: number): Promise<void> {
  await invoke("delete_task", { id });
}

export async function setTaskDone(id: number, done: boolean): Promise<void> {
  await invoke("set_task_done", { id, done });
}

export async function setChecklistItemDone(itemId: number, done: boolean): Promise<void> {
  await invoke("set_checklist_item_done", { itemId, done });
}

export async function addTaskLink(predId: number, succId: number): Promise<void> {
  await invoke("add_task_link", { predId, succId });
}

export async function removeTaskLink(predId: number, succId: number): Promise<void> {
  await invoke("remove_task_link", { predId, succId });
}
