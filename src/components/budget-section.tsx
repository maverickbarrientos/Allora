import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { toCents } from "@/lib/amount";
import { capitalize, formatAmount } from "@/lib/format";
import type { Load } from "@/lib/use-load";
import type { BudgetSummary, ServiceBudget } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** The set budget, or the suggested share when none is set. */
export const budgetLimit = (b: ServiceBudget) => b.amount ?? b.share;

/** How much the booked total is above the limit, in whole cents (0 if not above). */
export const overByCents = (booked: number, limit: number) => Math.max(0, toCents(booked) - toCents(limit));

/**
 * "Budget by service" on the plan. Loads on its own, so the plan keeps
 * working if this fails.
 */
export function BudgetSection({
  eventId,
  state,
  onRetry,
}: {
  eventId: string;
  state: Load<BudgetSummary>;
  onRetry: () => void;
}) {
  const setLink = (
    <Link
      href={`/events/${eventId}/budgets`}
      className="inline-flex min-h-11 items-center gap-2 text-sm underline-offset-4 hover:underline"
    >
      Set budgets <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
    </Link>
  );

  return (
    <section className="flex flex-col gap-6" aria-labelledby="budgets-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="budgets-heading" className="font-display text-h2">
          Budget by service
        </h2>
        {setLink}
      </div>

      {state.status === "loading" && (
        <div role="status" aria-label="Loading budgets" className="flex flex-col gap-3">
          <Skeleton className="h-5 w-1/2 max-w-xs" />
          <Skeleton className="h-24" />
        </div>
      )}

      {state.status === "error" && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="text-sm text-muted-foreground">
            Couldn&apos;t load your service budgets. The rest of the plan still works.
          </p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {state.status === "loaded" && <BudgetRows summary={state.data} />}
    </section>
  );
}

function BudgetRows({ summary }: { summary: BudgetSummary }) {
  const { eventBudget, allocated, budgets } = summary;
  const left = (toCents(eventBudget) - toCents(allocated)) / 100;

  return (
    <>
      <p className="text-muted-foreground wrap-anywhere">
        {allocated > 0
          ? `${formatAmount(allocated)} of ${formatAmount(eventBudget)} set aside · ${formatAmount(left)} not set aside`
          : "No service budgets set yet, so suggested shares of your budget are shown."}
      </p>
      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {budgets.map((b) => {
          const over = overByCents(b.booked, budgetLimit(b));
          return (
            <li
              key={b.category}
              className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 py-3 sm:grid-cols-[9rem_1fr_auto]"
            >
              <span className="label col-span-2 sm:col-span-1">{capitalize(b.category)}</span>
              <span className="min-w-0 wrap-anywhere">
                {b.amount !== null ? (
                  <>Budget {formatAmount(b.amount)}</>
                ) : (
                  <span className="text-muted-foreground">Suggested {formatAmount(b.share)}</span>
                )}
              </span>
              <span className="text-right text-sm text-muted-foreground wrap-anywhere">
                Booked {formatAmount(b.booked)}
              </span>
              {over > 0 && (
                <span className="col-span-2 text-sm text-destructive sm:col-start-2">
                  Booked total is {formatAmount(over / 100)} over this {b.amount !== null ? "budget" : "suggested share"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
