"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export type MessageRow = { id: string; body: string; created_at: string; sender_id: string };

/**
 * Calls `onInsert` for each new message the signed-in user may read, through
 * Supabase Realtime (RLS decides who receives what). Pass a conversation id to
 * listen to one conversation, or null for all of mine. `onSubscribed` runs when
 * listening starts or resumes: the place to catch up on anything missed.
 */
export function useMessageInserts(
  conversationId: string | null,
  onInsert: (row: MessageRow) => void,
  onSubscribed?: () => void,
) {
  const insert = useRef(onInsert);
  const subscribed = useRef(onSubscribed);
  useEffect(() => {
    insert.current = onInsert;
    subscribed.current = onSubscribed;
  });

  useEffect(() => {
    const supabase = createClient();
    // A unique name: several listeners (page, sidebar) can share this one browser client.
    const channel = supabase
      .channel(`messages:${conversationId ?? "all"}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          ...(conversationId ? { filter: `conversation_id=eq.${conversationId}` } : {}),
        },
        (payload) => {
          const row = payload.new as Partial<MessageRow>;
          if (row.id) insert.current(row as MessageRow); // an empty event carries no message
        },
      );
    let stopped = false;
    // Join as the signed-in user: the session is read from cookies after the
    // client starts, and joining before that would join as logged out (RLS sends nothing).
    void supabase.auth.getSession().then(({ data }) => {
      if (stopped) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") subscribed.current?.();
      });
    });
    // Leaving the page stops listening.
    return () => {
      stopped = true;
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);
}
