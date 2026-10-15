import Link from "next/link";
import type { PlanBooking, VendorBooking } from "@/lib/api/types";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Payment line on a plan row (docs/SPEC-payment.md). Confirmed and unpaid:
 * "Pay deposit" with the amount. Pending and unpaid: the same link, outlined,
 * with a note; the pay page shows "Waiting for the vendor" and the server only
 * accepts a payment once the booking is confirmed. Paid: "Deposit paid" with
 * the amount. Refunded: "Deposit refunded". Declined, or no payment data on a
 * confirmed row: nothing.
 */
export function PlanPaymentLine({ booking, eventId }: { booking: PlanBooking; eventId: string }) {
  const p = booking.payment;
  const payHref = `/events/${encodeURIComponent(eventId)}/bookings/${encodeURIComponent(booking.id)}/pay`;
  if (booking.status === "pending" && p?.status !== "paid" && p?.status !== "refunded") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          href={payHref}
          className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-fit")}
          aria-label={`Pay deposit${p ? ` of ${formatAmount(p.depositAmount)}` : ""} for ${booking.vendorName}, available once the vendor confirms`}
        >
          Pay deposit{p && <> &middot; {formatAmount(p.depositAmount)}</>}
        </Link>
        <p className="text-sm text-muted-foreground">You can pay a deposit once the vendor confirms.</p>
      </div>
    );
  }
  if (!p) return null;
  if (p.status === "paid") {
    return (
      <p className="text-sm font-medium">
        Deposit paid{p.paidAmount != null && <> &middot; {formatAmount(p.paidAmount)}</>}
      </p>
    );
  }
  if (p.status === "refunded") return <p className="text-sm font-medium">Deposit refunded</p>;
  if (booking.status !== "confirmed") return null;
  return (
    <Link
      href={`/events/${encodeURIComponent(eventId)}/bookings/${encodeURIComponent(booking.id)}/pay`}
      className={cn(buttonVariants({ size: "sm" }), "w-fit")}
      aria-label={`Pay deposit of ${formatAmount(p.depositAmount)} for ${booking.vendorName}`}
    >
      Pay deposit &middot; {formatAmount(p.depositAmount)}
    </Link>
  );
}

const badge = "inline-flex items-center rounded-full border bg-ivory px-3 py-1 text-xs font-medium";

/**
 * Payment badge on a vendor portal row: "Awaiting deposit" (confirmed, unpaid),
 * "Deposit paid" with the amount, or "Refunded". Text, never colour alone.
 */
export function VendorPaymentBadge({ booking }: { booking: VendorBooking }) {
  const p = booking.payment;
  if (!p) return null;
  if (p.status === "paid") {
    return (
      <span className={cn(badge, "border-forest text-forest")}>
        Deposit paid{p.paidAmount != null && <> &middot; {formatAmount(p.paidAmount)}</>}
      </span>
    );
  }
  if (p.status === "refunded") return <span className={cn(badge, "border-foreground text-foreground")}>Refunded</span>;
  if (booking.status !== "confirmed") return null;
  return <span className={cn(badge, "border-brass text-brass-ink")}>Awaiting deposit</span>;
}
