"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CalendarClock } from "lucide-react";
import type { Tutor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TIMES_OF_DAY } from "@/lib/data/catalog";
import { formatDateTime, tzAbbrev } from "@/lib/format";
import { nextOpening } from "@/lib/time";
import { useApp } from "@/lib/store";
import { useHydrated, useViewerTimezone } from "@/lib/store/hooks";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { WEEK_ORDER } from "./filters";

const DAY_INDEX: Record<(typeof WEEK_ORDER)[number], number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };

const hours = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h + (m || 0) / 60;
};

/** True when the tutor's weekly hours overlap this day and time band (in the tutor's own time zone). */
function teaches(tutor: Tutor, day: number, band: { start: number; end: number }) {
  return tutor.availability.some((w) => w.day === day && hours(w.start) < band.end && hours(w.end) > band.start);
}

/**
 * Side panel on wide screens (Preply-style): a quick look at the hovered tutor's weekly availability,
 * their next opening and a link to the full schedule.
 */
export function SchedulePreview({ tutor }: { tutor: Tutor }) {
  const hydrated = useHydrated();
  const bookings = useApp((s) => s.bookings);
  const tz = useViewerTimezone();
  const opening = React.useMemo(() => (hydrated ? nextOpening(tutor, bookings, tz) : undefined), [hydrated, tutor, bookings, tz]);
  const name = `${tutor.firstName} ${tutor.lastName}`;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={tutor.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-line bg-surface p-5 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <Avatar name={name} tone={tutor.tone} size="lg" square />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold text-ink">{name}</p>
            <p className="truncate text-[13px] text-muted">{tutor.headline}</p>
          </div>
        </div>

        <div className="mt-5 flex items-baseline justify-between">
          <p className="text-[14px] font-semibold text-ink">Weekly availability</p>
          <p className="text-[12px] text-muted">{tzAbbrev(tutor.timezone)} · tutor&rsquo;s time</p>
        </div>
        <div className="mt-3 grid grid-cols-[auto_repeat(7,minmax(0,1fr))] gap-1 text-center" role="table" aria-label={`${name}'s weekly availability`}>
          <span role="columnheader" />
          {WEEK_ORDER.map((d) => (
            <span key={d} role="columnheader" className="pb-1 text-[11px] font-medium text-muted">
              {d.charAt(0)}
            </span>
          ))}
          {TIMES_OF_DAY.map((band) => (
            <React.Fragment key={band.value}>
              <span role="rowheader" className="pr-2 text-left text-[11px] leading-6 text-muted">
                {band.label}
              </span>
              {WEEK_ORDER.map((d) => {
                const on = teaches(tutor, DAY_INDEX[d], band);
                return (
                  <span
                    key={d}
                    role="cell"
                    aria-label={`${d} ${band.label}: ${on ? "available" : "not available"}`}
                    className={cn("h-6 rounded-md transition-colors", on ? "bg-brand" : "bg-canvas")}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>

        <p className="mt-4 flex items-start gap-2 text-[13.5px] text-ink-2">
          <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
          {opening === undefined ? (
            <span className="skeleton inline-block h-3.5 w-36" />
          ) : opening ? (
            <span>
              Next opening <span className="font-semibold text-ink">{formatDateTime(opening.startUtc, tz)}</span>
            </span>
          ) : (
            "No openings in the next 2 weeks"
          )}
        </p>

        <div className="mt-5 space-y-2">
          <Button asChild variant="secondary" className="w-full">
            <Link href={`/tutors/${tutor.slug}#availability`}>View full schedule</Link>
          </Button>
          <Link href={`/tutors/${tutor.slug}`} className="group flex items-center justify-center gap-1.5 py-1 text-[14px] font-semibold text-brand">
            See profile <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
