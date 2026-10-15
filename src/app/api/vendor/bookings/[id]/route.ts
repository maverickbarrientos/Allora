import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, readJson } from "@/lib/api-helpers";
import {
  requireVendorRole,
  toVendorBooking,
  UUID_RE,
  type VendorBookingRow,
} from "@/lib/vendor-portal";
import { withVendorPayments } from "@/lib/payments/status";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireVendorRole(supabase);
    if ("error" in auth) return auth.error;

    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return errorResponse(404, "booking_not_found", "Booking not found.");

    const body = await readJson(req);
    const status = body?.status;
    if (status !== "confirmed" && status !== "declined") {
      return errorResponse(400, "validation_error", "status must be confirmed or declined.");
    }

    // Applies only when the status actually changes, so of two simultaneous
    // same-status requests one updates and the other matches no row.
    // RLS limits it to this vendor's own bookings.
    const { data: updated, error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", id)
      .neq("status", status)
      .select("id");
    if (error) {
      // bookings_event_vendor_active_uniq (002): another pending or confirmed
      // booking exists for the same event and vendor.
      if (error.code === "23505") {
        return errorResponse(
          409,
          "conflicting_booking",
          "The customer has another active booking with you for this event.",
        );
      }
      // The confirm trigger (017): the date is taken. The hint says why.
      if (error.message === "date_unavailable") {
        const date = error.details ?? "this date";
        return errorResponse(
          409,
          "date_unavailable",
          error.hint === "blocked"
            ? `You blocked ${date} on your calendar. Unblock it to accept this booking.`
            : `You already have a confirmed booking on ${date}.`,
        );
      }
      return errorResponse(500, "server_error", "Could not update booking.");
    }

    const { data: found, error: readErr } = await supabase
      .rpc("vendor_incoming_bookings")
      .eq("id", id);
    if (readErr) return errorResponse(500, "server_error", "Could not load booking.");

    const rows = (found ?? []) as VendorBookingRow[];
    if (!updated || updated.length === 0) {
      return rows.length > 0
        ? errorResponse(409, "status_unchanged", `This booking is already ${status}.`)
        : errorResponse(404, "booking_not_found", "Booking not found.");
    }
    if (rows.length === 0) {
      return errorResponse(500, "server_error", "Could not load booking.");
    }
    // The refund trigger (008) has already run in the same transaction as the update.
    const [booking] = await withVendorPayments(supabase, [toVendorBooking(rows[0])]);
    return NextResponse.json({ booking });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
