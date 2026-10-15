import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, requireSession } from "@/lib/api-helpers";
import { EVENT_COLUMNS, PLAN_BOOKING_COLUMNS, toEvent, toPlanBooking } from "@/lib/server/shapes";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return errorResponse(404, "event_not_found", "Event not found.");

    // RLS hides events the caller doesn't own, so those read as missing too.
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (eventError) return errorResponse(500, "server_error", "Could not load event.");
    if (!event) return errorResponse(404, "event_not_found", "Event not found.");

    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select(PLAN_BOOKING_COLUMNS)
      .eq("event_id", id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (bookingsError) return errorResponse(500, "server_error", "Could not load bookings.");

    return NextResponse.json({
      event: toEvent(event),
      bookings: (bookings ?? []).map(toPlanBooking),
    });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
