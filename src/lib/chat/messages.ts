// Request body validation for POST /api/events/:id/chat (docs/SPEC-chatbot.md).

export type ChatMessage = { role: "user" | "assistant"; content: string };

export const MAX_MESSAGES = 20;
export const MAX_CONTENT = 1000;
/** Only the most recent messages reach the model. */
export const HISTORY_FOR_MODEL = 10;

/**
 * Returns the messages, or an error message for a 400 validation_error.
 * Extra fields on the body or on a message are ignored.
 */
export function parseMessages(body: Record<string, unknown> | null): { messages: ChatMessage[] } | { error: string } {
  const raw = body?.messages;
  if (!Array.isArray(raw)) return { error: "messages must be an array." };
  if (raw.length === 0) return { error: "messages must not be empty." };
  if (raw.length > MAX_MESSAGES) return { error: `At most ${MAX_MESSAGES} messages.` };

  const messages: ChatMessage[] = [];
  for (const m of raw) {
    const role = m && typeof m === "object" ? (m as Record<string, unknown>).role : undefined;
    const content = m && typeof m === "object" ? (m as Record<string, unknown>).content : undefined;
    if (role !== "user" && role !== "assistant") return { error: "Each message role must be user or assistant." };
    if (typeof content !== "string") return { error: "Each message content must be a string." };
    if (content.trim() === "") return { error: "Message content must not be empty." };
    if (content.length > MAX_CONTENT) return { error: `Message content must be at most ${MAX_CONTENT} characters.` };
    messages.push({ role, content });
  }
  if (messages[messages.length - 1].role !== "user") return { error: "The last message must be from the user." };
  return { messages };
}
