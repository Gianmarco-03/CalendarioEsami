import { invoke } from "@tauri-apps/api/core";
import type { Exam, ExamInput, ImportReport } from "./types";

type ExamWire = Omit<Exam, "studyDays"> & { study_days: string[] };

function fromWire(e: ExamWire): Exam {
  const { study_days, ...rest } = e;
  return { ...rest, studyDays: study_days };
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
