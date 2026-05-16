import { useExams } from "../state";
import { ExamRow } from "./ExamRow";
import { Plus, Upload, Search, Settings as SettingsIcon } from "lucide-react";
import { SectionSwitcher, type AppSection } from "./SectionSwitcher";

interface SidebarProps {
  section: AppSection;
  onSectionChange: (s: AppSection) => void;
  onAdd: (kind: "esame" | "progetto") => void;
  onEdit: (id: number) => void;
  onImport: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({ section, onSectionChange, onAdd, onEdit, onImport, onOpenSettings }: SidebarProps) {
  const { exams, loading, searchQuery, setSearchQuery } = useExams();
  const active = exams.filter((e) => !e.passed);
  const passed = exams.filter((e) => e.passed);

  return (
    <aside className="w-[290px] shrink-0 h-full overflow-y-auto rounded-2xl glass-panel shadow-sm p-4 flex flex-col">
      <SectionSwitcher active={section} onChange={onSectionChange} />
      <h2 className="font-semibold text-[15px] mb-1">Esami e progetti</h2>
      <p className="text-[11.5px] text-app-muted leading-relaxed mb-3">
        Clicca un giorno per segnare lo studio. I <b>progetti</b> sono esami che durano più giorni.
        Spunta la casella quando hai superato/completato.
      </p>

      <div className="relative mb-3">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Cerca…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="glass-input w-full pl-8 pr-3 py-1.5 text-[12.5px] rounded-lg focus:outline-2 focus:outline-app-muted"
        />
      </div>

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
          className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold bg-app-accent text-app-accent-fg border border-app-accent hover:bg-app-accent-hover"
        >
          <Plus size={14} /> Esame
        </button>
        <button
          onClick={() => onAdd("progetto")}
          className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold bg-app-card text-app-fg border border-app-input-border hover:bg-app-hover"
        >
          <Plus size={14} /> Progetto
        </button>
      </div>

      <button
        type="button"
        onClick={onImport}
        className="w-full mt-2 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold border border-app-input-border bg-app-card text-app-fg hover:bg-app-hover"
      ><Upload size={13} /> Importa da artifact</button>

      {passed.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-bold text-app-muted uppercase tracking-wide mb-2">Completati</div>
          {passed.map((e) => <ExamRow key={e.id} exam={e} onEdit={onEdit} />)}
        </div>
      )}

      <div className="mt-auto pt-3 flex justify-end">
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Impostazioni"
          title="Impostazioni"
          className="p-2 rounded-lg text-app-muted hover:bg-app-hover hover:text-app-fg transition-colors"
        ><SettingsIcon size={16} /></button>
      </div>
    </aside>
  );
}
