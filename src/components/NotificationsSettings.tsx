import { useEffect, useState } from "react";
import {
  ALL_KINDS, KIND_LABELS, type NotifKindStr,
  getNotifPrefs, setNotifPref, ensurePermission, testSend,
  parseConfig,
  type StudyReminderCfg, type StudyMissedCfg, type QuickLogPromptCfg,
  type ExamImminentCfg, type ProjectDeadlineCfg,
} from "../notifications";
import { useToast } from "../toast";
import {
  Bell, BellOff, ChevronDown,
  GraduationCap, Play, Flag, Clock, AlarmClockOff, Trophy, Zap,
} from "lucide-react";

interface PrefRow { enabled: boolean; configJson: string }
type PrefMap = Record<string, PrefRow>;

const KIND_META: Record<NotifKindStr, { Icon: typeof Bell; description: string; hasConfig: boolean }> = {
  exam_imminent:    { Icon: GraduationCap,  description: "Notifica prima degli appelli configurati.", hasConfig: true  },
  project_start:    { Icon: Play,           description: "Quando inizia il periodo di un progetto.",  hasConfig: false },
  project_deadline: { Icon: Flag,           description: "Avvisi prima della consegna del progetto.", hasConfig: true  },
  study_reminder:   { Icon: Clock,          description: "Ricordati di studiare a un orario fisso.",  hasConfig: true  },
  study_missed:     { Icon: AlarmClockOff,  description: "Avviso se a fine giornata non hai studiato.", hasConfig: true  },
  streak_milestone: { Icon: Trophy,         description: "Festeggia 7 / 14 / 30 / 60 / 100 giorni di fila.", hasConfig: false },
  quick_log_prompt: { Icon: Zap,            description: "Notifica con bottoni rapidi per loggare i minuti.", hasConfig: true  },
};

export function NotificationsSettings() {
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [prefs, setPrefs] = useState<PrefMap>({});
  const [permError, setPermError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<NotifKindStr | null>(null);

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
    <div className="flex flex-col gap-4">
      {/* Master toggle */}
      <button
        type="button"
        onClick={() => void toggleMaster()}
        className={
          "flex items-center gap-3 px-4 py-3 rounded-xl text-[13.5px] font-semibold border transition-colors " +
          (masterOn
            ? "bg-app-accent text-app-accent-fg border-app-accent"
            : "bg-app-card text-app-fg border-app-input-border hover:bg-app-hover")
        }
      >
        {masterOn ? <Bell size={18} /> : <BellOff size={18} />}
        <span className="flex-1 text-left">
          {masterOn ? "Notifiche attive" : "Abilita notifiche"}
        </span>
        <span className={"text-[11px] uppercase tracking-wider font-bold " + (masterOn ? "opacity-80" : "opacity-60")}>
          {masterOn ? "on" : "off"}
        </span>
      </button>
      {permError && (
        <div className="text-[11.5px] text-red-600 leading-relaxed">{permError}</div>
      )}

      {/* Lista tipi (accordion) */}
      <div className={"flex flex-col gap-1.5 " + (masterOn ? "" : "opacity-50 pointer-events-none select-none")}>
        <div className="text-[11px] uppercase tracking-wider text-app-muted font-semibold">
          Tipi di notifica
        </div>
        {ALL_KINDS.map((k) => (
          <KindRow
            key={k}
            kind={k}
            pref={prefs[k] ?? { enabled: true, configJson: "{}" }}
            isExpanded={expanded === k}
            onToggleExpand={() => setExpanded(expanded === k ? null : k)}
            onChange={(next) => void update(k, next)}
          />
        ))}

        <div className="pt-3 mt-2 border-t border-app-border">
          <button
            type="button"
            onClick={async () => {
              try { await testSend("study_reminder"); toast.info("Notifica di test inviata"); }
              catch (e) { toast.error(String(e)); }
            }}
            className="text-[12px] underline text-app-accent hover:opacity-80"
          >
            Invia notifica di test
          </button>
        </div>
      </div>
    </div>
  );
}

function KindRow({
  kind, pref, isExpanded, onToggleExpand, onChange,
}: {
  kind: NotifKindStr;
  pref: PrefRow;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onChange: (p: PrefRow) => void;
}) {
  const { Icon, description, hasConfig } = KIND_META[kind];
  const setEnabled = (enabled: boolean) => onChange({ ...pref, enabled });
  const setConfig  = (configJson: string) => onChange({ ...pref, configJson });

  const canExpand = hasConfig && pref.enabled;
  const showConfig = canExpand && isExpanded;

  return (
    <div className="rounded-xl border border-app-input-border bg-app-card overflow-hidden">
      <div
        className={
          "flex items-center gap-3 px-3 py-2.5 " +
          (canExpand ? "cursor-pointer hover:bg-app-hover" : "")
        }
        onClick={() => { if (canExpand) onToggleExpand(); }}
      >
        <span className="w-8 h-8 rounded-lg bg-app-soft flex items-center justify-center text-app-muted shrink-0">
          <Icon size={15} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold truncate">{KIND_LABELS[kind]}</div>
          <div className="text-[11.5px] text-app-muted truncate">{description}</div>
        </div>
        {canExpand && (
          <ChevronDown
            size={16}
            className={"text-app-muted transition-transform shrink-0 " + (isExpanded ? "rotate-180" : "")}
          />
        )}
        <Toggle
          checked={pref.enabled}
          onChange={setEnabled}
          stopPropagation
        />
      </div>

      {showConfig && (
        <div className="px-3 pb-3 pt-1 border-t border-app-border bg-app-soft/40">
          <KindConfig kind={kind} json={pref.configJson} onJson={setConfig} />
        </div>
      )}
    </div>
  );
}

