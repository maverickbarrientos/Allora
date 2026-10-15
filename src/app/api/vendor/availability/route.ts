import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api-helpers";
import { parseRange } from "@/lib/availability";
import { requireOwnVendor, type VendorBookingRow } from "@/lib/vendor-portal";

// The calling vendor's own calendar: pending and confirmed bookings by event
// date, and the dates they blocked. Declined bookings are left out.
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const own = await requireOwnVendor(supabase);
    if ("error" in own) return own.error;

    const range = parseRange(req.nextUrl.searchParams);
    if ("error" in range) return errorResponse(400, "validation_error", range.error);

    const [{ data, error }, blockedResult] = await Promise.all([
      supabase.rpc("vendor_incoming_bookings"),
      supabase
        .from("vendor_blocked_dates")
        .select("date")
        .eq("vendor_id", own.vendorId)
        .gte("date", range.from)
        .lte("date", range.to)
        .order("date", { ascending: true }),
    ]);
    if (error) return errorResponse(500, "server_error", "Could not load bookings.");
    if (blockedResult.error) return errorResponse(500, "server_error", "Could not load blocked dates.");
    const blocked = (blockedResult.data ?? []).map((r) => r.date as string);

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

    return NextResponse.json({ from: range.from, to: range.to, blocked, bookings });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
