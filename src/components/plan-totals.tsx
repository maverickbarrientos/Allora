import type { PlanBooking } from "@/lib/api/types";
import { formatAmount } from "@/lib/format";
import { fromCents, planTotals } from "@/lib/payments/totals";

/**
 * Totals over the plan's bookings (docs/SPEC-bulk-payment.md): what is booked,
 * paid, still to pay on confirmed bookings, and waiting on vendors. Declined
 * and cancelled bookings are left out. Shown as text with labels, not colour.
 */
export function PlanTotals({ bookings }: { bookings: PlanBooking[] }) {
  const t = planTotals(bookings);
  const items = [
    { label: "Total booked", value: t.booked },
    { label: "Paid so far", value: t.paid },
    { label: "Left to pay", value: t.left },
    { label: "Waiting for vendors", value: t.waiting },
  ];
  return (
    <dl
      aria-label="Booking totals"
      className="grid grid-cols-2 gap-y-4 border-y border-border py-4 sm:grid-cols-4 sm:divide-x sm:divide-border"
    >
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-1 pr-4 sm:px-6 sm:first:pl-0">
          <dt className="label">{item.label}</dt>
          <dd className="font-display text-h2 [overflow-wrap:anywhere]">{formatAmount(fromCents(item.value))}</dd>
        </div>
      ))}
    </dl>
  );
}
