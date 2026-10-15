"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import type { PaymentStatus, VendorBooking, VendorCalendar } from "@/lib/api/types";
import {
  addMonths,
  daysFrom,
  formatYmd,
  monthKey,
  monthLabel,
  monthOf,
  monthRange,
  parseMonthKey,
  relativeDayText,
  todayYmd,
  type YearMonth,
} from "@/lib/dates";
import { capitalize, formatNumber } from "@/lib/format";
import { useLoad, type Load } from "@/lib/use-load";
import { calendarDays } from "@/lib/vendor-calendar";
import { useProfile } from "@/components/app-shell";
import { ErrorState } from "@/components/error-state";
import { MonthGrid, MonthGridLegend } from "@/components/month-grid";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Vendor dashboard (docs/SPEC-vendor-dashboard.md): one month at a time, kept
 * in `?month=YYYY-MM`. Bookings come from GET /api/vendor/bookings (loaded
 * once, filtered by the month of the event date); the mini grid comes from
 * GET /api/vendor/availability for the month, like /vendor/calendar.
 */
export default function VendorDashboardPage() {
  const router = useRouter();
  const profile = useProfile();
  const isVendor = profile.role === "vendor";

  // Customer-role users belong on /.
  useEffect(() => {
    if (!isVendor) router.replace("/dashboard");
  }, [isVendor, router]);

  if (!isVendor) return null;
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <VendorDashboard />
    </Suspense>
  );
}

const byEventDate = (a: VendorBooking, b: VendorBooking) =>
  a.event.date.localeCompare(b.event.date) || a.createdAt.localeCompare(b.createdAt);

function VendorDashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const today = todayYmd();
  const thisMonth = monthOf(today);
  // An invalid or missing ?month= falls back to this month.
  const month = parseMonthKey(params.get("month")) ?? thisMonth;
  const key = monthKey(month);
  const go = (next: YearMonth) => router.push(`/vendor?month=${monthKey(next)}`, { scroll: false });

  const bookings = useLoad(() => api.listVendorBookings());
  useEffect(() => {
    if (bookings.state.status === "error" && bookings.state.error.code === "vendor_not_linked") router.replace("/vendor/profile");
  }, [bookings.state, router]);

  // The month's calendar. Only the latest request may update the page, so
  // fast month switching never shows another month's days; `cal.key` says
  // which month the state belongs to, and any other month reads as loading.
  const [cal, setCal] = useState<{ key: string | null; state: Load<VendorCalendar> }>({ key: null, state: { status: "loading" } });
  const latest = useRef(0);
  const fetchCal = useCallback(
    (k: string) => {
      const req = ++latest.current;
      const { from, to } = monthRange(parseMonthKey(k)!);
      api
        .getVendorCalendar(from, to)
        .then((data) => req === latest.current && setCal({ key: k, state: { status: "loaded", data } }))
        .catch((e) => {
          if (req !== latest.current) return;
          const error = toApiError(e);
          if (error.code === "vendor_not_linked") router.replace("/vendor/profile");
          setCal({ key: k, state: { status: "error", error } });
        });
    },
    [router],
  );
  useEffect(() => {
    fetchCal(key);
  }, [key, fetchCal]);
  useEffect(
    () => () => {
      latest.current = -1; // ignore responses after leaving the page
    },
    [],
  );
  const calState: Load<VendorCalendar> = cal.key === key ? cal.state : { status: "loading" };
  const retryCal = () => {
    setCal({ key, state: { status: "loading" } });
    fetchCal(key);
  };

  // Without the availability route (a 404), the grid falls back to the
  // bookings list and leaves out blocked days, without showing an error.
  const noCalendarRoute = calState.status === "error" && calState.error.status === 404;
  const glanceState: Load<VendorCalendar> = !noCalendarRoute
    ? calState
    : bookings.state.status === "loaded"
      ? { status: "loaded", data: calendarFromBookings(inMonth(bookings.state.data.bookings, key), month) }
      : bookings.state;

  const vendor = bookings.state.status === "loaded" ? bookings.state.data.vendor : null;
  const label = monthLabel(month);

  return (
    <div className="flex flex-col gap-10 lg:gap-14">
      <PageHeader
        label="Dashboard"
        title={vendor?.name ?? "Your month"}
        description="One month at a time: requests to answer, confirmed bookings and the days you're booked."
      />

      <MonthPicker month={month} isThisMonth={key === monthKey(thisMonth)} onChange={go} thisMonth={thisMonth} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Bookings" state={bookings.state} onRetry={bookings.reload} skeleton={<Skeleton className="h-20 w-full" />}>
          {(d) => <Counts bookings={inMonth(d.bookings, key)} />}
        </Section>
        <Section title="Actions needed" state={bookings.state} onRetry={bookings.reload} skeleton={<Rows />}>
          {(d) => <Actions bookings={inMonth(d.bookings, key)} />}
        </Section>
        <Section title="Confirmed this month" state={bookings.state} onRetry={bookings.reload} skeleton={<Rows />}>
          {(d) => <Confirmed bookings={inMonth(d.bookings, key)} today={today} monthText={label} />}
        </Section>
        <Section
          title="Month at a glance"
          state={glanceState}
          onRetry={noCalendarRoute ? bookings.reload : retryCal}
          skeleton={<Skeleton className="h-64 w-full" />}
          footer={
            <Link href={`/vendor/calendar?month=${key}`} className="flex min-h-11 w-fit items-center gap-2 text-sm font-medium underline-offset-4 hover:underline">
              Open calendar
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          }
        >
          {(data) => <Glance month={month} data={data} today={today} showBlocked={!noCalendarRoute} />}
        </Section>
      </div>
    </div>
  );
}

