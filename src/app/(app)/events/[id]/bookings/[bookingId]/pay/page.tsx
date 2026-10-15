"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import type { Payment, PlanBooking, TestMethod } from "@/lib/api/types";
import { formatAmount, formatTimestamp } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { useProfile } from "@/components/app-shell";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { eventName } from "@/lib/event-name";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Phase =
  | { kind: "form" }
  | { kind: "submitting" }
  | { kind: "declined" }
  | { kind: "error" }
  | { kind: "receipt"; payment: Payment }
  | { kind: "blocked"; code: "booking_not_confirmed" | "already_paid" }
  | { kind: "not_found" };

const OUTCOMES: { value: TestMethod; label: string; hint: string }[] = [
  { value: "approve", label: "Approve", hint: "The demo payment succeeds." },
  { value: "decline", label: "Decline", hint: "The demo payment is declined." },
];

export default function PayPage() {
  const router = useRouter();
  const profile = useProfile();
  const isVendor = profile.role === "vendor";

  // Vendor-role users have nothing to pay.
  useEffect(() => {
    if (isVendor) router.replace("/vendor");
  }, [isVendor, router]);

  return isVendor ? null : <Pay />;
}

function Pay() {
  const router = useRouter();
  const { id, bookingId } = useParams<{ id: string; bookingId: string }>();
  const { state, reload } = useLoad(() => api.getPlan(id));
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [method, setMethod] = useState<TestMethod>("approve");
  const inFlight = useRef(false);
  const resultRef = useRef<HTMLHeadingElement>(null);

  const planHref = `/events/${encodeURIComponent(id)}`;

  // Move focus to the result so keyboard and screen reader users hear it.
  useEffect(() => {
    if (phase.kind !== "form" && phase.kind !== "submitting") resultRef.current?.focus();
  }, [phase.kind]);

  async function pay() {
    if (inFlight.current) return; // a double click sends one request
    inFlight.current = true;
    setPhase({ kind: "submitting" });
    try {
      const { payment } = await api.payBooking(bookingId, method);
      setPhase({ kind: "receipt", payment });
    } catch (e) {
      const { status, code } = toApiError(e);
      if (status === 401) router.replace("/login");
      else if (status === 403) router.replace("/vendor");
      else if (code === "payment_declined") setPhase({ kind: "declined" });
      else if (code === "booking_not_confirmed" || code === "already_paid") setPhase({ kind: "blocked", code });
      else if (code === "booking_not_found") setPhase({ kind: "not_found" });
      else setPhase({ kind: "error" });
    } finally {
      inFlight.current = false;
    }
  }

  const back = (
    <Link
      href={planHref}
      className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Back to plan
    </Link>
  );

  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading" className="flex flex-col gap-10">
        {back}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-2/3 max-w-sm" />
        </div>
        <Skeleton className="h-16" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (state.status === "error") {
    if (state.error.code === "event_not_found") return <NotFound back={back} headingRef={resultRef} />;
    return (
      <div className="flex flex-col gap-10">
        {back}
        <ErrorState error={state.error} onRetry={reload} message="Couldn't load this booking. Please try again." />
      </div>
    );
  }

  const booking = state.data.bookings.find((b) => b.id === bookingId);
  if (!booking || phase.kind === "not_found") return <NotFound back={back} headingRef={resultRef} />;

  if (phase.kind === "receipt") {
    return (
      <Result back={back}>
        <Receipt
          headingRef={resultRef}
          booking={booking}
          amount={phase.payment.amount}
          date={phase.payment.createdAt}
          reference={phase.payment.reference}
          planHref={planHref}
        />
      </Result>
    );
  }

  // A reload of the receipt URL: the plan already says the deposit is paid.
  if (booking.payment?.status === "paid") {
    return (
      <Result back={back}>
        <Receipt
          headingRef={resultRef}
          booking={booking}
          amount={booking.payment.paidAmount}
          date={booking.payment.paidAt}
          planHref={planHref}
        />
      </Result>
    );
  }

  if (phase.kind === "blocked" || booking.status !== "confirmed") {
    const code = phase.kind === "blocked" ? phase.code : "booking_not_confirmed";
    return (
      <Result back={back}>
        <Blocked headingRef={resultRef} code={code} booking={booking} planHref={planHref} />
      </Result>
    );
  }

  const submitting = phase.kind === "submitting";
  const deposit = booking.payment?.depositAmount;

  return (
    <div className="flex flex-col gap-14 lg:gap-24">
      {back}
      <PageHeader label="Deposit" title="Pay deposit" description="Pay the deposit to secure this booking." />

      <div className="flex max-w-xl flex-col gap-8">
        <dl className="flex flex-col divide-y divide-border border-y border-border">
          <Row label="Event" value={state.status === "loaded" ? eventName(state.data.event) : ""} />
          <Row label="Vendor" value={booking.vendorName} />
          <Row label="Category" value={booking.category} />
          <Row label="Price" value={formatAmount(booking.price)} />
          <Row label="Deposit" value={deposit != null ? formatAmount(deposit) : "Shown on your receipt"} strong />
        </dl>

        {/* Always visible; there is no way to dismiss it. */}
        <Alert className="font-medium">Demo payment: no real money, do not enter card details</Alert>

        <fieldset className="flex flex-col gap-2" disabled={submitting}>
          <legend className="label mb-2">Test outcome</legend>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            {OUTCOMES.map((o) => (
              <label
                key={o.value}
                className="flex min-h-12 cursor-pointer flex-col gap-1 rounded-xl border border-input bg-ivory p-4 text-sm text-foreground has-[:checked]:border-forest has-[:checked]:ring-2 has-[:checked]:ring-forest has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:disabled]:text-ink-muted"
              >
                <input
                  type="radio"
                  name="testMethod"
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
              <h2 ref={resultRef} tabIndex={-1} className="font-medium outline-none">
                Payment declined
              </h2>
              Nothing was charged or recorded. You can try again.
            </Alert>
          )}
          {phase.kind === "error" && (
            <Alert variant="destructive">
              <h2 ref={resultRef} tabIndex={-1} className="font-medium outline-none">
                Couldn&apos;t complete the payment
              </h2>
              Nothing was recorded. Please try again.
            </Alert>
          )}
        </div>

        <Button className="w-full sm:w-fit" disabled={submitting} onClick={pay}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting
            ? "Paying"
            : phase.kind === "declined" || phase.kind === "error"
              ? "Try again"
              : deposit != null
                ? `Pay ${formatAmount(deposit)}`
                : "Pay deposit"}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-4 py-4">
      <dt className="label self-center">{label}</dt>
      <dd className={`min-w-0 wrap-anywhere ${strong ? "font-display text-h2" : ""}`}>{value}</dd>
    </div>
  );
}

