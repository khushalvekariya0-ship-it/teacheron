"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Booking, BookingEvent, BookingStatus, User } from "@/lib/types";
import { STATUS_META } from "@/lib/booking";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE, motion } from "@/components/motion";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { shortName, type BookingPeople } from "./shared";

function eventTitle(e: BookingEvent, b: Booking): string {
  if (e.from === null && e.to === "pending") return b.type === "trial" ? "Trial requested" : "Lesson requested";
  if (e.from === null && e.to === "confirmed") return "Lesson booked";
  if (e.from === "payment_failed" && e.to === "pending") return "Payment retried";
  const custom: Partial<Record<BookingStatus, string>> = {
    confirmed: "Confirmed",
    in_progress: "Lesson started",
    completed: "Completed",
    rescheduled: "Rescheduled",
    disputed: "Problem reported",
    payment_failed: "Payment failed",
  };
  return custom[e.to] ?? STATUS_META[e.to].label;
}

const DOT: Record<string, string> = {
  success: "bg-success",
  accent: "bg-ink",
  warning: "bg-warning",
  danger: "bg-danger",
  neutral: "bg-line-strong",
};

export function LessonTimeline({ booking: b, me, people, users, tutorUserId, tz, rescheduledTo, rescheduledFrom }: {
  booking: Booking;
  me: User;
  people: BookingPeople;
  users: User[];
  tutorUserId?: string;
  tz: string;
  rescheduledTo?: Booking;
  rescheduledFrom?: Booking;
}) {
  const who = (by: BookingEvent["by"]) => {
    if (by === "system") return "TutorLink";
    if (by === me.id || (me.tutorId && by === me.tutorId)) return "You";
    if (by === b.tutorId || by === tutorUserId) return people.tutor ? shortName(people.tutor) : "Tutor";
    if (by === b.bookerId) return people.booker ? shortName(people.booker) : "Student";
    const u = users.find((x) => x.id === by);
    if (u && (u.role === "admin" || u.role === "support")) return "TutorLink support";
    return u ? shortName(u) : "TutorLink";
  };
  const events = b.history;

  return (
    <Card>
      <CardHeader title="Activity" description="Every change to this booking, with who made it and when." />
      <CardContent className="pt-4">
        <ol className="relative">
          <motion.span
            aria-hidden
            className="absolute bottom-3 left-[7px] top-3 w-px origin-top bg-line"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.6 + events.length * 0.08, ease: EASE }}
          />
          {events.map((e, i) => {
            const last = i === events.length - 1;
            const tone = STATUS_META[e.to].tone;
            return (
              <motion.li
                key={`${e.at}-${i}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: 0.1 + i * 0.08 }}
                className={cn("relative pl-8", !last && "pb-5")}
              >
                <span className={cn("absolute left-0 top-1 grid size-[15px] place-items-center rounded-full border-2 border-surface ring-1 ring-line", last ? DOT[tone] : "bg-surface")} aria-hidden>
                  {!last && <span className={cn("size-[7px] rounded-full", DOT[tone])} />}
                </span>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-[13.5px] font-medium text-ink">
                    {eventTitle(e, b)} <span className="font-normal text-muted">by {who(e.by)}</span>
                  </p>
                  <time dateTime={e.at} className="text-[12px] tabular-nums text-muted">
                    {formatDateTime(e.at, tz)}
                  </time>
                </div>
                {e.note && <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{e.note}</p>}
              </motion.li>
            );
          })}
        </ol>
        {(rescheduledTo || rescheduledFrom) && (
          <div className="mt-5 space-y-2 border-t border-line pt-4">
            {rescheduledTo && (
              <Link href={`/dashboard/bookings/${rescheduledTo.id}`} className="group flex items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5 text-[13.5px] transition-colors hover:border-ink">
                <span>
                  <span className="font-medium text-ink">Moved to {formatDateTime(rescheduledTo.startUtc, tz)}</span>
                  <span className="block text-[12.5px] text-muted">View the new lesson</span>
                </span>
                <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
              </Link>
            )}
            {rescheduledFrom && (
              <Link href={`/dashboard/bookings/${rescheduledFrom.id}`} className="group flex items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5 text-[13.5px] transition-colors hover:border-ink">
                <span>
                  <span className="font-medium text-ink">Rescheduled from {formatDateTime(rescheduledFrom.startUtc, tz)}</span>
                  <span className="block text-[12.5px] text-muted">View the original booking</span>
                </span>
                <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
