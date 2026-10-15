import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, readJson } from "@/lib/api-helpers";
import {
  requireVendorRole,
  toVendorBooking,
  UUID_RE,
  type VendorBookingRow,
} from "@/lib/vendor-portal";

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

    // Applies only while pending; RLS limits it to this vendor's own bookings.
    const { data: updated, error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", id)
      .eq("status", "pending")
      .select("id");
    if (error) return errorResponse(500, "server_error", "Could not update booking.");

    const { data: found, error: readErr } = await supabase
      .rpc("vendor_incoming_bookings")
      .eq("id", id);
    if (readErr) return errorResponse(500, "server_error", "Could not load booking.");

    const rows = (found ?? []) as VendorBookingRow[];
    if (!updated || updated.length === 0) {
      return rows.length > 0
        ? errorResponse(409, "already_decided", "This booking has already been decided.")
        : errorResponse(404, "booking_not_found", "Booking not found.");
    }
    if (rows.length === 0) {
      return errorResponse(500, "server_error", "Could not load booking.");
    }
    return NextResponse.json({ booking: toVendorBooking(rows[0]) });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
