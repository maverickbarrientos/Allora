"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import { capitalize, formatDate, formatNumber } from "@/lib/format";
import { eventName } from "@/lib/event-name";
import { useLoad } from "@/lib/use-load";
import type { EventService, PlanBooking } from "@/lib/api/types";
import { PlanningAssistant } from "@/components/chat/planning-assistant";
import { BudgetSection } from "@/components/budget-section";
import { ServicesSection } from "@/components/services-section";
import { ErrorState } from "@/components/error-state";
import { missingCardId } from "@/components/missing-card";
import { MissingSection } from "@/components/missing-section";
import { PageHeader } from "@/components/page-header";
import { PlanPaymentLine } from "@/components/payment-status";
import { Reveal } from "@/components/reveal";
import { StatusBadge } from "@/components/status-badge";
import { ReplacementNotice, hasNewlyDeclined, replacementCategories } from "@/components/replacement-notice";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlanPage() {
  const { id } = useParams<{ id: string }>();
  const { state, setState, reload } = useLoad(() => api.getPlan(id));
  // "What's missing" loads on its own, in parallel, and never blocks the plan.
  const missing = useLoad(() => api.getMissing(id));
  // "Budget by service" also loads on its own; if it fails the plan still works.
  const budgets = useLoad(() => api.getBudgets(id));
  const setBudgets = budgets.setState;
  // "Services" (the event's own list) loads on its own too.
  const services = useLoad(() => api.getServices(id));
  const setServices = services.setState;
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // One plan refresh at a time (Refresh button, tab focus, after a booking).
  // A refresh asked for while one runs is queued once, or dropped if `queue`
  // is false. When a refresh shows a booking that turned declined since the
  // last render, the cards are refetched once (unless `cards` is false).
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const inFlight = useRef(false);
  const queued = useRef<{ cards: boolean } | null>(null);
  const shown = useRef<PlanBooking[] | null>(null);
  const reloadCards = missing.reload;

  useEffect(() => {
    if (state.status === "loaded") shown.current = state.data.bookings;
  }, [state]);

  async function refreshPlan({ cards, queue }: { cards: boolean; queue: boolean }) {
    if (inFlight.current) {
      if (queue) queued.current = { cards: (queued.current?.cards ?? false) || cards };
      return;
    }
    inFlight.current = true;
    setRefreshing(true);
    setRefreshFailed(false);
    try {
      const data = await api.getPlan(id);
      if (!alive.current) return;
      const before = shown.current;
      shown.current = data.bookings;
      setState((prev) => (prev.status === "loaded" ? { status: "loaded", data } : prev));
      if (cards && before && hasNewlyDeclined(before, data.bookings)) reloadCards();
      // Booked totals follow the bookings; refreshed quietly, a failure keeps the last values.
      api
        .getBudgets(id)
        .then((summary) => alive.current && setBudgets({ status: "loaded", data: summary }))
        .catch(() => {});
      // Service statuses follow the bookings too.
      api
        .getServices(id)
        .then((data) => alive.current && setServices({ status: "loaded", data }))
        .catch(() => {});
    } catch {
      if (alive.current) setRefreshFailed(true);
    } finally {
      inFlight.current = false;
      if (alive.current) {
        setRefreshing(false);
        const next = queued.current;
        queued.current = null;
        if (next) void refreshPlan({ ...next, queue: false });
      }
    }
  }

  // The focus listener always calls the latest refreshPlan.
  const refreshRef = useRef(refreshPlan);
  useEffect(() => {
    refreshRef.current = refreshPlan;
  });

  // Refresh when the tab regains focus. Extra focus events while a refresh
  // runs are dropped, so they never stack.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") void refreshRef.current({ cards: true, queue: false });
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  function seeReplacements(category: string) {
    // The card if it is on screen, otherwise the "What's missing" heading
    // (cards still loading, failed, or already booked).
    const el = document.getElementById(missingCardId(category)) ?? document.getElementById("missing-heading");
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    el.focus({ preventScroll: true });
  }

  const planBookings = state.status === "loaded" ? state.data.bookings : null;
  const declinedVendorIds = useMemo(
    () => new Set((planBookings ?? []).filter((b) => b.status === "declined").map((b) => b.vendorId)),
    [planBookings],
  );

  // After a booking from a card: show it on the plan at once, then refresh the
  // bookings quietly. The cards are not refetched.
  function onBooked(booking?: PlanBooking) {
    if (booking) {
      setState((prev) =>
        prev.status === "loaded" && !prev.data.bookings.some((b) => b.id === booking.id)
          ? {
              status: "loaded",
              data: { ...prev.data, bookings: [...prev.data.bookings, booking] },
            }
          : prev,
      );
    }
    void refreshPlan({ cards: false, queue: true });
  }

  // After the service list changes: the gaps and shares change, so the cards
  // are refetched, and the plan refresh also refreshes budgets and services.
  function onServicesSaved(data: { services: EventService[] }) {
    if (!alive.current) return;
    setServices({ status: "loaded", data });
    reloadCards();
    void refreshPlan({ cards: false, queue: true });
  }

  // A fresh list without a save (after a refused save): only the list changes.
  function onServicesRefreshed(data: { services: EventService[] }) {
    if (alive.current) setServices({ status: "loaded", data });
  }

  function removeCard(category: string) {
    missing.setState((prev) =>
      prev.status === "loaded"
        ? {
            status: "loaded",
            data: { ...prev.data, cards: prev.data.cards.filter((c) => c.category !== category) },
          }
        : prev,
    );
  }

  const back = (
    <Link
      href="/events"
      className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Your events
    </Link>
  );

  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading" className="flex flex-col gap-10">
        {back}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-2/3 max-w-sm" />
          <Skeleton className="h-5 w-1/3 max-w-xs" />
        </div>
        <Skeleton className="h-14" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (state.status === "error") {
    if (state.error.code === "event_not_found") {
      return (
        <div className="flex max-w-md flex-col items-start gap-6">
          {back}
          <p className="label">404</p>
          <h1 className="font-display text-h1">Event not found</h1>
          <p className="text-muted-foreground">
            This event doesn&apos;t exist, or it isn&apos;t yours.
          </p>
          <Link href="/events" className={buttonVariants({ variant: "outline" })}>
            Back to your events
          </Link>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-10">
        {back}
        <ErrorState
          error={state.error}
          onRetry={reload}
          message="Couldn't load this plan. Please try again."
        />
      </div>
    );
  }

  const { event, bookings } = state.data;
  const actions = (
    <div className="flex flex-wrap gap-3">
      <Link href={`/events/${event.id}/edit`} className={buttonVariants({ variant: "outline" })}>
        Edit event
      </Link>
      <Link href={`/events/${event.id}/vendors`} className={buttonVariants()}>
        Add vendor
      </Link>
    </div>
  );

  return (
    <div className="flex flex-col gap-10 lg:gap-16">
      {back}
      <PageHeader
        label="Event plan"
        title={<span className="[overflow-wrap:anywhere]">{eventName(event)}</span>}
        description={`${capitalize(event.type)} · ${formatDate(event.date)}`}
        action={actions}
      />

      <Reveal delay={400}>
        <dl className="grid grid-cols-2 divide-x divide-border border-y border-border">
          <Stat label="Budget" value={formatNumber(event.budget)} />
          <Stat label="Guests" value={formatNumber(event.guestCount)} />
        </dl>
      </Reveal>

      {event.notes && (
        <section className="flex flex-col gap-2" aria-labelledby="notes-heading">
          <h2 id="notes-heading" className="label">
            Notes
          </h2>
          <p className="max-w-[65ch] whitespace-pre-line wrap-anywhere">{event.notes}</p>
        </section>
      )}

      <ReplacementNotice
        categories={replacementCategories(bookings)}
        onSeeReplacements={seeReplacements}
      />

      <section className="flex flex-col gap-6" aria-labelledby="bookings-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="bookings-heading" className="font-display text-h2">
            Bookings
          </h2>
          <div className="flex items-center gap-3">
            {refreshFailed && (
              <p role="status" className="text-sm text-muted-foreground">
                Couldn&apos;t refresh. Please try again.
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={refreshing}
              onClick={() => void refreshPlan({ cards: true, queue: false })}
            >
              {refreshing && <Loader2 className="h-4 w-4 animate-spin" />}
              Refresh
            </Button>
          </div>
        </div>

        {bookings.length === 0 ? (
          <Reveal delay={500} className="flex max-w-md flex-col items-start gap-4">
            <p className="font-display text-h2">Nothing booked yet</p>
            <p className="text-muted-foreground">
              Browse vendors by category and book the ones you want.
            </p>
            <Link href={`/events/${event.id}/vendors`} className={buttonVariants()}>
              Add vendor <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </Link>
          </Reveal>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {bookings.map((b, i) => (
              <li key={b.id}>
                <Reveal delay={500 + Math.min(i, 3) * 80}>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 py-3 sm:grid-cols-[9rem_1fr_auto_5.5rem]">
                    <span className="label col-span-2 sm:col-span-1">{b.category}</span>
                    <Link
                      href={`/events/${event.id}/vendors/${b.vendorId}`}
                      className="-my-2 min-w-0 py-2 font-display text-h2 wrap-anywhere underline-offset-4 hover:underline"
                    >
                      {b.vendorName}
                    </Link>
                    <span className="hidden text-right sm:block">{formatNumber(b.price)}</span>
                    <StatusBadge status={b.status} className="justify-self-end" />
                    <span className="text-sm sm:hidden">{formatNumber(b.price)}</span>
                    <div className="col-span-2 empty:hidden sm:col-span-3 sm:col-start-2">
                      <PlanPaymentLine booking={b} eventId={event.id} />
                    </div>
                    <div className="col-span-2 flex flex-wrap gap-x-4 text-sm sm:col-span-3 sm:col-start-2">
                      <Link
                        href={`/events/${event.id}/bookings/${b.id}/contract`}
                        className="-my-2 py-2 underline underline-offset-4 hover:text-muted-foreground"
                        aria-label={`Contract for ${b.vendorName}`}
                      >
                        Contract
                      </Link>
                      </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ServicesSection
        eventId={id}
        state={services.state}
        onRetry={services.reload}
        onSaved={onServicesSaved}
        onRefreshed={onServicesRefreshed}
      />

      <BudgetSection eventId={id} state={budgets.state} onRetry={budgets.reload} />

      <MissingSection
        eventId={id}
        eventDate={event.date}
        state={missing.state}
        onRetry={missing.reload}
        onBooked={onBooked}
        onRemove={removeCard}
        declinedVendorIds={declinedVendorIds}
      />

      <PlanningAssistant
        eventId={id}
        eventName={eventName(event)}
        onNotFound={() =>
          setState({
            status: "error",
            error: new ApiError(404, "event_not_found", "Event not found"),
          })
        }
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-4 first:pl-0 sm:px-8">
      <dt className="label">{label}</dt>
      <dd className="font-display text-h2">{value}</dd>
    </div>
  );
}
