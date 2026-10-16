"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import type { PaymentKind, PlanBooking, TestMethod } from "@/lib/api/types";
import { formatAmount } from "@/lib/format";
import { dueCents, fromCents, paysBalance, selectionTotals, type BatchPlan } from "@/lib/payments/totals";
import { SelectionBar } from "@/components/selection-bar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";

const KIND_LABEL: Record<PaymentKind, string> = { deposit: "Deposit", full: "Full amount", balance: "Balance" };

const radio =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-input px-4 py-2 text-sm has-[:checked]:border-forest has-[:checked]:ring-2 has-[:checked]:ring-forest has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:text-muted-foreground";

/**
 * The bar shown while bookings are ticked on the plan: how many, their total
 * price, what is due now, the Deposit / Pay in full choice and the Pay button
 * (docs/SPEC-bulk-payment.md). The amounts are a preview; the server sets them.
 */
export function PaySelectedBar({
  selected,
  plan,
  onPlanChange,
  onPay,
  onClear,
}: {
  selected: PlanBooking[];
  plan: BatchPlan;
  onPlanChange: (plan: BatchPlan) => void;
  onPay: () => void;
  onClear: () => void;
}) {
  const t = selectionTotals(selected, plan);
  return (
    <SelectionBar label="Pay selected bookings">
      <div aria-live="polite" className="flex min-w-0 flex-col gap-1">
        <p className="font-medium">
          {t.count} {t.count === 1 ? "booking" : "bookings"} selected
        </p>
        <p className="text-sm text-muted-foreground">
          Total price {formatAmount(fromCents(t.price))} &middot; Due now{" "}
          <span className="font-medium text-foreground">{formatAmount(fromCents(t.due))}</span>
        </p>
      </div>

      {t.canChoosePlan && (
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">What to pay now</legend>
          {(["deposit", "full"] as const).map((v) => (
            <label key={v} className={radio}>
              <input
                type="radio"
                name="batch-plan"
                value={v}
                checked={plan === v}
                onChange={() => onPlanChange(v)}
                className="h-4 w-4 accent-primary"
              />
              {v === "full" ? "Pay in full" : "Deposit"}
            </label>
          ))}
        </fieldset>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear
        </Button>
        <Button onClick={onPay}>Pay {formatAmount(fromCents(t.due))}</Button>
      </div>
    </SelectionBar>
  );
}

type Phase =
  | { kind: "form" }
  | { kind: "submitting" }
  | { kind: "declined" }
  | { kind: "error"; message: string }
  | { kind: "done"; lines: { bookingId: string; vendor: string; kind: PaymentKind; amount: number }[] };

const OUTCOMES: { value: TestMethod; label: string; hint: string }[] = [
  { value: "approve", label: "Approve", hint: "The demo payment succeeds." },
  { value: "decline", label: "Decline", hint: "The demo payment is declined." },
];

/**
 * Review and pay the ticked bookings with one request (all or nothing). On
 * success `onPaid` gets the updated bookings; a decline keeps everything so the
 * customer can retry; a refused booking is named in the error.
 */
export function PaySelectedDialog({
  open,
  eventId,
  selected,
  plan,
  onClose,
  onPaid,
  onStale,
}: {
  open: boolean;
  eventId: string;
  selected: PlanBooking[];
  plan: BatchPlan;
  onClose: () => void;
  onPaid: (bookings: PlanBooking[]) => void;
  /** The plan changed under the customer (409 or 404): refresh it. */
  onStale: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [method, setMethod] = useState<TestMethod>("approve");
  const inFlight = useRef(false);
  const t = selectionTotals(selected, plan);

  function close() {
    if (inFlight.current) return;
    onClose();
    // A fresh form next time; a finished payment is not shown again.
    setPhase({ kind: "form" });
  }

  async function pay() {
    if (inFlight.current || selected.length === 0) return; // a double click sends one request
    inFlight.current = true;
    setPhase({ kind: "submitting" });
    try {
      const { payments, bookings } = await api.payBookings(
        eventId,
        selected.map((b) => b.id),
        method,
        plan,
        fromCents(t.due),
      );
      const nameOf = new Map(bookings.map((b) => [b.id, b.vendorName]));
      setPhase({
        kind: "done",
        lines: payments.map((p) => ({
          bookingId: p.bookingId,
          vendor: nameOf.get(p.bookingId) ?? "Vendor",
          kind: p.kind,
          amount: p.amount,
        })),
      });
      onPaid(bookings);
    } catch (e) {
      const { status, code, message } = toApiError(e);
      if (status === 401) router.replace("/login");
      else if (status === 403) router.replace("/vendor");
      else if (code === "payment_declined") setPhase({ kind: "declined" });
      else if (status === 409 || code === "booking_not_found" || code === "event_not_found") {
        setPhase({ kind: "error", message: `${message} Nothing was paid.` });
        onStale();
      } else setPhase({ kind: "error", message: "Couldn't complete the payment. Nothing was recorded. Please try again." });
    } finally {
      inFlight.current = false;
    }
  }

  const submitting = phase.kind === "submitting";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent aria-describedby="pay-selected-description">
        {phase.kind === "done" ? (
          <>
            <DialogTitle className="font-display text-h2">Payment complete</DialogTitle>
            <DialogDescription id="pay-selected-description" className="text-sm text-muted-foreground">
              Paid {formatAmount(phase.lines.reduce((n, l) => n + l.amount, 0))} for {phase.lines.length}{" "}
              {phase.lines.length === 1 ? "booking" : "bookings"}. Demo payment: no real money was moved.
            </DialogDescription>
            <ul className="flex flex-col divide-y divide-border border-y border-border">
              {phase.lines.map((l) => (
                <li key={l.bookingId} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="font-medium">{l.vendor}</span>
                    <span className="text-muted-foreground"> &middot; {KIND_LABEL[l.kind]}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-4">
                    <span>{formatAmount(l.amount)}</span>
                    <Link
                      href={`/events/${encodeURIComponent(eventId)}/bookings/${encodeURIComponent(l.bookingId)}/receipt`}
                      className="-my-2 py-2 underline underline-offset-4 hover:text-muted-foreground"
                      aria-label={`Receipt for ${l.vendor}`}
                    >
                      Receipt
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogTitle className="font-display text-h2">Pay {t.count === 1 ? "this booking" : `${t.count} bookings`}</DialogTitle>
            <DialogDescription id="pay-selected-description" className="text-sm text-muted-foreground">
              One payment for everything below. If one of them can&apos;t be paid, none is.
            </DialogDescription>

            <ul className="flex flex-col divide-y divide-border border-y border-border">
              {selected.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="font-medium">{b.vendorName}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      &middot; {paysBalance(b) ? "Balance" : plan === "full" ? "Full amount" : "Deposit"}
                    </span>
                  </span>
                  <span className="shrink-0">{formatAmount(fromCents(dueCents(b, plan)))}</span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-4 py-3">
                <span className="label">Total now</span>
                <span className="font-display text-h2">{formatAmount(fromCents(t.due))}</span>
              </li>
            </ul>

            <Alert className="font-medium">Demo payment: no real money, do not enter card details</Alert>

            <fieldset className="flex flex-col gap-2" disabled={submitting}>
              <legend className="label mb-2">Test outcome</legend>
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                {OUTCOMES.map((o) => (
                  <label
                    key={o.value}
                    className="flex min-h-12 cursor-pointer flex-col gap-1 rounded-xl border border-input bg-ivory p-4 text-sm has-[:checked]:border-forest has-[:checked]:ring-2 has-[:checked]:ring-forest has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:disabled]:text-muted-foreground"
                  >
                    <input
                      type="radio"
                      name="batch-test-method"
                      value={o.value}
                      checked={method === o.value}
                      onChange={() => setMethod(o.value)}
                      className="sr-only"
                    />
                    <span className="font-medium">{o.label}</span>
                    <span className="text-xs text-muted-foreground">{o.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div aria-live="polite" className="empty:hidden">
              {phase.kind === "declined" && (
                <Alert variant="destructive">
                  <p className="font-medium">Payment declined</p>
                  Nothing was charged or recorded. You can try again.
                </Alert>
              )}
              {phase.kind === "error" && (
                <Alert variant="destructive">
                  <p className="font-medium">Couldn&apos;t complete the payment</p>
                  {phase.message}
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={pay} disabled={submitting || selected.length === 0}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Paying" : phase.kind === "declined" || phase.kind === "error" ? "Try again" : `Pay ${formatAmount(fromCents(t.due))}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
