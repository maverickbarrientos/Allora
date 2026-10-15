"use client";

import type { PlanBooking } from "@/lib/api/types";
import { Button } from "@/components/ui/button";

/** A booking that no longer holds its service: declined by the vendor, or a cancellation the vendor approved. */
export const isEnded = (b: Pick<PlanBooking, "status">) => b.status === "declined" || b.status === "cancelled";

/**
 * Categories with a declined or cancelled booking and no pending, confirmed or
 * cancel-requested booking, in the order their first booking appears on the plan.
 */
export function replacementCategories(bookings: readonly PlanBooking[]): string[] {
  const active = new Set(bookings.filter((b) => !isEnded(b)).map((b) => b.category));
  const out: string[] = [];
  for (const b of bookings) {
    if (isEnded(b) && !active.has(b.category) && !out.includes(b.category)) out.push(b.category);
  }
  return out;
}

/** True if `next` has a declined or cancelled booking that was not ended (or not there) in `prev`. */
export function hasNewlyDeclined(prev: readonly PlanBooking[], next: readonly PlanBooking[]): boolean {
  const before = new Map(prev.map((b) => [b.id, b.status]));
  return next.some((b) => isEnded(b) && !isEnded({ status: before.get(b.id) ?? "pending" }));
}

/**
 * "Needs a replacement": shown only when at least one category qualifies.
 * Computed from the plan's bookings, so it never waits for the cards.
 */
export function ReplacementNotice({
  categories,
  onSeeReplacements,
}: {
  categories: string[];
  onSeeReplacements: (category: string) => void;
}) {
  if (categories.length === 0) return null;
  return (
    <section
      aria-labelledby="replacement-heading"
      className="flex flex-col gap-4 border-y border-border py-6"
    >
      <h2 id="replacement-heading" className="font-display text-h2">
        Needs a replacement
      </h2>
      <p className="max-w-[65ch] text-muted-foreground">
        These services were declined and have no other booking yet.
      </p>
      <ul className="flex flex-col divide-y divide-border">
        {categories.map((category) => (
          <li key={category} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="label [overflow-wrap:anywhere]">{category}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSeeReplacements(category)}
              aria-label={`See replacements for ${category}`}
            >
              See replacements
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
