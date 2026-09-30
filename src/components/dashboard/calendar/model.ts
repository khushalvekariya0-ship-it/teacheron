import type { Booking, BookingStatus, Tutor } from "@/lib/types";
import { endMs } from "@/lib/booking";
import { dateKey, zonedParts, zonedToUtc } from "@/lib/time";

/*
 * Calendar model. Days are YYYY-MM-DD keys in the viewer's time zone; arithmetic on keys is pure
 * calendar math (UTC-based), so it never drifts across DST changes.
 */

const pad = (n: number) => String(n).padStart(2, "0");

export function parseKey(k: string) {
  const [y, m, d] = k.split("-").map(Number);
  return { y, m, d };
}

export const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

export function addDays(k: string, n: number): string {
  const { y, m, d } = parseKey(k);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return keyOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function weekdayOf(k: string): number {
  const { y, m, d } = parseKey(k);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const startOfWeek = (k: string) => addDays(k, -weekdayOf(k));

export function startOfMonth(k: string): string {
  const { y, m } = parseKey(k);
  return keyOf(y, m, 1);
}

export function addMonths(k: string, n: number): string {
  const { y, m } = parseKey(k);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return keyOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1);
}

export function daysBetween(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/** Sunday-first grid covering the whole month (5 or 6 weeks). */
export function monthGrid(k: string): string[] {
  const first = startOfMonth(k);
  const { y, m } = parseKey(first);
  const last = keyOf(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate());
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(last), 6);
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function fmtKey(k: string, opts: Intl.DateTimeFormatOptions): string {
  const { y, m, d } = parseKey(k);
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/* ─── Events ────────────────────────────────────────────────────────────────── */

export type EventKind = "confirmed" | "pending" | "done" | "failed" | "cancelled";

export function kindOf(status: BookingStatus): EventKind {
  if (status === "confirmed" || status === "in_progress") return "confirmed";
  if (status === "pending") return "pending";
  if (status === "payment_failed") return "failed";
  if (status === "cancelled_by_student" || status === "cancelled_by_tutor" || status === "rescheduled") return "cancelled";
  return "done";
}

export const KIND_LABEL: Record<EventKind, string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  done: "Completed / past",
  failed: "Payment failed",
  cancelled: "Cancelled",
};

/** Visual treatment per kind — never color alone: pending is dashed, cancelled is struck through. */
export const KIND_CLASS: Record<EventKind, string> = {
  confirmed: "border-l-[3px] border-brand bg-brand-soft text-ink",
  pending: "border border-dashed border-ink/50 bg-surface text-ink",
  done: "border-l-[3px] border-line-strong bg-canvas text-ink-2",
  failed: "border border-dashed border-danger/50 bg-danger-50 text-danger",
  cancelled: "border border-line bg-surface text-muted line-through",
};

export const KIND_DOT: Record<EventKind, string> = {
  confirmed: "bg-brand",
  pending: "border border-ink bg-surface",
  done: "bg-line-strong",
  failed: "border border-danger bg-danger-50",
  cancelled: "border border-line-strong bg-surface",
};

export interface CalEvent {
  booking: Booking;
  day: string;
  startMin: number;
  endMin: number;
  kind: EventKind;
}

export function toEvent(b: Booking, tz: string): CalEvent {
  const p = zonedParts(new Date(b.startUtc), tz);
  const startMin = p.hour * 60 + p.minute;
  return { booking: b, day: dateKey(new Date(b.startUtc), tz), startMin, endMin: Math.min(24 * 60, startMin + b.durationMin), kind: kindOf(b.status) };
}

/** Assigns side-by-side lanes to overlapping events in one day. */
export function layoutLanes(events: CalEvent[]): { ev: CalEvent; lane: number; lanes: number }[] {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: { ev: CalEvent; lane: number; lanes: number }[] = [];
  let cluster: { ev: CalEvent; lane: number; lanes: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    cluster.forEach((c) => (c.lanes = laneEnds.length));
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
  };
  for (const ev of sorted) {
    if (ev.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= ev.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(ev.endMin);
    } else laneEnds[lane] = ev.endMin;
    cluster.push({ ev, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, ev.endMin);
  }
  flush();
  return out;
}

/* ─── Tutor availability, converted from the tutor's zone to the viewer's ────── */

export interface Segment {
  startMin: number;
  endMin: number;
}

const hm = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

export function availabilityByDay(tutor: Pick<Tutor, "availability" | "exceptions" | "timezone">, days: string[], viewerTz: string): Map<string, Segment[]> {
  const out = new Map<string, Segment[]>(days.map((d) => [d, []]));
  if (!days.length) return out;
  const push = (day: string, seg: Segment) => {
    const list = out.get(day);
    if (list && seg.endMin > seg.startMin) list.push(seg);
  };
  // Tutor-zone dates can map to adjacent viewer dates, so look one day either side.
  for (let d = addDays(days[0], -1); d <= addDays(days[days.length - 1], 1); d = addDays(d, 1)) {
    const { y, m, d: day } = parseKey(d);
    const exception = tutor.exceptions.find((e) => e.date === d);
    if (exception?.type === "blocked") continue;
    const windows = exception?.type === "custom" ? exception.windows ?? [] : tutor.availability.filter((w) => w.day === weekdayOf(d));
    for (const w of windows) {
      const s = zonedToUtc(y, m, day, Math.floor(hm(w.start) / 60), hm(w.start) % 60, tutor.timezone);
      const e = zonedToUtc(y, m, day, Math.floor(hm(w.end) / 60), hm(w.end) % 60, tutor.timezone);
      const sp = zonedParts(s, viewerTz);
      const ep = zonedParts(e, viewerTz);
      const sKey = dateKey(s, viewerTz);
      const eKey = dateKey(e, viewerTz);
      const sMin = sp.hour * 60 + sp.minute;
      const eMin = ep.hour * 60 + ep.minute;
      if (sKey === eKey) push(sKey, { startMin: sMin, endMin: eMin });
      else {
        push(sKey, { startMin: sMin, endMin: 24 * 60 });
        push(eKey, { startMin: 0, endMin: eMin });
      }
    }
  }
  return out;
}

export function isPastEvent(b: Booking, now: number) {
  return endMs(b) <= now;
}
