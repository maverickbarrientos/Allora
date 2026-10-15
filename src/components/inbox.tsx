"use client";

import Link from "next/link";
import { api } from "@/lib/api/client";
import { capitalize } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { useMessageInserts } from "@/lib/use-message-inserts";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

const shortTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * The caller's conversations, newest first (docs/SPEC-messages.md). Shared by
 * /messages and /vendor/messages; `basePath` is where a conversation opens.
 */
export function Inbox({ basePath }: { basePath: string }) {
  const { state, setState, reload } = useLoad(() => api.listConversations());

  // A new message moves its conversation up: refetch quietly, without a loading state.
  const refresh = () =>
    api
      .listConversations()
      .then((data) => setState({ status: "loaded", data }))
      .catch(() => {});
  useMessageInserts(null, refresh, refresh);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <PageHeader label="Inbox" title="Messages" />
      {state.status === "loading" ? (
        <div role="status" aria-label="Loading messages" className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : state.status === "error" ? (
        <ErrorState error={state.error} onRetry={reload} message="Couldn't load your messages. Please try again." />
      ) : state.data.conversations.length === 0 ? (
        <p className="text-muted-foreground">No messages yet. A conversation starts when a booking is made.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {state.data.conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`${basePath}/${c.id}`}
                className="flex min-h-11 flex-col gap-1 py-4 underline-offset-4 hover:bg-secondary/40"
              >
                <span className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 truncate font-display text-h2">{c.otherName || "Customer"}</span>
                  {c.lastMessage && (
                    <time dateTime={c.lastMessage.createdAt} className="shrink-0 text-xs text-muted-foreground">
                      {shortTime(c.lastMessage.createdAt)}
                    </time>
                  )}
                </span>
                {/* One line: newlines in the message collapse to spaces. */}
                <span className="truncate text-muted-foreground">
                  {c.lastMessage ? `${c.lastMessage.mine ? "You: " : ""}${c.lastMessage.body}` : "No messages yet"}
                </span>
                <span className="flex items-center gap-3">
                  <span className="label">{capitalize(c.category)}</span>
                  {!c.open && <span className="text-xs text-muted-foreground">Read-only</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
