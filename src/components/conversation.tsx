"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import type { ConversationDetail, Message } from "@/lib/api/types";
import { capitalize, formatTimestamp } from "@/lib/format";
import { MESSAGE_MAX, messageBody, messageLength } from "@/lib/messages";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/components/error-state";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const COUNTER_FROM = 1800;

/**
 * One conversation between a customer and a vendor (docs/SPEC-messages.md),
 * shared by /messages/[id] and /vendor/messages/[id]. Messages are plain text.
 */
export function Conversation({ id, backHref, backLabel }: { id: string; backHref: string; backLabel: string }) {
  const { state, setState, reload } = useLoad(() => api.getConversation(id));

  const back = (
    <Link
      href={backHref}
      className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> {backLabel}
    </Link>
  );

  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading conversation" className="flex max-w-2xl flex-col gap-6">
        {back}
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="ml-auto h-12 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (state.status === "error") {
    if (state.error.code === "conversation_not_found") {
      return (
        <div className="flex max-w-md flex-col items-start gap-6">
          <p className="label">404</p>
          <h1 className="font-display text-h1">Conversation not found</h1>
          <p className="text-muted-foreground">This conversation doesn&apos;t exist, or it isn&apos;t yours.</p>
          <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
            {backLabel}
          </Link>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-10">
        {back}
        <ErrorState error={state.error} onRetry={reload} message="Couldn't load this conversation. Please try again." />
      </div>
    );
  }

  return (
    <Thread
      detail={state.data}
      back={back}
      onChange={(data) => setState({ status: "loaded", data })}
    />
  );
}

function Thread({
  detail,
  back,
  onChange,
}: {
  detail: ConversationDetail;
  back: React.ReactNode;
  onChange: (next: ConversationDetail) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [earlierError, setEarlierError] = useState(false);
  const inFlight = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollOnChange = useRef(true);

  // Newest message in view after loading and after sending, not after "Load earlier".
  useEffect(() => {
    if (scrollOnChange.current) endRef.current?.scrollIntoView({ block: "end" });
    scrollOnChange.current = true;
  }, [detail.messages.length]);

  const body = messageBody(draft);
  const length = messageLength(draft.trim());

  async function send() {
    if (inFlight.current || body === undefined || !detail.open) return;
    inFlight.current = true;
    setSending(true);
    setSendError(null);
    try {
      const { message } = await api.sendMessage(detail.id, body);
      onChange({ ...detail, messages: [...detail.messages, message] });
      setDraft("");
    } catch (err) {
      const { code } = toApiError(err);
      if (code === "conversation_closed") onChange({ ...detail, open: false });
      else if (code === "validation_error") setSendError(`Write a message of 1 to ${MESSAGE_MAX.toLocaleString("en-US")} characters.`);
      else setSendError("Couldn't send your message. Please try again.");
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  async function loadEarlier() {
    const first = detail.messages[0];
    if (!first || loadingEarlier) return;
    setLoadingEarlier(true);
    setEarlierError(false);
    try {
      const older = await api.getConversation(detail.id, first.id);
      scrollOnChange.current = false;
      onChange({ ...detail, messages: [...older.messages, ...detail.messages], hasMore: older.hasMore });
    } catch {
      setEarlierError(true);
    } finally {
      setLoadingEarlier(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {back}
      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <p className="label">{capitalize(detail.category)}</p>
        <h1 className="font-display text-h1 [overflow-wrap:anywhere]">{detail.otherName || "Customer"}</h1>
      </header>

      {detail.hasMore && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => void loadEarlier()} disabled={loadingEarlier}>
            {loadingEarlier && <Loader2 className="h-4 w-4 animate-spin" />}
            Load earlier
          </Button>
          {earlierError && <p className="text-sm text-destructive">Couldn&apos;t load earlier messages.</p>}
        </div>
      )}

      {detail.messages.length === 0 ? (
        <p className="text-muted-foreground">No messages yet. Say hello and share the details of your event.</p>
      ) : (
        <ol className="flex flex-col gap-3" aria-label="Messages">
          {detail.messages.map((m) => (
            <MessageItem key={m.id} message={m} />
          ))}
        </ol>
      )}
      <div ref={endRef} />

      {detail.open ? (
        <form
          className="flex flex-col gap-2 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label htmlFor="message-body" className="sr-only">
            Message
          </label>
          <Textarea
            id="message-body"
            rows={3}
            value={draft}
            placeholder="Write a message"
            disabled={sending}
            aria-describedby={[sendError && "message-error", length >= COUNTER_FROM && "message-counter"].filter(Boolean).join(" ") || undefined}
            onChange={(e) => {
              setDraft(e.target.value);
              setSendError(null);
            }}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter adds a line. Not while composing (e.g. IME input).
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Enter to send, Shift+Enter for a new line.</p>
            <div className="flex items-center gap-3">
              {length >= COUNTER_FROM && (
                <span
                  id="message-counter"
                  aria-live="polite"
                  className={cn("text-xs", length > MESSAGE_MAX ? "text-destructive" : "text-muted-foreground")}
                >
                  {length.toLocaleString("en-US")} / {MESSAGE_MAX.toLocaleString("en-US")}
                </span>
              )}
              <Button type="submit" size="sm" disabled={sending || body === undefined}>
                {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                {sending ? "Sending" : "Send"}
              </Button>
            </div>
          </div>
          {sendError && (
            <p id="message-error" className="text-sm text-destructive">
              {sendError}
            </p>
          )}
        </form>
      ) : (
        <Alert>This conversation is read-only because there&apos;s no active booking.</Alert>
      )}
    </div>
  );
}

function MessageItem({ message }: { message: Message }) {
  return (
    <li className={cn("flex flex-col gap-1", message.mine ? "items-end" : "items-start")}>
      <p
        className={cn(
          "max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 [overflow-wrap:anywhere]",
          message.mine ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
        )}
      >
        <span className="sr-only">{message.mine ? "You: " : "Them: "}</span>
        {message.body}
      </p>
      <time dateTime={message.createdAt} className="text-xs text-muted-foreground">
        {formatTimestamp(message.createdAt)}
      </time>
    </li>
  );
}
