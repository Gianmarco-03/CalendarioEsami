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
import { SettingsView } from "./components/SettingsView";
import type { AppSection } from "./components/SectionSwitcher";
import type { ExamKind } from "./types";
import { CalendarDays, BarChart3, ListTodo, Globe, Settings as SettingsIcon } from "lucide-react";
import { iconFor } from "./exam-icons";

const SECTION_META: Record<AppSection, { label: string; Icon: typeof CalendarDays }> = {
  calendar: { label: "Calendario Appelli e Studio", Icon: CalendarDays },
  stats:    { label: "Statistiche",                 Icon: BarChart3 },
  todo:     { label: "To-do",                       Icon: ListTodo },
  settings: { label: "Impostazioni",                Icon: SettingsIcon },
};

function Shell() {
  const { exams, initError } = useExams();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<ExamKind>("esame");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [section, setSection] = useState<AppSection>("calendar");
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);

  const editing = editingId !== null ? exams.find((e) => e.id === editingId) ?? null : null;
  const selectedExam = selectedExamId != null ? exams.find((e) => e.id === selectedExamId) ?? null : null;

  // Reset selezione quando l'esame viene eliminato o quando esci dalla sezione stats.
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
    <div className="h-screen w-screen text-app-fg p-4 overflow-hidden transition-colors relative">
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
          onOpenSettings={() => setSection("settings")}
          selectedExamId={selectedExamId}
          onSelectExam={setSelectedExamId}
        />
        <main className="flex-1 min-w-0 h-full flex flex-col rounded-2xl glass-panel shadow-sm p-4 overflow-hidden">
          <StatsHeroTitle section={section} selectedExam={selectedExam} />
          <div key={section} className="flex-1 min-h-0 flex flex-col animate-[fade-in_220ms_ease-out]">
            {section === "calendar" && <Calendar onDayClick={setDayKey} />}
            {section === "stats" && <StatsView onDayClick={setDayKey} selectedExamId={selectedExamId} />}
            {section === "todo" && <TodoView />}
            {section === "settings" && <SettingsView />}
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
    </div>
  );
}

function StatsHeroTitle({
  section, selectedExam,
}: {
  section: AppSection;
  selectedExam: ReturnType<typeof useExams>["exams"][number] | null;
}) {
  if (section !== "stats") {
    const I = SECTION_META[section].Icon;
    return (
      <h1 className="flex items-center gap-2 text-base font-semibold mb-3 shrink-0">
        <I size={18} />
        {SECTION_META[section].label}
      </h1>
    );
  }
  if (selectedExam) {
    const I = iconFor(selectedExam.icon);
    return (
      <h1 className="flex items-center gap-3 text-2xl font-bold mb-4 shrink-0 tracking-tight">
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: selectedExam.color, boxShadow: `0 0 0 3px ${selectedExam.color}33` }}
        >
          <I size={18} style={{ color: "#fff" }} />
        </span>
        <span style={{ color: selectedExam.color }}>{selectedExam.name}</span>
        <span className="text-[12px] text-app-muted font-medium uppercase tracking-wider ml-1">
          {selectedExam.kind === "progetto" ? "progetto" : "esame"}
        </span>
      </h1>
    );
  }
  return (
    <h1 className="flex items-center gap-3 text-2xl font-bold mb-4 shrink-0 tracking-tight">
      <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-app-accent text-app-accent-fg">
        <Globe size={18} />
      </span>
      Globale
      <span className="text-[12px] text-app-muted font-medium uppercase tracking-wider ml-1">tutti gli esami attivi</span>
    </h1>
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
