import type { Booking, BookingStatus } from "@/lib/types";
import { DEFAULT_POLICY, type BookingPolicy } from "@/lib/data/platform";
import { percentOf } from "@/lib/format";

/**
 * Booking state machine. The UI never sets a status directly — it requests a transition and this
 * module decides whether the actor may perform it, given the current time and policy.
 * In production the same table lives in the NestJS BookingsService and runs inside a DB transaction.
 */

export type Actor = "booker" | "tutor" | "admin" | "system";

type Rule = { actors: Actor[]; guard?: (b: Booking, now: number, p: BookingPolicy) => string | null };

const startMs = (b: Booking) => new Date(b.startUtc).getTime();
const endMs = (b: Booking) => startMs(b) + b.durationMin * 60_000;

const beforeStart: Rule["guard"] = (b, now) => (now < startMs(b) ? null : "This lesson has already started.");
const afterStart: Rule["guard"] = (b, now) => (now >= startMs(b) ? null : "Available once the lesson has started.");
const afterGrace: Rule["guard"] = (b, now, p) =>
  now >= startMs(b) + p.noShowGraceMinutes * 60_000 ? null : `No-shows can be reported ${p.noShowGraceMinutes} minutes after the start time.`;
const withinDisputeWindow: Rule["guard"] = (b, now, p) =>
  now <= endMs(b) + p.disputeWindowDays * 86_400_000 ? null : `Disputes must be opened within ${p.disputeWindowDays} days of the lesson.`;
const canReschedule: Rule["guard"] = (b, now, p) => {
  if (now >= startMs(b) - p.rescheduleMinHours * 3_600_000) return `Lessons can be rescheduled up to ${p.rescheduleMinHours} hours before the start time.`;
  return (b.rescheduleCount ?? 0) >= p.maxReschedulesPerBooking ? "This lesson has reached the reschedule limit." : null;
};

export const TRANSITIONS: Record<BookingStatus, Partial<Record<BookingStatus, Rule>>> = {
  pending: {
    confirmed: { actors: ["tutor", "system", "admin"], guard: beforeStart },
    cancelled_by_student: { actors: ["booker", "admin"] },
    // "system" expires requests the tutor never answered (see runScheduledJobs).
    cancelled_by_tutor: { actors: ["tutor", "admin", "system"] },
    payment_failed: { actors: ["system"] },
    rescheduled: { actors: ["booker", "tutor"], guard: canReschedule },
  },
  confirmed: {
    in_progress: { actors: ["system", "tutor"], guard: afterStart },
    completed: { actors: ["tutor", "system", "admin"], guard: afterStart },
    cancelled_by_student: { actors: ["booker", "admin"], guard: beforeStart },
    cancelled_by_tutor: { actors: ["tutor", "admin"], guard: beforeStart },
    rescheduled: { actors: ["booker", "tutor"], guard: canReschedule },
    no_show_student: { actors: ["tutor", "admin"], guard: afterGrace },
    no_show_tutor: { actors: ["booker", "admin", "system"], guard: afterGrace },
  },
  in_progress: {
    completed: { actors: ["tutor", "system", "admin"] },
    no_show_student: { actors: ["tutor", "admin"], guard: afterGrace },
    no_show_tutor: { actors: ["booker", "admin", "system"], guard: afterGrace },
  },
  completed: { disputed: { actors: ["booker", "tutor"], guard: withinDisputeWindow } },
  no_show_student: { disputed: { actors: ["booker"], guard: withinDisputeWindow } },
  no_show_tutor: { refunded: { actors: ["admin", "system"] }, disputed: { actors: ["tutor"], guard: withinDisputeWindow } },
  payment_failed: { pending: { actors: ["booker"] }, cancelled_by_student: { actors: ["booker", "system"] } },
  disputed: { refunded: { actors: ["admin"] }, completed: { actors: ["admin"] } },
  cancelled_by_student: {},
  cancelled_by_tutor: {},
  rescheduled: {},
  refunded: {},
};

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

export function canTransition(b: Booking, to: BookingStatus, actor: Actor, now = Date.now(), policy = DEFAULT_POLICY): TransitionCheck {
  const rule = TRANSITIONS[b.status][to];
  if (!rule) return { ok: false, reason: `A ${STATUS_META[b.status].label.toLowerCase()} booking cannot become ${STATUS_META[to].label.toLowerCase()}.` };
  if (!rule.actors.includes(actor)) return { ok: false, reason: "You don't have permission to make this change." };
  const guard = rule.guard?.(b, now, policy);
  return guard ? { ok: false, reason: guard } : { ok: true };
}

