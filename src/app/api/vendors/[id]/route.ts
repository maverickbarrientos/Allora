import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, requireSession } from "@/lib/api-helpers";
import { VENDOR_DETAIL_COLUMNS, toVendorDetail } from "@/lib/server/shapes";

// One vendor's profile (docs/SPEC-vendor-profiles.md). Any signed-in user may
// read vendors. With eventId, the vendor also gets availableOnEventDate.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase);
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return errorResponse(404, "vendor_not_found", "Vendor not found.");

    // RLS hides events the caller doesn't own, so those (and malformed ids) read as missing.
    const eventId = req.nextUrl.searchParams.get("eventId");
    let eventDate: string | null = null;
    if (eventId !== null) {
      if (!UUID_RE.test(eventId)) return errorResponse(404, "event_not_found", "Event not found.");
      const { data: event, error: eErr } = await supabase
        .from("events")
        .select("date")
        .eq("id", eventId)
        .maybeSingle();
      if (eErr) return errorResponse(500, "server_error", "Could not load event.");
      if (!event) return errorResponse(404, "event_not_found", "Event not found.");
      eventDate = event.date as string;
    }

    const { data: vendor, error } = await supabase
      .from("vendors")
      .select(VENDOR_DETAIL_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) return errorResponse(500, "server_error", "Could not load vendor.");
    if (!vendor) return errorResponse(404, "vendor_not_found", "Vendor not found.");

    if (eventDate === null) return NextResponse.json({ vendor: toVendorDetail(vendor) });

    // The same check as the vendor list, so the two always agree.
    const { data: busy, error: bErr } = await supabase.rpc("vendors_unavailable_on", {
      p_date: eventDate,
    });
    if (bErr) return errorResponse(500, "server_error", "Could not load availability.");
    const available = !((busy ?? []) as string[]).includes(vendor.id);

    return NextResponse.json({ vendor: { ...toVendorDetail(vendor), availableOnEventDate: available } });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
