import type { Task } from "../../task-types";
import { useTasks } from "../../tasks-state";

interface Props {
  /** Task corrente (in edit). null in create mode → picker disabilitato. */
  task: Task | null;
}

/**
 * Vista dei link esistenti di una task. Permette solo la RIMOZIONE.
 * L'aggiunta di nuovi link avviene via drag-and-drop sulla catena o
 * via pulsante "+" affianco al titolo della task (crea successore).
 */
export function LinkPicker({ task }: Props) {
  const { tasks, removeLink } = useTasks();
  if (!task) {
    return (
      <div className="link-picker">
        <h4>Predecessori / successori</h4>
        <div className="link-picker-empty">
          Salva la task: i link si creano trascinando le task sulla catena
          (o tramite "+" affianco al titolo).
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

  if (preds.length === 0 && succs.length === 0) {
    return (
      <div className="link-picker">
        <h4>Link</h4>
        <div className="link-picker-empty">
          Nessun link. Trascina un'altra task <strong>sopra</strong> questa per dichiarare
          che la precede; oppure usa il "+" affianco al titolo per crearne una già linkata.
        </div>
      </div>
    );
  }

  return (
    <div className="link-picker">
      {preds.length > 0 && (
        <LinkDirection
          title="Da fare PRIMA"
          current={preds}
          onRemove={(predId) => removeLink(predId, task.id)}
        />
      )}
      {succs.length > 0 && (
        <LinkDirection
          title="Da fare DOPO"
          current={succs}
          onRemove={(succId) => removeLink(task.id, succId)}
        />
      )}
    </div>
  );
}

interface DirProps {
  title: string;
  current: Task[];
  onRemove: (id: number) => Promise<boolean>;
}

function LinkDirection({ title, current, onRemove }: DirProps) {
  return (
    <div>
      <h4>{title}</h4>
      {current.map((t) => (
        <div key={t.id} className="link-row">
          <span className="name">{t.title}</span>
          <button
            type="button"
            className="remove"
            onClick={() => void onRemove(t.id)}
            aria-label={`Rimuovi link ${t.title}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
