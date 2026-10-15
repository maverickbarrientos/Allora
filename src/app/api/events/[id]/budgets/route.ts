import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, readJson, requireSession } from "@/lib/api-helpers";
import { loadBudgetSummary, parseBudgetEntries } from "@/lib/server/budgets";
import { loadEventServices } from "@/lib/server/services";

type Ctx = { params: Promise<{ id: string }> };

// RLS hides events the caller doesn't own, so those read as missing too.
async function loadEvent(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("events")
    .select("id, budget")
    .eq("id", id)
    .maybeSingle();
  if (error) return { response: errorResponse(500, "server_error", "Could not load event.") };
  if (!data) return { response: errorResponse(404, "event_not_found", "Event not found.") };
  const services = await loadEventServices(supabase, id);
  if (!services) return { response: errorResponse(500, "server_error", "Could not load services.") };
  return {
    event: { id: data.id as string, services, budget: Number(data.budget) },
  };
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return errorResponse(404, "event_not_found", "Event not found.");

    const found = await loadEvent(supabase, id);
    if ("response" in found) return found.response;

    const summary = await loadBudgetSummary(supabase, found.event);
    if (!summary) return errorResponse(500, "server_error", "Could not load budgets.");
    return NextResponse.json(summary);
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

    const found = await loadEvent(supabase, id);
    if ("response" in found) return found.response;

    const parsed = parseBudgetEntries(await readJson(req), found.event.services, found.event.budget);
    if ("error" in parsed) return errorResponse(400, "validation_error", parsed.error);

    // One database function call is one transaction: all entries apply or none do.
    const { error } = await supabase.rpc("set_event_budgets", {
      p_event_id: id,
      p_entries: parsed.entries,
    });
    if (error) {
      if (error.message === "over_allocated") {
        return errorResponse(
          409,
          "over_allocated",
          "Service budgets can't add up to more than the event budget.",
        );
      }
      return errorResponse(500, "server_error", "Could not save budgets.");
    }

    const fresh = await loadEvent(supabase, id);
    if ("response" in fresh) return fresh.response;
    const summary = await loadBudgetSummary(supabase, fresh.event);
    if (!summary) return errorResponse(500, "server_error", "Could not load budgets.");
    return NextResponse.json(summary);
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
