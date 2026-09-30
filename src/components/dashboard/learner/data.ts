"use client";

import { useMemo } from "react";
import type { Booking, Child, Grade, User } from "@/lib/types";
import { useApp } from "@/lib/store";
import { dateKey } from "@/lib/time";

/** A person lessons are for: the signed-in student, or one of a parent's children (or the parent themselves). */
export interface Learner {
  id: string;
  name: string;
  kind: "self" | "child";
  grade?: Grade;
}

/** The learner a booking is for. */
export const learnerOf = (b: Pick<Booking, "childId" | "bookerId">) => b.childId ?? b.bookerId;

export function useMyChildren(me: User | null): Child[] {
  const children = useApp((s) => s.children);
  return useMemo(() => (me ? children.filter((c) => c.parentId === me.id) : []), [children, me]);
}

/**
 * Learners visible to this account. Students see themselves. Parents see each child, plus themselves
 * when they have lessons, goals or homework of their own.
 */
export function useLearners(me: User | null): Learner[] {
  const kids = useMyChildren(me);
  const bookings = useApp((s) => s.bookings);
  const goals = useApp((s) => s.goals);
  const homework = useApp((s) => s.homework);
  const notes = useApp((s) => s.progressNotes);
  return useMemo(() => {
    if (!me) return [];
    const self: Learner = { id: me.id, name: me.role === "parent" ? "You" : me.firstName, kind: "self" };
    if (me.role !== "parent") return [self];
    const list: Learner[] = kids.map((c) => ({ id: c.id, name: c.firstName, kind: "child" as const, grade: c.grade }));
    const hasOwn =
      bookings.some((b) => b.bookerId === me.id && !b.childId) ||
      goals.some((g) => g.learnerId === me.id) ||
      homework.some((h) => h.learnerId === me.id) ||
      notes.some((n) => n.learnerId === me.id);
    return hasOwn ? [...list, self] : list;
  }, [me, kids, bookings, goals, homework, notes]);
}

/** Every learner id this account may see data for (self + own children). */
export function useLearnerIds(me: User | null): string[] {
  const kids = useMyChildren(me);
  return useMemo(() => (me ? [me.id, ...kids.map((c) => c.id)] : []), [me, kids]);
}

/** YYYY-MM-DD "today" in the viewer's time zone. */
export function todayKey(now: number, tz: string): string {
  return dateKey(new Date(now), tz);
}

/** Days between two YYYY-MM-DD keys (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** "Tue, Oct 6" for a YYYY-MM-DD key, without time-zone drift. */
export function formatDateKey(key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}
