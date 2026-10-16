"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { api } from "@/lib/api/client";
import type { BookingReceipt } from "@/lib/api/types";
import { capitalize, formatAmount, formatDate, formatTimestamp } from "@/lib/format";
import { eventName } from "@/lib/event-name";
import { useLoad } from "@/lib/use-load";
import { ErrorState } from "@/components/error-state";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * A booking's receipt (docs/SPEC-booking-documents.md): the event, the
 * booking facts and the deposit, if one was paid or refunded. "Download PDF"
 * opens the browser's print dialog; the app shell and the buttons are hidden
 * in print, so only the receipt is printed.
 */
export default function ReceiptPage() {
  const { id, bookingId } = useParams<{ id: string; bookingId: string }>();
  const { state, reload } = useLoad(() => api.getBookingReceipt(bookingId));
  const planHref = `/events/${encodeURIComponent(id)}`;

  const back = (
    <Link
      href={planHref}
      className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground print:hidden"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Back to plan
    </Link>
  );

  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading receipt" className="flex max-w-2xl flex-col gap-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-3/4 max-w-sm" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (state.status === "error") {
    if (state.error.status === 404) return <NotFound back={back} />;
    return (
      <div className="flex flex-col gap-10">
        {back}
        <ErrorState error={state.error} onRetry={reload} message="Couldn't load this receipt. Please try again." />
      </div>
    );
  }

  const receipt = state.data.receipt;
  // A booking opened under another event's URL is treated as missing.
  if (receipt.event.id !== id) return <NotFound back={back} />;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        {back}
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" strokeWidth={1.5} /> Download PDF
        </Button>
      </div>
      <Receipt receipt={receipt} />
    </div>
  );
}

function Receipt({ receipt }: { receipt: BookingReceipt }) {
  const { event, vendor, deposit } = receipt;
  return (
    <Card className="print:border-0 print:shadow-none">
      <CardHeader>
        <p className="label">Booking receipt</p>
        <CardTitle>
          <h1 className="font-display text-h1 wrap-anywhere">{eventName(event)}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-8">
        <dl className="flex flex-col divide-y divide-border border-y border-border">
          <Row label="Event type" value={capitalize(event.type)} />
          <Row label="Event date" value={formatDate(event.date)} />
          <Row label="Guests" value={String(event.guestCount)} />
          <Row label="Vendor" value={vendor.name} />
          <Row label="Service" value={capitalize(receipt.category)} />
          <Row label="Price" value={formatAmount(vendor.price)} />
          <Row label="Status" value={<StatusBadge status={receipt.status} />} />
          <Row label="Booked on" value={formatTimestamp(receipt.bookedAt)} />
          <Row label="Reference" value={receipt.bookingId} />
        </dl>

        {deposit?.status === "paid" && (
          <p className="font-medium">
            {deposit.fullyPaid ? "Paid in full" : "Deposit paid"}: {deposit.amount != null ? formatAmount(deposit.amount) : ""}
            {deposit.paidAt && <> on {formatTimestamp(deposit.paidAt)}</>}
          </p>
        )}
        {deposit?.status === "refunded" && <p className="font-medium">Deposit refunded</p>}

        <p className="text-xs text-muted-foreground">
          The price is the vendor&apos;s current price. Deposits are demo payments; no real money was moved. Generated on{" "}
          {formatDate(new Date().toLocaleDateString("en-CA"))}.
        </p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-4 py-3 print:break-inside-avoid">
      <dt className="label self-center">{label}</dt>
      <dd className="min-w-0 wrap-anywhere">{value}</dd>
    </div>
  );
}

function NotFound({ back }: { back: React.ReactNode }) {
  return (
    <div className="flex max-w-md flex-col items-start gap-6">
      {back}
      <p className="label">404</p>
      <h1 className="font-display text-h1">Receipt not found</h1>
      <p className="text-muted-foreground">This booking doesn&apos;t exist, or it isn&apos;t yours.</p>
      <Link href="/events" className={buttonVariants({ variant: "outline" })}>
        Back to your events
      </Link>
    </div>
  );
}
