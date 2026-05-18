import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
} from "@tauri-apps/plugin-notification";
import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";

export type NotifKindStr =
  | "exam_imminent" | "project_start" | "project_deadline"
  | "study_reminder" | "study_missed" | "streak_milestone" | "quick_log_prompt";

export const ALL_KINDS: NotifKindStr[] = [
  "exam_imminent", "project_start", "project_deadline",
  "study_reminder", "study_missed", "streak_milestone", "quick_log_prompt",
];

export const KIND_LABELS: Record<NotifKindStr, string> = {
  exam_imminent:    "Esami imminenti",
  project_start:    "Inizio progetti",
  project_deadline: "Deadline progetti",
  study_reminder:   "Promemoria studio",
  study_missed:     "Mancato studio",
  streak_milestone: "Milestone streak",
  quick_log_prompt: "Log rapido programmato",
};

export interface NotifPref { enabled: boolean; config_json: string }
export interface NotifPrefs { entries: Record<string, NotifPref> }

export async function getNotifPrefs(): Promise<NotifPrefs> {
  return await invoke<NotifPrefs>("get_notif_prefs");
}

export async function setNotifPref(kind: string, enabled: boolean, configJson?: string): Promise<void> {
  await invoke("set_notif_pref", { kind, enabled, configJson: configJson ?? "{}" });
}

export async function testSend(kind: NotifKindStr): Promise<void> {
  await invoke("notif_test_send", { kind });
}

export async function forceTick(): Promise<number> {
  return await invoke<number>("notif_force_tick");
}

export async function ensurePermission(): Promise<boolean> {
  if (await isPermissionGranted()) return true;
  const res = await requestPermission();
  return res === "granted";
}

export async function setAutostart(on: boolean): Promise<void> {
  if (on) await enableAutostart(); else await disableAutostart();
}

export async function getAutostart(): Promise<boolean> {
  return await isAutostartEnabled();
}

// ---------- helpers per leggere/scrivere config_json tipati ----------

export interface StudyReminderCfg { times: string[] }
export interface StudyMissedCfg   { hour: number; minute: number; weekdays_only: boolean }
export interface ExamImminentCfg  { offsets: number[]; hour: number; morning_hour: number; morning_minute: number }
export interface ProjectDeadlineCfg { offsets: number[]; hour: number }
export interface QuickLogPromptCfg { times: string[] }

export function parseConfig<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}
