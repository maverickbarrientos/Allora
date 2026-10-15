"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, toApiError, type ApiError } from "@/lib/api/client";
import type { VendorCalendar } from "@/lib/api/types";
import { capitalize } from "@/lib/format";
import { longDate, monthKey, monthOf, monthRange, parseMonthKey, todayYmd, type YearMonth, type Ymd } from "@/lib/dates";
import { calendarDays } from "@/lib/vendor-calendar";
import { useProfile } from "@/components/app-shell";
import { ErrorState } from "@/components/error-state";
import { MonthGrid, MonthGridLegend } from "@/components/month-grid";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Vendor calendar (docs/SPEC-availability.md): confirmed and pending bookings
 * by event date, and blocked dates. The vendor selects days (click or Space)
 * and blocks or unblocks them; days with a confirmed booking can't be blocked.
 * An optional `?month=YYYY-MM` opens that month (the dashboard links here).
 */
export default function VendorCalendarPage() {
  const router = useRouter();
  const profile = useProfile();
  const isVendor = profile.role === "vendor";

  // Customer-role users belong on /.
  useEffect(() => {
    if (!isVendor) router.replace("/dashboard");
  }, [isVendor, router]);

  return isVendor ? (
    <Suspense fallback={null}>
      <Calendar />
    </Suspense>
  ) : null;
}

type Load = { status: "loading" } | { status: "loaded"; data: VendorCalendar } | { status: "error"; error: ApiError };

