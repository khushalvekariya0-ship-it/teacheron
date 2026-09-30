import type { Tutor } from "@/lib/types";
import { TIMES_OF_DAY } from "@/lib/data/catalog";
import { zonedParts, zonedToUtc } from "@/lib/time";

/** The catalog's three daytime blocks plus "night" (9 PM – 8 AM) for viewers far from the tutor's zone. */
export type Block = (typeof TIMES_OF_DAY)[number]["value"] | "night";

export const NIGHT_BLOCK = { value: "night" as const, label: "Night", range: "9 PM – 8 AM" };

export interface WeeklyGrid {
  /** cells[weekday 0=Sun][block] = minutes available in that block (viewer's time zone). */
  cells: Record<number, Record<Block, number>>;
  /** True when some availability falls outside 8 AM – 9 PM in the viewer's time zone. */
  hasNight: boolean;
  hasAny: boolean;
}

const STEP = 30;

const hm = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

/** The calendar date (in the tutor's zone) of the next occurrence of `weekday`, starting today. */
function upcoming(tutorTz: string, weekday: number, now: number) {
  const today = zonedParts(new Date(now), tutorTz);
  const offset = (weekday - today.weekday + 7) % 7;
  const d = new Date(Date.UTC(today.year, today.month - 1, today.day + offset, 12));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

/**
 * Projects a tutor's recurring weekly windows (in the tutor's own time zone) onto the viewer's
 * week, using the dates of the upcoming week so daylight-saving differences are exact.
 */
export function weeklyGrid(tutor: Pick<Tutor, "availability" | "timezone">, viewerTz: string, now: number): WeeklyGrid {
  const empty = (): Record<Block, number> => ({ morning: 0, afternoon: 0, evening: 0, night: 0 });
  const cells: WeeklyGrid["cells"] = { 0: empty(), 1: empty(), 2: empty(), 3: empty(), 4: empty(), 5: empty(), 6: empty() };
  let hasNight = false;
  let hasAny = false;

  for (const w of tutor.availability) {
    const { y, m, d } = upcoming(tutor.timezone, w.day, now);
    for (let t = hm(w.start); t + STEP <= hm(w.end); t += STEP) {
      const p = zonedParts(zonedToUtc(y, m, d, Math.floor(t / 60), t % 60, tutor.timezone), viewerTz);
      const hour = p.hour + p.minute / 60;
      const block = TIMES_OF_DAY.find((b) => hour >= b.start && hour < b.end);
      hasAny = true;
      if (block) cells[p.weekday][block.value] += STEP;
      else {
        cells[p.weekday].night += STEP;
        hasNight = true;
      }
    }
  }
  return { cells, hasNight, hasAny };
}

/** A tutor-local weekly window converted to the viewer's zone: which weekday it lands on and "4:00 PM – 8:00 PM". */
export function windowLabel(tutor: Pick<Tutor, "timezone">, day: number, start: string, end: string, viewerTz: string, now: number): { day: number; label: string } {
  const { y, m, d } = upcoming(tutor.timezone, day, now);
  const conv = (s: string) => zonedToUtc(y, m, d, Math.floor(hm(s) / 60), hm(s) % 60, tutor.timezone);
  const a = conv(start);
  const b = conv(end);
  const fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: viewerTz });
  return { day: zonedParts(a, viewerTz).weekday, label: `${fmt.format(a)} – ${fmt.format(b)}` };
}
