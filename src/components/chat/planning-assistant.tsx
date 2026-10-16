"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import type { ChatIntent, ChatMessage } from "@/lib/api/types";
import { CHAT_INPUT_ID, ChatInput, MAX_CHARS } from "@/components/chat/chat-input";
import { MessageList, type Entry } from "@/components/chat/message-list";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
 * "Planning assistant" on the plan page: a floating button that opens a chat panel. The conversation lives in this
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
  const [open, setOpen] = useState(false);
  // An answer arrived while the panel was closed.
  const [unseen, setUnseen] = useState(false);
  const openRef = useRef(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const refocus = useRef(false);
  // Kept so Retry resends the same quick action.
  const lastIntent = useRef<ChatIntent | undefined>(undefined);

  useEffect(() => {
    openRef.current = open;
    // Opening puts the cursor in the message box.
    if (open) document.getElementById(CHAT_INPUT_ID)?.focus();
    // The launcher is only on the page while closed, so focus goes back after it renders.
    else if (returnFocus.current) {
      returnFocus.current = false;
      launcher.current?.focus();
    }
  }, [open]);

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
      if (!openRef.current) setUnseen(true);
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

  function show() {
    setOpen(true);
    setUnseen(false);
  }
  function hide() {
    returnFocus.current = true;
    setOpen(false);
  }

  return (
    <div className="print:hidden">
      {/* Always mounted, so the conversation survives closing the panel. */}
      <section
        id="assistant-panel"
        role="dialog"
        aria-label="Planning assistant"
        onKeyDown={(e) => e.key === "Escape" && hide()}
        className={cn(
          "fixed inset-x-3 bottom-3 z-40 h-[min(38rem,calc(100dvh-6rem))] min-w-0 flex-col rounded-[var(--radius)] border border-border bg-background shadow-soft sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[26rem]",
          open ? "flex" : "hidden",
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="font-display text-h2">Planning assistant</h2>
            {eventName && (
              <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">For {eventName}</p>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={hide} aria-label="Close planning assistant">
            <X className="h-5 w-5" strokeWidth={1.5} />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
          {entries.length === 0 ? (
            <div className="flex flex-col items-start gap-3 overflow-y-auto">
              <p>Ask what to book first and last, or anything else about planning this event.</p>
              <Button variant="outline" disabled={busy} onClick={() => send(SUGGESTED)}>
                {SUGGESTED}
              </Button>
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
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-border p-5">
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
          <p className="text-xs text-muted-foreground">This conversation isn&apos;t saved.</p>
        </footer>
      </section>

      {!open && (
        <Button
          ref={launcher}
          onClick={show}
          aria-expanded={false}
          aria-controls="assistant-panel"
          className="fixed bottom-4 right-4 z-30 h-12 rounded-full px-5 shadow-soft sm:bottom-6 sm:right-6"
        >
          <MessageCircle aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />
          Ask the assistant
          {unseen && (
            <>
              <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-brass" />
              <span className="sr-only">, new answer</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}
