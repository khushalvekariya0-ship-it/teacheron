import type {
  Application, AppNotification, AuditLog, Booking, BookingType, Child, Conversation, Coupon, Dispute, FeatureFlag, Homework,
  LeadTransaction, LearningGoal, Message, NotificationPrefs, PayMethod, Payment, Payout, ProgressNote, Report, Requirement, Review,
  SavedSearch, StudentProfile, Subject, SubjectCategory, Subscription, TeachingMode, Tutor, User, VerificationRequest, WalletTransaction,
  ContactFlag,
} from "@/lib/types";
import type { BookingPolicy } from "@/lib/data/platform";
import { maskMatches, scanContact } from "./contact";

/*
 * The application's data, as one plain object. The same shape is used in two places:
 *  • on the server, where the domain actions (./actions.ts) run against the rows a request needs,
 *    loaded from Postgres, and the changes are written back in the same transaction;
 *  • in the browser, where the store (src/lib/store) holds what the signed-in viewer may see.
 */

/** `code` marks failures the interface treats specially (a message stopped for contact details, a paused account). */
export type FailCode = "contact_blocked" | "chat_paused" | "payment_required";
export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; code?: string };
export const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
export const fail = (error: string, code?: FailCode): Result<never> => (code ? { ok: false, error, code } : { ok: false, error });

export interface TutorOnboardingDraft {
  step: number;
  data: Record<string, unknown>;
  updatedAt: string;
  submittedAt?: string;
}

export interface CreateBookingInput {
  tutorId: string;
  startUtc: string;
  durationMin: number;
  type: BookingType;
  mode: TeachingMode;
  subject: string;
  childId?: string;
  notes?: string;
  couponCode?: string;
  /** "wallet" needs enough Study Credits for the whole charge. */
  payWith?: PayMethod;
  idempotencyKey: string;
}

export interface LoginEvent {
  userId: string;
  at: string;
  device: string;
  success: boolean;
}

/* ─── Website content (Admin → Content) ─────────────────────────────────── */

export type FaqAudience = "families" | "tutors" | "payments" | "safety";

export interface FaqItem {
  id: string;
  audience: FaqAudience;
  q: string;
  a: string;
  published: boolean;
}

export type BlogCategory = "Parents" | "Students" | "Tutors" | "Test prep";

export interface BlogPostItem {
  slug: string;
  title: string;
  excerpt: string;
  category: BlogCategory;
  author: string;
  /** YYYY-MM-DD shown on the post. */
  date: string;
  readMinutes: number;
  body: { h?: string; p: string }[];
  status: "draft" | "published";
}

export interface TestimonialItem {
  id: string;
  quote: string;
  name: string;
  context: string;
  used: { label: string; href: string };
  /** The customer agreed to have this story shown. Required before it can be published. */
  consentConfirmed: boolean;
  published: boolean;
}

export interface Data {
  sessionUserId: string | null;
  users: User[];
  children: Child[];
  /** Pending edits to a tutor in `registeredTutors` (merged with resolveTutor, written into the tutor row on save). */
  tutorOverrides: Record<string, Partial<Tutor>>;
  registeredTutors: Tutor[];
  onboarding: Record<string, TutorOnboardingDraft>;
  /** Students' learning profiles, by user id (Dashboard → My profile). */
  studentProfiles: Record<string, StudentProfile>;
  favorites: Record<string, string[]>;
  savedSearches: SavedSearch[];
  savedJobs: Record<string, string[]>;
  requirements: Requirement[];
  applications: Application[];
  bookings: Booking[];
  reviews: Review[];
  conversations: Conversation[];
  messages: Message[];
  notifications: AppNotification[];
  notificationPrefs: Record<string, NotificationPrefs>;
  goals: LearningGoal[];
  progressNotes: ProgressNote[];
  homework: Homework[];
  payments: Payment[];
  payouts: Payout[];
  leadTransactions: LeadTransaction[];
  /** Study Credits: every top-up, lesson payment and refund on learner wallets. */
  walletTransactions: WalletTransaction[];
  subscriptions: Record<string, Subscription>;
  reports: Report[];
  /** Messages, notes and files stopped for containing contact details (staff with reports.moderate only). */
  contactFlags: ContactFlag[];
  disputes: Dispute[];
  verificationRequests: VerificationRequest[];
  auditLogs: AuditLog[];
  flags: FeatureFlag[];
  coupons: Coupon[];
  policy: BookingPolicy;
  platformFeeBps: number;
  /** Main subjects and their sub-categories, as edited in Admin → Subjects. Every page reads this (see useCatalog). */
  catalog: { categories: SubjectCategory[]; subjects: Subject[] };
  loginHistory: LoginEvent[];
  /**
   * Other people's upcoming lessons with the listed tutors, as busy times only (no names or ids), so
   * calendars and time pickers don't offer times that are already requested or booked. Sent by the
   * server with the state; never saved.
   */
  tutorBusy: { tutorId: string; startUtc: string; durationMin: number }[];
  blogPosts: BlogPostItem[];
  faqs: FaqItem[];
  testimonials: TestimonialItem[];
}

