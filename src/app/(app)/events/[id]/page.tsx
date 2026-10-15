"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { api } from "@/lib/api/client";
import { capitalize, formatDate, formatNumber } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import type { PlanBooking } from "@/lib/api/types";
import { ErrorState } from "@/components/error-state";
import { MissingSection } from "@/components/missing-section";
import { PageHeader } from "@/components/page-header";
import { Reveal } from "@/components/reveal";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlanPage() {
  const { id } = useParams<{ id: string }>();
  const { state, setState, reload } = useLoad(() => api.getPlan(id));
  // "What's missing" loads on its own, in parallel, and never blocks the plan.
  const missing = useLoad(() => api.getMissing(id));
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

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
    api
      .getPlan(id)
      .then((data) => {
        if (alive.current) setState((prev) => (prev.status === "loaded" ? { status: "loaded", data } : prev));
      })
      .catch(() => {});
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
      href="/"
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
        <Skeleton className="h-16" />
        <Skeleton className="h-48" />
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
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
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
  const addVendor = (
    <Link href={`/events/${event.id}/vendors`} className={buttonVariants()}>
      Add vendor
    </Link>
  );

  return (
    <div className="flex flex-col gap-12">
      {back}
      <PageHeader
        label="Event plan"
        title={capitalize(event.type)}
        description={formatDate(event.date)}
        action={addVendor}
      />

      <Reveal delay={400}>
        <dl className="grid grid-cols-2 divide-x divide-border border-y border-border">
          <Stat label="Budget" value={formatNumber(event.budget)} />
          <Stat label="Guests" value={formatNumber(event.guestCount)} />
        </dl>
      </Reveal>

      <section className="flex flex-col gap-6" aria-labelledby="bookings-heading">
        <h2 id="bookings-heading" className="font-display text-h2">
          Bookings
        </h2>

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
                  <div className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 py-5 sm:grid-cols-[10rem_1fr_auto_auto]">
                    <span className="label col-span-2 sm:col-span-1">{b.category}</span>
                    <span className="font-display text-h2">{b.vendorName}</span>
                    <span className="hidden text-right sm:block">{formatNumber(b.price)}</span>
                    <StatusBadge status={b.status} />
                    <span className="text-sm sm:hidden">{formatNumber(b.price)}</span>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </section>

      <MissingSection
        eventId={id}
        state={missing.state}
        onRetry={missing.reload}
        onBooked={onBooked}
        onRemove={removeCard}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-6 first:pl-0 sm:px-8">
      <dt className="label">{label}</dt>
      <dd className="font-display text-h2">{value}</dd>
    </div>
  );
}
