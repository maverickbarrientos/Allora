import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { UnreadBadge } from "@/components/unread-badge";

/** "Message" on a booking row: opens the conversation with the other side. */
export function MessageLink({ href, name, unread }: { href: string; name: string; unread?: number }) {
  return (
    <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })} aria-label={`Message ${name}${unread ? `, ${unread} unread` : ""}`}>
      <MessageCircle aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
      Message
      <UnreadBadge count={unread} />
    </Link>
  );
}
