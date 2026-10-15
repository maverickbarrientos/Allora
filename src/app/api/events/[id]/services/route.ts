import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, readJson, requireSession } from "@/lib/api-helpers";
import { capitalize } from "@/lib/format";
import { loadEventServices, parseServices, withServiceStatus } from "@/lib/server/services";

type Ctx = { params: Promise<{ id: string }> };

// RLS hides events the caller doesn't own, so those read as missing too.
async function eventExists(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("events").select("id").eq("id", id).maybeSingle();
  if (error) return errorResponse(500, "server_error", "Could not load event.");
  if (!data) return errorResponse(404, "event_not_found", "Event not found.");
  return null;
}

/** The current list with a status per service. */
async function servicesResponse(supabase: SupabaseClient, id: string) {
  const [services, bookingsResult] = await Promise.all([
    loadEventServices(supabase, id),
    supabase.from("bookings").select("category, status").eq("event_id", id),
  ]);
  if (!services || bookingsResult.error) return errorResponse(500, "server_error", "Could not load services.");
  return NextResponse.json({ services: withServiceStatus(services, bookingsResult.data ?? []) });
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return errorResponse(404, "event_not_found", "Event not found.");

    const missing = await eventExists(supabase, id);
    if (missing) return missing;
    return await servicesResponse(supabase, id);
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return errorResponse(404, "event_not_found", "Event not found.");

    const parsed = parseServices(await readJson(req));
    if ("error" in parsed) return errorResponse(400, "validation_error", parsed.error);

    const missing = await eventExists(supabase, id);
    if (missing) return missing;

    // One database function call is one transaction: the whole list applies or
    // none of it does. It refuses to remove a service with an active booking.
    const { error } = await supabase.rpc("set_event_services", {
      p_event_id: id,
      p_categories: parsed.services,
    });
    if (error) {
      if (error.message === "service_has_active_booking") {
        const blocked = (error.details ?? "").split(", ").filter(Boolean).map(capitalize).join(", ");
        return errorResponse(
          409,
          "service_has_active_booking",
          `Can't remove ${blocked || "these services"}: they have a booking.`,
        );
      }
      if (error.message === "invalid_services") {
        return errorResponse(400, "validation_error", "The service list is not valid.");
      }
      return errorResponse(500, "server_error", "Could not save services.");
    }

    return await servicesResponse(supabase, id);
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
