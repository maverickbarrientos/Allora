import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** "Message" on a booking row: opens the conversation with the other side. */
export function MessageLink({ href, name }: { href: string; name: string }) {
  return (
    <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })} aria-label={`Message ${name}`}>
      <MessageCircle aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
      Message
    </Link>
  );
}
