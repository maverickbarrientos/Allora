"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Globe, Mail, MapPin, Phone } from "lucide-react";
import { api } from "@/lib/api/client";
import type { VendorContact } from "@/lib/api/types";
import { eventName } from "@/lib/event-name";
import { formatNumber } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { CheckAvailabilityDialog } from "@/components/check-availability-dialog";
import { ErrorState } from "@/components/error-state";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Reveal } from "@/components/reveal";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { captionFor } from "../vendor-card";

/** The vendor (with availability on the event's date) and the plan (for the event and what is booked). */
async function loadPage(eventId: string, vendorId: string) {
  const [{ vendor, contact }, { event, bookings }] = await Promise.all([
    api.getVendor(vendorId, eventId),
    api.getPlan(eventId),
  ]);
  // Booked when this event already has a pending or confirmed booking with the vendor.
  const booked = bookings.some((b) => b.vendorId === vendor.id && b.status !== "declined");
  return { vendor, contact, event, booked };
}

const LINK = "inline-flex min-h-11 items-center gap-3 underline-offset-4 hover:underline [overflow-wrap:anywhere]";

/**
 * Contact details, sent by the API only after the vendor has confirmed one of
 * this customer's bookings (docs/SPEC-vendor-profiles.md). Plain text and
 * plain links; the website is always http(s) (checked by the API and the database).
 */
