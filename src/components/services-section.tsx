import { capitalize } from "@/lib/format";
import type { Load } from "@/lib/use-load";
import type { EventService } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_TEXT: Record<"pending" | "confirmed" | "missing", string> = {
  confirmed: "Booked",
  pending: "Pending",
  missing: "Missing",
};

/**
 * "Services" on the plan: the event's own service list with a status for
 * each. Loads on its own, so the plan keeps working if this fails.
 */
export function ServicesSection({
  state,
  onRetry,
}: {
  state: Load<{ services: EventService[] }>;
  onRetry: () => void;
}) {
  return (
    <section className="flex flex-col gap-6" aria-labelledby="services-heading">
      <h2 id="services-heading" className="font-display text-h2">
        Services
      </h2>

      {state.status === "loading" && (
        <div role="status" aria-label="Loading services" className="flex flex-col gap-3">
          <Skeleton className="h-5 w-1/2 max-w-xs" />
          <Skeleton className="h-24" />
        </div>
      )}

      {state.status === "error" && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="text-sm text-muted-foreground">
            Couldn&apos;t load your services. The rest of the plan still works.
          </p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {state.status === "loaded" && (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {state.data.services.map((s) => {
            const key = s.status ?? "missing";
            return (
              <li key={s.category} className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 py-3">
                <span className="label">{capitalize(s.category)}</span>
                <span className={key === "missing" ? "text-sm text-muted-foreground" : "text-sm"}>
                  {STATUS_TEXT[key]}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
