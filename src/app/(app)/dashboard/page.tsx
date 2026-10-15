"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { api, toApiError, type ApiError } from "@/lib/api/client";
import type { Dashboard, DashboardAction, Event } from "@/lib/api/types";
import { countdownText, daysFrom, todayYmd } from "@/lib/dates";
import { eventName } from "@/lib/event-name";
import { defaultEventId, groupEvents } from "@/lib/event-order";
import { capitalize, formatAmount, formatNumber } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { useProfile } from "@/components/app-shell";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { Reveal } from "@/components/reveal";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

/** Customer dashboard (docs/SPEC-dashboard.md). Vendor-role users go to /vendor. */
export default function DashboardPage() {
  const router = useRouter();
  const profile = useProfile();
  const isCustomer = profile.role === "customer";

  useEffect(() => {
    if (!isCustomer) router.replace("/vendor");
  }, [isCustomer, router]);

  if (!isCustomer) return null;
  return (
    <Suspense fallback={<EventsSkeleton />}>
      <DashboardView />
    </Suspense>
  );
}

type DashState =
  | { status: "loading" }
  | { status: "loaded"; data: Dashboard }
  | { status: "error"; error: ApiError };

function DashboardView() {
  const router = useRouter();
  const params = useSearchParams();
  const events = useLoad(() => api.listEvents());
  const today = todayYmd();

  const list = events.state.status === "loaded" ? events.state.data.events : null;
  const grouped = list ? groupEvents(list, today) : null;
  const fallbackId = list ? defaultEventId(list, today) : null;
  const selectedId = params.get("event") ?? fallbackId;

  // Keep the default selection in the URL, so a reload shows the same event.
  useEffect(() => {
    if (!params.get("event") && fallbackId) router.replace(`/dashboard?event=${encodeURIComponent(fallbackId)}`);
  }, [params, fallbackId, router]);

  // Dashboard data for the selected event. Only the latest request may update
  // the page, so fast switching never shows a stale event.
  // `loaded.id` says which event the state belongs to; any other selection
  // reads as loading, so switching shows skeletons without a stale event.
  const [loaded, setLoaded] = useState<{ id: string | null; state: DashState }>({ id: null, state: { status: "loading" } });
  const latest = useRef(0);
  const fetchDash = useCallback((id: string) => {
    const req = ++latest.current;
    api
      .getDashboard(id)
      .then((data) => req === latest.current && setLoaded({ id, state: { status: "loaded", data } }))
      .catch((e) => req === latest.current && setLoaded({ id, state: { status: "error", error: toApiError(e) } }));
  }, []);
  useEffect(() => {
    if (selectedId) fetchDash(selectedId);
  }, [selectedId, fetchDash]);
  const dash: DashState = loaded.id === selectedId ? loaded.state : { status: "loading" };
  const retry = () => {
    if (!selectedId) return;
    setLoaded({ id: selectedId, state: { status: "loading" } });
    fetchDash(selectedId);
  };
  useEffect(() => () => {
    latest.current = -1; // ignore responses after leaving the page
  }, []);

  const header = <PageHeader label="Overview" title="Dashboard" description="One event at a time: what's booked, what needs doing and what's still missing." />;

  if (events.state.status === "loading") return <div className="flex flex-col gap-10">{header}<EventsSkeleton /></div>;
  if (events.state.status === "error") {
    return (
      <div className="flex flex-col gap-10">
        {header}
        <ErrorState error={events.state.error} onRetry={events.reload} message="Couldn't load your events. Please try again." />
      </div>
    );
  }
  if (!list || list.length === 0 || !grouped) {
    return (
      <div className="flex flex-col gap-10">
        {header}
        <Reveal className="flex max-w-md flex-col items-start gap-4">
          <h2 className="font-display text-h2">No events yet</h2>
          <p className="text-muted-foreground">Create an event to see its dashboard.</p>
          <Link href="/events/new" className={buttonVariants()}>
            Create event <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </Link>
        </Reveal>
      </div>
    );
  }

  const selected = list.find((e) => e.id === selectedId) ?? (dash.status === "loaded" ? dash.data.event : null);
  const notFound = dash.status === "error" && dash.error.code === "event_not_found";
  const known = list.some((e) => e.id === selectedId);
  const option = (e: Event) => `${eventName(e)} · ${e.date} · ${countdownText(daysFrom(today, e.date))}`;

  return (
    <div className="flex flex-col gap-10 lg:gap-14">
      {header}

      <div className="flex min-w-0 max-w-xl flex-col gap-2">
        <Label htmlFor="event-picker">Event</Label>
        <Select
          id="event-picker"
          value={known ? (selectedId ?? "") : ""}
          title={selected ? eventName(selected) : undefined}
          onChange={(e) => router.push(`/dashboard?event=${encodeURIComponent(e.target.value)}`)}
          className="min-w-0 truncate"
        >
          {!known && (
            <option value="" disabled>
              Choose an event
            </option>
          )}
          {grouped.upcoming.length > 0 && (
            <optgroup label="Upcoming">
              {grouped.upcoming.map((e) => (
                <option key={e.id} value={e.id} title={eventName(e)}>
                  {option(e)}
                </option>
              ))}
            </optgroup>
          )}
          {grouped.past.length > 0 && (
            <optgroup label="Past">
              {grouped.past.map((e) => (
                <option key={e.id} value={e.id} title={eventName(e)}>
                  {option(e)}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
      </div>

      {notFound ? (
        <div className="flex max-w-md flex-col items-start gap-6">
          <p className="label">404</p>
          <h2 className="font-display text-h1">Event not found</h2>
          <p className="text-muted-foreground">This event doesn&apos;t exist, or it isn&apos;t yours. Choose another one above.</p>
          <Link href="/events" className={buttonVariants({ variant: "outline" })}>
            Back to your events
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <CountdownCard event={selected} today={today} />
          <Section title="Bookings" state={dash} onRetry={retry} skeleton={<Skeleton className="h-20 w-full" />}>
            {(d) => <Counts counts={d.bookingCounts} />}
          </Section>
          <Section title="Actions needed" state={dash} onRetry={retry} skeleton={<Rows />}>
            {(d) => <Actions eventId={d.event.id} actions={d.actions} />}
          </Section>
          <Section title="Missing services" state={dash} onRetry={retry} skeleton={<Rows />}>
            {(d) => <Missing eventId={d.event.id} missing={d.missing} />}
          </Section>
        </div>
      )}
    </div>
  );
}

function EventsSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-6">
      <Skeleton className="h-12 w-full max-w-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}

function Rows() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-2/3" />
    </div>
  );
}

function CountdownCard({ event, today }: { event: Event | null; today: string }) {
  return (
    <Card className="flex min-w-0 flex-col gap-2" aria-labelledby="countdown-heading">
      <h2 id="countdown-heading" className="label">
        Countdown
      </h2>
      {event ? (
        <>
          <p className="font-display text-display leading-none" aria-live="polite">
            {countdownText(daysFrom(today, event.date))}
          </p>
          <p className="truncate font-medium" title={eventName(event)}>
            {eventName(event)}
          </p>
          <p className="text-sm text-muted-foreground">
            {capitalize(event.type)} &middot; {event.date}
          </p>
        </>
      ) : (
        <Skeleton className="h-16 w-2/3" />
      )}
    </Card>
  );
}

/** A dashboard section with its own loading and error state; a failure never hides the other sections. */
function Section({
  title,
  state,
  onRetry,
  skeleton,
  children,
}: {
  title: string;
  state: DashState;
  onRetry: () => void;
  skeleton: React.ReactNode;
  children: (d: Dashboard) => React.ReactNode;
}) {
  const id = `section-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <Card className="flex min-w-0 flex-col gap-4" aria-labelledby={id}>
      <h2 id={id} className="font-display text-h2">
        {title}
      </h2>
      {state.status === "loading" ? (
        <div role="status" aria-label={`Loading ${title.toLowerCase()}`}>
          {skeleton}
        </div>
      ) : state.status === "error" ? (
        <ErrorState error={state.error} onRetry={onRetry} message={`Couldn't load ${title.toLowerCase()}. Please try again.`} />
      ) : (
        children(state.data)
      )}
    </Card>
  );
}

