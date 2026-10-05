"use client";

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Check, CalendarClock, CircleX, CreditCard, Flag, Play, CircleCheck, Star, UserX, Video, ChevronDown } from "lucide-react";
import type { Booking, BookingStatus } from "@/lib/types";
import type { Actor } from "@/lib/booking";
import { ACTION_LABEL, TRANSITIONS, availableTransitions, canTransition, meetingLinkVisible, policySummary, startMs } from "@/lib/booking";
import type { BookingPolicy } from "@/lib/data/platform";
import { cn } from "@/lib/utils";
import { AnimatePresence, EASE, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import type { ConfirmableTransition } from "./BookingDialogs";

export type LessonDialog = "cancel" | "decline" | "reschedule" | "dispute" | ConfirmableTransition;

export interface LessonAction {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "danger" | "default";
  /** Opens a dialog, runs a handler, or links out. */
  dialog?: LessonDialog;
  onSelect?: () => void;
  href?: string;
  disabledReason?: string;
}

const ICONS: Partial<Record<BookingStatus, React.ComponentType<{ className?: string }>>> = {
  confirmed: Check,
  in_progress: Play,
  completed: CircleCheck,
  rescheduled: CalendarClock,
  cancelled_by_student: CircleX,
  cancelled_by_tutor: CircleX,
  no_show_student: UserX,
  no_show_tutor: UserX,
  disputed: Flag,
  pending: CreditCard,
};

/** Builds the lesson's actions from the state machine — the UI only ever requests transitions. */
export function buildLessonActions(
  b: Booking,
  actor: Actor,
  now: number,
  policy: BookingPolicy,
  opts: { onAccept: () => void; onReview: () => void },
): { primary: LessonAction | null; items: LessonAction[] } {
  const allowed = availableTransitions(b, actor, now, policy);
  const items: LessonAction[] = [];
  const add = (to: BookingStatus, extra: Partial<LessonAction> = {}) =>
    items.push({ key: to, label: ACTION_LABEL[to] ?? to, icon: ICONS[to] ?? Check, ...extra });

  const cancelTo: BookingStatus = actor === "tutor" ? "cancelled_by_tutor" : "cancelled_by_student";

  if (allowed.includes("confirmed")) add("confirmed", { onSelect: opts.onAccept, tone: "primary" });
  if (allowed.includes("pending")) add("pending", { dialog: "pending", tone: "primary" });
  // Starting a lesson whose time has fully passed isn't useful — wrap it up instead.
  if (allowed.includes("in_progress") && now < startMs(b) + b.durationMin * 60_000) add("in_progress", { dialog: "in_progress" });
  if (allowed.includes("completed")) add("completed", { dialog: "completed" });
  if (allowed.includes("rescheduled")) add("rescheduled", { dialog: "reschedule" });
  if (allowed.includes(cancelTo)) {
    if (actor === "tutor" && b.status === "pending") add(cancelTo, { label: "Decline request", dialog: "decline", tone: "danger" });
    else add(cancelTo, { dialog: "cancel", tone: "danger" });
  }
  for (const ns of ["no_show_student", "no_show_tutor"] as const) {
    if (allowed.includes(ns)) add(ns, { dialog: ns, tone: "danger" });
  }
  // "Report a problem" (disputed) lives in the post-lesson section, next to the review.

  // Blocked-but-relevant actions stay visible with the reason, so people know what's possible and when.
  const explain = (to: BookingStatus, onlyAfterStart = false) => {
    if (allowed.includes(to) || items.some((i) => i.key === to)) return;
    const rule = TRANSITIONS[b.status][to];
    if (!rule || !rule.actors.includes(actor)) return;
    if (onlyAfterStart && now < startMs(b)) return;
    const check = canTransition(b, to, actor, now, policy);
    if (!check.ok) add(to, { disabledReason: check.reason, tone: to === cancelTo ? "danger" : "default" });
  };
  explain("rescheduled");
  explain(cancelTo);
  explain(actor === "tutor" ? "no_show_student" : "no_show_tutor", true);

  // Primary: Join › Accept › Retry payment › wrap-up › Start › Review
  let primary: LessonAction | null = null;
  if (meetingLinkVisible(b, now, policy) && b.meetingUrl) primary = { key: "join", label: "Join lesson", icon: Video, href: `/classroom/${b.id}`, tone: "primary" };
  else primary =
    items.find((i) => i.key === "confirmed" && !i.disabledReason) ??
    items.find((i) => i.key === "pending" && !i.disabledReason) ??
    items.find((i) => i.key === "completed" && !i.disabledReason && (b.status === "in_progress" || now >= startMs(b) + b.durationMin * 60_000)) ??
    items.find((i) => i.key === "in_progress" && !i.disabledReason) ??
    null;
  if (!primary && actor === "booker" && b.status === "completed" && !b.reviewId) primary = { key: "review", label: "Leave a review", icon: Star, onSelect: opts.onReview, tone: "primary" };
  if (primary) primary = { ...primary, tone: "primary" };

  return { primary, items: items.filter((i) => i.key !== primary?.key) };
}

function ActionButton({ action, onDialog, block, size = "md" }: { action: LessonAction; onDialog: (d: LessonDialog) => void; block?: boolean; size?: "md" | "lg" }) {
  const Icon = action.icon;
  const variant = action.tone === "primary" ? "primary" : action.tone === "danger" ? "danger-outline" : "secondary";
  if (action.href) {
    return (
      <Button asChild variant={variant} size={size} className={cn(block && "w-full")}>
        <Link href={action.href}>
          <Icon /> {action.label}
        </Link>
      </Button>
    );
  }
  return (
    <Button
      variant={variant}
      size={size}
      className={cn(block && "w-full", "justify-center")}
      disabled={!!action.disabledReason}
      aria-describedby={action.disabledReason ? `why-${action.key}` : undefined}
      onClick={() => (action.dialog ? onDialog(action.dialog) : action.onSelect?.())}
    >
      <Icon /> {action.label}
    </Button>
  );
}

export function LessonActionsPanel({
  booking,
  primary,
  items,
  onDialog,
  policy,
  statusNote,
}: {
  booking: Booking;
  primary: LessonAction | null;
  items: LessonAction[];
  onDialog: (d: LessonDialog) => void;
  policy: BookingPolicy;
  statusNote: string;
}) {
  const [policyOpen, setPolicyOpen] = React.useState(false);
  return (
    <Card>
      <CardHeader title="Manage lesson" description={statusNote} />
      <CardContent className="space-y-2.5 pt-4">
        {primary && <ActionButton action={primary} onDialog={onDialog} block />}
        <AnimatePresence initial={false}>
          {items.map((a) => (
            <motion.div key={a.key} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>
              <ActionButton action={a} onDialog={onDialog} block />
              {a.disabledReason && (
                <p id={`why-${a.key}`} className="mt-1 px-0.5 text-[12.5px] leading-snug text-muted">
                  {a.disabledReason}
                </p>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {!primary && !items.length && <p className="rounded-lg bg-canvas px-3 py-2.5 text-[13px] text-muted">There&apos;s nothing to do on this lesson right now.</p>}
        <div className="border-t border-line pt-3">
          <button
            type="button"
            onClick={() => setPolicyOpen((o) => !o)}
            aria-expanded={policyOpen}
            aria-controls="lesson-policy"
            className="flex w-full items-center justify-between gap-2 rounded-md py-1 text-[13px] font-medium text-ink-2 hover:text-ink"
          >
            {booking.type === "trial" ? "Trial" : "Lesson"} cancellation policy
            <ChevronDown className={cn("size-4 text-muted transition-transform duration-200", policyOpen && "rotate-180")} aria-hidden />
          </button>
          <AnimatePresence initial={false}>
            {policyOpen && (
              <motion.ul
                id="lesson-policy"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="space-y-1 overflow-hidden text-[12.5px] leading-snug text-muted"
              >
                {policySummary(booking.type, policy).map((l) => (
                  <li key={l} className="flex gap-2 first:pt-1.5">
                    <span className="mt-[7px] size-1 shrink-0 rounded-full bg-subtle" aria-hidden />
                    {l}
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}

/** Mobile-only sticky bar that keeps the one action that matters in reach. Rendered into <body> so it isn't affected by page transitions. */
export function StickyActionBar({ primary, onDialog, caption }: { primary: LessonAction; onDialog: (d: LessonDialog) => void; caption: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <motion.div
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay: 0.2 }}
      data-fixed-bottom className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden"
    >
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="min-w-0 flex-1 text-[12.5px] leading-snug text-muted">{caption}</div>
        <div className="shrink-0 [&_a]:h-11 [&_button]:h-11">
          <ActionButton action={primary} onDialog={onDialog} />
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}