function Calendar() {
  const router = useRouter();
  const params = useSearchParams();
  // The month to open on: ?month= when it's valid, otherwise this month. Read once.
  const [initial] = useState<YearMonth>(() => parseMonthKey(params.get("month")) ?? monthOf(todayYmd()));
  const [month, setMonth] = useState<YearMonth>(initial);
  const [loads, setLoads] = useState<Record<string, Load>>(() => ({ [monthKey(initial)]: { status: "loading" } }));
  // The day whose bookings the side panel shows, and the days picked for blocking or unblocking.
  const [selected, setSelected] = useState<Ymd | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<Ymd>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function fetchMonth(ym: YearMonth) {
    const key = monthKey(ym);
    const { from, to } = monthRange(ym);
    api
      .getVendorCalendar(from, to)
      .then((data) => mounted.current && setLoads((p) => ({ ...p, [key]: { status: "loaded", data } })))
      .catch((e) => {
        if (!mounted.current) return;
        const error = toApiError(e);
        if (error.code === "vendor_not_linked") router.replace("/vendor/profile");
        setLoads((p) => ({ ...p, [key]: { status: "error", error } }));
      });
  }
  function load(ym: YearMonth) {
    setLoads((p) => ({ ...p, [monthKey(ym)]: { status: "loading" } }));
    fetchMonth(ym);
  }

  // The first month is marked loading in the initial state; fetch it once.
  const first = useRef(false);
  useEffect(() => {
    if (first.current) return;
    first.current = true;
    fetchMonth(initial);
  });

  function changeMonth(next: YearMonth) {
    setMonth(next);
    setSelected(null);
    setNotice(null);
    const state = loads[monthKey(next)];
    if (!state || state.status === "error") load(next);
  }

  const current = loads[monthKey(month)];
  const data = current?.status === "loaded" ? current.data : null;
  const { byDate, dayInfo } = calendarDays(data);
  const panel = selected ? (byDate.get(selected) ?? []) : [];

  // Blocked and confirmed days across every month loaded so far, since a
  // selection can span months.
  const blockedDays = new Set<Ymd>();
  const confirmedDays = new Set<Ymd>();
  for (const state of Object.values(loads)) {
    if (state.status !== "loaded") continue;
    for (const d of state.data.blocked) blockedDays.add(d);
    for (const b of state.data.bookings) if (b.status === "confirmed") confirmedDays.add(b.date);
  }
  const toBlock = [...picked].filter((d) => !blockedDays.has(d)).sort();
  const toUnblock = [...picked].filter((d) => blockedDays.has(d)).sort();

  function onDayClick(date: Ymd) {
    setSelected(date);
    setNotice(null);
    // A day with a confirmed booking only shows its bookings; it can't be blocked.
    if (confirmedDays.has(date) && !blockedDays.has(date)) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  async function save(action: "block" | "unblock") {
    const dates = action === "block" ? toBlock : toUnblock;
    if (inFlight.current || dates.length === 0) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError(null);
    setNotice(null);
    try {
      const { changed } = action === "block" ? await api.blockDates(dates) : await api.unblockDates(dates);
      if (!mounted.current) return;
      setPicked(new Set());
      const n = changed.length;
      setNotice(`${action === "block" ? "Blocked" : "Unblocked"} ${n} ${n === 1 ? "day" : "days"}.`);
      // Blocked dates may sit in any loaded month: reload this one, forget the others.
      setLoads({ [monthKey(month)]: { status: "loading" } });
      fetchMonth(month);
    } catch (e) {
      if (!mounted.current) return;
      const error = toApiError(e);
      // The selection stays, so the vendor can adjust it and try again.
      if (error.code === "date_has_confirmed_booking") setSaveError(error.message);
      else if (error.code === "validation_error") setSaveError("Select between 1 and 62 days.");
      else setSaveError("Couldn't save your changes. Please try again.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-10 lg:gap-14">
      <PageHeader
        label="Vendor"
        title="Calendar"
        description="Your bookings by event date. Block the days you're not available, so customers can't book you on them."
      />

      {current?.status === "error" ? (
        <ErrorState error={current.error} onRetry={() => load(month)} message="Couldn't load your calendar. Please try again." />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-w-0 flex-col gap-4">
            {/* The grid and its month buttons stay on screen while a month loads. */}
            {(
              <MonthGrid
                month={month}
                onMonthChange={changeMonth}
                dayInfo={dayInfo}
                highlight={todayYmd()}
                highlightLabel="Today"
                selectedDates={picked}
                onDayClick={onDayClick}
                extraControls={
                  <Button variant="ghost" size="sm" onClick={() => changeMonth(monthOf(todayYmd()))}>
                    Today
                  </Button>
                }
              />
            )}
            {current?.status === "loading" && (
              <p role="status" aria-label="Loading calendar" className="text-sm text-muted-foreground">
                Loading bookings for this month…
              </p>
            )}
            <MonthGridLegend items={["confirmed", "pending", "blocked", "today"]} />
            <p className="text-sm text-muted-foreground">
              Select open days to block them, or blocked days to unblock them. Days with a confirmed booking can&apos;t be
              blocked.
            </p>
            {saveError && <Alert variant="destructive">{saveError}</Alert>}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void save("block")} disabled={saving || toBlock.length === 0}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Block selected ({toBlock.length})
              </Button>
              <Button variant="outline" onClick={() => void save("unblock")} disabled={saving || toUnblock.length === 0}>
                Unblock selected ({toUnblock.length})
              </Button>
              {picked.size > 0 && (
                <Button variant="ghost" onClick={() => setPicked(new Set())} disabled={saving}>
                  Clear selection
                </Button>
              )}
            </div>
            {notice && (
              <p role="status" className="text-sm text-muted-foreground">
                {notice}
              </p>
            )}
          </div>

          <aside aria-label="Bookings on the selected day" className="flex flex-col gap-3 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            {selected ? (
              <>
                <p className="font-medium">{longDate(selected)}</p>
                {panel.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bookings on this day.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {panel.map((b) => (
                      <li key={b.bookingId} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium" title={b.customerName}>
                            {b.customerName}
                          </p>
                          <p className="text-sm text-muted-foreground">{capitalize(b.eventType)}</p>
                        </div>
                        <StatusBadge status={b.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a day to see its bookings.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
