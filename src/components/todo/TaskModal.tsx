import { useEffect, useState } from "react";
import { Modal } from "../Modal";
import { ModalButton } from "../ModalButton";
import { ListTodo, Trash2 } from "lucide-react";
import { LinkPicker } from "./LinkPicker";
import type { Task, TaskInput, TaskPriority, ChecklistItemInput } from "../../task-types";
import { useTasks } from "../../tasks-state";
import { useExams } from "../../state";

export type ModalState =
  | { mode: "create" }
  | { mode: "edit"; id: number }
  | null;

interface Props {
  state: ModalState;
  onClose: () => void;
}

const EMPTY_FORM: TaskInput = {
  title: "", description: "", examId: null, priority: "normal", dueDate: null, checklist: [],
};

export function TaskModal({ state, onClose }: Props) {
  const { tasks, create, update, remove } = useTasks();
  const { exams } = useExams();

  const editing: Task | null = state?.mode === "edit"
    ? tasks.find((t) => t.id === state.id) ?? null
    : null;

  const [form, setForm] = useState<TaskInput>(EMPTY_FORM);

  useEffect(() => {
    if (state?.mode === "edit" && editing) {
      setForm({
        title: editing.title,
        description: editing.description,
        examId: editing.examId,
        priority: editing.priority,
        dueDate: editing.dueDate,
        checklist: editing.checklist.map((c) => ({
          label: c.label, done: c.done, position: c.position,
        })),
      });
    } else if (state?.mode === "create") {
      setForm(EMPTY_FORM);
    }
  }, [state, editing]);

  if (state == null) return null;

  const submit = async () => {
    const ok = state.mode === "edit"
      ? await update(state.id, form)
      : await create(form);
    if (ok) onClose();
  };

  const onDelete = async () => {
    if (state.mode !== "edit") return;
    if (!confirm("Eliminare questa task?")) return;
    const ok = await remove(state.id);
    if (ok) onClose();
  };

  const addChecklistItem = () => {
    setForm((f) => ({
      ...f,
      checklist: [...f.checklist, { label: "", done: false, position: f.checklist.length }],
    }));
  };

  const updateChecklistItem = (idx: number, patch: Partial<ChecklistItemInput>) => {
    setForm((f) => ({
      ...f,
      checklist: f.checklist.map((c, i) => i === idx ? { ...c, ...patch } : c),
    }));
  };

  const removeChecklistItem = (idx: number) => {
    setForm((f) => ({
      ...f,
      checklist: f.checklist.filter((_, i) => i !== idx).map((c, i) => ({ ...c, position: i })),
    }));
  };

  const footer = (
    <>
      {state.mode === "edit" && (
        <ModalButton variant="danger" onClick={onDelete}>
          <Trash2 size={12} /> Elimina
        </ModalButton>
      )}
      <span style={{ flex: 1 }} />
      <ModalButton variant="secondary" onClick={onClose}>Annulla</ModalButton>
      <ModalButton variant="primary" onClick={submit}>Salva</ModalButton>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={state.mode === "edit" ? "Modifica task" : "Nuova task"}
      icon={ListTodo}
      size="md"
      footer={footer}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          <div className="nx-label">Titolo</div>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Es. Scrivere capitolo 2"
            autoFocus
            style={{ width: "100%", padding: "6px 10px", background: "var(--panel-overlay)",
                     border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)",
                     color: "var(--text)", fontFamily: "var(--font-mono)" }}
          />
        </label>

        <label>
          <div className="nx-label">Descrizione (opzionale)</div>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            style={{ width: "100%", padding: "6px 10px", background: "var(--panel-overlay)",
                     border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)",
                     color: "var(--text)", fontFamily: "var(--font-mono)", resize: "vertical" }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <label>
            <div className="nx-label">Esame</div>
            <select
              value={form.examId == null ? "" : String(form.examId)}
              onChange={(e) => setForm((f) => ({ ...f, examId: e.target.value === "" ? null : Number(e.target.value) }))}
              style={{ width: "100%", padding: "6px 8px", background: "var(--panel-overlay)",
                       border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)",
                       color: "var(--text)", fontFamily: "var(--font-mono)" }}
            >
              <option value="">— Nessuno —</option>
              {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
          </label>

          <label>
            <div className="nx-label">Priorità</div>
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
              style={{ width: "100%", padding: "6px 8px", background: "var(--panel-overlay)",
                       border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)",
                       color: "var(--text)", fontFamily: "var(--font-mono)" }}
            >
              <option value="low">Bassa</option>
              <option value="normal">Normale</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </label>

          <label>
            <div className="nx-label">Scadenza</div>
            <input
              type="date"
              value={form.dueDate ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value || null }))}
              style={{ width: "100%", padding: "6px 8px", background: "var(--panel-overlay)",
                       border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)",
                       color: "var(--text)", fontFamily: "var(--font-mono)" }}
            />
          </label>
        </div>

        <div>
          <div className="nx-label" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Checklist</span>
            <button type="button" onClick={addChecklistItem}
                    style={{ background: "transparent", border: "none", color: "var(--brand)", fontFamily: "var(--font-mono)", fontSize: 11, cursor: "pointer" }}>
              + Item
            </button>
          </div>
          {form.checklist.length === 0 && (
            <div style={{ color: "var(--muted)", fontSize: 11 }}>Niente checklist.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {form.checklist.map((item, idx) => (
              <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(e) => updateChecklistItem(idx, { done: e.target.checked })}
                />
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateChecklistItem(idx, { label: e.target.value })}
                  placeholder="Item"
                  style={{ flex: 1, padding: "4px 8px", background: "var(--panel-overlay)",
                           border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)",
                           color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 11 }}
                />
                <button type="button" onClick={() => removeChecklistItem(idx)}
                        style={{ background: "transparent", border: "none", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 13, cursor: "pointer" }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <LinkPicker task={editing} />
      </div>
    </Modal>
  );
}