function Result({ back, children }: { back: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-10">
      {back}
      <div className="max-w-xl">{children}</div>
    </div>
  );
}

type HeadingRef = React.RefObject<HTMLHeadingElement | null>;

function Receipt({
  headingRef,
  booking,
  amount,
  date,
  reference,
  planHref,
}: {
  headingRef: HeadingRef;
  booking: PlanBooking;
  amount: number | null;
  date: string | null;
  reference?: string;
  planHref: string;
}) {
  return (
    <Card>
      <CardHeader>
        <p className="label">Receipt</p>
        <CardTitle>
          <span ref={headingRef} tabIndex={-1} className="outline-none">
            Deposit paid
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <dl className="flex flex-col divide-y divide-border border-y border-border">
          <ReceiptRow label="Vendor" value={booking.vendorName} />
          {amount != null && <ReceiptRow label="Amount" value={formatAmount(amount)} />}
          {reference && <ReceiptRow label="Reference" value={reference} />}
          {date && <ReceiptRow label="Date" value={formatTimestamp(date)} />}
        </dl>
        <p className="text-sm">Demo payment. No real money was moved.</p>
        <Link href={planHref} className={buttonVariants({ className: "w-fit" })}>
          Back to plan
        </Link>
      </CardContent>
    </Card>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] gap-4 py-3">
      <dt className="label self-center">{label}</dt>
      <dd className="min-w-0 wrap-anywhere">{value}</dd>
    </div>
  );
}

function Blocked({
  headingRef,
  code,
  booking,
  planHref,
}: {
  headingRef: HeadingRef;
  code: "booking_not_confirmed" | "already_paid";
  booking: PlanBooking;
  planHref: string;
}) {
  const [title, body] =
    code === "already_paid"
      ? ["This deposit is already paid", "There's nothing more to pay for this booking."]
      : booking.status === "declined"
        ? ["This booking was declined", "Only a confirmed booking can be paid."]
        : booking.status === "pending"
          ? ["Waiting for the vendor", "You can pay the deposit once the vendor confirms this booking."]
          : ["This booking can't be paid yet", "Only a confirmed booking can be paid."];
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 ref={headingRef} tabIndex={-1} className="font-display text-h1 outline-none">
        {title}
      </h1>
      <p className="text-muted-foreground">{body}</p>
      <Link href={planHref} className={buttonVariants({ variant: "outline" })}>
        Back to plan
      </Link>
    </div>
  );
}

function NotFound({ back, headingRef }: { back: React.ReactNode; headingRef: HeadingRef }) {
  return (
    <div className="flex max-w-md flex-col items-start gap-6">
      {back}
      <p className="label">404</p>
      <h1 ref={headingRef} tabIndex={-1} className="font-display text-h1 outline-none">
        Booking not found
      </h1>
      <p className="text-muted-foreground">This booking doesn&apos;t exist, or it isn&apos;t yours.</p>
      <Link href="/events" className={buttonVariants({ variant: "outline" })}>
        Back to your events
      </Link>
    </div>
  );
}
