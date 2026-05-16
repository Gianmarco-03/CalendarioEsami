import { useState } from "react";
import { WEEKDAYS_IT_SHORT, buildMonthGrid } from "../date";
import { CalendarHeader } from "./CalendarHeader";
import { DayCell } from "./DayCell";
import { Legend } from "./Legend";
import { useExams } from "../state";

interface CalendarProps {
  onDayClick: (key: string) => void;
}

export function Calendar({ onDayClick }: CalendarProps) {
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const grid = buildMonthGrid(view.y, view.m);

  const { exams } = useExams();
  const activeExams = exams.filter((e) => !e.passed);

  const prev = () => setView((v) => v.m === 0 ? { y: v.y - 1, m: 11 } : { ...v, m: v.m - 1 });
  const next = () => setView((v) => v.m === 11 ? { y: v.y + 1, m: 0 } : { ...v, m: v.m + 1 });
  const today = () => setView({ y: new Date().getFullYear(), m: new Date().getMonth() });

  return (
    <div>
      <CalendarHeader
        year={grid.year}
        month={grid.month}
        onPrev={prev}
        onNext={next}
        onToday={today}
      />
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEKDAYS_IT_SHORT.map((d) => (
          <div key={d} className="text-[10.5px] font-bold text-app-muted uppercase tracking-wide text-center">{d}</div>
        ))}
      </div>
      <div
        className="grid grid-cols-7 gap-1.5 auto-rows-fr"
        style={{ gridAutoRows: "minmax(94px, 1fr)" }}
      >
        {Array.from({ length: grid.leadingBlanks }).map((_, i) => (
          <div key={`b${i}`} className="border border-transparent bg-transparent" />
        ))}
        {grid.days.map((d) => (
          <DayCell key={d.key} day={d} exams={activeExams} onClick={onDayClick} />
        ))}
      </div>
      <Legend />
    </div>
  );
}
