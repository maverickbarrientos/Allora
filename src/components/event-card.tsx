import Link from "next/link";
import type { Event, EventType } from "@/lib/api/types";
import { capitalize, formatDate, formatNumber } from "@/lib/format";
import { eventName } from "@/lib/event-name";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Card } from "@/components/ui/card";

const CAPTIONS: Record<EventType, string> = {
  wedding: "Long table, candlelight",
  birthday: "Table setting, natural light",
  corporate: "Venue interior, morning light",
};

/** Event summary card: image, name, type and date, then budget and guests between hairlines. */
export function EventCard({ event }: { event: Event }) {
  const name = eventName(event);
  return (
    <Link
      href={`/events/${event.id}`}
      className="group block min-w-0 rounded-[var(--radius)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Card className="flex flex-col gap-5 p-7 transition-shadow group-hover:shadow-md">
        <ImagePlaceholder caption={CAPTIONS[event.type]} aspect="16 / 10" />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate font-display text-h2" title={name}>
            {name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {capitalize(event.type)} &middot; {formatDate(event.date)}
          </p>
        </div>
        <dl className="flex flex-col divide-y divide-border text-sm">
          <Row label="Budget" value={formatNumber(event.budget)} />
          <Row label="Guests" value={formatNumber(event.guestCount)} />
        </dl>
      </Card>
    </Link>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="label">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
