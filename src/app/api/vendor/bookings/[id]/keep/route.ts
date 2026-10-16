import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api-helpers";
import { requireVendorRole, toVendorBooking, UUID_RE, type VendorBookingRow } from "@/lib/vendor-portal";
import { withVendorPayments } from "@/lib/payments/status";

/**
 * The vendor keeps a booking the customer asked to cancel
 * (docs/SPEC-customer-cancel.md). keep_booking() (030) clears the request and
 * leaves the status alone, so no date or availability rule runs again.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireVendorRole(supabase);
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return errorResponse(404, "booking_not_found", "Booking not found.");

    const { data: kept, error } = await supabase.rpc("keep_booking", { p_booking: id });
    if (error) return errorResponse(500, "server_error", "Could not update booking.");

    const { data: found, error: readErr } = await supabase.rpc("vendor_incoming_bookings").eq("id", id);
    if (readErr) return errorResponse(500, "server_error", "Could not load booking.");
    const rows = (found ?? []) as VendorBookingRow[];
    if (rows.length === 0) return errorResponse(404, "booking_not_found", "Booking not found.");
    if (!kept) return errorResponse(409, "no_request", "This booking has no cancellation request to keep.");

    const [booking] = await withVendorPayments(supabase, [toVendorBooking(rows[0])]);
    return NextResponse.json({ booking });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
