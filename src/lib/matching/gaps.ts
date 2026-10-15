import { CHECKLISTS, type EventType } from "./config";

type BookingLike = { category: string; status: string };

/**
 * Checklist categories with no pending or confirmed booking, in checklist
 * order. Declined bookings and categories outside the checklist are ignored.
 */
export function findGaps(type: EventType, bookings: readonly BookingLike[]): string[] {
  const covered = new Set(
    bookings
      .filter((b) => b.status === "pending" || b.status === "confirmed")
      .map((b) => b.category),
  );
  return CHECKLISTS[type].filter((category) => !covered.has(category));
}
