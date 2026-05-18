import type { Exam } from "../types";
import type { Task } from "../task-types";
import type { MonthGridDay } from "../date";
import { inRange } from "../date";
import { isProgetto } from "../progetto";
import { iconFor } from "../exam-icons";

interface DayCellProps {
  day: MonthGridDay;
  exams: Exam[];
  /** Task con dueDate sul giorno, già filtrate (di solito solo non-done). */
  tasksDue?: Task[];
  onClick: (key: string) => void;
}

interface Activity {
  kind: "project" | "study";
  color: string;
  icon: string;
  examId: number;
  examName: string;
}

interface BannerItem {
  color: string;
  examName: string;
}

interface ProjectEdges {
  start: boolean;
  end: boolean;
  startColor: string | null;
  endColor: string | null;
}

function buildActivities(dayKey: string, exams: Exam[]): Activity[] {
  const projects: Activity[] = [];
  const studies: Activity[] = [];
  for (const e of exams) {
    if (e.passed) continue;
    const isInRange = isProgetto(e) && e.ranges.some((r) => inRange(dayKey, r.start, r.end));
    const hasStudy = e.studyDays.some((s) => s.date === dayKey);
    if (isInRange) {
      projects.push({ kind: "project", color: e.color, icon: e.icon, examId: e.id, examName: e.name });
    } else if (hasStudy) {
      studies.push({ kind: "study", color: e.color, icon: e.icon, examId: e.id, examName: e.name });
    }
  }
  projects.sort((a, b) => a.examName.localeCompare(b.examName));
  studies.sort((a, b) => a.examName.localeCompare(b.examName));
  return [...projects, ...studies];
}

function buildBanners(dayKey: string, exams: Exam[]): BannerItem[] {
  const out: BannerItem[] = [];
  for (const e of exams) {
    if (e.passed) continue;
    for (const a of e.appelli) {
      if (a.date === dayKey) {
        out.push({ color: e.color, examName: e.name });
      }
    }
  }
  out.sort((a, b) => a.examName.localeCompare(b.examName));
  return out;
}

function computeProjectEdges(dayKey: string, exams: Exam[]): ProjectEdges {
  let start = false;
  let end = false;
  let startColor: string | null = null;
  let endColor: string | null = null;
  for (const e of exams) {
    if (e.passed) continue;
    if (!isProgetto(e)) continue;
    for (const r of e.ranges) {
      if (r.start === dayKey) { start = true; startColor = e.color; }
      if (r.end === dayKey)   { end = true;   endColor = e.color; }
    }
  }
  return { start, end, startColor, endColor };
}

export function DayCell({ day, exams, tasksDue = [], onClick }: DayCellProps) {
  const activities = buildActivities(day.key, exams);
  const banners = buildBanners(day.key, exams);
  const edges = computeProjectEdges(day.key, exams);
  const taskCount = tasksDue.length;
  const taskTitle = taskCount > 0
    ? taskCount === 1
      ? `Da fare: ${tasksDue[0].title}`
      : `${taskCount} task da fare`
    : "";

  const splitN = Math.min(activities.length, 4);
  const visibleBanners = banners.slice(0, 2);
  const overflowCount = banners.length - visibleBanners.length;
  const isEmpty = activities.length === 0 && banners.length === 0 && taskCount === 0;
  const isWeekend = day.col >= 5;

  const classes = [
    "cell",
    day.isToday ? "today" : "",
    isEmpty ? "empty" : "",
    isWeekend ? "weekend" : "",
  ].filter(Boolean).join(" ");

  const cellStyle: React.CSSProperties = {};
  if (edges.startColor) (cellStyle as Record<string, string>)["--proj-start-color"] = edges.startColor;
  if (edges.endColor)   (cellStyle as Record<string, string>)["--proj-end-color"]   = edges.endColor;

  return (
    <button
      type="button"
      onClick={() => onClick(day.key)}
      className={classes}
      style={cellStyle}
    >
      <div className="cell-head">
        {day.isToday && <span className="oggi">OGGI</span>}
        <span className="day-num">{day.day}</span>
        {taskCount > 0 && (
          <span className="task-flag" title={taskTitle} aria-label={taskTitle}>
            {taskCount > 1 && <span className="task-flag-count">{taskCount}</span>}
            <span className="task-flag-dot" />
          </span>
        )}
      </div>

      {(visibleBanners.length > 0 || overflowCount > 0) && (
        <div className="banners">
          {visibleBanners.map((b, i) => (
            <div
              key={`b-${i}-${b.examName}`}
              className="banner"
              style={{ ["--bc" as string]: b.color } as React.CSSProperties}
              title={`Appello: ${b.examName}`}
            >
              <span className="banner-dot" />
              <span className="banner-name">{b.examName}</span>
            </div>
          ))}
          {overflowCount > 0 && (
            <div className="banner banner-overflow">+{overflowCount} altri</div>
          )}
        </div>
      )}

      {activities.length > 0 && (
        <div className={`band-area split-${splitN}`}>
          {activities.slice(0, 4).map((a, i) => {
            const Icon = iconFor(a.icon);
            return (
              <div
                key={`a-${i}-${a.examId}`}
                className={`band band-${a.kind}`}
                style={{ ["--bc" as string]: a.color } as React.CSSProperties}
                title={a.kind === "project" ? `Progetto: ${a.examName}` : `Studio: ${a.examName}`}
              >
                <Icon className="band-icon" />
              </div>
            );
          })}
        </div>
      )}

      {edges.start && <span className="proj-stripe-l" />}
      {edges.end && <span className="proj-stripe-r" />}
    </button>
  );
}
