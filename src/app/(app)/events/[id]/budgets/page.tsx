"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api, ApiError, toApiError } from "@/lib/api/client";
import { parseAmount, toCents, type AmountCheck } from "@/lib/amount";
import { capitalize, formatAmount } from "@/lib/format";
import { eventName } from "@/lib/event-name";
import { useLoad } from "@/lib/use-load";
import type { BudgetEntry, BudgetSummary, ServiceBudget } from "@/lib/api/types";
import { overByCents } from "@/components/budget-section";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { Reveal } from "@/components/reveal";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Drafts = Record<string, string>;

const draftsFrom = (budgets: ServiceBudget[]): Drafts =>
  Object.fromEntries(budgets.map((b) => [b.category, b.amount === null ? "" : String(b.amount)]));

/** Empty clears the budget; anything else must be a valid amount. */
type DraftCheck = { ok: true; value: number | null } | Extract<AmountCheck, { ok: false }>;
function checkDraft(raw: string, eventBudget: number): DraftCheck {
  if (raw.trim() === "") return { ok: true, value: null };
  return parseAmount(raw, eventBudget);
}

function draftError(check: DraftCheck, eventBudget: number): string | null {
  if (check.ok) return null;
  switch (check.reason) {
    case "not_positive":
      return "Enter an amount above 0, or leave it empty to clear it";
    case "decimals":
      return "Use at most 2 decimal places";
    case "too_high":
      return `Can't be more than the event budget (${formatAmount(eventBudget)})`;
    default:
      return "Enter a number, like 5000 or 5000.50";
  }
}

