import { useExams } from "../state";
import { isProgetto } from "../progetto";

export function Legend() {
  const { exams } = useExams();
  const active = exams.filter((e) => !e.passed);
  if (active.length === 0) return null;

  return (
    <div className="legend">
      {active.map((e) => (
        <span key={e.id} className="item">
          <span
            className={"sw" + (isProgetto(e) ? " proj" : "")}
            style={{ ["--lc" as string]: e.color } as React.CSSProperties}
          />
          {e.name}
        </span>
      ))}
    </div>
  );
}
