"use client";

import * as React from "react";
import { subjectName } from "@/lib/data/catalog";
import { formatTime } from "@/lib/format";
import { zonedParts } from "@/lib/time";
import { cn } from "@/lib/utils";
import { motion } from "@/components/motion";
import type { BookingPeople } from "@/components/dashboard/bookings/shared";
import { EventPopover, eventLabel } from "./EventPopover";
import { fmtKey, KIND_CLASS, KIND_DOT, layoutLanes, parseKey, type CalEvent, type Segment } from "./model";

const HOUR_PX = 52;
const PX_PER_MIN = HOUR_PX / 60;

export function WeekView({
  days,
  today,
  activeDay,
  onActiveDay,
  eventsByDay,
  availability,
  peopleFor,
  tz,
  now,
}: {
  days: string[];
  today: string;
  /** Phone layout shows one day at a time. */
  activeDay: string;
  onActiveDay: (d: string) => void;
  eventsByDay: Map<string, CalEvent[]>;
  availability?: Map<string, Segment[]>;
  peopleFor: (b: CalEvent["booking"]) => BookingPeople;
  tz: string;
  now: number;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const all = days.flatMap((d) => eventsByDay.get(d) ?? []);
  const segs = days.flatMap((d) => availability?.get(d) ?? []);
  const minStart = Math.min(...all.map((e) => e.startMin), ...segs.map((s) => s.startMin), 8 * 60);
  const maxEnd = Math.max(...all.map((e) => e.endMin), ...segs.map((s) => s.endMin), 21 * 60);
  const firstHour = Math.max(0, Math.floor(minStart / 60));
  const lastHour = Math.min(24, Math.ceil(maxEnd / 60));
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const height = hours.length * HOUR_PX;
  const nowParts = zonedParts(new Date(now), tz);
  const nowMin = nowParts.hour * 60 + nowParts.minute;
  const todayVisible = days.includes(today);
  const y = (min: number) => (min - firstHour * 60) * PX_PER_MIN;

  // Scroll to "now" (this week) or the first lesson — a DOM side effect, no state involved.
  const focusMin = todayVisible ? nowMin - 90 : all.length ? Math.min(...all.map((e) => e.startMin)) - 60 : 15 * 60;
  const focusTop = Math.max(0, (focusMin - firstHour * 60) * PX_PER_MIN);
  const rangeKey = days[0];
  const scrolledFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (scrolledFor.current === rangeKey) return;
    scrolledFor.current = rangeKey;
    scrollRef.current?.scrollTo({ top: focusTop, behavior: "auto" });
  }, [rangeKey, focusTop]);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      {/* Phone: day strip */}
      <div className="grid grid-cols-7 gap-1 border-b border-line p-1.5 md:hidden" role="tablist" aria-label="Day">
        {days.map((d) => {
          const active = d === activeDay;
          const evs = eventsByDay.get(d) ?? [];
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`${fmtKey(d, { weekday: "long", month: "long", day: "numeric" })}${d === today ? ", today" : ""}, ${evs.length} ${evs.length === 1 ? "lesson" : "lessons"}`}
              onClick={() => onActiveDay(d)}
              className="relative flex h-16 flex-col items-center justify-center rounded-lg"
            >
              {active && <motion.span layoutId="week-day-active" className="absolute inset-0 rounded-lg bg-ink" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
              <span className={cn("relative text-[10.5px] font-medium uppercase tracking-wide", active ? "text-on-ink/70" : "text-muted")}>{fmtKey(d, { weekday: "short" })}</span>
              <span className={cn("relative text-base font-semibold tabular-nums", active ? "text-on-ink" : d === today ? "text-ink underline decoration-brand decoration-2 underline-offset-4" : "text-ink")}>{parseKey(d).d}</span>
              <span className="relative mt-0.5 flex h-1.5 gap-0.5" aria-hidden>
                {evs.slice(0, 3).map((ev) => (
                  <span key={ev.booking.id} className={cn("size-1 rounded-full", active ? "bg-on-ink" : KIND_DOT[ev.kind])} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {/* Desktop: column headers */}
      <div className="hidden grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-line md:grid" aria-hidden>
        <div />
        {days.map((d) => (
          <div key={d} className="border-l border-line px-2 py-2.5 text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{fmtKey(d, { weekday: "short" })}</p>
            <p className={cn("mx-auto mt-0.5 grid size-8 place-items-center rounded-full text-base font-semibold tabular-nums", d === today ? "bg-ink text-on-ink" : "text-ink")}>{parseKey(d).d}</p>
          </div>
        ))}
      </div>

      <div ref={scrollRef} className="relative max-h-[min(40rem,calc(100dvh-17rem))] overflow-y-auto overscroll-contain" tabIndex={0} aria-label={`Lessons from ${fmtKey(days[0], { month: "long", day: "numeric" })} to ${fmtKey(days[days.length - 1], { month: "long", day: "numeric" })}`}>
        <div className="relative grid grid-cols-[3rem_minmax(0,1fr)] md:grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]" style={{ height }}>
          {/* Hour gutter */}
          <div className="relative" aria-hidden>
            {hours.map((h, i) =>
              i === 0 ? null : (
                <span key={h} className="absolute right-2 -translate-y-1/2 text-[10.5px] tabular-nums text-muted" style={{ top: i * HOUR_PX }}>
                  {h === 12 ? "12 PM" : h === 0 ? "12 AM" : h > 12 ? `${h - 12} PM` : `${h} AM`}
                </span>
              ),
            )}
          </div>

          {days.map((d) => {
            const evs = layoutLanes(eventsByDay.get(d) ?? []);
            const avail = availability?.get(d) ?? [];
            const isToday = d === today;
            return (
              <div
                key={d}
                className={cn("relative border-l border-line", d !== activeDay && "hidden md:block", isToday && "bg-canvas/60")}
                style={{ backgroundImage: "linear-gradient(to bottom, var(--color-line) 1px, transparent 1px)", backgroundSize: `100% ${HOUR_PX}px` }}
              >
                {avail.map((s, i) => (
                  <div
                    key={i}
                    aria-hidden
                    className="absolute inset-x-0 bg-teal-soft/60"
                    style={{ top: y(s.startMin), height: (s.endMin - s.startMin) * PX_PER_MIN }}
                  />
                ))}
                {evs.map(({ ev, lane, lanes }) => {
                  const top = y(ev.startMin);
                  const h = Math.max((ev.endMin - ev.startMin) * PX_PER_MIN - 2, 22);
                  const people = peopleFor(ev.booking);
                  return (
                    <EventPopover key={ev.booking.id} ev={ev} people={people} tz={tz} now={now}>
                      <button
                        type="button"
                        aria-label={eventLabel(ev, people, tz)}
                        className={cn("absolute z-10 overflow-hidden rounded-md px-1.5 py-1 text-left text-[11.5px] leading-tight transition-[filter] hover:z-20 hover:brightness-[0.96]", KIND_CLASS[ev.kind])}
                        style={{ top: top + 1, height: h, left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}
                      >
                        <span className="block truncate font-semibold">{subjectName(ev.booking.subject)}</span>
                        {h > 34 && <span className="block truncate tabular-nums opacity-80">{formatTime(ev.booking.startUtc, tz)}</span>}
                        {h > 50 && <span className="block truncate opacity-80">{people.childName ?? people.counterpart}</span>}
                      </button>
                    </EventPopover>
                  );
                })}
                {isToday && nowMin >= firstHour * 60 && nowMin <= lastHour * 60 && (
                  <div className="pointer-events-none absolute inset-x-0 z-30" style={{ top: y(nowMin) }} aria-hidden>
                    <div className="relative h-0.5 bg-ink">
                      <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-ink ring-2 ring-surface" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
