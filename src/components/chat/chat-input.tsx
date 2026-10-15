"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const MAX_CHARS = 1000;
export const CHAT_INPUT_ID = "chat-input";
const COUNTER_FROM = 900;

/**
 * Message box. Enter sends, Shift+Enter adds a line. Empty or whitespace-only
 * text cannot be sent. A counter shows near the 1,000 character limit.
 */
export function ChatInput({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (text: string) => boolean;
}) {
  const [text, setText] = useState("");
  const blank = text.trim().length === 0;

  function submit() {
    if (disabled || blank) return;
    if (onSend(text)) setText("");
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor={CHAT_INPUT_ID} className="sr-only">
        Message the planning assistant
      </label>
      <div className="flex items-end gap-3">
        <Textarea
          id={CHAT_INPUT_ID}
          rows={2}
          value={text}
          maxLength={MAX_CHARS}
          disabled={disabled}
          placeholder="Ask about your plan"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          aria-describedby={text.length >= COUNTER_FROM ? "chat-counter" : undefined}
          className="min-h-12 resize-none rounded-xl bg-ivory text-plum-ink placeholder:text-plum-ink/60"
        />
        <Button type="submit" size="icon" disabled={disabled || blank} aria-label="Send message">
          <ArrowUp className="h-5 w-5" strokeWidth={1.5} />
        </Button>
      </div>
      {text.length >= COUNTER_FROM && (
        <p id="chat-counter" className="self-end text-xs text-muted-foreground" aria-live="polite">
          {text.length} / {MAX_CHARS}
        </p>
      )}
    </form>
  );
}
