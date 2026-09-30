"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { subjectName, MODE_LABEL } from "@/lib/data/catalog";
import { formatDuration, formatTime, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE, motion } from "@/components/motion";
import { Badge } from "@/components/ui/Badge";
import { BookingStatusBadge } from "@/components/domain/Badges";
import type { BookingPeople } from "@/components/dashboard/bookings/shared";
import { fmtKey, type CalEvent, type EventKind } from "./model";

const BAR: Record<EventKind, string> = {
  confirmed: "bg-brand",
  pending: "border-l-2 border-dashed border-ink",
  done: "bg-line-strong",
  failed: "border-l-2 border-dashed border-danger",
  cancelled: "bg-line",
};

export function AgendaRow({ ev, people, tz, index = 0 }: { ev: CalEvent; people: BookingPeople; tz: string; index?: number }) {
  const b = ev.booking;
  return (
    <motion.li initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE, delay: Math.min(index, 12) * 0.03 }}>
      <Link
        href={`/dashboard/bookings/${b.id}`}
        className="group flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 transition-colors hover:border-ink"
      >
        <div className="w-[4.25rem] shrink-0 text-[12.5px] tabular-nums">
          <span className={cn("block font-medium text-ink", ev.kind === "cancelled" && "text-muted line-through")}>{formatTime(b.startUtc, tz)}</span>
          <span className="text-muted">{formatDuration(b.durationMin)}</span>
        </div>
        <span className={cn("w-1 self-stretch rounded-full", BAR[ev.kind])} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className={cn("flex items-center gap-1.5 truncate text-sm font-medium text-ink", ev.kind === "cancelled" && "text-muted line-through")}>
            <span className="truncate">{subjectName(b.subject)}</span>
            {b.type === "trial" && <Badge tone="outline" size="sm" className="no-underline">Trial</Badge>}
          </p>
          <p className="truncate text-[12.5px] text-muted">
            with {people.counterpart}
            {people.childName && ` · for ${people.childName}`} · {MODE_LABEL[b.mode]}
          </p>
        </div>
        <BookingStatusBadge status={b.status} className="hidden shrink-0 sm:inline-flex" />
        <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
      </Link>
    </motion.li>
  );
}

export function DayHeading({ day, today, count, sticky }: { day: string; today: string; count: number; sticky?: boolean }) {
  const rel = day === today ? "Today" : fmtKey(day, { weekday: "long" });
  return (
    <h3 className={cn("flex items-baseline justify-between gap-3 bg-surface py-2 text-[13px]", sticky && "sticky top-16 z-10")}>
      <span>
        <span className={cn("font-semibold", day === today ? "text-ink" : "text-ink")}>{rel}</span>
        <span className="text-muted"> · {fmtKey(day, { month: "short", day: "numeric" })}</span>
      </span>
      <span className="text-[12px] text-muted">{pluralize(count, "lesson")}</span>
    </h3>
  );
}

export function AgendaView({ days, today, eventsByDay, peopleFor, tz }: { days: string[]; today: string; eventsByDay: Map<string, CalEvent[]>; peopleFor: (b: CalEvent["booking"]) => BookingPeople; tz: string }) {
  const groups = days
    .map((d) => ({ day: d, evs: eventsByDay.get(d) ?? [] }))
    .filter((g) => g.evs.length)
    .map((g, i, all) => ({ ...g, offset: all.slice(0, i).reduce((sum, x) => sum + x.evs.length, 0) }));
  return (
    <div className="space-y-4">
      {groups.map(({ day: d, evs, offset }) => (
        <section key={d} aria-label={fmtKey(d, { weekday: "long", month: "long", day: "numeric" })}>
          <DayHeading day={d} today={today} count={evs.length} sticky />
          <ul className="mt-1 space-y-2">
            {evs.map((ev, i) => (
              <AgendaRow key={ev.booking.id} ev={ev} people={peopleFor(ev.booking)} tz={tz} index={offset + i} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
