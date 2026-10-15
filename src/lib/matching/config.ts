// PLACEHOLDER matching config (docs/SPEC-matching.md, "Config").
// This file is the single place to change checklists and budget weights.

export const EVENT_TYPES = ["wedding", "birthday", "corporate"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/**
 * The starting service list for a new event of each type, in card order
 * (docs/SPEC-event-services.md). After that each event keeps its own list in
 * the event_services table. 011_event_services.sql backfills with the same lists.
 */
export const DEFAULT_SERVICES: Record<EventType, readonly string[]> = {
  wedding: ["venue", "catering", "photography", "music", "decoration"],
  birthday: ["venue", "catering", "decoration", "music"],
  corporate: ["venue", "catering", "photography"],
};

/**
 * Relative budget weight per category. Only the categories on an event's
 * service list count, and they are rescaled to add up to 1, so shares always sum
 * to the full budget. Every category needs a weight here.
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
