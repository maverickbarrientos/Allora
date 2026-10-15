// Validation for event create and edit (docs/SPEC-event-upgrades.md, "Rules").
// Unknown fields are ignored, and `owner` is never read from the body.

import { CHECKLISTS, type EventType } from "@/lib/matching/config";

export const EVENT_TYPES = Object.keys(CHECKLISTS) as EventType[];

export const NAME_MAX = 80;
export const NOTES_MAX = 1000;
export const BUDGET_MAX = 1_000_000_000;
export const GUESTS_MAX = 100_000;

/** Columns as stored in the events table. */
export type EventFields = {
  name?: string;
  type?: EventType;
  date?: string;
  budget?: number;
  guest_count?: number;
  notes?: string | null;
};

export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    y >= 1 &&
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/** True when the number has at most 2 decimal places. */
export function hasMaxTwoDecimals(n: number): boolean {
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

/** A number above 0, at most `max`, with at most 2 decimals. */
export function isMoney(value: unknown, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= max &&
    hasMaxTwoDecimals(value)
  );
}

/**
 * Validates the event fields in `body`. On create every field except notes is
 * required; on update only the fields present are checked.
 */
export function parseEventFields(
  body: Record<string, unknown> | null,
  mode: "create" | "update",
): { fields: EventFields; invalid: string[] } {
  const b = body ?? {};
  const fields: EventFields = {};
  const invalid: string[] = [];
  const present = (key: string) => b[key] !== undefined;
  const required = mode === "create";

  if (present("name") || required) {
    const name = typeof b.name === "string" ? b.name.trim() : null;
    if (name === null || name.length < 1 || name.length > NAME_MAX) invalid.push("name");
    else fields.name = name;
  }

  if (present("type") || required) {
    if (typeof b.type === "string" && (EVENT_TYPES as string[]).includes(b.type)) {
      fields.type = b.type as EventType;
    } else invalid.push("type");
  }

  if (present("date") || required) {
    if (isValidDate(b.date)) fields.date = b.date;
    else invalid.push("date");
  }

  if (present("budget") || required) {
    if (isMoney(b.budget, BUDGET_MAX)) fields.budget = b.budget;
    else invalid.push("budget");
  }

  if (present("guestCount") || required) {
    const g = b.guestCount;
    if (typeof g === "number" && Number.isInteger(g) && g >= 1 && g <= GUESTS_MAX) {
      fields.guest_count = g;
    } else invalid.push("guestCount");
  }

  if (present("notes")) {
    if (b.notes === null) fields.notes = null;
    else if (typeof b.notes === "string") {
      const notes = b.notes.trim();
      if (notes.length > NOTES_MAX) invalid.push("notes");
      else fields.notes = notes === "" ? null : notes;
    } else invalid.push("notes");
  }

  return { fields, invalid };
}
