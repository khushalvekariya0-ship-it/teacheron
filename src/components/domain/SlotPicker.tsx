"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarX2, ChevronLeft, ChevronRight, Globe } from "lucide-react";
import type { Tutor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useViewerTimezone } from "@/lib/store/hooks";
import { generateSlots, groupSlotsByDay } from "@/lib/time";
import { formatTime, tzAbbrev } from "@/lib/format";
import { EmptyState } from "@/components/ui/States";

/**
 * Pick a start time from the tutor's real availability, in the viewer's time zone.
 * Existing bookings, buffers, minimum notice and the advance window are all respected.
 * Pass `excludeBookingId` when rescheduling so the lesson being moved doesn't block itself.
 */
export function SlotPicker({
  tutor,
  durationMin,
  value,
  onChange,
  excludeBookingId,
  days = 21,
}: {
  tutor: Tutor;
  durationMin: number;
  value: string | null;
  onChange: (startUtc: string | null) => void;
  excludeBookingId?: string;
  days?: number;
}) {
  const tz = useViewerTimezone();
  const allBookings = useApp((s) => s.bookings);
  const bookings = React.useMemo(() => allBookings.filter((b) => b.id !== excludeBookingId), [allBookings, excludeBookingId]);
  const groups = React.useMemo(() => groupSlotsByDay(generateSlots(tutor, { durationMin, viewerTz: tz, bookings, days })), [tutor, durationMin, tz, bookings, days]);
  const [dayKey, setDayKey] = React.useState<string | null>(null);
  const railRef = React.useRef<HTMLDivElement>(null);

  const selectedDay = groups.find((g) => g.day === dayKey) ?? groups[0];
  // If the chosen time disappears (e.g. duration changed), clear it.
  const valueStillValid = !value || groups.some((g) => g.slots.some((s) => s.startUtc === value));
  React.useEffect(() => {
    if (!valueStillValid) onChange(null);
  }, [valueStillValid, onChange]);

  if (!groups.length) {
    return (
      <div className="rounded-xl border border-line">
        <EmptyState compact icon={<CalendarX2 />} title="No open times right now" description="This tutor has no availability in the next few weeks. Send a message to ask about other times." />
      </div>
    );
  }

  const dayLabel = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12));
    return {
      weekday: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date),
      day: d,
      month: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date),
    };
  };

  const scroll = (dir: 1 | -1) => railRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });

  return (
    <div>
      <div className="relative">
        <div ref={railRef} className="scrollbar-none -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" role="listbox" aria-label="Choose a day">
          {groups.map((g) => {
            const l = dayLabel(g.day);
            const active = g.day === selectedDay.day;
            return (
              <button
                key={g.day}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => setDayKey(g.day)}
                className={cn(
                  "relative flex w-[68px] shrink-0 snap-start flex-col items-center rounded-lg border py-2.5 transition-colors",
                  active ? "border-navy text-on-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong",
                )}
              >
                {active && <motion.span layoutId={`slot-day-${tutor.id}`} className="absolute inset-0 rounded-[7px] bg-navy" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
                <span className={cn("relative text-[11px] font-medium uppercase tracking-wide", active ? "text-on-ink/70" : "text-muted")}>{l.weekday}</span>
                <span className="relative text-lg font-semibold leading-tight tabular-nums">{l.day}</span>
                <span className={cn("relative text-[11px]", active ? "text-on-ink/70" : "text-muted")}>{g.slots.length} open</span>
              </button>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-16 items-center justify-end bg-gradient-to-l from-surface to-transparent sm:flex">
          <button type="button" onClick={() => scroll(1)} className="pointer-events-auto grid size-7 place-items-center rounded-full border border-line bg-surface shadow-xs hover:bg-canvas" aria-label="Later days">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-10 items-center bg-gradient-to-r from-surface to-transparent sm:flex">
          <button type="button" onClick={() => scroll(-1)} className="pointer-events-auto grid size-7 place-items-center rounded-full border border-line bg-surface shadow-xs hover:bg-canvas" aria-label="Earlier days">
            <ChevronLeft className="size-4" />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedDay.day}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          role="radiogroup"
          aria-label="Choose a start time"
          className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4"
        >
          {selectedDay.slots.map((s) => {
            const active = s.startUtc === value;
            return (
              <button
                key={s.startUtc}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(s.startUtc)}
                className={cn(
                  "h-10 rounded-md border text-sm font-medium tabular-nums transition-[background-color,border-color,color] duration-150",
                  active ? "border-navy bg-navy text-on-ink" : "border-line bg-surface text-ink-2 hover:border-navy/40 hover:text-ink",
                )}
              >
                {formatTime(s.startUtc, tz)}
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>

      <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-muted">
        <Globe className="size-3.5" /> Times shown in your time zone ({tzAbbrev(tz)}). {tutor.firstName} teaches from {tzAbbrev(tutor.timezone)}.
      </p>
    </div>
  );
}
