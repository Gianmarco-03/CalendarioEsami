import { useExams } from "../state";
import { inRange, parseYmd } from "../date";
import { Modal } from "./Modal";

interface DayModalProps {
  open: boolean;
  dayKey: string | null;
  onClose: () => void;
}

export function DayModal({ open, dayKey, onClose }: DayModalProps) {
  const { exams, toggleStudyDay } = useExams();
  if (!dayKey) return null;

  const date = parseYmd(dayKey);
  const titleRaw = date.toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const title = titleRaw.charAt(0).toUpperCase() + titleRaw.slice(1);

  const active = exams.filter((e) => !e.passed);
  const infoLines: { color: string; text: string }[] = [];
  for (const e of active) {
    if (e.kind === "esame") {
      for (const a of e.appelli) {
        if (a.date === dayKey) infoLines.push({ color: e.color, text: `Appello: ${e.name}` });
      }
    } else {
      if (e.ranges.some((r) => inRange(dayKey, r.start, r.end))) {
        infoLines.push({ color: e.color, text: `Progetto in corso: ${e.name}` });
      }
    }
  }

  const studyEsami = active.filter((e) => e.kind === "esame");

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {infoLines.length > 0 && (
        <div className="bg-[#fbf7ee] border border-[#f0e6cf] rounded-lg px-2.5 py-2 mb-3">
          {infoLines.map((ln, i) => (
            <div key={i} className="text-[12px] font-semibold flex items-center gap-1.5 mt-1 first:mt-0">
              <span className="w-[10px] h-[10px] rounded-full" style={{ background: ln.color }} />
              {ln.text}
            </div>
          ))}
        </div>
      )}

      {studyEsami.length === 0 ? (
        <div className="text-[12px] text-app-muted py-1.5">
          {infoLines.length > 0
            ? "Nessun esame per cui segnare lo studio."
            : "Nessun esame attivo. Aggiungine uno dalla barra laterale."}
        </div>
      ) : (
        <>
          <div className="text-[11px] font-bold text-[#6b7280] uppercase tracking-wide mb-2">
            Sto studiando per…
          </div>
          {studyEsami.map((e) => {
            const studying = e.studyDays.includes(dayKey);
            return (
              <label
                key={e.id}
                className="flex items-center gap-2 px-2.5 py-2 border border-[#eef0f3] rounded-lg mb-1.5 cursor-pointer hover:bg-[#f7f8fa]"
              >
                <span className="w-3 h-3 rounded-full" style={{ background: e.color }} />
                <span className="flex-1 text-[13px] font-semibold">{e.name}</span>
                <input
                  type="checkbox"
                  checked={studying}
                  onChange={() => void toggleStudyDay(e.id, dayKey)}
                  className="w-[17px] h-[17px] cursor-pointer"
                />
              </label>
            );
          })}
        </>
      )}
    </Modal>
  );
}