export default function BudgetsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, setState, reload } = useLoad(() =>
    Promise.all([api.getPlan(id), api.getBudgets(id)]).then(([plan, summary]) => ({ event: plan.event, summary })),
  );
  const [edited, setEdited] = useState<Drafts | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Events are for customers only; a vendor session gets 403.
  useEffect(() => {
    if (state.status === "error" && state.error.code === "forbidden") router.replace("/vendor");
  }, [state, router]);

  const back = (
    <Link
      href={`/events/${id}`}
      className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Back to plan
    </Link>
  );

  if (state.status === "loading") {
    return (
      <div role="status" aria-label="Loading" className="flex max-w-2xl flex-col gap-10">
        {back}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-2/3 max-w-sm" />
        </div>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    if (state.error.code === "forbidden") return null;
    if (state.error.code === "event_not_found") {
      return (
        <div className="flex max-w-md flex-col items-start gap-6">
          <p className="label">404</p>
          <h1 className="font-display text-h1">Event not found</h1>
          <p className="text-muted-foreground">This event doesn&apos;t exist, or it isn&apos;t yours.</p>
          <Link href="/events" className={buttonVariants({ variant: "outline" })}>
            Back to your events
          </Link>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-10">
        {back}
        <ErrorState error={state.error} onRetry={reload} message="Couldn't load your budgets. Please try again." />
      </div>
    );
  }

  const { event, summary } = state.data;
  const { eventBudget, budgets } = summary;
  // `edited` is null until the customer types, so the inputs start from the saved budgets.
  const drafts = edited ?? draftsFrom(budgets);
  const checks = Object.fromEntries(budgets.map((b) => [b.category, checkDraft(drafts[b.category] ?? "", eventBudget)]));
  const totalCents = budgets.reduce((sum, b) => {
    const c = checks[b.category];
    return sum + (c.ok && c.value !== null ? toCents(c.value) : 0);
  }, 0);
  const leftCents = toCents(eventBudget) - totalCents;

  function onChange(category: string, value: string) {
    setEdited({ ...drafts, [category]: value });
    setNotice(null);
    setFormError(null);
  }

  async function save() {
    if (inFlight.current) return;
    setShowErrors(true);
    setNotice(null);
    setFormError(null);
    if (budgets.some((b) => !checks[b.category].ok)) return;

    // Only the services whose amount changed; an empty input clears the budget.
    const entries: BudgetEntry[] = [];
    for (const b of budgets) {
      const c = checks[b.category];
      const value = c.ok ? c.value : null;
      if (value !== b.amount) entries.push({ category: b.category, amount: value });
    }
    if (entries.length === 0) {
      setNotice("No changes to save.");
      return;
    }

    inFlight.current = true;
    setSaving(true);
    try {
      const fresh: BudgetSummary = await api.saveBudgets(id, entries);
      if (!alive.current) return;
      setState((prev) =>
        prev.status === "loaded" ? { status: "loaded", data: { ...prev.data, summary: fresh } } : prev,
      );
      setEdited(null);
      setShowErrors(false);
      setNotice("Saved");
    } catch (err) {
      if (!alive.current) return;
      const { code, message } = toApiError(err);
      if (code === "event_not_found") {
        setState({ status: "error", error: new ApiError(404, code, message) });
      } else if (code === "forbidden") {
        router.replace("/vendor");
      } else if (code === "over_allocated") {
        setFormError(
          `Not saved: service budgets can't add up to more than the event budget (${formatAmount(eventBudget)}). Lower one or more amounts and try again.`,
        );
      } else if (code === "validation_error") {
        setFormError(`Not saved: ${message}`);
      } else {
        setFormError("Couldn't save your budgets. Please try again.");
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setSaving(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      {back}
      <PageHeader
        label="Budget by service"
        title={<span className="[overflow-wrap:anywhere]">{eventName(event)}</span>}
        description={`Set aside part of your ${formatAmount(eventBudget)} budget for each service. Leave a service empty to use its suggested share.`}
      />
      <Reveal delay={400}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="flex flex-col gap-6"
        >
          {formError && <Alert variant="destructive">{formError}</Alert>}

          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {budgets.map((b) => {
              const inputId = `budget-${b.category}`;
              const check = checks[b.category];
              const error = showErrors ? draftError(check, eventBudget) : null;
              // An invalid input compares against the saved amount. A cleared set budget
              // has no fresh suggested share until it is saved, so it is not compared.
              const draftValue = check.ok ? check.value : b.amount;
              const limit = draftValue ?? (b.amount === null ? b.share : null);
              const over = limit === null ? 0 : overByCents(b.booked, limit);
              return (
                <li key={b.category} className="flex flex-col gap-2 py-4">
                  <Label htmlFor={inputId}>{capitalize(b.category)}</Label>
                  <Input
                    id={inputId}
                    inputMode="decimal"
                    autoComplete="off"
                    value={drafts[b.category] ?? ""}
                    placeholder={b.amount === null ? `Suggested ${formatAmount(b.share)}` : "Empty clears this budget"}
                    onChange={(e) => onChange(b.category, e.target.value)}
                    disabled={saving}
                    aria-invalid={!!error}
                    aria-describedby={`${inputId}-hint${error ? ` ${inputId}-error` : ""}`}
                  />
                  {error && (
                    <p id={`${inputId}-error`} className="text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  <p id={`${inputId}-hint`} className="text-sm text-muted-foreground wrap-anywhere">
                    {b.amount === null
                      ? `No budget set · suggested share ${formatAmount(b.share)}`
                      : check.ok && check.value === null
                        ? "Budget set · clears when you save"
                        : "Budget set"}
                    {` · booked ${formatAmount(b.booked)}`}
                    {over > 0 && (
                      <span className="text-destructive">
                        {` · booked total is ${formatAmount(over / 100)} over this ${draftValue !== null ? "budget" : "suggested share"}`}
                      </span>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>

          <p role="status" aria-live="polite" className={leftCents < 0 ? "text-destructive wrap-anywhere" : "wrap-anywhere"}>
            {leftCents < 0
              ? `${formatAmount(totalCents / 100)} set aside, which is ${formatAmount(-leftCents / 100)} over the event budget of ${formatAmount(eventBudget)}.`
              : `${formatAmount(totalCents / 100)} of ${formatAmount(eventBudget)} set aside · ${formatAmount(leftCents / 100)} left`}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={saving} className="w-fit">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving" : "Save budgets"}
            </Button>
            {notice && (
              <p role="status" className="text-sm text-muted-foreground">
                {notice}
              </p>
            )}
          </div>
        </form>
      </Reveal>
    </div>
  );
}
