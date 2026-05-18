/* Sidebar — calendar/stats mode and settings mode */

const SECTIONS = [
  { id: "calendar", label: "Calendario", iconKey: "calendar" },
  { id: "stats",    label: "Statistiche", iconKey: "bar" },
  { id: "todo",     label: "To-do",      iconKey: "todo" },
];

function SectionSwitcher({ active, onChange }) {
  const containerRef = useRef(null);
  const btnRefs = useRef({});
  const [pill, setPill] = useState({ left: 0, width: 0, visible: false });

  useLayoutEffect(() => {
    if (active === "settings") {
      setPill((p) => ({ ...p, visible: false }));
      return;
    }
    const btn = btnRefs.current[active];
    const container = containerRef.current;
    if (!btn || !container) return;
    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    setPill({ left: bRect.left - cRect.left, width: bRect.width, visible: true });
  }, [active]);

  return (
    <div ref={containerRef} className="section-switcher">
      <span
        className="pill"
        style={{ left: pill.left, width: pill.width, opacity: pill.visible ? 1 : 0 }}
      />
      {SECTIONS.map(({ id, label, iconKey }) => (
        <button
          key={id}
          ref={(el) => { btnRefs.current[id] = el; }}
          className={active === id ? "active" : ""}
          onClick={() => onChange(id)}
        >
          <Icon d={UI[iconKey]} size={12} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function ExamRow({ exam, onEdit, onRemove, onSetPassed, selected, onSelect, statsMode }) {
  const iconD = EXAM_ICONS[exam.icon] || EXAM_ICONS.book;
  const meta = exam.kind === "progetto"
    ? `${rangeDaysTotal(exam)}g`
    : `${exam.appelli.length}·${formatStudyTime(suggestedMinutes(exam))}`;

  const handleClick = (e) => {
    if (e.target.closest("button") || e.target.closest("input")) return;
    onSelect?.();
  };

  return (
    <div
      className={`exam-row ${selected ? "selected" : ""} ${exam.passed ? "passed" : ""}`}
      style={{ "--ec": exam.color }}
      onClick={handleClick}
      role={onSelect ? "button" : undefined}
    >
      <span className="stripe" />
      <span className="icon-wrap"><Icon d={iconD} size={12} stroke={1.75} /></span>
      <span className="name">{exam.name}</span>
      <span className="meta">{meta}</span>
      <input
        type="checkbox"
        className="checkbox"
        checked={exam.passed}
        onChange={(e) => onSetPassed?.(exam.id, e.target.checked)}
        title={exam.kind === "progetto" ? "Segna come completato" : "Segna come superato"}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="actions">
        <button onClick={(e) => { e.stopPropagation(); onEdit?.(exam.id); }} title="Modifica" aria-label="Modifica">
          <Icon d={UI.pencil} size={12} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onRemove?.(exam.id); }} title="Elimina" aria-label="Elimina">
          <Icon d={UI.trash} size={12} />
        </button>
      </div>
    </div>
  );
}

/* Helpers */
function rangeDaysTotal(exam) {
  let total = 0;
  for (const r of exam.ranges) {
    const a = parseYmd(r.start), b = parseYmd(r.end);
    total += Math.round((b - a) / 86400000) + 1;
  }
  return total;
}
function suggestedMinutes(exam) {
  // approximate: 60 min per study day, capped
  return Math.min(exam.studyDays.length * 60, 600);
}
function formatStudyTime(m) {
  if (!m) return "";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h && mm) return `${h}h${mm}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function Sidebar({
  section, onSectionChange, exams, searchQuery, onSearchQuery,
  selectedExamId, onSelectExam, onAdd, onEdit, onRemove, onSetPassed,
  onImport, onOpenSettings, settingsTab, onSettingsTabChange,
}) {
  if (section === "settings") {
    return (
      <aside className="panel sidebar view-enter" key="settings">
        <button className="settings-back" onClick={() => onSectionChange("calendar")}>
          <Icon d={UI.back} size={12} />
          Torna all'app
        </button>
        <div className="brand" style={{ paddingTop: 0 }}>
          <Icon d={UI.cog} size={18} />
          <span className="brand-name" style={{ fontSize: 16 }}>Impostazioni</span>
        </div>
        <p className="sidebar-hint">
          Aspetto, notifiche, comportamento. Tutto persiste localmente.
        </p>
        <nav className="settings-nav">
          {SETTINGS_TABS.map((t) => (
            <button
              key={t.id}
              className={settingsTab === t.id ? "active" : ""}
              onClick={() => onSettingsTabChange(t.id)}
            >
              <Icon d={UI[t.iconKey]} size={14} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    );
  }

  const q = searchQuery.trim().toLowerCase();
  const filtered = q ? exams.filter((e) => e.name.toLowerCase().includes(q)) : exams;
  const active = filtered.filter((e) => !e.passed);
  const passed = filtered.filter((e) => e.passed);
  const statsMode = section === "stats";

  return (
    <aside className="panel sidebar" key="exams">
      <div className="brand">
        <img src="assets/logo.png" alt="" />
        <span className="brand-name">claendario</span>
      </div>

      <SectionSwitcher active={section} onChange={onSectionChange} />

      <div className="sidebar-kicker">Esami · Progetti</div>
      <p className="sidebar-hint">
        Clicca un giorno per segnare lo studio. I <b>progetti</b> durano più giorni.
        Spunta la casella quando hai superato.
      </p>

      <div className="search-wrap">
        <Icon d={UI.search} size={13} className="search-icon" />
        <input
          type="text"
          placeholder="Cerca esame…"
          value={searchQuery}
          onChange={(e) => onSearchQuery(e.target.value)}
        />
      </div>

      <div className="exam-list">
        {statsMode && (
          <button
            className={`globale-row ${selectedExamId == null ? "selected" : ""}`}
            onClick={() => onSelectExam(null)}
          >
            <Icon d={UI.globe} size={13} />
            <span className="label">Globale</span>
            <span className="meta">tutti</span>
          </button>
        )}
        {active.length === 0 && exams.length === 0 && (
          <div className="sidebar-hint" style={{ padding: "12px 8px" }}>
            Niente ancora. Aggiungi un esame qui sotto.
          </div>
        )}
        {active.length === 0 && exams.length > 0 && q && (
          <div className="sidebar-hint" style={{ padding: "12px 8px" }}>
            Nessun esame attivo corrisponde alla ricerca.
          </div>
        )}
        {active.map((e) => (
          <ExamRow
            key={e.id}
            exam={e}
            onEdit={onEdit}
            onRemove={onRemove}
            onSetPassed={onSetPassed}
            selected={statsMode && selectedExamId === e.id}
            onSelect={statsMode ? () => onSelectExam(selectedExamId === e.id ? null : e.id) : undefined}
            statsMode={statsMode}
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
                onRemove={onRemove}
                onSetPassed={onSetPassed}
                selected={statsMode && selectedExamId === e.id}
                onSelect={statsMode ? () => onSelectExam(selectedExamId === e.id ? null : e.id) : undefined}
                statsMode={statsMode}
              />
            ))}
          </div>
        )}
      </div>

      <div className="bottom-row">
        <button className="btn primary full" onClick={() => onAdd("esame")}>
          <Icon d={UI.plus} size={12} stroke={2.2} />
          Esame
        </button>
        <button className="btn full" onClick={() => onAdd("progetto")}>
          <Icon d={UI.plus} size={12} stroke={2.2} />
          Progetto
        </button>
      </div>
      <button className="import-btn" onClick={onImport}>
        <Icon d={UI.download} size={11} />
        Importa da artifact
      </button>

      <div className="sidebar-footer">
        <div className="user">
          <div className="avatar">GB</div>
          <div className="user-meta">
            <b>Giovanni B.</b><br/>
            <span style={{ letterSpacing: "0.06em" }}>locale · ok</span>
          </div>
        </div>
        <button className="settings-btn" onClick={onOpenSettings} title="Impostazioni" aria-label="Impostazioni">
          <Icon d={UI.cog} size={15} />
        </button>
      </div>
    </aside>
  );
}

const SETTINGS_TABS = [
  { id: "personalization", label: "Personalizzazione", iconKey: "palette" },
  { id: "notifications", label: "Notifiche", iconKey: "bell" },
  { id: "data", label: "Dati & backup", iconKey: "download" },
  { id: "system", label: "Sistema", iconKey: "cog" },
  { id: "about", label: "Informazioni", iconKey: "user" },
];

Object.assign(window, { Sidebar, SETTINGS_TABS, SECTIONS, ExamRow, suggestedMinutes, formatStudyTime, rangeDaysTotal });
