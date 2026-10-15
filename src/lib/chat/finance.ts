import { findGaps } from "../matching/gaps";
import { budgetShare, roundShare, type SetBudgets } from "../matching/shares";
import { daysUntil } from "./input";

// Deterministic money facts for the planning chat (docs/SPEC-chatbot.md,
// "Affordability and summary"). The model explains these numbers; it never
// computes or changes them, and the UI shows these values, not the model's.

export type BookingFact = { category: string; vendorName: string; status: string; price: number };
/** Listed vendor prices, used only to find the lowest listed price per category. */
export type VendorPriceFact = { category: string; price: number };

export type Verdict = "within_budget" | "tight" | "cannot_cover_all" | "over_budget";

export type AffordabilityRow = {
  category: string;
  share: number;
  booked: number;
  /** share minus booked; negative means over the share. */
  difference: number;
  /** Lowest listed vendor price, only for categories still missing. */
  lowestPrice: number | null;
};

export type Affordability = {
  budget: number;
  committed: number;
  remaining: number;
  /** committed plus the lowest listed price of each missing category that has vendors. */
  projectedMinimum: number;
  verdict: Verdict;
  rows: AffordabilityRow[];
};

export type SummaryState = "confirmed" | "pending" | "needs_replacement" | "missing";

export type PlanSummary = {
  daysUntilEvent: number;
  budget: number;
  committed: number;
  remaining: number;
  counts: { pending: number; confirmed: number; declined: number };
  rows: { category: string; state: SummaryState; vendorName: string | null; amount: number }[];
};

export type Finance = { affordability: Affordability; summary: PlanSummary };

/** Below this share of the budget left after the lowest possible plan, the verdict is "tight". */
const TIGHT_FRACTION = 0.1;

const cents = (n: number) => Math.round((n + Number.EPSILON) * 100);
const fromCents = (c: number) => c / 100;
const isActive = (status: string) => status === "pending" || status === "confirmed";

export function computeFinance(args: {
  /** The event's own service list, in order. */
  services: readonly string[];
  budget: number;
  date: string;
  today: string;
  setBudgets: SetBudgets;
  bookings: readonly BookingFact[];
  vendors: readonly VendorPriceFact[];
}): Finance {
  const { services: checklist, budget, bookings, vendors, setBudgets } = args;
  const missing = findGaps(checklist, bookings);
  const active = bookings.filter((b) => isActive(b.status));

  // Money is summed in whole cents so float drift never shows up in a total.
  const committedCents = active.reduce((sum, b) => sum + cents(b.price), 0);
  const budgetCents = cents(budget);

  const lowest = (category: string): number | null => {
    const prices = vendors.filter((v) => v.category === category).map((v) => cents(v.price));
    return prices.length > 0 ? Math.min(...prices) / 100 : null;
  };

  const rows: AffordabilityRow[] = checklist.map((category) => {
    const share = roundShare(budgetShare(checklist, budget, category, setBudgets));
    const bookedCents = active.filter((b) => b.category === category).reduce((s, b) => s + cents(b.price), 0);
    return {
      category,
      share,
      booked: fromCents(bookedCents),
      difference: fromCents(cents(share) - bookedCents),
      lowestPrice: missing.includes(category) ? lowest(category) : null,
    };
  });

  const missingMinCents = rows.reduce((sum, r) => sum + (r.lowestPrice === null ? 0 : cents(r.lowestPrice)), 0);
  const projectedCents = committedCents + missingMinCents;
  const verdict: Verdict =
    committedCents > budgetCents
      ? "over_budget"
      : projectedCents > budgetCents
        ? "cannot_cover_all"
        : budgetCents - projectedCents < budgetCents * TIGHT_FRACTION
          ? "tight"
          : "within_budget";

  const remaining = fromCents(budgetCents - committedCents);
  const committed = fromCents(committedCents);

  const summaryRows = checklist.map((category) => {
    const inCategory = bookings.filter((b) => b.category === category);
    const activeHere = inCategory.filter((b) => isActive(b.status));
    const state: SummaryState =
      activeHere.some((b) => b.status === "confirmed")
        ? "confirmed"
        : activeHere.length > 0
          ? "pending"
          : inCategory.length > 0
            ? "needs_replacement"
            : "missing";
    return {
      category,
      state,
      vendorName: activeHere.length > 0 ? activeHere.map((b) => b.vendorName).join(", ") : null,
      amount: fromCents(activeHere.reduce((s, b) => s + cents(b.price), 0)),
    };
  });

  const count = (status: string) => bookings.filter((b) => b.status === status).length;

  return {
    affordability: { budget, committed, remaining, projectedMinimum: fromCents(projectedCents), verdict, rows },
    summary: {
      daysUntilEvent: daysUntil(args.today, args.date),
      budget,
      committed,
      remaining,
      counts: { pending: count("pending"), confirmed: count("confirmed"), declined: count("declined") },
      rows: summaryRows,
    },
  };
}
