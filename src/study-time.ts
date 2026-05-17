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

/**
 * Predicato per filtrare gli esami da aggregare. Default: tutti i non-passed.
 * Per view per-esame: passare `e => e.id === selectedId`.
 * `allExams` resta sempre il set completo (usato dal contesto strategy per t/n).
 */
export type ExamFilter = (e: Exam) => boolean;
const defaultFilter: ExamFilter = (e) => !e.passed;

/** Somma minuti effettivi del giorno across gli esami che matchano `filter` e studiano D. */
export function dailyActual(allExams: Exam[], dayKey: string, filter: ExamFilter = defaultFilter): number {
  let sum = 0;
  for (const e of allExams) {
    if (!filter(e)) continue;
    if (!isStudying(e, dayKey)) continue;
    sum += actualMinutes(e, dayKey);
  }
  return sum;
}

/** Somma minuti consigliati del giorno (delegando alla strategia). `allExams` per contesto t/n. */
export function dailySuggested(
  allExams: Exam[],
  dayKey: string,
  strategy: SuggestedStrategy,
  filter: ExamFilter = defaultFilter
): number {
  let sum = 0;
  for (const e of allExams) {
    if (!filter(e)) continue;
    if (!isStudying(e, dayKey)) continue;
    sum += strategy.compute(e, dayKey, allExams);
  }
  return sum;
}

/** Coppia effettivo/consigliato (composizione). */
export function dailyTotals(
  allExams: Exam[],
  dayKey: string,
  strategy: SuggestedStrategy,
  filter: ExamFilter = defaultFilter
): { actual: number; suggested: number } {
  return {
    actual: dailyActual(allExams, dayKey, filter),
    suggested: dailySuggested(allExams, dayKey, strategy, filter),
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
export function currentStreak(allExams: Exam[], today: string, filter: ExamFilter = defaultFilter): number {
  let count = 0;
  const cursor = parseYmd(today);
  while (count <= 365 * 3) {
    const key = ymd(cursor);
    if (dailyActual(allExams, key, filter) > 0) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return count;
}

/** Best streak su tutto lo storico (giorni con minuti > 0) per gli esami filtrati. */
export function bestStreak(allExams: Exam[], filter: ExamFilter = defaultFilter): number {
  const dates = new Set<string>();
  for (const e of allExams) {
    if (!filter(e)) continue;
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
