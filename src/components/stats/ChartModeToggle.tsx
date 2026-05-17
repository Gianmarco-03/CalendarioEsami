import { TrendingUp, BarChart3 } from "lucide-react";

export type ChartMode = "line" | "bars";

interface Props {
  value: ChartMode;
  onChange: (m: ChartMode) => void;
}

export function ChartModeToggle({ value, onChange }: Props) {
  return (
    <div className="mode-toggle" role="group" aria-label="Modalità grafico">
      <button
        type="button"
        onClick={() => onChange("line")}
        className={"mode-btn" + (value === "line" ? " active" : "")}
        aria-pressed={value === "line"}
      >
        <TrendingUp size={13} />
        Linea
      </button>
      <button
        type="button"
        onClick={() => onChange("bars")}
        className={"mode-btn" + (value === "bars" ? " active" : "")}
        aria-pressed={value === "bars"}
      >
        <BarChart3 size={13} />
        Barre
      </button>
    </div>
  );
}
