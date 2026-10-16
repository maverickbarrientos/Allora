# SPEC-llm-config.md

## Goal
The "What's missing" cards and the planning assistant call an LLM through OpenRouter, and can each use their own key and model.

## Supersedes
- SPEC-matching.md and SPEC-chatbot.md: only where the LLM settings come from. What the model is asked, what it may return and the fallbacks are unchanged.
- Earlier versions of this spec: native Anthropic API (tried and dropped: the Anthropic account needed a workspace and credit), and the first OpenRouter version with optional per-use endpoints.

## Out of scope
Changing any prompt, input, output check or fallback; other providers (including Anthropic's own API); choosing a model per request or per user; moving settings into the database or an admin screen; new dependencies (plain `fetch`, no SDK).

## Rules
- Server-side only, read from environment variables at call time. No key is ever logged, returned or sent to the browser; none is prefixed `NEXT_PUBLIC_`.
- Calls go to OpenRouter's OpenAI-compatible chat completions endpoint (`https://openrouter.ai/api/v1/chat/completions`, `Authorization: Bearer <key>`, the system prompt as a system message, one user message). The default model is `anthropic/claude-haiku-5.5`. Hidden reasoning is turned off so short answers stay fast and inside the token limit.
- Per use (`CARDS` for the cards, `CHAT` for the assistant), the key is `LLM_<USE>_API_KEY`, else `LLM_API_KEY`. The model is `LLM_<USE>_MODEL`, else the default. Empty values count as not set. Other variables (such as an old `ANTHROPIC_API_KEY`) are ignored.
- With no key for a use, that use skips the model call and shows its template text, as before. One use having no key does not affect the other.
- The OpenRouter account needs enough credit for the largest request: a call asking for N tokens is refused with HTTP 402 when the account can't afford N.
- Failures (timeout, HTTP error, empty or bad output) return nothing and the fallback text is used, as before. The log line names the use, the HTTP status and the provider's error message cut to 200 characters (for example "LLM chat call failed: HTTP 402: This request requires more credits..."), never the key.
- An unusable reply is logged with why: empty, or not valid JSON with the `finish_reason` (`length` means it was cut off), its length and its first 12 characters; and "LLM chat answer failed validation" when the JSON parsed but the chat's checks rejected it. The chat asks for up to 1,500 tokens so a full reply plus a full order fits.
- JSON wrapped in a code fence is accepted (Claude often adds one), for the chat as well as the cards. Text around the JSON is not accepted. There is no separate strict mode: the chat's own validation checks every field and rejects the whole answer on any problem.

## Setup
Set `LLM_API_KEY` (or the per-use keys) in `.env.local` for local runs and in the Vercel project's environment variables for the deployed site, then redeploy. `.env.example` lists the variables.

## Acceptance criteria
1. With only `LLM_API_KEY` set, both uses call OpenRouter with that key and `anthropic/claude-haiku-5.5`.
2. `LLM_CARDS_*` and `LLM_CHAT_*` override the key and model for their own use only, and neither key appears in the other's request.
3. A use with no key of its own falls back to `LLM_API_KEY`; with no key at all it returns the fallback text.
4. Text from `choices[0].message.content` is used; fenced JSON is accepted; text around JSON, empty, cut-off or non-JSON replies give the fallback and a log line saying why.
5. Errors return the fallback and never throw, and no log line contains the key.
