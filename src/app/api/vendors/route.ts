import { NextResponse, type NextRequest } from "next/server";
import { inArea, parseArea } from "@/lib/areas";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, requireSession } from "@/lib/api-helpers";
import { VENDOR_COLUMNS, toVendor } from "@/lib/server/shapes";
import { loadEventDate, unavailableVendorIds } from "@/lib/server/vendor-availability";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    // Any signed-in user may read vendors.
    const auth = await requireSession(supabase);
    if (auth.response) return auth.response;

    const category = req.nextUrl.searchParams.get("category");
    const eventId = req.nextUrl.searchParams.get("eventId");
    // Empty means no filter; text longer than the limit is refused.
    const area = parseArea(req.nextUrl.searchParams.get("area") ?? "");
    if (area === undefined) return errorResponse(400, "validation_error", "Invalid fields: area.");

    // With eventId, every vendor gets availableOnEventDate. The event and the
    // vendors don't depend on each other, so they load together.
    const [event, { data, error }] = await Promise.all([
      eventId !== null ? loadEventDate(supabase, eventId) : null,
      supabase
        .from("vendors")
        .select(VENDOR_COLUMNS)
        .order("name", { ascending: true })
        .order("id", { ascending: true }),
    ]);
    if (event && "response" in event) return event.response;
    if (error) return errorResponse(500, "server_error", "Could not load vendors.");

    // Filtered here, not in the query: Supabase's firewall rejects some
    // free-text values (e.g. SQL-looking strings), which would turn an
    // unknown category into a 500 instead of an empty list.
    // An empty value is treated like no filter ("All").
    // Vendors with no area are kept (docs/SPEC-event-location.md).
    const rows = (data ?? []).filter(
      (v) => (!category || v.category === category) && inArea(v.area, area),
    );

    if (!event) return NextResponse.json({ vendors: rows.map(toVendor) });

    // One query for all vendors: the ids busy on the event's date.
    const busyIds = await unavailableVendorIds(supabase, event.date);
    if (!busyIds) return errorResponse(500, "server_error", "Could not load availability.");

    return NextResponse.json({
      vendors: rows.map((v) => ({ ...toVendor(v), availableOnEventDate: !busyIds.has(v.id) })),
    });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
