import type { Exam, Progetto } from "./types";

export function isProgetto(e: Exam): e is Progetto {
  return e.kind === "progetto";
}

export function expandRanges(p: Progetto): string[] {
  const seen = new Set<string>();
  for (const r of p.ranges) {
    const start = new Date(r.start);
    const end = new Date(r.end);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;
    const cursor = new Date(start);
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      seen.add(`${y}-${m}-${d}`);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return Array.from(seen).sort();
}

export function totalRangeDays(p: Progetto): number {
  return expandRanges(p).length;
}

export function dateInAnyRange(p: Progetto, dayKey: string): boolean {
  return p.ranges.some((r) => dayKey >= r.start && dayKey <= r.end);
}

export interface ProjectEdges {
  start: boolean;
  end: boolean;
  startColor: string | null;
  endColor: string | null;
}

export function computeProjectEdges(p: Progetto, dayKey: string): ProjectEdges {
  let start = false;
  let end = false;
  let startColor: string | null = null;
  let endColor: string | null = null;
  for (const r of p.ranges) {
    if (r.start === dayKey) { start = true; startColor = p.color; }
    if (r.end === dayKey)   { end = true;   endColor = p.color; }
  }
  return { start, end, startColor, endColor };
}
