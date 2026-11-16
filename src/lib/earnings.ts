import type { Booking, Payment, Payout } from "@/lib/types";
import type { BookingPolicy } from "@/lib/data/platform";
import { endMs } from "@/lib/booking";
import { asCurrency, type Currency } from "@/lib/money";

/*
 * Tutor earnings, in integer minor units and always in each booking's own currency (amounts in different
 * currencies are never added). The tutor's Earnings page, Admin → Payments and the server's payout check
 * all use these, so they agree on what a tutor is owed.
 */

export const DAY_MS = 86_400_000;

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

/** Money given back on a lesson (its refund rows). */
export function refundedCents(bookingId: string, payments: Payment[]): number {
  return payments.filter((p) => p.bookingId === bookingId && p.amountCents < 0).reduce((sum, p) => sum - p.amountCents, 0);
}

/**
 * What TutorLink owes the tutor for one lesson: only lessons whose payment was actually collected (a free
 * or unpaid lesson owes nothing), less anything refunded on it.
 */
export function lessonPayoutCents(b: Booking, payments: Payment[]): number {
  if (!isEarned(b) || (b.paymentStatus !== "paid" && b.paymentStatus !== "partially_refunded")) return 0;
  return Math.max(0, netCents(b) - refundedCents(b.id, payments));
}

export interface PayoutBalance {
  currency: Currency;
  /** Cleared lessons (dispute window over) less payouts already sent. Can be below 0 after a late refund. */
  available: number;
  /** Lessons still in the dispute window. */
  clearing: number;
}

/** What a tutor is owed, one entry per currency. Failed payouts don't count as paid. */
export function payoutBalances(tutorId: string, bookings: Booking[], payments: Payment[], payouts: Payout[], now: number, policy: BookingPolicy): PayoutBalance[] {
  const by = new Map<Currency, PayoutBalance>();
  const entry = (c: Currency) => {
    let e = by.get(c);
    if (!e) by.set(c, (e = { currency: c, available: 0, clearing: 0 }));
    return e;
  };
  for (const b of bookings) {
    if (b.tutorId !== tutorId) continue;
    const owed = lessonPayoutCents(b, payments);
    if (owed <= 0) continue;
    const e = entry(asCurrency(b.currency));
    if (isCleared(b, now, policy)) e.available += owed;
    else e.clearing += owed;
  }
  for (const p of payouts) {
    if (p.tutorId !== tutorId || p.status === "failed") continue;
    entry(asCurrency(p.currency)).available -= p.amountCents;
  }
  return [...by.values()];
}
