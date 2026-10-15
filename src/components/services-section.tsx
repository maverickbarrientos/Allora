"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, toApiError } from "@/lib/api/client";
import { capitalize } from "@/lib/format";
import type { Load } from "@/lib/use-load";
import type { EventService } from "@/lib/api/types";
import { ServicePicker } from "@/components/service-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_TEXT: Record<"pending" | "confirmed" | "missing", string> = {
  confirmed: "Booked",
  pending: "Pending",
  missing: "Missing",
};

type Editing = { categories: string[] | null; selected: string[] };

/**
 * "Services" on the plan: the event's own service list with a status for
 * each, and an Edit mode to add or remove services. Loads on its own, so the
 * plan keeps working if this fails.
 */
export function ServicesSection({
  eventId,
  state,
  onRetry,
  onSaved,
}: {
  eventId: string;
  state: Load<{ services: EventService[] }>;
  onRetry: () => void;
  onSaved: (data: { services: EventService[] }) => void;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [categoriesFailed, setCategoriesFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const services = state.status === "loaded" ? state.data.services : [];
  const locked = new Set(services.filter((s) => s.status !== null).map((s) => s.category));

  function startEditing() {
    setError(null);
    setCategoriesFailed(false);
    setEditing({ categories: null, selected: services.map((s) => s.category) });
    api
      .listCategories()
      .then(({ categories }) => setEditing((prev) => prev && { ...prev, categories }))
      .catch(() => setCategoriesFailed(true));
  }

  async function save() {
    if (!editing || inFlight.current || editing.selected.length === 0) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const data = await api.saveServices(eventId, editing.selected);
      onSaved(data);
      setEditing(null);
    } catch (err) {
      const { code, message } = toApiError(err);
      // Shown as the server wrote it ("Can't remove X: they have a booking.").
      if (code === "service_has_active_booking") setError(message);
      else if (code === "validation_error") setError("That list of services isn't valid. Please check it and try again.");
      else setError("Couldn't save your services. Please try again.");
      // A booking may have been made elsewhere, so the locks may have changed.
      if (code === "service_has_active_booking") {
        api
          .getServices(eventId)
          .then(onSaved)
          .catch(() => {});
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="services-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="services-heading" className="font-display text-h2">
          Services
        </h2>
        {state.status === "loaded" && !editing && (
          <Button variant="outline" size="sm" onClick={startEditing}>
            Edit
          </Button>
        )}
      </div>

      {state.status === "loading" && (
        <div role="status" aria-label="Loading services" className="flex flex-col gap-3">
          <Skeleton className="h-5 w-1/2 max-w-xs" />
          <Skeleton className="h-24" />
        </div>
      )}

      {state.status === "error" && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="text-sm text-muted-foreground">
            Couldn&apos;t load your services. The rest of the plan still works.
          </p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {state.status === "loaded" && editing && (
        <div className="flex flex-col gap-4">
          {error && <Alert variant="destructive">{error}</Alert>}
          {editing.categories ? (
            <ServicePicker
              categories={editing.categories}
              selected={editing.selected}
              locked={locked}
              disabled={saving}
              onChange={(selected) => setEditing({ ...editing, selected })}
            />
          ) : categoriesFailed ? (
            <div className="flex flex-wrap items-center gap-3">
              <p role="status" className="text-sm text-muted-foreground">
                Couldn&apos;t load the list of services.
              </p>
              <Button variant="outline" size="sm" onClick={startEditing}>
                Retry
              </Button>
            </div>
          ) : (
            <Skeleton role="status" aria-label="Loading services" className="h-24" />
          )}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void save()} disabled={saving || !editing.categories || editing.selected.length === 0}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving" : "Save"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {state.status === "loaded" && !editing && (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {services.map((s) => {
            const key = s.status ?? "missing";
            return (
              <li key={s.category} className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 py-3">
                <span className="label">{capitalize(s.category)}</span>
                <span className={key === "missing" ? "text-sm text-muted-foreground" : "text-sm"}>
                  {STATUS_TEXT[key]}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
