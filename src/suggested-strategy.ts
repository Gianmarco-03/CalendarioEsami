import { createContext, useContext } from "react";
import type { Exam } from "./types";
import { countPresences } from "./study-time";

/**
 * Strategia per calcolare i "minuti consigliati" per (esame, giorno).
 * Implementazione di default: t/n. Estendibile (coach AI, pesi, formula adattiva)
 * senza modificare i consumer.
 */
export interface SuggestedStrategy {
  /** Etichetta umana per UI / tooltip (es. "t/n", "Coach AI"). */
  readonly label: string;
  /** Minuti consigliati per studiare `exam` il giorno `dayKey`, dato il contesto `allExams`. */
  compute(exam: Exam, dayKey: string, allExams: Exam[]): number;
}

/** Strategia di default: t/n (t = defaultStudyMinutes, n = countPresences). */
export const tOverNStrategy: SuggestedStrategy = {
  label: "t/n",
  compute(exam, dayKey, allExams) {
    const t = exam.defaultStudyMinutes;
    if (t === 0) return 0;
    const n = countPresences(dayKey, allExams);
    if (n === 0) return 0;
    return Math.round(t / n);
  },
};

export const SuggestedStrategyContext = createContext<SuggestedStrategy>(tOverNStrategy);
export const useSuggestedStrategy = (): SuggestedStrategy => useContext(SuggestedStrategyContext);
