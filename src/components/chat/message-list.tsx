"use client";

import { useEffect, useRef } from "react";
import type { Affordability, OrderItem, PlanSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { AffordabilityCard } from "@/components/chat/affordability-card";
import { SummaryCard } from "@/components/chat/summary-card";
import { OrderList } from "@/components/chat/order-list";

export type Entry =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; order: OrderItem[] | null;
      source: "ai" | "fallback";
      affordability?: Affordability;
      summary?: PlanSummary;
    };

/**
 * The conversation. role="log" makes screen readers announce each new message
 * (including the assistant's answer) as it is added. All text is plain text.
 */
export function MessageList({ entries, typing }: { entries: Entry[]; typing: boolean }) {
  const end = useRef<HTMLDivElement>(null);

  // Keep the newest message in view inside the list.
  useEffect(() => {
    const list = end.current?.parentElement;
    if (list) list.scrollTop = list.scrollHeight;
  }, [entries.length, typing]);

  return (
    <div
      role="log"
      aria-label="Conversation"
      className="flex max-h-[28rem] flex-col gap-4 overflow-y-auto"
    >
      {entries.map((e, i) =>
        e.role === "user" ? (
          <div key={i} className="flex justify-end">
            <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2 text-primary-foreground [overflow-wrap:anywhere]">
              <span className="sr-only">You: </span>
              {e.content}
            </p>
          </div>
        ) : (
          <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border p-4">
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
              <span className="sr-only">Assistant: </span>
              {e.content}
            </p>
            {e.order && e.order.length > 0 && <OrderList items={e.order} />}
            {e.affordability && <AffordabilityCard data={e.affordability} />}
            {e.summary && <SummaryCard data={e.summary} />}
            {e.source === "fallback" && (
              <p className="text-xs text-muted-foreground">
                {e.order ? "Assistant unavailable, showing the standard order" : "Assistant unavailable"}
              </p>
            )}
          </div>
        ),
      )}
      {typing && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span aria-hidden="true" className="flex gap-1">
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className={cn("h-1.5 w-1.5 animate-pulse rounded-full bg-current")}
                style={{ animationDelay: `${d * 150}ms` }}
              />
            ))}
          </span>
          Assistant is typing
        </p>
      )}
      <div ref={end} />
    </div>
  );
}
