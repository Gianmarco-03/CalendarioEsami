import { useLayoutEffect, useRef, useState } from "react";
import { ymd, parseYmd } from "../../date";

export type StatsRange = "7g" | "30g" | "mese" | "anno" | "tutto";

interface RangeOption {
  id: StatsRange;
  label: string;
}

const OPTIONS: RangeOption[] = [
  { id: "7g", label: "7g" },
  { id: "30g", label: "30g" },
  { id: "mese", label: "Mese" },
  { id: "anno", label: "Anno" },
  { id: "tutto", label: "Tutto" },
];

interface Props {
  value: StatsRange;
  onChange: (r: StatsRange) => void;
}

export function RangeSelector({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Record<StatsRange, HTMLButtonElement | null>>({
    "7g": null, "30g": null, mese: null, anno: null, tutto: null,
  });
  const [pill, setPill] = useState<{ left: number; width: number }>({ left: 4, width: 0 });

  useLayoutEffect(() => {
    const btn = btnRefs.current[value];
    const container = containerRef.current;
    if (!btn || !container) return;
    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    setPill({ left: bRect.left - cRect.left, width: bRect.width });
  }, [value]);

  return (
    <div ref={containerRef} className="range-pills">
      <span
        aria-hidden
        className="range-pill-bg"
        style={{ left: pill.left, width: pill.width }}
      />
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          ref={(el) => { btnRefs.current[opt.id] = el; }}
          type="button"
          onClick={() => onChange(opt.id)}
          className={"range-pill" + (opt.id === value ? " active" : "")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function resolveRange(range: StatsRange, today: string): { start: string; end: string } {
  const todayDate = parseYmd(today);
  if (range === "7g") {
    const start = new Date(todayDate);
    start.setDate(start.getDate() - 6);
    return { start: ymd(start), end: today };
  }
  if (range === "30g") {
    const start = new Date(todayDate);
    start.setDate(start.getDate() - 29);
    return { start: ymd(start), end: today };
  }
  if (range === "mese") {
    const y = todayDate.getFullYear();
    const m = todayDate.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    return { start: ymd(new Date(y, m, 1)), end: ymd(new Date(y, m, lastDay)) };
  }
  if (range === "anno") {
    const y = todayDate.getFullYear();
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }
  return { start: "1970-01-01", end: today };
}
