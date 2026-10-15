import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, errorResponse, readJson, requireSession } from "@/lib/api-helpers";
import { requestJson } from "@/lib/llm";
import { CHAT_SYSTEM_PROMPT, buildChatInput } from "@/lib/chat/input";
import { parseMessages } from "@/lib/chat/messages";
import { fallbackResponse, validateChatOutput } from "@/lib/chat/output";
import type { EventType } from "@/lib/matching/config";
import { findGaps } from "@/lib/matching/gaps";

const CHAT_TIMEOUT_MS = 15000;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireSession(supabase, "customer");
    if (auth.response) return auth.response;

    const { id } = await params;
    if (!UUID_RE.test(id)) return errorResponse(404, "event_not_found", "Event not found.");

    const parsed = parseMessages(await readJson(req));
    if ("error" in parsed) return errorResponse(400, "validation_error", parsed.error);

    // RLS hides events the caller doesn't own, so those read as missing too.
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, type, date, budget, guest_count")
      .eq("id", id)
      .maybeSingle();
    if (eventError) return errorResponse(500, "server_error", "Could not load event.");
    if (!event) return errorResponse(404, "event_not_found", "Event not found.");

    const { data: rows, error: bookingsError } = await supabase
      .from("bookings")
      .select("category, status, created_at, vendor:vendors(name)")
      .eq("event_id", id)
      .order("created_at", { ascending: true });
    if (bookingsError) return errorResponse(500, "server_error", "Could not load bookings.");

    const type = event.type as EventType;
    const bookings = (rows ?? []).map((b) => {
      const vendor = Array.isArray(b.vendor) ? b.vendor[0] : b.vendor;
      return { category: b.category as string, status: b.status as string, vendorName: (vendor?.name as string) ?? "" };
    });
    const missing = findGaps(type, bookings);

    // Nothing is stored. An LLM failure or an invalid answer gives the fallback, never an error.
    const output = await requestJson({
      system: CHAT_SYSTEM_PROMPT,
      input: buildChatInput({
        today: new Date().toISOString().slice(0, 10),
        event: { type, date: event.date, budget: Number(event.budget), guestCount: event.guest_count },
        bookings,
        messages: parsed.messages,
      }),
      timeoutMs: CHAT_TIMEOUT_MS,
      maxTokens: 1000,
      strictJson: true,
    });

    return NextResponse.json(validateChatOutput(output, missing) ?? fallbackResponse(type, missing));
  } catch {
    return errorResponse(500, "server_error", "Unexpected error.");
  }
}
