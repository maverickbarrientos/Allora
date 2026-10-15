"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import type { BookingStatus, VendorBooking } from "@/lib/api/types";
import { capitalize, formatDate, formatNumber } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { useProfile } from "@/components/app-shell";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { MessageLink } from "@/components/message-link";
import { VendorPaymentBadge } from "@/components/payment-status";
import { Reveal } from "@/components/reveal";
import { StatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const SECTIONS: { status: BookingStatus; title: string }[] = [
  { status: "pending", title: "Pending" },
  { status: "confirmed", title: "Confirmed" },
  { status: "declined", title: "Declined" },
];

type Decision = { booking: VendorBooking; status: "confirmed" | "declined" };

export default function VendorBookingsPage() {
  const router = useRouter();
  const profile = useProfile();
  const isVendor = profile.role === "vendor";

  // Customer-role users belong on /.
  useEffect(() => {
    if (!isVendor) router.replace("/dashboard");
  }, [isVendor, router]);

  return isVendor ? <VendorBookings /> : null;
}

function VendorBookings() {
  const router = useRouter();
  const { state, setState, reload } = useLoad(() => api.listVendorBookings());
  // Message links; the list works without them if this fails.
  const conversations = useLoad(() => api.getBookingConversations());
  const conversationOf = (bookingId: string) =>
    conversations.state.status === "loaded" ? conversations.state.data.bookings[bookingId] : undefined;
  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const decisionLock = useRef(false);

  // Cancelling a confirmed booking (docs/SPEC-cancellation.md). The dialog
  // stays open while the request runs and shows any error itself.
  const [cancelTarget, setCancelTarget] = useState<VendorBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const cancelInFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function closeCancel() {
    if (cancelInFlight.current) return;
    const id = cancelTarget?.id;
    setCancelTarget(null);
    setCancelError(null);
    // Give focus back to the row's Cancel booking button.
    if (id) requestAnimationFrame(() => document.getElementById(cancelButtonId(id))?.focus());
  }

  async function confirmCancel() {
    if (!cancelTarget || cancelInFlight.current) return;
    cancelInFlight.current = true;
    setCancelling(true);
    setCancelError(null);
    try {
      const { booking: updated } = await api.decideBooking(cancelTarget.id, "declined");
      if (!mounted.current) return;
      setState((prev) =>
        prev.status === "loaded"
          ? {
              status: "loaded",
              data: {
                ...prev.data,
                bookings: prev.data.bookings.map((b) => (b.id === updated.id ? updated : b)),
              },
            }
          : prev,
      );
      setCancelTarget(null);
    } catch (e) {
      if (!mounted.current) return;
      const { code } = toApiError(e);
      setCancelError(
        code === "status_unchanged"
          ? "This booking can't be cancelled anymore."
          : code === "booking_not_found"
            ? "This booking is no longer available."
            : code === "forbidden"
              ? "Only vendor accounts can cancel bookings."
              : "Couldn't cancel this booking. Please try again.",
      );
    } finally {
      cancelInFlight.current = false;
      if (mounted.current) setCancelling(false);
    }
  }
  useEffect(() => {
    if (state.status === "error" && state.error.code === "vendor_not_linked") {
      router.replace("/vendor/profile");
    }
  }, [router, state]);

  // Rows only exist once the list has loaded, so the browser can't follow a
  // #booking-{id} link by itself. Scroll to the row after the first load.
  const scrolledToHash = useRef(false);
  useEffect(() => {
    if (state.status !== "loaded" || scrolledToHash.current) return;
    scrolledToHash.current = true;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [state.status]);

  async function decide({ booking, status }: Decision) {
    if (decisionLock.current) return;
    decisionLock.current = true;
    setPendingDecision(null);
    setNotice(null);
    setBusy((s) => new Set(s).add(booking.id));
    try {
      const { booking: updated } = await api.decideBooking(booking.id, status);
      setState((prev) =>
        prev.status === "loaded"
          ? {
              status: "loaded",
              data: {
                ...prev.data,
                bookings: prev.data.bookings.map((b) => (b.id === updated.id ? updated : b)),
              },
            }
          : prev,
      );
    } catch (e) {
      const { code } = toApiError(e);
      if (code === "status_unchanged") {
        setNotice("This booking already has that status.");
        reload();
      } else if (code === "conflicting_booking") {
        setNotice("Another active booking exists for this event. The list has been refreshed.");
        reload();
      } else if (code === "booking_not_found") {
        setNotice("This booking is no longer available.");
        reload();
      } else {
        setNotice("Couldn't update this booking. Please try again.");
      }
    } finally {
      setBusy((s) => {
        const next = new Set(s);
        next.delete(booking.id);
        return next;
      });
      decisionLock.current = false;
    }
  }

  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading" className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-2/3 max-w-sm" />
        </div>
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }

  if (state.status === "error") {
    if (state.error.code === "vendor_not_linked") {
      return null;
    }
    return (
      <ErrorState
        error={state.error}
        onRetry={reload}
        message="Couldn't load your bookings. Please try again."
      />
    );
  }

  const { vendor, bookings } = state.data;

  return (
    <div className="flex flex-col gap-10 lg:gap-16">
      <PageHeader
        label={capitalize(vendor.category)}
        title={vendor.name}
        description="Booking requests addressed to you."
      />

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="label">Your service</p>
          <p className="mt-1 truncate font-display text-xl">{vendor.name}</p>
          <p className="text-sm text-muted-foreground">
            {capitalize(vendor.category)} <span aria-hidden="true">·</span> {formatNumber(vendor.price)}
          </p>
        </div>
        <Link href="/vendor/profile" className={buttonVariants({ variant: "outline" })}>
          Edit profile
        </Link>
      </Card>

      {notice && <Alert variant="destructive">{notice}</Alert>}

      {bookings.length === 0 ? (
        <Reveal delay={400} className="flex max-w-md flex-col gap-2">
          <p className="font-display text-h2">No bookings yet</p>
          <p className="text-muted-foreground">
            Requests from customers will appear here.
          </p>
        </Reveal>
      ) : (
        SECTIONS.map(({ status, title }, s) => {
          const rows = bookings.filter((b) => b.status === status);
          return (
            <section key={status} className="flex flex-col gap-4" aria-labelledby={`h-${status}`}>
              <h2 id={`h-${status}`} className="font-display text-h2">
                {title} <span className="text-muted-foreground">({rows.length})</span>
              </h2>
              {rows.length === 0 ? (
                <p className="border-y border-border py-5 text-muted-foreground">None.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border border-y border-border">
                  {rows.map((b, i) => (
                    <li key={b.id} id={`booking-${b.id}`} className="scroll-mt-20">
                      <Reveal delay={Math.min(s * 3 + i, 3) * 80}>
                        <BookingRow
                          booking={b}
                          messageHref={conversationOf(b.id) && `/vendor/messages/${conversationOf(b.id)!.conversationId}`}
                          busy={busy.has(b.id)}
                          onDecide={(st) => setPendingDecision({ booking: b, status: st })}
                          onCancel={() => {
                            setCancelError(null);
                            setCancelTarget(b);
                          }}
                        />
                      </Reveal>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}

      <AlertDialog
        open={pendingDecision !== null}
        onOpenChange={(open) => !open && setPendingDecision(null)}
      >
        {pendingDecision && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingDecision.status === "confirmed" ? "Accept" : "Decline"} this booking?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {capitalize(pendingDecision.booking.event.type)} on{" "}
                {formatDate(pendingDecision.booking.event.date)}. The customer will see this
                change on their event plan.
                {pendingDecision.status === "declined" &&
                  pendingDecision.booking.payment?.status === "paid" &&
                  " The customer's deposit will be refunded."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingDecision(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => decide(pendingDecision)}>
                {pendingDecision.status === "confirmed" ? "Accept" : "Decline"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialog>

      <AlertDialog open={cancelTarget !== null} onOpenChange={(open) => !open && closeCancel()}>
        {cancelTarget && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
              <AlertDialogDescription>
                The customer will be asked to find a replacement.
                {cancelTarget.payment?.status === "paid" && " The customer's deposit will be refunded."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {cancelError && (
              <Alert variant="destructive" className="mt-4">
                {cancelError}
              </Alert>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel onClick={closeCancel} disabled={cancelling}>
                Keep booking
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmCancel} disabled={cancelling}>
                {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                Cancel booking
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialog>
    </div>
  );
}

const cancelButtonId = (bookingId: string) => `cancel-${bookingId}`;

function BookingRow({
  booking,
  messageHref,
  busy,
  onDecide,
  onCancel,
}: {
  booking: VendorBooking;
  /** The conversation with this customer, once it has loaded. */
  messageHref?: string;
  busy: boolean;
  onDecide: (status: "confirmed" | "declined") => void;
  onCancel: () => void;
}) {
  const { event } = booking;
  return (
    <div className="grid min-w-0 gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 sm:col-span-2">
        <span className="min-w-0 max-w-full truncate font-medium" title={booking.customerName}>
          {booking.customerName}
        </span>
        <span className="font-display text-xl">{capitalize(event.type)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-self-end">
        <StatusBadge status={booking.status} />
        <VendorPaymentBadge booking={booking} />
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:col-span-2">
        <span className="label">{booking.category}</span>
        <span>{formatDate(event.date)}</span>
        <span>{formatNumber(event.guestCount)} guests</span>
        <span className="inline-flex items-center gap-1">
          <span className="label">Budget</span>
          {formatNumber(event.budget)}
        </span>
      </div>
      {booking.status === "pending" ? (
        <div className="col-span-2 flex gap-3 lg:col-span-1">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onDecide("declined")}>
            Decline
          </Button>
          <Button size="sm" disabled={busy} onClick={() => onDecide("confirmed")}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Accept
          </Button>
          {messageHref && <MessageLink href={messageHref} name={booking.customerName} />}
        </div>
      ) : booking.status === "confirmed" ? (
        <div className="col-span-2 flex gap-3 lg:col-span-1">
          <Button id={cancelButtonId(booking.id)} variant="outline" size="sm" disabled={busy} onClick={onCancel}>
            Cancel booking
          </Button>
          {messageHref && <MessageLink href={messageHref} name={booking.customerName} />}
        </div>
      ) : (
        <div className="col-span-2 flex gap-3 lg:col-span-1">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onDecide("confirmed")}>
            Accept instead
          </Button>
          {messageHref && <MessageLink href={messageHref} name={booking.customerName} />}
        </div>
      )}
    </div>
  );
}
