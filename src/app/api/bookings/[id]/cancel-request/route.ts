import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, requireSession } from "@/lib/api-helpers";
import { PLAN_BOOKING_COLUMNS, toPlanBooking } from "@/lib/server/shapes";
import { withPlanPayments } from "@/lib/payments/status";

const notFound = () => errorResponse(404, "booking_not_found", "Booking not found.");

/**
 * The customer asks to cancel a pending or confirmed booking
 * (docs/SPEC-customer-cancel.md). Customers cannot update bookings directly;
 * request_booking_cancellation() (029) checks ownership and status and flags
 * it by setting cancel_requested_at; the status stays as it is. The vendor then approves or keeps it.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return notFound();

    // RLS: customers only see bookings on their own events.
    const { data: existing, error: readErr } = await supabase
      .from("bookings")
      .select("id, status, cancel_requested_at")
      .eq("id", id)
      .maybeSingle();
    if (readErr) return errorResponse(500, "server_error", "Could not load booking.");
    if (!existing) return notFound();
    if (existing.cancel_requested_at) {
      return errorResponse(409, "already_requested", "A cancellation was already requested for this booking.");
    }

    // Null when the status changed since the read (the function checks again).
    const { data: changed, error } = await supabase.rpc("request_booking_cancellation", { p_booking: id });
    if (error) return errorResponse(500, "server_error", "Could not request the cancellation.");
    if (!changed) {
      return errorResponse(409, "not_cancellable", "Only a pending or confirmed booking can be cancelled.");
    }

    const { data: row, error: rowErr } = await supabase
      .from("bookings")
      .select(PLAN_BOOKING_COLUMNS)
      .eq("id", id)
      .single();
    if (rowErr || !row) return errorResponse(500, "server_error", "Could not load booking.");
    const [booking] = await withPlanPayments(supabase, [toPlanBooking(row)]);
    return NextResponse.json({ booking });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