export function availableTransitions(b: Booking, actor: Actor, now = Date.now(), policy = DEFAULT_POLICY): BookingStatus[] {
  return (Object.keys(TRANSITIONS[b.status]) as BookingStatus[]).filter((to) => canTransition(b, to, actor, now, policy).ok);
}

/** Refund owed when a booking is cancelled, per policy. Returns integer cents. */
export function cancellationRefund(b: Booking, by: "booker" | "tutor" | "admin", now = Date.now(), policy = DEFAULT_POLICY): { refundCents: number; rule: string } {
  const paid = b.priceCents - b.discountCents;
  if (paid <= 0) return { refundCents: 0, rule: "Nothing was charged for this lesson." };
  if (by !== "booker") return { refundCents: paid, rule: "Cancelled by the tutor or platform — full refund." };
  const hoursLeft = (startMs(b) - now) / 3_600_000;
  const freeWindow = b.type === "trial" ? policy.trialFreeCancellationHours : policy.freeCancellationHours;
  if (hoursLeft >= freeWindow) return { refundCents: paid, rule: `Cancelled ${freeWindow}+ hours before the lesson — full refund.` };
  return {
    refundCents: percentOf(paid, policy.lateCancellationRefundPercent),
    rule: `Late cancellation (under ${freeWindow} hours) — ${policy.lateCancellationRefundPercent}% refund.`,
  };
}

export function policySummary(type: Booking["type"], policy = DEFAULT_POLICY): string[] {
  const free = type === "trial" ? policy.trialFreeCancellationHours : policy.freeCancellationHours;
  return [
    `Free cancellation up to ${free} hours before the lesson.`,
    `Later cancellations are refunded at ${policy.lateCancellationRefundPercent}%.`,
    `Reschedule up to ${policy.rescheduleMinHours} hours before, up to ${policy.maxReschedulesPerBooking} times.`,
    policy.tutorNoShowRefundPercent >= 100
      ? `If your tutor doesn't show, you're refunded in full.`
      : `If your tutor doesn't show, you're refunded ${policy.tutorNoShowRefundPercent}%.`,
    `Report a problem within ${policy.disputeWindowDays} days of the lesson.`,
  ];
}

export const STATUS_META: Record<BookingStatus, { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  pending: { label: "Pending", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "accent" },
  in_progress: { label: "In progress", tone: "accent" },
  completed: { label: "Completed", tone: "success" },
  cancelled_by_student: { label: "Cancelled by student", tone: "neutral" },
  cancelled_by_tutor: { label: "Cancelled by tutor", tone: "neutral" },
  rescheduled: { label: "Rescheduled", tone: "neutral" },
  no_show_student: { label: "Student no-show", tone: "danger" },
  no_show_tutor: { label: "Tutor no-show", tone: "danger" },
  payment_failed: { label: "Payment failed", tone: "danger" },
  disputed: { label: "Disputed", tone: "warning" },
  refunded: { label: "Refunded", tone: "neutral" },
};

export const ACTION_LABEL: Partial<Record<BookingStatus, string>> = {
  confirmed: "Accept booking",
  in_progress: "Start lesson",
  completed: "Mark as completed",
  cancelled_by_student: "Cancel booking",
  cancelled_by_tutor: "Cancel booking",
  rescheduled: "Reschedule",
  no_show_student: "Report student no-show",
  no_show_tutor: "Report tutor no-show",
  disputed: "Report a problem",
  refunded: "Issue refund",
  pending: "Retry payment",
};

export function isUpcoming(b: Booking, now = Date.now()): boolean {
  return ["pending", "confirmed"].includes(b.status) && endMs(b) > now;
}

export function isPast(b: Booking, now = Date.now()): boolean {
  return endMs(b) <= now || ["completed", "cancelled_by_student", "cancelled_by_tutor", "rescheduled", "refunded", "no_show_student", "no_show_tutor"].includes(b.status);
}

/** Meeting links are only revealed shortly before a confirmed lesson. */
export function meetingLinkVisible(b: Booking, now = Date.now(), policy = DEFAULT_POLICY): boolean {
  return (b.status === "confirmed" || b.status === "in_progress") && b.mode === "online" && now >= startMs(b) - policy.meetingLinkVisibleMinutesBefore * 60_000 && now <= endMs(b);
}

export { startMs, endMs };
