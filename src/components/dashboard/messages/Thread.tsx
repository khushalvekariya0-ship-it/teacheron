"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, BookOpen, CalendarPlus, Ellipsis, FileText, Flag, Info, ShieldCheck, UserRound } from "lucide-react";
import type { Message } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/store/hooks";
import { formatTime } from "@/lib/format";
import { dateKey } from "@/lib/time";
import { cn } from "@/lib/utils";
import { AnimatePresence, EASE, motion } from "@/components/motion";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Input";
import {
  ConfirmDialog, Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/Overlay";
import { toast } from "@/components/ui/Toast";
import { addDays, fmtKey } from "@/components/dashboard/calendar/model";
import { Composer } from "./Composer";
import { automatedReply, formatSize, type ConversationView } from "./shared";

const RUN_GAP_MS = 10 * 60_000;

export function Thread({ view, now, tz, onBack }: { view: ConversationView; now: number; tz: string; onBack: () => void }) {
  const me = useSession();
  const router = useRouter();
  const markRead = useApp((s) => s.markConversationRead);
  const toggleBlock = useApp((s) => s.toggleBlock);
  const simulateReply = useApp((s) => s.simulateReply);
  const { c, messages, selfId } = view;
  const [typing, setTyping] = React.useState(false);
  const [blockOpen, setBlockOpen] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const pendingReply = React.useRef(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const atBottom = React.useRef(true);

  // Opening a thread (and new incoming messages while it's open) marks them read.
  React.useEffect(() => {
    if (view.unread > 0) markRead(c.id);
  }, [c.id, view.unread, markRead]);

  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const last = messages[messages.length - 1];
  const lastMine = last?.senderId === selfId;
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el && (atBottom.current || lastMine)) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [last?.id, lastMine, typing]);

  const groups = React.useMemo(() => {
    const out: { day: string; items: Message[] }[] = [];
    for (const m of messages) {
      const day = dateKey(new Date(m.createdAt), tz);
      const g = out[out.length - 1];
      if (g && g.day === day) g.items.push(m);
      else out.push({ day, items: [m] });
    }
    return out;
  }, [messages, tz]);

  if (!me) return null;
  const today = dateKey(new Date(now), tz);
  const yesterday = addDays(today, -1);
  const dayLabel = (d: string) => (d === today ? "Today" : d === yesterday ? "Yesterday" : fmtKey(d, { weekday: "long", month: "short", day: "numeric", ...(d.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}) }));
  const myLast = [...messages].reverse().find((m) => m.senderId === selfId);
  const blockedByMe = c.blockedBy === selfId;
  const tutorSlug = view.tutor?.slug;
  const context = [view.subjectLabel, view.childName && `for ${view.childName}`].filter(Boolean).join(" · ");

  const onSent = (msg: Message, text: string) => {
    atBottom.current = true;
    if (!view.automated || pendingReply.current) return;
    pendingReply.current = true;
    const reply = automatedReply(text, { subject: view.subjectLabel, hasAttachment: !!msg.attachment, learnerFirstName: me.firstName });
    window.setTimeout(() => setTyping(true), 450);
    window.setTimeout(() => {
      simulateReply(c.id, reply);
      setTyping(false);
      pendingReply.current = false;
    }, 450 + 1500);
  };

  const unblock = () => {
    const res = toggleBlock(c.id);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`${view.counterpart} unblocked`);
  };

  const links = view.isTutorView
    ? [{ href: `/dashboard/bookings?q=${encodeURIComponent(view.user?.firstName ?? "")}`, label: "Bookings", icon: BookOpen }]
    : tutorSlug
      ? [
          { href: `/tutors/${tutorSlug}`, label: "View profile", icon: UserRound },
          { href: `/tutors/${tutorSlug}?book=regular`, label: "Book a lesson", icon: CalendarPlus, primary: true },
        ]
      : [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <header className="flex items-center gap-2.5 border-b border-line px-2 py-2.5 sm:px-4">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to conversations" className="md:hidden">
          <ArrowLeft />
        </Button>
        <Avatar name={view.counterpartFull} tone={view.tone} size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold tracking-tight text-ink">{view.counterpart}</h2>
          <p className="truncate text-[12.5px] text-muted">{context || (view.isTutorView ? "Student" : "Tutor")}</p>
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          {links.map((l) => (
            <Button key={l.href} asChild size="sm" variant={"primary" in l && l.primary ? "primary" : "secondary"}>
              <Link href={l.href}>
                <l.icon /> {l.label}
              </Link>
            </Button>
          ))}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Conversation options">
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {links.map((l) => (
              <DropdownMenuItem key={l.href} className="lg:hidden" onSelect={() => router.push(l.href)}>
                <l.icon /> {l.label}
              </DropdownMenuItem>
            ))}
            {links.length > 0 && <DropdownMenuSeparator className="lg:hidden" />}
            {!c.blockedBy && (
              <DropdownMenuItem onSelect={() => setBlockOpen(true)}>
                <Ban /> Block {view.counterpart}
              </DropdownMenuItem>
            )}
            {blockedByMe && (
              <DropdownMenuItem onSelect={unblock}>
                <Ban /> Unblock {view.counterpart}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem tone="danger" disabled={!messages.length} onSelect={() => setReportOpen(true)}>
              <Flag /> Report conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Safeguards */}
      {c.involvesMinor && (
        <div role="note" className="flex items-start gap-2.5 border-b border-line bg-canvas px-4 py-2.5 text-[12.5px] leading-snug text-ink-2">
          <ShieldCheck className="mt-px size-4 shrink-0 text-ink" aria-hidden />
          <p>This conversation involves a student under 18. It&apos;s visible to the parent account and may be reviewed by Trust &amp; Safety if reported.</p>
        </div>
      )}
      {c.reported && (
        <div role="note" className="flex items-center gap-2 border-b border-line bg-canvas px-4 py-2 text-[12.5px] text-muted">
          <Flag className="size-3.5 shrink-0" aria-hidden /> This conversation was reported and is queued for Trust &amp; Safety review.
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
        }}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface px-3 pb-4 sm:px-5"
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${view.counterpart}`}
      >
        {view.automated && (
          <p className="mx-auto mt-4 flex w-fit max-w-full items-center gap-1.5 rounded-lg bg-canvas px-3 py-1 text-center text-[11.5px] text-muted">
            <Info className="size-3.5 shrink-0" aria-hidden /> Sample tutor profile — replies in this preview are automated.
          </p>
        )}
        {messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-xs text-center">
            <p className="text-sm font-medium text-ink">Start the conversation</p>
            <p className="mt-1 text-[13px] text-muted">
              {view.isTutorView ? "Say hello and share how you'd approach the first lesson." : `Introduce ${view.childName ?? "yourself"} and what you'd like help with. ${view.tutor?.firstName ?? "The tutor"} will reply here.`}
            </p>
          </div>
        )}
        {groups.map((g) => (
          <section key={g.day} aria-label={dayLabel(g.day)}>
            <div className="sticky top-0 z-10 flex justify-center pb-2 pt-3">
              <span className="rounded-md border border-line bg-surface px-3 py-0.5 text-[11.5px] font-semibold text-ink-2">{dayLabel(g.day)}</span>
            </div>
            <ul className="space-y-1.5">
              <AnimatePresence initial={false}>
                {g.items.map((m, i) => {
                  const mine = m.senderId === selfId;
                  const next = g.items[i + 1];
                  const endOfRun = !next || next.senderId !== m.senderId || new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() > RUN_GAP_MS;
                  const isMyLast = myLast?.id === m.id;
                  return (
                    <motion.li
                      key={m.id}
                      layout="position"
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.32, ease: EASE }}
                      className={cn("flex flex-col", mine ? "items-end" : "items-start", endOfRun && "pb-2")}
                    >
                      <span className="sr-only">{mine ? "You" : view.counterpart}, {formatTime(m.createdAt, tz)}:</span>
                      <div
                        className={cn(
                          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[14.5px] leading-relaxed sm:max-w-[70%]",
                          mine ? "bg-brand-gradient text-white" : "bg-canvas text-ink",
                          endOfRun && (mine ? "rounded-br-md" : "rounded-bl-md"),
                        )}
                      >
                        {m.body}
                        {m.attachment && (
                          <span className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px]", m.body && "mt-2", mine ? "border-white/25 bg-white/10 text-white" : "border-line bg-canvas text-ink-2")} title="File previews aren't available in this demo">
                            <FileText className="size-4 shrink-0 opacity-80" aria-hidden />
                            <span className="min-w-0 truncate font-medium">{m.attachment.name}</span>
                            <span className="shrink-0 opacity-70">{formatSize(m.attachment.sizeKb)}</span>
                          </span>
                        )}
                      </div>
                      {m.moderation === "contact_info_masked" && (
                        <p className="mt-1 flex items-center gap-1 px-1 text-[11.5px] text-muted">
                          <ShieldCheck className="size-3 shrink-0" aria-hidden /> Contact details were hidden to keep everyone safe
                        </p>
                      )}
                      {(endOfRun || isMyLast) && (
                        <p className="mt-1 px-1 text-[11px] tabular-nums text-muted" aria-hidden={!isMyLast}>
                          {formatTime(m.createdAt, tz)}
                          {isMyLast && <span className="font-medium"> · {m.readAt ? `Seen ${formatTime(m.readAt, tz)}` : "Sent"}</span>}
                        </p>
                      )}
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </section>
        ))}
        <AnimatePresence>
          {typing && (
            <motion.div key="typing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={{ duration: 0.25, ease: EASE }} className="flex items-center gap-2 pt-1">
              <div className="flex gap-1 rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-3" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="size-1.5 rounded-full bg-muted" animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }} />
                ))}
              </div>
              <span className="text-[11.5px] text-muted">{view.tutor?.firstName ?? view.counterpart} is typing…</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Composer or blocked state */}
      {c.blockedBy ? (
        <div className="flex flex-col items-center gap-2 border-t border-line bg-canvas px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-center text-[13px] text-muted sm:flex-row sm:justify-center">
          <Ban className="size-4 shrink-0" aria-hidden />
          {blockedByMe ? (
            <>
              <span>You blocked this conversation, so neither of you can send messages.</span>
              <Button size="sm" variant="secondary" onClick={unblock}>Unblock</Button>
            </>
          ) : (
            <span>You can&apos;t reply to this conversation.</span>
          )}
        </div>
      ) : (
        <Composer conversationId={c.id} recipient={view.counterpart} onSent={onSent} />
      )}

      <ConfirmDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title={`Block ${view.counterpart}?`}
        description="Neither of you can send new messages here until you unblock. Existing messages stay visible, and lessons you've booked aren't affected."
        confirmLabel="Block"
        tone="danger"
        onConfirm={() => {
          const res = toggleBlock(c.id);
          if (!res.ok) return void toast.error(res.error);
          setBlockOpen(false);
          toast.success(`${view.counterpart} blocked`, { description: "You can unblock from the conversation menu at any time." });
        }}
      />
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} view={view} />
    </div>
  );
}

