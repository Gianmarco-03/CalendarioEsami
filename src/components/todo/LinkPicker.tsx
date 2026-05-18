import { useState } from "react";
import type { Task } from "../../task-types";
import { useTasks } from "../../tasks-state";
import { wouldCreateCycle } from "../../dag-validator";
import { isLinkExamCompatible } from "../../link-validator";

interface Props {
  /** Task corrente (in edit). null in create mode → picker disabilitato. */
  task: Task | null;
}

export function LinkPicker({ task }: Props) {
  const { tasks, addLink, removeLink } = useTasks();
  if (!task) {
    return (
      <div className="link-picker">
        <h4>Predecessori / successori</h4>
        <div style={{ color: "var(--muted)", fontSize: 11 }}>
          Salva la task per poterle aggiungere link.
        </div>
      </div>
    );
  }

  const preds = task.predecessorIds
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => t != null);
  const succs = task.successorIds
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => t != null);

  return (
    <div className="link-picker">
      <LinkDirection
        title="Predecessori (fai PRIMA queste)"
        current={preds}
        candidates={tasks.filter((t) =>
          t.id !== task.id
          && !task.predecessorIds.includes(t.id)
          && isLinkExamCompatible(t, task)
          && !wouldCreateCycle(tasks, t.id, task.id)
        )}
        onAdd={(predId) => addLink(predId, task.id)}
        onRemove={(predId) => removeLink(predId, task.id)}
      />
      <LinkDirection
        title="Successori (fai DOPO queste)"
        current={succs}
        candidates={tasks.filter((t) =>
          t.id !== task.id
          && !task.successorIds.includes(t.id)
          && isLinkExamCompatible(task, t)
          && !wouldCreateCycle(tasks, task.id, t.id)
        )}
        onAdd={(succId) => addLink(task.id, succId)}
        onRemove={(succId) => removeLink(task.id, succId)}
      />
    </div>
  );
}

interface DirProps {
  title: string;
  current: Task[];
  candidates: Task[];
  onAdd: (id: number) => Promise<boolean>;
  onRemove: (id: number) => Promise<boolean>;
}

function LinkDirection({ title, current, candidates, onAdd, onRemove }: DirProps) {
  const [selected, setSelected] = useState<string>("");
  return (
    <div>
      <h4>{title}</h4>
      {current.length === 0 && (
        <div style={{ color: "var(--muted)", fontSize: 11, padding: "4px 0" }}>Nessuno</div>
      )}
      {current.map((t) => (
        <div key={t.id} className="link-row">
          <span className="name">{t.title}</span>
          <button type="button" className="remove" onClick={() => void onRemove(t.id)} aria-label={`Rimuovi link ${t.title}`}>×</button>
        </div>
      ))}
      {candidates.length > 0 && (
        <select
          value={selected}
          onChange={(e) => {
            const id = Number(e.target.value);
            if (!id) return;
            void onAdd(id).then((ok) => { if (ok) setSelected(""); });
          }}
        >
          <option value="">+ Aggiungi…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      )}
    </div>
  );
}
