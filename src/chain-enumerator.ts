import { createContext, useContext } from "react";
import type { Task, Chain } from "./task-types";
import { buildIndex, roots } from "./task-domain";

export interface ChainEnumerator {
  readonly label: string;
  enumerate(tasks: Task[]): Chain[];
}

/** Default: DFS forward da ogni root, emette ogni maximal path. Cap a `maxChains`. */
export function maximalPathEnumerator(opts: { maxChains?: number } = {}): ChainEnumerator {
  const cap = opts.maxChains ?? 200;
  return {
    label: "maximal-paths",
    enumerate(tasks) {
      const index = buildIndex(tasks);
      const out: Chain[] = [];
      const dfs = (path: Task[]) => {
        if (out.length >= cap) return;
        const tail = path[path.length - 1];
        if (tail.successorIds.length === 0) {
          out.push({
            rootId: path[0].id,
            tasks: path,
            pathKey: path.map((t) => t.id).join(">"),
          });
          return;
        }
        for (const sid of tail.successorIds) {
          const next = index.get(sid);
          if (!next) continue;
          if (path.some((p) => p.id === next.id)) continue;
          dfs([...path, next]);
        }
      };
      for (const r of roots(tasks)) dfs([r]);
      // Task isolate (no preds, no succs): roots() le include come catene di 1 nodo.
      return out;
    },
  };
}

export const ChainEnumeratorContext = createContext<ChainEnumerator>(maximalPathEnumerator());
export const useChainEnumerator = (): ChainEnumerator => useContext(ChainEnumeratorContext);