const REPORT_REASONS = [
  "Inappropriate or offensive messages",
  "Asking to pay or talk outside TutorLink",
  "Spam or scam",
  "Harassment or threats",
  "Safety concern involving a minor",
  "Something else",
];

function ReportDialog({ open, onOpenChange, view }: { open: boolean; onOpenChange: (o: boolean) => void; view: ConversationView }) {
  const report = useApp((s) => s.report);
  const [reason, setReason] = React.useState("");
  const [details, setDetails] = React.useState("");
  const [error, setError] = React.useState<string>();
  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setReason("");
      setDetails("");
      setError(undefined);
    }
  };
  const target = [...view.messages].reverse().find((m) => m.senderId !== view.selfId) ?? view.last;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return setError("Choose a reason.");
    if (!target) return setError("There are no messages to report yet.");
    const res = report({ targetType: "message", targetId: target.id, reason, details: details.trim() });
    if (!res.ok) return setError(res.error);
    toast.success("Report sent", { description: "Trust & Safety will review this conversation. You can also block this person." });
    close(false);
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title="Report conversation" description={`Tell us what's wrong. ${view.counterpart} won't be told who reported them.`}>
        <form onSubmit={submit} noValidate>
          <DialogBody className="space-y-4">
            <Field label="Reason" required error={error}>
              <Select value={reason} onChange={(e) => { setReason(e.target.value); setError(undefined); }} placeholder="Choose a reason" options={REPORT_REASONS.map((r) => ({ value: r, label: r }))} />
            </Field>
            <Field label="Details" optional hint="What happened? Our team can see the messages in this conversation.">
              <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} maxLength={1000} showCount />
            </Field>
            {view.c.involvesMinor && (
              <p className="flex items-start gap-2 rounded-lg border border-line bg-canvas px-3 py-2.5 text-[12.5px] text-ink-2">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ink" aria-hidden /> If a child is in immediate danger, contact local emergency services first.
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
            <Button type="submit" variant="danger"><Flag /> Send report</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
