import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, readJson, requireSession } from "@/lib/api-helpers";
import { CHECKLISTS } from "@/lib/matching/config";
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

    // A type change is blocked while service budgets exist outside the new checklist.
    if (fields.type) {
      const { data: rows, error: budgetsError } = await supabase
        .from("event_budgets")
        .select("category")
        .eq("event_id", id);
      if (budgetsError) return errorResponse(500, "server_error", "Could not check budgets.");
      const allowed: readonly string[] = CHECKLISTS[fields.type];
      const outside = (rows ?? [])
        .map((r) => r.category as string)
        .filter((c) => !allowed.includes(c));
      if (outside.length > 0) {
        return errorResponse(
          409,
          "budgets_outside_checklist",
          `Clear these service budgets first: ${outside.join(", ")}.`,
        );
      }
    }

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
