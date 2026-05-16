import { useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, BarChart3, ListTodo } from "lucide-react";

export type AppSection = "calendar" | "stats" | "todo";

interface SectionSwitcherProps {
  active: AppSection;
  onChange: (s: AppSection) => void;
}

interface Item { id: AppSection; label: string; Icon: typeof CalendarDays }
const ITEMS: Item[] = [
  { id: "calendar", label: "Calendario", Icon: CalendarDays },
  { id: "stats", label: "Statistiche", Icon: BarChart3 },
  { id: "todo", label: "To-do", Icon: ListTodo },
];

export function SectionSwitcher({ active, onChange }: SectionSwitcherProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Record<AppSection, HTMLButtonElement | null>>({
    calendar: null, stats: null, todo: null,
  });
  const [pill, setPill] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const btn = btnRefs.current[active];
    const container = containerRef.current;
    if (!btn || !container) return;
    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    setPill({ left: bRect.left - cRect.left, width: bRect.width });
  }, [active]);

  return (
    <div
      ref={containerRef}
      className="relative grid grid-cols-3 gap-0 p-1 bg-app-soft rounded-xl mb-3"
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 rounded-lg glass-panel shadow-sm transition-all duration-300 ease-out"
        style={{ left: pill.left, width: pill.width }}
      />
      {ITEMS.map(({ id, label, Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            ref={(el) => { btnRefs.current[id] = el; }}
            type="button"
            onClick={() => onChange(id)}
            className={
              "relative z-10 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11.5px] font-semibold transition-colors " +
              (isActive ? "text-app-fg" : "text-app-muted hover:text-app-fg")
            }
          >
            <Icon size={13} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
