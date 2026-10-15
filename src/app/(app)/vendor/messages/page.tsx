"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/components/app-shell";
import { Inbox } from "@/components/inbox";

/** A vendor's conversations with customers (docs/SPEC-messages.md). */
export default function VendorInboxPage() {
  const router = useRouter();
  const isVendor = useProfile().role === "vendor";

  // Customers have their own address for their inbox.
  useEffect(() => {
    if (!isVendor) router.replace("/messages");
  }, [isVendor, router]);

  return isVendor ? <Inbox basePath="/vendor/messages" /> : null;
}
