import type { EventType } from "../matching/config";

// Validation of the model's answer and the fallback (docs/SPEC-chatbot.md,
// "Validation of the model output"). All or nothing: any problem gives the
// whole fallback, never a partial answer.

export const REPLY_MAX = 2000;
export const REASON_MAX = 120;

export type OrderItem = { category: string; reason: string };
export type ChatResponse = { reply: string; order: OrderItem[] | null; source: "ai" | "fallback" };

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/**
 * Returns the validated answer with source "ai", or null if anything is off.
 * `missing` is the list of missing categories computed by the server.
 */
export function validateChatOutput(output: unknown, missing: readonly string[]): ChatResponse | null {
  const o = asRecord(output);
  if (!o || typeof o.reply !== "string") return null;
  const reply = o.reply.trim();
  if (reply === "" || reply.length > REPLY_MAX) return null;

  if (o.order === null) return { reply, order: null, source: "ai" };
  if (!Array.isArray(o.order) || missing.length === 0) return null;
  if (o.order.length !== missing.length) return null;

  const expected = new Set(missing);
  const seen = new Set<string>();
  const order: OrderItem[] = [];
  for (const raw of o.order) {
    const item = asRecord(raw);
    if (!item || typeof item.category !== "string" || typeof item.reason !== "string") return null;
    if (!expected.has(item.category) || seen.has(item.category)) return null;
    const reason = item.reason.trim();
    if (reason === "" || reason.length > REASON_MAX) return null;
    seen.add(item.category);
    order.push({ category: item.category, reason });
  }
  return { reply, order, source: "ai" };
}

/** The standard answer, used whenever the model's answer can't be used. */
export function fallbackResponse(type: EventType, missing: readonly string[]): ChatResponse {
  if (missing.length === 0) {
    return { reply: "Every service on the checklist has a booking.", order: null, source: "fallback" };
  }
  return {
    reply: `The planning assistant is unavailable right now. Here is the standard order for the services still missing from your ${type}.`,
    order: missing.map((category) => ({ category, reason: `Standard planning order for a ${type}.` })),
    source: "fallback",
  };
}
