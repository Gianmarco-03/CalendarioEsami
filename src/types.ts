export type ExamKind = "esame" | "progetto";

export interface Appello {
  id: number;
  date: string; // YYYY-MM-DD
}

export interface ProjectRange {
  id: number;
  start: string;
  end: string;
}

export interface StudyDay {
  date: string;
  minutes: number | null;
}

export interface Exam {
  id: number;
  name: string;
  color: string;
  kind: ExamKind;
  passed: boolean;
  defaultStudyMinutes: number;
  appelli: Appello[];
  ranges: ProjectRange[];
  studyDays: StudyDay[];
}

export interface DateRangeInput {
  start: string;
  end: string;
}

export interface ExamInput {
  name: string;
  color: string;
  kind: ExamKind;
  passed: boolean;
  defaultStudyMinutes: number;
  appelli: string[];
  ranges: DateRangeInput[];
}

export interface ImportReport {
  inserted: number;
  skipped: number;
  errors: string[];
}
