"use client";

import { useProfile } from "@/components/app-shell";
import { EventsList } from "@/components/events-list";
import { PageHeader } from "@/components/page-header";
import { Reveal } from "@/components/reveal";

export default function HomePage() {
  const profile = useProfile();

  // Vendor-role users keep the feature 1 placeholder.
  if (profile.role === "vendor") {
    return (
      <Reveal>
        <PageHeader
          label="Your account"
          title={`Hi, ${profile.name}`}
          description={
            <>
              Signed in as a <span className="font-medium text-foreground">{profile.role}</span>.
            </>
          }
        />
      </Reveal>
    );
  }

  return <EventsList />;
}
