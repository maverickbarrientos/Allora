import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, requireSession } from "@/lib/api-helpers";
import { loadEventServices, withServiceStatus } from "@/lib/server/services";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return errorResponse(404, "event_not_found", "Event not found.");

    // RLS hides events the caller doesn't own, so those read as missing too.
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (eventError) return errorResponse(500, "server_error", "Could not load event.");
    if (!event) return errorResponse(404, "event_not_found", "Event not found.");

    const [services, bookingsResult] = await Promise.all([
      loadEventServices(supabase, id),
      supabase.from("bookings").select("category, status").eq("event_id", id),
    ]);
    if (!services || bookingsResult.error) return errorResponse(500, "server_error", "Could not load services.");

    return NextResponse.json({ services: withServiceStatus(services, bookingsResult.data ?? []) });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
