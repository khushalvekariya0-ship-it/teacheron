/**
 * Shared helpers for the admin Bookings, Payments and Disputes pages. Pure functions only (no JSX).
 * Money is integers in each currency's minor unit, always shown with its own currency (never added across currencies).
 */
import type { Booking, BookingStatus, Dispute, DisputeStatus, Payment, Payout } from "@/lib/types";
import { CURRENCIES, asCurrency, formatMoney, formatSums, sumByCurrency, type Currency } from "@/lib/money";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

/** What the booker was charged for a booking (list price minus any coupon). */
export function bookingPaid(b: Pick<Booking, "priceCents" | "discountCents">): number {
  return b.priceCents - b.discountCents;
}

/** Refund rows (negative amounts) recorded against one booking (so all in its currency), as a positive total. */
export function refundedCents(payments: Payment[]): number {
  return payments.reduce((sum, p) => (p.amountCents < 0 ? sum - p.amountCents : sum), 0);
}

/** "−₹250" / "−$25" for refunds, "₹950" / "$95" for charges. */
export function signedMoney(minor: number, currency: Currency): string {
  return minor < 0 ? `−${formatMoney(-minor, currency)}` : formatMoney(minor, currency);
}

/** A Razorpay refund row that Razorpay hasn't confirmed yet (no refund id). It is retried automatically. */
export function isRefundPending(p: Payment): boolean {
  return p.provider === "razorpay" && p.amountCents < 0 && !p.providerRefundId;
}

/** Rows added up for one line, one figure per currency ("₹12,000 + $340"); `sign` −1 shows refunds as positive amounts. */
export function sumRows(rows: { amountCents: number; currency: Currency }[], sign: 1 | -1 = 1, opts: { exact?: boolean } = {}): string {
  return formatSums(rows.map((r) => ({ amount: sign * r.amountCents, currency: r.currency })), undefined, opts);
}

/**
 * Settled money across many payments: succeeded or partly refunded charges, refunds, and charges minus
 * refunds. Each is one figure per currency (amounts in different currencies are never added together).
 */
export function settledSums(payments: Payment[]): { gross: string; refunds: string; net: string } {
  const { gross, refunds } = settledRows(payments);
  return { gross: sumRows(gross), refunds: sumRows(refunds, -1), net: sumRows([...gross, ...refunds]) };
}

function settledRows(payments: Payment[]): { gross: Payment[]; refunds: Payment[] } {
  return {
    gross: payments.filter((p) => p.amountCents > 0 && (p.status === "succeeded" || p.status === "partially_refunded")),
    refunds: payments.filter((p) => p.amountCents < 0),
  };
}

/**
 * The currencies with settled money (charges minus refunds), largest first. A chart that can only plot
 * one number series uses the first and says so.
 */
export function settledCurrencies(payments: Payment[]): Currency[] {
  const { gross, refunds } = settledRows(payments);
  return sumByCurrency([...gross, ...refunds].map((p) => ({ amount: p.amountCents, currency: p.currency }))).map((x) => x.currency);
}

/**
 * A plan or lead-pack price in both lists TutorLink charges tutors in ("$29 / ₹999"): US dollars, and
 * rupees for tutors who charge in ₹. Pass planPrice / packPrice for one id, e.g. `(c) => planPrice("pro", c)`.
 */
export function platformPrices(price: (currency: Currency) => { amount: number; currency: Currency }, opts: { exact?: boolean } = {}): string {
  return (["USD", "INR"] as const)
    .map((c) => {
      const p = price(c);
      return formatMoney(p.amount, p.currency, opts);
    })
    .join(" / ");
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
 * Parses an amount typed by staff (in `currency`) into integer minor units without float drift.
 * Accepts "25", "25.5", "25.50", "1,025.00" and the currency's symbol or code in front ("₹1,025", "INR 1025"). Rejects negatives and more than two decimals.
 */
export function parseAmount(input: string, currency: Currency): { ok: true; cents: number } | { ok: false; error: string } {
  const c = asCurrency(currency);
  let raw = input.trim().replace(/,/g, "");
  for (const prefix of [CURRENCIES[c].symbol, c]) {
    if (raw.toUpperCase().startsWith(prefix.toUpperCase())) {
      raw = raw.slice(prefix.length).trim();
      break;
    }
  }
  if (!raw) return { ok: false, error: "Enter an amount." };
  if (!/^\d+(\.\d{0,2})?$/.test(raw)) return { ok: false, error: "Enter an amount with up to two decimals, e.g. 25.50." };
  const [whole, frac = ""] = raw.split(".");
  if (whole.length > 7) return { ok: false, error: "That amount is too large." };
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0") || "0");
  return { ok: true, cents };
}

/**
 * Props for an <Input> taking an amount in `currency`: a short symbol ("₹", "$", "£") sits in front;
 * longer ones ("CA$", "AED") don't fit there, so the code goes at the end instead.
 */
export function moneyInputProps(currency: Currency): { prefixText?: string; suffix?: string } {
  const c = asCurrency(currency);
  const symbol = CURRENCIES[c].symbol;
  return symbol.length <= 1 ? { prefixText: symbol } : { suffix: c };
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
