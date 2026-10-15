// Whether the "Delete event" button is enabled (docs/SPEC-event-delete.md).
// For display only: the database trigger is the only place the rule is
// enforced. "Finished" uses the viewer's local calendar date, compared as
// "YYYY-MM-DD" strings, so no date is ever parsed or shifted.

import { formatYmd, todayYmd, type Ymd } from "@/lib/dates";
import type { BookingStatus } from "@/lib/api/types";

export type DeleteRule = { allowed: true } | { allowed: false; reason: string };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function deleteRule(
  event: { date: Ymd },
  bookings: readonly { status: BookingStatus }[],
  today: Ymd = todayYmd(),
): DeleteRule {
  const pending = bookings.filter((b) => b.status === "pending").length;
  const confirmed = bookings.filter((b) => b.status === "confirmed").length;
  if (pending > 0) {
    return { allowed: false, reason: `Waiting for vendors to respond to ${plural(pending, "pending booking")}.` };
  }
  if (confirmed > 0 && !(event.date < today)) {
    return {
      allowed: false,
      reason: `This event has confirmed bookings and hasn't happened yet. You can delete it after ${formatYmd(event.date)}.`,
    };
  }
  return { allowed: true };
}

/** What the confirmation says will be removed. */
export function deleteSummary(bookingCount: number): string {
  return `${plural(bookingCount, "booking")}, deposit records and service budgets`;
}
