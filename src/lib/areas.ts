// An event's or vendor's area (docs/SPEC-event-location.md): free text of 1 to
// 60 characters, matched ignoring case, accents and extra spaces.

export const AREA_MAX = 60;

/**
 * An optional area field: null, or text of at most AREA_MAX characters after
 * trimming. Returns what to save (an empty string clears it to null), or
 * undefined when invalid.
 */
export function parseArea(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if ([...text].length > AREA_MAX) return undefined;
  return text === "" ? null : text;
}

/** "Parañaque " and "paranaque" are the same area. */
export function normalizeArea(area: string): string {
  return area.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * True when a vendor is in an event's area: the event has no area, the vendor
 * has none, or both name the same area. Vendors with no area are never left out.
 */
export function inArea(vendorArea: string | null, eventArea: string | null): boolean {
  return eventArea === null || vendorArea === null || normalizeArea(vendorArea) === normalizeArea(eventArea);
}
