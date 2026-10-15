"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api, ApiError, toApiError } from "@/lib/api/client";
import { capitalize } from "@/lib/format";
import { eventName } from "@/lib/event-name";
import { useLoad } from "@/lib/use-load";
import type { Event, UpdateEventInput } from "@/lib/api/types";
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
import { Reveal } from "@/components/reveal";
import { Alert } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  return diff;
}

/** "Clear these service budgets first: photography, music." -> "photography, music" */
const categoriesFrom = (message: string) => message.split(":")[1]?.trim().replace(/\.$/, "") ?? "";

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, setState, reload } = useLoad(() => api.getPlan(id));
  const [edited, setEdited] = useState<EventFormValues | null>(null);
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [conflict, setConflict] = useState<React.ReactNode>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingTypeChange, setPendingTypeChange] = useState<UpdateEventInput | null>(null);
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
    setConflict(null);
    setNotice(null);
    if (!input) return;

    const diff = changes(saved, { ...input, notes: input.notes ?? null });
    if (Object.keys(diff).length === 0) {
      setNotice("No changes to save.");
      return;
    }
    // A type change changes the checklist, so it is confirmed first.
    if (diff.type) setPendingTypeChange(diff);
    else void send(diff);
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
      } else if (code === "budgets_outside_checklist") {
        const list = categoriesFrom(message);
        setConflict(
          <>
            You&apos;ve set service budgets for services a {diff.type} event doesn&apos;t include
            {list ? ` (${list})` : ""}. Clear those budgets first, then change the type.{" "}
            <Link href={`/events/${id}/budgets`} className="underline underline-offset-4">
              Go to budgets
            </Link>
          </>,
        );
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
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
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
          before={conflict && <Alert variant="destructive">{conflict}</Alert>}
          after={
            notice && (
              <p role="status" className="text-sm text-muted-foreground">
                {notice}
              </p>
            )
          }
        />
      </Reveal>

      <AlertDialog
        open={pendingTypeChange !== null}
        onOpenChange={(open) => !open && setPendingTypeChange(null)}
      >
        {pendingTypeChange?.type && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Change the type to {capitalize(pendingTypeChange.type)}?</AlertDialogTitle>
              <AlertDialogDescription>
                Your checklist, budget suggestions and &ldquo;What&apos;s missing&rdquo; cards will follow
                the new type. Bookings you&apos;ve already made stay on your plan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingTypeChange(null)}>
                Keep {capitalize(saved.type)}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const diff = pendingTypeChange;
                  setPendingTypeChange(null);
                  void send(diff);
                }}
              >
                Change type
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialog>
    </div>
  );
}