function ContactSection({ vendorName, contact }: { vendorName: string; contact: VendorContact | null }) {
  const icon = "h-4 w-4 shrink-0 text-muted-foreground";
  const items = contact
    ? [
        contact.phone && (
          <a key="phone" href={`tel:${contact.phone.replace(/[^0-9+]/g, "")}`} className={LINK}>
            <Phone aria-hidden="true" className={icon} strokeWidth={1.5} />
            {contact.phone}
          </a>
        ),
        contact.email && (
          <a key="email" href={`mailto:${contact.email}`} className={LINK}>
            <Mail aria-hidden="true" className={icon} strokeWidth={1.5} />
            {contact.email}
          </a>
        ),
        contact.website && /^https?:\/\//i.test(contact.website) && (
          <a key="website" href={contact.website} target="_blank" rel="noopener noreferrer" className={LINK}>
            <Globe aria-hidden="true" className={icon} strokeWidth={1.5} />
            {contact.website}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ),
      ].filter(Boolean)
    : [];

  return (
    <section aria-labelledby="contact-heading" className="flex max-w-[65ch] flex-col gap-3">
      <h2 id="contact-heading" className="font-display text-h2">
        Contact
      </h2>
      {contact === null ? (
        <p className="text-muted-foreground [overflow-wrap:anywhere]">
          Contact details appear here once {vendorName} confirms your booking.
        </p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">This vendor hasn&apos;t added contact details yet.</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NotFound({ what, eventId }: { what: "vendor" | "event"; eventId: string }) {
  return (
    <div className="flex max-w-md flex-col items-start gap-6">
      <p className="label">404</p>
      <h1 className="font-display text-h1">{what === "vendor" ? "Vendor not found" : "Event not found"}</h1>
      <p className="text-muted-foreground">
        {what === "vendor"
          ? "This vendor doesn't exist any more."
          : "This event doesn't exist, or it isn't yours."}
      </p>
      <Link
        href={what === "vendor" ? `/events/${eventId}/vendors` : "/events"}
        className={buttonVariants({ variant: "outline" })}
      >
        {what === "vendor" ? "Back to vendors" : "Back to your events"}
      </Link>
    </div>
  );
}

export default function VendorProfilePage() {
  const { id, vendorId } = useParams<{ id: string; vendorId: string }>();
  const router = useRouter();
  const { state, reload } = useLoad(() => loadPage(id, vendorId));
  const [bookedNow, setBookedNow] = useState(false);
  const [checking, setChecking] = useState(false);
  // Set when a booking is refused because the date was taken meanwhile.
  const [takenNow, setTakenNow] = useState(false);

  // The plan is for customers only; a vendor session gets 403.
  useEffect(() => {
    if (state.status === "error" && state.error.code === "forbidden") router.replace("/vendor");
  }, [state, router]);

  const back = (
    <Link
      href={`/events/${id}/vendors`}
      className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Back to vendors
    </Link>
  );

  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading vendor" className="flex flex-col gap-10">
        {back}
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <Skeleton className="aspect-[4/3] w-full" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-11 w-28 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    const { code } = state.error;
    if (code === "forbidden") return null;
    if (code === "vendor_not_found") return <NotFound what="vendor" eventId={id} />;
    if (code === "event_not_found") return <NotFound what="event" eventId={id} />;
    return (
      <div className="flex flex-col gap-10">
        {back}
        <ErrorState error={state.error} onRetry={reload} message="Couldn't load this vendor. Please try again." />
      </div>
    );
  }

  const { vendor, contact, event } = state.data;
  const booked = state.data.booked || bookedNow;
  const available = takenNow ? false : vendor.availableOnEventDate;
  // Same rule as the vendor cards: unavailable means Book is disabled, the calendar stays reachable.
  const unavailable = available === false && !booked;

  return (
    <div className="flex flex-col gap-10 lg:gap-16">
      {back}

      <Reveal className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ImagePlaceholder caption={captionFor(vendor.category)} aspect="4 / 3" />
        <div className="flex min-w-0 flex-col gap-4">
          <p className="label">{vendor.category}</p>
          <h1 className="font-display text-h1 [overflow-wrap:anywhere]">{vendor.name}</h1>
          {vendor.location && (
            <p className="flex items-start gap-2 text-muted-foreground [overflow-wrap:anywhere]">
              <MapPin aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" strokeWidth={1.5} />
              {vendor.location}
            </p>
          )}
          <dl className="flex flex-col divide-y divide-border border-y border-border">
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-sm text-muted-foreground">Price</dt>
              <dd>{formatNumber(vendor.price)}</dd>
            </div>
            {available !== undefined && (
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-sm text-muted-foreground">
                  For <span className="[overflow-wrap:anywhere]">{eventName(event)}</span>
                </dt>
                <dd className={available ? "text-sm text-forest" : "text-sm text-brick"}>
                  {available ? `Available on ${event.date}` : `Unavailable on ${event.date}`}
                </dd>
              </div>
            )}
          </dl>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Button
              className="w-fit min-w-[5.5rem]"
              variant={booked || unavailable ? "outline" : "default"}
              disabled={booked || unavailable}
              onClick={() => setChecking(true)}
              aria-describedby={unavailable ? "vendor-unavailable" : undefined}
              aria-label={
                booked
                  ? `${vendor.name}, booked`
                  : unavailable
                    ? `Book ${vendor.name}: not available on your event date`
                    : `Book ${vendor.name}: check availability first`
              }
            >
              {booked ? "Booked" : "Book"}
            </Button>
            {unavailable && (
              <>
                <p id="vendor-unavailable" className="text-sm text-muted-foreground">
                  Not available on your event date
                </p>
                <button
                  type="button"
                  onClick={() => setChecking(true)}
                  className="min-h-11 text-sm underline underline-offset-4 hover:text-foreground"
                >
                  View calendar
                </button>
              </>
            )}
          </div>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <section aria-labelledby="about-heading" className="flex max-w-[65ch] flex-col gap-3">
          <h2 id="about-heading" className="font-display text-h2">
            About
          </h2>
          {/* Plain text; line breaks the vendor typed are kept. */}
          <p className="whitespace-pre-line text-muted-foreground [overflow-wrap:anywhere]">
            {vendor.about ?? "No description yet."}
          </p>
        </section>
      </Reveal>

      <Reveal delay={160}>
        <ContactSection vendorName={vendor.name} contact={contact} />
      </Reveal>

      <CheckAvailabilityDialog
        vendor={checking ? { id: vendor.id, name: vendor.name } : null}
        eventId={id}
        eventDate={event.date}
        onOpenChange={(open) => !open && setChecking(false)}
        onUnavailable={() => setTakenNow(true)}
        onBooked={() => setBookedNow(true)}
      />
    </div>
  );
}
