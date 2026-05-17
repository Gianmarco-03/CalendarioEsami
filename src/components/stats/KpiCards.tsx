import { Flame, Clock, TrendingUp, GraduationCap } from "lucide-react";
import type { Exam } from "../../types";
import { dailyActual, currentStreak, bestStreak } from "../../study-time";
import { rangeDays, formatHM } from "../../study-time-format";

interface Props {
  exams: Exam[];
  today: string;
  rangeStart: string;
  rangeEnd: string;
}

export function KpiCards({ exams, today, rangeStart, rangeEnd }: Props) {
  const streak = currentStreak(exams, today);
  const best = bestStreak(exams);
  const days = rangeDays(rangeStart, rangeEnd);
  const totalActual = days.reduce((s, d) => s + dailyActual(exams, d), 0);
  const avgPerDay = days.length > 0 ? Math.round(totalActual / days.length) : 0;
  const passed = exams.filter((e) => e.passed).length;
  const total = exams.length;

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

      <div className="kpi-card">
        <div className="kpi-head">
          <div className="kpi-icon-wrap"><GraduationCap size={15} /></div>
          <span className="kpi-label">Esami passati</span>
        </div>
        <div className="kpi-value">{passed}<span className="kpi-unit">di {total}</span></div>
      </div>
    </div>
  );
}
