import { useMemo, useState } from "react";
import { WEEKDAYS_IT_SHORT, buildMonthGrid } from "../date";
import { CalendarHeader } from "./CalendarHeader";
import { DayCell } from "./DayCell";
import { Legend } from "./Legend";
import { useExams } from "../state";
import { useTasks } from "../tasks-state";
import { tasksByDueDate } from "../task-domain";

interface CalendarProps {
  onDayClick: (key: string) => void;
}

export function Calendar({ onDayClick }: CalendarProps) {
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const grid = buildMonthGrid(view.y, view.m);

  const { exams } = useExams();
  const { tasks } = useTasks();
  const activeExams = exams.filter((e) => !e.passed);
  // Pre-calcolo mappa dueDate → Task[] non-done per evitare scan O(n) per cell.
  const tasksByDate = useMemo(() => tasksByDueDate(tasks), [tasks]);

  const prev = () => setView((v) => v.m === 0 ? { y: v.y - 1, m: 11 } : { ...v, m: v.m - 1 });
  const next = () => setView((v) => v.m === 11 ? { y: v.y + 1, m: 0 } : { ...v, m: v.m + 1 });
  const today = () => setView({ y: new Date().getFullYear(), m: new Date().getMonth() });

  const totalCells = grid.leadingBlanks + grid.days.length;
  const weeks = Math.ceil(totalCells / 7);
  const trailingBlanks = weeks * 7 - totalCells;

  return (
    <div className="cal-wrap">
      <CalendarHeader
        year={grid.year}
        month={grid.month}
        onPrev={prev}
        onNext={next}
        onToday={today}
      />
      <div className="weekdays">
        {WEEKDAYS_IT_SHORT.map((d, i) => (
          <div key={d} className={i >= 5 ? "weekend" : ""}>{d}</div>
        ))}
      </div>
      <div
        className="cal-grid"
        style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: grid.leadingBlanks }).map((_, i) => (
          <div key={`l${i}`} className="cell empty other-month" />
        ))}
        {grid.days.map((d) => (
          <DayCell
            key={d.key}
            day={d}
            exams={activeExams}
            tasksDue={tasksByDate.get(d.key) ?? []}
            onClick={onDayClick}
          />
        ))}
        {Array.from({ length: trailingBlanks }).map((_, i) => (
          <div key={`t${i}`} className="cell empty other-month" />
        ))}
      </div>
      <Legend />
    </div>
  );
}
