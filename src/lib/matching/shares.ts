import { CHECKLISTS, WEIGHTS, type EventType } from "./config";

/**
 * Budget share for a category: budget × weight ÷ (sum of the checklist's
 * weights). Unrounded; use roundShare for display.
 */
export function budgetShare(type: EventType, budget: number, category: string): number {
  const total = CHECKLISTS[type].reduce((sum, c) => sum + (WEIGHTS[c] ?? 0), 0);
  const weight = WEIGHTS[category] ?? 0;
  if (total <= 0) return 0;
  return (budget * weight) / total;
}

/** Rounds to at most 2 decimals. */
export function roundShare(share: number): number {
  return Math.round((share + Number.EPSILON) * 100) / 100;
}
