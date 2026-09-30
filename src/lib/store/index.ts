"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AlertFrequency, Application, ApplicationStatus, AppNotification, AuditLog, Booking, BookingStatus, BookingType, Child,
  Conversation, Coupon, Dispute, DisputeStatus, FeatureFlag, Homework, LeadTransaction, LearningGoal, Message,
  NotificationPrefs, Payment, Payout, ProgressNote, Report, Requirement, RequirementStatus, Review, Role, SavedSearch,
  Subscription, TeachingMode, Tutor, User, VerificationKind, VerificationRequest, VerificationStatus, WeeklyWindow,
  AvailabilityException, BookingRules, TrialConfig,
} from "@/lib/types";
import { DEMO_CHILDREN, DEMO_USERS, OTHER_USERS } from "@/lib/data/users";
import { REQUIREMENTS_REFERENCE_TIME, SEED_APPLICATIONS, SEED_REQUIREMENTS } from "@/lib/data/requirements";
import { CREDIT_PACKS, CREDITS_PER_APPLICATION, DEFAULT_FLAGS, DEFAULT_POLICY, SEED_COUPONS, TUTOR_PLANS, type BookingPolicy } from "@/lib/data/platform";
import { TUTOR_BY_ID } from "@/lib/data/tutors";
import { REVIEWS } from "@/lib/data/reviews";
import { SITE } from "@/lib/site";
import { applyBps, formatCents, formatDateTime, percentOf, sessionPrice } from "@/lib/format";
import { BLOCKING_STATUSES, generateSlots, overlaps } from "@/lib/time";
import { isFlagOn } from "@/lib/flags";
import { resolveLocation } from "@/lib/data/geo";
import { canTransition, cancellationRefund, STATUS_META } from "@/lib/booking";
import { actorFor, hasPermission } from "@/lib/permissions";
import { subjectName } from "@/lib/data/catalog";
import { createSeed } from "./seed";

/*
 * Client-side application store for the preview build.
 *
 * Every mutation below validates authorization and business rules the same way the production API
 * must (see docs/ARCHITECTURE.md). Swapping this module for API calls does not change the UI contract:
 * each action returns `Result` and never trusts values the caller could have tampered with
 * (prices, statuses and ownership are always recomputed here).
 */

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });

/** Drops keys whose value is undefined, so a partial update never erases existing fields. */
function definedOnly<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Shifts an ISO timestamp by `ms`. */
const shiftIso = (iso: string | undefined, ms: number) => (iso ? new Date(new Date(iso).getTime() + ms).toISOString() : iso);

const uid = (p: string) => `${p}_${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 12)}`;
const nowIso = () => new Date().toISOString();

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Preview-only password for the demo accounts. */
export const DEMO_PASSWORD = "tutorlink-demo";

const CONTACT_PATTERNS = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/g, // email
  /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, // US phone
  /\b(?:whatsapp|telegram|snapchat|insta(?:gram)?|venmo|cash\s?app)\b[:\s]*@?[\w.]*/gi,
];

/** Masks phone numbers, emails and off-platform handles. Returns the safe text and whether anything was masked. */
export function maskContactInfo(body: string): { text: string; masked: boolean } {
  let text = body;
  for (const re of CONTACT_PATTERNS) text = text.replace(re, "[contact details hidden]");
  return { text, masked: text !== body };
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
  idempotencyKey: string;
}

interface Data {
  version: number;
  sessionUserId: string | null;
  users: User[];
  credentials: Record<string, string>;
  children: Child[];
  tutorOverrides: Record<string, Partial<Tutor>>;
  registeredTutors: Tutor[];
  onboarding: Record<string, TutorOnboardingDraft>;
  favorites: Record<string, string[]>;
  compare: string[];
  savedSearches: SavedSearch[];
  savedJobs: Record<string, string[]>;
  requirements: Requirement[];
  applications: Application[];
  bookings: Booking[];
  reviews: Review[];
  conversations: Conversation[];
  messages: Message[];
  blocked: Record<string, string[]>;
  notifications: AppNotification[];
  notificationPrefs: Record<string, NotificationPrefs>;
  goals: LearningGoal[];
  progressNotes: ProgressNote[];
  homework: Homework[];
  payments: Payment[];
  payouts: Payout[];
  leadTransactions: LeadTransaction[];
  subscriptions: Record<string, Subscription>;
  reports: Report[];
  disputes: Dispute[];
  verificationRequests: VerificationRequest[];
  auditLogs: AuditLog[];
  flags: FeatureFlag[];
  coupons: Coupon[];
  policy: BookingPolicy;
  platformFeeBps: number;
  loginHistory: { userId: string; at: string; device: string; success: boolean }[];
}

interface Actions {
  // auth
  loginAs(userId: string): Result<User>;
  loginWithPassword(email: string, password: string): Promise<Result<User>>;
  register(input: { role: Extract<Role, "student" | "parent" | "tutor">; firstName: string; lastName: string; email: string; password: string; zip: string; ageBand?: "18+" | "13-17"; parentEmail?: string }): Promise<Result<User>>;
  logout(): void;
  updateMe(patch: Partial<Pick<User, "firstName" | "lastName" | "phone" | "city" | "state" | "zip" | "timezone">>): Result;
  changePassword(current: string, next: string): Promise<Result>;
  deleteMyAccount(): Result;
  // discovery
  toggleFavorite(tutorId: string): Result<boolean>;
  toggleCompare(tutorId: string): Result<boolean>;
  clearCompare(): void;
  saveSearch(input: { kind: SavedSearch["kind"]; label: string; query: Record<string, string>; frequency: AlertFrequency }): Result<SavedSearch>;
  updateSavedSearch(id: string, patch: Partial<Pick<SavedSearch, "label" | "frequency">>): Result;
  deleteSavedSearch(id: string): Result;
  toggleSavedJob(requirementId: string): Result<boolean>;
  // requirements
  saveRequirementDraft(input: Partial<Requirement> & { id?: string }): Result<Requirement>;
  publishRequirement(id: string): Result<Requirement>;
  setRequirementStatus(id: string, status: RequirementStatus): Result;
  deleteRequirement(id: string): Result;
  // applications
  applyToJob(requirementId: string, message: string, proposedRateCents: number): Result<Application>;
  setApplicationStatus(id: string, status: ApplicationStatus): Result;
  // bookings
  createBooking(input: CreateBookingInput): Result<Booking>;
  transitionBooking(id: string, to: BookingStatus, note?: string): Result<Booking>;
  rescheduleBooking(id: string, newStartUtc: string): Result<Booking>;
  validateCoupon(code: string, subtotalCents: number): Result<{ coupon: Coupon; discountCents: number }>;
  submitReview(bookingId: string, rating: Review["rating"], body: string): Result<Review>;
  respondToReview(reviewId: string, body: string): Result;
  // messaging
  startConversation(tutorId: string, opts?: { childId?: string; subject?: string }): Result<Conversation>;
  sendMessage(conversationId: string, body: string, attachment?: Message["attachment"]): Result<Message>;
  simulateReply(conversationId: string, body: string): void;
  markConversationRead(conversationId: string): void;
  toggleBlock(conversationId: string): Result<boolean>;
  report(input: Omit<Report, "id" | "reporterId" | "status" | "createdAt">): Result<Report>;
  // notifications
  markNotificationRead(id: string): void;
  markAllNotificationsRead(): void;
  setNotificationPref(group: keyof NotificationPrefs, channel: keyof NotificationPrefs["messages"], value: boolean): void;
  // children
  saveChild(input: Omit<Child, "id" | "parentId"> & { id?: string }): Result<Child>;
  removeChild(id: string): Result;
  // learning
  addProgressNote(learnerId: string, body: string, rating?: ProgressNote["rating"], bookingId?: string): Result<ProgressNote>;
  assignHomework(input: Omit<Homework, "id" | "tutorId" | "status" | "createdAt">): Result<Homework>;
  submitHomework(id: string, body: string, fileName?: string): Result;
  reviewHomework(id: string, body: string, grade?: string): Result;
  setTopicStatus(goalId: string, topic: string, status: LearningGoal["topics"][number]["status"]): Result;
  addGoal(input: Omit<LearningGoal, "id" | "createdAt" | "tutorId"> & { tutorId?: string }): Result<LearningGoal>;
  // tutor
  updateTutorProfile(patch: Partial<Pick<Tutor, "headline" | "bio" | "approach" | "hourlyRateCents" | "modes" | "subjects" | "specialties" | "levels" | "languages" | "serviceRadiusMiles" | "learningSupport">>): Result;
  setAvailability(windows: WeeklyWindow[]): Result;
  setExceptions(exceptions: AvailabilityException[]): Result;
  setBookingRules(rules: Partial<BookingRules>): Result;
  setTrial(trial: Partial<TrialConfig>): Result;
  saveOnboarding(step: number, data: Record<string, unknown>): Result;
  submitOnboarding(): Result<Tutor>;
  submitVerification(kind: VerificationKind, documents: { name: string; sizeKb: number }[]): Result<VerificationRequest>;
  buyCredits(packId: string): Result<LeadTransaction>;
  changePlan(plan: Subscription["plan"]): Result;
  // disputes
  openDispute(bookingId: string, reason: Dispute["reason"], details: string, evidence: Dispute["evidence"]): Result<Dispute>;
  addDisputeNote(id: string, body: string): Result;
  setDisputeStatus(id: string, status: DisputeStatus): Result;
  resolveDispute(id: string, outcome: NonNullable<Dispute["resolution"]>["outcome"], amountCents: number, note: string): Result;
  // admin
  reviewVerification(id: string, decision: Extract<VerificationStatus, "verified" | "rejected" | "under_review">, note?: string): Result;
  setUserStatus(userId: string, status: User["status"], reason: string): Result;
  setReportStatus(id: string, status: Report["status"]): Result;
  moderateReview(id: string, status: Review["status"]): Result;
  setFlag(key: string, patch: Partial<Pick<FeatureFlag, "enabled" | "rolloutPercent">>): Result;
  updatePolicy(patch: Partial<BookingPolicy>): Result;
  setPlatformFee(bps: number): Result;
  saveCoupon(input: Omit<Coupon, "id" | "redemptions"> & { id?: string }): Result<Coupon>;
  logConversationAccess(conversationId: string, reason: string): Result;
  // background jobs & consent
  /** What the BullMQ scheduler does in production: expire stale requests, auto-complete finished lessons. */
  runScheduledJobs(): number;
  /** Called from the link in the parental-consent email. */
  confirmParentalConsent(userId: string, parentEmail: string): Result<User>;
  resetDemo(): void;
}

export type AppState = Data & Actions & { hydrated: boolean; setHydrated(): void };

