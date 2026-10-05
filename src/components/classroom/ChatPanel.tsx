"use client";

import * as React from "react";
import { MessagesSquare, SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatLine {
  id: string;
  mine: boolean;
  body: string;
  /** Short time label, already in the viewer's time zone. */
  time: string;
}

/**
 * Live chat beside the whiteboard. In a booked lesson these are the same messages as the
 * tutor–family conversation in the inbox, so nothing said in class is lost afterwards.
 */
export function ChatPanel({
  lines,
  onSend,
  disabledReason,
  peerName,
  note,
  className,
}: {
  lines: ChatLine[];
  /** Returns an error message when the message couldn't be sent. */
  onSend: (body: string) => string | null;
  /** When set, the composer is replaced by this explanation. */
  disabledReason?: string;
  peerName: string;
  note: string;
  className?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const err = onSend(body);
    setError(err);
    if (!err) setDraft("");
  };

  return (
    <section aria-label="Chat" className={cn("flex min-h-0 flex-col bg-surface", className)}>
      <h2 className="hidden shrink-0 items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold text-ink xl:flex">
        <MessagesSquare className="size-4 text-muted" aria-hidden /> Chat
      </h2>
      <div ref={listRef} data-lenis-prevent className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
        {lines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessagesSquare className="size-6 text-subtle" aria-hidden />
            <p className="mt-2.5 text-sm font-medium text-ink">No messages yet</p>
            <p className="mt-1 max-w-[15rem] text-[13px] leading-snug text-muted">{note}</p>
          </div>
        ) : (
          lines.map((l) => (
            <div key={l.id} className={cn("flex flex-col", l.mine ? "items-end" : "items-start")}>
              <p className={cn("max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[14px] leading-snug", l.mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md bg-sunken text-ink")}>
                {l.body}
              </p>
              <span className="mt-1 px-1 text-[11px] text-muted">
                {l.mine ? "You" : peerName} · {l.time}
              </span>
            </div>
          ))
        )}
      </div>

      {disabledReason ? (
        <p className="shrink-0 border-t border-line px-4 py-3 text-[13px] leading-snug text-muted">{disabledReason}</p>
      ) : (
        <form onSubmit={submit} className="shrink-0 border-t border-line p-3">
          {error && (
            <p role="alert" className="mb-2 px-1 text-[13px] text-danger">
              {error}
            </p>
          )}
          <div className="flex items-end gap-2">
            <label htmlFor="classroom-chat" className="sr-only">
              Message {peerName}
            </label>
            <textarea
              id="classroom-chat"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="Type a message…"
              className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-line-strong bg-surface px-3.5 py-2.5 text-[14.5px] text-ink outline-none transition-colors placeholder:text-subtle focus:border-brand"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Send message"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-cta text-on-cta transition-colors hover:bg-cta-hover disabled:pointer-events-none disabled:opacity-40"
            >
              <SendHorizontal className="size-[18px]" />
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
