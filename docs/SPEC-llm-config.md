# SPEC-llm-config.md

## Goal
The "What's missing" cards and the planning assistant can each use their own LLM provider settings (key, model and endpoint), so they can run on different models or accounts.

## Supersedes
- SPEC-matching.md and SPEC-chatbot.md: only where the LLM settings come from. What the model is asked, what it may return and the fallbacks are unchanged.

## Out of scope
Changing any prompt, input, output check or fallback; a provider whose API is not OpenAI-compatible chat completions; choosing a model per request or per user; moving settings into the database or an admin screen; new dependencies.

## Rules
- Server-side only, read from environment variables at call time. No key is ever logged, returned or sent to the browser; none is prefixed `NEXT_PUBLIC_`.
- Per use (`CARDS` for the cards, `CHAT` for the assistant): `LLM_<USE>_API_KEY`, `LLM_<USE>_MODEL`, `LLM_<USE>_ENDPOINT`. Each is optional.
- Anything not set (or empty) falls back to `LLM_API_KEY` and the defaults (OpenRouter, `anthropic/claude-haiku-5.5`). With only `LLM_API_KEY` set, behaviour is exactly as before.
- With no key for a use, that use skips the model call and shows its template text, as today. One use having no key does not affect the other.
- The OpenRouter-only `reasoning` field is sent only to the default OpenRouter endpoint, never to a custom one.
- The endpoint must accept an OpenAI-compatible chat completions request (`Authorization: Bearer <key>`, `model`, `messages`, `max_tokens`, `temperature`) and answer with `choices[0].message.content`.
- Failures (timeout, HTTP error, bad output) return nothing and the fallback text is used, as before. The log line names the use ("LLM cards call failed: HTTP 401"), never the key.

## Setup
Put the variables in `.env.local` for local runs and in the Vercel project's environment variables for the deployed site. `.env.example` lists them.

## Acceptance criteria
1. With only `LLM_API_KEY` set, both uses call the default endpoint and model with that key.
2. With `LLM_CARDS_*` and `LLM_CHAT_*` set, each use sends its own key, model and endpoint, and neither key appears in the other's request.
3. A use with no settings of its own falls back to `LLM_API_KEY`; with no key at all it returns the fallback text.
4. A custom endpoint never receives the `reasoning` field.
5. Errors return the fallback and never throw.
