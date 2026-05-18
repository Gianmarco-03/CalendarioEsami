import { useExams } from "../state";
import { inRange, parseYmd, ymd } from "../date";
import { Modal } from "./Modal";
import { ModalButton } from "./ModalButton";
import { Clock, Calendar } from "lucide-react";
import { useSuggestedStrategy } from "../suggested-strategy";
import { isProgetto } from "../progetto";

interface DayModalProps {
  open: boolean;
  dayKey: string | null;
  onClose: () => void;
}

interface InfoLine {
  color: string;
  text: string;
  kind: "Appello" | "Progetto in corso";
}

export function DayModal({ open, dayKey, onClose }: DayModalProps) {
  const { exams, toggleStudyDay, setStudyDayMinutes } = useExams();
  const strategy = useSuggestedStrategy();
  if (!dayKey) return null;

  const date = parseYmd(dayKey);
  const titleRaw = date.toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const title = titleRaw.charAt(0).toUpperCase() + titleRaw.slice(1);

  const todayKey = ymd(new Date());
  const isToday = dayKey === todayKey;

  const active = exams.filter((e) => !e.passed);
  const infoLines: InfoLine[] = [];
  for (const e of active) {
    for (const a of e.appelli) {
      if (a.date === dayKey) {
        infoLines.push({ color: e.color, text: e.name, kind: "Appello" });
      }
    }
    if (isProgetto(e)) {
      if (e.ranges.some((r) => inRange(dayKey, r.start, r.end))) {
        infoLines.push({ color: e.color, text: e.name, kind: "Progetto in corso" });
      }
    }
  }

  const footer = (
    <>
      <span style={{
        flex: 1,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--muted)",
        letterSpacing: "0.04em",
      }}>
        ESC chiudi
      </span>
      <ModalButton variant="primary" onClick={onClose}>Chiudi</ModalButton>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      kicker={isToday ? "Oggi" : "Giornata"}
      icon={Calendar}
      size="md"
      footer={footer}
    >
      {infoLines.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {infoLines.map((ln, i) => (
            <div
              key={i}
              className="info-line"
              style={{ ["--ic" as string]: ln.color } as React.CSSProperties}
            >
              <span className="dot" />
              <span>{ln.text}</span>
              <span className="kind">{ln.kind}</span>
            </div>
          ))}
        </div>
      )}

      {active.length === 0 ? (
        <div className="sidebar-hint" style={{ padding: "8px 0" }}>
          {infoLines.length > 0
            ? "Nessun esame per cui segnare lo studio."
            : "Nessun esame attivo. Aggiungine uno dalla barra laterale."}
        </div>
      ) : (
        <>
          <div className="nx-label" style={{ marginTop: 4 }}>
            Sto studiando per…
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {active.map((e) => {
              const studyEntry = e.studyDays.find((s) => s.date === dayKey);
              const studying = !!studyEntry;
              const suggested = strategy.compute(e, dayKey, active);
              return (
                <div
                  key={e.id}
                  className="study-row"
                  style={{ ["--ec" as string]: e.color } as React.CSSProperties}
                >
                  <span className="stripe" />
                  <span className="name">{e.name}</span>

                  {studying && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)" }}>
                      <Clock size={12} />
                      <input
                        type="number"
                        min={0}
                        max={1440}
                        step={5}
                        placeholder={String(suggested)}
                        value={studyEntry.minutes ?? ""}
                        onChange={(ev) => {
                          const raw = ev.target.value;
                          const m = raw === "" ? null : Math.max(0, Math.min(1440, parseInt(raw, 10) || 0));
                          void setStudyDayMinutes(e.id, dayKey, m);
                        }}
                        aria-label={`Minuti studiati per ${e.name}`}
                        title={
                          studyEntry.minutes != null
                            ? `Hai studiato ${studyEntry.minutes} min. Consigliato: ${suggested}m`
                            : `Consigliato: ${suggested}m. Inserisci quanto hai studiato.`
                        }
                      />
                      <span className="sugg">~ {suggested}m</span>
                    </div>
                  )}

                  <input
                    type="checkbox"
                    className="checkbox-pill"
                    checked={studying}
                    onChange={() => void toggleStudyDay(e.id, dayKey)}
                    aria-label={`Studio per ${e.name}`}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}
