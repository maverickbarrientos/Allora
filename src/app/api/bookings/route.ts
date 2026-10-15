import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, readJson, requireSession } from "@/lib/api-helpers";
import { PLAN_BOOKING_COLUMNS, toPlanBooking } from "@/lib/server/shapes";
import { withPlanPayments } from "@/lib/payments/status";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    const body = await readJson(req);
    const { eventId, vendorId } = body ?? {};

    const invalid: string[] = [];
    if (typeof eventId !== "string" || !UUID_RE.test(eventId)) invalid.push("eventId");
    if (typeof vendorId !== "string" || !UUID_RE.test(vendorId)) invalid.push("vendorId");
    if (invalid.length > 0) {
      return errorResponse(400, "validation_error", `Invalid fields: ${invalid.join(", ")}.`);
    }

    // RLS hides events the caller doesn't own, so those read as missing too.
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();
    if (eventError) return errorResponse(500, "server_error", "Could not load event.");
    if (!event) return errorResponse(404, "event_not_found", "Event not found.");

    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id, category")
      .eq("id", vendorId)
      .maybeSingle();
    if (vendorError) return errorResponse(500, "server_error", "Could not load vendor.");
    if (!vendor) return errorResponse(404, "vendor_not_found", "Vendor not found.");

    const { data, error } = await supabase
      .from("bookings")
      .insert({ event_id: eventId, vendor_id: vendorId, category: vendor.category, status: "pending" })
      .select(PLAN_BOOKING_COLUMNS)
      .single();
    if (error) {
      // Partial unique index: this vendor is already pending or confirmed for the event.
      if (error.code === "23505") {
        return errorResponse(409, "already_booked", "This vendor is already booked for this event.");
      }
      // The bookings trigger (021): the vendor blocked the date or is confirmed elsewhere on it.
      if (error.message === "vendor_unavailable") {
        return errorResponse(409, "vendor_unavailable", "This vendor isn't available on your event date.");
      }
      return errorResponse(500, "server_error", "Could not create booking.");
    }

    const [booking] = await withPlanPayments(supabase, [toPlanBooking(data)]);
    return NextResponse.json({ booking }, { status: 201 });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
