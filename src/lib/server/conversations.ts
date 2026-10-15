// Conversations between a customer and a vendor (docs/SPEC-messages.md).
// RLS on conversations and messages limits everything to the two participants;
// the security definer functions in 025_messages.sql supply names and counts.

import type { SupabaseClient } from "@supabase/supabase-js";

export const MESSAGE_COLUMNS = "id, body, created_at, sender_id";
export const PAGE_SIZE = 50;

export type ConversationRow = {
  id: string;
  other_name: string;
  category: string;
  open: boolean;
  last_body: string | null;
  last_created_at: string | null;
  last_mine: boolean | null;
  last_message_at: string | null;
  unread: number;
  vendor_has_account: boolean;
};
type MessageRow = { id: string; body: string; created_at: string; sender_id: string };

/** One of the caller's conversations, or null when it isn't theirs (or doesn't exist). */
export async function loadConversation(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.rpc("my_conversations").eq("id", id).maybeSingle<ConversationRow>();
  if (error) return { error };
  return { conversation: data };
}

/** One row of the inbox (docs/SPEC-messages.md). Never carries ids of people or emails. */
export function toSummary(row: ConversationRow) {
  const last =
    row.last_body !== null && row.last_created_at !== null
      ? { body: row.last_body, createdAt: row.last_created_at, mine: row.last_mine === true }
      : null;
  return {
    id: row.id,
    otherName: row.other_name,
    category: row.category,
    open: row.open,
    lastMessage: last,
    unread: row.unread,
  };
}

/** The caller's side of a message: `mine` instead of the sender's profile id. */
export function toMessage(row: MessageRow, userId: string) {
  return { id: row.id, body: row.body, createdAt: row.created_at, mine: row.sender_id === userId };
}