function Counts({ counts }: { counts: Dashboard["bookingCounts"] }) {
  const items: [string, number][] = [
    ["Pending", counts.pending],
    ["Confirmed", counts.confirmed],
    ["Declined", counts.declined],
  ];
  return (
    <dl className="grid grid-cols-3 divide-x divide-border">
      {items.map(([label, n]) => (
        <div key={label} className="flex flex-col gap-1 px-3 first:pl-0">
          <dt className="label">{label}</dt>
          <dd className="font-display text-h1">{formatNumber(n)}</dd>
        </div>
      ))}
    </dl>
  );
}

function actionView(eventId: string, a: DashboardAction): { text: string; href: string } {
  const e = encodeURIComponent(eventId);
  if (a.type === "pay_deposit") {
    return { text: `Pay deposit of ${formatAmount(a.amount ?? 0)} to ${a.vendorName}`, href: `/events/${e}/bookings/${encodeURIComponent(a.bookingId)}/pay` };
  }
  if (a.type === "find_replacement") {
    return { text: `${a.vendorName} declined. Find another ${a.category}`, href: `/events/${e}/vendors?category=${encodeURIComponent(a.category)}` };
  }
  return { text: `Waiting for ${a.vendorName} to respond (${a.category})`, href: `/events/${e}` };
}

function Actions({ eventId, actions }: { eventId: string; actions: DashboardAction[] }) {
  if (actions.length === 0) return <p className="text-muted-foreground">Nothing needs your attention</p>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {actions.map((a) => {
        const v = actionView(eventId, a);
        return (
          <li key={`${a.type}-${a.bookingId}`}>
            <Link href={v.href} className="flex min-h-11 items-center justify-between gap-3 py-2 hover:underline">
              <span className="min-w-0 [overflow-wrap:anywhere]">{v.text}</span>
              <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Missing({ eventId, missing }: { eventId: string; missing: Dashboard["missing"] }) {
  const e = encodeURIComponent(eventId);
  if (missing.length === 0) return <p className="text-muted-foreground">Every service has a booking</p>;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border">
        {missing.map((m) => (
          <li key={m.category}>
            <Link href={`/events/${e}/vendors?category=${encodeURIComponent(m.category)}`} className="flex min-h-11 items-center justify-between gap-3 py-2 hover:underline">
              <span className="font-medium">{capitalize(m.category)}</span>
              <span className="text-sm text-muted-foreground">Budget share {formatNumber(m.budgetShare)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href={`/events/${e}`} className="w-fit text-sm font-medium underline-offset-4 hover:underline">
        See suggestions
      </Link>
    </div>
  );
}
