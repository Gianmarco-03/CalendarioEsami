import { Flame, Clock, TrendingUp, GraduationCap, CalendarCheck } from "lucide-react";
import type { Exam } from "../../types";
import { dailyActual, currentStreak, bestStreak, type ExamFilter } from "../../study-time";
import { rangeDays, formatHM } from "../../study-time-format";

interface Props {
  exams: Exam[];
  today: string;
  rangeStart: string;
  rangeEnd: string;
  filter: ExamFilter;
  selectedExamId: number | null;
}

export function KpiCards({ exams, today, rangeStart, rangeEnd, filter, selectedExamId }: Props) {
  const streak = currentStreak(exams, today, filter);
  const best = bestStreak(exams, filter);
  const days = rangeDays(rangeStart, rangeEnd);
  const totalActual = days.reduce((s, d) => s + dailyActual(exams, d, filter), 0);
  const avgPerDay = days.length > 0 ? Math.round(totalActual / days.length) : 0;

  // 4° KPI dipende dal contesto:
  // - Globale → "Esami passati X/Y"
  // - Singolo esame → "Giorni studiati N" (in totale, life-time)
  const selectedExam = selectedExamId != null ? exams.find((e) => e.id === selectedExamId) : null;
  const passed = exams.filter((e) => e.passed).length;
  const total = exams.length;
  const studiedDaysCount = selectedExam
    ? selectedExam.studyDays.filter((sd) => (sd.minutes ?? 0) > 0).length
    : 0;

  return (
    <div className="kpi-strip">
      <div className="kpi-card streak">
        <div className="kpi-head">
          <div className="kpi-icon-wrap">
            <span className="flame"><Flame size={15} /></span>
          </div>
          <span className="kpi-label">Streak attuale</span>
        </div>
        <div className="kpi-value">{streak}<span className="kpi-unit">giorni</span></div>
        {best > 0 && <div className="kpi-sub">best: {best}g</div>}
      </div>

      <div className="kpi-card">
        <div className="kpi-head">
          <div className="kpi-icon-wrap"><Clock size={15} /></div>
          <span className="kpi-label">Tot studiato</span>
        </div>
        <div className="kpi-value">{formatHM(totalActual) || "0"}</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-head">
          <div className="kpi-icon-wrap"><TrendingUp size={15} /></div>
          <span className="kpi-label">Media / giorno</span>
        </div>
        <div className="kpi-value">{formatHM(avgPerDay) || "0"}</div>
      </div>

      {selectedExam ? (
        <div className="kpi-card">
          <div className="kpi-head">
            <div className="kpi-icon-wrap"><CalendarCheck size={15} /></div>
            <span className="kpi-label">Giorni studiati</span>
          </div>
          <div className="kpi-value">{studiedDaysCount}<span className="kpi-unit">{selectedExam.passed ? "completato" : "in corso"}</span></div>
        </div>
      ) : (
        <div className="kpi-card">
          <div className="kpi-head">
            <div className="kpi-icon-wrap"><GraduationCap size={15} /></div>
            <span className="kpi-label">Esami passati</span>
          </div>
          <div className="kpi-value">{passed}<span className="kpi-unit">di {total}</span></div>
        </div>
      )}
    </div>
  );
}
