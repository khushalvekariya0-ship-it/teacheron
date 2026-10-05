"use client";

import * as React from "react";
import { CalendarX2, ChevronLeft, ChevronRight, Globe } from "lucide-react";
import type { Tutor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useHydrated, useNow, useViewerTimezone } from "@/lib/store/hooks";
import { dateKey, generateSlots, groupSlotsByDay } from "@/lib/time";
import { formatTime, tzAbbrev } from "@/lib/format";
import { AnimatePresence, motion } from "@/components/motion";
import { Skeleton } from "@/components/ui/Skeleton";

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

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

/**
 * A month calendar with the tutor's open days, and the start times of the chosen day.
 * Everything comes from the tutor's real availability, shown in the viewer's time zone:
 * existing bookings, buffers, minimum notice and the advance window are all respected.
 */
export function BookingCalendar({ tutor, durationMin, value, onChange, className }: { tutor: Tutor; durationMin: number; value: string | null; onChange: (startUtc: string | null) => void; className?: string }) {
  const hydrated = useHydrated();
  const tz = useViewerTimezone();
  const now = useNow(60_000);
  const bookings = useApp((s) => s.bookings);
  const groups = React.useMemo(() => (hydrated ? groupSlotsByDay(generateSlots(tutor, { durationMin, viewerTz: tz, bookings, days: 60 })) : []), [hydrated, tutor, durationMin, tz, bookings]);
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

  if (!groups.length) {
    return (
      <div className={cn("rounded-xl border border-dashed border-line-strong px-4 py-8 text-center", className)}>
        <CalendarX2 className="mx-auto size-6 text-subtle" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-ink">No open times right now</p>
        <p className="mx-auto mt-1 max-w-[16rem] text-[13px] leading-snug text-muted">{tutor.firstName} has no openings in the next few weeks. Send a message to ask about other times.</p>
      </div>
    );
  }

  const firstDay = groups[0].day;
  const lastDay = groups[groups.length - 1].day;
  const activeDay = pickedDay && byDay.has(pickedDay) ? pickedDay : (valueDay ?? firstDay);
  const month = shownMonth && shownMonth >= monthOf(firstDay) && shownMonth <= monthOf(lastDay) ? shownMonth : monthOf(activeDay);
  const today = dateKey(new Date(now), tz);
  const slots = byDay.get(activeDay) ?? [];

  const pickDay = (key: string) => {
    setPickedDay(key);
    setShownMonth(monthOf(key));
    if (value && valueDay !== key) onChange(null);
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold text-ink" aria-live="polite">
          {fmt(`${month}-01`, { month: "long", year: "numeric" })}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setShownMonth(shiftMonth(month, -1))}
            disabled={month <= monthOf(firstDay)}
            aria-label="Previous month"
            className="grid size-8 place-items-center rounded-full border border-line text-ink transition-colors hover:bg-canvas disabled:pointer-events-none disabled:opacity-35"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setShownMonth(shiftMonth(month, 1))}
            disabled={month >= monthOf(lastDay)}
            aria-label="Next month"
            className="grid size-8 place-items-center rounded-full border border-line text-ink transition-colors hover:bg-canvas disabled:pointer-events-none disabled:opacity-35"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <table className="mt-3 w-full table-fixed border-separate border-spacing-y-1 text-center" aria-label={`Open days in ${fmt(`${month}-01`, { month: "long", year: "numeric" })}`}>
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
                const active = c.key === activeDay;
                return (
                  <td key={c.key}>
                    <button
                      type="button"
                      disabled={!open}
                      aria-pressed={active}
                      aria-label={`${fmt(c.key, { weekday: "long", month: "long", day: "numeric" })}${open ? `, ${open} open ${open === 1 ? "time" : "times"}` : ", no open times"}`}
                      onClick={() => pickDay(c.key)}
                      className={cn(
                        "relative mx-auto grid size-9 place-items-center rounded-full text-[14px] tabular-nums transition-colors",
                        active ? "bg-brand font-semibold text-white shadow-[0_6px_16px_-8px_var(--color-brand-glow)]" : open ? "bg-brand-50 font-semibold text-brand hover:bg-brand-soft" : "text-subtle",
                        c.key === today && !active && "ring-1 ring-line-strong",
                      )}
                    >
                      {c.day}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-[13px] font-medium text-ink">{fmt(activeDay, { weekday: "long", month: "long", day: "numeric" })}</p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeDay}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="radiogroup"
          aria-label="Start time"
          data-lenis-prevent
          className="mt-2 grid max-h-[8.5rem] grid-cols-3 gap-2 overflow-y-auto pr-0.5"
        >
          {slots.map((s) => {
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
                  on ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink-2 hover:border-brand/50 hover:text-ink",
                )}
              >
                {formatTime(s.startUtc, tz)}
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>

      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted">
        <Globe className="size-3.5 shrink-0" aria-hidden /> Your time zone ({tzAbbrev(tz)})
      </p>
    </div>
  );
}