export type Collection = Exclude<keyof Data, "sessionUserId">;

/** What the server tells the browser about which backend services are connected. */
export interface ClientConfig {
  /** Database and sign-in are connected. */
  configured: boolean;
  /** Card / UPI payments can be taken. */
  paymentsEnabled: boolean;
  /** File uploads (Supabase Storage) are available. */
  uploads: boolean;
  /** Emails outside Supabase Auth (parental consent) can be sent. */
  email: boolean;
}

export function emptyData(defaults: Pick<Data, "flags" | "policy" | "platformFeeBps" | "catalog">): Data {
  return {
    sessionUserId: null,
    users: [], children: [], tutorOverrides: {}, registeredTutors: [], onboarding: {}, studentProfiles: {}, favorites: {}, savedSearches: [],
    savedJobs: {}, requirements: [], applications: [], bookings: [], reviews: [], conversations: [], messages: [], notifications: [],
    notificationPrefs: {}, goals: [], progressNotes: [], homework: [], payments: [], payouts: [], leadTransactions: [], walletTransactions: [],
    subscriptions: {}, reports: [], contactFlags: [], disputes: [], verificationRequests: [], auditLogs: [], coupons: [], loginHistory: [], tutorBusy: [],
    blogPosts: [], faqs: [], testimonials: [],
    ...defaults,
  };
}

/* ─── Shared rules and helpers ───────────────────────────────────────────── */

/**
 * Masks phone numbers, emails and other-app handles in text other people read (profiles, job posts,
 * applications, reviews, booking notes), using the same detection as chat (./contact.ts). Returns the
 * safe text and whether anything was masked.
 */
export function maskContactInfo(body: string): { text: string; masked: boolean } {
  const found = scanContact(body, "chat");
  return found.found ? { text: maskMatches(body, found.matches, "[contact details hidden]"), masked: true } : { text: body, masked: false };
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  messages: { in_app: true, email: true, sms: false },
  bookings: { in_app: true, email: true, sms: true },
  reminders: { in_app: true, email: true, sms: true },
  payments: { in_app: true, email: true, sms: false },
  jobs: { in_app: true, email: true, sms: false },
  progress: { in_app: true, email: true, sms: false },
  marketing: { in_app: false, email: false, sms: false },
};

/** A student's profile before they've filled anything in. */
export function emptyStudentProfile(userId: string): StudentProfile {
  return {
    userId, subjects: [], goals: [], learningSupport: [],
    modes: ["online"], travelMiles: 10, tutorGender: "any", tutorLanguages: ["English"], tutorCategories: [], minExperienceYears: 0,
    days: [], timesOfDay: [], sessionsPerWeek: 1, lessonMinutes: 60, startWhen: "asap",
    budgetMinCents: 2500, budgetMaxCents: 6000, payer: "self", payMethod: "card",
    step: 0, updatedAt: "",
  };
}

/** A tutor with any pending edits applied. */
export function resolveTutor(s: Pick<Data, "tutorOverrides" | "registeredTutors">, id: string): Tutor | undefined {
  const base = s.registeredTutors.find((t) => t.id === id);
  return base ? { ...base, ...s.tutorOverrides[id] } : undefined;
}