function initialData(): Data {
  const now = Date.now();
  const seed = createSeed(now);
  const reviews: Review[] = seed.reviewedBookingIds.map((bookingId, i) => {
    const b = seed.bookings.find((x) => x.id === bookingId)!;
    b.reviewId = `rev_local_${i}`;
    return {
      id: `rev_local_${i}`, tutorId: b.tutorId, bookingId, authorName: "Dana W.", authorRole: "parent", rating: 5, subject: b.subject,
      body: "Aisha is patient and structured. Noah looks forward to his lessons now.", createdAt: new Date(new Date(b.startUtc).getTime() + 3 * 3_600_000).toISOString(), status: "published",
    };
  });
  return {
    version: 3,
    sessionUserId: null,
    users: [...DEMO_USERS, ...OTHER_USERS],
    credentials: {},
    children: DEMO_CHILDREN,
    tutorOverrides: {},
    registeredTutors: [],
    onboarding: {},
    favorites: { usr_student: ["tut_priya_raman", "tut_leah_goldberg"], usr_parent: ["tut_aisha_rahman", "tut_hannah_weiss", "tut_elena_morales"] },
    compare: [],
    savedSearches: seed.savedSearches,
    savedJobs: { usr_tutor: ["req_005", "req_012"] },
    // Sample jobs and applications are re-anchored so "posted 2 days ago" is relative to now.
    requirements: SEED_REQUIREMENTS.map((r) => ({ ...r, createdAt: shiftIso(r.createdAt, now - REQUIREMENTS_REFERENCE_TIME)!, updatedAt: shiftIso(r.updatedAt, now - REQUIREMENTS_REFERENCE_TIME)!, publishedAt: shiftIso(r.publishedAt, now - REQUIREMENTS_REFERENCE_TIME) })),
    applications: SEED_APPLICATIONS.map((a) => ({ ...a, createdAt: shiftIso(a.createdAt, now - REQUIREMENTS_REFERENCE_TIME)!, updatedAt: shiftIso(a.updatedAt, now - REQUIREMENTS_REFERENCE_TIME)! })),
    bookings: seed.bookings,
    reviews,
    conversations: seed.conversations,
    messages: seed.messages,
    blocked: {},
    notifications: seed.notifications,
    notificationPrefs: {},
    goals: seed.goals,
    progressNotes: seed.progressNotes,
    homework: seed.homework,
    payments: seed.payments,
    payouts: seed.payouts,
    leadTransactions: seed.leadTransactions,
    subscriptions: { tut_sarah_chen: { plan: "pro", status: "active", renewsAt: new Date(now + 18 * 86_400_000).toISOString() } },
    reports: seed.reports,
    disputes: seed.disputes,
    verificationRequests: seed.verificationRequests,
    auditLogs: seed.auditLogs,
    flags: DEFAULT_FLAGS,
    coupons: SEED_COUPONS,
    policy: DEFAULT_POLICY,
    platformFeeBps: SITE.platformFeeBps,
    loginHistory: [],
  };
}

