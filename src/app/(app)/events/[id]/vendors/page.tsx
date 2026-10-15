"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import type { EventType, Vendor } from "@/lib/api/types";
import { eventName } from "@/lib/event-name";
import { useLoad } from "@/lib/use-load";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { Reveal } from "@/components/reveal";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryTabs, TABPANEL_ID, tabId } from "./category-tabs";
import { VendorCard, VendorCardSkeleton } from "./vendor-card";

const GRID = "grid gap-3.5 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3";

/** Initial data: all vendors (for the tabs) and the plan (for what is already booked). */
async function loadPage(eventId: string) {
  const [{ vendors }, { event, bookings }] = await Promise.all([
    api.listVendors(),
    api.getPlan(eventId),
  ]);
  const booked = bookings
    .filter((b) => b.status !== "declined")
    .map((b) => b.vendorId);
  return { all: vendors, event, booked };
}

function SkeletonGrid() {
  return (
    <div role="status" aria-label="Loading vendors" className={GRID}>
      {Array.from({ length: 6 }, (_, i) => (
        <VendorCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default function VendorsPage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useLoad(() => loadPage(id));

  const back = (
    <Link
      href={`/events/${id}`}
      className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Back to plan
    </Link>
  );

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-10">
        {back}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-2/3 max-w-sm" />
        </div>
        <SkeletonGrid />
      </div>
    );
  }

  if (state.status === "error") {
    if (state.error.code === "event_not_found") {
      return (
        <div className="flex max-w-md flex-col items-start gap-6">
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
          message="Couldn't load vendors. Please try again."
        />
      </div>
    );
  }

  return (
    <Browser
      eventId={id}
      eventType={state.data.event.type}
      all={state.data.all}
      initialBooked={state.data.booked}
      back={back}
      eventLabel={eventName(state.data.event)}
    />
  );
}

function Browser({
  eventId,
  eventType,
  all,
  initialBooked,
  back,
  eventLabel,
}: {
  eventId: string;
  eventType: EventType;
  all: Vendor[];
  initialBooked: string[];
  back: React.ReactNode;
  eventLabel: string;
}) {
  const [category, setCategory] = useState<string | null>(null); // null = All
  const [booked, setBooked] = useState<Set<string>>(new Set(initialBooked));
  const [booking, setBooking] = useState<Set<string>>(new Set());
  const [bookError, setBookError] = useState<string | null>(null);

  // Tabs come from the distinct categories of the unfiltered list.
  const categories = [...new Set(all.map((v) => v.category))].sort();

  async function book(vendorId: string) {
    setBookError(null);
    setBooking((s) => new Set(s).add(vendorId));
    try {
      await api.createBooking({ eventId, vendorId });
      setBooked((s) => new Set(s).add(vendorId));
    } catch (e) {
      const err = toApiError(e);
      if (err.code === "already_booked") setBooked((s) => new Set(s).add(vendorId));
      else
        setBookError(
          err.code === "forbidden"
            ? "Only customers can book vendors."
            : "Couldn't book this vendor. Please try again.",
        );
    } finally {
      setBooking((s) => {
        const next = new Set(s);
        next.delete(vendorId);
        return next;
      });
    }
  }

  return (
    <div className="flex flex-col gap-10 lg:gap-16">
      {back}
      <PageHeader
        label="Vendors"
        title="Add vendor"
        description={
          <>
            For <span className="font-medium text-foreground [overflow-wrap:anywhere]">{eventLabel}</span>. Book the
            services for your {eventType}.
          </>
        }
      />

      <div className="flex flex-col gap-5">
        <CategoryTabs categories={categories} active={category} onChange={setCategory} />

        {bookError && <Alert variant="destructive">{bookError}</Alert>}

        <div id={TABPANEL_ID} role="tabpanel" aria-labelledby={tabId(category)}>
          {/* key remounts the list so it shows its loading state and fades up on each tab change */}
          <VendorList
            key={category ?? "all"}
            category={category}
            booked={booked}
            booking={booking}
            onBook={book}
            onShowAll={() => setCategory(null)}
          />
        </div>
      </div>
    </div>
  );
}

function VendorList({
  category,
  booked,
  booking,
  onBook,
  onShowAll,
}: {
  category: string | null;
  booked: Set<string>;
  booking: Set<string>;
  onBook: (vendorId: string) => void;
  onShowAll: () => void;
}) {
  const { state, reload } = useLoad(() => api.listVendors(category ?? undefined));

  if (state.status === "loading") return <SkeletonGrid />;
  if (state.status === "error") {
    return (
      <ErrorState
        error={state.error}
        onRetry={reload}
        message="Couldn't load vendors. Please try again."
      />
    );
  }
  if (state.data.vendors.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <p className="font-display text-h2">No vendors in this category yet</p>
        {category !== null && (
          <Button variant="outline" onClick={onShowAll}>
            Show all vendors
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={GRID}>
      {state.data.vendors.map((v, i) => (
        <Reveal key={v.id} delay={Math.min(i, 5) * 60} className="min-w-0">
          <VendorCard
            vendor={v}
            booked={booked.has(v.id)}
            booking={booking.has(v.id)}
            onBook={() => onBook(v.id)}
          />
        </Reveal>
      ))}
    </div>
  );
}
