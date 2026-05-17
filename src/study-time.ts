import type { Exam } from "./types";
import type { SuggestedStrategy } from "./suggested-strategy";
import { isProgetto, expandRanges } from "./progetto";
import { ymd, parseYmd } from "./date";

/**
 * Count "study activities" active on a given day, DISTINCT per exam:
 *   - +1 per active exam with EITHER a studyDay on this date OR a range covering it.
 * Identical semantics to Rust's db::exams::count_presences (DISTINCT by exam ID).
 */
export function countPresences(dayKey: string, exams: Exam[]): number {
  let n = 0;
  for (const e of exams) {
    if (e.passed) continue;
    const hasStudy = e.studyDays.some((s) => s.date === dayKey);
    const hasRange = isProgetto(e) && e.ranges.some((r) => dayKey >= r.start && dayKey <= r.end);
    if (hasStudy || hasRange) n++;
  }
  return n;
}

/** True se l'esame "studia" il giorno (toggle oppure range progetto). */
export function isStudying(exam: Exam, dayKey: string): boolean {
  if (exam.studyDays.some((s) => s.date === dayKey)) return true;
  if (isProgetto(exam) && exam.ranges.some((r) => dayKey >= r.start && dayKey <= r.end)) return true;
  return false;
}

/** Minuti effettivamente loggati (0 se non quantificato). */
export function actualMinutes(exam: Exam, dayKey: string): number {
  return exam.studyDays.find((s) => s.date === dayKey)?.minutes ?? 0;
}

/**
 * Iterate every day where `exam` is "being studied":
 *   - Always include manual studyDay entries.
 *   - For progetti: also include every date inside any range (deduped).
 * Yields YYYY-MM-DD strings.
 */
export function studiedDays(exam: Exam): string[] {
  const base = exam.studyDays.map((s) => s.date);
  if (isProgetto(exam)) {
    return Array.from(new Set([...base, ...expandRanges(exam)]));
  }
  return base;
}

/** Somma minuti effettivi del giorno across tutti gli esami attivi che studiano D. */
export function dailyActual(allExams: Exam[], dayKey: string): number {
  let sum = 0;
  for (const e of allExams) {
    if (e.passed) continue;
    if (!isStudying(e, dayKey)) continue;
    sum += actualMinutes(e, dayKey);
  }
  return sum;
}

/** Somma minuti consigliati del giorno (delegando alla strategia). */
export function dailySuggested(
  allExams: Exam[],
  dayKey: string,
  strategy: SuggestedStrategy
): number {
  let sum = 0;
  for (const e of allExams) {
    if (e.passed) continue;
    if (!isStudying(e, dayKey)) continue;
    sum += strategy.compute(e, dayKey, allExams);
  }
  return sum;
}

/** Coppia effettivo/consigliato (composizione). */
export function dailyTotals(
  allExams: Exam[],
  dayKey: string,
  strategy: SuggestedStrategy
): { actual: number; suggested: number } {
  return {
    actual: dailyActual(allExams, dayKey),
    suggested: dailySuggested(allExams, dayKey, strategy),
  };
}

/** Totale consigliato per un esame su tutti i suoi studied days. */
export function suggestedTotalMinutes(
  exam: Exam,
  allExams: Exam[],
  strategy: SuggestedStrategy
): number {
  return studiedDays(exam).reduce(
    (s, d) => s + strategy.compute(exam, d, allExams),
    0
  );
}

/** Streak corrente: giorni consecutivi fino a oggi con dailyActual > 0. */
export function currentStreak(allExams: Exam[], today: string): number {
  let count = 0;
  const cursor = parseYmd(today);
  while (count <= 365 * 3) {
    const key = ymd(cursor);
    if (dailyActual(allExams, key) > 0) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return count;
}

/** Best streak su tutto lo storico (giorni con minuti > 0). */
export function bestStreak(allExams: Exam[]): number {
  const dates = new Set<string>();
  for (const e of allExams) {
    if (e.passed) continue;
    for (const sd of e.studyDays) {
      if ((sd.minutes ?? 0) > 0) dates.add(sd.date);
    }
  }
  if (dates.size === 0) return 0;
  const sorted = Array.from(dates).sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseYmd(sorted[i - 1]);
    const next = parseYmd(sorted[i]);
    const diff = (+next - +prev) / 86_400_000;
    if (diff === 1) {
      cur++;
      best = Math.max(best, cur);
    } else {
      cur = 1;
    }
  }
  return best;
}
