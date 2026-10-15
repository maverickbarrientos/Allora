"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useProfile } from "@/components/app-shell";
import { EventsList } from "@/components/events-list";
import { Alert } from "@/components/ui/alert";

export default function HomePage() {
  const router = useRouter();
  const profile = useProfile();
  const isVendor = profile.role === "vendor";

  // Vendor-role users belong on /vendor.
  useEffect(() => {
    if (isVendor) router.replace("/vendor");
  }, [isVendor, router]);

  return isVendor ? null : (
    <EventsList
      notice={
        <Suspense fallback={null}>
          <DeletedNotice />
        </Suspense>
      }
    />
  );
}

/** "Event deleted" after a delete (`?deleted=1`). The URL is cleaned so a reload doesn't repeat it. */
function DeletedNotice() {
  const router = useRouter();
  const params = useSearchParams();
  const [shown] = useState(() => params.get("deleted") === "1");

  useEffect(() => {
    if (params.get("deleted")) router.replace("/events", { scroll: false });
  }, [params, router]);

  if (!shown) return null;
  return (
    <div role="status">
      <Alert role="none">Event deleted</Alert>
    </div>
  );
}
