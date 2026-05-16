import { useExams } from "../state";
import { ExamRow } from "./ExamRow";

interface SidebarProps {
  onAdd: (kind: "esame" | "progetto") => void;
  onEdit: (id: number) => void;
  onImport: () => void;
}

export function Sidebar({ onAdd, onEdit, onImport }: SidebarProps) {
  const { exams, loading, searchQuery, setSearchQuery } = useExams();
  const active = exams.filter((e) => !e.passed);
  const passed = exams.filter((e) => e.passed);

  return (
    <aside className="w-[290px] shrink-0 rounded-2xl bg-white border border-app-border shadow-sm p-4">
      <h2 className="font-semibold text-[15px] mb-1">Esami e progetti</h2>
      <p className="text-[11.5px] text-app-muted leading-relaxed mb-3">
        Clicca un giorno per segnare lo studio. I <b>progetti</b> sono esami che durano più giorni.
        Spunta la casella quando hai superato/completato.
      </p>

      <input
        type="text"
        placeholder="Cerca…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full mb-3 px-3 py-1.5 text-[12.5px] border border-[#d6d9e0] rounded-lg focus:outline-2 focus:outline-[#aeb4c0]"
      />

      <div>
        {loading && <div className="text-[12px] text-app-muted">Caricamento…</div>}
        {!loading && active.length === 0 && exams.length === 0 && (
          <div className="text-[12px] text-app-muted py-1.5">
            Niente ancora. Aggiungi un esame o un progetto qui sotto.
          </div>
        )}
        {!loading && active.length === 0 && exams.length > 0 && searchQuery.trim() && (
          <div className="text-[12px] text-app-muted py-1.5">Nessun esame attivo corrisponde alla ricerca.</div>
        )}
        {active.map((e) => <ExamRow key={e.id} exam={e} onEdit={onEdit} />)}
      </div>

      <div className="flex gap-2 mt-1">
        <button
          onClick={() => onAdd("esame")}
          className="flex-1 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold bg-[#2f3545] text-white border border-[#2f3545] hover:bg-[#1f2430]"
        >
          + Esame
        </button>
        <button
          onClick={() => onAdd("progetto")}
          className="flex-1 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold bg-white text-[#2f3545] border border-[#d6d9e0] hover:bg-[#f4f5f7]"
        >
          + Progetto
        </button>
      </div>

      <button
        type="button"
        onClick={onImport}
        className="w-full mt-2 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold border border-[#d6d9e0] bg-white text-[#2f3545] hover:bg-[#f4f5f7]"
      >↥ Importa da artifact</button>

      {passed.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-bold text-app-muted uppercase tracking-wide mb-2">Completati</div>
          {passed.map((e) => <ExamRow key={e.id} exam={e} onEdit={onEdit} />)}
        </div>
      )}
    </aside>
  );
}
