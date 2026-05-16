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

export interface EsameData {
  id: number;
  name: string;
  color: string;
  passed: boolean;
  defaultStudyMinutes: number;
  appelli: Appello[];
  studyDays: StudyDay[];
}

export interface ProgettoData extends EsameData {
  ranges: ProjectRange[];
}

export type Esame    = EsameData    & { kind: "esame" };
export type Progetto = ProgettoData & { kind: "progetto" };
export type Exam     = Esame | Progetto;

export interface DateRangeInput {
  start: string;
  end: string;
}

export interface EsameInputData {
  name: string;
  color: string;
  passed: boolean;
  defaultStudyMinutes: number;
  appelli: string[];
}

export interface ProgettoInputData extends EsameInputData {
  ranges: DateRangeInput[];
}

export type EsameInput    = EsameInputData    & { kind: "esame" };
export type ProgettoInput = ProgettoInputData & { kind: "progetto" };
export type ExamInput     = EsameInput | ProgettoInput;

export interface ImportReport {
  inserted: number;
  skipped: number;
  errors: string[];
}
