// Message rules shared by the browser and the server (docs/SPEC-messages.md).
// The same limits as the messages_body_check constraint in 025_messages.sql.

import type { Message } from "@/lib/api/types";

export const MESSAGE_MAX = 2000;

/** Characters as the database counts them (an emoji is one). */
export const messageLength = (text: string) => [...text].length;

/** The text to send: trimmed, 1 to MESSAGE_MAX characters. Undefined when invalid. */
export function messageBody(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const text = v.trim();
  const length = messageLength(text);
  return length >= 1 && length <= MESSAGE_MAX ? text : undefined;
}

/** Messages from the same side within this gap share one time stamp, under the last of them. */
const GROUP_GAP_MS = 5 * 60 * 1000;

/** Whether message `i` shows its time stamp: the last of a run from the same side. */
export const showsTime = (messages: Message[], i: number) => {
  const next = messages[i + 1];
  return !next || next.mine !== messages[i].mine || Date.parse(next.createdAt) - Date.parse(messages[i].createdAt) > GROUP_GAP_MS;
};

/**
 * Adds messages that aren't on the page yet (by id), keeping them in time
 * order. A message can arrive twice: from my own send and from Realtime.
 */
export function withMessages(list: Message[], incoming: Message[]): Message[] {
  const known = new Set(list.map((m) => m.id));
  const added = incoming.filter((m) => !known.has(m.id));
  if (added.length === 0) return list;
  return [...list, ...added].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
