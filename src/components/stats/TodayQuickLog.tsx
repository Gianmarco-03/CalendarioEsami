import { useState } from "react";
import { NotebookPen, ChevronDown, ChevronRight } from "lucide-react";
import type { Exam } from "../../types";
import { useExams } from "../../state";
import { useSuggestedStrategy } from "../../suggested-strategy";
import { isStudying, actualMinutes } from "../../study-time";

interface Props {
  exams: Exam[];
  today: string;
}

export function TodayQuickLog({ exams, today }: Props) {
  const { setStudyDayMinutes } = useExams();
  const strategy = useSuggestedStrategy();
  const studyingToday = exams.filter((e) => !e.passed && isStudying(e, today));
  const [open, setOpen] = useState(studyingToday.length > 0);

  if (studyingToday.length === 0) return null;

  return (
    <div className="quick-log">
      <button
        type="button"
        className="ql-head"
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", background: "transparent", border: 0, padding: 0, cursor: "pointer" }}
      >
        <div className="ql-title">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <NotebookPen size={14} />
          Oggi · Quanto hai studiato?
        </div>
        <div className="ql-sub">{studyingToday.length} attività</div>
      </button>
      {open && (
        <div className="ql-list">
          {studyingToday.map((e) => {
            const current = actualMinutes(e, today);
            const suggested = strategy.compute(e, today, exams);
            return (
              <div key={e.id} className="ql-item">
                <span className="ql-stripe" style={{ background: e.color }} />
                <span className="ql-name">{e.name}</span>
                <input
                  type="number"
                  min={0}
                  max={1440}
                  step={5}
                  className="ql-input"
                  defaultValue={current > 0 ? current : ""}
                  placeholder={String(suggested)}
                  onBlur={(ev) => {
                    const raw = ev.target.value;
                    const m = raw === "" ? null : Math.max(0, Math.min(1440, parseInt(raw, 10) || 0));
                    void setStudyDayMinutes(e.id, today, m);
                  }}
                  aria-label={`Minuti studiati per ${e.name}`}
                />
                <span className="ql-min">m</span>
                <span className="ql-suggested">consigliato {suggested}m</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
