import { inArea } from "@/lib/areas";
import { findGaps } from "./gaps";
import { rankVendors, type RankedVendor } from "./rank";
import { budgetShare, roundShare, type SetBudgets } from "./shares";

/** A card before any text is attached. Everything here is deterministic. */
export type RankedCard = { category: string; budgetShare: number; vendors: RankedVendor[] };

type VendorRow = { id: string; name: string; category: string; price: number; location?: string | null };

/** One card per gap, in the event's service order, each with its ranked vendors. */
export function buildCards(
  event: { services: readonly string[]; budget: number; location?: string | null },
  bookings: readonly { category: string; status: string }[],
  vendors: readonly VendorRow[],
  setBudgets: SetBudgets = {},
): RankedCard[] {
  return findGaps(event.services, bookings).map((category) => {
    const share = budgetShare(event.services, event.budget, category, setBudgets);
    return {
      category,
      budgetShare: roundShare(share),
      vendors: rankVendors(
        vendors.filter((v) => v.category === category && inArea(v.location ?? null, event.location ?? null)),
        share,
      ),
    };
  });
}
