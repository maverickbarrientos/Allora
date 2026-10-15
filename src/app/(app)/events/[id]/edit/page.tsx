"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api, ApiError, toApiError } from "@/lib/api/client";
import { eventName } from "@/lib/event-name";
import { useLoad } from "@/lib/use-load";
import type { Event, EventService, UpdateEventInput } from "@/lib/api/types";
import {
  EventForm,
  fieldErrorsFrom,
  validateEventForm,
  valuesFromEvent,
  type EventFormErrors,
  type EventFormValues,
} from "@/components/event-form";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { ServicesSection } from "@/components/services-section";
import { Reveal } from "@/components/reveal";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Only the fields that differ from the saved event. */
function changes(saved: Event, input: Required<UpdateEventInput>): UpdateEventInput {
  const diff: UpdateEventInput = {};
  if (input.name !== saved.name) diff.name = input.name;
  if (input.type !== saved.type) diff.type = input.type;
  if (input.date !== saved.date) diff.date = input.date;
  if (input.budget !== saved.budget) diff.budget = input.budget;
  if (input.guestCount !== saved.guestCount) diff.guestCount = input.guestCount;
  if ((input.notes ?? null) !== (saved.notes ?? null)) diff.notes = input.notes;
  if ((input.location ?? null) !== (saved.location ?? null)) diff.location = input.location;
  return diff;
}

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, setState, reload } = useLoad(() => api.getPlan(id));
  // Services have their own section and Save, separate from the event details.
  const services = useLoad(() => api.getServices(id));
  const setServices = services.setState;
  const [edited, setEdited] = useState<EventFormValues | null>(null);
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const saved = state.status === "loaded" ? state.data.event : null;
  // `edited` is null until the customer types, so the form starts from the saved event.
  const values = edited ?? (saved ? valuesFromEvent(saved) : null);

  // Events are for customers only; a vendor session gets 403.
  useEffect(() => {
    if (state.status === "error" && state.error.code === "forbidden") router.replace("/vendor");
  }, [state, router]);

  function onChange(next: EventFormValues) {
    setEdited(next);
    setNotice(null);
  }

  function submit() {
    if (inFlight.current || !saved || !values) return;
    const { errors: next, input } = validateEventForm(values);
    setErrors(next);
    setNotice(null);
    if (!input) return;

    const diff = changes(saved, { ...input, notes: input.notes ?? null, location: input.location ?? null });
    if (Object.keys(diff).length === 0) {
      setNotice("No changes to save.");
      return;
    }
    // A type change keeps the event's services, so it needs no confirmation.
    void send(diff);
  }

  async function send(diff: UpdateEventInput) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    try {
      const { event } = await api.updateEvent(id, diff);
      if (!alive.current) return;
      setState((prev) => (prev.status === "loaded" ? { status: "loaded", data: { ...prev.data, event } } : prev));
      setEdited(null);
      setNotice("Saved");
    } catch (err) {
      if (!alive.current) return;
      const { code, message } = toApiError(err);
      if (code === "event_not_found") {
        setState({ status: "error", error: new ApiError(404, code, message) });
      } else if (code === "forbidden") {
        router.replace("/vendor");
      } else if (code === "validation_error") {
        const fields = fieldErrorsFrom(message);
        setErrors(Object.keys(fields).length ? fields : { form: message });
      } else if (code === "budget_below_allocations") {
        setErrors({
          budget:
            "This is less than the service budgets you've already set. Lower those budgets first, or keep a higher event budget.",
        });
      } else {
        setErrors({ form: "Couldn't save your changes. Please try again." });
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setSaving(false);
    }
  }

  function onServicesChanged(data: { services: EventService[] }) {
    if (alive.current) setServices({ status: "loaded", data });
  }

  const back = (
    <Link
      href={`/events/${id}`}
      className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Back to plan
    </Link>
  );

  if (state.status === "error") {
    if (state.error.code === "forbidden") return null;
    if (state.error.code === "event_not_found") {
      return (
        <div className="flex max-w-md flex-col items-start gap-6">
          <p className="label">404</p>
          <h1 className="font-display text-h1">Event not found</h1>
          <p className="text-muted-foreground">This event doesn&apos;t exist, or it isn&apos;t yours.</p>
          <Link href="/events" className={buttonVariants({ variant: "outline" })}>
            Back to your events
          </Link>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-10">
        {back}
        <ErrorState error={state.error} onRetry={reload} message="Couldn't load this event. Please try again." />
      </div>
    );
  }

  if (!saved || !values) {
    return (
      <div role="status" aria-label="Loading" className="flex max-w-xl flex-col gap-10">
        {back}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-2/3 max-w-sm" />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-10">
      {back}
      <PageHeader
        label="Edit event"
        title={<span className="[overflow-wrap:anywhere]">{eventName(saved)}</span>}
        description="Change the details of your event. Bookings stay as they are."
      />
      <Reveal delay={400}>
        <EventForm
          values={values}
          onChange={onChange}
          errors={errors}
          saving={saving}
          submitLabel="Save changes"
          savingLabel="Saving"
          onSubmit={submit}
          after={
            notice && (
              <p role="status" className="text-sm text-muted-foreground">
                {notice}
              </p>
            )
          }
        />
      </Reveal>

      <ServicesSection
        eventId={id}
        state={services.state}
        onRetry={services.reload}
        onSaved={onServicesChanged}
        onRefreshed={onServicesChanged}
      />
    </div>
  );
}
