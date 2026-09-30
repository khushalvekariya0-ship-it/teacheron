import type { Booking, Tutor } from "@/lib/types";

/** Time-zone math with Intl only. All persisted timestamps are UTC ISO strings. */

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(date: Date, tz: string): ZonedParts {
  const p = Object.fromEntries(partsFormatter(tz).formatToParts(date).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute, weekday: WD[p.weekday] };
}

/** Offset of `tz` from UTC at `date`, in minutes (e.g. -240 for EDT). */
export function tzOffsetMinutes(tz: string, date: Date): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(date.getTime() / 60_000) * 60_000) / 60_000);
}

/** Converts a wall-clock time in `tz` to a UTC Date (DST-safe). */
export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const off1 = tzOffsetMinutes(tz, new Date(guess));
  let ts = guess - off1 * 60_000;
  const off2 = tzOffsetMinutes(tz, new Date(ts));
  if (off2 !== off1) ts = guess - off2 * 60_000;
  return new Date(ts);
}

/** YYYY-MM-DD for a date as seen in `tz`. */
export function dateKey(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

const hm = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

export interface Slot {
  startUtc: string;
  endUtc: string;
  /** Date key in the viewer's time zone, for grouping. */
  day: string;
}

/** Statuses that occupy a tutor's calendar. */
export const BLOCKING_STATUSES: Booking["status"][] = ["pending", "confirmed", "in_progress"];

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Generates bookable slots from a tutor's weekly availability, exceptions and existing bookings,
 * honoring minimum notice, maximum advance window and buffer time.
 * The same check runs again inside `createBooking` so a slot can never be double booked.
 */
export function generateSlots(
  tutor: Pick<Tutor, "availability" | "exceptions" | "timezone" | "rules" | "id">,
  opts: { durationMin: number; viewerTz: string; bookings: Booking[]; now?: number; days?: number; stepMin?: number },
): Slot[] {
  const now = opts.now ?? Date.now();
  const step = opts.stepMin ?? 30;
  const earliest = now + tutor.rules.minNoticeHours * 3_600_000;
  const horizonDays = Math.min(opts.days ?? 21, tutor.rules.maxAdvanceDays);
  const latest = now + tutor.rules.maxAdvanceDays * 86_400_000;
  const buffer = tutor.rules.bufferMinutes * 60_000;
  const busy = opts.bookings
    .filter((b) => b.tutorId === tutor.id && BLOCKING_STATUSES.includes(b.status))
    .map((b) => {
      const s = new Date(b.startUtc).getTime();
      return [s - buffer, s + b.durationMin * 60_000 + buffer] as const;
    });

  const out: Slot[] = [];
  const start = zonedParts(new Date(now), tutor.timezone);
  for (let i = 0; i <= horizonDays; i++) {
    const noon = zonedToUtc(start.year, start.month, start.day, 12, 0, tutor.timezone).getTime() + i * 86_400_000;
    const p = zonedParts(new Date(noon), tutor.timezone);
    const key = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
    const exception = tutor.exceptions.find((e) => e.date === key);
    if (exception?.type === "blocked") continue;
    const windows = exception?.type === "custom" ? exception.windows ?? [] : tutor.availability.filter((w) => w.day === p.weekday);
    for (const w of windows) {
      for (let m = hm(w.start); m + opts.durationMin <= hm(w.end); m += step) {
        const s = zonedToUtc(p.year, p.month, p.day, Math.floor(m / 60), m % 60, tutor.timezone).getTime();
        const e = s + opts.durationMin * 60_000;
        if (s < earliest || s > latest) continue;
        if (busy.some(([bs, be]) => overlaps(s, e, bs, be))) continue;
        out.push({ startUtc: new Date(s).toISOString(), endUtc: new Date(e).toISOString(), day: dateKey(new Date(s), opts.viewerTz) });
      }
    }
  }
  return out;
}

export function groupSlotsByDay(slots: Slot[]): { day: string; slots: Slot[] }[] {
  const map = new Map<string, Slot[]>();
  for (const s of slots) map.set(s.day, [...(map.get(s.day) ?? []), s]);
  return Array.from(map, ([day, s]) => ({ day, slots: s }));
}

/** First bookable slot in the next two weeks, or null. */
export function nextOpening(tutor: Pick<Tutor, "availability" | "exceptions" | "timezone" | "rules" | "id">, bookings: Booking[], viewerTz: string, now = Date.now()): Slot | null {
  const duration = Math.min(...tutor.rules.sessionLengths);
  const slots = generateSlots(tutor, { durationMin: duration, viewerTz, bookings, now, days: 14, stepMin: 60 });
  return slots[0] ?? null;
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
}
