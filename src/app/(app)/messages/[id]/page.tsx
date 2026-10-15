"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProfile } from "@/components/app-shell";
import { Conversation } from "@/components/conversation";

/** A customer's conversation with a vendor (docs/SPEC-messages.md). */
export default function CustomerConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isVendor = useProfile().role === "vendor";

  // Vendors have their own address for the same conversation.
  useEffect(() => {
    if (isVendor) router.replace(`/vendor/messages/${id}`);
  }, [isVendor, id, router]);

  if (isVendor) return null;
  return <Conversation id={id} backHref="/events" backLabel="Your events" />;
}
