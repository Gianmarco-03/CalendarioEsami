import { ListTodo } from "lucide-react";

export function TodoView() {
  return (
    <div className="todo-empty view-enter">
      <div className="icon-box">
        <ListTodo size={26} strokeWidth={1.5} />
      </div>
      <h2>In arrivo</h2>
      <p>
        Lista attività per esame, deadline, sotto-task e priorità.
        L'agenda ti dirà cosa fare prima.
      </p>
      <span className="wip-badge">work in progress</span>
    </div>
  );
}
