import { useEffect, useState } from "react";
import {
  ALL_KINDS, KIND_LABELS, type NotifKindStr,
  getNotifPrefs, setNotifPref, ensurePermission, testSend,
  parseConfig, type StudyReminderCfg, type StudyMissedCfg, type QuickLogPromptCfg,
  type ExamImminentCfg, type ProjectDeadlineCfg,
} from "../notifications";
import { useToast } from "../toast";
import { Bell, BellOff } from "lucide-react";

interface PrefRow { enabled: boolean; configJson: string }
type PrefMap = Record<string, PrefRow>;

export function NotificationsSettings() {
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [prefs, setPrefs] = useState<PrefMap>({});
  const [permError, setPermError] = useState<string | null>(null);

  const masterOn = prefs._master?.enabled ?? false;

  useEffect(() => {
    void (async () => {
      try {
        const p = await getNotifPrefs();
        const m: PrefMap = {};
        for (const [k, v] of Object.entries(p.entries)) {
          m[k] = { enabled: v.enabled, configJson: v.config_json };
        }
        setPrefs(m);
      } catch (e) {
        toast.error(String(e));
      } finally {
        setLoaded(true);
      }
    })();
  }, [toast]);

  const update = async (key: string, next: PrefRow) => {
    setPrefs((p) => ({ ...p, [key]: next }));
    try {
      await setNotifPref(key, next.enabled, next.configJson);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const toggleMaster = async () => {
    if (!masterOn) {
      const ok = await ensurePermission();
      if (!ok) {
        setPermError("Permessi notifiche Windows negati. Abilita le notifiche dell'app dalle impostazioni di sistema.");
        return;
      }
      setPermError(null);
    }
    await update("_master", { enabled: !masterOn, configJson: "{}" });
  };

  if (!loaded) {
    return <div className="text-[12px] text-app-muted">Caricamento preferenze…</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => void toggleMaster()}
        className={
          "flex items-center gap-3 px-3 py-3 rounded-[10px] text-[13px] font-semibold border transition-colors " +
          (masterOn
            ? "bg-app-accent text-app-accent-fg border-app-accent"
            : "bg-app-card text-app-fg border-app-input-border hover:bg-app-hover")
        }
      >
        {masterOn ? <Bell size={18} /> : <BellOff size={18} />}
        {masterOn ? "Notifiche attive" : "Abilita notifiche"}
      </button>
      {permError && (
        <div className="text-[11.5px] text-red-600 leading-relaxed">{permError}</div>
      )}

      <div className={"flex flex-col gap-2 " + (masterOn ? "" : "opacity-50 pointer-events-none select-none")}>
        <div className="text-[11px] uppercase tracking-wider text-app-muted font-semibold mt-2">Tipi di notifica</div>
        {ALL_KINDS.map((k) => (
          <KindRow
            key={k}
            kind={k}
            pref={prefs[k] ?? { enabled: true, configJson: "{}" }}
            onChange={(next) => void update(k, next)}
          />
        ))}
        <div className="pt-2 border-t border-app-border">
          <button
            type="button"
            onClick={async () => { try { await testSend("study_reminder"); toast.info("Inviata"); } catch (e) { toast.error(String(e)); } }}
            className="text-[12px] underline text-app-accent"
          >
            Invia notifica di test
          </button>
        </div>
      </div>
    </div>
  );
}

function KindRow({ kind, pref, onChange }: { kind: NotifKindStr; pref: PrefRow; onChange: (p: PrefRow) => void }) {
  const setEnabled = (enabled: boolean) => onChange({ ...pref, enabled });
  const setConfig  = (configJson: string) => onChange({ ...pref, configJson });

  return (
    <div className="flex flex-col gap-1 py-1.5">
      <label className="flex items-center gap-2 text-[12.5px]">
        <input
          type="checkbox"
          checked={pref.enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>{KIND_LABELS[kind]}</span>
      </label>
      {pref.enabled && <KindConfig kind={kind} json={pref.configJson} onJson={setConfig} />}
    </div>
  );
}

function KindConfig({ kind, json, onJson }: { kind: NotifKindStr; json: string; onJson: (j: string) => void }) {
  if (kind === "study_reminder")   return <TimesEditor cfg={parseConfig<StudyReminderCfg>(json,   { times: ["18:00"] })} onChange={(c) => onJson(JSON.stringify(c))} />;
  if (kind === "quick_log_prompt") return <TimesEditor cfg={parseConfig<QuickLogPromptCfg>(json, { times: [] })}        onChange={(c) => onJson(JSON.stringify(c))} />;
  if (kind === "study_missed")     return <StudyMissedEditor cfg={parseConfig<StudyMissedCfg>(json, { hour: 22, minute: 0, weekdays_only: true })} onChange={(c) => onJson(JSON.stringify(c))} />;
  if (kind === "exam_imminent")    return <OffsetsEditor offsets={parseConfig<ExamImminentCfg>(json, { offsets: [7,3,1,0], hour: 8, morning_hour: 7, morning_minute: 30 }).offsets} allowed={[7,3,1,0]} onChange={(offs) => { const cfg = parseConfig<ExamImminentCfg>(json, { offsets: [7,3,1,0], hour: 8, morning_hour: 7, morning_minute: 30 }); onJson(JSON.stringify({ ...cfg, offsets: offs })); }} />;
  if (kind === "project_deadline") return <OffsetsEditor offsets={parseConfig<ProjectDeadlineCfg>(json, { offsets: [3,1,0], hour: 8 }).offsets} allowed={[3,1,0]} onChange={(offs) => { const cfg = parseConfig<ProjectDeadlineCfg>(json, { offsets: [3,1,0], hour: 8 }); onJson(JSON.stringify({ ...cfg, offsets: offs })); }} />;
  return null;
}

function TimesEditor({ cfg, onChange }: { cfg: { times: string[] }; onChange: (c: { times: string[] }) => void }) {
  const [draft, setDraft] = useState("18:00");
  return (
    <div className="flex items-center gap-2 pl-6 flex-wrap">
      {cfg.times.map((t, i) => (
        <span key={i} className="inline-flex items-center gap-1 text-[11.5px] bg-app-hover px-2 py-0.5 rounded">
          {t}
          <button
            type="button"
            onClick={() => onChange({ times: cfg.times.filter((_, j) => j !== i) })}
            className="text-app-muted hover:text-red-500"
          >✕</button>
        </span>
      ))}
      <input
        type="time"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="px-1.5 py-0.5 rounded border border-app-input-border bg-app-card text-app-fg text-[11.5px]"
      />
      <button
        type="button"
        onClick={() => { if (draft && !cfg.times.includes(draft)) onChange({ times: [...cfg.times, draft] }); }}
        className="text-[11.5px] underline text-app-accent"
      >+ aggiungi</button>
    </div>
  );
}

function StudyMissedEditor({ cfg, onChange }: { cfg: StudyMissedCfg; onChange: (c: StudyMissedCfg) => void }) {
  const hhmm = `${String(cfg.hour).padStart(2,"0")}:${String(cfg.minute).padStart(2,"0")}`;
  return (
    <div className="flex items-center gap-3 pl-6">
      <input
        type="time"
        value={hhmm}
        onChange={(e) => {
          const [h, m] = e.target.value.split(":").map((x) => parseInt(x, 10));
          onChange({ ...cfg, hour: h, minute: m });
        }}
        className="px-1.5 py-0.5 rounded border border-app-input-border bg-app-card text-app-fg text-[11.5px]"
      />
      <label className="text-[11.5px] inline-flex items-center gap-1">
        <input
          type="checkbox"
          checked={cfg.weekdays_only}
          onChange={(e) => onChange({ ...cfg, weekdays_only: e.target.checked })}
        />
        solo feriali
      </label>
    </div>
  );
}

function OffsetsEditor({ offsets, allowed, onChange }: { offsets: number[]; allowed: number[]; onChange: (o: number[]) => void }) {
  const toggle = (n: number) => {
    const has = offsets.includes(n);
    onChange(has ? offsets.filter((x) => x !== n) : [...offsets, n].sort((a, b) => b - a));
  };
  return (
    <div className="flex items-center gap-2 pl-6 flex-wrap">
      {allowed.map((n) => (
        <label key={n} className="text-[11.5px] inline-flex items-center gap-1">
          <input type="checkbox" checked={offsets.includes(n)} onChange={() => toggle(n)} />
          {n === 0 ? "mattina" : `${n}gg`}
        </label>
      ))}
    </div>
  );
}
