import type { FeatureFlag, PayMethod } from "@/lib/types";
import { asCurrency, topUpAmounts, type Currency } from "@/lib/money";

/**
 * Booking policies. These are DEFAULTS pending product-owner approval — see docs/DECISIONS.md.
 * Administrators can edit them in Admin → Platform settings.
 */
export interface BookingPolicy {
  freeCancellationHours: number;
  lateCancellationRefundPercent: number;
  trialFreeCancellationHours: number;
  rescheduleMinHours: number;
  maxReschedulesPerBooking: number;
  studentNoShowRefundPercent: number;
  tutorNoShowRefundPercent: number;
  tutorNoShowCreditCents: number;
  disputeWindowDays: number;
  noShowGraceMinutes: number;
  meetingLinkVisibleMinutesBefore: number;
}

export const DEFAULT_POLICY: BookingPolicy = {
  freeCancellationHours: 24,
  lateCancellationRefundPercent: 50,
  trialFreeCancellationHours: 4,
  rescheduleMinHours: 12,
  maxReschedulesPerBooking: 2,
  studentNoShowRefundPercent: 0,
  tutorNoShowRefundPercent: 100,
  tutorNoShowCreditCents: 1000,
  disputeWindowDays: 7,
  noShowGraceMinutes: 15,
  meetingLinkVisibleMinutesBefore: 15,
};

export interface Plan {
  id: "free" | "pro" | "premium";
  name: string;
  priceCents: number; // per month
  description: string;
  commissionBps: number;
  monthlyLeadCredits: number;
  features: string[];
  highlighted?: boolean;
}

export const TUTOR_PLANS: Plan[] = [
  {
    id: "free", name: "Starter", priceCents: 0, commissionBps: 1800, monthlyLeadCredits: 3,
    description: "Everything you need to create a profile and start teaching.",
    features: ["Public tutor profile", "Receive messages and bookings", "3 job application credits / month", "Calendar and availability", "18% booking commission"],
  },
  {
    id: "pro", name: "Professional", priceCents: 2900, commissionBps: 1500, monthlyLeadCredits: 20, highlighted: true,
    description: "For established tutors growing a steady client base.",
    features: ["Everything in Starter", "20 job application credits / month", "Instant job alerts", "Priority support", "15% booking commission"],
  },
  {
    id: "premium", name: "Premium", priceCents: 5900, commissionBps: 1200, monthlyLeadCredits: 50,
    description: "For full-time tutors who want maximum reach.",
    features: ["Everything in Professional", "50 job application credits / month", "Eligible for featured placement", "Advanced earnings reports", "12% booking commission"],
  },
];

export const CREDIT_PACKS = [
  { id: "pack_10", credits: 10, priceCents: 1500 },
  { id: "pack_25", credits: 25, priceCents: 3200 },
  { id: "pack_60", credits: 60, priceCents: 6900 },
];

/**
 * What tutors pay TutorLink for a plan or a lead-credit pack: in rupees for tutors who charge in ₹, in US
 * dollars for everyone else. The ₹ prices are starting points for the product owner to set.
 */
export type PlatformCurrency = "USD" | "INR";
const PLATFORM_PRICES: Record<PlatformCurrency, { plans: Record<string, number>; packs: Record<string, number> }> = {
  USD: { plans: { free: 0, pro: 2900, premium: 5900 }, packs: { pack_10: 1500, pack_25: 3200, pack_60: 6900 } },
  INR: { plans: { free: 0, pro: 99900, premium: 199900 }, packs: { pack_10: 49900, pack_25: 99900, pack_60: 199900 } },
};
export const platformCurrency = (tutorCurrency: Currency | string | undefined): PlatformCurrency => (asCurrency(tutorCurrency) === "INR" ? "INR" : "USD");
/** A plan's monthly price for a tutor charging in `tutorCurrency`. */
export function planPrice(planId: string, tutorCurrency: Currency | string | undefined): { amount: number; currency: PlatformCurrency } {
  const currency = platformCurrency(tutorCurrency);
  return { amount: PLATFORM_PRICES[currency].plans[planId] ?? TUTOR_PLANS.find((p) => p.id === planId)?.priceCents ?? 0, currency };
}
/** A lead-credit pack's price for a tutor charging in `tutorCurrency`. */
export function packPrice(packId: string, tutorCurrency: Currency | string | undefined): { amount: number; currency: PlatformCurrency } {
  const currency = platformCurrency(tutorCurrency);
  return { amount: PLATFORM_PRICES[currency].packs[packId] ?? CREDIT_PACKS.find((p) => p.id === packId)?.priceCents ?? 0, currency };
}

/**
 * Study Credits: prepaid lesson money on a student or parent account, kept in the learner's own currency.
 * Credits are worth their face value (no bonus, no fee) and pay for a lesson with a tutor who charges in that
 * currency in one tap. Refunds for such lessons return to the wallet. The four suggested amounts depend on
 * the currency (₹500 / ₹1,000 / ₹2,000 / ₹5,000; $25 / $50 / $100 / $200…).
 */
export const STUDY_CREDIT_PACKS = [{ id: "sc_25" }, { id: "sc_50" }, { id: "sc_100" }, { id: "sc_200" }] as const;
/** A Study Credit pack's amount (minor units) in a learner's currency, or null for an unknown pack. */
export function studyPackAmount(packId: string, currency: Currency): number | null {
  const i = STUDY_CREDIT_PACKS.findIndex((p) => p.id === packId);
  return i < 0 ? null : (topUpAmounts(currency)[i] ?? null);
}

/** What a payment record shows as its method. */
export const PAY_METHOD_LABEL: Record<PayMethod, string> = {
  card: "Card",
  upi: "UPI",
  wallet: "Study Credits",
};

/** Credits spent to apply to a job. */
export const CREDITS_PER_APPLICATION = 1;

export const DEFAULT_FLAGS: FeatureFlag[] = [
  { key: "trial_lessons", label: "Trial lessons", description: "Allow tutors to offer free or paid trial lessons.", enabled: true, rolloutPercent: 100 },
  { key: "instant_booking", label: "Instant booking", description: "Let tutors accept bookings without manual approval.", enabled: true, rolloutPercent: 100 },
  { key: "online_lessons", label: "Online lessons", description: "Integrated online lesson page with meeting links.", enabled: true, rolloutPercent: 100 },
  { key: "lead_credits", label: "Lead credits", description: "Tutors spend credits to apply to student jobs.", enabled: true, rolloutPercent: 100 },
  { key: "ai_matching", label: "AI-assisted matching", description: "Natural-language concierge input. Rules-based scoring remains the source of truth.", enabled: true, rolloutPercent: 25 },
  { key: "coupons", label: "Coupons", description: "Promotional codes at checkout.", enabled: true, rolloutPercent: 100 },
  { key: "referrals", label: "Referrals", description: "Referral codes and credits.", enabled: false, rolloutPercent: 0 },
  { key: "parent_accounts", label: "Parent accounts", description: "Parent accounts with child profiles.", enabled: true, rolloutPercent: 100 },
  { key: "progress_tracking", label: "Progress tracking", description: "Learning goals, homework and progress notes.", enabled: true, rolloutPercent: 100 },
  { key: "sms_notifications", label: "SMS notifications", description: "Send reminders by SMS via Twilio.", enabled: false, rolloutPercent: 0 },
  { key: "featured_tutors", label: "Featured tutors", description: "Show featured placement on the homepage and search.", enabled: true, rolloutPercent: 100 },
];
