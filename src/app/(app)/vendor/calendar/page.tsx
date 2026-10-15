"use client";

import { Suspense, useEffect, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";

/**
 * Vendor calendar (docs/SPEC-availability.md), read-only: confirmed and
 * pending bookings by event date, plus any blocked dates the API returns.
 * Blocking and unblocking are not offered: those endpoints aren't on main.
 * An optional `?month=YYYY-MM` opens that month (the dashboard links here).
 */
export default function VendorCalendarPage() {
  const router = useRouter();
  const profile = useProfile();
  const isVendor = profile.role === "vendor";

  // Customer-role users belong on /.
  useEffect(() => {
    if (!isVendor) router.replace("/");
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
  const [selected, setSelected] = useState<Ymd | null>(null);
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
    const state = loads[monthKey(next)];
    if (!state || state.status === "error") load(next);
  }

  const current = loads[monthKey(month)];
  const data = current?.status === "loaded" ? current.data : null;
  const { byDate, dayInfo } = calendarDays(data);
  const panel = selected ? (byDate.get(selected) ?? []) : [];

  return (
    <div className="flex flex-col gap-10 lg:gap-14">
      <PageHeader label="Vendor" title="Calendar" description="Your confirmed and pending bookings by event date." />

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
                selectedDate={selected}
                onDayClick={(date) => setSelected((s) => (s === date ? null : date))}
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
            <p className="text-sm text-muted-foreground">Blocking dates isn&apos;t available yet.</p>
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
