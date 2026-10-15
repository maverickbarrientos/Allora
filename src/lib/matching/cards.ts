import type { EventType } from "./config";
import { findGaps } from "./gaps";
import { rankVendors, type RankedVendor } from "./rank";
import { budgetShare, roundShare, type SetBudgets } from "./shares";

/** A card before any text is attached. Everything here is deterministic. */
export type RankedCard = { category: string; budgetShare: number; vendors: RankedVendor[] };

type VendorRow = { id: string; name: string; category: string; price: number };

/** One card per gap, in checklist order, each with its ranked vendors. */
export function buildCards(
  event: { type: EventType; budget: number },
  bookings: readonly { category: string; status: string }[],
  vendors: readonly VendorRow[],
  setBudgets: SetBudgets = {},
): RankedCard[] {
  return findGaps(event.type, bookings).map((category) => {
    const share = budgetShare(event.type, event.budget, category, setBudgets);
    return {
      category,
      budgetShare: roundShare(share),
      vendors: rankVendors(
        vendors.filter((v) => v.category === category),
        share,
      ),
    };
  });
}
