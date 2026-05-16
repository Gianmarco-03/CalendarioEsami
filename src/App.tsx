import { useState } from "react";
import { ExamsProvider, useExams } from "./state";
import { ToastProvider } from "./toast";
import { Sidebar } from "./components/Sidebar";
import { ExamModal } from "./components/ExamModal";
import { Calendar } from "./components/Calendar";
import { DayModal } from "./components/DayModal";
import { ImportModal } from "./components/ImportModal";
import { StatsView } from "./components/StatsView";
import { TodoView } from "./components/TodoView";
import { SettingsModal } from "./components/SettingsModal";
import type { AppSection } from "./components/SectionSwitcher";
import type { ExamKind } from "./types";
import { CalendarDays, BarChart3, ListTodo } from "lucide-react";

const SECTION_META: Record<AppSection, { label: string; Icon: typeof CalendarDays }> = {
  calendar: { label: "Calendario Appelli e Studio", Icon: CalendarDays },
  stats:    { label: "Statistiche",                 Icon: BarChart3 },
  todo:     { label: "To-do",                       Icon: ListTodo },
};

function Shell() {
  const { exams, initError } = useExams();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<ExamKind>("esame");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [section, setSection] = useState<AppSection>("calendar");

  const editing = editingId !== null ? exams.find((e) => e.id === editingId) ?? null : null;

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
      <div className="min-h-screen bg-app-bg flex items-center justify-center p-6">
        <div className="max-w-md bg-white rounded-2xl border border-red-200 shadow-lg p-6">
          <h2 className="text-base font-bold text-red-700 mb-2">Errore di inizializzazione database</h2>
          <p className="text-[13px] text-app-fg leading-relaxed mb-3">
            L'app non è riuscita a aprire il database locale. Prova a chiudere e riaprire.
            Se il problema persiste, segnala questo messaggio:
          </p>
          <pre className="text-[11px] bg-[#f4f5f7] border border-[#eef0f3] rounded p-2 overflow-auto whitespace-pre-wrap">{initError}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-app-bg text-app-fg p-4 overflow-hidden transition-colors relative">
      <div className="aurora-bg" aria-hidden="true">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>
      <div className="relative z-0 h-full w-full flex gap-4">
        <Sidebar
          section={section}
          onSectionChange={setSection}
          onAdd={openCreate}
          onEdit={openEdit}
          onImport={() => setImportOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <main className="flex-1 min-w-0 h-full flex flex-col rounded-2xl bg-app-card border border-app-border shadow-sm p-4 overflow-hidden">
          <h1 className="flex items-center gap-2 text-base font-semibold mb-3 shrink-0">
            {(() => { const I = SECTION_META[section].Icon; return <I size={18} />; })()}
            {SECTION_META[section].label}
          </h1>
          <div key={section} className="flex-1 min-h-0 flex flex-col animate-[fade-in_220ms_ease-out]">
            {section === "calendar" && <Calendar onDayClick={setDayKey} />}
            {section === "stats" && <StatsView />}
            {section === "todo" && <TodoView />}
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
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ExamsProvider>
        <Shell />
      </ExamsProvider>
    </ToastProvider>
  );
}
