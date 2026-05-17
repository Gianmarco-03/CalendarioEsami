import { useMemo } from "react";
import type { Exam } from "../../types";
import { dailyTotals, type ExamFilter } from "../../study-time";
import { useSuggestedStrategy } from "../../suggested-strategy";
import { formatHM } from "../../study-time-format";
import { ymd, parseYmd } from "../../date";

interface Props {
  exams: Exam[];
  year: number;
  onDayClick: (dayKey: string) => void;
  filter?: ExamFilter;
  /** Quando fornito, le celle usano questo colore (con varianti di alpha). */
  accentColor?: string;
}

const MONTH_LETTERS = ["G", "F", "M", "A", "M", "G", "L", "A", "S", "O", "N", "D"];

interface CellData {
  date: string;
  actual: number;
  suggested: number;
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

export function YearHeatmap({ exams, year, onDayClick, filter, accentColor }: Props) {
  const strategy = useSuggestedStrategy();
  const today = ymd(new Date());

  // Quando accentColor è fornito, le 5 classi hm-* sono sovrascritte inline
  // (color-mix per le tinte intermedie + colore pieno al livello 4).
  const cellStyleFor = (level: 0 | 1 | 2 | 3 | 4): React.CSSProperties | undefined => {
    if (!accentColor) return undefined;
    const alphaByLevel = ["0.08", "0.30", "0.55", "0.80", "1"][level];
    return { background: `color-mix(in srgb, ${accentColor} ${Number(alphaByLevel) * 100}%, transparent)` };
  };

  const { weeks, monthMarkers } = useMemo(() => {
    const jan1 = new Date(year, 0, 1);
    const dec31 = new Date(year, 11, 31);
    const dow = (jan1.getDay() + 6) % 7;
    const startMonday = new Date(jan1);
    startMonday.setDate(jan1.getDate() - dow);

    let maxActual = 0;
    const cells: (CellData | null)[][] = [];
    const cursor = new Date(startMonday);
    while (cursor <= dec31) {
      const week: (CellData | null)[] = [];
      for (let d = 0; d < 7; d++) {
        if (cursor.getFullYear() !== year) {
          week.push(null);
        } else {
          const key = ymd(cursor);
          const { actual, suggested } = dailyTotals(exams, key, strategy, filter);
          if (actual > maxActual) maxActual = actual;
          const future = key > today;
          week.push({ date: key, actual, suggested, level: 0, future });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      cells.push(week);
    }

    if (maxActual > 0) {
      for (const w of cells) {
        for (const c of w) {
          if (!c || c.future) continue;
          const ratio = c.actual / maxActual;
          if (ratio === 0) c.level = 0;
          else if (ratio < 0.25) c.level = 1;
          else if (ratio < 0.5) c.level = 2;
          else if (ratio < 0.75) c.level = 3;
          else c.level = 4;
        }
      }
    }

    const monthCols: (string | null)[] = cells.map((w) => {
      const first = w.find((c) => c && parseYmd(c.date).getDate() <= 7);
      if (!first) return null;
      const d = parseYmd(first.date);
      if (d.getDate() <= 7) return MONTH_LETTERS[d.getMonth()];
      return null;
    });

    return { weeks: cells, monthMarkers: monthCols };
  }, [exams, year, strategy, today, filter]);

  return (
    <div className="heatmap-section">
      <div className="heatmap-head">
        <div className="stats-chart__title">{year} · Heatmap studio</div>
        <div className="heatmap-legend">
          meno
          <div className="heatmap-legend-cells">
            <div className="hm-cell hm-0" style={cellStyleFor(0)} />
            <div className="hm-cell hm-1" style={cellStyleFor(1)} />
            <div className="hm-cell hm-2" style={cellStyleFor(2)} />
            <div className="hm-cell hm-3" style={cellStyleFor(3)} />
            <div className="hm-cell hm-4" style={cellStyleFor(4)} />
          </div>
          più
        </div>
      </div>
      <div
        className="heatmap-grid"
        style={{ gridTemplateColumns: `24px repeat(${weeks.length}, minmax(8px, 1fr))` }}
      >
        <div />
        {monthMarkers.map((m, i) => (
          <div key={`mh-${i}`} className="heatmap-month">{m ?? ""}</div>
        ))}
        {[0, 1, 2, 3, 4, 5, 6].map((row) => (
          <RowFragment key={row} row={row} weeks={weeks} onDayClick={onDayClick} cellStyleFor={cellStyleFor} />
        ))}
      </div>
    </div>
  );
}

function RowFragment({
  row, weeks, onDayClick, cellStyleFor,
}: {
  row: number;
  weeks: (CellData | null)[][];
  onDayClick: (d: string) => void;
  cellStyleFor: (level: 0 | 1 | 2 | 3 | 4) => React.CSSProperties | undefined;
}) {
  const labels = ["", "M", "", "G", "", "S", ""];
  return (
    <>
      <div className="heatmap-day-label">{labels[row]}</div>
      {weeks.map((w, wi) => {
        const cell = w[row];
        if (!cell) return <div key={`empty-${wi}-${row}`} />;
        const title = cell.future
          ? cell.date
          : `${cell.date} · ${formatHM(cell.actual) || "0m"} studiati${cell.suggested > 0 ? ` (consigliato ${formatHM(cell.suggested)})` : ""}`;
        const level = cell.future ? 0 : cell.level;
        return (
          <div
            key={`${wi}-${row}`}
            className={`hm-cell hm-${level}`}
            style={cellStyleFor(level)}
            title={title}
            onClick={() => !cell.future && onDayClick(cell.date)}
            role="button"
            aria-label={title}
          />
        );
      })}
    </>
  );
}
