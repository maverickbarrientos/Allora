// The only file that calls the LLM API. Server-side only: import it from route
// handlers, never from client components. Keys are read from the environment
// and are never logged or returned.
//
// Each use has its own provider settings, so the "What's missing" cards and the
// planning assistant can run on different models or accounts:
//   LLM_CARDS_API_KEY / LLM_CARDS_MODEL / LLM_CARDS_ENDPOINT
//   LLM_CHAT_API_KEY  / LLM_CHAT_MODEL  / LLM_CHAT_ENDPOINT
// Anything not set falls back to LLM_API_KEY and the defaults below.
//
// The endpoint must speak the OpenAI-compatible chat completions format
// (OpenRouter by default), called with plain fetch (no SDK).

export type LlmUse = "cards" | "chat";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-haiku-5.5";
const DEFAULT_TIMEOUT_MS = 8000;

/** The key, model and endpoint for one use, read at call time. */
export function llmConfig(use: LlmUse) {
  const name = `LLM_${use.toUpperCase()}`;
  const env = process.env;
  return {
    key: env[`${name}_API_KEY`] || env.LLM_API_KEY,
    model: env[`${name}_MODEL`] || MODEL,
    endpoint: env[`${name}_ENDPOINT`] || ENDPOINT,
  };
}

type JsonRequest = {
  /** Which provider settings to use. */
  use: LlmUse;
  system: string;
  /** Sent as the user message. Objects are JSON-encoded. */
  input: unknown;
  timeoutMs?: number;
  maxTokens?: number;
  /** Reply must be exactly one JSON value; no code fence or other text around it. */
  strictJson?: boolean;
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
  strictJson = false,
}: JsonRequest): Promise<unknown | null> {
  const { key, model, endpoint } = llmConfig(use);
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: maxTokens,
        // Short text tasks: no hidden reasoning. With it on, calls took 5 to 7.5 s
        // (close to the 8 s timeout) and reasoning tokens ate into max_tokens.
        // OpenRouter-only field, so other providers never receive it.
        ...(endpoint === ENDPOINT && { reasoning: { enabled: false } }),
        messages: [
          { role: "system", content: system },
          { role: "user", content: typeof input === "string" ? input : JSON.stringify(input) },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`LLM ${use} call failed: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") return null;
    return parseJson(content, strictJson);
  } catch {
    console.warn(`LLM ${use} call failed: ${controller.signal.aborted ? "timeout" : "network or parse error"}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Parses a JSON reply. Unless strict, a surrounding ```json fence is tolerated. */
function parseJson(content: string, strict: boolean): unknown | null {
  const trimmed = content.trim();
  const text = strict ? trimmed : trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
