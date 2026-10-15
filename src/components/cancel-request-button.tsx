"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import type { PlanBooking } from "@/lib/api/types";
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

/**
 * "Request cancellation" on a plan row (docs/SPEC-customer-cancel.md). Pending
 * and confirmed bookings get the button; an open request shows a note instead.
 * The vendor answers, so nothing is cancelled here.
 */
export function CancelRequestButton({
  booking,
  onRequested,
}: {
  booking: PlanBooking;
  onRequested: (booking: PlanBooking) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  if (booking.status === "cancel_requested") {
    return <p className="text-sm text-muted-foreground">Waiting for {booking.vendorName} to answer.</p>;
  }
  if (booking.status !== "pending" && booking.status !== "confirmed") return null;

  function close() {
    if (inFlight.current) return;
    setOpen(false);
    setError(null);
  }

  async function confirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { booking: updated } = await api.requestBookingCancellation(booking.id);
      if (!mounted.current) return;
      setOpen(false);
      onRequested(updated);
    } catch (e) {
      if (!mounted.current) return;
      const { code } = toApiError(e);
      setError(
        code === "already_requested"
          ? "You already asked to cancel this booking."
          : code === "not_cancellable"
            ? "This booking can't be cancelled anymore."
            : code === "booking_not_found"
              ? "This booking is no longer available."
              : "Couldn't send the request. Please try again.",
      );
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Request cancellation for ${booking.vendorName}`}
      >
        Request cancellation
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !next && close()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Ask to cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            {booking.vendorName} will be asked to approve it. Until they answer, the booking stays as it is.
            {booking.payment?.status === "paid" && " If they approve, your deposit is refunded."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={close} disabled={busy}>
            Keep booking
          </AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Request cancellation
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </>
  );
}
