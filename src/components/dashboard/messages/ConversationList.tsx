"use client";

import * as React from "react";
import Link from "next/link";
import { Ban, MessagesSquare, Paperclip, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, EASE, motion } from "@/components/motion";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/States";
import { shortAgo, type ConversationView } from "./shared";

export function ConversationList({
  items,
  selectedId,
  onSelect,
  now,
  tz,
  isTutor,
}: {
  items: ConversationView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: number;
  tz: string;
  isTutor: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((v) =>
        [v.counterpart, v.counterpartFull, v.subjectLabel ?? "", v.childName ?? ""].some((s) => s.toLowerCase().includes(q)) ||
        v.messages.some((m) => m.body.toLowerCase().includes(q) || m.attachment?.name.toLowerCase().includes(q)),
      )
    : items;
  const totalUnread = items.reduce((n, v) => n + v.unread, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b border-line px-4 pb-3.5 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-ink">Messages</h1>
          {totalUnread > 0 && <span className="rounded-md bg-ink px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-on-ink">{totalUnread} unread</span>}
        </div>
        {items.length > 0 && (
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, subject or message"
            aria-label="Search conversations"
            icon={<Search />}
            suffix={
              query ? (
                <button type="button" onClick={() => setQuery("")} className="grid size-7 place-items-center rounded-md hover:bg-sunken hover:text-ink" aria-label="Clear search">
                  <X className="size-3.5" />
                </button>
              ) : undefined
            }
          />
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 items-center">
          <EmptyState
            compact
            icon={<MessagesSquare />}
            title="No conversations yet"
            description={isTutor ? "When families message you or book a lesson, the conversation appears here." : "Message a tutor from their profile to ask questions before you book."}
            action={isTutor ? <Button asChild><Link href="/dashboard/jobs">Browse jobs</Link></Button> : <Button asChild><Link href="/tutors">Find tutors</Link></Button>}
          />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState compact icon={<Search />} title="No matches" description={`No conversations mention “${query.trim()}”.`} action={<Button variant="secondary" size="sm" onClick={() => setQuery("")}>Clear search</Button>} />
      ) : (
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-2" aria-label="Conversations">
          <AnimatePresence initial={false}>
            {filtered.map((v) => {
              const active = v.c.id === selectedId;
              const last = v.last;
              const fromMe = last?.senderId === v.selfId;
              const preview = last ? (last.body ? last.body : last.attachment ? last.attachment.name : "") : "No messages yet";
              return (
                <motion.li key={v.c.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>
                  <button
                    type="button"
                    onClick={() => onSelect(v.c.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn("relative flex w-full gap-3 rounded-lg px-3 py-3 text-left transition-colors", !active && "hover:bg-canvas")}
                  >
                    {active && <motion.span layoutId="conversation-active" className="absolute inset-0 rounded-lg bg-brand-soft" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
                    <Avatar name={v.counterpartFull} src={v.photoUrl} tone={v.tone} size="md" className="relative" />
                    <span className="relative min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("flex min-w-0 items-center gap-1.5 truncate text-sm text-ink", v.unread ? "font-semibold" : "font-medium")}>
                          <span className="truncate">{v.counterpart}</span>
                          {v.c.blockedBy && (
                            <>
                              <Ban className="size-3.5 shrink-0 text-muted" aria-hidden />
                              <span className="sr-only">(blocked)</span>
                            </>
                          )}
                        </span>
                        {last && <time dateTime={last.createdAt} className="shrink-0 text-[11.5px] tabular-nums text-muted">{shortAgo(last.createdAt, now, tz)}</time>}
                      </span>
                      {(v.subjectLabel || v.childName) && (
                        <span className="block truncate text-[12px] text-muted">
                          {[v.subjectLabel, v.childName && `for ${v.childName}`].filter(Boolean).join(" · ")}
                        </span>
                      )}
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className={cn("flex min-w-0 flex-1 items-center gap-1 truncate text-[13px]", v.unread ? "font-medium text-ink" : "text-muted")}>
                          {last?.attachment && !last.body && <Paperclip className="size-3 shrink-0" aria-hidden />}
                          <span className="truncate">
                            {fromMe && "You: "}
                            {preview}
                          </span>
                        </span>
                        {v.unread > 0 && (
                          <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-ink px-1.5 text-[11px] font-semibold leading-5 tabular-nums text-on-ink">
                            {v.unread}
                            <span className="sr-only"> unread</span>
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