/** The month's calendar built from the bookings list: pending and confirmed bookings, no blocked days. */
function calendarFromBookings(bookings: VendorBooking[], month: YearMonth): VendorCalendar {
  const { from, to } = monthRange(month);
  return {
    from,
    to,
    blocked: [],
    bookings: bookings.flatMap((b) =>
      b.status === "declined" ? [] : [{ bookingId: b.id, date: b.event.date, status: b.status, eventType: b.event.type, customerName: b.customerName }],
    ),
  };
}

/** Bookings whose event date falls in the month `key` ("YYYY-MM"). */
function inMonth(bookings: VendorBooking[], key: string) {
  return bookings.filter((b) => monthKey(monthOf(b.event.date)) === key);
}

function MonthPicker({
  month,
  thisMonth,
  isThisMonth,
  onChange,
}: {
  month: YearMonth;
  thisMonth: YearMonth;
  isThisMonth: boolean;
  onChange: (next: YearMonth) => void;
}) {
  return (
    <nav aria-label="Month" className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" size="icon" onClick={() => onChange(addMonths(month, -1))} aria-label={`Previous month, ${monthLabel(addMonths(month, -1))}`}>
        <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
      </Button>
      <h2 className="min-w-44 text-center font-display text-h2" aria-live="polite">
        {monthLabel(month)}
      </h2>
      <Button variant="ghost" size="icon" onClick={() => onChange(addMonths(month, 1))} aria-label={`Next month, ${monthLabel(addMonths(month, 1))}`}>
        <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
      </Button>
      <Button variant="outline" size="sm" onClick={() => onChange(thisMonth)} disabled={isThisMonth}>
        This month
      </Button>
    </nav>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-6">
      <Skeleton className="h-12 w-full max-w-sm" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}

function Rows() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-2/3" />
    </div>
  );
}

/** A dashboard section with its own loading and error state; a failure never hides the other sections. */
function Section<T>({
  title,
  state,
  onRetry,
  skeleton,
  footer,
  children,
}: {
  title: string;
  state: Load<T>;
  onRetry: () => void;
  skeleton: React.ReactNode;
  footer?: React.ReactNode;
  children: (data: T) => React.ReactNode;
}) {
  const id = `section-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <Card className="flex min-w-0 flex-col gap-4" aria-labelledby={id}>
      <h2 id={id} className="font-display text-h2">
        {title}
      </h2>
      {state.status === "loading" ? (
        <div role="status" aria-label={`Loading ${title.toLowerCase()}`}>
          {skeleton}
        </div>
      ) : state.status === "error" ? (
        state.error.code === "vendor_not_linked" ? null : (
          <ErrorState error={state.error} onRetry={onRetry} message={`Couldn't load ${title.toLowerCase()}. Please try again.`} />
        )
      ) : (
        children(state.data)
      )}
      {footer}
    </Card>
  );
}

