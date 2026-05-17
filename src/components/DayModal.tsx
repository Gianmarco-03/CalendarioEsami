import { useExams } from "../state";
import { inRange, parseYmd } from "../date";
import { Modal } from "./Modal";
import { ModalButton } from "./ModalButton";
import { Clock, Calendar } from "lucide-react";
import { effectiveMinutes, countPresences } from "../study-time";
import { isProgetto } from "../progetto";

interface DayModalProps {
  open: boolean;
  dayKey: string | null;
  onClose: () => void;
}

export function DayModal({ open, dayKey, onClose }: DayModalProps) {
  const { exams, toggleStudyDay, setStudyDayMinutes } = useExams();
  if (!dayKey) return null;

  const date = parseYmd(dayKey);
  const titleRaw = date.toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const title = titleRaw.charAt(0).toUpperCase() + titleRaw.slice(1);

  const active = exams.filter((e) => !e.passed);
  const infoLines: { color: string; text: string }[] = [];
  for (const e of active) {
    for (const a of e.appelli) {
      if (a.date === dayKey) infoLines.push({ color: e.color, text: `Appello: ${e.name}` });
    }
    if (isProgetto(e)) {
      if (e.ranges.some((r) => inRange(dayKey, r.start, r.end))) {
        infoLines.push({ color: e.color, text: `Progetto in corso: ${e.name}` });
      }
    }
  }

  const studyTargets = active;

  const footer = (
    <>
      <div className="flex-1" />
      <ModalButton variant="primary" onClick={onClose}>Chiudi</ModalButton>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={Calendar}
      size="md"
      footer={footer}
    >
      {infoLines.length > 0 && (
        <div className="bg-app-soft border border-app-border rounded-[10px] px-3 py-2.5 flex flex-col gap-1.5">
          {infoLines.map((ln, i) => (
            <div key={i} className="text-[12px] font-semibold text-app-fg flex items-center gap-2">
              <span className="w-[10px] h-[10px] rounded-full shrink-0" style={{ background: ln.color }} />
              {ln.text}
            </div>
          ))}
        </div>
      )}

      {studyTargets.length === 0 ? (
        <div className="text-[12px] text-app-muted py-1.5">
          {infoLines.length > 0
            ? "Nessun esame per cui segnare lo studio."
            : "Nessun esame attivo. Aggiungine uno dalla barra laterale."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="text-[11.5px] font-semibold text-app-muted">
            Sto studiando per…
          </div>
          {studyTargets.map((e) => {
            const studyEntry = e.studyDays.find((s) => s.date === dayKey);
            const studying = !!studyEntry;
            const computed = effectiveMinutes(e, dayKey, active);
            const t = e.defaultStudyMinutes;
            const n = countPresences(dayKey, active);
            const isOverride = studyEntry?.minutes != null;
            return (
              <div
                key={e.id}
                className="relative flex items-center gap-2 pl-4 pr-3 py-2 border border-app-border rounded-lg bg-app-soft overflow-hidden"
              >
                <span
                  className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{ background: e.color }}
                />
                <span className="flex-1 text-[13px] font-semibold text-app-fg truncate">{e.name}</span>

                {studying && (
                  <div className="flex items-center gap-1 text-app-muted">
                    <Clock size={12} />
                    <input
                      type="number"
                      min={0}
                      max={1440}
                      step={5}
                      placeholder={String(computed)}
                      value={studyEntry.minutes ?? ""}
                      onChange={(ev) => {
                        const raw = ev.target.value;
                        const m = raw === "" ? null : Math.max(0, Math.min(1440, parseInt(raw, 10) || 0));
                        void setStudyDayMinutes(e.id, dayKey, m);
                      }}
                      className="w-14 glass-input !py-1 !px-1.5 !text-[12px]"
                      aria-label={`Minuti di studio per ${e.name}`}
                      title={
                        isOverride
                          ? `Manuale (formula: ${computed}m = ${t}/${n})`
                          : `Auto (${computed}m = ${t}/${n}). Modifica per override.`
                      }
                    />
                    <span className="text-[9.5px] whitespace-nowrap">
                      {isOverride ? "manuale" : `auto ${computed}m`}
                    </span>
                  </div>
                )}

                <input
                  type="checkbox"
                  checked={studying}
                  onChange={() => void toggleStudyDay(e.id, dayKey)}
                  className="w-[17px] h-[17px] cursor-pointer shrink-0"
                  aria-label={`Studio per ${e.name}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
