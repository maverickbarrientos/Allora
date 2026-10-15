import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, requireSession } from "@/lib/api-helpers";
import { requestJson } from "@/lib/llm";
import { buildCards } from "@/lib/matching/cards";
import { toSetBudgets } from "@/lib/server/budgets";
import { loadEventServices } from "@/lib/server/services";
import type { EventType } from "@/lib/matching/config";
import { MISSING_SYSTEM_PROMPT, applyText, buildLlmInput } from "@/lib/matching/text";

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
      .select("id, type, budget")
      .eq("id", id)
      .maybeSingle();
    if (eventError) return errorResponse(500, "server_error", "Could not load event.");
    if (!event) return errorResponse(404, "event_not_found", "Event not found.");

    const [bookingsResult, vendorsResult, budgetsResult, services] = await Promise.all([
      supabase.from("bookings").select("category, status").eq("event_id", id),
      supabase.from("vendors").select("id, name, category, price"),
      supabase.from("event_budgets").select("category, amount").eq("event_id", id),
      loadEventServices(supabase, id),
    ]);
    if (bookingsResult.error || vendorsResult.error || budgetsResult.error || !services) {
      return errorResponse(500, "server_error", "Could not load the plan.");
    }

    const type = event.type as EventType;
    const ranked = buildCards(
      { services, budget: Number(event.budget) },
      bookingsResult.data ?? [],
      (vendorsResult.data ?? []).map((v) => ({ ...v, price: Number(v.price) })),
      toSetBudgets(budgetsResult.data ?? []),
    );

    // Nothing missing: no model call, so no AI text.
    if (ranked.length === 0) {
      return NextResponse.json({ eventId: event.id, textSource: "fallback", cards: [] });
    }

    // An LLM failure returns null and the templates are used; never an error.
    const output = await requestJson({ system: MISSING_SYSTEM_PROMPT, input: buildLlmInput(type, ranked) });
    const { cards, textSource } = applyText(type, ranked, output);

    return NextResponse.json({ eventId: event.id, textSource, cards });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
