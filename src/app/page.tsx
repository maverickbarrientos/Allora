import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Reveal } from "@/components/reveal";
import { Card, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Allora · Plan events and book vendors",
  description:
    "Create your event, book the vendors you need, and see at a glance what your plan is still missing.",
};

const STEPS = [
  {
    title: "Create your event",
    body: "Set the type, date, budget and guest count. That is all we need to begin.",
  },
  {
    title: "Book your vendors",
    body: "Browse vendors matched to your plan and send a booking in a few taps.",
  },
  {
    title: "See what is missing",
    body: "Your plan shows which services are covered and which still need a vendor.",
  },
];

const AUDIENCES = [
  {
    label: "For hosts",
    title: "Plan with a clear head",
    points: [
      "Every booking for your event in one place",
      "Budget and guest count kept beside your plan",
      "Gaps in your plan surfaced before they matter",
    ],
    cta: "Plan an event",
  },
  {
    label: "For vendors",
    title: "Bookings, without the back-and-forth",
    points: [
      "Incoming requests in your own portal",
      "Accept or decline with a single click",
      "Block the dates you are unavailable",
    ],
    cta: "Join as a vendor",
  },
];

const EVENT_TYPES = [
  {
    name: "Weddings",
    body: "From the venue to the last dance, every service accounted for.",
    caption: "Long table, candlelight",
  },
  {
    name: "Birthdays",
    body: "Small dinners or full celebrations, planned without the scramble.",
    caption: "Cake and flowers, afternoon light",
  },
  {
    name: "Corporate",
    body: "Offsites and launches with a plan the whole team can follow.",
    caption: "Venue interior, morning light",
  },
];

const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";
const section = "py-14 lg:py-24";

export default function LandingPage() {
  return (
    <>
      <header className="border-b border-border">
        <div className={`${container} flex h-16 items-center justify-between gap-4`}>
          <Link href="/" className="font-display text-2xl">
            Allora
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Log in
            </Link>
            <Link href="/signup" className={buttonVariants({ size: "sm" })}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="paper-grain bg-stone">
          <div
            className={`${container} grid items-center gap-10 py-14 lg:grid-cols-2 lg:gap-16 lg:py-24`}
          >
            <Reveal className="flex flex-col gap-6">
              <span className="label">Event planning, made calm</span>
              <h1 className="text-display max-w-[14ch]">Every detail, in one place.</h1>
              <div
                aria-hidden="true"
                className="hairline-draw h-px w-full max-w-xs bg-linear-to-r from-brass to-transparent"
              />
              <p className="max-w-[48ch] text-lg text-muted-foreground">
                Create your event, book the vendors you need, and see at a glance what
                your plan is still missing.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/signup" className={buttonVariants({ size: "lg" })}>
                  Start planning
                  <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
                </Link>
                <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
                  Log in
                </Link>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <ImagePlaceholder caption="Table setting, natural light" aspect="4 / 3" />
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section className={section} aria-labelledby="how-heading">
          <div className={container}>
            <Reveal className="flex flex-col gap-3">
              <span className="label">How it works</span>
              <h2 id="how-heading" className="text-h1 max-w-[20ch]">
                Three steps from idea to a full plan
              </h2>
            </Reveal>
            <ol className="mt-10 grid gap-0 md:grid-cols-3 md:divide-x md:divide-border">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="border-t border-border py-6 md:border-t-0 md:px-8 md:py-2 md:first:pl-0 md:last:pr-0"
                >
                  <Reveal delay={i * 80} className="flex flex-col gap-3">
                    <span className="font-display text-h2 text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-h2">{step.title}</h3>
                    <p className="text-muted-foreground">{step.body}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* For hosts / for vendors */}
        <section className={`${section} border-t border-border`} aria-labelledby="who-heading">
          <div className={container}>
            <Reveal className="flex flex-col gap-3">
              <span className="label">Who it is for</span>
              <h2 id="who-heading" className="text-h1 max-w-[20ch]">
                One place for hosts and the vendors they book
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {AUDIENCES.map((a, i) => (
                <Reveal key={a.label} delay={i * 80} className="h-full">
                  <Card className="flex h-full flex-col gap-5">
                    <span className="label">{a.label}</span>
                    <CardTitle>{a.title}</CardTitle>
                    <ul className="flex flex-col divide-y divide-border">
                      {a.points.map((p) => (
                        <li key={p} className="py-3 text-muted-foreground first:pt-0">
                          {p}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/signup"
                      className={`${buttonVariants({ variant: "outline" })} mt-auto self-start`}
                    >
                      {a.cta}
                    </Link>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Event types */}
        <section className={`${section} border-t border-border`} aria-labelledby="types-heading">
          <div className={container}>
            <Reveal className="flex flex-col gap-3">
              <span className="label">Made for</span>
              <h2 id="types-heading" className="text-h1 max-w-[20ch]">
                The moments worth getting right
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
              {EVENT_TYPES.map((t, i) => (
                <Reveal key={t.name} delay={i * 80} className="flex flex-col gap-4">
                  <ImagePlaceholder caption={t.caption} aspect="4 / 5" />
                  <h3 className="text-h2">{t.name}</h3>
                  <p className="text-muted-foreground">{t.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className={`${section} border-t border-border`}>
          <Reveal className={`${container} flex flex-col items-start gap-6`}>
            <h2 className="text-h1 max-w-[22ch]">Your next event starts with a single plan.</h2>
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Get started
              <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border">
        <div
          className={`${container} flex h-16 items-center justify-between gap-4 text-sm text-muted-foreground`}
        >
          <span className="font-display text-lg text-foreground">Allora</span>
          <span>© {new Date().getFullYear()} Allora</span>
        </div>
      </footer>
    </>
  );
}
