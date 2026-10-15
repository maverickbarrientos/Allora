import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, readJson, requireSession } from "@/lib/api-helpers";
import { parseEventFields } from "@/lib/server/event-input";
import { EVENT_COLUMNS, toEvent } from "@/lib/server/shapes";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return errorResponse(404, "event_not_found", "Event not found.");

    const body = await readJson(req);
    const { fields, invalid } = parseEventFields(body, "update");
    if (invalid.length > 0) {
      return errorResponse(400, "validation_error", `Invalid fields: ${invalid.join(", ")}.`);
    }
    if (Object.keys(fields).length === 0) {
      return errorResponse(400, "validation_error", "Provide at least one field to change.");
    }

    // A type change keeps the event's services (docs/SPEC-event-services.md),
    // so it never affects service budgets.

    // RLS limits this to the caller's own events, so others read as missing.
    // A trigger rejects a budget below the sum of the service budgets.
    const { data, error } = await supabase
      .from("events")
      .update(fields)
      .eq("id", id)
      .select(EVENT_COLUMNS);
    if (error) {
      if (error.message === "budget_below_allocations") {
        return errorResponse(
          409,
          "budget_below_allocations",
          "The budget can't be lower than the service budgets already set.",
        );
      }
      // The date trigger (018): a vendor confirmed this date.
      if (error.message === "date_has_confirmed_bookings") {
        return errorResponse(
          409,
          "date_has_confirmed_bookings",
          "This event has confirmed bookings, so its date can't change.",
        );
      }
      return errorResponse(500, "server_error", "Could not update event.");
    }
    if (!data || data.length === 0) {
      return errorResponse(404, "event_not_found", "Event not found.");
    }

    return NextResponse.json({ event: toEvent(data[0]) });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}

// docs/SPEC-event-delete.md. The rule lives only in the events_check_delete
// trigger (011); this handler maps its errors and never recomputes it.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return errorResponse(404, "event_not_found", "Event not found.");

    // RLS limits this to the caller's own events, so others (and events
    // already deleted) delete nothing and read as missing.
    const { data, error } = await supabase.from("events").delete().eq("id", id).select("id");
    if (error) {
      if (error.message === "event_has_pending_bookings") {
        const n = Number(error.details) || 0;
        return errorResponse(
          409,
          "event_has_pending_bookings",
          `This event has ${n} pending booking${n === 1 ? "" : "s"}. Wait for the vendors to respond first.`,
        );
      }
      if (error.message === "event_not_finished") {
        return errorResponse(
          409,
          "event_not_finished",
          `This event has confirmed bookings and hasn't finished. It can be deleted after ${error.details}.`,
        );
      }
      return errorResponse(500, "server_error", "Could not delete event.");
    }
    if (!data || data.length === 0) {
      return errorResponse(404, "event_not_found", "Event not found.");
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