function Toggle({
  checked, onChange, stopPropagation,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  stopPropagation?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        onChange(!checked);
      }}
      className={
        "relative inline-flex items-center w-10 h-5 rounded-full transition-colors shrink-0 p-0.5 border border-app-border " +
        (checked ? "bg-app-fg" : "bg-app-bg")
      }
    >
      <span
        className={
          "block w-4 h-4 rounded-full shadow-sm transition-transform " +
          (checked ? "bg-app-bg" : "bg-app-fg") + " " +
          (checked ? "translate-x-5" : "translate-x-0")
        }
      />
    </button>
  );
}

function KindConfig({ kind, json, onJson }: { kind: NotifKindStr; json: string; onJson: (j: string) => void }) {
  if (kind === "study_reminder") {
    return <TimesEditor cfg={parseConfig<StudyReminderCfg>(json, { times: ["18:00"] })} onChange={(c) => onJson(JSON.stringify(c))} />;
  }
  if (kind === "quick_log_prompt") {
    return <TimesEditor cfg={parseConfig<QuickLogPromptCfg>(json, { times: [] })} onChange={(c) => onJson(JSON.stringify(c))} />;
  }
  if (kind === "study_missed") {
    return <StudyMissedEditor cfg={parseConfig<StudyMissedCfg>(json, { hour: 22, minute: 0, weekdays_only: true })} onChange={(c) => onJson(JSON.stringify(c))} />;
  }
  if (kind === "exam_imminent") {
    const cfg = parseConfig<ExamImminentCfg>(json, { offsets: [7,3,1,0], hour: 8, morning_hour: 7, morning_minute: 30 });
    return (
      <OffsetsEditor
        offsets={cfg.offsets}
        allowed={[7,3,1,0]}
        onChange={(offs) => onJson(JSON.stringify({ ...cfg, offsets: offs }))}
      />
    );
  }
  if (kind === "project_deadline") {
    const cfg = parseConfig<ProjectDeadlineCfg>(json, { offsets: [3,1,0], hour: 8 });
    return (
      <OffsetsEditor
        offsets={cfg.offsets}
        allowed={[3,1,0]}
        onChange={(offs) => onJson(JSON.stringify({ ...cfg, offsets: offs }))}
      />
    );
  }
  return null;
}

function TimesEditor({ cfg, onChange }: { cfg: { times: string[] }; onChange: (c: { times: string[] }) => void }) {
  const [draft, setDraft] = useState("18:00");
  return (
    <div className="flex flex-col gap-2">
      <Field label="Orari di invio">
        <div className="flex flex-wrap items-center gap-2">
          {cfg.times.length === 0 && (
            <span className="text-[11.5px] text-app-muted italic">Nessun orario impostato</span>
          )}
          {cfg.times.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-[12px] bg-app-hover px-2 py-0.5 rounded">
              {t}
              <button
                type="button"
                onClick={() => onChange({ times: cfg.times.filter((_, j) => j !== i) })}
                className="text-app-muted hover:text-red-500"
                aria-label={`Rimuovi orario ${t}`}
              >✕</button>
            </span>
          ))}
        </div>
      </Field>
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="px-2 py-1 rounded border border-app-input-border bg-app-card text-app-fg text-[12px]"
        />
        <button
          type="button"
          onClick={() => { if (draft && !cfg.times.includes(draft)) onChange({ times: [...cfg.times, draft] }); }}
          className="text-[12px] px-2 py-1 rounded border border-app-input-border bg-app-card text-app-fg hover:bg-app-hover"
        >+ Aggiungi</button>
      </div>
    </div>
  );
}

function StudyMissedEditor({ cfg, onChange }: { cfg: StudyMissedCfg; onChange: (c: StudyMissedCfg) => void }) {
  const hhmm = `${String(cfg.hour).padStart(2,"0")}:${String(cfg.minute).padStart(2,"0")}`;
  return (
    <div className="flex flex-col gap-2">
      <Field label="Orario di invio">
        <input
          type="time"
          value={hhmm}
          onChange={(e) => {
            const [h, m] = e.target.value.split(":").map((x) => parseInt(x, 10));
            onChange({ ...cfg, hour: h, minute: m });
          }}
          className="px-2 py-1 rounded border border-app-input-border bg-app-card text-app-fg text-[12px]"
        />
      </Field>
      <label className="text-[12px] inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={cfg.weekdays_only}
          onChange={(e) => onChange({ ...cfg, weekdays_only: e.target.checked })}
        />
        Solo giorni feriali (lun–ven)
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
    <Field label="Quando avvisare">
      <div className="flex flex-wrap items-center gap-1.5">
        {allowed.map((n) => {
          const checked = offsets.includes(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => toggle(n)}
              className={
                "px-2.5 py-1 rounded-full text-[11.5px] font-medium border transition-colors " +
                (checked
                  ? "bg-app-accent text-app-accent-fg border-app-accent"
                  : "bg-app-card text-app-fg border-app-input-border hover:bg-app-hover")
              }
            >
              {n === 0 ? "mattina del giorno" : n === 1 ? "il giorno prima" : `${n} giorni prima`}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10.5px] uppercase tracking-wider text-app-muted font-semibold">{label}</div>
      {children}
    </div>
  );
}
