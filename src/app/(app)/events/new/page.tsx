"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import type { EventType } from "@/lib/api/types";
import { PageHeader } from "@/components/page-header";
import { Reveal } from "@/components/reveal";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Errors = {
  type?: string;
  date?: string;
  budget?: string;
  guestCount?: string;
  form?: string;
};

const TYPES: EventType[] = ["wedding", "birthday", "corporate"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function NewEventPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const type = String(f.get("type") ?? "");
    const date = String(f.get("date") ?? "");
    const budgetRaw = String(f.get("budget") ?? "").trim();
    const guestRaw = String(f.get("guestCount") ?? "").trim();
    const budget = Number(budgetRaw);
    const guestCount = Number(guestRaw);

    // Format checks only. Ranges (budget and guests above 0) are the server's
    // call; its validation_error shows as a form-level message.
    const next: Errors = {};
    if (!TYPES.includes(type as EventType)) next.type = "Choose an event type";
    if (!DATE_RE.test(date)) next.date = "Choose a date";
    if (!budgetRaw || Number.isNaN(budget)) next.budget = "Enter a budget";
    if (!guestRaw || Number.isNaN(guestCount)) next.guestCount = "Enter a guest count";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const { event } = await api.createEvent({
        type: type as EventType,
        date,
        budget,
        guestCount,
      });
      router.push(`/events/${event.id}`);
    } catch (err) {
      const { code, message } = toApiError(err);
      setErrors({
        form:
          code === "validation_error"
            ? message
            : code === "forbidden"
              ? "Only customers can create events."
              : "Something went wrong. Please try again.",
      });
      setSubmitting(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-10">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Your events
      </Link>
      <PageHeader
        label="New plan"
        title="Create event"
        description="Tell us about the occasion. You can add vendors next."
      />
      <Reveal delay={700}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          {errors.form && <Alert variant="destructive">{errors.form}</Alert>}
          <div className="flex flex-col gap-2">
            <Label htmlFor="type">Type</Label>
            <Select id="type" name="type" defaultValue="" disabled={submitting} aria-invalid={!!errors.type}>
              <option value="" disabled>
                Choose a type
              </option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
            {errors.type && <p className="text-sm text-destructive">{errors.type}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" disabled={submitting} aria-invalid={!!errors.date} />
            {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="budget">Budget</Label>
              <Input id="budget" name="budget" type="number" inputMode="decimal" step="any" disabled={submitting} aria-invalid={!!errors.budget} />
              {errors.budget && <p className="text-sm text-destructive">{errors.budget}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="guestCount">Guests</Label>
              <Input id="guestCount" name="guestCount" type="number" inputMode="numeric" disabled={submitting} aria-invalid={!!errors.guestCount} />
              {errors.guestCount && <p className="text-sm text-destructive">{errors.guestCount}</p>}
            </div>
          </div>
          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Creating" : "Create event"}
          </Button>
        </form>
      </Reveal>
    </div>
  );
}
