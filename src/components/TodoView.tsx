import "./todo/todo.css";
import { useMemo, useState } from "react";
import { ListTodo, Plus } from "lucide-react";
import { useTasks } from "../tasks-state";
import { useExams } from "../state";
import { useChainEnumerator } from "../chain-enumerator";
import { useOrderingStrategy, sortChains } from "../ordering-strategy";
import { ymd } from "../date";
import { ChainRow } from "./todo/ChainRow";
import { TaskModal, type ModalState } from "./todo/TaskModal";
import { TaskFilters, applyFilters, type TaskFiltersState } from "./todo/TaskFilters";

export function TodoView() {
  const { tasks, loading } = useTasks();
  const { exams } = useExams();
  const enumerator = useChainEnumerator();
  const strategy = useOrderingStrategy();
  const today = ymd(new Date());

  const [filters, setFilters] = useState<TaskFiltersState>({
    hideDone: false, examId: null, minPriority: null,
  });
  const [modalState, setModalState] = useState<ModalState>(null);

  const filtered = useMemo(() => applyFilters(tasks, filters), [tasks, filters]);
  const chains = useMemo(() => enumerator.enumerate(filtered), [enumerator, filtered]);
  const sorted = useMemo(() => sortChains(chains, strategy, today), [chains, strategy, today]);

  // Default cap in maximalPathEnumerator is 200. If raggiunto, segnalo all'utente.
  const CHAIN_CAP = 200;
  const capReached = chains.length >= CHAIN_CAP;

  if (loading && tasks.length === 0) {
    return (
      <div className="todo-empty view-enter">
        <div className="icon-box"><ListTodo size={26} strokeWidth={1.5} /></div>
        <p>Caricamento…</p>
      </div>
    );
  }

  return (
    <div className="todo-view view-enter">
      <TaskFilters value={filters} onChange={setFilters} exams={exams} />
      {capReached && (
        <div className="chain-cap-warning" role="alert">
          Troppe catene possibili. Mostrate prime {CHAIN_CAP}.
        </div>
      )}
      {sorted.length === 0 ? (
        <div className="todo-empty">
          <div className="icon-box"><ListTodo size={26} strokeWidth={1.5} /></div>
          <h2>{tasks.length === 0 ? "Nessuna task" : "Nessuna task con questi filtri"}</h2>
          <p>
            {tasks.length === 0
              ? 'Premi "+" in basso a destra per crearne una. Aggancia le task per ottenere sequenze; le catene più rilevanti compaiono in alto.'
              : "Rimuovi qualche filtro per vedere altre task."}
          </p>
        </div>
      ) : (
        <div className="chain-list">
          {sorted.map((c) => (
            <ChainRow
              key={c.pathKey}
              chain={c}
              onEditTask={(id) => setModalState({ mode: "edit", id })}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        className="todo-fab"
        onClick={() => setModalState({ mode: "create" })}
        aria-label="Nuova task"
      >
        <Plus size={22} />
      </button>
      <TaskModal state={modalState} onClose={() => setModalState(null)} />
    </div>
  );
}
