import { MONTHS_IT } from "../date";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarHeaderProps {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function CalendarHeader({ year, month, onPrev, onNext, onToday }: CalendarHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Mese precedente"
        className="w-[30px] h-[30px] flex items-center justify-center rounded-lg border border-app-input-border bg-app-card text-app-fg hover:bg-app-hover"
      ><ChevronLeft size={18} /></button>
      <span className="flex-1 text-[15px] font-bold capitalize">
        {MONTHS_IT[month]} {year}
      </span>
      <button
        type="button"
        onClick={onToday}
        className="h-[30px] px-2.5 rounded-lg border border-app-input-border bg-app-card text-[12px] font-semibold text-app-fg hover:bg-app-hover"
      >Oggi</button>
      <button
        type="button"
        onClick={onNext}
        aria-label="Mese successivo"
        className="w-[30px] h-[30px] flex items-center justify-center rounded-lg border border-app-input-border bg-app-card text-app-fg hover:bg-app-hover"
      ><ChevronRight size={18} /></button>
    </div>
  );
}
