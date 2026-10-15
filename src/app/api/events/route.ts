import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, readJson, requireSession } from "@/lib/api-helpers";
import { DEFAULT_SERVICES } from "@/lib/matching/config";
import { parseEventFields } from "@/lib/server/event-input";
import { parseServices } from "@/lib/server/services";
import { EVENT_COLUMNS, toEvent } from "@/lib/server/shapes";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    const body = await readJson(req);
    const { fields, invalid } = parseEventFields(body, "create");
    if (invalid.length > 0) {
      return errorResponse(400, "validation_error", `Invalid fields: ${invalid.join(", ")}.`);
    }
    // Optional services; without them the event gets its type's default list.
    // Checked before the insert, so an invalid list never creates an event.
    let services: readonly string[] = DEFAULT_SERVICES[fields.type!];
    if (body?.services !== undefined) {
      const parsed = parseServices(body);
      if ("error" in parsed) return errorResponse(400, "validation_error", parsed.error);
      services = parsed.services;
    }

    const { data, error } = await supabase
      .from("events")
      .insert(fields)
      .select(EVENT_COLUMNS)
      .single();
    if (error || !data) return errorResponse(500, "server_error", "Could not create event.");

    // If the services can't be saved, the event is removed again so no event
    // is left without a list.
    const { error: servicesError } = await supabase.rpc("set_event_services", {
      p_event_id: data.id,
      p_categories: services,
    });
    if (servicesError) {
      await supabase.from("events").delete().eq("id", data.id);
      return errorResponse(500, "server_error", "Could not create event.");
    }

    return NextResponse.json({ event: toEvent(data) }, { status: 201 });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    // RLS limits this to the caller's own events.
    const { data, error } = await supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return errorResponse(500, "server_error", "Could not load events.");

    return NextResponse.json({ events: (data ?? []).map(toEvent) });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
