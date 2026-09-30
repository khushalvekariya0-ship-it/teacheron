"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Clock, Video, X } from "lucide-react";
import type { Booking } from "@/lib/types";
import type { Actor } from "@/lib/booking";
import { canTransition, meetingLinkVisible } from "@/lib/booking";
import { useApp } from "@/lib/store";
import { subjectName, MODE_LABEL } from "@/lib/data/catalog";
import { formatCents, formatDuration, formatWeekdayDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { BookingStatusBadge } from "@/components/domain/Badges";
import { DeclineDialog } from "./BookingDialogs";
import { DateBlock, ModeIcon, needsWrapUp, timeRange, tzShort, type BookingPeople } from "./shared";

export function BookingRow({ booking: b, people, actor, now, tz }: { booking: Booking; people: BookingPeople; actor: Actor | null; now: number; tz: string }) {
  const transition = useApp((s) => s.transitionBooking);
  const policy = useApp((s) => s.policy);
  const [declineOpen, setDeclineOpen] = React.useState(false);
  const canAccept = actor === "tutor" && canTransition(b, "confirmed", actor, now, policy).ok;
  const canDecline = actor === "tutor" && b.status === "pending" && canTransition(b, "cancelled_by_tutor", actor, now, policy).ok;
  const joinable = meetingLinkVisible(b, now, policy) && !!b.meetingUrl;
  const wrapUp = needsWrapUp(b, now);
  const muted = ["cancelled_by_student", "cancelled_by_tutor", "rescheduled", "refunded"].includes(b.status);
  const total = b.priceCents - b.discountCents;
  const subject = subjectName(b.subject);
  const href = `/dashboard/bookings/${b.id}`;

  const accept = () => {
    const res = transition(b.id, "confirmed");
    if (!res.ok) return void toast.error(res.error);
    toast.success("Booking accepted", { description: `${people.counterpart} has been notified.` });
  };

  let hint: React.ReactNode = null;
  if (actor === "booker" && b.status === "pending" && !wrapUp) hint = <>Waiting for {people.tutor?.firstName ?? "the tutor"} to respond</>;
  else if (actor === "booker" && b.status === "payment_failed") hint = <span className="text-danger">Payment failed · action needed</span>;
  else if (wrapUp && actor === "tutor") hint = <span className="text-warning">Ended · mark as completed</span>;
  else if (wrapUp) hint = <>Ended · completes automatically 24 hours after the lesson unless a problem is reported</>;
  else if (b.status === "pending" && actor === "tutor") hint = <span className="text-ink-2">Needs your response</span>;

  const actions = (
    <>
      {joinable && (
        <Button asChild size="sm">
          <a href={b.meetingUrl} target="_blank" rel="noopener noreferrer">
            <Video /> Join<span className="sr-only"> {subject} lesson (opens in a new tab)</span>
          </a>
        </Button>
      )}
      {canAccept && (
        <Button size="sm" onClick={accept}>
          <Check /> Accept<span className="sr-only"> request from {people.counterpart}</span>
        </Button>
      )}
      {canDecline && (
        <Button size="sm" variant="secondary" onClick={() => setDeclineOpen(true)}>
          <X /> Decline<span className="sr-only"> request from {people.counterpart}</span>
        </Button>
      )}
    </>
  );
  const hasActions = joinable || canAccept || canDecline;

  return (
    <div className={cn("group relative rounded-xl border border-line bg-surface p-3.5 transition-colors duration-200 hover:border-ink sm:p-4", b.status === "in_progress" && "border-ink")}>
      <Link href={href} className="absolute inset-0 z-0 rounded-xl focus-visible:outline-offset-[-2px]" aria-label={`${subject}${b.type === "trial" ? " trial" : ""} lesson with ${people.counterpart}, ${formatWeekdayDate(b.startUtc, tz)} ${timeRange(b, tz)}`} />
      <div className="pointer-events-none relative flex gap-3.5 sm:gap-4">
        <DateBlock iso={b.startUtc} tz={tz} muted={muted} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className={cn("truncate text-[15px] font-semibold tracking-tight text-ink", muted && "text-ink-2")}>{subject}</p>
            {b.type === "trial" && <Badge tone="outline" size="sm">Trial</Badge>}
            <BookingStatusBadge status={b.status} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Clock className="size-3.5" aria-hidden />
              {timeRange(b, tz)} <span className="text-subtle">{tzShort(tz, b.startUtc)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ModeIcon mode={b.mode} /> <span aria-hidden>{MODE_LABEL[b.mode]}</span>
            </span>
            <span className="hidden sm:inline">{formatDuration(b.durationMin)}</span>
          </p>
          <div className="mt-2 flex min-w-0 items-center gap-2 text-[13px] text-ink-2">
            <Avatar name={people.counterpart} tone={people.counterpartTone} size="xs" />
            <span className="truncate">
              with <span className="font-medium text-ink">{people.counterpart}</span>
              {people.childName && <span className="text-muted"> · for {people.childName}</span>}
            </span>
          </div>
          {hint && <p className="mt-1.5 text-[12.5px] font-medium text-muted">{hint}</p>}
        </div>
        <div className="hidden shrink-0 flex-col items-end justify-between gap-3 sm:flex">
          <p className={cn("text-[15px] font-semibold tabular-nums text-ink", muted && "text-muted line-through decoration-line-strong")}>
            {total > 0 ? formatCents(total) : b.type === "trial" ? "Free trial" : formatCents(0)}
          </p>
          {hasActions && <div className="pointer-events-auto relative z-10 flex gap-2">{actions}</div>}
        </div>
      </div>
      {/* Mobile: price + actions on their own row, full width touch targets */}
      <div className="pointer-events-none relative mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 sm:hidden">
        <p className={cn("text-sm font-semibold tabular-nums text-ink", muted && "text-muted line-through")}>{total > 0 ? formatCents(total) : b.type === "trial" ? "Free trial" : formatCents(0)}</p>
        {hasActions ? <div className="pointer-events-auto relative z-10 flex gap-2 [&>*]:h-10">{actions}</div> : <span className="text-[12.5px] font-medium text-ink">View details</span>}
      </div>
      {canDecline && <DeclineDialog booking={b} open={declineOpen} onOpenChange={setDeclineOpen} counterpart={people.counterpart} />}
    </div>
  );
}
