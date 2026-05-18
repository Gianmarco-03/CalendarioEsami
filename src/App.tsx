import { useState } from "react";
import { ExamsProvider, useExams } from "./state";
import { TasksProvider } from "./tasks-state";
import { ToastProvider } from "./toast";
import { Sidebar } from "./components/Sidebar";
import { ExamModal } from "./components/ExamModal";
import { Calendar } from "./components/Calendar";
import { DayModal } from "./components/DayModal";
import { ImportModal } from "./components/ImportModal";
import { StatsView } from "./components/StatsView";
import { TodoView } from "./components/TodoView";
import { SettingsView } from "./components/SettingsView";
import type { SettingsTab } from "./components/settings-tabs";
import type { AppSection } from "./components/SectionSwitcher";
import type { ExamKind } from "./types";

function Shell() {
  const { exams, initError } = useExams();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<ExamKind>("esame");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [section, setSection] = useState<AppSection>("calendar");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("personalization");
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);

  const editing = editingId !== null ? exams.find((e) => e.id === editingId) ?? null : null;
  const selectedExam = selectedExamId != null ? exams.find((e) => e.id === selectedExamId) ?? null : null;

  if (selectedExamId != null && !selectedExam) {
    setSelectedExamId(null);
  }

  const openCreate = (k: ExamKind) => {
    setEditingId(null);
    setModalKind(k);
    setModalOpen(true);
  };
  const openEdit = (id: number) => {
    setEditingId(id);
    setModalOpen(true);
  };

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg)" }}>
        <div
          className="max-w-md p-6"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--danger-edge)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-panel)",
          }}
        >
          <h2 className="text-base font-bold mb-2" style={{ color: "var(--danger)", fontFamily: "var(--font-mono)" }}>
            Errore di inizializzazione database
          </h2>
          <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>
            L'app non è riuscita a aprire il database locale. Prova a chiudere e riaprire.
            Se il problema persiste, segnala questo messaggio:
          </p>
          <pre
            className="text-[11px] p-2 overflow-auto whitespace-pre-wrap"
            style={{
              background: "rgba(0,0,0,0.4)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--ink-80)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {initError}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="atmos" aria-hidden="true" />
      <div className="app-shell layout-inset">
        <Sidebar
          section={section}
          onSectionChange={setSection}
          onAdd={openCreate}
          onEdit={openEdit}
          onImport={() => setImportOpen(true)}
          onOpenSettings={() => setSection("settings")}
          selectedExamId={selectedExamId}
          onSelectExam={setSelectedExamId}
          settingsTab={settingsTab}
          onSettingsTabChange={setSettingsTab}
        />
        <main className="main-pane">
          <div key={section} className="flex-1 min-h-0 flex flex-col view-enter">
            {section === "calendar" && <Calendar onDayClick={setDayKey} />}
            {section === "stats" && <StatsView onDayClick={setDayKey} selectedExamId={selectedExamId} selectedExam={selectedExam} />}
            {section === "todo" && <TodoView />}
            {section === "settings" && <SettingsView tab={settingsTab} />}
          </div>
        </main>
      </div>
      <ExamModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        initialKind={modalKind}
      />
      <DayModal open={dayKey !== null} dayKey={dayKey} onClose={() => setDayKey(null)} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ExamsProvider>
        <TasksProvider>
          <Shell />
        </TasksProvider>
      </ExamsProvider>
    </ToastProvider>
  );
}
