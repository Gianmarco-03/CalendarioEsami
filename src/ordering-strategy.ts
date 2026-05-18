import { createContext, useContext } from "react";
import type { Chain } from "./task-types";
import { nextActionable, daysUntilDue, PRIORITY_WEIGHT } from "./task-domain";

export interface OrderingStrategy {
  readonly label: string;
  scoreChain(chain: Chain, today: string): number;
}

export const nextActionableStrategy: OrderingStrategy = {
  label: "next-actionable",
  scoreChain(chain, today) {
    const a = nextActionable(chain.tasks);
    if (!a) return Number.NEGATIVE_INFINITY;
    const prio = PRIORITY_WEIGHT[a.priority] * 1000;
    const d = daysUntilDue(a, today);
    const due = d == null ? 0 : Math.max(0, 30 - d) * 10;
    return prio + due;
  },
};

export function sortChains(chains: Chain[], strategy: OrderingStrategy, today: string): Chain[] {
  return [...chains].sort((a, b) => strategy.scoreChain(b, today) - strategy.scoreChain(a, today));
}

export const OrderingStrategyContext = createContext<OrderingStrategy>(nextActionableStrategy);
export const useOrderingStrategy = (): OrderingStrategy => useContext(OrderingStrategyContext);
