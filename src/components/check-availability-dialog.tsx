"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import type { PlanBooking } from "@/lib/api/types";
import { monthKey, monthOf, monthRange, type YearMonth, type Ymd } from "@/lib/dates";
import { MonthGrid } from "@/components/month-grid";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";

type MonthState = { status: "loading" } | { status: "loaded"; unavailable: Set<string> } | { status: "error" };
/** The vendor's terms (docs/SPEC-booking-documents.md); null when the vendor has none. */
type TermsState = { status: "loading" } | { status: "loaded"; terms: string | null } | { status: "error" };

/**
 * "Check availability" before booking (docs/SPEC-availability.md). Shows the
 * vendor's month with unavailable days marked, highlights the event's date,
 * and only sends the booking when the customer presses Confirm booking.
 * When the vendor has terms, the customer must tick "I agree" first; the
 * terms they read are sent with the booking so the database can check them.
 * Months are cached by key, so a late response for a month the customer has
 * already left never replaces the month on screen.
 */
type Props = {
  vendor: { id: string; name: string } | null;
  eventId: string;
  eventDate: Ymd;
  onOpenChange: (open: boolean) => void;
  onBooked: (booking: PlanBooking) => void;
};

export function CheckAvailabilityDialog(props: Props) {
  // Keyed by vendor: each vendor starts on the event's month with an empty cache.
  return props.vendor ? <AvailabilityDialog key={props.vendor.id} {...props} vendor={props.vendor} /> : null;
}

