"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import { deleteRule, deleteSummary } from "@/lib/event-delete";
import { eventName } from "@/lib/event-name";
import type { Event, PlanBooking } from "@/lib/api/types";
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
 * "Delete event" at the bottom of /events/[id]/edit (docs/SPEC-event-delete.md).
 * Whether the button is enabled is computed from the plan data only to explain
 * it; the database decides. `onRefresh` reloads the plan data after a 409.
 */
export function DeleteEventSection({
  event,
  bookings,
  onRefresh,
}: {
  event: Event;
  bookings: PlanBooking[];
  onRefresh: () => Promise<void>;
}) {
  const router = useRouter();
  const rule = deleteRule(event, bookings);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // After a 409 the dialog only explains; the refreshed section decides again.
  const [blocked, setBlocked] = useState(false);
  const inFlight = useRef(false);
  const alive = useRef(true);

  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // While the dialog is open: Tab and Shift+Tab cycle through its buttons
  // (the native dialog lets focus leave to the browser), and Escape does
  // nothing while the delete runs.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && inFlight.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key !== "Tab") return;
      const root = content.current;
      if (!root) return;
      const items = [...root.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]")];
      e.preventDefault();
      if (items.length === 0) {
        root.focus();
        return;
      }
      const at = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : at === -1 || at === items.length - 1 ? 0 : at + 1;
      items[next].focus();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  function openDialog() {
    if (!rule.allowed) return;
    setError(null);
    setBlocked(false);
    setOpen(true);
  }

  function close() {
    if (inFlight.current) return; // the dialog stays open while deleting
    setOpen(false);
    // Focus goes back to the button that opened the dialog.
    setTimeout(() => document.getElementById("delete-event-button")?.focus(), 0);
  }

  async function confirm() {
    if (inFlight.current || blocked) return;
    inFlight.current = true;
    setDeleting(true);
    setError(null);
    // The buttons are about to be disabled; keep focus inside the dialog.
    content.current?.focus();
    try {
      await api.deleteEvent(event.id);
      if (alive.current) router.replace("/events?deleted=1");
      return;
    } catch (err) {
      if (!alive.current) return;
      const { code, message } = toApiError(err);
      if (code === "event_not_found") {
        router.replace("/events"); // already gone
        return;
      }
      if (code === "forbidden") {
        router.replace("/vendor");
        return;
      }
      if (code === "event_has_pending_bookings" || code === "event_not_finished") {
        setError(`${message} Your plan has been refreshed.`);
        setBlocked(true);
        inFlight.current = false;
        setDeleting(false);
        await onRefresh();
        return;
      }
      setError("Couldn't delete the event. Check your connection and try again.");
    }
    inFlight.current = false;
    if (alive.current) setDeleting(false);
  }

  const name = eventName(event);

  return (
    <section aria-labelledby="delete-heading" className="flex flex-col items-start gap-4 border-t border-border pt-8">
      <h2 id="delete-heading" className="font-display text-h2 text-destructive">
        Delete event
      </h2>
      <p id="delete-reason" className="max-w-[65ch] text-sm text-muted-foreground">
        {rule.allowed
          ? "Deleting removes this event with its bookings, deposit records and service budgets. It can't be undone."
          : rule.reason}
      </p>
      <Button
        id="delete-event-button"
        type="button"
        variant="destructive"
        onClick={openDialog}
        aria-disabled={!rule.allowed}
        aria-describedby="delete-reason"
        className="aria-disabled:cursor-not-allowed aria-disabled:bg-ink-muted aria-disabled:text-ivory aria-disabled:hover:bg-ink-muted"
      >
        Delete event
      </Button>

      <AlertDialog open={open} onOpenChange={(next) => !next && close()}>
        <div ref={content} tabIndex={-1} className="outline-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="[overflow-wrap:anywhere]">Delete &ldquo;{name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the event and its {deleteSummary(bookings.length)}. It can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <Alert variant="destructive" className="mt-4">
              {error}
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={close} disabled={deleting}>
              {blocked ? "Close" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void confirm()}
              disabled={deleting || blocked}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleting ? "Deleting" : "Delete event"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialog>
    </section>
  );
}
