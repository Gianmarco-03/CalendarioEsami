import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Exam } from "../../types";
import { useSuggestedStrategy } from "../../suggested-strategy";
import { actualMinutes, studiedDays } from "../../study-time";
import { formatHM, rangeDays } from "../../study-time-format";

interface Props {
  exams: Exam[];
  rangeStart: string;
  rangeEnd: string;
}

interface ExamStat {
  exam: Exam;
  actual: number;
  suggested: number;
}

export function PerExamBars({ exams, rangeStart, rangeEnd }: Props) {
  const strategy = useSuggestedStrategy();
  const [showPassed, setShowPassed] = useState(false);

  const { active, passed, maxBar } = useMemo(() => {
    const days = new Set(rangeDays(rangeStart, rangeEnd));
    const compute = (e: Exam): ExamStat => {
      let actual = 0;
      let suggested = 0;
      for (const d of studiedDays(e)) {
        if (!days.has(d)) continue;
        actual += actualMinutes(e, d);
        suggested += strategy.compute(e, d, exams);
      }
      return { exam: e, actual, suggested };
    };
    const activeStats = exams.filter((e) => !e.passed).map(compute);
    activeStats.sort((a, b) => b.actual - a.actual);
    const passedStats = exams.filter((e) => e.passed).map(compute);
    passedStats.sort((a, b) => b.actual - a.actual);
    const maxBar = Math.max(
      0,
      ...activeStats.map((s) => Math.max(s.actual, s.suggested)),
      ...passedStats.map((s) => Math.max(s.actual, s.suggested))
    );
    return { active: activeStats, passed: passedStats, maxBar };
  }, [exams, rangeStart, rangeEnd, strategy]);

  if (active.length === 0 && passed.length === 0) return null;

  return (
    <div className="per-exam">
      <div className="pe-title">Per esame</div>
      {active.map((s) => <ExamBarRow key={s.exam.id} stat={s} maxBar={maxBar} />)}

      {passed.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowPassed((v) => !v)}
            className="pe-title"
            style={{
              marginTop: 16, background: "transparent", border: 0, padding: 0,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {showPassed ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Completati ({passed.length})
          </button>
          {showPassed && passed.map((s) => <ExamBarRow key={s.exam.id} stat={s} maxBar={maxBar} />)}
        </>
      )}
    </div>
  );
}

function ExamBarRow({ stat, maxBar }: { stat: ExamStat; maxBar: number }) {
  const { exam, actual, suggested } = stat;
  const refW = maxBar > 0 ? (suggested / maxBar) * 100 : 0;
  const actW = maxBar > 0 ? (actual / maxBar) * 100 : 0;
  const pct = suggested > 0 ? Math.round((actual / suggested) * 100) : null;

  return (
    <div className="pe-row">
      <div className="pe-head">
        <div className="pe-name">
          <span className="pe-dot" style={{ background: exam.color }} />
          {exam.name}
        </div>
        <div className="pe-numbers">
          <span className="strong">{formatHM(actual) || "0m"}</span>
          {suggested > 0 && (
            <> / {formatHM(suggested)} consigliate{pct !== null && <> · {pct}%</>}</>
          )}
        </div>
      </div>
      <div className="pe-bar-bg">
        <div className="pe-bar-ref" style={{ width: `${refW}%` }} />
        <div className="pe-bar-actual" style={{ width: `${actW}%`, background: exam.color }} />
      </div>
    </div>
  );
}
