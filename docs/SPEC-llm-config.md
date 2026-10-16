# SPEC-llm-config.md

## Goal
The "What's missing" cards and the planning assistant call Anthropic's API directly, and can each use their own key and model.

## Supersedes
- SPEC-matching.md and SPEC-chatbot.md: only where the LLM settings come from. What the model is asked, what it may return and the fallbacks are unchanged.
- An earlier version of this spec (OpenRouter with optional per-use endpoints). OpenRouter is no longer used.

## Out of scope
Changing any prompt, input, output check or fallback; other providers; choosing a model per request or per user; moving settings into the database or an admin screen; new dependencies (plain `fetch`, no SDK).

## Rules
- Server-side only, read from environment variables at call time. No key is ever logged, returned or sent to the browser; none is prefixed `NEXT_PUBLIC_`.
- Calls go to Anthropic's Messages API (`https://api.anthropic.com/v1/messages`, `x-api-key` and `anthropic-version: 2023-06-01` headers, the system prompt in `system`, one user message). The default model is `claude-haiku-5-5`.
- Per use (`CARDS` for the cards, `CHAT` for the assistant), the key is the first of these that is an Anthropic key (starts with `sk-ant-`): `LLM_<USE>_API_KEY`, then `ANTHROPIC_API_KEY`, then the older `LLM_API_KEY`. A value that isn't an Anthropic key, such as a leftover OpenRouter key, is skipped so it can't shadow the right one. The model is `LLM_<USE>_MODEL`, else the default. Empty values count as not set.
- With no usable key for a use, that use skips the model call and shows its template text, as before. One use having no key does not affect the other. If something is set but isn't an Anthropic key, the log says so (never the value).
- Failures (timeout, HTTP error, empty or bad output) return nothing and the fallback text is used, as before. The log line names the use and Anthropic's error type (for example "LLM cards call failed: HTTP 401 authentication_error"), never the key.
- Reasoning/thinking is not turned on, so short answers stay fast and inside the token limit.

## Setup
Set `ANTHROPIC_API_KEY` in `.env.local` for local runs and in the Vercel project's environment variables for the deployed site (redeploy after changing it). `.env.example` lists the variables.

## Acceptance criteria
1. With only `ANTHROPIC_API_KEY` set, both uses call Anthropic's Messages API with that key and `claude-haiku-5-5`.
2. `LLM_CARDS_*` and `LLM_CHAT_*` override the key and model for their own use only.
3. A key that doesn't start with `sk-ant-` is never sent anywhere; the use falls back to template text and the log says why.
4. Text blocks in the reply are joined; other block types are ignored; fenced JSON is tolerated unless the caller asks for strict JSON.
5. Errors return the fallback and never throw, and no log line contains the key.
