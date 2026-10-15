"use client";

import { Loader2 } from "lucide-react";
import { parseAmount } from "@/lib/amount";
import { capitalize, formatNumber } from "@/lib/format";
import type { CreateEventInput, Event, EventType } from "@/lib/api/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Limits mirror the server's event validation.
export const EVENT_TYPES: EventType[] = ["wedding", "birthday", "corporate"];
const NAME_MAX = 80;
const NAME_COUNTER_FROM = 70;
const NOTES_MAX = 1000;
const NOTES_COUNTER_FROM = 900;
const BUDGET_MAX = 1_000_000_000;
const GUESTS_MAX = 100_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The form's fields as typed. */
export type EventFormValues = {
  name: string;
  type: EventType | "";
  date: string;
  budget: string;
  guestCount: string;
  notes: string;
};
type Field = keyof EventFormValues;
export type EventFormErrors = Partial<Record<Field | "form", string>>;

export const EMPTY_EVENT_FORM: EventFormValues = {
  name: "",
  type: "",
  date: "",
  budget: "",
  guestCount: "",
  notes: "",
};

export function valuesFromEvent(e: Omit<Event, "id">): EventFormValues {
  return {
    name: e.name ?? "",
    type: e.type,
    date: e.date,
    budget: String(e.budget),
    guestCount: String(e.guestCount),
    notes: e.notes ?? "",
  };
}

const MESSAGES = {
  name: `Enter an event name (up to ${NAME_MAX} characters)`,
  type: "Choose an event type",
  date: "Choose a date",
  budget: "Enter a budget above 0",
  guestCount: `Enter a whole number of guests, from 1 to ${formatNumber(GUESTS_MAX)}`,
  notes: `Keep notes to ${formatNumber(NOTES_MAX)} characters or fewer`,
} as const;

const BUDGET_MESSAGES = {
  empty: "Enter a budget",
  not_a_number: "Enter a number, like 25000 or 25000.50",
  not_positive: "Enter a budget above 0",
  decimals: "Use at most 2 decimal places",
  too_high: `Enter a budget up to ${formatNumber(BUDGET_MAX)}`,
} as const;

/** Checks every field like the server does. Returns the request body when valid. */
export function validateEventForm(v: EventFormValues): {
  errors: EventFormErrors;
  input: CreateEventInput | null;
} {
  const errors: EventFormErrors = {};
  const name = v.name.trim();
  const notes = v.notes.trim();
  const guestRaw = v.guestCount.trim();
  const guestCount = Number(guestRaw);
  const budget = parseAmount(v.budget, BUDGET_MAX);

  if (name.length < 1 || name.length > NAME_MAX) errors.name = MESSAGES.name;
  if (!EVENT_TYPES.includes(v.type as EventType)) errors.type = MESSAGES.type;
  if (!DATE_RE.test(v.date)) errors.date = MESSAGES.date;
  if (!budget.ok) errors.budget = BUDGET_MESSAGES[budget.reason];
  if (!/^\d+$/.test(guestRaw) || guestCount < 1 || guestCount > GUESTS_MAX) {
    errors.guestCount = MESSAGES.guestCount;
  }
  if (notes.length > NOTES_MAX) errors.notes = MESSAGES.notes;

  if (Object.keys(errors).length > 0 || !budget.ok) return { errors, input: null };
  return {
    errors,
    input: {
      name,
      type: v.type as EventType,
      date: v.date,
      budget: budget.value,
      guestCount,
      notes: notes === "" ? null : notes,
    },
  };
}

/** The server's validation_error message names the bad fields ("Invalid fields: budget, guestCount."). */
export function fieldErrorsFrom(message: string): EventFormErrors {
  const errors: EventFormErrors = {};
  for (const field of Object.keys(MESSAGES) as (keyof typeof MESSAGES)[]) {
    if (new RegExp(`\\b${field}\\b`).test(message)) errors[field] = MESSAGES[field];
  }
  return errors;
}

/** Event name, type, date, budget, guests and notes. Name is first. */
export function EventForm({
  values,
  onChange,
  errors,
  saving,
  submitLabel,
  savingLabel,
  onSubmit,
  before,
  after,
}: {
  values: EventFormValues;
  onChange: (next: EventFormValues) => void;
  errors: EventFormErrors;
  saving: boolean;
  submitLabel: string;
  savingLabel: string;
  onSubmit: () => void;
  /** Shown between the form error and the first field. */
  before?: React.ReactNode;
  /** Shown next to the submit button. */
  after?: React.ReactNode;
}) {
  const set = (field: Field) => (e: { target: { value: string } }) =>
    onChange({ ...values, [field]: e.target.value });

  const describedBy = (field: Field, extra?: string | false) =>
    [errors[field] ? `${field}-error` : "", extra || ""].filter(Boolean).join(" ") || undefined;

  const fieldError = (field: Field) =>
    errors[field] && (
      <p id={`${field}-error`} className="text-sm text-destructive">
        {errors[field]}
      </p>
    );

  const nameCounter = values.name.length >= NAME_COUNTER_FROM;
  const notesCounter = values.notes.length >= NOTES_COUNTER_FROM;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      {errors.form && <Alert variant="destructive">{errors.form}</Alert>}
      {before}
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Event name</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={NAME_MAX}
          value={values.name}
          onChange={set("name")}
          disabled={saving}
          aria-invalid={!!errors.name}
          aria-describedby={describedBy("name", nameCounter && "name-counter")}
        />
        {nameCounter && (
          <p id="name-counter" className="self-end text-xs text-muted-foreground" aria-live="polite">
            {values.name.length} / {NAME_MAX}
          </p>
        )}
        {fieldError("name")}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="type">Type</Label>
        <Select
          id="type"
          name="type"
          value={values.type}
          onChange={set("type")}
          disabled={saving}
          aria-invalid={!!errors.type}
          aria-describedby={describedBy("type")}
        >
          <option value="" disabled>
            Choose a type
          </option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {capitalize(t)}
            </option>
          ))}
        </Select>
        {fieldError("type")}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          name="date"
          type="date"
          value={values.date}
          onChange={set("date")}
          disabled={saving}
          aria-invalid={!!errors.date}
          aria-describedby={describedBy("date")}
        />
        {fieldError("date")}
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="budget">Budget</Label>
          <Input
            id="budget"
            name="budget"
            inputMode="decimal"
            autoComplete="off"
            value={values.budget}
            onChange={set("budget")}
            disabled={saving}
            aria-invalid={!!errors.budget}
            aria-describedby={describedBy("budget")}
          />
          {fieldError("budget")}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="guestCount">Guests</Label>
          <Input
            id="guestCount"
            name="guestCount"
            inputMode="numeric"
            autoComplete="off"
            value={values.guestCount}
            onChange={set("guestCount")}
            disabled={saving}
            aria-invalid={!!errors.guestCount}
            aria-describedby={describedBy("guestCount")}
          />
          {fieldError("guestCount")}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={NOTES_MAX}
          value={values.notes}
          onChange={set("notes")}
          disabled={saving}
          aria-invalid={!!errors.notes}
          aria-describedby={describedBy("notes", notesCounter && "notes-counter")}
        />
        {notesCounter && (
          <p id="notes-counter" className="self-end text-xs text-muted-foreground" aria-live="polite">
            {formatNumber(values.notes.length)} / {formatNumber(NOTES_MAX)}
          </p>
        )}
        {fieldError("notes")}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={saving} className="w-fit">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? savingLabel : submitLabel}
        </Button>
        {after}
      </div>
    </form>
  );
}
