"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MissingCard, PlanBooking } from "@/lib/api/types";
import { capitalize, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CheckAvailabilityDialog } from "@/components/check-availability-dialog";

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
  eventDate,
  onBooked,
  onRemove,
  declinedVendorIds,
}: {
  card: MissingCard;
  eventId: string;
  /** The event's date ("YYYY-MM-DD"), for "Check availability". */
  eventDate: string;
  onBooked: (booking?: PlanBooking) => void;
  onRemove: (category: string) => void;
  /** Vendors with a declined booking on this event: shown with "Declined earlier". */
  declinedVendorIds?: ReadonlySet<string>;
}) {
  // Book opens "Check availability"; the booking is sent only from that dialog.
  const [checking, setChecking] = useState<{ id: string; name: string } | null>(null);
  const [leaving, setLeaving] = useState(false);
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

  const locked = leaving || checking !== null;

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
                    <Link
                      href={`/events/${eventId}/vendors/${v.id}`}
                      className="-my-3 min-w-0 py-3 font-medium [overflow-wrap:anywhere] underline-offset-4 hover:underline"
                    >
                      {v.name}
                    </Link>
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
                  onClick={() => setChecking({ id: v.id, name: v.name })}
                  aria-label={`Book ${v.name}: check availability first`}
                >
                  Book
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CheckAvailabilityDialog
        vendor={checking}
        eventId={eventId}
        eventDate={eventDate}
        onOpenChange={(open) => !open && setChecking(null)}
        onBooked={(booking) => {
          if (mounted.current) finish(booking);
        }}
      />
    </Card>
  );
}
