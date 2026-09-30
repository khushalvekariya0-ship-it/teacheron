"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, Clock, Search } from "lucide-react";
import type { Booking } from "@/lib/types";
import { endMs } from "@/lib/booking";
import { useNow, useSession, useTutor, useViewerTimezone } from "@/lib/store/hooks";
import { formatDateTime, pluralize } from "@/lib/format";
import { dateKey } from "@/lib/time";
import { cn } from "@/lib/utils";
import { AnimatePresence, EASE, motion } from "@/components/motion";
import { PageHeader } from "@/components/dashboard/Shell";
import { Button } from "@/components/ui/Button";
import { Segmented, Switch } from "@/components/ui/Controls";
import { EmptyState } from "@/components/ui/States";
import { useMyBookings, usePeople, viewerKind } from "@/components/dashboard/bookings/shared";
import { AgendaView } from "./AgendaView";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import {
  addDays, addMonths, availabilityByDay, daysBetween, fmtKey, KIND_CLASS, kindOf, monthGrid, startOfMonth, startOfWeek, toEvent, type CalEvent, type EventKind,
} from "./model";

type View = "month" | "week" | "agenda";
const AGENDA_DAYS = 14;
const UNIT: Record<View, string> = { month: "month", week: "week", agenda: "two weeks" };

const slide = {
  enter: (d: number) => ({ opacity: 0, x: d * 18 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -18 }),
};

function tzLongName(tz: string, now: number): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "long" }).formatToParts(new Date(now)).find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

