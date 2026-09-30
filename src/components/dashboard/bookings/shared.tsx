"use client";

import * as React from "react";
import { MapPin, Video } from "lucide-react";
import type { Booking, BookingStatus, Child, Tutor, User } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useSession, useTutors } from "@/lib/store/hooks";
import { endMs } from "@/lib/booking";
import { formatTime, tzAbbrev } from "@/lib/format";
import { zonedParts } from "@/lib/time";
import { MODE_LABEL } from "@/lib/data/catalog";
import { cn } from "@/lib/utils";

/* ─── Ownership ─────────────────────────────────────────────────────────────── */

export type ViewerKind = "learner" | "tutor";

export function viewerKind(me: Pick<User, "role">): ViewerKind {
  return me.role === "tutor" ? "tutor" : "learner";
}

/** Learners see what they booked; tutors see lessons booked with them. */
export function isMyBooking(b: Booking, me: User): boolean {
  return me.role === "tutor" ? !!me.tutorId && b.tutorId === me.tutorId : b.bookerId === me.id;
}

export function useMyBookings(): Booking[] {
  const me = useSession();
  const all = useApp((s) => s.bookings);
  return React.useMemo(() => (me ? all.filter((b) => isMyBooking(b, me)) : []), [all, me]);
}

/* ─── People ────────────────────────────────────────────────────────────────── */

export const shortName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName.charAt(0)}.`;

export interface BookingPeople {
  tutor?: Tutor;
  booker?: User;
  child?: Child;
  /** The other party from the viewer's point of view. */
  counterpart: string;
  counterpartTone?: number;
  /** Child's first name when a parent booked for a child ("Student" when the child isn't visible to the viewer). */
  childName?: string;
  /** Who the lesson is for. */
  learnerName: string;
}

/** Resolves tutor / booker / child names for bookings, from the viewer's perspective. */
export function usePeople() {
  const me = useSession();
  const tutors = useTutors();
  const users = useApp((s) => s.users);
  const children = useApp((s) => s.children);
  const tutorById = React.useMemo(() => new Map(tutors.map((t) => [t.id, t])), [tutors]);
  const userById = React.useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const childById = React.useMemo(() => new Map(children.map((c) => [c.id, c])), [children]);

  return React.useCallback(
    (b: Booking): BookingPeople => {
      const tutor = tutorById.get(b.tutorId);
      const booker = userById.get(b.bookerId);
      const child = b.childId ? childById.get(b.childId) : undefined;
      const childName = b.childId ? child?.firstName ?? "Student" : undefined;
      if (me?.role === "tutor") {
        const counterpart = booker ? shortName(booker) : "Student";
        return { tutor, booker, child, counterpart, childName, learnerName: childName ?? counterpart };
      }
      return {
        tutor, booker, child, childName,
        counterpart: tutor ? shortName(tutor) : "Your tutor",
        counterpartTone: tutor?.tone,
        learnerName: childName ?? (booker && me && booker.id === me.id ? "You" : booker ? shortName(booker) : "Student"),
      };
    },
    [tutorById, userById, childById, me],
  );
}

/* ─── Buckets (tabs) ────────────────────────────────────────────────────────── */

export type Bucket = "upcoming" | "past" | "cancelled";

const CANCELLED: BookingStatus[] = ["cancelled_by_student", "cancelled_by_tutor", "rescheduled"];
const ACTIVE: BookingStatus[] = ["pending", "confirmed", "in_progress", "payment_failed"];

export function bucketOf(b: Booking, now: number): Bucket {
  if (CANCELLED.includes(b.status)) return "cancelled";
  if (ACTIVE.includes(b.status) && endMs(b) > now) return "upcoming";
  return "past";
}

export function isOpenRequest(b: Booking, now: number): boolean {
  return b.status === "pending" && endMs(b) > now;
}

/** A lesson whose time has passed but that nobody has wrapped up yet. */
export function needsWrapUp(b: Booking, now: number): boolean {
  return (b.status === "confirmed" || b.status === "in_progress") && endMs(b) <= now;
}

/* ─── Time ──────────────────────────────────────────────────────────────────── */

export function timeRange(b: Booking, tz: string): string {
  return `${formatTime(b.startUtc, tz)} – ${formatTime(new Date(endMs(b)).toISOString(), tz)}`;
}

export function tzShort(tz: string, iso?: string): string {
  return tzAbbrev(tz, iso ? new Date(iso) : new Date());
}

/** Human label for a YYYY-MM-DD key (calendar date, no time zone shift). */
export function labelForKey(key: string, opts: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function DateBlock({ iso, tz, muted, className }: { iso: string; tz: string; muted?: boolean; className?: string }) {
  const p = zonedParts(new Date(iso), tz);
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day, 12));
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date);
  return (
    <div
      className={cn(
        "flex w-14 shrink-0 flex-col items-center justify-center rounded-lg border py-2 text-center",
        muted ? "border-line bg-canvas text-muted" : "border-line bg-surface text-ink",
        className,
      )}
      aria-hidden
    >
      <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">{weekday}</span>
      <span className="text-xl font-semibold leading-tight tabular-nums">{p.day}</span>
      <span className="text-[11px] text-muted">{month}</span>
    </div>
  );
}

export function ModeIcon({ mode, className }: { mode: Booking["mode"]; className?: string }) {
  const Icon = mode === "online" ? Video : MapPin;
  return (
    <span className={cn("inline-flex items-center", className)} title={MODE_LABEL[mode]}>
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{MODE_LABEL[mode]}</span>
    </span>
  );
}

/** Reference shown to users and support (short, uppercase). */
export function bookingRef(id: string): string {
  return id.replace(/^bk_/, "").toUpperCase();
}
