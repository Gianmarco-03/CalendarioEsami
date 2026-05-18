import { useEffect, useState } from "react";
import { quicklogActiveExams, quicklogLog, quicklogRecentExam, type ActiveExamLite } from "./db";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export function QuicklogApp() {
  const [exams, setExams] = useState<ActiveExamLite[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [minutes, setMinutes] = useState<string>("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const list = await quicklogActiveExams();
        setExams(list);
        const recent = await quicklogRecentExam();
        setSelectedId(recent ?? list[0]?.id ?? null);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        await getCurrentWebviewWindow().hide();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const log = async (m: number) => {
    if (selectedId == null) { setError("Seleziona un esame"); return; }
    if (m <= 0 || m > 1440) { setError("Minuti 1-1440"); return; }
    setBusy(true); setError(null);
    try {
      await quicklogLog(selectedId, m);
      await getCurrentWebviewWindow().hide();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const m = parseInt(minutes, 10);
    if (Number.isNaN(m)) { setError("Minuti non validi"); return; }
    void log(m);
  };

  return (
    <div
      className="h-screen w-screen flex items-center justify-center p-3"
      style={{ background: "transparent" }}
    >
      <div className="w-full max-w-[360px] rounded-2xl glass-panel shadow-lg p-4 flex flex-col gap-3">
        <div className="text-[11px] uppercase tracking-wider text-app-muted font-semibold">
          Quick log studio
        </div>
        <select
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(parseInt(e.target.value, 10))}
          className="w-full px-2 py-1.5 rounded-md border border-app-input-border bg-app-card text-app-fg text-[13px]"
          disabled={busy || exams.length === 0}
        >
          {exams.length === 0 && <option value="">Nessun esame attivo</option>}
          {exams.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <div className="grid grid-cols-4 gap-2">
          {[15, 30, 60, 90].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => log(m)}
              disabled={busy || selectedId == null}
              className="px-2 py-2 rounded-md bg-app-accent text-app-accent-fg text-[12.5px] font-semibold disabled:opacity-50"
            >
              +{m}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-md border border-app-input-border bg-app-card text-app-fg text-[13px]"
          />
          <button
            type="submit"
            disabled={busy || selectedId == null}
            className="px-3 py-1.5 rounded-md bg-app-accent text-app-accent-fg text-[12.5px] font-semibold disabled:opacity-50"
          >
            OK
          </button>
        </form>
        {error && <div className="text-[11.5px] text-red-600">{error}</div>}
        <div className="text-[10.5px] text-app-muted">ESC chiude — Enter conferma</div>
      </div>
    </div>
  );
}
