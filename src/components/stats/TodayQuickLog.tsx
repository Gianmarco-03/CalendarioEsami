import { useState } from "react";
import { NotebookPen, ChevronDown, ChevronRight, Plus } from "lucide-react";
import type { Exam } from "../../types";
import { useExams } from "../../state";
import { useSuggestedStrategy } from "../../suggested-strategy";
import { isStudying, actualMinutes } from "../../study-time";
import { isProgetto } from "../../progetto";

interface Props {
  exams: Exam[];
  today: string;
}

export function TodayQuickLog({ exams, today }: Props) {
  const { setStudyDayMinutes, toggleStudyDay } = useExams();
  const strategy = useSuggestedStrategy();
  const [open, setOpen] = useState(true);

  // Tutti gli esami/progetti attivi (non-passed).
  // - Esami: sempre loggabili (auto-toggle implicito).
  // - Progetti con range coprente oggi: loggabili.
  // - Progetti fuori range: visibili ma disabilitati (per design non si possono loggare
  //   fuori dal proprio range — il loro "studio" è implicito dal periodo).
  const items = exams.filter((e) => !e.passed);
  const projectInRange = (e: Exam): boolean =>
    !isProgetto(e) || e.ranges.some((r) => today >= r.start && today <= r.end);

  return (
    <div className="quick-log">
      <button
        type="button"
        className="ql-head"
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", background: "transparent", border: 0, padding: 0, cursor: "pointer" }}
      >
        <div className="ql-title">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <NotebookPen size={14} />
          Oggi · Quanto hai studiato?
        </div>
        <div className="ql-sub">{items.length === 0 ? "nessun esame attivo" : `${items.length} esame${items.length === 1 ? "" : "/i"}`}</div>
      </button>
      {open && (
        items.length === 0 ? (
          <div className="ql-empty">
            Nessun esame attivo. Crea un esame o progetto dalla barra laterale.
          </div>
        ) : (
          <div className="ql-list">
            {items.map((e) => (
              <QuickLogRow
                key={e.id}
                exam={e}
                today={today}
                exams={exams}
                studying={isStudying(e, today)}
                disabled={!projectInRange(e)}
                strategy={strategy}
                onToggle={() => void toggleStudyDay(e.id, today)}
                onSetMinutes={(m) => void setStudyDayMinutes(e.id, today, m)}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

interface RowProps {
  exam: Exam;
  today: string;
  exams: Exam[];
  studying: boolean;
  disabled: boolean;
  strategy: { compute: (e: Exam, d: string, all: Exam[]) => number };
  onToggle: () => void;
  onSetMinutes: (m: number | null) => void;
}

function QuickLogRow({ exam, today, exams, studying, disabled, strategy, onToggle, onSetMinutes }: RowProps) {
  const current = actualMinutes(exam, today);
  const suggested = strategy.compute(exam, today, exams);
  const isProj = isProgetto(exam);

  const handleBlur = (ev: React.FocusEvent<HTMLInputElement>) => {
    const raw = ev.target.value;
    const m = raw === "" ? null : Math.max(0, Math.min(1440, parseInt(raw, 10) || 0));
    // Per esami non-studying: prima toggle, poi set minuti.
    // Per progetti in-range: l'upsert backend gestisce direttamente.
    if (!studying && !isProj && m !== null) {
      onToggle();
      setTimeout(() => onSetMinutes(m), 50);
    } else {
      onSetMinutes(m);
    }
  };

  const className = "ql-item" + (disabled ? " ql-item--disabled" : "");

  return (
    <div className={className}>
      <span className="ql-stripe" style={{ background: exam.color }} />
      <span className="ql-name">{exam.name}</span>
      {!studying && !isProj && !disabled && (
        <span className="ql-hint" title="Verrà attivato lo studio per oggi quando inserisci i minuti">
          <Plus size={11} /> nuovo
        </span>
      )}
      {disabled && (
        <span className="ql-hint" title="Il range del progetto non copre oggi — non puoi loggare studio fuori dal periodo">
          fuori range
        </span>
      )}
      <input
        type="number"
        min={0}
        max={1440}
        step={5}
        className="ql-input"
        defaultValue={current > 0 ? current : ""}
        placeholder={disabled ? "—" : String(suggested)}
        disabled={disabled}
        onBlur={handleBlur}
        aria-label={`Minuti studiati per ${exam.name}`}
      />
      <span className="ql-min">m</span>
      <span className="ql-suggested">
        {disabled ? "—" : `consigliato ${suggested}m`}
      </span>
    </div>
  );
}
