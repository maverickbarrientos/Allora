/** Shown when an event has no name (events created before names existed). */
export const UNTITLED_EVENT = "Untitled event";

/** The event's name as plain text, or "Untitled event" when it is missing or blank. */
export function eventName(event: { name?: string | null } | null | undefined): string {
  const name = event?.name?.trim();
  return name ? name : UNTITLED_EVENT;
}
