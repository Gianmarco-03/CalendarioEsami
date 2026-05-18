import { useExams } from "../state";
import { ExamRow } from "./ExamRow";
import {
  Plus, Download, Search, Settings as SettingsIcon, Globe, ArrowLeft, NotebookPen,
} from "lucide-react";
import { SectionSwitcher, type AppSection } from "./SectionSwitcher";
import { SETTINGS_TABS, type SettingsTab } from "./settings-tabs";

interface SidebarProps {
  section: AppSection;
  onSectionChange: (s: AppSection) => void;
  onAdd: (kind: "esame" | "progetto") => void;
  onEdit: (id: number) => void;
  onImport: () => void;
  onOpenSettings: () => void;
  selectedExamId?: number | null;
  onSelectExam?: (id: number | null) => void;
  settingsTab: SettingsTab;
  onSettingsTabChange: (t: SettingsTab) => void;
}

export function Sidebar(props: SidebarProps) {
  if (props.section === "settings") {
    return <SettingsSidebar {...props} />;
  }
  return <ExamsSidebar {...props} />;
}

function ExamsSidebar({
  section, onSectionChange, onAdd, onEdit, onImport, onOpenSettings,
  selectedExamId, onSelectExam,
}: SidebarProps) {
  const { exams, loading, searchQuery, setSearchQuery } = useExams();
  const active = exams.filter((e) => !e.passed);
  const passed = exams.filter((e) => e.passed);
  const statsMode = section === "stats" && !!onSelectExam;

  return (
    <aside className="sidebar">
      <div className="brand">
        <NotebookPen size={22} strokeWidth={1.6} />
        <span className="brand-name">claendario</span>
      </div>

      <SectionSwitcher active={section} onChange={onSectionChange} />

      <div className="sidebar-kicker">Esami · Progetti</div>
      <p className="sidebar-hint">
        Clicca un giorno per segnare lo studio. I <b>progetti</b> durano più giorni.
        Spunta la casella quando hai superato.
      </p>

      <div className="search-wrap">
        <Search size={13} className="search-icon" />
        <input
          type="text"
          placeholder="Cerca esame…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="exam-list">
        {statsMode && (
          <button
            type="button"
            onClick={() => onSelectExam?.(null)}
            className={"globale-row" + (selectedExamId == null ? " selected" : "")}
            aria-pressed={selectedExamId == null}
          >
            <Globe size={13} />
            <span className="globale-row-label">Globale</span>
            <span className="globale-row-meta">tutti</span>
          </button>
        )}

        {loading && (
          <div className="sidebar-hint" style={{ padding: "12px 8px" }}>Caricamento…</div>
        )}

        {!loading && active.length === 0 && exams.length === 0 && (
          <div className="sidebar-hint" style={{ padding: "12px 8px" }}>
            Niente ancora. Aggiungi un esame o un progetto qui sotto.
          </div>
        )}

        {!loading && active.length === 0 && exams.length > 0 && searchQuery.trim() && (
          <div className="sidebar-hint" style={{ padding: "12px 8px" }}>
            Nessun esame attivo corrisponde alla ricerca.
          </div>
        )}

        {active.map((e) => (
          <ExamRow
            key={e.id}
            exam={e}
            onEdit={onEdit}
            selected={statsMode && selectedExamId === e.id}
            onSelect={statsMode ? () => onSelectExam?.(selectedExamId === e.id ? null : e.id) : undefined}
          />
        ))}

        {passed.length > 0 && (
          <div className="completati">
            <div className="completati-head">
              <span>Completati</span>
              <span className="count">{passed.length}</span>
            </div>
            {passed.map((e) => (
              <ExamRow
                key={e.id}
                exam={e}
                onEdit={onEdit}
                selected={statsMode && selectedExamId === e.id}
                onSelect={statsMode ? () => onSelectExam?.(selectedExamId === e.id ? null : e.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <div className="bottom-row">
        <button type="button" className="btn primary full" onClick={() => onAdd("esame")}>
          <Plus size={12} strokeWidth={2.2} /> Esame
        </button>
        <button type="button" className="btn full" onClick={() => onAdd("progetto")}>
          <Plus size={12} strokeWidth={2.2} /> Progetto
        </button>
      </div>
      <button type="button" className="import-btn" onClick={onImport}>
        <Download size={11} /> Importa da artifact
      </button>

      <div className="sidebar-footer">
        <div className="user">
          <div className="avatar">CL</div>
          <div className="user-meta">
            <b>locale</b><br/>
            <span style={{ letterSpacing: "0.06em" }}>offline · ok</span>
          </div>
        </div>
        <button
          type="button"
          className="settings-btn"
          onClick={onOpenSettings}
          title="Impostazioni"
          aria-label="Impostazioni"
        >
          <SettingsIcon size={15} />
        </button>
      </div>
    </aside>
  );
}

function SettingsSidebar({
  onSectionChange, settingsTab, onSettingsTabChange,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <button
        type="button"
        className="settings-back"
        onClick={() => onSectionChange("calendar")}
      >
        <ArrowLeft size={12} /> Torna all'app
      </button>

      <div className="brand" style={{ paddingTop: 0 }}>
        <SettingsIcon size={18} />
        <span className="brand-name" style={{ fontSize: 16 }}>Impostazioni</span>
      </div>

      <p className="sidebar-hint">
        Aspetto, notifiche, comportamento. Tutto persiste localmente.
      </p>

      <nav className="settings-nav">
        {SETTINGS_TABS.map(({ id, label, Icon }) => {
          const isActive = id === settingsTab;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSettingsTabChange(id)}
              className={isActive ? "active" : ""}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
