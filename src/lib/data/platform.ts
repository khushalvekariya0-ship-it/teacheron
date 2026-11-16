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

/**
 * What tutors pay TutorLink for a plan or a lead-credit pack: in rupees for tutors who charge in ₹, in US
 * dollars for everyone else.
 */
export type PlatformCurrency = "USD" | "INR";
export const PLATFORM_CURRENCIES: PlatformCurrency[] = ["USD", "INR"];
export const platformCurrency = (tutorCurrency: Currency | string | undefined): PlatformCurrency => (asCurrency(tutorCurrency) === "INR" ? "INR" : "USD");

/** A tutor plan. Administrators edit, add, hide and reorder plans in Admin → Plans & credits. */
export interface Plan {
  /** Fixed once created: "free" (Starter, always there), "pro", "premium", or made from a new plan's name. */
  id: string;
  name: string;
  description: string;
  /** What the plan includes, one line each. Its commission and monthly credits are listed from the numbers below. */
  features: string[];
  /** TutorLink's commission on each paid lesson. Starter's is the platform fee (Admin → Settings). */
  commissionBps: number;
  monthlyLeadCredits: number;
  /** Monthly price in minor units, per platform currency (0 = free). */
  prices: Record<PlatformCurrency, number>;
  /** Shown as the recommended plan. */
  highlighted?: boolean;
  /** No longer offered: tutors already on it keep it. */
  hidden?: boolean;
}

/** A pack of job application (lead) credits. */
export interface CreditPack {
  id: string;
  credits: number;
  prices: Record<PlatformCurrency, number>;
  hidden?: boolean;
}

export interface Pricing {
  plans: Plan[];
  packs: CreditPack[];
}

export const FREE_PLAN_ID = "free";

/** The plans and packs before an administrator changes anything. */
export const DEFAULT_PRICING: Pricing = {
  plans: [
    {
      id: "free", name: "Starter", prices: { USD: 0, INR: 0 }, commissionBps: 1800, monthlyLeadCredits: 3,
      description: "Everything you need to create a profile and start teaching.",
      features: ["Public tutor profile", "Receive messages and bookings", "Calendar and availability"],
    },
    {
      id: "pro", name: "Professional", prices: { USD: 2900, INR: 99900 }, commissionBps: 1500, monthlyLeadCredits: 20, highlighted: true,
      description: "For established tutors growing a steady client base.",
      features: ["Everything in Starter", "Instant job alerts", "Priority support"],
    },
    {
      id: "premium", name: "Premium", prices: { USD: 5900, INR: 199900 }, commissionBps: 1200, monthlyLeadCredits: 50,
      description: "For full-time tutors who want maximum reach.",
      features: ["Everything in Professional", "Eligible for featured placement", "Advanced earnings reports"],
    },
  ],
  packs: [
    { id: "pack_10", credits: 10, prices: { USD: 1500, INR: 49900 } },
    { id: "pack_25", credits: 25, prices: { USD: 3200, INR: 99900 } },
    { id: "pack_60", credits: 60, prices: { USD: 6900, INR: 199900 } },
  ],
};

export const findPlan = (pricing: Pricing, id: string | undefined): Plan | undefined => pricing.plans.find((p) => p.id === id);
/** Starter, the free plan every tutor is on until they choose another. */
export const starterPlan = (pricing: Pricing): Plan => findPlan(pricing, FREE_PLAN_ID) ?? DEFAULT_PRICING.plans[0];
/** Plans and packs a tutor can choose now (in the order set by administrators). */
export const offeredPlans = (pricing: Pricing): Plan[] => pricing.plans.filter((p) => !p.hidden);
export const offeredPacks = (pricing: Pricing): CreditPack[] => pricing.packs.filter((p) => !p.hidden);
/** The plan's features, then its credits and commission written from the numbers (so they never go stale). */
export const planFeatureLines = (p: Plan): string[] => [
  ...p.features,
  `${p.monthlyLeadCredits} job application credit${p.monthlyLeadCredits === 1 ? "" : "s"} / month`,
  `${p.commissionBps / 100}% booking commission`,
];

/** A plan's monthly price for a tutor charging in `tutorCurrency`. */
export function planPrice(pricing: Pricing, planId: string, tutorCurrency: Currency | string | undefined): { amount: number; currency: PlatformCurrency } {
  const currency = platformCurrency(tutorCurrency);
  return { amount: findPlan(pricing, planId)?.prices[currency] ?? 0, currency };
}
/** A lead-credit pack's price for a tutor charging in `tutorCurrency`. */
export function packPrice(pricing: Pricing, packId: string, tutorCurrency: Currency | string | undefined): { amount: number; currency: PlatformCurrency } {
  const currency = platformCurrency(tutorCurrency);
  return { amount: pricing.packs.find((p) => p.id === packId)?.prices[currency] ?? 0, currency };
}

/**
 * Pricing as saved by administrators (or the defaults), cleaned up, with Starter always present, free and
 * first, and its commission taken from the platform fee (Admin → Settings), so there is one source for it.
 */
export function readPricing(saved: unknown, platformFeeBps: number): Pricing {
  const s = (saved && typeof saved === "object" ? saved : {}) as Partial<Pricing>;
  const money = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : 0);
  const prices = (v: unknown) => {
    const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    return { USD: money(o.USD), INR: money(o.INR) };
  };
  const plans: Plan[] = (Array.isArray(s.plans) && s.plans.length ? s.plans : DEFAULT_PRICING.plans)
    .filter((p) => p && typeof p.id === "string" && typeof p.name === "string")
    .map((p) => ({
      id: p.id, name: p.name, description: typeof p.description === "string" ? p.description : "",
      features: Array.isArray(p.features) ? p.features.filter((f) => typeof f === "string") : [],
      commissionBps: Number.isInteger(p.commissionBps) ? p.commissionBps : 0, monthlyLeadCredits: Number.isInteger(p.monthlyLeadCredits) ? p.monthlyLeadCredits : 0,
      prices: prices(p.prices), ...(p.highlighted ? { highlighted: true } : {}), ...(p.hidden ? { hidden: true } : {}),
    }));
  const free = plans.find((p) => p.id === FREE_PLAN_ID) ?? DEFAULT_PRICING.plans[0];
  const starter: Plan = { ...free, prices: { USD: 0, INR: 0 }, commissionBps: platformFeeBps, hidden: undefined };
  const packs: CreditPack[] = (Array.isArray(s.packs) ? s.packs : DEFAULT_PRICING.packs)
    .filter((p) => p && typeof p.id === "string" && Number.isInteger(p.credits))
    .map((p) => ({ id: p.id, credits: p.credits, prices: prices(p.prices), ...(p.hidden ? { hidden: true } : {}) }));
  return { plans: [starter, ...plans.filter((p) => p.id !== FREE_PLAN_ID)], packs };
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
