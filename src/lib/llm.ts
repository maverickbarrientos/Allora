// The only file that calls the LLM API. Server-side only: import it from route
// handlers, never from client components. Keys are read from the environment
// and are never logged or returned.
//
// Provider: OpenRouter's OpenAI-compatible chat completions endpoint, called
// with plain fetch (no SDK).
//
// Settings come from the environment, per use ("cards" for the "What's missing"
// cards, "chat" for the planning assistant), so the two can run on different
// keys or models. For the key, the first of these that is set wins:
//   LLM_CARDS_API_KEY or LLM_CHAT_API_KEY  (that use only)
//   LLM_API_KEY                            (both uses)
// The model is LLM_CARDS_MODEL or LLM_CHAT_MODEL, else the default below.

export type LlmUse = "cards" | "chat";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-haiku-5.5";
const DEFAULT_TIMEOUT_MS = 8000;

/** The key and model for one use, read at call time. */
export function llmConfig(use: LlmUse) {
  const name = `LLM_${use.toUpperCase()}`;
  const env = process.env;
  return {
    key: env[`${name}_API_KEY`] || env.LLM_API_KEY,
    model: env[`${name}_MODEL`] || MODEL,
  };
}

type JsonRequest = {
  /** Which settings to use. */
  use: LlmUse;
  system: string;
  /** Sent as the user message. Objects are JSON-encoded. */
  input: unknown;
  timeoutMs?: number;
  maxTokens?: number;
};

/**
 * Asks the model for a JSON reply and returns it parsed, or null on any
 * failure: missing key, timeout, HTTP error, network error, empty or
 * non-JSON output. Never throws.
 */
export async function requestJson({
  use,
  system,
  input,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxTokens = 1500,
}: JsonRequest): Promise<unknown | null> {
  const { key, model } = llmConfig(use);
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: maxTokens,
        // Short text tasks: no hidden reasoning. With it on, calls took 5 to 7.5 s
        // (close to the 8 s timeout) and reasoning tokens ate into max_tokens.
        reasoning: { enabled: false },
        messages: [
          { role: "system", content: system },
          { role: "user", content: typeof input === "string" ? input : JSON.stringify(input) },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      // The provider's error message (for example "requires more credits"), cut
      // short. Never the key.
      const message = await res.json().then((d) => d?.error?.message, () => undefined);
      console.warn(`LLM ${use} call failed: HTTP ${res.status}${typeof message === "string" ? `: ${message.slice(0, 200)}` : ""}`);
      return null;
    }
    const data = await res.json();
    const choice = data?.choices?.[0];
    const content = typeof choice?.message?.content === "string" ? choice.message.content : "";
    // finish_reason "length" means the answer was cut off, so its JSON is incomplete.
    const detail = `finish_reason=${choice?.finish_reason}, ${content.length} characters`;
    if (content.trim() === "") {
      console.warn(`LLM ${use} reply was empty (${detail})`);
      return null;
    }
    const parsed = parseJson(content);
    if (parsed === null) console.warn(`LLM ${use} reply was not valid JSON (${detail}, starts with ${JSON.stringify(content.trim().slice(0, 12))})`);
    return parsed;
  } catch {
    console.warn(`LLM ${use} call failed: ${controller.signal.aborted ? "timeout" : "network or parse error"}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Parses a JSON reply. A surrounding ```json fence is tolerated, as Claude often adds one. */
function parseJson(content: string): unknown | null {
  const text = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
