"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Review, Tutor, User } from "@/lib/types";
import { TUTORS } from "@/lib/data/tutors";
import { REVIEWS } from "@/lib/data/reviews";
import { useApp, resolveTutor } from "./index";
import { isFlagOn } from "@/lib/flags";

/*
 * IMPORTANT (zustand v5): a selector passed to `useApp` must return a stable reference — a slice of
 * state or a primitive. Never build new arrays/objects inside the selector; select raw slices and
 * derive with useMemo (as below) or use `useShallow` from "zustand/react/shallow".
 */

export function useHydrated(): boolean {
  return useApp((s) => s.hydrated);
}

export function useSession(): User | null {
  const users = useApp((s) => s.users);
  const id = useApp((s) => s.sessionUserId);
  const hydrated = useHydrated();
  return useMemo(() => (hydrated ? users.find((u) => u.id === id) ?? null : null), [users, id, hydrated]);
}

/** All published reviews (sample reviews + reviews created in this browser). */
export function useReviews(): Review[] {
  const local = useApp((s) => s.reviews);
  return useMemo(() => {
    const localIds = new Set(local.map((r) => r.id));
    return [...local, ...REVIEWS.filter((r) => !localIds.has(r.id))].filter((r) => r.status === "published");
  }, [local]);
}

/** Every tutor with local overrides applied and ratings recomputed from real review data. */
export function useTutors(): Tutor[] {
  const overrides = useApp((s) => s.tutorOverrides);
  const registered = useApp((s) => s.registeredTutors);
  const reviews = useReviews();
  return useMemo(() => {
    const byTutor = new Map<string, number[]>();
    for (const r of reviews) byTutor.set(r.tutorId, [...(byTutor.get(r.tutorId) ?? []), r.rating]);
    return [...TUTORS, ...registered].map((t) => {
      const merged = resolveTutor({ tutorOverrides: overrides, registeredTutors: registered }, t.id)!;
      const ratings = byTutor.get(t.id) ?? [];
      return {
        ...merged,
        reviewCount: ratings.length,
        rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
      };
    });
  }, [overrides, registered, reviews]);
}

export function useTutor(idOrSlug: string | undefined): Tutor | undefined {
  const tutors = useTutors();
  return useMemo(() => tutors.find((t) => t.id === idOrSlug || t.slug === idOrSlug), [tutors, idOrSlug]);
}

/** Feature flag for the current viewer, honoring gradual rollout percentages. */
export function useFlag(key: string): boolean {
  const flags = useApp((s) => s.flags);
  const userId = useApp((s) => s.sessionUserId);
  return useMemo(() => isFlagOn(flags, key, userId), [flags, key, userId]);
}

export function useCreditBalance(tutorId: string | undefined): number {
  const tx = useApp((s) => s.leadTransactions);
  return useMemo(() => (tutorId ? tx.filter((t) => t.tutorId === tutorId).reduce((a, t) => a + t.delta, 0) : 0), [tx, tutorId]);
}

/** Study Credits in the signed-in learner's wallet, in cents. 0 when signed out. */
export function useWalletBalance(): number {
  const tx = useApp((s) => s.walletTransactions);
  const me = useSession();
  return useMemo(() => (me ? tx.filter((t) => t.userId === me.id).reduce((a, t) => a + t.deltaCents, 0) : 0), [tx, me]);
}

export function useUnreadNotifications(): number {
  const list = useApp((s) => s.notifications);
  const me = useSession();
  return useMemo(() => (me ? list.filter((n) => n.userId === me.id && !n.read).length : 0), [list, me]);
}

/** Unread messages across the current user's conversations. */
export function useUnreadMessages(): number {
  const convs = useApp((s) => s.conversations);
  const msgs = useApp((s) => s.messages);
  const me = useSession();
  return useMemo(() => {
    if (!me) return 0;
    const mine = convs.filter((c) => c.userId === me.id || (me.tutorId && c.tutorId === me.tutorId));
    const ids = new Set(mine.map((c) => c.id));
    const selfIds = new Set([me.id, me.tutorId].filter(Boolean));
    return msgs.filter((m) => ids.has(m.conversationId) && !selfIds.has(m.senderId) && !m.readAt).length;
  }, [convs, msgs, me]);
}

/** Ticks every `intervalMs` so countdowns and "starts in" labels stay current. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** The viewer's display time zone: their saved preference, else the browser's. */
const noopSubscribe = () => () => {};
/**
 * US-first: signed-out visitors see times in their browser's zone when it's a US zone, otherwise Eastern Time.
 * Signed-in users always get the zone saved on their account (editable in Settings).
 */
function readBrowserTz(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && (tz.startsWith("America/") || tz === "Pacific/Honolulu") ? tz : "America/New_York";
  } catch {
    return "America/New_York";
  }
}

export function useViewerTimezone(): string {
  const me = useSession();
  const browserTz = useSyncExternalStore(noopSubscribe, readBrowserTz, () => "America/New_York");
  return me?.timezone ?? browserTz;
}
