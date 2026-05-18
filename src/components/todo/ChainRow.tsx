import { Fragment } from "react";
import type { Chain } from "../../task-types";
import { TaskCard } from "./TaskCard";
import { nextActionable } from "../../task-domain";

interface Props {
  chain: Chain;
  onEditTask: (id: number) => void;
}

export function ChainRow({ chain, onEditTask }: Props) {
  const next = nextActionable(chain.tasks);
  const nextId = next?.id ?? null;
  return (
    <div className="chain-row">
      {chain.tasks.map((t, i) => (
        <Fragment key={`${chain.pathKey}@${i}`}>
          <TaskCard
            task={t}
            isNextActionable={t.id === nextId}
            onEdit={() => onEditTask(t.id)}
          />
          {i < chain.tasks.length - 1 && <span className="chain-arrow" aria-hidden>→</span>}
        </Fragment>
      ))}
    </div>
  );
}
