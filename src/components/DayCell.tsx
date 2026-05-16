import type { Exam } from "../types";
import { inRange, tint } from "../date";
import type { MonthGridDay } from "../date";
import { Pin } from "lucide-react";

interface DayCellProps {
  day: MonthGridDay;
  exams: Exam[]; // active only
  onClick: (key: string) => void;
}

interface ProjectHit { exam: Exam; start: string; end: string }

export function DayCell({ day, exams, onClick }: DayCellProps) {
  const studyExams = exams.filter((e) =>
    e.kind === "esame" && e.studyDays.some((s) => s.date === day.key)
  );
  const projHits: ProjectHit[] = [];
  for (const e of exams) {
    if (e.kind !== "progetto") continue;
    for (const r of e.ranges) {
      if (inRange(day.key, r.start, r.end)) {
        projHits.push({ exam: e, start: r.start, end: r.end });
      }
    }
  }
  const appelliToday = exams.filter((e) =>
    e.kind === "esame" && e.appelli.some((a) => a.date === day.key)
  );

  const colored: Exam[] = [];
  for (const e of studyExams) if (!colored.includes(e)) colored.push(e);
  for (const h of projHits) if (!colored.includes(h.exam)) colored.push(h.exam);

  let bg: string | undefined;
  if (colored.length === 1) {
    bg = tint(colored[0].color, 0.30);
  } else if (colored.length > 1) {
    const step = 100 / colored.length;
    const stops = colored.map((e, i) =>
      `${tint(e.color, 0.34)} ${i * step}% ${(i + 1) * step}%`
    ).join(", ");
    bg = `linear-gradient(135deg, ${stops})`;
  }

  return (
    <button
      type="button"
      onClick={() => onClick(day.key)}
      style={bg ? { background: bg } : undefined}
      className={
        "relative w-full h-full min-h-[94px] p-1 border border-app-border rounded-lg bg-app-card text-app-fg text-left overflow-hidden " +
        "hover:outline hover:outline-2 hover:outline-app-muted hover:outline-offset-[-2px]"
      }
    >
      <div className={
        "text-[11.5px] font-semibold " +
        (day.isToday
          ? "bg-app-accent text-app-accent-fg w-[19px] h-[19px] rounded-full flex items-center justify-center"
          : "text-app-muted")
      }>{day.day}</div>

      {projHits.map((h, idx) => {
        const isStart = h.start === day.key;
        const isEnd = h.end === day.key;
        const showLabel = isStart || day.col === 0 || day.day === 1;
        return (
          <div
            key={`p${idx}-${h.exam.id}`}
            className="-mx-1 px-1.5 py-[1.5px] text-[9px] font-bold text-white leading-snug truncate"
            style={{
              background: h.exam.color,
              borderTopLeftRadius: isStart ? 5 : 0,
              borderBottomLeftRadius: isStart ? 5 : 0,
              borderTopRightRadius: isEnd ? 5 : 0,
              borderBottomRightRadius: isEnd ? 5 : 0,
              marginTop: idx === 0 ? 3 : 0,
            }}
            title={`Progetto: ${h.exam.name}`}
          >{showLabel ? h.exam.name : " "}</div>
        );
      })}

      {studyExams.length > 0 && (
        <div className="absolute top-1 right-1 flex gap-0.5 flex-wrap max-w-[50%] justify-end">
          {studyExams.map((e) => (
            <span
              key={e.id}
              className="w-[7px] h-[7px] rounded-full"
              style={{ background: e.color, boxShadow: "0 0 0 1px rgba(255,255,255,0.7)" }}
              title={`Studio: ${e.name}`}
            />
          ))}
        </div>
      )}

      {appelliToday.length > 0 && (
        <div className="absolute left-[3px] right-[3px] bottom-[3px] flex flex-col gap-[2px]">
          {appelliToday.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-1 text-[9px] font-bold text-white px-1 py-px rounded truncate"
              style={{ background: e.color }}
              title={`Appello: ${e.name}`}
            ><Pin size={8} className="shrink-0" /> <span className="truncate">{e.name}</span></div>
          ))}
        </div>
      )}
    </button>
  );
}
