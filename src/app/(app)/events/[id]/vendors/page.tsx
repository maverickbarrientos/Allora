"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import type { Vendor } from "@/lib/api/types";
import { capitalize, formatNumber } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { ErrorState } from "@/components/error-state";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { PageHeader } from "@/components/page-header";
import { Reveal } from "@/components/reveal";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CAPTIONS: Record<string, string> = {
  venue: "Venue interior, morning light",
  catering: "Long table, candlelight",
  photography: "Window light, quiet moment",
  music: "Evening room, warm light",
  decoration: "Table setting, natural light",
};
const captionFor = (category: string) => CAPTIONS[category] ?? "Table setting, natural light";

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

export default function VendorsPage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useLoad(() => loadPage(id));

  const back = (
    <Link
      href={`/events/${id}`}
      className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Back to plan
    </Link>
  );

  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading" className="flex flex-col gap-10">
        {back}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-2/3 max-w-sm" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-80" />
          <Skeleton className="hidden h-80 sm:block" />
          <Skeleton className="hidden h-80 lg:block" />
        </div>
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
      all={state.data.all}
      initialBooked={state.data.booked}
      back={back}
    />
  );
}

function Browser({
  eventId,
  all,
  initialBooked,
  back,
}: {
  eventId: string;
  all: Vendor[];
  initialBooked: string[];
  back: React.ReactNode;
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
    <div className="flex flex-col gap-14 lg:gap-24">
      {back}
      <PageHeader
        label="Vendors"
        title="Add vendor"
        description="Booking sends a request. It shows as pending on your plan until the vendor responds."
      />

      <div role="tablist" aria-label="Category" className="-mx-4 flex gap-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {[null, ...categories].map((c) => {
          const active = c === category;
          return (
            <button
              key={c ?? "all"}
              role="tab"
              aria-selected={active}
              onClick={() => setCategory(c)}
              className={cn(
                "min-h-11 whitespace-nowrap border-b-2 px-1 text-sm transition-colors",
                active
                  ? "border-brass font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {c ? capitalize(c) : "All"}
            </button>
          );
        })}
      </div>

      {bookError && <Alert variant="destructive">{bookError}</Alert>}

      {/* key remounts the list so it shows its loading state on each tab change */}
      <VendorList
        key={category ?? "all"}
        category={category}
        booked={booked}
        booking={booking}
        onBook={book}
      />
    </div>
  );
}

function VendorList({
  category,
  booked,
  booking,
  onBook,
}: {
  category: string | null;
  booked: Set<string>;
  booking: Set<string>;
  onBook: (vendorId: string) => void;
}) {
  const { state, reload } = useLoad(() => api.listVendors(category ?? undefined));

  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-80" />
        <Skeleton className="hidden h-80 sm:block" />
        <Skeleton className="hidden h-80 lg:block" />
      </div>
    );
  }
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
      <p className="text-muted-foreground">No vendors in this category yet.</p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {state.data.vendors.map((v, i) => {
        const isBooked = booked.has(v.id);
        const isBooking = booking.has(v.id);
        return (
          <Reveal key={v.id} delay={Math.min(i, 3) * 80}>
            <Card className="flex h-full flex-col gap-5 p-7">
              <ImagePlaceholder caption={captionFor(v.category)} aspect="4 / 3" />
              <div className="flex flex-1 flex-col gap-1">
                <p className="label">{v.category}</p>
                <h2 className="font-display text-h2">{v.name}</h2>
                <p className="text-muted-foreground">{formatNumber(v.price)}</p>
              </div>
              <Button
                variant={isBooked ? "outline" : "default"}
                disabled={isBooked || isBooking}
                onClick={() => onBook(v.id)}
                aria-label={isBooked ? `${v.name}, booked` : `Book ${v.name}`}
              >
                {isBooking && <Loader2 className="h-4 w-4 animate-spin" />}
                {isBooked ? "Booked" : isBooking ? "Booking" : "Book"}
              </Button>
            </Card>
          </Reveal>
        );
      })}
    </div>
  );
}
