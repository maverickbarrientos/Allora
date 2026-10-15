"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import type { MissingCard, PlanBooking } from "@/lib/api/types";
import { capitalize, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const FADE_MS = 300;

/** DOM id of a category's card, used by "See replacements" to scroll to and focus it. */
export const missingCardId = (category: string) => `missing-card-${category}`;

/**
 * One gap in the plan: why it matters, the suggested budget share and up to
 * three vendors. All API text is rendered as plain text.
 * `onBooked` runs after a booking (or a 409); `onRemove` runs once the card
 * has faded out, and the parent drops it without refetching the cards.
 */
export function MissingCardView({
  card,
  eventId,
  onBooked,
  onRemove,
  declinedVendorIds,
}: {
  card: MissingCard;
  eventId: string;
  onBooked: (booking?: PlanBooking) => void;
  onRemove: (category: string) => void;
  /** Vendors with a declined booking on this event: shown with "Declined earlier". */
  declinedVendorIds?: ReadonlySet<string>;
}) {
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const inFlight = useRef(false); // blocks a second click before the re-render
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  function finish(booking?: PlanBooking) {
    onBooked(booking);
    setLeaving(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(() => onRemove(card.category), reduced ? 0 : FADE_MS);
  }

  async function book(vendorId: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBookingId(vendorId);
    setError(null);
    try {
      const { booking } = await api.createBooking({ eventId, vendorId });
      if (mounted.current) finish(booking);
    } catch (e) {
      if (!mounted.current) return;
      const { code } = toApiError(e);
      if (code === "already_booked") finish();
      else
        setError(
          code === "forbidden"
            ? "Only customers can book vendors."
            : "Couldn't book this vendor. Please try again.",
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setBookingId(null);
    }
  }

  const locked = bookingId !== null || leaving;

  return (
    <Card
      id={missingCardId(card.category)}
      tabIndex={-1}
      className={cn(
        "min-w-0 transition-opacity duration-300",
        leaving && "pointer-events-none opacity-0",
      )}
    >
      <CardHeader className="gap-3">
        <p className="label">{card.category}</p>
        <h3 className="font-display text-h2 [overflow-wrap:anywhere]">
          {capitalize(card.category)}
        </h3>
        <p className="max-w-[65ch] text-muted-foreground [overflow-wrap:anywhere]">
          {card.whyItMatters}
        </p>
        <p className="flex items-baseline justify-between gap-4 border-y border-border py-3 text-sm">
          <span className="label">Suggested budget</span>
          <span className="font-medium">{formatNumber(card.budgetShare)}</span>
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            {error}
          </Alert>
        )}
        {card.vendors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No vendors close to this budget share.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {card.vendors.map((v) => (
              <li
                key={v.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="min-w-0 font-medium [overflow-wrap:anywhere]">
                      {v.name}
                    </span>
                    <span>{formatNumber(v.price)}</span>
                    <span className="text-sm text-muted-foreground">{v.matchPercent}% match</span>
                  </div>
                  {declinedVendorIds?.has(v.id) && (
                    <p className="mt-1 text-xs font-medium">Declined earlier</p>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {v.reason}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="w-full shrink-0 sm:w-auto"
                  disabled={locked}
                  onClick={() => book(v.id)}
                  aria-label={`Book ${v.name}`}
                >
                  {bookingId === v.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  {bookingId === v.id ? "Booking" : "Book"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
