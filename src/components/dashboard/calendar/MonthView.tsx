"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { subjectName } from "@/lib/data/catalog";
import { formatTime, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AnimatePresence, EASE, motion } from "@/components/motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Overlay";
import type { BookingPeople } from "@/components/dashboard/bookings/shared";
import { AgendaRow, DayHeading } from "./AgendaView";
import { EventPopover, eventLabel } from "./EventPopover";
import { fmtKey, KIND_CLASS, KIND_DOT, parseKey, type CalEvent } from "./model";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS = 3;

export function MonthView({
  days,
  monthKey,
  today,
  selected,
  eventsByDay,
  peopleFor,
  tz,
  now,
  onDayClick,
}: {
  days: string[];
  monthKey: string;
  today: string;
  selected: string;
  eventsByDay: Map<string, CalEvent[]>;
  peopleFor: (b: CalEvent["booking"]) => BookingPeople;
  tz: string;
  now: number;
  onDayClick: (d: string) => void;
}) {
  const month = parseKey(monthKey).m;
  const selectedEvents = eventsByDay.get(selected) ?? [];
  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="grid grid-cols-7 border-b border-line bg-canvas" aria-hidden>
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-1 py-2 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-muted md:px-3 md:text-left">
              <span className="md:hidden">{w.charAt(0)}</span>
              <span className="hidden md:inline">{w}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const evs = eventsByDay.get(d) ?? [];
            const inMonth = parseKey(d).m === month;
            const isToday = d === today;
            const isSelected = d === selected;
            return (
              <div key={d} className={cn("relative min-h-[3.75rem] md:min-h-[7.5rem]", i % 7 !== 0 && "border-l border-line", i >= 7 && "border-t border-line", !inMonth && "bg-canvas")}>
                <button
                  type="button"
                  onClick={() => onDayClick(d)}
                  aria-pressed={isSelected}
                  aria-label={`${fmtKey(d, { weekday: "long", month: "long", day: "numeric" })}${isToday ? ", today" : ""}: ${evs.length ? pluralize(evs.length, "lesson") : "no lessons"}`}
                  className="group absolute inset-0 flex justify-center pt-1.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink md:static md:inset-auto md:ml-1.5 md:mt-1.5 md:inline-flex md:rounded-full md:p-0"
                >
                  {isSelected && <motion.span layoutId="month-selected" className="absolute inset-1 rounded-lg bg-brand-soft ring-1 ring-brand md:hidden" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
                  <span
                    className={cn(
                      "relative grid size-7 place-items-center rounded-full text-[13px] tabular-nums transition-colors",
                      isToday ? "bg-ink font-semibold text-on-ink" : inMonth ? "text-ink group-hover:bg-canvas" : "text-subtle group-hover:bg-canvas",
                    )}
                  >
                    {parseKey(d).d}
                  </span>
                </button>

                {/* Phone: dots */}
                {evs.length > 0 && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1 md:hidden" aria-hidden>
                    {evs.slice(0, 3).map((ev) => (
                      <span key={ev.booking.id} className={cn("size-1.5 rounded-full", KIND_DOT[ev.kind])} />
                    ))}
                  </div>
                )}

                {/* Desktop: chips */}
                {evs.length > 0 && (
                  <ul className="hidden space-y-1 px-1.5 pb-1.5 pt-1 md:block">
                    {evs.slice(0, MAX_CHIPS).map((ev) => (
                      <li key={ev.booking.id}>
                        <EventPopover ev={ev} people={peopleFor(ev.booking)} tz={tz} now={now}>
                          <button
                            type="button"
                            aria-label={eventLabel(ev, peopleFor(ev.booking), tz)}
                            className={cn("flex w-full items-center gap-1 truncate rounded-sm px-1.5 py-[3px] text-left text-[11.5px] font-medium leading-tight transition-[filter] hover:brightness-[0.96]", KIND_CLASS[ev.kind])}
                          >
                            <span className="shrink-0 tabular-nums opacity-80">{formatTime(ev.booking.startUtc, tz).replace(":00", "").replace(" ", "").toLowerCase()}</span>
                            <span className="truncate">{subjectName(ev.booking.subject)}</span>
                          </button>
                        </EventPopover>
                      </li>
                    ))}
                    {evs.length > MAX_CHIPS && (
                      <li>
                        <Popover>
                          <PopoverTrigger className="w-full rounded-sm px-1.5 py-0.5 text-left text-[11.5px] font-semibold text-ink-2 hover:bg-canvas hover:text-ink">
                            +{evs.length - MAX_CHIPS} more
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-3">
                            <DayHeading day={d} today={today} count={evs.length} />
                            <ul className="mt-1 space-y-1.5">
                              {evs.map((ev, idx) => (
                                <AgendaRow key={ev.booking.id} ev={ev} people={peopleFor(ev.booking)} tz={tz} index={idx} />
                              ))}
                            </ul>
                          </PopoverContent>
                        </Popover>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Phone: the selected day's lessons */}
      <div className="mt-4 md:hidden" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={selected} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: EASE }}>
            <DayHeading day={selected} today={today} count={selectedEvents.length} />
            {selectedEvents.length ? (
              <ul className="mt-1 space-y-2">
                {selectedEvents.map((ev, idx) => (
                  <AgendaRow key={ev.booking.id} ev={ev} people={peopleFor(ev.booking)} tz={tz} index={idx} />
                ))}
              </ul>
            ) : (
              <p className="mt-1 flex items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-4 text-[13px] text-muted">
                <CalendarDays className="size-4" aria-hidden /> No lessons on this day.
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
