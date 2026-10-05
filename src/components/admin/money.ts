/**
 * Shared helpers for the admin Bookings, Payments and Disputes pages. Pure functions only (no JSX).
 * Money is integer cents throughout.
 */
import type { Booking, BookingStatus, Dispute, DisputeStatus, Payment, Payout } from "@/lib/types";
import { formatCents } from "@/lib/format";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

/** What the booker was charged for a booking (list price minus any coupon). */
export function bookingPaid(b: Pick<Booking, "priceCents" | "discountCents">): number {
  return b.priceCents - b.discountCents;
}

/** Refund rows (negative amounts) recorded against a booking, as a positive total. */
export function refundedCents(payments: Payment[]): number {
  return payments.reduce((sum, p) => (p.amountCents < 0 ? sum - p.amountCents : sum), 0);
}

/** "−$25" for refunds, "$95" for charges. */
export function signedCents(cents: number): string {
  return cents < 0 ? `−${formatCents(-cents)}` : formatCents(cents);
}

/* ─── Payments & payouts ─────────────────────────────────────────────────────── */

export const PAYMENT_KIND_LABEL: Record<Payment["kind"], string> = {
  booking: "Lesson",
  subscription: "Subscription",
  lead_credits: "Lead credits",
  study_credits: "Study Credits",
};

export const PAYMENT_ROW_META: Record<Payment["status"], { label: string; tone: Tone }> = {
  succeeded: { label: "Succeeded", tone: "success" },
  pending: { label: "Pending", tone: "accent" },
  failed: { label: "Failed", tone: "danger" },
  refunded: { label: "Refunded", tone: "neutral" },
  partially_refunded: { label: "Partially refunded", tone: "warning" },
};

export const PAYOUT_META: Record<Payout["status"], { label: string; tone: Tone }> = {
  scheduled: { label: "Scheduled", tone: "accent" },
  in_transit: { label: "In transit", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

/** Refund rows come from two places: dispute resolutions and the booking policy. */
export function refundSource(p: Payment): "dispute" | "policy" {
  return p.description.startsWith("Dispute refund") ? "dispute" : "policy";
}

/** Payout arrival dates are calendar dates (YYYY-MM-DD) — format them without a time-zone shift. */
export function formatCalendarDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(d);
}

/* ─── Disputes ──────────────────────────────────────────────────────────────── */

export const DISPUTE_REASON_LABEL: Record<Dispute["reason"], string> = {
  missed_session: "Missed session",
  tutor_no_show: "Tutor no-show",
  student_no_show: "Student no-show",
  service_issue: "Service issue",
  payment_issue: "Payment issue",
  refund_issue: "Refund issue",
  other: "Other",
};

export const DISPUTE_STATUS_META: Record<DisputeStatus, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "warning" },
  under_review: { label: "Under review", tone: "accent" },
  awaiting_information: { label: "Awaiting information", tone: "neutral" },
  escalated: { label: "Escalated", tone: "danger" },
  resolved: { label: "Resolved", tone: "success" },
  rejected: { label: "Rejected", tone: "neutral" },
};

export const OPEN_DISPUTE_STATUSES: DisputeStatus[] = ["open", "under_review", "awaiting_information", "escalated"];

export function isDisputeOpen(d: Pick<Dispute, "status">): boolean {
  return OPEN_DISPUTE_STATUSES.includes(d.status);
}

export const RESOLUTION_LABEL: Record<NonNullable<Dispute["resolution"]>["outcome"], string> = {
  full_refund: "Full refund",
  partial_refund: "Partial refund",
  credit: "Platform credit",
  no_refund: "No refund",
};

/* ─── Money input ───────────────────────────────────────────────────────────── */

/**
 * Parses a dollar amount typed by staff into integer cents without float drift.
 * Accepts "25", "25.5", "25.50", "$1,025.00". Rejects negatives and more than two decimals.
 */
export function parseDollars(input: string): { ok: true; cents: number } | { ok: false; error: string } {
  const raw = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!raw) return { ok: false, error: "Enter an amount." };
  if (!/^\d+(\.\d{0,2})?$/.test(raw)) return { ok: false, error: "Enter a dollar amount with up to two decimals, e.g. 25.50." };
  const [whole, frac = ""] = raw.split(".");
  if (whole.length > 7) return { ok: false, error: "That amount is too large." };
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0") || "0");
  return { ok: true, cents };
}

/* ─── Admin booking transitions ─────────────────────────────────────────────── */

/** Labels written for staff acting on someone else's booking. */
export function adminTransitionLabel(from: BookingStatus, to: BookingStatus): string {
  switch (to) {
    case "confirmed":
      return "Confirm on tutor's behalf";
    case "cancelled_by_student":
      return "Cancel (student request)";
    case "cancelled_by_tutor":
      return "Cancel (tutor request)";
    case "completed":
      return from === "disputed" ? "Close dispute as completed" : "Mark completed";
    case "no_show_student":
      return "Mark student no-show";
    case "no_show_tutor":
      return "Mark tutor no-show";
    case "refunded":
      return from === "disputed" ? "Close dispute as refunded" : "Mark refunded";
    default:
      return `Set to ${to.replace(/_/g, " ")}`;
  }
}

export function isDestructiveTransition(to: BookingStatus): boolean {
  return to === "cancelled_by_student" || to === "cancelled_by_tutor" || to === "no_show_student" || to === "no_show_tutor" || to === "refunded";
}

/** Why a booking belongs in the "Needs attention" queue, or null. */
export function attentionReason(b: Booking, now: number): string | null {
  const start = new Date(b.startUtc).getTime();
  const end = start + b.durationMin * 60_000;
  switch (b.status) {
    case "disputed":
      return "Dispute open";
    case "payment_failed":
      return "Payment failed";
    case "no_show_tutor":
      return b.paymentStatus === "refunded" ? null : "Tutor no-show not closed out";
    case "pending":
      if (start <= now) return "Start time passed without confirmation";
      if (start - now <= 24 * 3_600_000) return "Unconfirmed, starts within 24 hours";
      return null;
    case "confirmed":
    case "in_progress":
      return end <= now ? "Ended but not marked completed" : null;
    default:
      return null;
  }
}
