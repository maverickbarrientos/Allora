"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/components/app-shell";
import { Inbox } from "@/components/inbox";

/** A customer's conversations with vendors (docs/SPEC-messages.md). */
export default function CustomerInboxPage() {
  const router = useRouter();
  const isVendor = useProfile().role === "vendor";

  // Vendors have their own address for their inbox.
  useEffect(() => {
    if (isVendor) router.replace("/vendor/messages");
  }, [isVendor, router]);

  return isVendor ? null : <Inbox basePath="/messages" />;
}
