import type { Exam } from "./types";

/**
 * Count "study activities" active on a given day:
 *   - +1 per active esame with a studyDay entry on this date
 *   - +1 per active progetto whose range covers this date
 * Identical semantics to Rust's db::exams::count_presences.
 */
export function countPresences(dayKey: string, exams: Exam[]): number {
  let n = 0;
  for (const e of exams) {
    if (e.passed) continue;
    if (e.kind === "esame") {
      if (e.studyDays.some((s) => s.date === dayKey)) n++;
    } else {
      if (e.ranges.some((r) => dayKey >= r.start && dayKey <= r.end)) n++;
    }
  }
  return n;
}

/**
 * Effective minutes for studying `exam` on `dayKey`.
 *   - For esami: a non-null `studyDays[d].minutes` is a manual override and wins.
 *   - Otherwise: t/n, where t = exam.defaultStudyMinutes and n = countPresences.
 *   - Returns 0 if t === 0 (no auto-study) or n === 0 (no activities, defensive).
 */
export function effectiveMinutes(exam: Exam, dayKey: string, allExams: Exam[]): number {
  if (exam.kind === "esame") {
    const entry = exam.studyDays.find((s) => s.date === dayKey);
    if (entry && entry.minutes != null) return entry.minutes;
  }
  const t = exam.defaultStudyMinutes;
  if (t === 0) return 0;
  const n = countPresences(dayKey, allExams);
  if (n === 0) return 0;
  return Math.round(t / n);
}

/**
 * Iterate every day where `exam` is "being studied":
 *   - For esami: each studyDay entry.
 *   - For progetti: each date inside any of their ranges.
 * Yields YYYY-MM-DD strings.
 */
export function studiedDays(exam: Exam): string[] {
  if (exam.kind === "esame") {
    return exam.studyDays.map((s) => s.date);
  }
  const out: string[] = [];
  for (const r of exam.ranges) {
    const start = new Date(r.start);
    const end = new Date(r.end);
    const cursor = new Date(start);
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      out.push(`${y}-${m}-${d}`);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return out;
}

/**
 * Total effective study minutes for an exam, across all its studied days.
 */
export function totalMinutes(exam: Exam, allExams: Exam[]): number {
  return studiedDays(exam).reduce(
    (sum, day) => sum + effectiveMinutes(exam, day, allExams),
    0
  );
}

/**
 * Format minutes as compact "1h30m" / "45m" / "2h" / "" (for 0).
 */
export function formatHM(minutes: number): string {
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

/**
 * Dropdown options for default_study_minutes input.
 * 15-min step from 0 to 480 (8h max). 0 = "no auto-study".
 */
export interface DurationOption {
  value: number;
  label: string;
}

export function durationOptions(): DurationOption[] {
  const out: DurationOption[] = [{ value: 0, label: "Nessun tempo predefinito" }];
  for (let m = 15; m <= 480; m += 15) {
    out.push({ value: m, label: formatHM(m) });
  }
  return out;
}