function Counts({ bookings }: { bookings: VendorBooking[] }) {
  const items: [string, number][] = [
    ["Pending", bookings.filter((b) => b.status === "pending").length],
    ["Confirmed", bookings.filter((b) => b.status === "confirmed").length],
    ["Declined", bookings.filter((b) => b.status === "declined").length],
  ];
  return (
    <dl className="grid grid-cols-3 divide-x divide-border">
      {items.map(([label, n]) => (
        <div key={label} className="flex flex-col gap-1 px-3 first:pl-0">
          <dt className="label">{label}</dt>
          <dd className="font-display text-h1">{formatNumber(n)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A customer name inside a sentence: truncated, with the full name in the title. */
function Name({ name }: { name: string }) {
  return (
    <span className="inline-block max-w-48 truncate align-bottom font-medium" title={name}>
      {name}
    </span>
  );
}

function Actions({ bookings }: { bookings: VendorBooking[] }) {
  const respond = bookings.filter((b) => b.status === "pending").sort(byEventDate);
  // Without the payment field there is no deposit status, so no deposit actions.
  const deposit = bookings.filter((b) => b.status === "confirmed" && b.payment && b.payment.status !== "paid").sort(byEventDate);
  if (respond.length + deposit.length === 0) return <p className="text-muted-foreground">Nothing needs your attention</p>;
  const row = (b: VendorBooking, text: React.ReactNode) => (
    <li key={b.id}>
      <Link href={`/vendor/bookings#booking-${encodeURIComponent(b.id)}`} className="flex min-h-11 items-center justify-between gap-3 py-2 hover:underline">
        <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
        <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      </Link>
    </li>
  );
  return (
    <ul className="flex flex-col divide-y divide-border">
      {respond.map((b) =>
        row(
          b,
          <>
            Respond to <Name name={b.customerName} />
            &apos;s {b.event.type} booking on {formatYmd(b.event.date)}
          </>,
        ),
      )}
      {deposit.map((b) =>
        row(
          b,
          <>
            Awaiting deposit from <Name name={b.customerName} /> ({formatYmd(b.event.date)})
          </>,
        ),
      )}
    </ul>
  );
}

const DEPOSIT_TEXT: Record<PaymentStatus, string> = {
  paid: "Deposit paid",
  unpaid: "Awaiting deposit",
  refunded: "Deposit refunded",
};

function Confirmed({ bookings, today, monthText }: { bookings: VendorBooking[]; today: string; monthText: string }) {
  const confirmed = bookings.filter((b) => b.status === "confirmed").sort(byEventDate);
  if (confirmed.length === 0) {
    return <p className="text-muted-foreground">{bookings.length === 0 ? `No bookings in ${monthText}` : `No confirmed bookings in ${monthText}`}</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {confirmed.map((b) => (
        <li key={b.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium" title={b.customerName}>
              {b.customerName}
            </p>
            <p className="text-sm text-muted-foreground">
              {capitalize(b.event.type)} &middot; {formatYmd(b.event.date)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-medium">{relativeDayText(daysFrom(today, b.event.date))}</p>
            {b.payment && <p className="text-sm text-muted-foreground">{DEPOSIT_TEXT[b.payment.status]}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

const plural = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`;

function Glance({ month, data, today, showBlocked }: { month: YearMonth; data: VendorCalendar; today: string; showBlocked: boolean }) {
  const { dayInfo, counts } = calendarDays(data);
  return (
    <div className="flex flex-col gap-4">
      <MonthGrid month={month} dayInfo={dayInfo} highlight={today} highlightLabel="Today" readOnly />
      <MonthGridLegend items={showBlocked ? ["confirmed", "pending", "blocked", "today"] : ["confirmed", "pending", "today"]} />
      <p className="text-sm">
        {[
          plural(counts.booked, "booked day", "booked days"),
          plural(counts.pending, "day with pending requests", "days with pending requests"),
          ...(showBlocked ? [plural(counts.blocked, "blocked day", "blocked days")] : []),
        ].join(", ")}
      </p>
    </div>
  );
}