/** Resolves a tutor from seed data + local overrides + tutors registered in this browser. */
export function resolveTutor(s: Pick<Data, "tutorOverrides" | "registeredTutors">, id: string): Tutor | undefined {
  const base = TUTOR_BY_ID[id] ?? s.registeredTutors.find((t) => t.id === id);
  return base ? { ...base, ...s.tutorOverrides[id] } : undefined;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      const me = () => get().users.find((u) => u.id === get().sessionUserId) ?? null;
      const flag = (key: string) => isFlagOn(get().flags, key, get().sessionUserId);
      /** Commission for a tutor comes from their plan; Starter-plan tutors pay the admin-configurable default. */
      const commissionBps = (tutorId: string) => {
        const plan = get().subscriptions[tutorId]?.plan ?? "free";
        return plan === "free" ? get().platformFeeBps : (TUTOR_PLANS.find((p) => p.id === plan)?.commissionBps ?? get().platformFeeBps);
      };

      const notify = (userId: string | undefined, n: Omit<AppNotification, "id" | "userId" | "createdAt" | "read">) => {
        if (!userId) return;
        set((s) => ({ notifications: [{ ...n, id: uid("ntf"), userId, createdAt: nowIso(), read: false }, ...s.notifications] }));
      };
      /** Tutors without a live account in the preview have no user to notify. */
      const tutorUserId = (tutorId: string) => get().users.find((u) => u.tutorId === tutorId)?.id;
      const audit = (action: string, targetType: string, targetId: string, meta?: AuditLog["meta"]) => {
        const u = me();
        set((s) => ({ auditLogs: [{ id: uid("aud"), actorId: u?.id ?? "system", action, targetType, targetId, meta, createdAt: nowIso() }, ...s.auditLogs] }));
      };
      const requireUser = (roles?: Role[]): Result<User> => {
        const u = me();
        if (!u) return fail("Please sign in to continue.");
        if (u.status === "suspended") return fail("Your account is suspended. Contact support for help.");
        if (roles && !roles.includes(u.role)) return fail("Your account type can't perform this action.");
        return ok(u);
      };
      const learnerIdsFor = (u: User) => (u.role === "parent" ? [u.id, ...get().children.filter((c) => c.parentId === u.id).map((c) => c.id)] : [u.id]);
      const tutorTeachesLearner = (tutorId: string, learnerId: string) =>
        get().bookings.some((b) => b.tutorId === tutorId && (b.childId ? b.childId === learnerId : b.bookerId === learnerId) && ["confirmed", "in_progress", "completed"].includes(b.status));
      const creditBalance = (tutorId: string) => get().leadTransactions.filter((t) => t.tutorId === tutorId).reduce((sum, t) => sum + t.delta, 0);
      const patchBooking = (id: string, patch: Partial<Booking>) => set((s) => ({ bookings: s.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
      const addPayment = (p: Omit<Payment, "id" | "createdAt">) => set((s) => ({ payments: [{ ...p, id: uid("pay"), createdAt: nowIso() }, ...s.payments] }));
      /** Reviews live in sample data until first changed; a change copies them into the store (local copy wins). */
      const findReview = (id: string) => get().reviews.find((x) => x.id === id) ?? REVIEWS.find((x) => x.id === id);
      const upsertReview = (rev: Review) =>
        set((s) => ({ reviews: s.reviews.some((x) => x.id === rev.id) ? s.reviews.map((x) => (x.id === rev.id ? rev : x)) : [rev, ...s.reviews] }));

      const slotConflict = (tutorId: string, startUtc: string, durationMin: number, ignoreId?: string): boolean => {
        const tutor = resolveTutor(get(), tutorId)!;
        const buffer = tutor.rules.bufferMinutes * 60_000;
        const s = new Date(startUtc).getTime();
        const e = s + durationMin * 60_000;
        return get().bookings.some((b) => b.id !== ignoreId && b.tutorId === tutorId && BLOCKING_STATUSES.includes(b.status) && overlaps(s, e, new Date(b.startUtc).getTime() - buffer, new Date(b.startUtc).getTime() + b.durationMin * 60_000 + buffer));
      };

      const withinAvailability = (tutor: Tutor, startUtc: string, durationMin: number): string | null => {
        const now = Date.now();
        const s = new Date(startUtc).getTime();
        if (Number.isNaN(s)) return "Choose a valid time.";
        if (s < now + tutor.rules.minNoticeHours * 3_600_000) return `This tutor needs at least ${tutor.rules.minNoticeHours} hours' notice.`;
        if (s > now + tutor.rules.maxAdvanceDays * 86_400_000) return `This tutor accepts bookings up to ${tutor.rules.maxAdvanceDays} days ahead.`;
        if (!tutor.rules.sessionLengths.includes(durationMin) && durationMin !== tutor.trial.durationMin) return "Choose one of the tutor's session lengths.";
        // The start must be a real opening in the tutor's weekly hours (and not on a blocked date).
        // Conflicts with other bookings are checked separately so the error message can be specific.
        const open = generateSlots(tutor, { durationMin, viewerTz: tutor.timezone, bookings: [], now, days: tutor.rules.maxAdvanceDays });
        if (!open.some((slot) => slot.startUtc === new Date(s).toISOString())) return "That time is outside this tutor's available hours. Please choose one of the listed times.";
        return null;
      };

      return {
        ...initialData(),
        hydrated: false,
        setHydrated: () => set({ hydrated: true }),

        /* ─── Auth ─────────────────────────────────────────────── */
        loginAs(userId) {
          const u = get().users.find((x) => x.id === userId);
          if (!u) return fail("Account not found.");
          if (u.status === "suspended") return fail("This account is suspended.");
          set((s) => ({ sessionUserId: u.id, users: s.users.map((x) => (x.id === u.id ? { ...x, lastLoginAt: nowIso() } : x)), loginHistory: [{ userId: u.id, at: nowIso(), device: "This browser", success: true }, ...s.loginHistory].slice(0, 50) }));
          return ok(u);
        },
        async loginWithPassword(email, password) {
          const e = email.trim().toLowerCase();
          const u = get().users.find((x) => x.email.toLowerCase() === e);
          const hash = await sha256(`${e}:${password}`);
          const valid = u && (get().credentials[e] ? get().credentials[e] === hash : DEMO_USERS.some((d) => d.id === u.id) && password === DEMO_PASSWORD);
          if (!u || !valid) {
            if (u) set((s) => ({ loginHistory: [{ userId: u.id, at: nowIso(), device: "This browser", success: false }, ...s.loginHistory].slice(0, 50) }));
            // Same message for unknown email and wrong password to avoid account enumeration.
            return fail("Email or password is incorrect.");
          }
          return get().loginAs(u.id);
        },
        async register(input) {
          const email = input.email.trim().toLowerCase();
          if (get().users.some((u) => u.email.toLowerCase() === email)) return fail("An account with this email already exists. Try signing in.");
          if (input.password.length < 10) return fail("Use at least 10 characters for your password.");
          if (input.role === "student" && input.ageBand === "13-17" && !input.parentEmail) return fail("Students under 18 need a parent or guardian's email.");
          const user: User = {
            id: uid("usr"), role: input.role, firstName: input.firstName.trim(), lastName: input.lastName.trim(), email, zip: input.zip,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || SITE.defaultTimezone, createdAt: nowIso(),
            emailVerified: false, status: "active",
            ...(input.role === "student" && input.ageBand === "13-17" ? { parentalConsent: { parentEmail: input.parentEmail!, status: "pending" as const } } : {}),
          };
          const hash = await sha256(`${email}:${input.password}`);
          set((s) => ({ users: [...s.users, user], credentials: { ...s.credentials, [email]: hash } }));
          notify(user.id, { type: "security", title: "Verify your email", body: `We sent a verification link to ${email}.` });
          return get().loginAs(user.id);
        },
        logout: () => set({ sessionUserId: null, compare: [] }),
        updateMe(patch) {
          const r = requireUser();
          if (!r.ok) return r;
          set((s) => ({ users: s.users.map((u) => (u.id === r.data.id ? { ...u, ...patch } : u)) }));
          return ok(undefined);
        },
        async changePassword(current, next) {
          const r = requireUser();
          if (!r.ok) return r;
          const e = r.data.email.toLowerCase();
          const stored = get().credentials[e];
          const currentOk = stored ? stored === (await sha256(`${e}:${current}`)) : current === DEMO_PASSWORD;
          if (!currentOk) return fail("Current password is incorrect.");
          if (next.length < 10) return fail("Use at least 10 characters.");
          const hash = await sha256(`${e}:${next}`);
          set((s) => ({ credentials: { ...s.credentials, [e]: hash } }));
          notify(r.data.id, { type: "security", title: "Password changed", body: "If this wasn't you, contact support immediately." });
          return ok(undefined);
        },
        deleteMyAccount() {
          const r = requireUser();
          if (!r.ok) return r;
          const u = r.data;
          const hasUpcoming = get().bookings.some((b) => (b.bookerId === u.id || (u.tutorId && b.tutorId === u.tutorId)) && ["pending", "confirmed", "in_progress"].includes(b.status));
          if (hasUpcoming) return fail("Cancel or complete your upcoming lessons before deleting your account.");
          if (get().disputes.some((d) => d.openedBy === u.id && !["resolved", "rejected"].includes(d.status))) return fail("You have an open dispute. We can delete your account once it's resolved.");
          // Remove personal data. Booking and payment records are retained (anonymized in production) for tax and dispute obligations.
          const email = u.email.toLowerCase();
          set((s) => {
            const { [u.id]: _fav, ...favorites } = s.favorites;
            const { [u.id]: _jobs, ...savedJobs } = s.savedJobs;
            const { [u.id]: _prefs, ...notificationPrefs } = s.notificationPrefs;
            const { [email]: _cred, ...credentials } = s.credentials;
            void _fav; void _jobs; void _prefs; void _cred;
            const removedReqIds = new Set(s.requirements.filter((q) => q.ownerId === u.id).map((q) => q.id));
            return {
              users: s.users.filter((x) => x.id !== u.id),
              sessionUserId: null,
              favorites, savedJobs, notificationPrefs, credentials,
              children: s.children.filter((c) => c.parentId !== u.id),
              savedSearches: s.savedSearches.filter((x) => x.userId !== u.id),
              requirements: s.requirements.filter((q) => !removedReqIds.has(q.id)),
              applications: s.applications.filter((a) => !removedReqIds.has(a.requirementId)),
              notifications: s.notifications.filter((n) => n.userId !== u.id),
              compare: [],
            };
          });
          return ok(undefined);
        },

        /* ─── Discovery ────────────────────────────────────────── */
        toggleFavorite(tutorId) {
          const r = requireUser(["student", "parent"]);
          if (!r.ok) return r;
          const list = get().favorites[r.data.id] ?? [];
          const saved = !list.includes(tutorId);
          set((s) => ({ favorites: { ...s.favorites, [r.data.id]: saved ? [...list, tutorId] : list.filter((x) => x !== tutorId) } }));
          return ok(saved);
        },
        toggleCompare(tutorId) {
          const list = get().compare;
          if (list.includes(tutorId)) {
            set({ compare: list.filter((x) => x !== tutorId) });
            return ok(false);
          }
          if (list.length >= 3) return fail("You can compare up to 3 tutors. Remove one to add another.");
          set({ compare: [...list, tutorId] });
          return ok(true);
        },
        clearCompare: () => set({ compare: [] }),
        saveSearch(input) {
          const r = requireUser();
          if (!r.ok) return r;
          const s: SavedSearch = { ...input, id: uid("ss"), userId: r.data.id, createdAt: nowIso() };
          set((st) => ({ savedSearches: [s, ...st.savedSearches] }));
          return ok(s);
        },
        updateSavedSearch(id, patch) {
          const r = requireUser();
          if (!r.ok) return r;
          if (!get().savedSearches.some((x) => x.id === id && x.userId === r.data.id)) return fail("Saved search not found.");
          set((s) => ({ savedSearches: s.savedSearches.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
          return ok(undefined);
        },
        deleteSavedSearch(id) {
          const r = requireUser();
          if (!r.ok) return r;
          set((s) => ({ savedSearches: s.savedSearches.filter((x) => !(x.id === id && x.userId === r.data.id)) }));
          return ok(undefined);
        },
        toggleSavedJob(requirementId) {
          const r = requireUser(["tutor"]);
          if (!r.ok) return r;
          const list = get().savedJobs[r.data.id] ?? [];
          const saved = !list.includes(requirementId);
          set((s) => ({ savedJobs: { ...s.savedJobs, [r.data.id]: saved ? [...list, requirementId] : list.filter((x) => x !== requirementId) } }));
          return ok(saved);
        },

        /* ─── Requirements ─────────────────────────────────────── */
        saveRequirementDraft(input) {
          const r = requireUser(["student", "parent"]);
          if (!r.ok) return r;
          if (input.childId && !get().children.some((c) => c.id === input.childId && c.parentId === r.data.id)) return fail("Choose one of your children.");
          const existing = input.id ? get().requirements.find((x) => x.id === input.id) : undefined;
          if (existing && existing.ownerId !== r.data.id) return fail("You can only edit your own requirements.");
          const req: Requirement = {
            id: existing?.id ?? uid("req"), ownerId: r.data.id, title: "", subject: "", grade: "9", objectives: "", modes: ["online"],
            city: r.data.city ?? "", state: r.data.state ?? "", zip: r.data.zip ?? "", days: [], timesOfDay: [], sessionsPerWeek: 1,
            budgetMinCents: 4000, budgetMaxCents: 8000, languages: ["English"], preferences: "", details: "", status: "draft",
            createdAt: nowIso(), ...existing, ...definedOnly(input), updatedAt: nowIso(),
          } as Requirement;
          // Owner and status can't be changed through a draft save.
          req.ownerId = r.data.id;
          req.status = existing?.status ?? "draft";
          set((s) => ({ requirements: existing ? s.requirements.map((x) => (x.id === req.id ? req : x)) : [req, ...s.requirements] }));
          return ok(req);
        },
        publishRequirement(id) {
          const r = requireUser(["student", "parent"]);
          if (!r.ok) return r;
          if (r.data.parentalConsent?.status === "pending") return fail("A parent or guardian needs to approve your account before you can publish a requirement. You can still save it as a draft.");
          const req = get().requirements.find((x) => x.id === id);
          if (!req || req.ownerId !== r.data.id) return fail("Requirement not found.");
          const missing = [
            !req.subject && "subject", req.title.trim().length < 8 && "a descriptive title", req.objectives.trim().length < 20 && "learning objectives (20+ characters)",
            !req.modes.length && "teaching mode", req.modes.includes("in_person") && !/^\d{5}$/.test(req.zip) && "a valid ZIP code",
            req.budgetMaxCents < req.budgetMinCents && "a valid budget range",
          ].filter(Boolean);
          if (missing.length) return fail(`Please add ${missing.join(", ")} before publishing.`);
          const updated = { ...req, status: "published" as const, publishedAt: req.publishedAt ?? nowIso(), updatedAt: nowIso(), draftStep: undefined };
          set((s) => ({ requirements: s.requirements.map((x) => (x.id === id ? updated : x)) }));
          // Job alerts for tutors whose saved searches match the subject
          get().savedSearches.filter((ss) => ss.kind === "jobs" && ss.frequency === "instant" && (ss.query.subject ?? "").split(",").includes(req.subject))
            .forEach((ss) => notify(ss.userId, { type: "job_match", title: "New job matches your alert", body: `${req.title} · ${subjectName(req.subject)}`, href: `/tutor-jobs/${req.id}` }));
          return ok(updated);
        },
        setRequirementStatus(id, status) {
          const r = requireUser(["student", "parent"]);
          if (!r.ok) return r;
          const req = get().requirements.find((x) => x.id === id);
          if (!req || req.ownerId !== r.data.id) return fail("Requirement not found.");
          const allowed: Record<RequirementStatus, RequirementStatus[]> = { draft: [], published: ["paused", "closed"], paused: ["published", "closed"], closed: [] };
          if (status === "published" && req.status === "draft") {
            const published = get().publishRequirement(id);
            return published.ok ? ok(undefined) : published;
          }
          if (!allowed[req.status].includes(status)) return fail(`A ${req.status} requirement can't be ${status}.`);
          set((s) => ({
            requirements: s.requirements.map((x) => (x.id === id ? { ...x, status, updatedAt: nowIso() } : x)),
            applications: status === "closed" ? s.applications.map((a) => (a.requirementId === id && !["hired", "rejected", "withdrawn"].includes(a.status) ? { ...a, status: "closed", updatedAt: nowIso() } : a)) : s.applications,
          }));
          return ok(undefined);
        },
        deleteRequirement(id) {
          const r = requireUser(["student", "parent"]);
          if (!r.ok) return r;
          const req = get().requirements.find((x) => x.id === id);
          if (!req || req.ownerId !== r.data.id) return fail("Requirement not found.");
          if (get().applications.some((a) => a.requirementId === id && a.status === "hired")) return fail("Close this requirement instead — you've hired a tutor from it.");
          set((s) => ({ requirements: s.requirements.filter((x) => x.id !== id), applications: s.applications.filter((a) => a.requirementId !== id) }));
          return ok(undefined);
        },

        /* ─── Applications ─────────────────────────────────────── */
        applyToJob(requirementId, message, proposedRateCents) {
          const r = requireUser(["tutor"]);
          if (!r.ok) return r;
          const tutorId = r.data.tutorId;
          if (!tutorId) return fail("Complete your tutor profile before applying.");
          const req = get().requirements.find((x) => x.id === requirementId);
          if (!req || req.status !== "published") return fail("This job is no longer accepting applications.");
          if (get().applications.some((a) => a.requirementId === requirementId && a.tutorId === tutorId && a.status !== "withdrawn")) return fail("You've already applied to this job.");
          if (message.trim().length < 40) return fail("Write at least 40 characters so the family knows why you're a good fit.");
          if (!Number.isInteger(proposedRateCents) || proposedRateCents < 1500 || proposedRateCents > 50000) return fail("Enter a rate between $15 and $500 per hour.");
          if (flag("lead_credits") && creditBalance(tutorId) < CREDITS_PER_APPLICATION) return fail("You're out of lead credits. Buy credits or upgrade your plan to apply.");
          const { text } = maskContactInfo(message.trim());
          const app: Application = { id: uid("app"), requirementId, tutorId, message: text, proposedRateCents, status: "applied", createdAt: nowIso(), updatedAt: nowIso() };
          set((s) => ({
            applications: [app, ...s.applications],
            leadTransactions: flag("lead_credits") ? [{ id: uid("lt"), tutorId, delta: -CREDITS_PER_APPLICATION, reason: `Applied: ${req.title}`, createdAt: nowIso() }, ...s.leadTransactions] : s.leadTransactions,
          }));
          const t = resolveTutor(get(), tutorId)!;
          notify(req.ownerId, { type: "application", title: `${t.firstName} ${t.lastName.charAt(0)}. applied to your requirement`, body: req.title, href: `/dashboard/requirements/${req.id}` });
          return ok(app);
        },
        setApplicationStatus(id, status) {
          const r = requireUser();
          if (!r.ok) return r;
          const app = get().applications.find((a) => a.id === id);
          if (!app) return fail("Application not found.");
          const req = get().requirements.find((x) => x.id === app.requirementId);
          const isOwner = req?.ownerId === r.data.id;
          const isTutor = r.data.tutorId === app.tutorId;
          const ownerCan: ApplicationStatus[] = ["viewed", "shortlisted", "contacted", "trial_requested", "hired", "rejected"];
          if (isTutor && status !== "withdrawn") return fail("Tutors can only withdraw their application.");
          if (isOwner && !ownerCan.includes(status)) return fail("That status isn't available.");
          if (!isOwner && !isTutor) return fail("You don't have access to this application.");
          if (["withdrawn", "closed", "rejected"].includes(app.status) && status !== "viewed") return fail("This application is no longer active.");
          if (status === "viewed" && app.status !== "applied") return ok(undefined);
          set((s) => ({ applications: s.applications.map((a) => (a.id === id ? { ...a, status, updatedAt: nowIso() } : a)) }));
          if (isOwner && status !== "viewed") {
            notify(tutorUserId(app.tutorId), { type: "application_status", title: `Application ${status.replace("_", " ")}`, body: req?.title ?? "", href: "/dashboard/applications" });
          }
          return ok(undefined);
        },

        /* ─── Bookings ─────────────────────────────────────────── */
        validateCoupon(code, subtotalCents) {
          if (!flag("coupons")) return fail("Promo codes aren't available right now.");
          const r = requireUser(["student", "parent"]);
          if (!r.ok) return r;
          const c = get().coupons.find((x) => x.code.toUpperCase() === code.trim().toUpperCase());
          if (!c || !c.active) return fail("This code isn't valid.");
          if (new Date(c.expiresAt).getTime() < Date.now()) return fail("This code has expired.");
          if (c.redemptions >= c.maxRedemptions) return fail("This code has reached its usage limit.");
          if (subtotalCents < c.minPurchaseCents) return fail(`This code needs a minimum of ${formatCents(c.minPurchaseCents)}.`);
          if (c.firstBookingOnly && get().bookings.some((b) => b.bookerId === r.data.id && b.priceCents > 0 && !b.status.startsWith("cancelled"))) return fail("This code is for your first paid booking only.");
          const discountCents = c.kind === "percent" ? Math.round((subtotalCents * c.value) / 100) : Math.min(c.value, subtotalCents);
          return ok({ coupon: c, discountCents });
        },
        createBooking(input) {
          const r = requireUser(["student", "parent"]);
          if (!r.ok) return r;
          const user = r.data;
          const dupe = get().bookings.find((b) => b.idempotencyKey === input.idempotencyKey);
          if (dupe) return ok(dupe); // idempotent retry
          if (user.parentalConsent?.status === "pending") return fail("A parent or guardian needs to approve your account before you can book.");
          const tutor = resolveTutor(get(), input.tutorId);
          if (!tutor) return fail("Tutor not found.");
          if (user.role === "parent" && !input.childId) return fail("Choose which child this lesson is for.");
          if (input.childId && !get().children.some((c) => c.id === input.childId && c.parentId === user.id)) return fail("Choose one of your children.");
          if (!tutor.modes.includes(input.mode)) return fail(`This tutor doesn't teach ${input.mode === "online" ? "online" : "in person"}.`);
          if (input.mode === "online" && !flag("online_lessons")) return fail("Online lessons are temporarily unavailable.");
          if (!tutor.subjects.includes(input.subject)) return fail("Choose a subject this tutor teaches.");
          if (input.type === "trial") {
            if (!flag("trial_lessons") || !tutor.trial.enabled) return fail("This tutor isn't offering trial lessons.");
            if (input.durationMin !== tutor.trial.durationMin) return fail("Trial length doesn't match the tutor's trial.");
            const learner = input.childId ?? user.id;
            if (get().bookings.some((b) => b.tutorId === tutor.id && b.type === "trial" && (b.childId ?? b.bookerId) === learner && !b.status.startsWith("cancelled"))) {
              return fail("You've already had a trial with this tutor. Book a regular lesson instead.");
            }
          }
          const availErr = withinAvailability(tutor, input.startUtc, input.durationMin);
          if (availErr) return fail(availErr);
          // Re-check inside the "transaction" so two tabs can't take the same slot.
          if (slotConflict(tutor.id, input.startUtc, input.durationMin)) return fail("That time was just booked. Please choose another slot.");

          const priceCents = input.type === "trial" ? tutor.trial.priceCents : sessionPrice(tutor.hourlyRateCents, input.durationMin);
          let discountCents = 0;
          if (input.couponCode) {
            const c = get().validateCoupon(input.couponCode, priceCents);
            if (!c.ok) return c;
            discountCents = c.data.discountCents;
            set((s) => ({ coupons: s.coupons.map((x) => (x.id === c.data.coupon.id ? { ...x, redemptions: x.redemptions + 1 } : x)) }));
          }
          const instant = !tutor.rules.requiresApproval && flag("instant_booking");
          const status: BookingStatus = instant ? "confirmed" : "pending";
          const charge = priceCents - discountCents;
          const id = uid("bk");
          const booking: Booking = {
            id, tutorId: tutor.id, bookerId: user.id, childId: input.childId, subject: input.subject, type: input.type, status,
            startUtc: input.startUtc, durationMin: input.durationMin, mode: input.mode, priceCents, discountCents,
            platformFeeCents: applyBps(charge, commissionBps(tutor.id)),
            // Pending bookings are authorized and captured on confirmation (see docs: Stripe manual capture).
            paymentStatus: charge === 0 ? "unpaid" : instant ? "paid" : "authorized",
            meetingUrl: input.mode === "online" ? `https://meet.tutorlink.example/${id}` : undefined,
            locationNote: input.mode === "in_person" ? `Meeting place is agreed in messages. Tutor serves within ${tutor.serviceRadiusMiles} mi of ${tutor.city}.` : undefined,
            notes: input.notes ? maskContactInfo(input.notes).text : undefined,
            idempotencyKey: input.idempotencyKey,
            history: [
              { at: nowIso(), by: user.id, from: null, to: "pending", note: input.type === "trial" ? "Trial requested" : "Booking requested" },
              ...(instant ? [{ at: nowIso(), by: "system" as const, from: "pending" as const, to: "confirmed" as const, note: "Instant booking" }] : []),
            ],
            createdAt: nowIso(),
          };
          set((s) => ({ bookings: [booking, ...s.bookings] }));
          if (charge > 0) addPayment({ bookingId: id, userId: user.id, kind: "booking", amountCents: charge, status: instant ? "succeeded" : "pending", description: `${input.type === "trial" ? "Trial lesson" : "Lesson"} with ${tutor.firstName} ${tutor.lastName.charAt(0)}.`, method: "Visa •••• 4242" });
          get().startConversation(tutor.id, { childId: input.childId, subject: input.subject });
          const when = formatDateTime(input.startUtc, user.timezone);
          notify(user.id, { type: instant ? "booking_confirmed" : "booking_request", title: instant ? "Lesson confirmed" : "Request sent", body: `${subjectName(input.subject)} with ${tutor.firstName} · ${when}`, href: `/dashboard/bookings/${id}` });
          notify(tutorUserId(tutor.id), { type: "booking_request", title: instant ? "New lesson booked" : "New booking request", body: `${user.firstName} ${user.lastName.charAt(0)}. · ${subjectName(input.subject)} · ${when}`, href: `/dashboard/bookings/${id}` });
          return ok(booking);
        },
        transitionBooking(id, to, note) {
          const r = requireUser();
          if (!r.ok) return r;
          const b = get().bookings.find((x) => x.id === id);
          if (!b) return fail("Booking not found.");
          const actor = actorFor(r.data, b);
          if (!actor) return fail("You don't have access to this booking.");
          if (to === "rescheduled") return fail("Use reschedule to pick a new time.");
          if (to === "disputed") return fail("Open a dispute from the booking page.");
          const check = canTransition(b, to, actor, Date.now(), get().policy);
          if (!check.ok) return fail(check.reason);

          const policy = get().policy;
          const paid = b.priceCents - b.discountCents;
          const captured = b.paymentStatus === "paid"; // money actually taken (vs. an authorization hold)
          // Work out any refund first, so staff without refund permission can't move money through a transition.
          let refund: { cents: number; rule: string } | null = null;
          if (to === "cancelled_by_student" || to === "cancelled_by_tutor") {
            const res = cancellationRefund(b, actor === "booker" ? "booker" : actor === "tutor" ? "tutor" : "admin", Date.now(), policy);
            refund = { cents: captured ? res.refundCents : 0, rule: res.rule };
          } else if (to === "no_show_tutor") {
            refund = { cents: captured ? percentOf(paid, policy.tutorNoShowRefundPercent) : 0, rule: `Tutor no-show — ${policy.tutorNoShowRefundPercent}% refund` };
          } else if (to === "no_show_student") {
            refund = { cents: captured ? percentOf(paid, policy.studentNoShowRefundPercent) : 0, rule: `Student no-show — ${policy.studentNoShowRefundPercent}% refund` };
          } else if (to === "refunded") {
            if (b.status === "disputed") return fail("Resolve the dispute to issue a refund — the decision and amount are recorded there.");
          }
          if (actor === "admin" && refund && refund.cents > 0 && !hasPermission(r.data, "payments.refund")) {
            return fail("This change issues a refund. It needs the payments.refund permission.");
          }

          const patch: Partial<Booking> = { status: to, history: [...b.history, { at: nowIso(), by: r.data.id, from: b.status, to, note: [note, refund?.rule].filter(Boolean).join(" · ") || undefined }] };
          const tutor = resolveTutor(get(), b.tutorId)!;
          if (to === "confirmed" && paid > 0) {
            // Capture the authorized payment now that the tutor accepted.
            patch.paymentStatus = "paid";
            set((s) => ({ payments: s.payments.map((p) => (p.bookingId === id && p.status === "pending" ? { ...p, status: "succeeded" } : p)) }));
          }
          if (to === "pending" && b.status === "payment_failed") {
            // Retry payment: place a fresh authorization on the card.
            patch.paymentStatus = paid > 0 ? "authorized" : "unpaid";
            if (paid > 0) addPayment({ bookingId: id, userId: b.bookerId, kind: "booking", amountCents: paid, status: "pending", description: "Payment retry — card authorized", method: "Visa •••• 4242" });
          }
          if (b.paymentStatus === "authorized" && (to === "cancelled_by_student" || to === "cancelled_by_tutor")) {
            patch.paymentStatus = "refunded"; // authorization released, nothing was charged
            set((s) => ({ payments: s.payments.map((p) => (p.bookingId === id && p.status === "pending" ? { ...p, status: "refunded", description: `${p.description} — authorization released` } : p)) }));
          } else if (refund && refund.cents > 0) {
            patch.paymentStatus = refund.cents >= paid ? "refunded" : "partially_refunded";
            addPayment({ bookingId: id, userId: b.bookerId, kind: "booking", amountCents: -refund.cents, status: "refunded", description: `Refund — ${refund.rule}`, method: "Original payment method" });
          }
          patchBooking(id, patch);
          if (to === "no_show_tutor" && policy.tutorNoShowCreditCents > 0) {
            notify(b.bookerId, { type: "refund", title: "We're sorry your tutor didn't show", body: `${formatCents(policy.tutorNoShowCreditCents)} platform credit has been added to your account.`, href: `/dashboard/bookings/${id}` });
          }
          if (actor === "admin") audit("booking.transition", "booking", id, { from: b.status, to });

          const label = STATUS_META[to].label.toLowerCase();
          const when = formatDateTime(b.startUtc);
          const other = actor === "booker" ? tutorUserId(b.tutorId) : b.bookerId;
          notify(other, { type: to.startsWith("cancelled") ? "booking_cancelled" : to === "confirmed" ? "booking_confirmed" : "reminder", title: `Lesson ${label}`, body: `${subjectName(b.subject)} · ${when}`, href: `/dashboard/bookings/${id}` });
          if (to === "completed") notify(b.bookerId, { type: "review_request", title: `How was your lesson with ${tutor.firstName}?`, body: "Leave a review to help other families.", href: `/dashboard/bookings/${id}` });
          return ok({ ...b, ...patch } as Booking);
        },
        rescheduleBooking(id, newStartUtc) {
          const r = requireUser();
          if (!r.ok) return r;
          const b = get().bookings.find((x) => x.id === id);
          if (!b) return fail("Booking not found.");
          const actor = actorFor(r.data, b);
          if (actor !== "booker" && actor !== "tutor") return fail("Only the student, parent or tutor can reschedule.");
          const check = canTransition(b, "rescheduled", actor, Date.now(), get().policy);
          if (!check.ok) return fail(check.reason);
          const tutor = resolveTutor(get(), b.tutorId)!;
          const availErr = withinAvailability(tutor, newStartUtc, b.durationMin);
          if (availErr) return fail(availErr);
          if (slotConflict(b.tutorId, newStartUtc, b.durationMin, b.id)) return fail("That time isn't available. Please choose another slot.");
          const newId = uid("bk");
          const instant = actor === "tutor" || b.status === "confirmed";
          const next: Booking = {
            ...b, id: newId, startUtc: newStartUtc, status: instant ? "confirmed" : "pending", rescheduledFromId: b.id, rescheduleCount: (b.rescheduleCount ?? 0) + 1, reviewId: undefined,
            meetingUrl: b.mode === "online" ? `https://meet.tutorlink.example/${newId}` : undefined, idempotencyKey: `${b.idempotencyKey}_r${b.history.length}`,
            history: [{ at: nowIso(), by: r.data.id, from: null, to: instant ? "confirmed" : "pending", note: `Rescheduled from ${formatDateTime(b.startUtc)}` }], createdAt: nowIso(),
          };
          set((s) => ({
            bookings: [next, ...s.bookings.map((x) => (x.id === id ? { ...x, status: "rescheduled" as const, history: [...x.history, { at: nowIso(), by: r.data.id, from: x.status, to: "rescheduled" as const, note: `Moved to ${formatDateTime(newStartUtc)}` }] } : x))],
            payments: s.payments.map((p) => (p.bookingId === id ? { ...p, bookingId: newId } : p)),
          }));
          const other = actor === "booker" ? tutorUserId(b.tutorId) : b.bookerId;
          notify(other, { type: "booking_rescheduled", title: "Lesson rescheduled", body: `${subjectName(b.subject)} moved to ${formatDateTime(newStartUtc)}`, href: `/dashboard/bookings/${newId}` });
          return ok(next);
        },
        submitReview(bookingId, rating, body) {
          const r = requireUser(["student", "parent"]);
          if (!r.ok) return r;
          const b = get().bookings.find((x) => x.id === bookingId);
          if (!b || b.bookerId !== r.data.id) return fail("You can only review lessons you booked.");
          if (b.status !== "completed") return fail("You can review a lesson once it's completed.");
          if (b.reviewId || get().reviews.some((x) => x.bookingId === bookingId)) return fail("You've already reviewed this lesson.");
          if (![1, 2, 3, 4, 5].includes(rating)) return fail("Choose a rating from 1 to 5 stars.");
          if (body.trim().length < 20) return fail("Please write at least 20 characters.");
          const review: Review = {
            id: uid("rev"), tutorId: b.tutorId, bookingId, authorName: `${r.data.firstName} ${r.data.lastName.charAt(0)}.`, authorRole: r.data.role as "student" | "parent",
            rating, body: maskContactInfo(body.trim()).text, subject: b.subject, createdAt: nowIso(), status: "published",
          };
          set((s) => ({ reviews: [review, ...s.reviews] }));
          patchBooking(bookingId, { reviewId: review.id });
          notify(tutorUserId(b.tutorId), { type: "review_request", title: `New ${rating}-star review`, body: review.body.slice(0, 80), href: "/dashboard/reviews" });
          return ok(review);
        },
        respondToReview(reviewId, body) {
          const r = requireUser(["tutor"]);
          if (!r.ok) return r;
          const rev = findReview(reviewId);
          if (!rev || rev.tutorId !== r.data.tutorId) return fail("You can only respond to reviews of your lessons.");
          if (rev.tutorResponse) return fail("You've already responded to this review.");
          if (body.trim().length < 10) return fail("Write at least 10 characters.");
          upsertReview({ ...rev, tutorResponse: { body: maskContactInfo(body.trim()).text, createdAt: nowIso() } });
          return ok(undefined);
        },

        /* ─── Messaging ────────────────────────────────────────── */
        startConversation(tutorId, opts = {}) {
          const r = requireUser(["student", "parent"]);
          if (!r.ok) return r;
          if (r.data.parentalConsent?.status === "pending") return fail("A parent or guardian needs to approve your account before you can message tutors.");
          const existing = get().conversations.find((c) => c.tutorId === tutorId && c.userId === r.data.id && (c.childId ?? null) === (opts.childId ?? null));
          if (existing) return ok(existing);
          const conv: Conversation = {
            id: uid("cnv"), tutorId, userId: r.data.id, childId: opts.childId, subject: opts.subject, createdAt: nowIso(), lastMessageAt: nowIso(),
            involvesMinor: r.data.role === "parent" || !!r.data.parentalConsent,
          };
          set((s) => ({ conversations: [conv, ...s.conversations] }));
          return ok(conv);
        },
        sendMessage(conversationId, body, attachment) {
          const r = requireUser();
          if (!r.ok) return r;
          const c = get().conversations.find((x) => x.id === conversationId);
          if (!c) return fail("Conversation not found.");
          const senderId = r.data.tutorId === c.tutorId ? c.tutorId : r.data.id === c.userId ? r.data.id : null;
          if (!senderId) return fail("You're not part of this conversation.");
          if (c.blockedBy) return fail(c.blockedBy === senderId ? "You blocked this conversation. Unblock to send messages." : "You can't reply to this conversation.");
          const trimmed = body.trim();
          if (!trimmed && !attachment) return fail("Write a message first.");
          if (trimmed.length > 4000) return fail("Messages are limited to 4,000 characters.");
          if (attachment && attachment.sizeKb > 10_240) return fail("Attachments must be 10 MB or smaller.");
          if (attachment && !/\.(pdf|png|jpe?g|docx?|txt)$/i.test(attachment.name)) return fail("Attach a PDF, image, Word or text file.");
          const { text, masked } = maskContactInfo(trimmed);
          const msg: Message = { id: uid("msg"), conversationId, senderId, body: text, createdAt: nowIso(), attachment, ...(masked ? { moderation: "contact_info_masked" as const } : {}) };
          set((s) => ({ messages: [...s.messages, msg], conversations: s.conversations.map((x) => (x.id === conversationId ? { ...x, lastMessageAt: msg.createdAt } : x)) }));
          const recipient = senderId === c.tutorId ? c.userId : tutorUserId(c.tutorId);
          notify(recipient, { type: "message", title: `New message from ${r.data.firstName} ${r.data.lastName.charAt(0)}.`, body: text.slice(0, 90), href: `/dashboard/messages?c=${conversationId}` });
          return ok(msg);
        },
        simulateReply(conversationId, body) {
          const c = get().conversations.find((x) => x.id === conversationId);
          if (!c || c.blockedBy) return;
          const msg: Message = { id: uid("msg"), conversationId, senderId: c.tutorId, body, createdAt: nowIso() };
          set((s) => ({ messages: [...s.messages, msg], conversations: s.conversations.map((x) => (x.id === conversationId ? { ...x, lastMessageAt: msg.createdAt } : x)) }));
        },
        markConversationRead(conversationId) {
          const u = me();
          const c = get().conversations.find((x) => x.id === conversationId);
          if (!u || !c) return;
          const mine = u.tutorId === c.tutorId ? c.tutorId : u.id;
          const at = nowIso();
          if (!get().messages.some((m) => m.conversationId === conversationId && m.senderId !== mine && !m.readAt)) return;
          set((s) => ({ messages: s.messages.map((m) => (m.conversationId === conversationId && m.senderId !== mine && !m.readAt ? { ...m, readAt: at } : m)) }));
        },
        toggleBlock(conversationId) {
          const r = requireUser();
          if (!r.ok) return r;
          const c = get().conversations.find((x) => x.id === conversationId);
          if (!c) return fail("Conversation not found.");
          const self = r.data.tutorId === c.tutorId ? c.tutorId : r.data.id === c.userId ? r.data.id : null;
          if (!self) return fail("You're not part of this conversation.");
          if (c.blockedBy && c.blockedBy !== self) return fail("Only the person who blocked can unblock.");
          const blocked = !c.blockedBy;
          set((s) => ({ conversations: s.conversations.map((x) => (x.id === conversationId ? { ...x, blockedBy: blocked ? self : undefined } : x)) }));
          return ok(blocked);
        },
        report(input) {
          const r = requireUser();
          if (!r.ok) return r;
          if (input.reason.trim().length < 3) return fail("Choose a reason.");
          const rep: Report = { ...input, id: uid("rpt"), reporterId: r.data.id, status: "open", createdAt: nowIso() };
          set((s) => ({
            reports: [rep, ...s.reports],
            conversations: input.targetType === "message" ? s.conversations.map((c) => (s.messages.some((m) => m.id === input.targetId && m.conversationId === c.id) ? { ...c, reported: true } : c)) : s.conversations,
          }));
          return ok(rep);
        },

        /* ─── Notifications ────────────────────────────────────── */
        markNotificationRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
        markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => (n.userId === s.sessionUserId ? { ...n, read: true } : n)) })),
        setNotificationPref(group, channel, value) {
          const u = me();
          if (!u) return;
          const prefs = get().notificationPrefs[u.id] ?? DEFAULT_NOTIFICATION_PREFS;
          if (channel === "sms" && value && !flag("sms_notifications")) return;
          set((s) => ({ notificationPrefs: { ...s.notificationPrefs, [u.id]: { ...prefs, [group]: { ...prefs[group], [channel]: value } } } }));
        },

        /* ─── Children ─────────────────────────────────────────── */
        saveChild(input) {
          const r = requireUser(["parent"]);
          if (!r.ok) return r;
          if (!input.firstName.trim()) return fail("Enter your child's first name.");
          const existing = input.id ? get().children.find((c) => c.id === input.id) : undefined;
          if (existing && existing.parentId !== r.data.id) return fail("Child not found.");
          const child: Child = { ...existing, ...input, id: existing?.id ?? uid("chd"), parentId: r.data.id, firstName: input.firstName.trim() };
          set((s) => ({ children: existing ? s.children.map((c) => (c.id === child.id ? child : c)) : [...s.children, child] }));
          return ok(child);
        },
        removeChild(id) {
          const r = requireUser(["parent"]);
          if (!r.ok) return r;
          const child = get().children.find((c) => c.id === id && c.parentId === r.data.id);
          if (!child) return fail("Child not found.");
          if (get().bookings.some((b) => b.childId === id && ["pending", "confirmed"].includes(b.status))) return fail("Cancel this child's upcoming lessons first.");
          // Their drafts are deleted; published or paused requirements are closed so tutors stop applying.
          const at = nowIso();
          set((s) => ({
            children: s.children.filter((c) => c.id !== id),
            requirements: s.requirements
              .filter((q) => !(q.childId === id && q.status === "draft"))
              .map((q) => (q.childId === id && (q.status === "published" || q.status === "paused") ? { ...q, status: "closed" as const, updatedAt: at } : q)),
          }));
          return ok(undefined);
        },

        /* ─── Learning ─────────────────────────────────────────── */
        addProgressNote(learnerId, body, rating, bookingId) {
          const r = requireUser(["tutor"]);
          if (!r.ok) return r;
          const tutorId = r.data.tutorId!;
          if (!tutorTeachesLearner(tutorId, learnerId)) return fail("You can only add notes for students you teach.");
          if (body.trim().length < 10) return fail("Write a short note (10+ characters).");
          const n: ProgressNote = { id: uid("prg"), learnerId, tutorId, bookingId, body: body.trim(), rating, createdAt: nowIso() };
          set((s) => ({ progressNotes: [n, ...s.progressNotes] }));
          const parent = get().children.find((c) => c.id === learnerId)?.parentId ?? learnerId;
          notify(parent, { type: "progress", title: "New progress note", body: n.body.slice(0, 90), href: "/dashboard/progress" });
          return ok(n);
        },
        assignHomework(input) {
          const r = requireUser(["tutor"]);
          if (!r.ok) return r;
          const tutorId = r.data.tutorId!;
          if (!tutorTeachesLearner(tutorId, input.learnerId)) return fail("You can only assign homework to students you teach.");
          if (!input.title.trim() || !input.dueDate) return fail("Add a title and due date.");
          const hw: Homework = { ...input, id: uid("hw"), tutorId, status: "assigned", createdAt: nowIso() };
          set((s) => ({ homework: [hw, ...s.homework] }));
          const parent = get().children.find((c) => c.id === input.learnerId)?.parentId ?? input.learnerId;
          notify(parent, { type: "homework", title: "New homework", body: hw.title, href: "/dashboard/homework" });
          return ok(hw);
        },
        submitHomework(id, body, fileName) {
          const r = requireUser(["student", "parent"]);
          if (!r.ok) return r;
          const hw = get().homework.find((h) => h.id === id);
          if (!hw || !learnerIdsFor(r.data).includes(hw.learnerId)) return fail("Homework not found.");
          if (hw.status === "reviewed") return fail("This homework has already been reviewed.");
          if (!body.trim() && !fileName) return fail("Add a note or attach your work.");
          set((s) => ({ homework: s.homework.map((h) => (h.id === id ? { ...h, status: "submitted", submission: { body: body.trim(), fileName, submittedAt: nowIso() } } : h)) }));
          notify(tutorUserId(hw.tutorId), { type: "homework", title: "Homework submitted", body: hw.title, href: "/dashboard/homework" });
          return ok(undefined);
        },
        reviewHomework(id, body, grade) {
          const r = requireUser(["tutor"]);
          if (!r.ok) return r;
          const hw = get().homework.find((h) => h.id === id);
          if (!hw || hw.tutorId !== r.data.tutorId) return fail("Homework not found.");
          if (hw.status !== "submitted") return fail("Only submitted homework can be reviewed.");
          set((s) => ({ homework: s.homework.map((h) => (h.id === id ? { ...h, status: "reviewed", feedback: { body: body.trim(), grade, at: nowIso() } } : h)) }));
          const parent = get().children.find((c) => c.id === hw.learnerId)?.parentId ?? hw.learnerId;
          notify(parent, { type: "homework", title: "Homework reviewed", body: hw.title, href: "/dashboard/homework" });
          return ok(undefined);
        },
        setTopicStatus(goalId, topic, status) {
          const r = requireUser(["tutor"]);
          if (!r.ok) return r;
          const g = get().goals.find((x) => x.id === goalId);
          if (!g || g.tutorId !== r.data.tutorId) return fail("Goal not found.");
          set((s) => ({ goals: s.goals.map((x) => (x.id === goalId ? { ...x, topics: x.topics.map((t) => (t.name === topic ? { ...t, status } : t)) } : x)) }));
          return ok(undefined);
        },
        addGoal(input) {
          const r = requireUser(["tutor", "parent", "student"]);
          if (!r.ok) return r;
          const tutorId = r.data.role === "tutor" ? r.data.tutorId! : input.tutorId;
          if (!tutorId) return fail("Choose a tutor for this goal.");
          if (r.data.role === "tutor" ? !tutorTeachesLearner(tutorId, input.learnerId) : !learnerIdsFor(r.data).includes(input.learnerId)) return fail("You can't add goals for this learner.");
          const goal: LearningGoal = { ...input, id: uid("gol"), tutorId, createdAt: nowIso() };
          set((s) => ({ goals: [goal, ...s.goals] }));
          return ok(goal);
        },

        /* ─── Tutor profile & business ─────────────────────────── */
        updateTutorProfile(patch) {
          const r = requireUser(["tutor"]);
          if (!r.ok || !r.data.tutorId) return r.ok ? fail("Tutor profile not found.") : r;
          if (patch.hourlyRateCents !== undefined && (!Number.isInteger(patch.hourlyRateCents) || patch.hourlyRateCents < 1500 || patch.hourlyRateCents > 50000)) return fail("Hourly rate must be between $15 and $500.");
          if (patch.bio !== undefined && patch.bio.trim().length < 80) return fail("Your bio should be at least 80 characters.");
          const clean = { ...patch, ...(patch.bio ? { bio: maskContactInfo(patch.bio).text } : {}), ...(patch.approach ? { approach: maskContactInfo(patch.approach).text } : {}) };
          set((s) => ({ tutorOverrides: { ...s.tutorOverrides, [r.data.tutorId!]: { ...s.tutorOverrides[r.data.tutorId!], ...clean } } }));
          return ok(undefined);
        },
        setAvailability(windows) {
          const r = requireUser(["tutor"]);
          if (!r.ok || !r.data.tutorId) return r.ok ? fail("Tutor profile not found.") : r;
          if (windows.some((w) => w.start >= w.end)) return fail("Each window must end after it starts.");
          for (const d of [0, 1, 2, 3, 4, 5, 6]) {
            const day = windows.filter((w) => w.day === d).sort((a, b) => a.start.localeCompare(b.start));
            for (let i = 1; i < day.length; i++) if (day[i].start < day[i - 1].end) return fail("Availability windows on the same day can't overlap.");
          }
          set((s) => ({ tutorOverrides: { ...s.tutorOverrides, [r.data.tutorId!]: { ...s.tutorOverrides[r.data.tutorId!], availability: windows } } }));
          return ok(undefined);
        },
        setExceptions(exceptions) {
          const r = requireUser(["tutor"]);
          if (!r.ok || !r.data.tutorId) return r.ok ? fail("Tutor profile not found.") : r;
          set((s) => ({ tutorOverrides: { ...s.tutorOverrides, [r.data.tutorId!]: { ...s.tutorOverrides[r.data.tutorId!], exceptions } } }));
          return ok(undefined);
        },
        setBookingRules(rules) {
          const r = requireUser(["tutor"]);
          if (!r.ok || !r.data.tutorId) return r.ok ? fail("Tutor profile not found.") : r;
          const current = resolveTutor(get(), r.data.tutorId)!.rules;
          const next = { ...current, ...rules };
          if (next.minNoticeHours < 1 || next.minNoticeHours > 168) return fail("Minimum notice must be between 1 and 168 hours.");
          if (next.maxAdvanceDays < 7 || next.maxAdvanceDays > 180) return fail("Advance booking window must be 7–180 days.");
          if (next.bufferMinutes < 0 || next.bufferMinutes > 60) return fail("Buffer must be 0–60 minutes.");
          if (!next.sessionLengths.length) return fail("Offer at least one session length.");
          if (rules.requiresApproval === false && !flag("instant_booking")) return fail("Instant booking is currently disabled by the platform.");
          set((s) => ({ tutorOverrides: { ...s.tutorOverrides, [r.data.tutorId!]: { ...s.tutorOverrides[r.data.tutorId!], rules: next } } }));
          return ok(undefined);
        },
        setTrial(trial) {
          const r = requireUser(["tutor"]);
          if (!r.ok || !r.data.tutorId) return r.ok ? fail("Tutor profile not found.") : r;
          const next = { ...resolveTutor(get(), r.data.tutorId)!.trial, ...trial };
          if (next.priceCents < 0 || next.priceCents > 20000 || !Number.isInteger(next.priceCents)) return fail("Trial price must be between $0 and $200.");
          if (![15, 20, 25, 30, 45, 60].includes(next.durationMin)) return fail("Choose a trial length between 15 and 60 minutes.");
          set((s) => ({ tutorOverrides: { ...s.tutorOverrides, [r.data.tutorId!]: { ...s.tutorOverrides[r.data.tutorId!], trial: next } } }));
          return ok(undefined);
        },
        saveOnboarding(step, data) {
          const r = requireUser(["tutor"]);
          if (!r.ok) return r;
          const prev = get().onboarding[r.data.id];
          set((s) => ({ onboarding: { ...s.onboarding, [r.data.id]: { step: Math.max(step, prev?.step ?? 0), data: { ...prev?.data, ...data }, updatedAt: nowIso(), submittedAt: prev?.submittedAt } } }));
          return ok(undefined);
        },
        submitOnboarding() {
          const r = requireUser(["tutor"]);
          if (!r.ok) return r;
          const draft = get().onboarding[r.data.id];
          if (!draft) return fail("Complete the onboarding steps first.");
          const d = draft.data as Record<string, never>;
          const need = ["headline", "bio", "subjects", "hourlyRate", "modes", "zip"].filter((k) => !d[k] || (Array.isArray(d[k]) && !(d[k] as unknown[]).length));
          if (need.length) return fail(`Missing: ${need.join(", ")}.`);
          // Tutors who already have a profile (seed or registered) keep it — onboarding never creates a duplicate.
          if (r.data.tutorId && resolveTutor(get(), r.data.tutorId)) return ok(resolveTutor(get(), r.data.tutorId)!);
          const id = r.data.tutorId ?? uid("tut");
          const tutor: Tutor = {
            id, slug: `${r.data.firstName}-${r.data.lastName}-${id.slice(-4)}`.toLowerCase().replace(/[^a-z0-9-]/g, ""), firstName: r.data.firstName, lastName: r.data.lastName,
            headline: String(d.headline), bio: maskContactInfo(String(d.bio)).text, approach: maskContactInfo(String(d.approach ?? "")).text,
            subjects: d.subjects as unknown as string[], specialties: (d.specialties as unknown as string[]) ?? [], levels: (d.levels as unknown as Tutor["levels"]) ?? ["high"],
            category: (d.category as unknown as Tutor["category"]) ?? "subject_expert", learningSupport: (d.learningSupport as unknown as string[]) ?? [],
            city: String(d.city ?? r.data.city ?? ""), state: String(d.state ?? r.data.state ?? ""), zip: String(d.zip),
            // Offline geocoding in the preview; production resolves through GeocodingService. Unknown ZIPs fall back to the US centroid.
            ...(() => {
              const p = resolveLocation(String(d.zip)) ?? resolveLocation(`${d.city ?? ""}, ${d.state ?? ""}`);
              return p ? { lat: p.lat, lng: p.lng } : { lat: 39.83, lng: -98.58 };
            })(),
            serviceRadiusMiles: Number(d.serviceRadiusMiles ?? 10), timezone: r.data.timezone, modes: d.modes as unknown as TeachingMode[],
            hourlyRateCents: Math.round(Number(d.hourlyRate) * 100), trial: { enabled: Boolean(d.trialEnabled ?? true), priceCents: Math.round(Number(d.trialPrice ?? 0) * 100), durationMin: Number(d.trialDuration ?? 30) },
            rules: { minNoticeHours: 12, maxAdvanceDays: 45, bufferMinutes: 15, sessionLengths: [60], requiresApproval: true },
            experienceYears: Number(d.experienceYears ?? 0), education: (d.education as unknown as Tutor["education"]) ?? [], certifications: (d.certifications as unknown as Tutor["certifications"]) ?? [],
            languages: (d.languages as unknown as string[]) ?? ["English"],
            verification: { identity: d.idDocument ? "submitted" : "not_started", education: "not_started", certification: "not_started", background: "not_started" },
            rating: null, reviewCount: 0, lessonsCompleted: 0, responseTimeHours: null, availability: (d.availability as unknown as WeeklyWindow[]) ?? [], exceptions: [],
            featured: false, joinedAt: nowIso(), tone: 2,
          };
          set((s) => ({
            registeredTutors: [...s.registeredTutors, tutor],
            users: s.users.map((u) => (u.id === r.data.id ? { ...u, tutorId: id } : u)),
            onboarding: { ...s.onboarding, [r.data.id]: { ...draft, submittedAt: nowIso() } },
            leadTransactions: [{ id: uid("lt"), tutorId: id, delta: 3, reason: "Starter plan — monthly credits", createdAt: nowIso() }, ...s.leadTransactions],
            verificationRequests: d.idDocument ? [{ id: uid("vr"), tutorId: id, kind: "identity", status: "submitted", documents: [{ name: String(d.idDocument), sizeKb: Number(d.idDocumentSizeKb ?? 0) || 1 }], submittedAt: nowIso() }, ...s.verificationRequests] : s.verificationRequests,
          }));
          return ok(tutor);
        },
        submitVerification(kind, documents) {
          const r = requireUser(["tutor"]);
          if (!r.ok || !r.data.tutorId) return r.ok ? fail("Tutor profile not found.") : r;
          if (!documents.length) return fail("Upload at least one document.");
          if (documents.some((d) => d.sizeKb > 15_360)) return fail("Each document must be 15 MB or smaller.");
          if (documents.some((d) => !/\.(pdf|png|jpe?g|heic)$/i.test(d.name))) return fail("Upload PDF or image files only.");
          const tutorId = r.data.tutorId;
          const current = resolveTutor(get(), tutorId)!.verification[kind];
          if (["submitted", "under_review", "verified"].includes(current)) return fail("This check is already in progress or complete.");
          const req: VerificationRequest = { id: uid("vr"), tutorId, kind, status: "submitted", documents, submittedAt: nowIso() };
          const t = resolveTutor(get(), tutorId)!;
          set((s) => ({ verificationRequests: [req, ...s.verificationRequests], tutorOverrides: { ...s.tutorOverrides, [tutorId]: { ...s.tutorOverrides[tutorId], verification: { ...t.verification, [kind]: "submitted" } } } }));
          return ok(req);
        },
        buyCredits(packId) {
          const r = requireUser(["tutor"]);
          if (!r.ok || !r.data.tutorId) return r.ok ? fail("Tutor profile not found.") : r;
          if (!flag("lead_credits")) return fail("Lead credits are currently disabled.");
          const pack = CREDIT_PACKS.find((p) => p.id === packId);
          if (!pack) return fail("Choose a credit pack.");
          const tx: LeadTransaction = { id: uid("lt"), tutorId: r.data.tutorId, delta: pack.credits, reason: `Purchased ${pack.credits} credits`, createdAt: nowIso() };
          set((s) => ({ leadTransactions: [tx, ...s.leadTransactions] }));
          addPayment({ userId: r.data.id, kind: "lead_credits", amountCents: pack.priceCents, status: "succeeded", description: `${pack.credits} lead credits`, method: "Visa •••• 1881" });
          return ok(tx);
        },
        changePlan(plan) {
          const r = requireUser(["tutor"]);
          if (!r.ok || !r.data.tutorId) return r.ok ? fail("Tutor profile not found.") : r;
          const p = TUTOR_PLANS.find((x) => x.id === plan)!;
          const tutorId = r.data.tutorId;
          set((s) => ({ subscriptions: { ...s.subscriptions, [tutorId]: { plan, status: "active", renewsAt: new Date(Date.now() + 30 * 86_400_000).toISOString() } } }));
          if (p.priceCents > 0) {
            addPayment({ userId: r.data.id, kind: "subscription", amountCents: p.priceCents, status: "succeeded", description: `${p.name} plan — monthly`, method: "Visa •••• 1881" });
            set((s) => ({ leadTransactions: [{ id: uid("lt"), tutorId, delta: p.monthlyLeadCredits, reason: `${p.name} plan — monthly credits`, createdAt: nowIso() }, ...s.leadTransactions] }));
          }
          return ok(undefined);
        },

        /* ─── Disputes ─────────────────────────────────────────── */
        openDispute(bookingId, reason, details, evidence) {
          const r = requireUser();
          if (!r.ok) return r;
          const b = get().bookings.find((x) => x.id === bookingId);
          if (!b) return fail("Booking not found.");
          const actor = actorFor(r.data, b);
          if (actor !== "booker" && actor !== "tutor") return fail("Only the people in this lesson can open a dispute.");
          if (get().disputes.some((d) => d.bookingId === bookingId && !["resolved", "rejected"].includes(d.status))) return fail("There's already an open dispute for this lesson.");
          if (details.trim().length < 30) return fail("Describe what happened in at least 30 characters.");
          const check = canTransition(b, "disputed", actor, Date.now(), get().policy);
          if (!check.ok) return fail(check.reason);
          const d: Dispute = { id: uid("dsp"), bookingId, openedBy: r.data.id, reason, details: details.trim(), evidence, status: "open", adminNotes: [], createdAt: nowIso(), updatedAt: nowIso() };
          set((s) => ({ disputes: [d, ...s.disputes] }));
          patchBooking(bookingId, { status: "disputed", history: [...b.history, { at: nowIso(), by: r.data.id, from: b.status, to: "disputed", note: reason.replace(/_/g, " ") }] });
          notify(actor === "booker" ? tutorUserId(b.tutorId) : b.bookerId, { type: "booking_cancelled", title: "A dispute was opened", body: "Our team will review and contact you.", href: `/dashboard/bookings/${bookingId}` });
          return ok(d);
        },
        addDisputeNote(id, body) {
          const r = requireUser(["admin", "support"]);
          if (!r.ok) return r;
          if (!hasPermission(r.data, "disputes.manage")) return fail("You don't have permission to manage disputes.");
          if (!body.trim()) return fail("Write a note.");
          set((s) => ({ disputes: s.disputes.map((d) => (d.id === id ? { ...d, adminNotes: [...d.adminNotes, { by: r.data.id, body: body.trim(), at: nowIso() }], updatedAt: nowIso() } : d)) }));
          audit("dispute.note", "dispute", id);
          return ok(undefined);
        },
        setDisputeStatus(id, status) {
          const r = requireUser(["admin", "support"]);
          if (!r.ok) return r;
          if (!hasPermission(r.data, "disputes.manage")) return fail("You don't have permission to manage disputes.");
          if (status === "resolved" || status === "rejected") return fail("Use Resolve to record a decision.");
          const d = get().disputes.find((x) => x.id === id);
          if (!d) return fail("Dispute not found.");
          if (["resolved", "rejected"].includes(d.status)) return fail("This dispute is closed. Its decision can't be reopened here.");
          set((s) => ({ disputes: s.disputes.map((x) => (x.id === id ? { ...x, status, updatedAt: nowIso() } : x)) }));
          audit("dispute.status", "dispute", id, { status });
          return ok(undefined);
        },
        resolveDispute(id, outcome, amountCents, note) {
          const r = requireUser(["admin", "support"]);
          if (!r.ok) return r;
          if (!hasPermission(r.data, "disputes.manage")) return fail("You don't have permission to manage disputes.");
          const d = get().disputes.find((x) => x.id === id);
          if (!d || ["resolved", "rejected"].includes(d.status)) return fail("This dispute is already closed.");
          const b = get().bookings.find((x) => x.id === d.bookingId)!;
          const paid = b.priceCents - b.discountCents;
          if (outcome !== "no_refund" && outcome !== "credit" && !hasPermission(r.data, "payments.refund")) return fail("Refunds require the payments.refund permission.");
          if (!Number.isInteger(amountCents) || amountCents < 0 || (outcome !== "credit" && amountCents > paid)) return fail(`Refund must be between $0 and ${formatCents(paid)}.`);
          if (note.trim().length < 10) return fail("Explain the decision (10+ characters).");
          const amount = outcome === "full_refund" ? paid : amountCents;
          set((s) => ({ disputes: s.disputes.map((x) => (x.id === id ? { ...x, status: outcome === "no_refund" ? "rejected" : "resolved", resolution: { outcome, amountCents: amount, note: note.trim() }, updatedAt: nowIso() } : x)) }));
          if (b.status === "disputed") {
            const to: BookingStatus = outcome === "full_refund" || outcome === "partial_refund" ? "refunded" : "completed";
            patchBooking(b.id, { status: to, paymentStatus: outcome === "full_refund" ? "refunded" : outcome === "partial_refund" ? "partially_refunded" : b.paymentStatus, history: [...b.history, { at: nowIso(), by: r.data.id, from: "disputed", to, note: `Dispute ${outcome.replace("_", " ")}` }] });
          }
          if ((outcome === "full_refund" || outcome === "partial_refund") && amount > 0) addPayment({ bookingId: b.id, userId: b.bookerId, kind: "booking", amountCents: -amount, status: "refunded", description: `Dispute refund (${outcome.replace("_", " ")})`, method: "Original payment method" });
          audit("dispute.resolve", "dispute", id, { outcome, amountCents: amount });
          notify(b.bookerId, { type: "refund", title: "Dispute resolved", body: outcome === "no_refund" ? "No refund was issued. See details in your booking." : outcome === "credit" ? `${formatCents(amount)} platform credit added.` : `${formatCents(amount)} refund issued.`, href: `/dashboard/bookings/${b.id}` });
          return ok(undefined);
        },

        /* ─── Admin ────────────────────────────────────────────── */
        reviewVerification(id, decision, note) {
          const r = requireUser(["admin", "support"]);
          if (!r.ok) return r;
          if (!hasPermission(r.data, "tutors.verify")) return fail("You don't have permission to review verification.");
          const vr = get().verificationRequests.find((x) => x.id === id);
          if (!vr) return fail("Request not found.");
          if (decision === "rejected" && (!note || note.trim().length < 10)) return fail("Explain why the documents were rejected so the tutor can fix it.");
          const t = resolveTutor(get(), vr.tutorId)!;
          set((s) => ({
            verificationRequests: s.verificationRequests.map((x) => (x.id === id ? { ...x, status: decision, reviewedBy: r.data.id, reviewedAt: nowIso(), note, ...(decision === "verified" ? { expiresAt: new Date(Date.now() + 730 * 86_400_000).toISOString() } : {}) } : x)),
            tutorOverrides: { ...s.tutorOverrides, [vr.tutorId]: { ...s.tutorOverrides[vr.tutorId], verification: { ...t.verification, [vr.kind]: decision } } },
          }));
          audit(`verification.${decision === "verified" ? "approve" : decision === "rejected" ? "reject" : "start_review"}`, "verification", id, { kind: vr.kind, tutor: vr.tutorId });
          notify(tutorUserId(vr.tutorId), { type: "verification", title: `${vr.kind[0].toUpperCase()}${vr.kind.slice(1)} verification ${decision.replace("_", " ")}`, body: note ?? "", href: "/dashboard/verification" });
          return ok(undefined);
        },
        setUserStatus(userId, status, reason) {
          const r = requireUser(["admin", "support"]);
          if (!r.ok) return r;
          if (!hasPermission(r.data, "users.write")) return fail("You don't have permission to change account status.");
          if (userId === r.data.id) return fail("You can't change your own account status.");
          if (reason.trim().length < 5) return fail("Add a reason for the audit log.");
          set((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, status } : u)) }));
          audit(`user.${status === "suspended" ? "suspend" : "reactivate"}`, "user", userId, { reason });
          return ok(undefined);
        },
        setReportStatus(id, status) {
          const r = requireUser(["admin", "support"]);
          if (!r.ok) return r;
          if (!hasPermission(r.data, "reports.moderate")) return fail("You don't have permission to moderate reports.");
          set((s) => ({ reports: s.reports.map((x) => (x.id === id ? { ...x, status } : x)) }));
          audit("report.status", "report", id, { status });
          return ok(undefined);
        },
        moderateReview(id, status) {
          const r = requireUser(["admin", "support"]);
          if (!r.ok) return r;
          if (!hasPermission(r.data, "reports.moderate")) return fail("You don't have permission to moderate reviews.");
          const rev = findReview(id);
          if (!rev) return fail("Review not found.");
          upsertReview({ ...rev, status });
          audit("review.moderate", "review", id, { status });
          return ok(undefined);
        },
        setFlag(key, patch) {
          const r = requireUser(["admin"]);
          if (!r.ok) return r;
          if (!hasPermission(r.data, "flags.manage")) return fail("You don't have permission to manage feature flags.");
          if (patch.rolloutPercent !== undefined && (patch.rolloutPercent < 0 || patch.rolloutPercent > 100)) return fail("Rollout must be 0–100%.");
          set((s) => ({ flags: s.flags.map((f) => (f.key === key ? { ...f, ...patch } : f)) }));
          audit("flag.update", "flag", key, patch as AuditLog["meta"]);
          return ok(undefined);
        },
        updatePolicy(patch) {
          const r = requireUser(["admin"]);
          if (!r.ok) return r;
          if (!hasPermission(r.data, "settings.manage")) return fail("You don't have permission to change platform settings.");
          if (Object.values(patch).some((v) => typeof v !== "number" || v < 0 || !Number.isFinite(v))) return fail("Enter non-negative numbers.");
          if ((patch.lateCancellationRefundPercent ?? 0) > 100) return fail("Refund percentages can't exceed 100%.");
          set((s) => ({ policy: { ...s.policy, ...patch } }));
          audit("policy.update", "settings", "booking_policy", patch as AuditLog["meta"]);
          return ok(undefined);
        },
        setPlatformFee(bps) {
          const r = requireUser(["admin"]);
          if (!r.ok) return r;
          if (!hasPermission(r.data, "settings.manage")) return fail("You don't have permission to change platform settings.");
          if (!Number.isInteger(bps) || bps < 0 || bps > 3000) return fail("Platform fee must be between 0% and 30%.");
          set({ platformFeeBps: bps });
          audit("settings.platform_fee", "settings", "platform_fee", { bps });
          return ok(undefined);
        },
        saveCoupon(input) {
          const r = requireUser(["admin"]);
          if (!r.ok) return r;
          if (!hasPermission(r.data, "settings.manage")) return fail("You don't have permission to manage coupons.");
          const code = input.code.trim().toUpperCase();
          if (!/^[A-Z0-9]{4,16}$/.test(code)) return fail("Codes are 4–16 letters or numbers.");
          if (get().coupons.some((c) => c.code === code && c.id !== input.id)) return fail("That code already exists.");
          if (input.kind === "percent" && (input.value <= 0 || input.value > 100)) return fail("Percent discounts must be 1–100.");
          if (input.kind === "fixed" && (input.value <= 0 || !Number.isInteger(input.value))) return fail("Enter a fixed discount in cents.");
          const existing = input.id ? get().coupons.find((c) => c.id === input.id) : undefined;
          const coupon: Coupon = { ...input, code, id: existing?.id ?? uid("cpn"), redemptions: existing?.redemptions ?? 0 };
          set((s) => ({ coupons: existing ? s.coupons.map((c) => (c.id === coupon.id ? coupon : c)) : [coupon, ...s.coupons] }));
          audit(existing ? "coupon.update" : "coupon.create", "coupon", coupon.id, { code });
          return ok(coupon);
        },
        logConversationAccess(conversationId, reason) {
          const r = requireUser(["admin", "support"]);
          if (!r.ok) return r;
          if (!hasPermission(r.data, "conversations.read_flagged")) return fail("You don't have permission to read private conversations.");
          if (reason.trim().length < 5) return fail("A reason is required to access a private conversation.");
          audit("conversation.access", "conversation", conversationId, { reason });
          return ok(undefined);
        },
        runScheduledJobs() {
          const now = Date.now();
          const AUTO_COMPLETE_AFTER = 24 * 3_600_000; // unreported lessons complete a day after they end
          const disputed = new Set(get().disputes.filter((d) => !["resolved", "rejected"].includes(d.status)).map((d) => d.bookingId));
          const expired: Booking[] = [];
          const completed: Booking[] = [];
          for (const b of get().bookings) {
            const start = new Date(b.startUtc).getTime();
            if (b.status === "pending" && start <= now) expired.push(b);
            else if ((b.status === "confirmed" || b.status === "in_progress") && start + b.durationMin * 60_000 + AUTO_COMPLETE_AFTER <= now && !disputed.has(b.id)) completed.push(b);
          }
          if (!expired.length && !completed.length) return 0;
          const at = nowIso();
          const expiredIds = new Set(expired.map((b) => b.id));
          const completedIds = new Set(completed.map((b) => b.id));
          set((s) => ({
            bookings: s.bookings.map((b) =>
              expiredIds.has(b.id)
                ? { ...b, status: "cancelled_by_tutor" as const, paymentStatus: b.paymentStatus === "paid" ? ("refunded" as const) : b.paymentStatus === "authorized" ? ("refunded" as const) : b.paymentStatus, history: [...b.history, { at, by: "system" as const, from: b.status, to: "cancelled_by_tutor" as const, note: "Request expired — the tutor didn't respond before the lesson time. Authorization released." }] }
                : completedIds.has(b.id)
                  ? { ...b, status: "completed" as const, history: [...b.history, { at, by: "system" as const, from: b.status, to: "completed" as const, note: "Completed automatically — no issue was reported within 24 hours" }] }
                  : b,
            ),
            payments: s.payments.map((p) => (p.bookingId && expiredIds.has(p.bookingId) && p.status === "pending" ? { ...p, status: "refunded" as const, description: `${p.description} — authorization released` } : p)),
          }));
          for (const b of expired) notify(b.bookerId, { type: "booking_cancelled", title: "Lesson request expired", body: `${subjectName(b.subject)} · ${formatDateTime(b.startUtc)} — you weren't charged.`, href: `/dashboard/bookings/${b.id}` });
          for (const b of completed) notify(b.bookerId, { type: "review_request", title: "How was your lesson?", body: `${subjectName(b.subject)} · ${formatDateTime(b.startUtc)}`, href: `/dashboard/bookings/${b.id}` });
          return expired.length + completed.length;
        },
        confirmParentalConsent(userId, parentEmail) {
          const u = get().users.find((x) => x.id === userId);
          if (!u || !u.parentalConsent) return fail("This approval link isn't valid.");
          if (u.parentalConsent.parentEmail.toLowerCase() !== parentEmail.trim().toLowerCase()) return fail("Enter the parent or guardian email the student provided.");
          if (u.parentalConsent.status === "granted") return ok(u);
          const updated: User = { ...u, parentalConsent: { ...u.parentalConsent, status: "granted" } };
          set((s) => ({ users: s.users.map((x) => (x.id === userId ? updated : x)) }));
          notify(userId, { type: "security", title: "Your parent approved your account", body: "You can now message tutors, book lessons and publish requirements.", href: "/dashboard" });
          return ok(updated);
        },
        resetDemo: () => set({ ...initialData(), hydrated: true }),
      };
    },
    {
      name: "tutorlink-preview",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ hydrated: _h, setHydrated: _s, ...rest }) => {
        void _h; void _s;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== "function")) as unknown as AppState;
      },
      // Older preview data is discarded rather than migrated.
      migrate: () => initialData() as unknown as AppState,
    },
  ),
);
