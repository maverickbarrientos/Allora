import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, requireSession } from "@/lib/api-helpers";
import { VENDOR_COLUMNS, toVendor } from "@/lib/server/shapes";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    // Any signed-in user may read vendors.
    const auth = await requireSession(supabase);
    if (auth.response) return auth.response;

    const category = req.nextUrl.searchParams.get("category");
    const eventId = req.nextUrl.searchParams.get("eventId");

    // With eventId, every vendor gets availableOnEventDate. RLS hides events the
    // caller doesn't own, so those (and malformed ids) read as missing.
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

    const { data, error } = await supabase
      .from("vendors")
      .select(VENDOR_COLUMNS)
      .order("name", { ascending: true })
      .order("id", { ascending: true });
    if (error) return errorResponse(500, "server_error", "Could not load vendors.");

    // Filtered here, not in the query: Supabase's firewall rejects some
    // free-text values (e.g. SQL-looking strings), which would turn an
    // unknown category into a 500 instead of an empty list.
    // An empty value is treated like no filter ("All").
    const rows = category ? (data ?? []).filter((v) => v.category === category) : (data ?? []);

    if (eventDate === null) return NextResponse.json({ vendors: rows.map(toVendor) });

    // One query for all vendors: the ids busy on the event's date.
    const { data: busy, error: bErr } = await supabase.rpc("vendors_unavailable_on", {
      p_date: eventDate,
    });
    if (bErr) return errorResponse(500, "server_error", "Could not load availability.");
    const busyIds = new Set((busy ?? []) as string[]);

    return NextResponse.json({
      vendors: rows.map((v) => ({ ...toVendor(v), availableOnEventDate: !busyIds.has(v.id) })),
    });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
