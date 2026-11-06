"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Booking, Child, Tutor, User, WeeklyWindow } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useSession, useTutors } from "@/lib/store/hooks";
import { zonedParts, zonedToUtc } from "@/lib/time";
import { endMs } from "@/lib/booking";
import type { BookingPolicy } from "@/lib/data/platform";
import { TUTOR_PLANS, type Plan } from "@/lib/data/platform";
import { asCurrency, currencySymbol, sumByCurrency, type Currency } from "@/lib/money";
import { toast } from "@/components/ui/Toast";

export const DAY_MS = 86_400_000;

/* ─── Current tutor ─────────────────────────────────────────────────────────── */

/** The signed-in user and their tutor profile (with overrides and live ratings applied). */
export function useMyTutor(): { me: User | null; tutor: Tutor | undefined } {
  const me = useSession();
  const tutors = useTutors();
  const tutor = React.useMemo(() => (me?.tutorId ? tutors.find((t) => t.id === me.tutorId) : undefined), [me, tutors]);
  return { me, tutor };
}

export function useMyBookings(tutorId: string | undefined): Booking[] {
  const all = useApp((s) => s.bookings);
  return React.useMemo(() => (tutorId ? all.filter((b) => b.tutorId === tutorId) : []), [all, tutorId]);
}

export function useMyPlan(tutorId: string | undefined): { plan: Plan; status: string; renewsAt?: string } {
  const subs = useApp((s) => s.subscriptions);
  return React.useMemo(() => {
    const sub = tutorId ? subs[tutorId] : undefined;
    const plan = TUTOR_PLANS.find((p) => p.id === (sub?.plan ?? "free")) ?? TUTOR_PLANS[0];
    return { plan, status: sub?.status ?? "active", renewsAt: sub?.renewsAt };
  }, [subs, tutorId]);
}

/* ─── Money (integer minor units, in each booking's own currency) ───────────── */

/** What the learner paid for a booking. */
export const grossCents = (b: Booking): number => b.priceCents - b.discountCents;
/** What the tutor keeps: paid amount minus the platform fee recorded at booking time. */
export const netCents = (b: Booking): number => b.priceCents - b.discountCents - b.platformFeeCents;

/** Lessons the tutor is paid for: completed lessons and student no-shows (charged per policy). */
export const EARNED_STATUSES: Booking["status"][] = ["completed", "no_show_student"];
export const isEarned = (b: Booking): boolean => EARNED_STATUSES.includes(b.status) && b.paymentStatus !== "refunded";

/** Earned lessons become available for payout once the dispute window has passed. */
export function isCleared(b: Booking, now: number, policy: BookingPolicy): boolean {
  return endMs(b) + policy.disputeWindowDays * DAY_MS <= now;
}

export const sumCents = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/**
 * The one currency an earnings chart shows (amounts in different currencies are never added): the tutor's
 * own, unless all their earnings so far are in another one (they changed currency later).
 */
export function chartCurrency(bookings: Booking[], tutorCurrency: Currency | undefined): Currency {
  const own = asCurrency(tutorCurrency);
  const sums = sumByCurrency(bookings.filter(isEarned).map((b) => ({ amount: netCents(b), currency: b.currency })));
  return !sums.length || sums.some((x) => x.currency === own) ? own : sums[0].currency;
}

/** A price input's currency symbol in front, with room for the longer ones ("AED", "CA$", "kr"). */
export function priceInputProps(currency: Currency): { prefixText: string; style?: React.CSSProperties } {
  const prefixText = currencySymbol(currency);
  return prefixText.length > 1 ? { prefixText, style: { paddingLeft: `calc(1.25rem + ${(prefixText.length * 0.7).toFixed(1)}em)` } } : { prefixText };
}

/* ─── Calendar buckets ──────────────────────────────────────────────────────── */

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Monday-start calendar weeks in `tz`, oldest first. Each bucket has a UTC start/end and a label
 * such as "Sep 7" (the Monday). DST-safe: each boundary is converted from local midnight.
 */
export function weekBuckets(now: number, tz: string, weeks: number): { start: number; end: number; label: string }[] {
  const p = zonedParts(new Date(now), tz);
  const sinceMonday = (p.weekday + 6) % 7;
  const out: { start: number; end: number; label: string }[] = [];
  for (let k = weeks - 1; k >= 0; k--) {
    const d0 = new Date(Date.UTC(p.year, p.month - 1, p.day - sinceMonday - 7 * k));
    const d1 = new Date(Date.UTC(p.year, p.month - 1, p.day - sinceMonday - 7 * k + 7));
    out.push({
      start: zonedToUtc(d0.getUTCFullYear(), d0.getUTCMonth() + 1, d0.getUTCDate(), 0, 0, tz).getTime(),
      end: zonedToUtc(d1.getUTCFullYear(), d1.getUTCMonth() + 1, d1.getUTCDate(), 0, 0, tz).getTime(),
      label: shortDate.format(d0),
    });
  }
  return out;
}

/** Net earnings per week from earned lessons (by lesson date); only lessons in `currency` when given. */
export function weeklyNet(bookings: Booking[], now: number, tz: string, weeks: number, currency?: Currency): { label: string; value: number }[] {
  const buckets = weekBuckets(now, tz, weeks);
  const earned = bookings.filter((b) => isEarned(b) && (!currency || asCurrency(b.currency) === currency));
  return buckets.map((w) => ({
    label: w.label,
    value: sumCents(earned.filter((b) => {
      const s = new Date(b.startUtc).getTime();
      return s >= w.start && s < w.end;
    }).map(netCents)),
  }));
}

