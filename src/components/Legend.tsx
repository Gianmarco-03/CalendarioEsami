import { useExams } from "../state";

export function Legend() {
  const { exams } = useExams();
  const active = exams.filter((e) => !e.passed);

  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 mt-3.5 pt-3 border-t border-[#eef0f3]">
      {active.length === 0 ? (
        <span className="text-[11.5px] text-app-muted">
          Aggiungi un esame o un progetto per iniziare.
        </span>
      ) : (
        active.map((e) => (
          <div key={e.id} className="flex items-center gap-1.5 text-[11.5px] text-[#555b69]">
            <span
              className={"w-[11px] h-[11px] " + (e.kind === "progetto" ? "rounded" : "rounded-full")}
              style={{ background: e.color }}
            />
            {e.name}
          </div>
        ))
      )}
    </div>
  );
}
