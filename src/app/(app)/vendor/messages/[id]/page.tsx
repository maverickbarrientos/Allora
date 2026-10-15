"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProfile } from "@/components/app-shell";
import { Conversation } from "@/components/conversation";

/** A vendor's conversation with a customer (docs/SPEC-messages.md). */
export default function VendorConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isVendor = useProfile().role === "vendor";

  // Customers have their own address for the same conversation.
  useEffect(() => {
    if (!isVendor) router.replace(`/messages/${id}`);
  }, [isVendor, id, router]);

  if (!isVendor) return null;
  return <Conversation id={id} backHref="/vendor/messages" backLabel="Messages" />;
}
