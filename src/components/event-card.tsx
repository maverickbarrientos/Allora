import Link from "next/link";
import type { Event, EventType } from "@/lib/api/types";
import { capitalize, formatDateShort, formatNumber } from "@/lib/format";
import { eventName } from "@/lib/event-name";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Card } from "@/components/ui/card";

const CAPTIONS: Record<EventType, string> = {
  wedding: "Long table, candlelight",
  birthday: "Table setting, natural light",
  corporate: "Venue interior, morning light",
};

/**
 * Compact event card: image, type, then date, budget and guests in one row
 * between hairlines. The name link covers the whole card (it opens the plan);
 * "Edit" sits above it as its own link, since links can't be nested.
 */
export function EventCard({ event }: { event: Event }) {
  const name = eventName(event);
  return (
    <Card className="relative flex h-full flex-col gap-2">
      <ImagePlaceholder caption={CAPTIONS[event.type]} aspect="16 / 9" />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="truncate font-display text-h2" title={name}>
            <Link
              href={`/events/${event.id}`}
              className="after:absolute after:inset-0 after:rounded-[var(--radius)] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
            >
              {name}
            </Link>
          </h2>
          <p className="text-sm text-muted-foreground">{capitalize(event.type)}</p>
        </div>
        <Link
          href={`/events/${event.id}/edit`}
          aria-label={`Edit ${name}`}
          className="relative z-10 -my-2 inline-flex min-h-11 shrink-0 items-center text-sm underline-offset-4 hover:underline"
        >
          Edit
        </Link>
      </div>
      <dl className="grid grid-cols-[1.4fr_1fr_0.8fr] divide-x divide-border border-t border-border pt-2 text-sm">
        <Stat label="Date" value={formatDateShort(event.date)} first />
        <Stat label="Budget" value={formatNumber(event.budget)} />
        <Stat label="Guests" value={formatNumber(event.guestCount)} />
      </dl>
    </Card>
  );
}

function Stat({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <div className={first ? "min-w-0 pr-2" : "min-w-0 px-2"}>
      <dt className="label">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}
