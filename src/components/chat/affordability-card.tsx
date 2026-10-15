import type { Affordability, Verdict } from "@/lib/api/types";
import { formatAmount } from "@/lib/format";

const VERDICT_TEXT: Record<Verdict, string> = {
  within_budget: "Within budget",
  tight: "Tight: little room left",
  cannot_cover_all: "The remaining services can't all fit, even at the lowest listed prices",
  over_budget: "Over budget",
};

/**
 * Budget numbers computed by the server. The verdict is written in words, and
 * each service says whether it is over or under its share in text.
 */
export function AffordabilityCard({ data }: { data: Affordability }) {
  return (
    <section aria-label="Budget check" className="flex flex-col gap-3 border-y border-border py-3">
      <p className="font-medium">{VERDICT_TEXT[data.verdict]}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Budget</dt>
        <dd className="text-right">{formatAmount(data.budget)}</dd>
        <dt className="text-muted-foreground">Booked or pending</dt>
        <dd className="text-right">{formatAmount(data.committed)}</dd>
        <dt className="text-muted-foreground">{data.remaining < 0 ? "Over by" : "Left"}</dt>
        <dd className="text-right">{formatAmount(Math.abs(data.remaining))}</dd>
        <dt className="text-muted-foreground">Lowest possible total</dt>
        <dd className="text-right">{formatAmount(data.projectedMinimum)}</dd>
      </dl>
      <ul role="list" className="flex flex-col divide-y divide-border text-sm">
        {data.rows.map((r) => (
          <li key={r.category} className="flex flex-wrap justify-between gap-x-4 py-2">
            <span className="font-medium capitalize">{r.category}</span>
            <span className="text-muted-foreground">
              {r.booked > 0
                ? `${formatAmount(r.booked)} of ${formatAmount(r.share)}${
                    r.difference < 0 ? `, over by ${formatAmount(-r.difference)}` : ""
                  }`
                : r.lowestPrice !== null
                  ? `Share ${formatAmount(r.share)}, lowest listed ${formatAmount(r.lowestPrice)}`
                  : `Share ${formatAmount(r.share)}, no vendors listed`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
