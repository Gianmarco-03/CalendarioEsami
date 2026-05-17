import { useMemo, useState } from "react";
import { useExams } from "../state";
import { useSuggestedStrategy } from "../suggested-strategy";
import { dailyTotals, type ExamFilter } from "../study-time";
import { rangeDays } from "../study-time-format";
import { ymd, parseYmd } from "../date";
import { RangeSelector, resolveRange, type StatsRange } from "./stats/RangeSelector";
import type { ChartMode } from "./stats/ChartModeToggle";
import { KpiCards } from "./stats/KpiCards";
import { TodayQuickLog } from "./stats/TodayQuickLog";
import { StudyChart, type DayPoint } from "./stats/StudyChart";
import { YearHeatmap } from "./stats/YearHeatmap";
import { PerExamBars } from "./stats/PerExamBars";
import "./stats/stats-chart.css";

interface Props {
  onDayClick: (dayKey: string) => void;
  selectedExamId: number | null;
}

const WEEKDAYS_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MONTHS_SHORT = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

function formatDayLabel(dayKey: string, range: StatsRange): string {
  const d = parseYmd(dayKey);
  if (range === "7g") return WEEKDAYS_SHORT[(d.getDay() + 6) % 7];
  if (range === "30g" || range === "mese") return String(d.getDate());
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function formatWeekLabel(mondayKey: string): string {
  const d = parseYmd(mondayKey);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function StatsView({ onDayClick, selectedExamId }: Props) {
  const { exams } = useExams();
  const strategy = useSuggestedStrategy();
  const today = ymd(new Date());
  const [range, setRange] = useState<StatsRange>("7g");
  const [mode, setMode] = useState<ChartMode>("line");

  const filter: ExamFilter = useMemo(
    () => selectedExamId == null
      ? (e) => !e.passed
      : (e) => e.id === selectedExamId,
    [selectedExamId]
  );
  const selectedExam = selectedExamId != null ? exams.find((e) => e.id === selectedExamId) : undefined;
  const accentColor = selectedExam?.color;

  const { start, end } = useMemo(() => {
    if (range !== "tutto") return resolveRange(range, today);
    const allDates: string[] = [];
    for (const e of exams) {
      if (!filter(e)) continue;
      for (const sd of e.studyDays) {
        if ((sd.minutes ?? 0) > 0) allDates.push(sd.date);
      }
    }
    if (allDates.length === 0) return { start: today, end: today };
    allDates.sort();
    return { start: allDates[0], end: today };
  }, [range, today, exams, filter]);

  const { data, referenceData, todayIndex } = useMemo(() => {
    const days = rangeDays(start, end);
    const aggregate = days.length > 60;
    if (!aggregate) {
      const data: DayPoint[] = days.map((d) => ({
        date: d,
        label: formatDayLabel(d, range),
        minutes: dailyTotals(exams, d, strategy, filter).actual,
      }));
      const referenceData: DayPoint[] = days.map((d) => ({
        date: d,
        label: formatDayLabel(d, range),
        minutes: dailyTotals(exams, d, strategy, filter).suggested,
      }));
      const idx = days.indexOf(today);
      return { data, referenceData, todayIndex: idx >= 0 ? idx : undefined };
    }
    const buckets = new Map<string, { actual: number; suggested: number }>();
    const order: string[] = [];
    for (const d of days) {
      const dt = parseYmd(d);
      const dow = (dt.getDay() + 6) % 7;
      dt.setDate(dt.getDate() - dow);
      const key = ymd(dt);
      if (!buckets.has(key)) {
        buckets.set(key, { actual: 0, suggested: 0 });
        order.push(key);
      }
      const b = buckets.get(key)!;
      const dt2 = dailyTotals(exams, d, strategy, filter);
      b.actual += dt2.actual;
      b.suggested += dt2.suggested;
    }
    const data: DayPoint[] = order.map((k) => ({
      date: k,
      label: formatWeekLabel(k),
      minutes: buckets.get(k)!.actual,
    }));
    const referenceData: DayPoint[] = order.map((k) => ({
      date: k,
      label: formatWeekLabel(k),
      minutes: buckets.get(k)!.suggested,
    }));
    const todayMonday = (() => {
      const dt = parseYmd(today);
      const dow = (dt.getDay() + 6) % 7;
      dt.setDate(dt.getDate() - dow);
      return ymd(dt);
    })();
    const idx = order.indexOf(todayMonday);
    return { data, referenceData, todayIndex: idx >= 0 ? idx : undefined };
  }, [exams, strategy, start, end, range, today, filter]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-2">
      <div className="stats-toolbar">
        <RangeSelector value={range} onChange={setRange} />
      </div>

      <KpiCards
        exams={exams}
        today={today}
        rangeStart={start}
        rangeEnd={end}
        filter={filter}
        selectedExamId={selectedExamId}
      />

      <TodayQuickLog exams={exams} today={today} selectedExamId={selectedExamId} />

      <StudyChart
        data={data}
        referenceData={referenceData}
        viewMode={mode}
        onViewModeChange={setMode}
        todayIndex={todayIndex}
        title="Effettivo vs Consigliato"
        subtitle={selectedExamId == null
          ? "tempo che hai loggato vs quello suggerito dalla formula"
          : "vista filtrata sull'esame selezionato"}
        animationKey={`${range}-${mode}-${selectedExamId ?? "all"}`}
        accentColor={accentColor}
      />

      <YearHeatmap
        exams={exams}
        year={Number(today.slice(0, 4))}
        onDayClick={onDayClick}
        filter={filter}
        accentColor={accentColor}
      />

      {selectedExamId == null && (
        <PerExamBars exams={exams} rangeStart={start} rangeEnd={end} />
      )}
    </div>
  );
}
