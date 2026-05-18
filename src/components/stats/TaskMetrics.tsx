import { useMemo } from "react";
import { ListTodo } from "lucide-react";
import { useTasks } from "../../tasks-state";
import type { Exam } from "../../types";
import type { Task } from "../../task-types";
import { countTasks } from "../../task-domain";

interface Props {
  exams: Exam[];
  rangeStart: string;
  rangeEnd: string;
  /** Se settato, restringe metriche e breakdown a quell'esame. null = vista globale. */
  selectedExamId: number | null;
}

interface ExamRow {
  examId: number;
  examName: string;
  examColor: string;
  done: number;
  total: number;
}

function inRangeUpdate(t: Task, start: string, end: string): boolean {
  return t.dueDate != null && t.dueDate >= start && t.dueDate <= end;
}

function buildBreakdown(tasks: Task[], exams: Exam[]): { rows: ExamRow[]; freeDone: number; freeTotal: number } {
  const byExam = new Map<number, ExamRow>();
  let freeDone = 0;
  let freeTotal = 0;
  for (const t of tasks) {
    if (t.examId == null) {
      freeTotal++;
      if (t.done) freeDone++;
      continue;
    }
    const exam = exams.find((e) => e.id === t.examId);
    if (!exam) continue;
    let row = byExam.get(t.examId);
    if (!row) {
      row = { examId: t.examId, examName: exam.name, examColor: exam.color, done: 0, total: 0 };
      byExam.set(t.examId, row);
    }
    row.total++;
    if (t.done) row.done++;
  }
  const rows = Array.from(byExam.values()).sort((a, b) => b.total - a.total);
  return { rows, freeDone, freeTotal };
}

/**
 * KPI compatta + breakdown per esame delle task. Filtra per range (dueDate ∈ [start,end])
 * e per esame se `selectedExamId` è settato.
 */
export function TaskMetrics({ exams, rangeStart, rangeEnd, selectedExamId }: Props) {
  const { tasks } = useTasks();

  const scoped = useMemo(() => {
    return tasks.filter((t) => {
      if (selectedExamId != null && t.examId !== selectedExamId) return false;
      // Task senza dueDate sono incluse solo se sono "in sospeso" (rilevanti)
      if (!t.dueDate) return !t.done;
      return inRangeUpdate(t, rangeStart, rangeEnd);
    });
  }, [tasks, selectedExamId, rangeStart, rangeEnd]);

  const totals = useMemo(() => {
    const done = countTasks(scoped, (t) => t.done);
    const total = scoped.length;
    const urgent = countTasks(scoped, (t) => !t.done && t.priority === "urgent");
    return { done, total, urgent, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [scoped]);

  const { rows, freeDone, freeTotal } = useMemo(
    () => buildBreakdown(scoped, exams),
    [scoped, exams]
  );

  if (totals.total === 0 && freeTotal === 0) {
    return null;
  }

  return (
    <section className="task-metrics">
      <div className="task-metrics-head">
        <div className="task-metrics-title">
          <ListTodo size={14} />
          <span>Task</span>
        </div>
        <span className="task-metrics-range">range corrente</span>
      </div>

      <div className="task-metrics-kpi">
        <div className="kpi-cell">
          <div className="kpi-cell-key">Chiuse</div>
          <div className="kpi-cell-val">{totals.done} <span className="kpi-of">/ {totals.total}</span></div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-cell-key">% completate</div>
          <div className="kpi-cell-val">{totals.pct}%</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-cell-key">Urgent aperte</div>
          <div className={`kpi-cell-val${totals.urgent > 0 ? " danger" : ""}`}>{totals.urgent}</div>
        </div>
      </div>

      <div className="task-metrics-bar">
        <span style={{ width: `${totals.pct}%` }} />
      </div>

      {(rows.length > 0 || freeTotal > 0) && (
        <div className="task-metrics-breakdown">
          {rows.map((r) => (
            <div key={r.examId} className="breakdown-row" style={{ ["--ec" as string]: r.examColor } as React.CSSProperties}>
              <span className="stripe" />
              <span className="name">{r.examName}</span>
              <span className="counts">{r.done}/{r.total}</span>
            </div>
          ))}
          {freeTotal > 0 && (
            <div className="breakdown-row free">
              <span className="stripe" />
              <span className="name">Senza esame</span>
              <span className="counts">{freeDone}/{freeTotal}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
