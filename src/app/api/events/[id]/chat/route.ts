import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, readJson, requireSession } from "@/lib/api-helpers";
import { requestJson } from "@/lib/llm";
import { CHAT_SYSTEM_PROMPT, buildChatInput } from "@/lib/chat/input";
import { computeFinance } from "@/lib/chat/finance";
import { parseIntent, parseMessages } from "@/lib/chat/messages";
import { toSetBudgets } from "@/lib/server/budgets";
import { fallbackResponse, validateChatOutput } from "@/lib/chat/output";
import type { EventType } from "@/lib/matching/config";
import { findGaps } from "@/lib/matching/gaps";
import { loadEventServices } from "@/lib/server/services";

const CHAT_TIMEOUT_MS = 15000;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return errorResponse(404, "event_not_found", "Event not found.");

    const body = await readJson(req);
    const parsed = parseMessages(body);
    const intent = parseIntent(body);
    if ("error" in parsed) return errorResponse(400, "validation_error", parsed.error);

    // RLS hides events the caller doesn't own, so those read as missing too.
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, type, date, budget, guest_count")
      .eq("id", id)
      .maybeSingle();
    if (eventError) return errorResponse(500, "server_error", "Could not load event.");
    if (!event) return errorResponse(404, "event_not_found", "Event not found.");

    const [bookingsResult, vendorsResult, budgetsResult, services] = await Promise.all([
      supabase
        .from("bookings")
        .select("category, status, created_at, vendor:vendors(name, price)")
        .eq("event_id", id)
        .order("created_at", { ascending: true }),
      supabase.from("vendors").select("category, price"),
      supabase.from("event_budgets").select("category, amount").eq("event_id", id),
      loadEventServices(supabase, id),
    ]);
    if (bookingsResult.error || vendorsResult.error || budgetsResult.error) {
      return errorResponse(500, "server_error", "Could not load the plan.");
    }
    if (!services) return errorResponse(500, "server_error", "Could not load services.");

    const type = event.type as EventType;
    const bookings = (bookingsResult.data ?? []).map((b) => {
      const vendor = Array.isArray(b.vendor) ? b.vendor[0] : b.vendor;
      return {
        category: b.category as string,
        status: b.status as string,
        vendorName: (vendor?.name as string) ?? "",
        price: Number(vendor?.price ?? 0),
      };
    });
    const missing = findGaps(services, bookings);

    const today = new Date().toISOString().slice(0, 10);
    const finance = computeFinance({
      services,
      budget: Number(event.budget),
      date: event.date,
      today,
      setBudgets: toSetBudgets(budgetsResult.data ?? []),
      bookings,
      vendors: (vendorsResult.data ?? []).map((v) => ({ category: v.category as string, price: Number(v.price) })),
    });

    // Nothing is stored. An LLM failure or an invalid answer gives the fallback, never an error.
    const output = await requestJson({
      use: "chat",
      system: CHAT_SYSTEM_PROMPT,
      input: buildChatInput({
        today,
        event: { type, date: event.date, budget: Number(event.budget), guestCount: event.guest_count, services },
        bookings,
        messages: parsed.messages,
        finance,
      }),
      timeoutMs: CHAT_TIMEOUT_MS,
      maxTokens: 600,
      strictJson: true,
    });

    // The block shown is the button's intent, else what the model asked for.
    // Its numbers always come from finance, never from the model.
    const valid = validateChatOutput(output, missing);
    const { show, ...answer } = valid ?? { ...fallbackResponse(type, missing, intent), show: null };
    const block = intent ?? show;
    return NextResponse.json({
      ...answer,
      ...(block === "affordability" ? { affordability: finance.affordability } : {}),
      ...(block === "summary" ? { summary: finance.summary } : {}),
    });
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
