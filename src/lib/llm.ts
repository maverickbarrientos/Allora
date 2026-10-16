// The only file that calls the LLM API. Server-side only: import it from route
// handlers, never from client components. Keys are read from the environment
// and are never logged or returned.
//
// Provider: Anthropic's Messages API, called with plain fetch (no SDK).
//
// Settings come from the environment, per use ("cards" for the "What's missing"
// cards, "chat" for the planning assistant), so the two can run on different
// keys or models. For the key, the first of these that is an Anthropic key
// (starts with sk-ant-) wins:
//   LLM_CARDS_API_KEY or LLM_CHAT_API_KEY  (that use only)
//   ANTHROPIC_API_KEY                      (both uses)
//   LLM_API_KEY                            (older name, both uses)
// A value that isn't an Anthropic key (for example a leftover OpenRouter key)
// is skipped, so it can never shadow the right one.
// The model is LLM_CARDS_MODEL or LLM_CHAT_MODEL, else the default below.
// A key that is not tied to a workspace needs ANTHROPIC_WORKSPACE_ID (wrkspc_...),
// which is sent as the anthropic-workspace-id header. Not needed for a scoped key.

export type LlmUse = "cards" | "chat";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const MODEL = "claude-haiku-5-5";
const DEFAULT_TIMEOUT_MS = 8000;

/** The key and model for one use, read at call time. */
export function llmConfig(use: LlmUse) {
  const name = `LLM_${use.toUpperCase()}`;
  const env = process.env;
  const candidates = [env[`${name}_API_KEY`], env.ANTHROPIC_API_KEY, env.LLM_API_KEY];
  return {
    key: candidates.find((k) => k?.startsWith("sk-ant-")),
    // Something is set but none of it is an Anthropic key.
    wrongKey: candidates.some(Boolean),
    model: env[`${name}_MODEL`] || MODEL,
    workspace: env.ANTHROPIC_WORKSPACE_ID || undefined,
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
  const { key, wrongKey, model, workspace } = llmConfig(use);
  if (!key) {
    if (wrongKey) console.warn(`LLM ${use} call skipped: the key set is not an Anthropic key (sk-ant-...)`);
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": API_VERSION,
        "content-type": "application/json",
        ...(workspace && { "anthropic-workspace-id": workspace }),
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: typeof input === "string" ? input : JSON.stringify(input) }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      // Anthropic's error type (for example authentication_error), never the key.
      const type = await res.json().then((d) => d?.error?.type, () => undefined);
      console.warn(`LLM ${use} call failed: HTTP ${res.status}${typeof type === "string" ? ` ${type}` : ""}`);
      return null;
    }
    const data = await res.json();
    const blocks: { type?: string; text?: string }[] = Array.isArray(data?.content) ? data.content : [];
    const content = blocks.filter((b) => b.type === "text" && typeof b.text === "string").map((b) => b.text).join("");
    // stop_reason "max_tokens" means the answer was cut off, so its JSON is incomplete.
    const detail = `stop_reason=${data?.stop_reason}, ${content.length} characters`;
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
