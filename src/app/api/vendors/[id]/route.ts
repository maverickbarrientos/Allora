import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, requireSession } from "@/lib/api-helpers";
import { VENDOR_DETAIL_COLUMNS, toVendorDetail } from "@/lib/server/shapes";
import { loadEventDate, unavailableVendorIds } from "@/lib/server/vendor-availability";
import { loadContact } from "@/lib/server/vendor-contacts";

// One vendor's profile (docs/SPEC-vendor-profiles.md). Any signed-in user may
// read vendors. With eventId, the vendor also gets availableOnEventDate.
// Contact details are sent only to the vendor's owner and to a customer with a
// confirmed booking with them; everyone else gets contact: null.
// The database is slow, so independent queries run together: two rounds.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase);
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return errorResponse(404, "vendor_not_found", "Vendor not found.");
    const eventId = req.nextUrl.searchParams.get("eventId");

    // Round 1: the event's date and the vendor. owner is read only to decide
    // contactVisible; it is never sent.
    const [event, { data: vendor, error }] = await Promise.all([
      eventId !== null ? loadEventDate(supabase, eventId) : null,
      supabase.from("vendors").select(`${VENDOR_DETAIL_COLUMNS}, owner`).eq("id", id).maybeSingle(),
    ]);
    if (event && "response" in event) return event.response;
    if (error) return errorResponse(500, "server_error", "Could not load vendor.");
    if (!vendor) return errorResponse(404, "vendor_not_found", "Vendor not found.");

    // Round 2: a confirmed booking with this vendor (RLS: the caller's own
    // bookings only), the contact row (RLS returns it only to the owner or a
    // customer with a confirmed booking) and availability on the event's date.
    const isOwner = vendor.owner === auth.session.user.id;
    const [confirmed, contact, busyIds] = await Promise.all([
      isOwner
        ? null
        : supabase
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("vendor_id", vendor.id)
            .eq("status", "confirmed"),
      loadContact(supabase, vendor.id),
      event ? unavailableVendorIds(supabase, event.date) : null,
    ]);
    if (confirmed?.error) return errorResponse(500, "server_error", "Could not load bookings.");
    if (contact === null) return errorResponse(500, "server_error", "Could not load contact details.");
    if (event && !busyIds) return errorResponse(500, "server_error", "Could not load availability.");

    // The server decides; hidden details are never sent, even if RLS returned a row.
    const contactVisible = isOwner || (confirmed?.count ?? 0) > 0;
    const body = { contact: contactVisible ? contact : null, contactVisible };

    const detail = toVendorDetail(vendor);
    if (!busyIds) return NextResponse.json({ vendor: detail, ...body });
    return NextResponse.json({ vendor: { ...detail, availableOnEventDate: !busyIds.has(vendor.id) }, ...body });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
