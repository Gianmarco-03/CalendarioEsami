import { useState } from "react";
import { ExamsProvider, useExams } from "./state";
import { ToastProvider } from "./toast";
import { Sidebar } from "./components/Sidebar";
import { ExamModal } from "./components/ExamModal";
import { Calendar } from "./components/Calendar";
import { DayModal } from "./components/DayModal";
import type { ExamKind } from "./types";

function Shell() {
  const { exams } = useExams();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<ExamKind>("esame");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dayKey, setDayKey] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-app-bg text-app-fg p-4">
      <div className="max-w-[1100px] mx-auto flex gap-4 items-start">
        <Sidebar onAdd={openCreate} onEdit={openEdit} onImport={() => {}} />
        <main className="flex-1 min-w-0 rounded-2xl bg-white border border-app-border shadow-sm p-4">
          <h1 className="text-base font-semibold mb-3">📅 Calendario Appelli &amp; Studio</h1>
          <Calendar onDayClick={setDayKey} />
        </main>
      </div>
      <ExamModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        initialKind={modalKind}
      />
      <DayModal open={dayKey !== null} dayKey={dayKey} onClose={() => setDayKey(null)} />
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
