/* Main Shell — wires sidebar + main pane + modals + tweaks panel. */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "layout": "inset",
  "cellStyle": "default",
  "density": "comodo",
  "headerStyle": "measured",
  "grain": true,
  "atmosphere": true,
  "section": "calendar"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweaks] = useTweaks(TWEAK_DEFAULTS);
  const [exams, setExams] = useState(SAMPLE_EXAMS);
  const [section, setSection] = useState(tweaks.section || "calendar");
  const [searchQuery, setSearchQuery] = useState("");
  const [dayKey, setDayKey] = useState(null);
  const [examModal, setExamModal] = useState({ open: false, kind: "esame", editingId: null });
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [settingsTab, setSettingsTab] = useState("personalization");

  // Apply grain/atmosphere toggle on root
  useEffect(() => {
    document.documentElement.classList.toggle("no-grain", !tweaks.grain);
    document.documentElement.classList.toggle("no-atmos", !tweaks.atmosphere);
  }, [tweaks.grain, tweaks.atmosphere]);

  // When tweak's section changes (via panel buttons), reflect into shell state
  useEffect(() => {
    if (tweaks.section && tweaks.section !== section) {
      setSection(tweaks.section);
    }
  }, [tweaks.section]);

  const goSection = useCallback((s) => {
    setSection(s);
    setTweaks({ section: s });
  }, [setTweaks]);

  const editing = examModal.editingId != null ? exams.find((e) => e.id === examModal.editingId) : null;

  const handleAdd = (kind) => setExamModal({ open: true, kind, editingId: null });
  const handleEdit = (id) => setExamModal({ open: true, kind: "esame", editingId: id });
  const handleRemove = (id) => {
    const e = exams.find((x) => x.id === id);
    if (!e) return;
    if (confirm(`Eliminare "${e.name}"?`)) setExams((s) => s.filter((x) => x.id !== id));
  };
  const handleSetPassed = (id, passed) => {
    setExams((s) => s.map((e) => e.id === id ? { ...e, passed } : e));
  };
  const handleSaveExam = ({ name, color, icon }) => {
    if (editing) {
      setExams((s) => s.map((e) => e.id === editing.id ? { ...e, name, color, icon } : e));
    } else {
      const newId = Math.max(0, ...exams.map((e) => e.id)) + 1;
      setExams((s) => [...s, {
        id: newId,
        kind: examModal.kind,
        name: name || (examModal.kind === "progetto" ? "Nuovo progetto" : "Nuovo esame"),
        color, icon,
        passed: false,
        appelli: [],
        studyDays: [],
        ranges: examModal.kind === "progetto" ? [{ start: TODAY, end: ymdAdd(TODAY, 14) }] : [],
      }]);
    }
  };

  const handleToggleStudy = (examId, dayKey) => {
    setExams((s) => s.map((e) => {
      if (e.id !== examId) return e;
      const exists = e.studyDays.find((sd) => sd.date === dayKey);
      if (exists) {
        return { ...e, studyDays: e.studyDays.filter((sd) => sd.date !== dayKey) };
      }
      return { ...e, studyDays: [...e.studyDays, { date: dayKey, minutes: null }] };
    }));
  };
  const handleSetMinutes = (examId, dayKey, minutes) => {
    setExams((s) => s.map((e) => {
      if (e.id !== examId) return e;
      return {
        ...e,
        studyDays: e.studyDays.map((sd) =>
          sd.date === dayKey ? { ...sd, minutes } : sd
        ),
      };
    }));
  };

  return (
    <div className={`app-shell layout-${tweaks.layout}`}>
      <Sidebar
        section={section}
        onSectionChange={goSection}
        exams={exams}
        searchQuery={searchQuery}
        onSearchQuery={setSearchQuery}
        selectedExamId={selectedExamId}
        onSelectExam={setSelectedExamId}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onRemove={handleRemove}
        onSetPassed={handleSetPassed}
        onImport={() => alert("Importa: placeholder nel prototipo.")}
        onOpenSettings={() => goSection("settings")}
        settingsTab={settingsTab}
        onSettingsTabChange={setSettingsTab}
      />
      <main className="panel main-pane">
        <div key={section} className="view-enter" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {section === "calendar" && (
            <Calendar
              exams={exams}
              onDayClick={setDayKey}
              headerStyle={tweaks.headerStyle}
              cellStyle={tweaks.cellStyle}
              density={tweaks.density}
            />
          )}
          {section === "stats" && (
            <StatsView
              exams={exams}
              selectedExamId={selectedExamId}
              onDayClick={setDayKey}
              headerStyle={tweaks.headerStyle}
            />
          )}
          {section === "todo" && <TodoView />}
          {section === "settings" && (
            <>
              <div className="page-head header-measured" style={{ marginBottom: 14 }}>
                <div className="left">
                  <div className="kicker">App · Configurazione</div>
                  <h1 className="title">Impostazioni</h1>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: "auto", paddingRight: 6 }}>
                <SettingsView tab={settingsTab} settingsState={tweaks} onChangeSettings={setTweaks} />
              </div>
            </>
          )}
        </div>
      </main>

      <DayModal
        open={!!dayKey}
        dayKey={dayKey}
        exams={exams}
        onClose={() => setDayKey(null)}
        onToggleStudy={handleToggleStudy}
        onSetMinutes={handleSetMinutes}
      />
      <ExamModal
        open={examModal.open}
        editing={editing}
        kind={examModal.kind}
        onClose={() => setExamModal((s) => ({ ...s, open: false }))}
        onSave={handleSaveExam}
      />

      <CalendarioTweaks tweaks={tweaks} setTweaks={setTweaks} />
    </div>
  );
}

