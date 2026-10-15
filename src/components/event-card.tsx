import Link from "next/link";
import type { Event, EventType } from "@/lib/api/types";
import { capitalize, formatDate, formatNumber } from "@/lib/format";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Card } from "@/components/ui/card";

const CAPTIONS: Record<EventType, string> = {
  wedding: "Long table, candlelight",
  birthday: "Table setting, natural light",
  corporate: "Venue interior, morning light",
};

/** Event summary card: image, type, then date, budget and guests between hairlines. */
export function EventCard({ event }: { event: Event }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="group block rounded-[var(--radius)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Card className="flex flex-col gap-5 p-7 transition-shadow group-hover:shadow-md">
        <ImagePlaceholder caption={CAPTIONS[event.type]} aspect="16 / 10" />
        <h2 className="font-display text-h2">{capitalize(event.type)}</h2>
        <dl className="flex flex-col divide-y divide-border text-sm">
          <Row label="Date" value={formatDate(event.date)} />
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
