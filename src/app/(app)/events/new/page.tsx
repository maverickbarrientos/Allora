"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import { formatNumber } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import type { EventTemplate, EventType } from "@/lib/api/types";
import {
  EMPTY_EVENT_FORM,
  EventForm,
  fieldErrorsFrom,
  validateEventForm,
  type EventFormErrors,
  type EventFormValues,
} from "@/components/event-form";
import { PageHeader } from "@/components/page-header";
import { ServicePicker } from "@/components/service-picker";
import { Reveal } from "@/components/reveal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** "blank", or the type of the template the form was filled from. */
type Choice = "blank" | EventType;

// Nothing is booked yet on a new event.
const NO_LOCKS: ReadonlySet<string> = new Set();

function valuesFromTemplate(t: EventTemplate): EventFormValues {
  return {
    name: t.name,
    type: t.type,
    date: "",
    budget: String(t.budget),
    guestCount: String(t.guestCount),
    notes: t.notes,
    location: "",
  };
}

const sameValues = (a: EventFormValues, b: EventFormValues) =>
  (Object.keys(a) as (keyof EventFormValues)[]).every((k) => a[k] === b[k]);

export default function NewEventPage() {
  const router = useRouter();
  const templates = useLoad(() => api.listEventTemplates());
  const [choice, setChoice] = useState<Choice>("blank");
  // What the current choice filled in, to tell whether the customer has typed since.
  const [applied, setApplied] = useState<EventFormValues>(EMPTY_EVENT_FORM);
  const [values, setValues] = useState<EventFormValues>(EMPTY_EVENT_FORM);
  const [pendingChoice, setPendingChoice] = useState<Choice | null>(null);
  // null until the customer changes the picker; until then it follows the type.
  const [customServices, setCustomServices] = useState<string[] | null>(null);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const categories = useLoad(() => api.listCategories());
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Templates are for customers only; a vendor session gets 403.
  useEffect(() => {
    if (templates.state.status === "error" && templates.state.error.code === "forbidden") {
      router.replace("/vendor");
    }
  }, [templates.state, router]);

  const templateList = templates.state.status === "loaded" ? templates.state.data.templates : [];
  // The chosen type's template list, until the customer changes it. Empty
  // when the templates didn't load: then nothing can be prefilled.
  const typeTemplate = templateList.find((t) => t.type === values.type);
  const services = customServices ?? [...(typeTemplate?.services ?? [])];

  const labelFor = (c: Choice) =>
    c === "blank" ? "Start blank" : (templateList.find((t) => t.type === c)?.label ?? c);

  function apply(c: Choice) {
    const t = templateList.find((x) => x.type === c);
    const next = c === "blank" || !t ? EMPTY_EVENT_FORM : valuesFromTemplate(t);
    setChoice(c);
    setApplied(next);
    setValues(next);
    setErrors({});
  }

  function choose(c: Choice) {
    if (c === choice || saving) return;
    // Never replace what the customer typed without asking.
    if (!sameValues(values, applied)) setPendingChoice(c);
    else apply(c);
  }

  async function submit() {
    if (inFlight.current) return;
    const { errors: next, input } = validateEventForm(values);
    setErrors(next);
    const noServices = services.length === 0;
    setServicesError(noServices ? "Choose at least one service" : null);
    if (!input || noServices) return;

    inFlight.current = true;
    setSaving(true);
    try {
      const { event } = await api.createEvent({ ...input, services });
      if (alive.current) router.push(`/events/${event.id}`);
    } catch (err) {
      if (!alive.current) return;
      const { code, message } = toApiError(err);
      if (code === "validation_error") {
        const fields = fieldErrorsFrom(message);
        setErrors(Object.keys(fields).length ? fields : { form: message });
      } else {
        setErrors({
          form:
            code === "forbidden"
              ? "Only customers can create events."
              : "Something went wrong. Please try again.",
        });
      }
      inFlight.current = false;
      setSaving(false);
    }
  }

  const option = (c: Choice, title: string, detail: string) => (
    <label
      key={c}
      className="flex min-h-11 cursor-pointer flex-col gap-1 rounded-xl border border-border bg-background p-4 has-checked:border-primary has-checked:bg-secondary has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-disabled:cursor-not-allowed"
    >
      <span className="flex items-center gap-3">
        <input
          type="radio"
          name="start"
          value={c}
          checked={choice === c}
          onChange={() => choose(c)}
          disabled={saving}
          className="h-4 w-4 accent-primary focus:outline-none"
        />
        <span className="font-medium">{title}</span>
      </span>
      <span className="pl-7 text-sm text-muted-foreground">{detail}</span>
    </label>
  );

  const picker = (
    <fieldset className="flex flex-col gap-3">
      <legend className="label mb-3">Start from</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {option("blank", "Start blank", "Empty fields")}
        {templates.state.status === "loading" &&
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-[4.75rem] rounded-xl" />)}
        {templateList.map((t) =>
          option(
            t.type,
            t.label,
            `${formatNumber(t.guestCount)} guests · budget ${formatNumber(t.budget)}`,
          ),
        )}
      </div>
      {templates.state.status === "error" && templates.state.error.code !== "forbidden" && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="text-sm text-muted-foreground">
            Couldn&apos;t load templates. You can still start blank.
          </p>
          <Button variant="outline" size="sm" onClick={templates.reload}>
            Retry
          </Button>
        </div>
      )}
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground empty:hidden">
        {choice !== "blank" &&
          `Filled in from the ${labelFor(choice)} template. These are suggestions: check each field and change anything you like.`}
      </p>
    </fieldset>
  );

  const servicesField = (
    <div className="flex flex-col gap-2">
      <p className="label" aria-hidden="true">
        Services
      </p>
      <p className="text-sm text-muted-foreground">
        {customServices
          ? "Your choice of services stays as it is when you change the type."
          : typeTemplate
            ? "The usual services for this type are ticked. Add or remove any before you create the event."
            : values.type
              ? "Pick the services you need."
              : "Choose a type to see its usual services, or pick your own."}
      </p>
      {categories.state.status === "loaded" ? (
        <ServicePicker
          categories={categories.state.data.categories}
          selected={services}
          locked={NO_LOCKS}
          disabled={saving}
          error={servicesError}
          onChange={(next) => {
            setCustomServices(next);
            if (next.length > 0) setServicesError(null);
          }}
        />
      ) : categories.state.status === "error" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="text-sm text-muted-foreground">
            Couldn&apos;t load services.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={categories.reload}>
            Retry
          </Button>
        </div>
      ) : (
        <Skeleton role="status" aria-label="Loading services" className="h-24" />
      )}
      {servicesError && categories.state.status !== "loaded" && (
        <p role="alert" className="text-sm text-destructive">
          {servicesError}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex max-w-xl flex-col gap-10">
      <Link
        href="/events"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Your events
      </Link>
      <PageHeader
        label="New plan"
        title="Create event"
        description="Start from a template or from scratch. You can add vendors next."
      />
      <Reveal delay={700} className="flex flex-col gap-10">
        {picker}
        <EventForm
          values={values}
          onChange={setValues}
          errors={errors}
          saving={saving}
          submitLabel="Create event"
          savingLabel="Creating"
          onSubmit={() => void submit()}
          afterType={servicesField}
        />
      </Reveal>

      <AlertDialog open={pendingChoice !== null} onOpenChange={(open) => !open && setPendingChoice(null)}>
        {pendingChoice && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Replace what you&apos;ve typed?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingChoice === "blank"
                  ? "Starting blank clears every field, including your changes."
                  : `The ${labelFor(pendingChoice)} template fills every field with its suggestions and replaces your changes.`}
                {customServices && " Your choice of services stays as you set it."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingChoice(null)}>Keep my changes</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  apply(pendingChoice);
                  setPendingChoice(null);
                }}
              >
                Replace
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialog>
    </div>
  );
}