function CalendarioTweaks({ tweaks, setTweaks }) {
  return (
    <TweaksPanel title="Tweaks · claendario">
      <TweakSection label="Layout" />
      <TweakRadio
        label="Layout"
        value={tweaks.layout}
        options={[
          { value: "inset", label: "Inset" },
          { value: "atelier", label: "Atelier" },
          { value: "dual", label: "Glass" },
        ]}
        onChange={(v) => setTweaks({ layout: v })}
      />

      <TweakSection label="Calendario" />
      <TweakRadio
        label="Stile cella"
        value={tweaks.cellStyle}
        options={[
          { value: "default", label: "Soffuso" },
          { value: "piene", label: "Pieno" },
          { value: "firma", label: "Firma" },
        ]}
        onChange={(v) => setTweaks({ cellStyle: v })}
      />
      <TweakRadio
        label="Densità"
        value={tweaks.density}
        options={[
          { value: "compatto", label: "Compatto" },
          { value: "comodo", label: "Comodo" },
        ]}
        onChange={(v) => setTweaks({ density: v })}
      />

      <TweakSection label="Header pagina" />
      <TweakSelect
        label="Stile titolo"
        value={tweaks.headerStyle}
        options={[
          { value: "hero", label: "Hero — Syne 64px" },
          { value: "measured", label: "Misurato — Syne 38px" },
          { value: "sober", label: "Sobrio — solo mono" },
        ]}
        onChange={(v) => setTweaks({ headerStyle: v })}
      />

      <TweakSection label="Atmosfera" />
      <TweakToggle
        label="Grana"
        value={tweaks.grain}
        onChange={(v) => setTweaks({ grain: v })}
      />
      <TweakToggle
        label="Bagliore"
        value={tweaks.atmosphere}
        onChange={(v) => setTweaks({ atmosphere: v })}
      />

      <TweakSection label="Vai a…" />
      <TweakSelect
        label="Vista"
        value={tweaks.section}
        options={[
          { value: "calendar", label: "Calendario" },
          { value: "stats",    label: "Statistiche" },
          { value: "todo",     label: "To-do" },
          { value: "settings", label: "Impostazioni" },
        ]}
        onChange={(v) => setTweaks({ section: v })}
      />
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
