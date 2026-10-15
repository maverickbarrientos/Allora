"use client";

import type { PlanBooking, MissingResponse } from "@/lib/api/types";
import type { Load } from "@/lib/use-load";
import { ErrorState } from "@/components/error-state";
import { MissingCardView } from "@/components/missing-card";
import { Reveal } from "@/components/reveal";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * "What's missing" on the plan page. It renders the state of its own request,
 * so a slow or failed request never affects the plan's bookings.
 */
export function MissingSection({
  eventId,
  state,
  onRetry,
  onBooked,
  onRemove,
  declinedVendorIds,
}: {
  eventId: string;
  state: Load<MissingResponse>;
  onRetry: () => void;
  onBooked: (booking?: PlanBooking) => void;
  onRemove: (category: string) => void;
  declinedVendorIds?: ReadonlySet<string>;
}) {
  return (
    <section className="flex flex-col gap-6" aria-labelledby="missing-heading">
      <h2 id="missing-heading" tabIndex={-1} className="font-display text-h2">
        What&apos;s missing
      </h2>

      {state.status === "loading" && (
        <div role="status" aria-label="Loading suggestions" className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-[var(--radius)]" />
          <Skeleton className="hidden h-72 rounded-[var(--radius)] lg:block" />
        </div>
      )}

      {state.status === "error" &&
        (state.error.code === "event_not_found" ? (
          <Alert>Suggestions aren&apos;t available for this event.</Alert>
        ) : (
          <ErrorState
            error={state.error}
            onRetry={onRetry}
            message="Couldn't load suggestions. Please try again."
          />
        ))}

      {state.status === "loaded" && state.data.cards.length === 0 && (
        <Reveal className="max-w-md">
          <p className="font-display text-h2">
            Nothing missing: every service has a booking
          </p>
        </Reveal>
      )}

      {state.status === "loaded" && state.data.cards.length > 0 && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          {state.data.cards.map((card, i) => (
            <Reveal key={card.category} delay={Math.min(i, 3) * 80} className="min-w-0">
              <MissingCardView
                card={card}
                eventId={eventId}
                onBooked={onBooked}
                onRemove={onRemove}
                declinedVendorIds={declinedVendorIds}
              />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}
