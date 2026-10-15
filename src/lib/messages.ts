// Message rules shared by the browser and the server (docs/SPEC-messages.md).
// The same limits as the messages_body_check constraint in 018_messages.sql.

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