export function CalendarView() {
  const me = useSession();
  const tz = useViewerTimezone();
  const now = useNow(60_000);
  const bookings = useMyBookings();
  const peopleFor = usePeople();
  const tutor = useTutor(me?.role === "tutor" ? me.tutorId : undefined);
  const today = dateKey(new Date(now), tz);

  const [view, setView] = React.useState<View>(() => (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? "agenda" : "week"));
  const [anchor, setAnchor] = React.useState(today);
  const [selected, setSelected] = React.useState(today);
  const [dir, setDir] = React.useState(0);
  const [showCancelled, setShowCancelled] = React.useState(false);

  const range = React.useMemo(() => {
    if (view === "month") {
      const first = startOfMonth(anchor);
      return { key: first, days: monthGrid(anchor), label: fmtKey(first, { month: "long", year: "numeric" }), inRange: (d: string) => d.slice(0, 7) === first.slice(0, 7) };
    }
    const start = view === "week" ? startOfWeek(anchor) : anchor;
    const days = daysBetween(start, view === "week" ? 7 : AGENDA_DAYS);
    const a = days[0];
    const b = days[days.length - 1];
    const sameMonth = a.slice(0, 7) === b.slice(0, 7);
    const label = `${fmtKey(a, { month: "short", day: "numeric" })} – ${sameMonth ? fmtKey(b, { day: "numeric" }) : fmtKey(b, { month: "short", day: "numeric" })}, ${fmtKey(b, { year: "numeric" })}`;
    return { key: a, days, label, inRange: (d: string) => d >= a && d <= b };
  }, [view, anchor]);

  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const b of bookings) {
      if (!showCancelled && kindOf(b.status) === "cancelled") continue;
      const ev = toEvent(b, tz);
      map.set(ev.day, [...(map.get(ev.day) ?? []), ev]);
    }
    for (const list of map.values()) list.sort((x, y) => x.startMin - y.startMin);
    return map;
  }, [bookings, showCancelled, tz]);

  const availability = React.useMemo(() => (tutor && view === "week" ? availabilityByDay(tutor, range.days, tz) : undefined), [tutor, view, range.days, tz]);

  if (!me) return null;
  const kind = viewerKind(me);
  const countInRange = range.days.filter(range.inRange).reduce((n, d) => n + (eventsByDay.get(d)?.length ?? 0), 0);
  const activeDay = range.days.includes(selected) && range.inRange(selected) ? selected : range.inRange(today) ? today : range.days.find(range.inRange) ?? range.days[0];
  const nextLesson: Booking | undefined = bookings
    .filter((b) => ["pending", "confirmed", "in_progress"].includes(b.status) && endMs(b) > now)
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc))[0];
  const nextKey = nextLesson ? dateKey(new Date(nextLesson.startUtc), tz) : null;

  const go = (step: -1 | 1) => {
    setDir(step);
    setAnchor((a) => (view === "month" ? addMonths(a, step) : addDays(a, step * (view === "week" ? 7 : AGENDA_DAYS))));
  };
  const jump = (day: string) => {
    setDir(day > anchor ? 1 : day < anchor ? -1 : 0);
    setAnchor(day);
    setSelected(day);
  };
  const changeView = (v: View) => {
    setDir(0);
    setView(v);
  };
  const onDayClick = (d: string) => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      setDir(0);
      setView("week");
      setAnchor(d);
    }
    setSelected(d);
  };

  const legend: EventKind[] = ["confirmed", "pending", "done", ...(bookings.some((b) => b.status === "payment_failed") ? (["failed"] as const) : []), ...(showCancelled ? (["cancelled"] as const) : [])];

  return (
    <div>
      <PageHeader
        title="Calendar"
        description={`Your lessons in ${tzLongName(tz, now)}.${kind === "tutor" ? " Shaded areas in week view are your weekly availability." : ""}`}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/dashboard/bookings">
                <BookOpen /> Bookings
              </Link>
            </Button>
            {kind === "tutor" ? (
              <Button asChild>
                <Link href="/dashboard/availability">
                  <Clock /> Edit availability
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/tutors">
                  <Search /> Find a tutor
                </Link>
              </Button>
            )}
          </>
        }
      />

      {/* Toolbar */}
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => jump(today)} disabled={range.inRange(today) && activeDay === today}>
            Today
          </Button>
          <div className="flex">
            <Button variant="ghost" size="icon-sm" onClick={() => go(-1)} aria-label={`Previous ${UNIT[view]}`}>
              <ChevronLeft />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => go(1)} aria-label={`Next ${UNIT[view]}`}>
              <ChevronRight />
            </Button>
          </div>
          <h2 className="min-w-0 truncate text-[17px] font-semibold tracking-tight text-ink" aria-live="polite">
            {range.label}
            <span className="ml-2 text-[13px] font-normal text-muted">{pluralize(countInRange, "lesson")}</span>
          </h2>
        </div>
        <Segmented<View>
          label="Calendar view"
          value={view}
          onChange={changeView}
          options={[
            { value: "month", label: "Month" },
            { value: "week", label: "Week" },
            { value: "agenda", label: "Agenda" },
          ]}
          className="self-start md:self-auto"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[12px] text-muted" aria-label="Legend">
          {legend.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className={cn("h-3 w-5 rounded-xs no-underline", KIND_CLASS[k])} aria-hidden />
              {k === "done" ? "Completed" : k === "cancelled" ? "Cancelled" : k === "failed" ? "Payment failed" : k === "pending" ? "Pending" : "Confirmed"}
            </li>
          ))}
          {kind === "tutor" && view === "week" && (
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-xs bg-teal-soft" aria-hidden /> Your availability
            </li>
          )}
        </ul>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
          <Switch size="sm" checked={showCancelled} onCheckedChange={setShowCancelled} aria-label="Show cancelled lessons" />
          Show cancelled
        </label>
      </div>

      <AnimatePresence initial={false}>
        {countInRange === 0 && view !== "agenda" && (
          <motion.div key="empty" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: EASE }} className="overflow-hidden">
            <EmptyRangeNote view={view} kind={kind} nextLesson={nextLesson} nextKey={nextKey} inRange={range.inRange} onJump={jump} tz={tz} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div key={`${view}:${range.key}`} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.26, ease: EASE }}>
          {view === "month" && (
            <MonthView days={range.days} monthKey={range.key} today={today} selected={activeDay} eventsByDay={eventsByDay} peopleFor={peopleFor} tz={tz} now={now} onDayClick={onDayClick} />
          )}
          {view === "week" && (
            <WeekView days={range.days} today={today} activeDay={activeDay} onActiveDay={setSelected} eventsByDay={eventsByDay} availability={availability} peopleFor={peopleFor} tz={tz} now={now} />
          )}
          {view === "agenda" &&
            (countInRange ? (
              <AgendaView days={range.days} today={today} eventsByDay={eventsByDay} peopleFor={peopleFor} tz={tz} />
            ) : (
              <div className="rounded-xl border border-dashed border-line-strong bg-surface">
                <EmptyState
                  icon={<CalendarDays />}
                  title={`No lessons ${range.inRange(today) ? "in the next two weeks" : "in these two weeks"}`}
                  description={nextLesson && nextKey && !range.inRange(nextKey) ? `Your next lesson is ${formatDateTime(nextLesson.startUtc, tz)}.` : kind === "tutor" ? "New bookings appear here as soon as families book or you accept a request." : "Book a lesson and it will appear here with its time in your time zone."}
                  action={
                    nextLesson && nextKey && !range.inRange(nextKey) ? (
                      <Button onClick={() => jump(nextKey)}>
                        Jump to next lesson <ArrowRight />
                      </Button>
                    ) : kind === "tutor" ? (
                      <Button asChild variant="secondary"><Link href="/dashboard/availability">Update availability</Link></Button>
                    ) : (
                      <Button asChild><Link href="/tutors">Find a tutor</Link></Button>
                    )
                  }
                />
              </div>
            ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function EmptyRangeNote({ view, kind, nextLesson, nextKey, inRange, onJump, tz }: { view: View; kind: "learner" | "tutor"; nextLesson?: Booking; nextKey: string | null; inRange: (d: string) => boolean; onJump: (d: string) => void; tz: string }) {
  const canJump = nextLesson && nextKey && !inRange(nextKey);
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-line bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2.5 text-sm text-ink-2">
        <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden />
        <span>
          No lessons this {view === "month" ? "month" : "week"}.
          {canJump ? <span className="text-muted"> Next up: {formatDateTime(nextLesson.startUtc, tz)}.</span> : <span className="text-muted"> {kind === "tutor" ? "Open availability helps families book you." : "Find a tutor to get started."}</span>}
        </span>
      </p>
      {canJump ? (
        <Button size="sm" variant="outline" onClick={() => onJump(nextKey)} className="self-start sm:self-auto">
          Jump to next lesson <ArrowRight />
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline" className="self-start sm:self-auto">
          <Link href={kind === "tutor" ? "/dashboard/availability" : "/tutors"}>{kind === "tutor" ? "Update availability" : "Find a tutor"}</Link>
        </Button>
      )}
    </div>
  );
}
