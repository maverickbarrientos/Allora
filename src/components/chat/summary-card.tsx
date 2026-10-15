import type { PlanSummary } from "@/lib/api/types";
import { formatAmount } from "@/lib/format";

const STATE_TEXT = {
  confirmed: "Confirmed",
  pending: "Pending",
  needs_replacement: "Needs a replacement",
  missing: "Not booked",
} as const;

function daysText(n: number) {
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  return n > 0 ? `In ${n} days` : `${-n} ${n === -1 ? "day" : "days"} ago`;
}

/** Plan overview computed by the server; every state is a word, not only a color. */
export function SummaryCard({ data }: { data: PlanSummary }) {
  const { counts } = data;
  return (
    <section aria-label="Plan summary" className="flex flex-col gap-3 border-y border-border py-3">
      <p className="text-sm text-muted-foreground">
        {daysText(data.daysUntilEvent)} · {counts.confirmed} confirmed, {counts.pending} pending, {counts.declined} declined
      </p>
      <p className="text-sm">
        Budget {formatAmount(data.budget)}, booked or pending {formatAmount(data.committed)},{" "}
        {data.remaining < 0 ? `over by ${formatAmount(-data.remaining)}` : `${formatAmount(data.remaining)} left`}
      </p>
      <ul role="list" className="flex flex-col divide-y divide-border">
        {data.rows.map((r) => (
          <li key={r.category} className="flex flex-col gap-0.5 py-2">
            <div className="flex flex-wrap justify-between gap-x-4">
              <span className="font-medium capitalize">{r.category}</span>
              <span className="text-sm">{STATE_TEXT[r.state]}</span>
            </div>
            {r.vendorName && (
              <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                {r.vendorName}, {formatAmount(r.amount)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
