"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api/client";
import { useLoad } from "@/lib/use-load";
import { ErrorState } from "@/components/error-state";
import { EventCard } from "@/components/event-card";
import { PageHeader } from "@/components/page-header";
import { Reveal } from "@/components/reveal";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const createButton = (
  <Link href="/events/new" className={buttonVariants()}>
    Create event
  </Link>
);

/** `/` for customers: loading, empty, list, error. */
export function EventsList() {
  const { state, reload } = useLoad(() => api.listEvents());

  return (
    <div className="flex flex-col gap-10 lg:gap-16">
      <PageHeader label="Plans" title="Your events" action={createButton} />

      {state.status === "loading" && (
        <div
          role="status"
          aria-label="Loading"
          className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3"
        >
          <EventCardSkeleton />
          <EventCardSkeleton className="hidden sm:flex" />
          <EventCardSkeleton className="hidden xl:flex" />
        </div>
      )}

      {state.status === "error" && (
        <ErrorState
          error={state.error}
          onRetry={reload}
          message="Couldn't load your events. Please try again."
        />
      )}

      {state.status === "loaded" && state.data.events.length === 0 && (
        <Reveal className="flex max-w-md flex-col items-start gap-4">
          <h2 className="font-display text-h2">No events yet</h2>
          <p className="text-muted-foreground">
            Create your first event to start planning and booking vendors.
          </p>
          <Link href="/events/new" className={buttonVariants()}>
            Create event <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </Link>
        </Reveal>
      )}

      {state.status === "loaded" && state.data.events.length > 0 && (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {state.data.events.map((event, i) => (
            <Reveal key={event.id} delay={Math.min(i, 3) * 80}>
              <EventCard event={event} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

function EventCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={`surface-plum flex flex-col gap-2 ${className ?? ""}`}>
      <Skeleton className="aspect-[16/9] w-full" />
      <Skeleton className="h-7 w-2/5" />
      <div className="grid grid-cols-[1.4fr_1fr_0.8fr] gap-2 border-t border-border pt-2">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
    </div>
  );
}
