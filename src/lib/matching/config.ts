// PLACEHOLDER matching config (docs/SPEC-matching.md, "Config").
// This file is the single place to change checklists and budget weights.

export type EventType = "wedding" | "birthday" | "corporate";

/** Services expected per event type, in card order. */
export const CHECKLISTS: Record<EventType, readonly string[]> = {
  wedding: ["venue", "catering", "photography", "music", "decoration"],
  birthday: ["venue", "catering", "decoration", "music"],
  corporate: ["venue", "catering", "photography"],
};

/**
 * Relative budget weight per category. Only the categories in an event's
 * checklist count, and they are rescaled to add up to 1, so shares always sum
 * to the full budget. Every checklist category needs a weight here.
 */
export const WEIGHTS: Record<string, number> = {
  venue: 0.35,
  catering: 0.3,
  decoration: 0.13,
  photography: 0.12,
  music: 0.1,
};

/** Vendors shown per card. */
export const MAX_VENDORS_PER_CARD = 3;
