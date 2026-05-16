import { ListTodo } from "lucide-react";

export function TodoView() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-16">
      <ListTodo size={48} className="text-app-muted mb-4" />
      <h2 className="text-lg font-semibold mb-2">To-do</h2>
      <p className="text-[13px] text-app-muted max-w-sm">
        In arrivo: lista attività per esame, deadline, sotto-task, priorità.
      </p>
      <span className="mt-4 text-[10.5px] font-bold uppercase tracking-wide text-app-muted bg-[#eef0f3] px-2 py-0.5 rounded">
        Work in progress
      </span>
    </div>
  );
}
