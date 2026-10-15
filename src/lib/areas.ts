// PLACEHOLDER area list (docs/SPEC-event-location.md, "Rules").
// Events and vendors pick their location from this list. The same list is in
// the check constraints of 028_event_location.sql; change both together.

export const AREAS = [
  "Metro Manila",
  "Bulacan",
  "Pampanga",
  "Rizal",
  "Cavite",
  "Laguna",
  "Batangas",
  "Benguet",
  "Cebu",
  "Iloilo",
  "Davao",
] as const;
export type Area = (typeof AREAS)[number];

export function isArea(value: unknown): value is Area {
  return typeof value === "string" && (AREAS as readonly string[]).includes(value);
}

/**
 * A location field (event or vendor): null, or an area after trimming.
 * Returns what to save (an empty string clears it to null), or undefined when invalid.
 */
export function parseLocation(value: unknown): Area | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (text === "") return null;
  return isArea(text) ? text : undefined;
}

/**
 * True when a vendor is in an event's area: the event has no location, the
 * vendor has none, or both are the same area. Vendors with no location are
 * never left out.
 */
export function inArea(vendorLocation: string | null, eventLocation: string | null): boolean {
  return eventLocation === null || vendorLocation === null || vendorLocation === eventLocation;
}
