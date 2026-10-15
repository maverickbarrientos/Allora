import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, readJson, requireSession } from "@/lib/api-helpers";
import { parseEventFields } from "@/lib/server/event-input";
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

    const { data, error } = await supabase
      .from("events")
      .insert(fields)
      .select(EVENT_COLUMNS)
      .single();
    if (error || !data) return errorResponse(500, "server_error", "Could not create event.");

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
