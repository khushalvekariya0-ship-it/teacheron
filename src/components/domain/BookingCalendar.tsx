"use client";

import * as React from "react";
import { CalendarX2, ChevronLeft, ChevronRight, Globe } from "lucide-react";
import type { Tutor, WeeklyWindow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useHydrated, useNow, useSlotBookings, useViewerTimezone } from "@/lib/store/hooks";
import { dateKey, generateSlots, groupSlotsByDay, zonedParts, type Slot } from "@/lib/time";
import { formatTime, tzAbbrev } from "@/lib/format";
import { AnimatePresence, motion } from "@/components/motion";
import { Skeleton } from "@/components/ui/Skeleton";

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const monthOf = (day: string) => day.slice(0, 7);
const pad = (n: number) => String(n).padStart(2, "0");

/** Calendar maths on plain dates (UTC), so the grid never shifts with the viewer's clock. */
function monthGrid(month: string): { key: string; day: number }[][] {
  const [y, m] = month.split("-").map(Number);
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: ({ key: string; day: number } | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: count }, (_, i) => ({ key: `${month}-${pad(i + 1)}`, day: i + 1 }))];
  while (cells.length % 7) cells.push(null);
  const weeks: { key: string; day: number }[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7).map((c, j) => c ?? { key: `blank-${i + j}`, day: 0 }));
  return weeks;
}

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

const fmt = (key: string, opts: Intl.DateTimeFormatOptions) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d ?? 1, 12)));
};

/** Morning, afternoon or evening of a start time, in the viewer's time zone. */
function partOfDay(startUtc: string, tz: string): "Morning" | "Afternoon" | "Evening" {
  const h = zonedParts(new Date(startUtc), tz).hour;
  return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
}

/**
 * A month calendar with every date the tutor takes bookings for (up to their advance window): days with
 * open times stand out and can be chosen; a day without any says why (the tutor doesn't teach that day,
 * it's fully booked, too soon, or not open yet) and offers the next open day. The chosen day's start
 * times are grouped into morning, afternoon and evening. Everything comes from the tutor's real
 * availability, shown in the viewer's time zone: existing bookings, buffers, minimum notice and the
 * advance window are all respected. Pass `excludeBookingId` when rescheduling so the lesson being moved
 * doesn't block itself, and `anyTime` when the tutor moves their own lesson: their weekly hours, days off
 * and notice are rules for students, so every free time from now on is offered (clashes still count).
 */
const ALL_DAY: WeeklyWindow[] = ([0, 1, 2, 3, 4, 5, 6] as const).map((day) => ({ day, start: "00:00", end: "24:00" }));

