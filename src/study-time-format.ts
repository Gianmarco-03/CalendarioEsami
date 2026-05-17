import { ymd, parseYmd } from "./date";

/** Format "1h30m" / "45m" / "2h" / "" (per 0). */
export function formatHM(minutes: number): string {
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

export interface DurationOption {
  value: number;
  label: string;
}

/**
 * Dropdown options for default_study_minutes input.
 * 15-min step from 0 to 480 (8h max). 0 = "no auto-study".
 */
export function durationOptions(): DurationOption[] {
  const out: DurationOption[] = [{ value: 0, label: "Nessun tempo predefinito" }];
  for (let m = 15; m <= 480; m += 15) {
    out.push({ value: m, label: formatHM(m) });
  }
  return out;
}

/** Elenco YYYY-MM-DD inclusivo tra start e end (timezone-safe via parseYmd/ymd locali). */
export function rangeDays(start: string, end: string): string[] {
  const out: string[] = [];
  const cursor = parseYmd(start);
  const stop = parseYmd(end);
  while (cursor <= stop) {
    out.push(ymd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
