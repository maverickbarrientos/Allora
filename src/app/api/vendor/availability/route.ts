import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api-helpers";
import { parseRange } from "@/lib/availability";
import { requireVendorRole, type VendorBookingRow } from "@/lib/vendor-portal";

// The calling vendor's own calendar: pending and confirmed bookings by event
// date. Declined bookings are left out. `blocked` is always empty: there is no
// blocked-dates table, availability comes from bookings only.
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireVendorRole(supabase);
    if ("error" in auth) return auth.error;

    const range = parseRange(req.nextUrl.searchParams);
    if ("error" in range) return errorResponse(400, "validation_error", range.error);

    const { data: vendor, error: vErr } = await supabase
      .from("vendors")
      .select("id")
      .eq("owner", auth.userId)
      .maybeSingle();
    if (vErr) return errorResponse(500, "server_error", "Could not load vendor.");
    if (!vendor) {
      return errorResponse(404, "vendor_not_linked", "Your account is not linked to a service.");
    }

    const { data, error } = await supabase.rpc("vendor_incoming_bookings");
    if (error) return errorResponse(500, "server_error", "Could not load bookings.");

    // ISO dates compare correctly as strings.
    const bookings = ((data ?? []) as VendorBookingRow[])
      .filter((r) => r.status !== "declined" && r.event_date >= range.from && r.event_date <= range.to)
      .sort((a, b) => a.event_date.localeCompare(b.event_date) || a.id.localeCompare(b.id))
      .map((r) => ({
        bookingId: r.id,
        date: r.event_date,
        status: r.status as "pending" | "confirmed",
        eventType: r.event_type,
        customerName: r.customer_name,
      }));

    return NextResponse.json({ from: range.from, to: range.to, blocked: [], bookings });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
