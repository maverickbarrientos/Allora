"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import type { BookingStatus, VendorBooking } from "@/lib/api/types";
import { capitalize, formatDate, formatNumber } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { useProfile } from "@/components/app-shell";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const SECTIONS: { status: BookingStatus; title: string }[] = [
  { status: "pending", title: "Pending" },
  { status: "confirmed", title: "Confirmed" },
  { status: "declined", title: "Declined" },
];

type Decision = { booking: VendorBooking; status: "confirmed" | "declined" };

export default function VendorPage() {
  const router = useRouter();
  const profile = useProfile();
  const isVendor = profile.role === "vendor";

  // Customer-role users belong on /.
  useEffect(() => {
    if (!isVendor) router.replace("/");
  }, [isVendor, router]);

  return isVendor ? <VendorBookings /> : null;
}

function VendorBookings() {
  const { state, setState, reload } = useLoad(() => api.listVendorBookings());
  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  async function decide({ booking, status }: Decision) {
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
      if (code === "already_decided") {
        setNotice("This booking was already decided.");
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
      return (
        <Reveal className="flex max-w-md flex-col items-start gap-4">
          <h1 className="font-display text-h1">Your account isn&apos;t linked to a service yet</h1>
          <p className="text-muted-foreground">
            Contact the Allora team and we&apos;ll connect your account to your service.
          </p>
        </Reveal>
      );
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
                    <li key={b.id}>
                      <Reveal delay={Math.min(s * 3 + i, 3) * 80}>
                        <BookingRow
                          booking={b}
                          busy={busy.has(b.id)}
                          onDecide={(st) => setPendingDecision({ booking: b, status: st })}
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
                {formatDate(pendingDecision.booking.event.date)}. This decision is final. You
                can&apos;t change it later.
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
    </div>
  );
}

function BookingRow({
  booking,
  busy,
  onDecide,
}: {
  booking: VendorBooking;
  busy: boolean;
  onDecide: (status: "confirmed" | "declined") => void;
}) {
  const { event } = booking;
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      {/* line 1: event type and status. line 2: category, date, guests. */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-display text-xl">{capitalize(event.type)}</span>
          <StatusBadge status={booking.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="label">{booking.category}</span> &middot; {formatDate(event.date)} &middot;{" "}
          {formatNumber(event.guestCount)} guests
        </p>
      </div>
      {booking.status === "pending" && (
        <div className="flex shrink-0 gap-3">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onDecide("declined")}>
            Decline
          </Button>
          <Button size="sm" disabled={busy} onClick={() => onDecide("confirmed")}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Accept
          </Button>
        </div>
      )}
    </div>
  );
}
