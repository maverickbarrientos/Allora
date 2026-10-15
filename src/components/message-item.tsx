import type { Message } from "@/lib/api/types";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One message bubble: mine on the right, theirs on the left. Plain text, line breaks kept. */
export function MessageItem({ message, showTime }: { message: Message; showTime: boolean }) {
  return (
    <li className={cn("flex flex-col gap-1", message.mine ? "items-end" : "items-start")}>
      <p
        title={formatTimestamp(message.createdAt)}
        className={cn(
          "max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 [overflow-wrap:anywhere]",
          message.mine ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
        )}
      >
        <span className="sr-only">{message.mine ? "You: " : "Them: "}</span>
        {message.body}
      </p>
      {showTime ? (
        <time dateTime={message.createdAt} className="text-xs text-muted-foreground">
          {formatTimestamp(message.createdAt)}
        </time>
      ) : (
        <span className="sr-only">{formatTimestamp(message.createdAt)}</span>
      )}
    </li>
  );
}
