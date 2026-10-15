import { MAX_VENDORS_PER_CARD } from "./config";

type VendorLike = { id: string; name: string; price: number };
export type RankedVendor = { id: string; name: string; price: number; matchPercent: number };

/**
 * round(100 × (1 − |price − share| ÷ share)), clamped to 0..100.
 * 0 means "not a match" and is excluded by rankVendors.
 */
export function matchPercent(price: number, share: number): number {
  if (!(share > 0)) return 0;
  const distance = Math.abs(price - share) / share;
  return Math.min(100, Math.max(0, Math.round(100 * (1 - distance))));
}

// Plain code-unit comparison so the order never depends on the server locale.
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Vendors with a match above 0, ordered by matchPercent descending, then price
 * ascending, then name, then id. Keeps the first MAX_VENDORS_PER_CARD.
 */
export function rankVendors(vendors: readonly VendorLike[], share: number): RankedVendor[] {
  return vendors
    .map((v) => ({ id: v.id, name: v.name, price: v.price, matchPercent: matchPercent(v.price, share) }))
    .filter((v) => v.matchPercent > 0)
    .sort(
      (a, b) =>
        b.matchPercent - a.matchPercent ||
        a.price - b.price ||
        compareText(a.name, b.name) ||
        compareText(a.id, b.id),
    )
    .slice(0, MAX_VENDORS_PER_CARD);
}