export function BookingCalendar({
  tutor: tutorIn,
  durationMin,
  value,
  onChange,
  className,
  excludeBookingId,
  anyTime = false,
}: {
  tutor: Tutor;
  durationMin: number;
  value: string | null;
  onChange: (startUtc: string | null) => void;
  className?: string;
  excludeBookingId?: string;
  anyTime?: boolean;
}) {
  const tutor = React.useMemo(
    () => (anyTime ? { ...tutorIn, availability: ALL_DAY, exceptions: tutorIn.exceptions.filter((e) => e.type !== "blocked"), rules: { ...tutorIn.rules, minNoticeHours: 0 } } : tutorIn),
    [tutorIn, anyTime],
  );
  const hydrated = useHydrated();
  const tz = useViewerTimezone();
  const now = useNow(60_000);
  const allBookings = useSlotBookings();
  const bookings = React.useMemo(() => allBookings.filter((b) => b.id !== excludeBookingId), [allBookings, excludeBookingId]);
  const horizon = Math.max(1, Math.min(tutor.rules.maxAdvanceDays, 180));
  const groups = React.useMemo(
    () => (hydrated ? groupSlotsByDay(generateSlots(tutor, { durationMin, viewerTz: tz, bookings, days: horizon })) : []),
    [hydrated, tutor, durationMin, tz, bookings, horizon],
  );
  // The same times without anyone's bookings and without the notice rule: tells "fully booked" and
  // "too soon" apart from "doesn't teach that day".
  const teaches = React.useMemo(
    () => (hydrated ? new Set(generateSlots({ ...tutor, rules: { ...tutor.rules, minNoticeHours: 0 } }, { durationMin, viewerTz: tz, bookings: [], days: horizon }).map((s) => s.day)) : new Set<string>()),
    [hydrated, tutor, durationMin, tz, horizon],
  );
  const byDay = React.useMemo(() => new Map(groups.map((g) => [g.day, g.slots])), [groups]);
  const [pickedDay, setPickedDay] = React.useState<string | null>(null);
  const [shownMonth, setShownMonth] = React.useState<string | null>(null);

  const valueDay = value ? groups.find((g) => g.slots.some((s) => s.startUtc === value))?.day : undefined;
  // A chosen time that no longer exists (the length changed, or someone else booked it) is dropped.
  const valueGone = !!value && hydrated && !valueDay;
  React.useEffect(() => {
    if (valueGone) onChange(null);
  }, [valueGone, onChange]);

  if (!hydrated) {
    return (
      <div className={className} role="status" aria-label="Loading open times">
        <Skeleton className="h-[272px] rounded-xl" />
        <Skeleton className="mt-3 h-10 rounded-lg" />
      </div>
    );
  }

  const today = dateKey(new Date(now), tz);
  const lastBookable = dateKey(new Date(now + horizon * 86_400_000), tz);
  if (!groups.length) {
    return (
      <div className={cn("rounded-xl border border-dashed border-line-strong px-4 py-8 text-center", className)}>
        <CalendarX2 className="mx-auto size-6 text-subtle" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-ink">No open times right now</p>
        <p className="mx-auto mt-1 max-w-[16rem] text-[13px] leading-snug text-muted">{tutor.firstName} has no free times in the next {horizon} days. Send a message to ask about other times.</p>
      </div>
    );
  }

  const firstOpen = groups[0].day;
  const activeDay = pickedDay ?? valueDay ?? firstOpen;
  const firstMonth = monthOf(today);
  const lastMonth = monthOf(lastBookable);
  const month = shownMonth && shownMonth >= firstMonth && shownMonth <= lastMonth ? shownMonth : monthOf(activeDay);
  const slots = byDay.get(activeDay) ?? [];
  const nextOpen = groups.find((g) => g.day > activeDay)?.day ?? null;

  /** Why a day has no times (for a day within the bookable range). */
  const whyClosed = (key: string): string => {
    if (key > lastBookable) return `${tutor.firstName} takes bookings up to ${horizon} days ahead, so this day isn't open yet.`;
    if (teaches.has(key)) {
      if (anyTime) return key === today ? "No free times left today: the rest of the day is taken by other lessons." : "Every time that day is taken by other lessons.";
      return key <= dateKey(new Date(now + tutor.rules.minNoticeHours * 3_600_000), tz)
        ? `Too soon: ${tutor.firstName} needs at least ${tutor.rules.minNoticeHours} hours' notice.`
        : `All of ${tutor.firstName}'s times that day are booked.`;
    }
    const blocked = tutor.exceptions.some((e) => e.date === key && e.type === "blocked");
    if (blocked) return `${tutor.firstName} isn't available that day.`;
    const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
    return `${tutor.firstName} doesn't teach on ${WEEKDAY_NAMES[weekday]}s (in your time zone).`;
  };

  const pickDay = (key: string) => {
    setPickedDay(key);
    setShownMonth(monthOf(key));
    if (value && valueDay !== key) onChange(null);
  };

  const parts = (["Morning", "Afternoon", "Evening"] as const)
    .map((p) => ({ part: p, slots: slots.filter((s: Slot) => partOfDay(s.startUtc, tz) === p) }))
    .filter((p) => p.slots.length);

  return (
    <div className={className} data-booking-calendar="">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold text-ink" aria-live="polite">
          {fmt(`${month}-01`, { month: "long", year: "numeric" })}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setShownMonth(shiftMonth(month, -1))}
            disabled={month <= firstMonth}
            aria-label="Previous month"
            className="grid size-8 place-items-center rounded-full border border-line text-ink transition-colors hover:bg-canvas disabled:pointer-events-none disabled:opacity-35"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setShownMonth(shiftMonth(month, 1))}
            disabled={month >= lastMonth}
            aria-label="Next month"
            className="grid size-8 place-items-center rounded-full border border-line text-ink transition-colors hover:bg-canvas disabled:pointer-events-none disabled:opacity-35"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <table className="mt-3 w-full table-fixed border-separate border-spacing-y-1 text-center" aria-label={`Days in ${fmt(`${month}-01`, { month: "long", year: "numeric" })}`}>
        <thead>
          <tr>
            {WEEKDAY_INITIALS.map((d, i) => (
              <th key={i} scope="col" className="pb-1 text-[11.5px] font-medium text-muted">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(month).map((week, wi) => (
            <tr key={wi}>
              {week.map((c) => {
                if (!c.day) return <td key={c.key} />;
                const open = byDay.get(c.key)?.length ?? 0;
                const past = c.key < today;
                const active = c.key === activeDay;
                return (
                  <td key={c.key}>
                    <button
                      type="button"
                      disabled={past}
                      aria-pressed={active}
                      data-day={c.key}
                      data-open={open ? "" : undefined}
                      aria-label={`${fmt(c.key, { weekday: "long", month: "long", day: "numeric" })}${open ? `, ${open} open ${open === 1 ? "time" : "times"}` : past ? ", past" : ", no open times"}`}
                      onClick={() => pickDay(c.key)}
                      className={cn(
                        "relative mx-auto grid size-9 place-items-center rounded-full text-[14px] tabular-nums transition-colors",
                        active
                          ? open
                            ? "bg-brand font-semibold text-on-brand shadow-[0_6px_16px_-8px_var(--color-brand-glow)]"
                            : "bg-sunken font-semibold text-ink ring-1 ring-line-strong"
                          : open
                            ? "bg-brand-50 font-semibold text-brand hover:bg-brand-soft"
                            : past
                              ? "text-subtle/50"
                              : "text-subtle hover:bg-canvas",
                        c.key === today && !active && "ring-1 ring-line-strong",
                      )}
                    >
                      {c.day}
                      {open > 0 && !active && <span className="absolute bottom-0.5 size-1 rounded-full bg-brand" aria-hidden />}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-brand-50 ring-1 ring-brand/40" aria-hidden /> Free times
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full ring-1 ring-line-strong" aria-hidden /> No times (tap to see why)
        </span>
      </p>

      <p className="mt-4 text-[13px] font-medium text-ink">{fmt(activeDay, { weekday: "long", month: "long", day: "numeric" })}</p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={activeDay} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {slots.length === 0 ? (
            <div className="mt-2 rounded-lg border border-dashed border-line-strong px-3 py-3 text-[13px] text-ink-2" data-day-closed="">
              <p>{whyClosed(activeDay)}</p>
              {nextOpen && (
                <button type="button" onClick={() => pickDay(nextOpen)} className="mt-2 font-semibold text-brand underline-offset-2 hover:underline">
                  Next free day: {fmt(nextOpen, { weekday: "short", month: "short", day: "numeric" })} →
                </button>
              )}
            </div>
          ) : (
            <div role="radiogroup" aria-label="Start time" data-lenis-prevent className="mt-2 max-h-[16rem] space-y-3 overflow-y-auto pr-0.5">
              {parts.map((p) => (
                <div key={p.part}>
                  <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted">
                    {p.part} <span className="font-normal normal-case tracking-normal">· {p.slots.length}</span>
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {p.slots.map((s) => {
                      const on = s.startUtc === value;
                      return (
                        <button
                          key={s.startUtc}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => onChange(s.startUtc)}
                          className={cn(
                            "h-10 rounded-full border text-[13.5px] font-medium tabular-nums transition-colors",
                            on ? "border-brand bg-brand text-on-brand" : "border-line bg-surface text-ink-2 hover:border-brand/50 hover:text-ink",
                          )}
                        >
                          {formatTime(s.startUtc, tz)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted">
        <Globe className="size-3.5 shrink-0" aria-hidden /> Times in your time zone ({tzAbbrev(tz)}) · bookable up to {fmt(lastBookable, { month: "short", day: "numeric" })}
      </p>
    </div>
  );
}
