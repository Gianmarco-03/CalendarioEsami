import { MONTHS_IT } from "../date";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarHeaderProps {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const WEEKDAYS_IT_LONG = [
  "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica",
];

function todaySubtitle(): string {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  const month = MONTHS_IT[d.getMonth()].toLowerCase();
  return `${WEEKDAYS_IT_LONG[dow]} ${d.getDate()} ${month}`;
}

function academicYear(year: number, month: number): string {
  // L'anno accademico inizia a settembre. Per gennaio-agosto del 2026 → A.A. 2025-26.
  const aaStart = month >= 8 ? year : year - 1;
  const aaEnd = (aaStart + 1) % 100;
  return `A.A. ${aaStart}–${String(aaEnd).padStart(2, "0")}`;
}

export function CalendarHeader({ year, month, onPrev, onNext, onToday }: CalendarHeaderProps) {
  return (
    <div className="page-head">
      <div className="left">
        <div className="kicker">Calendario · {academicYear(year, month)}</div>
        <h1 className="title">
          {MONTHS_IT[month]}
          <span className="year"> {year}</span>
        </h1>
        <div className="subtitle">
          <span className="live-dot" />
          <span>oggi è {todaySubtitle()}</span>
          <span className="sep">·</span>
          <span>clicca un giorno per loggare lo studio</span>
        </div>
      </div>
      <div className="header-actions">
        <button type="button" className="nav-btn" onClick={onPrev} aria-label="Mese precedente">
          <ChevronLeft size={16} />
        </button>
        <button type="button" className="today-btn" onClick={onToday}>Oggi</button>
        <button type="button" className="nav-btn" onClick={onNext} aria-label="Mese successivo">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
