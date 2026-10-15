// TEMPORARY mock of GET /api/events/:id/plan with the payment fields
// (docs/SPEC-payment.md). Used only when NEXT_PUBLIC_USE_MOCKS=true.
// Every event id gets the same mock bookings, except "demo-errors" (pay
// triggers, see payments.ts), "missing" (404) and "broken" (500).

import { ApiError } from "@/lib/api/client";
import type { Event, PlanBooking } from "@/lib/api/types";
import { bookingsFor, delay, mockEvent, mockRole, toPlanBooking } from "./payments";

export async function getPlan(eventId: string): Promise<{ event: Event; bookings: PlanBooking[] }> {
  await delay();
  if ((await mockRole()) === "vendor") throw new ApiError(403, "forbidden", "Not allowed for this role.");
  if (eventId === "missing") throw new ApiError(404, "event_not_found", "Event not found.");
  if (eventId === "broken") throw new ApiError(500, "server_error", "Could not load the plan.");
  return {
    event: mockEvent(eventId),
    bookings: bookingsFor(eventId).map((b) => toPlanBooking(b, eventId)),
  };
}