export function isSameMonth(iso: string, now: number, tz: string): boolean {
  const a = zonedParts(new Date(iso), tz);
  const b = zonedParts(new Date(now), tz);
  return a.year === b.year && a.month === b.month;
}

/** "YYYY-MM-DD" for today in `tz`. */
export function todayKey(now: number, tz: string): string {
  const p = zonedParts(new Date(now), tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Formats a "YYYY-MM-DD" date key without shifting it through a time zone. */
export function formatDateKey(key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/* ─── Students ──────────────────────────────────────────────────────────────── */

/** Statuses under which the store lets a tutor add notes, goals and homework for a learner. */
export const TEACHING_STATUSES: Booking["status"][] = ["confirmed", "in_progress", "completed"];

export const learnerIdOf = (b: Booking): string => b.childId ?? b.bookerId;

export interface Learner {
  id: string;
  /** Child first name, or the booker's first name and last initial. */
  name: string;
  isChild: boolean;
  /** For children: the parent account holder, e.g. "Dana W.". */
  guardian?: string;
  /** Role of the account that books the lessons. */
  accountRole?: User["role"];
  subjects: string[];
  bookings: Booking[];
}

function shortName(u: Pick<User, "firstName" | "lastName"> | undefined): string {
  if (!u) return "Student";
  return `${u.firstName} ${u.lastName.charAt(0)}.`;
}

/** Resolves any learner id (user or child) to a display name. */
export function useLearnerName(): (learnerId: string) => string {
  const users = useApp((s) => s.users);
  const children = useApp((s) => s.children);
  return React.useCallback(
    (id: string) => {
      const child = children.find((c) => c.id === id);
      if (child) return child.firstName;
      return shortName(users.find((u) => u.id === id));
    },
    [users, children],
  );
}

/** Learners I teach (at least one confirmed, in-progress or completed lesson), most recent first. */
export function useMyStudents(tutorId: string | undefined): Learner[] {
  const bookings = useMyBookings(tutorId);
  const users = useApp((s) => s.users);
  const children = useApp((s) => s.children);
  return React.useMemo(() => {
    const ids = Array.from(new Set(bookings.filter((b) => TEACHING_STATUSES.includes(b.status)).map(learnerIdOf)));
    return ids
      .map((id) => {
        const mine = bookings.filter((b) => learnerIdOf(b) === id).sort((a, b) => b.startUtc.localeCompare(a.startUtc));
        const child: Child | undefined = children.find((c) => c.id === id);
        const booker = users.find((u) => u.id === mine[0]?.bookerId);
        return {
          id,
          name: child ? child.firstName : shortName(booker),
          isChild: !!child,
          guardian: child ? shortName(booker) : undefined,
          accountRole: booker?.role,
          subjects: Array.from(new Set(mine.map((b) => b.subject))),
          bookings: mine,
        };
      })
      .sort((a, b) => (b.bookings[0]?.startUtc ?? "").localeCompare(a.bookings[0]?.startUtc ?? ""));
  }, [bookings, users, children]);
}

/* ─── Profile completeness ──────────────────────────────────────────────────── */

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
}

export function profileChecklist(t: Tutor): ChecklistItem[] {
  const hasWindows = (w: WeeklyWindow[]) => w.length > 0;
  return [
    { key: "headline", label: "Write a clear headline", done: t.headline.trim().length >= 10, href: "/dashboard/profile#about" },
    { key: "bio", label: "Bio of at least 80 characters", done: t.bio.trim().length >= 80, href: "/dashboard/profile#about" },
    { key: "approach", label: "Describe your teaching approach", done: t.approach.trim().length >= 40, href: "/dashboard/profile#about" },
    { key: "video", label: "Add an intro video", done: !!t.introVideoUrl, href: "/dashboard/profile#intro-video" },
    { key: "subjects", label: "Subjects and grade levels", done: t.subjects.length > 0 && t.levels.length > 0, href: "/dashboard/profile#subjects" },
    { key: "specialties", label: "Add at least one specialty", done: t.specialties.length > 0, href: "/dashboard/profile#subjects" },
    { key: "languages", label: "Languages you teach in", done: t.languages.length > 0, href: "/dashboard/profile#languages" },
    { key: "rate", label: "Hourly rate and teaching modes", done: t.hourlyRateCents > 0 && t.modes.length > 0, href: "/dashboard/profile#rates" },
    { key: "availability", label: "Weekly availability", done: hasWindows(t.availability), href: "/dashboard/availability" },
    { key: "credentials", label: "Education or certification listed", done: t.education.length + t.certifications.length > 0, href: "/dashboard/profile#credentials" },
    { key: "identity", label: "Identity verified", done: t.verification.identity === "verified", href: "/dashboard/verification" },
    { key: "background", label: "Background screening verified", done: t.verification.background === "verified", href: "/dashboard/verification" },
  ];
}

export function completionPercent(items: ChecklistItem[]): number {
  return items.length ? Math.round((items.filter((i) => i.done).length / items.length) * 100) : 0;
}

/* ─── Messaging a family ────────────────────────────────────────────────────── */

/** Opens the chat with a family (starting it if needed), from a lesson or a job the tutor applied to. */
export function useMessageFamily() {
  const router = useRouter();
  const contact = useApp((s) => s.contactLearner);
  const [busy, setBusy] = React.useState(false);
  const open = async (source: { bookingId?: string; requirementId?: string }) => {
    setBusy(true);
    const r = await contact(source);
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    router.push(`/dashboard/messages?c=${r.data.id}`);
  };
  return { open, busy };
}
