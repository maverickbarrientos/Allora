"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/components/app-shell";
import { EventsList } from "@/components/events-list";

export default function HomePage() {
  const router = useRouter();
  const profile = useProfile();
  const isVendor = profile.role === "vendor";

  // Vendor-role users belong on /vendor.
  useEffect(() => {
    if (isVendor) router.replace("/vendor");
  }, [isVendor, router]);

  return isVendor ? null : <EventsList />;
}
