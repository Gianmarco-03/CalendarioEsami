import { MONTHS_IT } from "../date";

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
        className="w-[30px] h-[30px] flex items-center justify-center rounded-lg border border-[#d6d9e0] bg-white text-[#2f3545] hover:bg-[#f4f5f7]"
      >‹</button>
      <span className="flex-1 text-[15px] font-bold capitalize">
        {MONTHS_IT[month]} {year}
      </span>
      <button
        type="button"
        onClick={onToday}
        className="h-[30px] px-2.5 rounded-lg border border-[#d6d9e0] bg-white text-[12px] font-semibold text-[#2f3545] hover:bg-[#f4f5f7]"
      >Oggi</button>
      <button
        type="button"
        onClick={onNext}
        aria-label="Mese successivo"
        className="w-[30px] h-[30px] flex items-center justify-center rounded-lg border border-[#d6d9e0] bg-white text-[#2f3545] hover:bg-[#f4f5f7]"
      >›</button>
    </div>
  );
}
