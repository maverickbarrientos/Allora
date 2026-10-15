import { CHECKLISTS, WEIGHTS, type EventType } from "./config";

/** Set budgets by category (docs/SPEC-event-upgrades.md, "Service budget"). */
export type SetBudgets = Readonly<Record<string, number>>;

const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const toCents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Budget share for a category (docs/SPEC-event-upgrades.md, "Share rule").
 *
 * A category with a set budget (in the event type's checklist) has share = its
 * amount. Every other category gets the remainder, max(0, budget minus the sum
 * of the set budgets), split by weight among the checklist categories that have
 * no set budget. With no set budgets this is budget × weight ÷ (sum of the
 * checklist's weights), as before. Set budgets for categories outside the
 * checklist are ignored. Unrounded; use roundShare for display.
 */
export function budgetShare(
  type: EventType,
  budget: number,
  category: string,
  setBudgets: SetBudgets = {},
): number {
  const checklist = CHECKLISTS[type];
  const isSet = (c: string) => checklist.includes(c) && hasOwn(setBudgets, c);

  if (isSet(category)) return setBudgets[category];

  const setSum = checklist.reduce((sum, c) => (isSet(c) ? sum + setBudgets[c] : sum), 0);
  const remainder = setSum === 0 ? budget : Math.max(0, toCents(budget - setSum));
  const weightTotal = checklist.reduce((sum, c) => (isSet(c) ? sum : sum + (WEIGHTS[c] ?? 0)), 0);
  const weight = WEIGHTS[category] ?? 0;
  if (weightTotal <= 0) return 0;
  return (remainder * weight) / weightTotal;
}

/** Rounds to at most 2 decimals. */
export function roundShare(share: number): number {
  return Math.round((share + Number.EPSILON) * 100) / 100;
}
