// PLACEHOLDER event templates (docs/SPEC-event-upgrades.md, "Assumption: templates").
// One per event type. Values are only defaults for the create form.

import type { EventType } from "@/lib/matching/config";

export type EventTemplate = {
  type: EventType;
  label: string;
  name: string;
  guestCount: number;
  budget: number;
  notes: string;
};

export const EVENT_TEMPLATES: readonly EventTemplate[] = [
  {
    type: "wedding",
    label: "Wedding",
    name: "Our Wedding",
    guestCount: 100,
    budget: 100000,
    notes: "Ceremony and reception. Add venue, theme and dietary needs here.",
  },
  {
    type: "birthday",
    label: "Birthday",
    name: "Birthday Celebration",
    guestCount: 30,
    budget: 25000,
    notes: "Add the guest of honor, theme and any cake or dietary needs.",
  },
  {
    type: "corporate",
    label: "Corporate",
    name: "Company Event",
    guestCount: 50,
    budget: 60000,
    notes: "Add the agenda, attendees and any equipment needs.",
  },
];
