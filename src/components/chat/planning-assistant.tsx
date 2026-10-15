"use client";

import { useEffect, useRef, useState } from "react";
import { api, toApiError } from "@/lib/api/client";
import type { ChatIntent, ChatMessage } from "@/lib/api/types";
import { CHAT_INPUT_ID, ChatInput, MAX_CHARS } from "@/components/chat/chat-input";
import { MessageList, type Entry } from "@/components/chat/message-list";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const SUGGESTED = "What should I book first and last?";
const HISTORY_LIMIT = 20;
const QUICK_ACTIONS: { label: string; intent: ChatIntent }[] = [
  { label: "Can I afford this?", intent: "affordability" },
  { label: "Planning summary", intent: "summary" },
];

/**
 * The request history: every message so far, an assistant message as its
 * reply plus a "Suggested order: a > b > c" line when it had a list, capped at
 * the last 20.
 */
export function toHistory(entries: Entry[]): ChatMessage[] {
  return entries
    .map((e): ChatMessage =>
      e.role === "user" ? { role: "user", content: e.content } : { role: "assistant", content: assistantContent(e) },
    )
    .slice(-HISTORY_LIMIT);
}

/**
 * The server accepts at most MAX_CHARS per message, but a reply can be up to
 * 1,200 characters. A long reply is shortened so the next request still fits;
 * the "Suggested order" line is always kept.
 */
function assistantContent(e: Extract<Entry, { role: "assistant" }>): string {
  const line = e.order && e.order.length > 0 ? `\nSuggested order: ${e.order.map((o) => o.category).join(" > ")}` : "";
  const room = MAX_CHARS - line.length;
  const text = e.content.length > room ? e.content.slice(0, room).trimEnd() : e.content;
  return text + line;
}

type Status = "idle" | "sending" | "error" | "forbidden";

/**
 * "Planning assistant" on the plan page. The conversation lives in this
 * component's state only: nothing is stored, and a reload clears it.
 * A failure here never affects the rest of the page; only a 404 is passed up
 * so the page can show its usual not-found view.
 */
export function PlanningAssistant({
  eventId,
  eventName,
  onNotFound,
}: {
  eventId: string;
  /** Shown under the heading so the customer knows which event this is about. */
  eventName?: string;
  onNotFound: () => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const refocus = useRef(false);
  // Kept so Retry resends the same quick action.
  const lastIntent = useRef<ChatIntent | undefined>(undefined);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Give focus back to the input once it is enabled again after an answer.
  useEffect(() => {
    if (status === "idle" && refocus.current) {
      refocus.current = false;
      document.getElementById(CHAT_INPUT_ID)?.focus();
    }
  }, [status]);

  async function ask(history: Entry[], intent?: ChatIntent) {
    if (inFlight.current) return;
    inFlight.current = true;
    lastIntent.current = intent;
    setStatus("sending");
    try {
      const res = await api.chat(eventId, toHistory(history), intent);
      if (!mounted.current) return;
      setEntries([...history, { role: "assistant", content: res.reply, order: res.order, source: res.source, affordability: res.affordability, summary: res.summary }]);
      refocus.current = true;
      setStatus("idle");
    } catch (e) {
      if (!mounted.current) return;
      const { code } = toApiError(e);
      if (code === "event_not_found") onNotFound();
      else setStatus(code === "forbidden" ? "forbidden" : "error");
    } finally {
      inFlight.current = false;
    }
  }

  /** Returns true when the message was accepted, so the input can clear. */
  function send(text: string, intent?: ChatIntent): boolean {
    const content = text.trim();
    if (!content || inFlight.current || status === "sending") return false;
    const next: Entry[] = [...entries, { role: "user", content }];
    setEntries(next);
    void ask(next, intent);
    return true;
  }

  const busy = status === "sending";

  return (
    <section className="flex flex-col gap-6" aria-labelledby="assistant-heading">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id="assistant-heading" className="font-display text-h2">
          Planning assistant
        </h2>
        {eventName && (
          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">For {eventName}</p>
        )}
      </div>
      <Card className="flex min-w-0 flex-col gap-5 p-5 sm:p-7">
        {entries.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="max-w-[65ch]">
              Ask what to book first and last, or anything else about planning this event.
            </p>
            <Button variant="outline" disabled={busy} onClick={() => send(SUGGESTED)}>
              {SUGGESTED}
            </Button>
            <p className="text-xs text-muted-foreground">This conversation isn&apos;t saved.</p>
          </div>
        ) : (
          <MessageList entries={entries} typing={busy} />
        )}

        {status === "error" && (
          <div className="flex flex-wrap items-center gap-3">
            <Alert variant="destructive" className="w-auto flex-1">
              Couldn&apos;t get an answer. Please try again.
            </Alert>
            <Button variant="outline" onClick={() => ask(entries, lastIntent.current)}>
              Retry
            </Button>
          </div>
        )}
        {status === "forbidden" && (
          <Alert variant="destructive">The planning assistant is for customers only.</Alert>
        )}

        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick questions">
          {QUICK_ACTIONS.map((a) => (
            <Button
              key={a.intent}
              variant="outline"
              size="sm"
              disabled={busy || status === "forbidden"}
              onClick={() => send(a.label, a.intent)}
            >
              {a.label}
            </Button>
          ))}
        </div>
        <ChatInput disabled={busy || status === "forbidden"} onSend={send} />
        {entries.length > 0 && (
          <p className="text-xs text-muted-foreground">This conversation isn&apos;t saved.</p>
        )}
      </Card>
    </section>
  );
}