function AvailabilityDialog({ vendor, eventId, eventDate, onOpenChange, onBooked }: Props & { vendor: { id: string; name: string } }) {
  const [month, setMonth] = useState<YearMonth>(() => monthOf(eventDate));
  const [months, setMonths] = useState<Record<string, MonthState>>(() => ({ [monthKey(monthOf(eventDate))]: { status: "loading" } }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [terms, setTerms] = useState<TermsState>({ status: "loading" });
  const [agreed, setAgreed] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const vendorId = vendor.id;
  // The Book button that opened the dialog. The dialog unmounts on close, so
  // focus is handed back to it explicitly.
  const [opener] = useState<HTMLElement | null>(() => (typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null)));

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestAnimationFrame(() => {
        if (opener?.isConnected && !document.querySelector("[role=dialog]")) opener.focus();
      });
    };
  }, [opener]);

  /** Fetches one month into the cache (the caller sets its loading state). */
  const fetchMonth = useCallback(
    (ym: YearMonth) => {
      const key = monthKey(ym);
      const { from, to } = monthRange(ym);
      api
        .getVendorAvailability(vendorId, from, to)
        .then((r) => {
          if (mounted.current) setMonths((prev) => ({ ...prev, [key]: { status: "loaded", unavailable: new Set(r.unavailable) } }));
        })
        .catch(() => {
          if (mounted.current) setMonths((prev) => ({ ...prev, [key]: { status: "error" } }));
        });
    },
    [vendorId],
  );

  const fetchTerms = useCallback(() => {
    api
      .getVendor(vendorId)
      .then((r) => {
        if (mounted.current) setTerms({ status: "loaded", terms: r.vendor.terms });
      })
      .catch(() => {
        if (mounted.current) setTerms({ status: "error" });
      });
  }, [vendorId]);

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  function reloadTerms() {
    setTerms({ status: "loading" });
    setAgreed(false);
    fetchTerms();
  }

  function load(ym: YearMonth) {
    setMonths((prev) => ({ ...prev, [monthKey(ym)]: { status: "loading" } }));
    fetchMonth(ym);
  }

  // The event's month is marked loading in the initial state; fetch it once.
  useEffect(() => {
    fetchMonth(monthOf(eventDate));
  }, [fetchMonth, eventDate]);

  function changeMonth(next: YearMonth) {
    setMonth(next);
    const state = months[monthKey(next)];
    if (!state || state.status === "error") load(next);
  }

  const eventKey = monthKey(monthOf(eventDate));
  const eventMonth = months[eventKey];
  const visible = months[monthKey(month)];
  const eventAvailable = eventMonth?.status === "loaded" ? !eventMonth.unavailable.has(eventDate) : null;
  const vendorTerms = terms.status === "loaded" ? terms.terms : null;
  const termsReady = terms.status === "loaded" && (vendorTerms === null || agreed);
  const canConfirm = eventAvailable === true && termsReady;

  function retry() {
    load(monthOf(eventDate));
    if (monthKey(month) !== eventKey) load(month);
  }

  async function confirm() {
    if (inFlight.current || !canConfirm) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const { booking } = await api.createBooking({ eventId, vendorId, ...(vendorTerms !== null && { agreedTerms: vendorTerms }) });
      if (!mounted.current) return;
      onBooked(booking);
      onOpenChange(false);
    } catch (e) {
      if (!mounted.current) return;
      const { code } = toApiError(e);
      if (code === "vendor_unavailable") {
        setError(`${vendor.name} is no longer available on ${eventDate}.`);
        retry();
      } else if (code === "already_booked") {
        setError(`You already have a pending or confirmed booking with ${vendor.name} for this event.`);
        retry();
      } else if (code === "terms_changed") {
        setError(`${vendor.name} changed their terms. Read them again and tick "I agree" to book.`);
        reloadTerms();
      } else if (code === "terms_not_accepted") {
        setError(`${vendor.name} has terms now. Read them and tick "I agree" to book.`);
        reloadTerms();
      } else if (code === "forbidden") {
        setError("Only customers can book vendors.");
      } else {
        setError("Couldn't book this vendor. Please try again.");
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  const loadFailed = eventMonth?.status === "error" || visible?.status === "error";
  const statusLine =
    eventAvailable === true
      ? `Available on ${eventDate}`
      : eventAvailable === false
        ? `Unavailable on ${eventDate}`
        : eventMonth?.status === "error"
          ? `Couldn't check availability on ${eventDate}`
          : `Checking availability on ${eventDate}…`;

  return (
    <Dialog open onOpenChange={(o) => !submitting && onOpenChange(o)}>
      {(
        <DialogContent aria-describedby="availability-status">
          <div className="flex flex-col gap-1">
            <DialogTitle className="font-display text-h2">Check availability</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{vendor.name}</DialogDescription>
          </div>

          <p id="availability-status" role="status" className="font-medium">
            {statusLine}
          </p>

          {/* The grid and its month buttons stay on screen while a month loads. */}
          <MonthGrid
            month={month}
            onMonthChange={changeMonth}
            highlight={eventDate}
            dayInfo={(date) =>
              visible?.status === "loaded" && visible.unavailable.has(date) ? { label: "Unavailable", tone: "unavailable" } : {}
            }
          />
          {visible?.status === "loading" && (
            <p role="status" aria-label="Loading availability" className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading availability for this month
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Hatched days are unavailable. The outlined day is your event date. Bookings use the event&apos;s date.
          </p>

          {loadFailed && (
            <div className="flex flex-wrap items-center gap-3">
              <Alert variant="destructive" className="w-auto flex-1">
                Couldn&apos;t load availability.
              </Alert>
              <Button variant="outline" onClick={retry}>
                Retry
              </Button>
            </div>
          )}
          {terms.status === "loading" && (
            <p role="status" aria-label="Loading terms" className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading the vendor&apos;s terms
            </p>
          )}
          {terms.status === "error" && (
            <div className="flex flex-wrap items-center gap-3">
              <Alert variant="destructive" className="w-auto flex-1">
                Couldn&apos;t load the vendor&apos;s terms.
              </Alert>
              <Button variant="outline" onClick={reloadTerms}>
                Retry
              </Button>
            </div>
          )}
          {vendorTerms !== null && (
            <div className="flex flex-col gap-2">
              <p id="vendor-terms-heading" className="text-sm font-medium">
                Vendor&apos;s terms
              </p>
              {/* Focusable so keyboard users can scroll long terms. */}
              <div
                role="region"
                aria-labelledby="vendor-terms-heading"
                tabIndex={0}
                className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-input p-3 text-sm [overflow-wrap:anywhere] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {vendorTerms}
              </div>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm has-[:disabled]:cursor-not-allowed has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={agreed}
                  disabled={submitting}
                  onChange={(e) => {
                    setAgreed(e.target.checked);
                    setError(null);
                  }}
                />
                I agree to the vendor&apos;s terms
              </label>
            </div>
          )}
          {error && <Alert variant="destructive">{error}</Alert>}
          {eventAvailable === false && !error && (
            <p className="text-sm">This vendor can&apos;t be booked on your event date. Try another vendor for this service.</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={submitting || !canConfirm}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm booking
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
