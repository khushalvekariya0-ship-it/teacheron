"use client";

import * as React from "react";
import { CalendarClock, CalendarX2, Globe } from "lucide-react";
import type { Tutor } from "@/lib/types";
import { TIMES_OF_DAY } from "@/lib/data/catalog";
import { formatDateTime, formatDuration, tzAbbrev } from "@/lib/format";
import { useHydrated, useNow, useViewerTimezone } from "@/lib/store/hooks";
import { cn } from "@/lib/utils";
import { EASE, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProfileSection } from "./ProfileSections";
import { NIGHT_BLOCK, weeklyGrid, windowLabel, type Block } from "./availability";
import { useNextOpening } from "./useOpening";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const DAY_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function AvailabilitySection({ tutor, onBook }: { tutor: Tutor; onBook: () => void }) {
  const hydrated = useHydrated();
  const tz = useViewerTimezone();
  const now = useNow(5 * 60_000);
  const opening = useNextOpening(tutor);

  const data = React.useMemo(() => {
    if (!hydrated) return null;
    const grid = weeklyGrid(tutor, tz, now);
    const hours = new Map<number, string[]>();
    for (const w of tutor.availability) {
      const { day, label } = windowLabel(tutor, w.day, w.start, w.end, tz, now);
      hours.set(day, [...(hours.get(day) ?? []), label]);
    }
    const blocks: { value: Block; label: string; range: string }[] = [...TIMES_OF_DAY, ...(grid.hasNight ? [NIGHT_BLOCK] : [])];
    return { grid, hours, blocks };
  }, [hydrated, tutor, tz, now]);

  const sameZone = hydrated && tzAbbrev(tz) === tzAbbrev(tutor.timezone);

  return (
    <ProfileSection
      id="availability"
      title="Availability"
      description={hydrated ? `Typical week, shown in your time zone (${tzAbbrev(tz)}).${sameZone ? "" : ` ${tutor.firstName} is based in ${tutor.city} (${tzAbbrev(tutor.timezone)}).`}` : "Typical week, shown in your time zone."}
    >
      {!data ? (
        <div className="space-y-2" role="status" aria-label="Loading availability">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !data.grid.hasAny ? (
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-line-strong px-5 py-6 text-sm">
          <CalendarX2 className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
          <div>
            <p className="font-medium text-ink">No regular weekly hours set</p>
            <p className="mt-0.5 text-muted">Send {tutor.firstName} a message to ask about times that work for you.</p>
          </div>
        </div>
      ) : (
        <>
          <div data-spotlight className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-sm">
              <caption className="sr-only">Weekly availability by day and time of day, in your time zone</caption>
              <thead className="bg-canvas text-[12px] font-medium text-muted">
                <tr>
                  <th scope="col" className="w-16 px-3 py-2.5 text-left font-medium sm:w-24 sm:px-4">
                    Day
                  </th>
                  {data.blocks.map((t) => (
                    <th key={t.value} scope="col" className="px-1.5 py-2.5 text-center font-medium sm:px-2">
                      <span className="block text-ink-2">{t.label}</span>
                      <span className="hidden font-normal text-subtle sm:block">{t.range}</span>
                    </th>
                  ))}
                  <th scope="col" className="hidden px-4 py-2.5 text-left font-medium md:table-cell">
                    Hours
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {DAY_ORDER.map((d, row) => {
                  const cells = data.grid.cells[d];
                  const hours = data.hours.get(d);
                  return (
                    <tr key={d}>
                      <th scope="row" className="px-3 py-2 text-left font-medium text-ink sm:px-4">
                        <span className="sm:hidden">{DAY_NAME[d].slice(0, 3)}</span>
                        <span className="hidden sm:inline">{DAY_NAME[d]}</span>
                      </th>
                      {data.blocks.map((t, col) => {
                        const mins = cells[t.value];
                        const level = mins >= 120 ? 2 : mins > 0 ? 1 : 0;
                        return (
                          <td key={t.value} className="px-1.5 py-2 sm:px-2">
                            <motion.div
                              initial={{ opacity: 0, scaleX: 0.6 }}
                              whileInView={{ opacity: 1, scaleX: 1 }}
                              viewport={{ once: true, amount: 0.5 }}
                              transition={{ duration: 0.45, ease: EASE, delay: row * 0.035 + col * 0.05 }}
                              className={cn(
                                "flex h-7 items-center justify-center rounded-md text-[11px] font-medium",
                                level === 2 && "bg-navy text-on-ink",
                                level === 1 && "bg-navy-100 text-navy",
                                level === 0 && "bg-sunken text-subtle",
                              )}
                            >
                              <span className="sr-only">
                                {DAY_NAME[d]} {t.label.toLowerCase()}: {mins ? `available about ${formatDuration(mins)}` : "not available"}
                              </span>
                              <span aria-hidden className="hidden sm:inline">
                                {mins ? formatDuration(mins).replace(" min", "m").replace(" hr", "h") : "—"}
                              </span>
                            </motion.div>
                          </td>
                        );
                      })}
                      <td className="hidden px-4 py-2 text-[13px] text-muted md:table-cell">{hours?.length ? hours.join(", ") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-[3px] bg-navy" aria-hidden /> 2+ hours open
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-[3px] bg-navy-100" aria-hidden /> Some time open
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-[3px] bg-sunken" aria-hidden /> Not available
            </span>
            {data.grid.hasNight && <span>Night covers 9 PM – 8 AM your time.</span>}
          </div>
        </>
      )}

      <div data-spotlight className="mt-6 flex flex-col gap-4 rounded-xl border border-line bg-canvas px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 text-sm">
          <CalendarClock className="mt-0.5 size-[18px] shrink-0 text-navy" aria-hidden />
          <div>
            <div className="text-ink">
              {opening === undefined ? (
                <Skeleton className="h-4 w-48" />
              ) : opening ? (
                <>
                  Next opening <span className="font-semibold">{formatDateTime(opening.startUtc, tz)}</span>
                </>
              ) : (
                "No openings in the next two weeks"
              )}
            </div>
            <p className="mt-0.5 text-[13px] text-muted">
              Book at least {tutor.rules.minNoticeHours} hours ahead, up to {tutor.rules.maxAdvanceDays} days out. Lessons are {tutor.rules.sessionLengths.map((m) => `${m}`).join(" or ")} minutes.
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={onBook} className="shrink-0">
          See open times
        </Button>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-muted">
        <Globe className="size-3.5" aria-hidden /> Weekly hours can change with holidays and existing bookings. The booking calendar always shows exact open times.
      </p>
    </ProfileSection>
  );
}
