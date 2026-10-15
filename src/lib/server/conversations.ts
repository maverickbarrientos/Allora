// Conversations between a customer and a vendor (docs/SPEC-messages.md).
// RLS on conversations and messages limits everything to the two participants;
// the security definer functions in 018_messages.sql supply names and counts.

import type { SupabaseClient } from "@supabase/supabase-js";

export const MESSAGE_COLUMNS = "id, body, created_at, sender_id";
export const PAGE_SIZE = 50;

type ConversationRow = {
  id: string;
  other_name: string;
  category: string;
  open: boolean;
  last_body: string | null;
  last_created_at: string | null;
  last_mine: boolean | null;
  last_message_at: string | null;
  unread: number;
};
type MessageRow = { id: string; body: string; created_at: string; sender_id: string };

/** One of the caller's conversations, or null when it isn't theirs (or doesn't exist). */
export async function loadConversation(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.rpc("my_conversations").eq("id", id).maybeSingle<ConversationRow>();
  if (error) return { error };
  return { conversation: data };
}

/** The caller's side of a message: `mine` instead of the sender's profile id. */
export function toMessage(row: MessageRow, userId: string) {
  return { id: row.id, body: row.body, createdAt: row.created_at, mine: row.sender_id === userId };
}
