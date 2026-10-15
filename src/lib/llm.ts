// The only file that calls the LLM API. Server-side only: import it from route
// handlers, never from client components. The key is read from LLM_API_KEY
// and is never logged or returned.
//
// Provider: OpenRouter's OpenAI-compatible chat completions endpoint, called
// with plain fetch (no SDK).

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-haiku-5.5";
const DEFAULT_TIMEOUT_MS = 8000;

type JsonRequest = {
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
  system,
  input,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxTokens = 1500,
  strictJson = false,
}: JsonRequest): Promise<unknown | null> {
  const key = process.env.LLM_API_KEY;
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
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
      console.warn(`LLM call failed: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") return null;
    return parseJson(content, strictJson);
  } catch {
    console.warn(`LLM call failed: ${controller.signal.aborted ? "timeout" : "network or parse error"}`);
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
