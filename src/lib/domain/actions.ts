import type {
  AlertFrequency, Application, ApplicationStatus, AppNotification, AuditLog, AvailabilityException, Booking, BookingRules, BookingStatus, Child,
  ContactFlag, Conversation, Coupon, Dispute, DisputeStatus, FeatureFlag, Homework, LeadTransaction, LearningGoal, Message, NotificationPrefs, PayMethod,
  Payment, Permission, ProgressNote, Report, Requirement, RequirementStatus, Review, Role, SavedSearch, StudentProfile, Subject, SubjectCategory,
  Subscription, TeachingMode, TrialConfig, Tutor, User, VerificationKind, VerificationRequest, VerificationStatus, WalletTransaction,
  WeeklyWindow,
} from "@/lib/types";
import { CREDIT_PACKS, CREDITS_PER_APPLICATION, PAY_METHOD_LABEL, STUDY_CREDIT_PACKS, TUTOR_PLANS, type BookingPolicy } from "@/lib/data/platform";
import { SITE } from "@/lib/site";
import { applyBps, formatCents, formatDateTime, percentOf, sessionPrice } from "@/lib/format";
import { BLOCKING_STATUSES, generateSlots, overlaps } from "@/lib/time";
import { isFlagOn } from "@/lib/flags";
import { resolveLocation } from "@/lib/data/geo";
import { canTransition, cancellationRefund, endMs, startMs, STATUS_META } from "@/lib/booking";
import { checkPasscode, parseRecordingLink, parseVideoLink, VIDEO_PROVIDER_LABEL } from "@/lib/video-link";
import { actorFor, hasPermission } from "@/lib/permissions";
import { STARTER_SUBJECTS, STARTER_SUBJECT_CATEGORIES, slugify, subjectName } from "@/lib/data/catalog";
import { ALL_PERMISSIONS } from "@/lib/data/users";
import { parseIntroVideo } from "@/lib/video";
import { isPostalCode, postalError, postalLabel, postalRequired } from "@/lib/postal";
import { isCountryCode } from "@/lib/location";
import { blockedMessage, contactIn, fileNameContact, maskMatches, NAME_RULE, numberPiece, redactedExcerpt, scanContact, scanSplitMessages, type ContactKind } from "./contact";
import {
  DEFAULT_NOTIFICATION_PREFS, emptyStudentProfile, fail, maskContactInfo, ok, resolveTutor,
  type BlogPostItem, type CreateBookingInput, type Data, type FaqItem, type Result, type TestimonialItem,
} from "./data";

/*
 * The business rules of the marketplace. They run on the server (src/server/engine.ts) against the
 * rows a request needs, inside a database transaction; the changes they make with `set` are written
 * back when the action returns. Every action checks who is signed in, what they may do, and never
 * trusts prices, statuses or ownership sent by the browser — they are recomputed here.
 */

/** Drops keys whose value is undefined, so a partial update never erases existing fields. */
function definedOnly<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

const uid = (p: string) => `${p}_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
const nowIso = () => new Date().toISOString();

/**
 * Adds the starter subjects and sub-categories a catalog is missing, keeping everything already there.
 * A starter subject whose name the admin already uses (e.g. their own "Mathematics") receives the
 * starter sub-categories instead of getting a duplicate.
 */
function withStarter(c: { categories: SubjectCategory[]; subjects: Subject[] }) {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const areaFor = new Map<string, string>();
  const newAreas: SubjectCategory[] = [];
  for (const st of STARTER_SUBJECT_CATEGORIES) {
    const existing = c.categories.find((x) => x.slug === st.slug) ?? c.categories.find((x) => same(x.name, st.name));
    areaFor.set(st.slug, existing?.slug ?? st.slug);
    if (!existing) newAreas.push(st);
  }
  const newSubjects = STARTER_SUBJECTS.filter((st) => !c.subjects.some((x) => x.slug === st.slug || same(x.name, st.name))).map((st) => ({
    ...st,
    category: areaFor.get(st.category) ?? st.category,
  }));
  return { catalog: { categories: [...c.categories, ...newAreas], subjects: [...c.subjects, ...newSubjects] }, areas: newAreas.length, subjects: newSubjects.length };
}

/** "algebra" → "algebra", or "algebra-2" when that slug is taken. Empty when the name has no letters or numbers. */
const uniqueSlug = (base: string, taken: string[]): string => {
  if (!base) return "";
  let slug = base;
  for (let n = 2; taken.includes(slug); n++) slug = `${base}-${n}`;
  return slug;
};

export interface DomainEnv {
  /** Card and UPI charges can only be taken once a payment provider is connected (docs/SUPABASE_SETUP.md). */
  paymentsEnabled: boolean;
}

const PAYMENTS_OFF = "Card and UPI payments aren't switched on yet, so only free lessons can be booked for now.";

export interface DomainActions {
  // account
  updateMe(patch: Partial<Pick<User, "firstName" | "lastName" | "phone" | "country" | "city" | "state" | "zip" | "timezone">>): Result;
  /**
   * Saves part of the signed-in student's learning profile. `step` records setup progress;
   * `complete` marks setup as finished. Fields left out keep their current values.
   */
  saveStudentProfile(patch: Partial<Omit<StudentProfile, "userId" | "step" | "completedAt" | "updatedAt">>, opts?: { step?: number; complete?: boolean }): Result<StudentProfile>;
  deleteMyAccount(): Result;
  /** Called after the consent link's token was checked. */
  confirmParentalConsent(userId: string, parentEmail: string): Result<User>;
  // discovery
  toggleFavorite(tutorId: string): Result<boolean>;
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
  /**
   * The tutor (or staff who manage bookings) sets the Zoom / Google Meet invite link of an online lesson.
   * With applyToUpcoming, the tutor's other upcoming online lessons that have no link get it too.
   */
  setLessonVideo(bookingId: string, input: { link: string; passcode?: string; applyToUpcoming?: boolean }): Result<{ updated: number }>;
  /** Removes the lesson's Zoom / Google Meet link (the lesson then uses the TutorLink classroom only). */
  removeLessonVideo(bookingId: string): Result<Booking>;
  /** The tutor (or staff) adds or removes ("") the recording link of an online lesson once it has started. */
  setLessonRecording(bookingId: string, link: string): Result<Booking>;
  validateCoupon(code: string, subtotalCents: number): Result<{ coupon: Coupon; discountCents: number }>;
  /** Adds Study Credits to the signed-in learner's wallet, paid by card or UPI. */
  topUpWallet(packId: string, method: Exclude<PayMethod, "wallet">): Result<WalletTransaction>;
  submitReview(bookingId: string, rating: Review["rating"], body: string): Result<Review>;
  respondToReview(reviewId: string, body: string): Result;
  // messaging
  startConversation(tutorId: string, opts?: { childId?: string; subject?: string }): Result<Conversation>;
  /** A tutor opens a chat with a family they teach (from a booking) or whose job they applied to. */
  contactLearner(source: { bookingId?: string; requirementId?: string }): Result<Conversation>;
  sendMessage(conversationId: string, body: string, attachment?: Message["attachment"]): Result<Message>;
  markConversationRead(conversationId: string): Result;
  toggleBlock(conversationId: string): Result<boolean>;
  report(input: Omit<Report, "id" | "reporterId" | "status" | "createdAt">): Result<Report>;
  /**
   * Server only (never callable from the browser): records a file or photo that the server's file
   * check stopped for containing contact details. Returns whether messaging is now paused.
   */
  recordContactFlag(input: { channel: ContactFlag["channel"]; contextId?: string; kinds: ContactKind[]; fileName?: string }): Result<{ paused: boolean }>;
  /** A person whose messaging is paused asks Trust & Safety to unlock it (once per pause). */
  requestChatUnlock(note: string): Result;
  // notifications
  markNotificationRead(id: string): Result;
  markAllNotificationsRead(): Result;
  setNotificationPref(group: keyof NotificationPrefs, channel: keyof NotificationPrefs["messages"], value: boolean): Result;
  // children
  saveChild(input: Omit<Child, "id" | "parentId"> & { id?: string }): Result<Child>;
  removeChild(id: string): Result;
  // learning
  addProgressNote(learnerId: string, body: string, rating?: ProgressNote["rating"], bookingId?: string): Result<ProgressNote>;
  assignHomework(input: Omit<Homework, "id" | "tutorId" | "status" | "createdAt">): Result<Homework>;
  submitHomework(id: string, body: string, fileName?: string, filePath?: string): Result;
  reviewHomework(id: string, body: string, grade?: string): Result;
  setTopicStatus(goalId: string, topic: string, status: LearningGoal["topics"][number]["status"]): Result;
  addGoal(input: Omit<LearningGoal, "id" | "createdAt" | "tutorId"> & { tutorId?: string }): Result<LearningGoal>;
  // tutor
  updateTutorProfile(
    patch: Partial<
      Pick<
        Tutor,
        | "headline" | "bio" | "approach" | "hourlyRateCents" | "modes" | "subjects" | "specialties" | "levels" | "languages" | "serviceRadiusMiles" | "learningSupport"
        | "photoUrl" | "introVideoUrl" | "experienceYears" | "category" | "education" | "certifications"
      >
    >,
  ): Result;
  setAvailability(windows: WeeklyWindow[]): Result;
  setExceptions(exceptions: AvailabilityException[]): Result;
  setBookingRules(rules: Partial<BookingRules>): Result;
  setTrial(trial: Partial<TrialConfig>): Result;
  saveOnboarding(step: number, data: Record<string, unknown>): Result;
  submitOnboarding(): Result<Tutor>;
  submitVerification(kind: VerificationKind, documents: { name: string; sizeKb: number; path?: string }[]): Result<VerificationRequest>;
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
  /** Creates an area (no slug) or edits one (with its slug). The slug is made from the name once and never changes. */
  saveSubjectArea(input: { slug?: string; name: string; description: string; hidden?: boolean }): Result<SubjectCategory>;
  deleteSubjectArea(slug: string): Result;
  saveSubject(input: { slug?: string; name: string; category: string; summary: string; popular?: boolean; hidden?: boolean }): Result<Subject>;
  /** Only for subjects nothing uses yet; otherwise hide it so old records keep its name. */
  deleteSubject(slug: string): Result;
  moveCatalogItem(kind: "area" | "subject", slug: string, direction: -1 | 1): Result;
  /** Adds the ready-made starter list (skipping anything with the same name), for owners who want a head start. */
  loadStarterCatalog(): Result<{ areas: number; subjects: number }>;
  /** Makes an account staff ("admin" / "support") with these permissions, or removes staff access ("none"). */
  setStaffAccess(userId: string, role: "admin" | "support" | "none", permissions: Permission[]): Result;
  /** Staff correct an account's name, phone or location. */
  updateUserDetails(userId: string, patch: Partial<Pick<User, "firstName" | "lastName" | "phone" | "country" | "city" | "state" | "zip">>): Result;
  /** An administrator deletes an account (same rules as deleting your own). */
  deleteAccount(userId: string, reason: string): Result;
  /** Feature a tutor on the home page, or hide their profile from the public site. */
  setTutorListing(tutorId: string, patch: { featured?: boolean; hidden?: boolean }, reason: string): Result;
  /** Closes a job post that breaks the rules; the family is told why. */
  takeDownRequirement(id: string, reason: string): Result;
  /** An in-app announcement to everyone, or to students, parents or tutors. Returns how many accounts got it. */
  sendAnnouncement(audience: "everyone" | "students" | "parents" | "tutors", title: string, body: string, href?: string): Result<number>;
  /** Records why staff opened a private conversation and returns its messages. */
  logConversationAccess(conversationId: string, reason: string): Result<Message[]>;
  // chat safety (staff with reports.moderate)
  /** Sends a formal warning about sharing contact details; their open flags are marked as dealt with. */
  warnChatUser(userId: string, note: string): Result;
  /** Pauses sending messages for `hours` (24, 72, 168 or 720), or lifts a pause with 0. */
  restrictChat(userId: string, hours: number, reason: string): Result;
  setContactFlagStatus(ids: string[], status: ContactFlag["status"]): Result;
  /** Staff answer an "ask to unlock" request with no: messaging stays paused and the person is told. */
  declineChatUnlock(userId: string): Result;
  // website content (admin)
  saveBlogPost(input: Omit<BlogPostItem, "slug"> & { slug?: string }): Result<BlogPostItem>;
  deleteBlogPost(slug: string): Result;
  saveFaq(input: Omit<FaqItem, "id"> & { id?: string }): Result<FaqItem>;
  deleteFaq(id: string): Result;
  moveFaq(id: string, direction: -1 | 1): Result;
  saveTestimonial(input: Omit<TestimonialItem, "id"> & { id?: string }): Result<TestimonialItem>;
  deleteTestimonial(id: string): Result;
  // background jobs
  /** Expires stale requests and auto-completes finished lessons (run by the scheduler). */
  runScheduledJobs(): Result<number>;
}

export type DomainState = Data & DomainActions;
type SetState = (partial: Partial<Data> | ((s: DomainState) => Partial<Data>)) => void;

export function createActions(get: () => DomainState, set: SetState, env: DomainEnv): DomainActions {
  const me = () => get().users.find((u) => u.id === get().sessionUserId) ?? null;
  const flag = (key: string) => isFlagOn(get().flags, key, get().sessionUserId);
  /** Commission for a tutor comes from their plan; Starter-plan tutors pay the admin-configurable default. */
  const commissionBps = (tutorId: string) => {
    const plan = get().subscriptions[tutorId]?.plan ?? "free";
    return plan === "free" ? get().platformFeeBps : (TUTOR_PLANS.find((p) => p.id === plan)?.commissionBps ?? get().platformFeeBps);
  };
  /** Dates in notifications are written in the recipient's time zone. */
  const tzOf = (userId?: string) => get().users.find((u) => u.id === userId)?.timezone ?? me()?.timezone ?? SITE.defaultTimezone;

  const notify = (userId: string | undefined, n: Omit<AppNotification, "id" | "userId" | "createdAt" | "read">) => {
    if (!userId) return;
    set((s) => ({ notifications: [{ ...n, id: uid("ntf"), userId, createdAt: nowIso(), read: false }, ...s.notifications] }));
  };
  const tutorUserId = (tutorId: string) => get().users.find((u) => u.tutorId === tutorId)?.id;

  /**
   * Lesson reminders, to the family and the tutor: the day before (only for lessons booked more than a day
   * ahead, so a lesson booked for tonight doesn't get a "tomorrow" message) and an hour before. Each goes
   * out once; an hour-before reminder that's due replaces a day-before one that never went out.
   */
  const sendLessonReminders = (now: number): number => {
    const HOUR = 3_600_000;
    let sent = 0;
    const patches = new Map<string, Partial<Booking>>();
    for (const b of get().bookings) {
      if (b.status !== "confirmed" && b.status !== "in_progress") continue;
      const start = new Date(b.startUtc).getTime();
      if (start <= now) continue;
      const soon = start - now <= 65 * 60_000;
      const tomorrow = start - now <= 24 * HOUR && start - new Date(b.createdAt).getTime() > 24 * HOUR;
      let kind: "hour" | "day" | null = null;
      if (soon && !b.reminded1hAt) kind = "hour";
      else if (!soon && tomorrow && !b.reminded24hAt) kind = "day";
      if (!kind) continue;
      const at = nowIso();
      const minutesLeft = Math.max(1, Math.round((start - now) / 60_000));
      patches.set(b.id, kind === "hour" ? { reminded1hAt: at, reminded24hAt: b.reminded24hAt ?? at } : { reminded24hAt: at });
      const where = b.mode === "online" ? (b.videoLink ? "Join from the lesson page" : "Join the TutorLink classroom from the lesson page") : b.locationNote ? `Meeting place: ${b.locationNote}` : "In person";
      const tutorUser = tutorUserId(b.tutorId);
      for (const to of [b.bookerId, tutorUser].filter((x): x is string => !!x)) {
        const when = formatDateTime(b.startUtc, tzOf(to));
        notify(to, {
          type: "reminder",
          title:
            kind === "hour"
              ? `Your ${subjectName(b.subject)} lesson starts ${minutesLeft >= 45 ? "in about an hour" : `in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}`}`
              : `Reminder: ${subjectName(b.subject)} lesson tomorrow`,
          body: `${when}. ${where}.`,
          href: `/dashboard/bookings/${b.id}`,
        });
      }
      sent++;
    }
    if (patches.size) set((s) => ({ bookings: s.bookings.map((x) => (patches.has(x.id) ? { ...x, ...patches.get(x.id) } : x)) }));
    return sent;
  };
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
  const requireStaff = (roles: Role[], permission: Parameters<typeof hasPermission>[1], message: string): Result<User> => {
    const r = requireUser(roles);
    if (!r.ok) return r;
    if (!hasPermission(r.data, permission)) return fail(message);
    return r;
  };
  /* Chat safety */
  const pausedUntil = (u: User) => {
    const until = u.chatModeration?.restrictedUntil;
    return until && new Date(until).getTime() > Date.now() ? until : null;
  };
  const pausedMessage = (u: User) => {
    const until = pausedUntil(u);
    if (!until) return null;
    const when = formatDateTime(until, u.timezone);
    return u.chatModeration?.restrictedBy === "system"
      ? `Messaging is paused until ${when} because of repeated attempts to share contact details.`
      : `Messaging is paused on your account until ${when}.${u.chatModeration?.restrictionReason ? ` Reason: ${u.chatModeration.restrictionReason}` : ""} Contact support if you think this is a mistake.`;
  };
  /** Five stopped attempts within an hour pause messaging for an hour (it stops people probing the filter). */
  const AUTO_PAUSE_ATTEMPTS = 5;
  const flagContact = (u: User, f: Omit<ContactFlag, "id" | "userId" | "status" | "createdAt">): boolean => {
    const flag: ContactFlag = { ...f, id: uid("cfl"), userId: u.id, status: "open", createdAt: nowIso() };
    set((s) => ({ contactFlags: [flag, ...s.contactFlags] }));
    const hourAgo = Date.now() - 3_600_000;
    const recent = get().contactFlags.filter((x) => x.userId === u.id && new Date(x.createdAt).getTime() > hourAgo).length;
    if (recent < AUTO_PAUSE_ATTEMPTS || pausedUntil(u)) return false;
    const until = new Date(Date.now() + 3_600_000).toISOString();
    const chatModeration = { warnings: 0, ...u.chatModeration, restrictedUntil: until, restrictionReason: "Repeated attempts to share contact details", restrictedBy: "system", unlockRequestedAt: undefined, unlockRequestNote: undefined, unlockDeclinedAt: undefined };
    set((s) => ({ users: s.users.map((x) => (x.id === u.id ? { ...x, chatModeration } : x)) }));
    notify(u.id, { type: "security", title: "Messaging paused for 1 hour", body: "Several of your messages included contact details. Keep conversations and payments on TutorLink.", href: "/dashboard/messages" });
    return true;
  };
  /** Whoever is on the other side of a conversation (an account id). */
  const counterpartOf = (c: Conversation, u: User) => (u.tutorId && u.tutorId === c.tutorId ? c.userId : (tutorUserId(c.tutorId) ?? c.tutorId));
  /** Catalog and content edits need an admin with content.manage. */
  const requireCatalogEditor = (): Result<User> => requireStaff(["admin"], "content.manage", "You don't have permission to edit the subject catalog.");
  const requireContentEditor = (): Result<User> => requireStaff(["admin"], "content.manage", "You don't have permission to edit website content.");

  const learnerIdsFor = (u: User) => (u.role === "parent" ? [u.id, ...get().children.filter((c) => c.parentId === u.id).map((c) => c.id)] : [u.id]);
  const tutorTeachesLearner = (tutorId: string, learnerId: string) =>
    get().bookings.some((b) => b.tutorId === tutorId && (b.childId ? b.childId === learnerId : b.bookerId === learnerId) && ["confirmed", "in_progress", "completed"].includes(b.status));
  /** The account that receives notifications about a learner: the parent for a child, the student themself otherwise. */
  const accountFor = (learnerId: string) => get().children.find((c) => c.id === learnerId)?.parentId ?? learnerId;
  const creditBalance = (tutorId: string) => get().leadTransactions.filter((t) => t.tutorId === tutorId).reduce((sum, t) => sum + t.delta, 0);
  const patchBooking = (id: string, patch: Partial<Booking>) => set((s) => ({ bookings: s.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  /** A profile's country and postal code must fit together (the postal code is checked against the country it ends up with). */
  const placeProblem = (patch: { country?: string; zip?: string }, current: Pick<User, "country">): string | null => {
    if (patch.country !== undefined && !isCountryCode(patch.country)) return "Choose a country from the list.";
    const country = patch.country ?? current.country ?? "US";
    if (patch.zip && !isPostalCode(patch.zip, country)) return postalError(country);
    return null;
  };
  /** Who may set a lesson's Zoom / Google Meet and recording links: its tutor, or staff who manage bookings. Online lessons only. */
  const lessonVideoAccess = (bookingId: string): Result<{ booking: Booking; actor: "tutor" | "admin" }> => {
    const r = requireUser();
    if (!r.ok) return r;
    const b = get().bookings.find((x) => x.id === bookingId);
    if (!b) return fail("Booking not found.");
    const actor = actorFor(r.data, b);
    if (actor !== "tutor" && actor !== "admin") return fail("Only the lesson's tutor can add or change its meeting link.");
    if (b.mode !== "online") return fail("Meeting links are for online lessons. In-person lessons have a meeting place instead.");
    return ok({ booking: b, actor });
  };
  const addPayment = (p: Omit<Payment, "id" | "createdAt">) => set((s) => ({ payments: [{ ...p, id: uid("pay"), createdAt: nowIso() }, ...s.payments] }));
  const walletBalance = (userId: string) => get().walletTransactions.filter((t) => t.userId === userId).reduce((sum, t) => sum + t.deltaCents, 0);
  const addWalletTx = (t: Omit<WalletTransaction, "id" | "createdAt">): WalletTransaction => {
    const tx: WalletTransaction = { ...t, id: uid("wt"), createdAt: nowIso() };
    set((s) => ({ walletTransactions: [tx, ...s.walletTransactions] }));
    return tx;
  };
  /** A lesson paid with Study Credits is refunded to the wallet, never to a card. */
  const paidFromWallet = (bookingId: string) => get().payments.some((p) => p.bookingId === bookingId && p.method === PAY_METHOD_LABEL.wallet && p.amountCents > 0);
  const refundToWallet = (bookingId: string, userId: string, cents: number, description: string) => {
    if (cents > 0 && paidFromWallet(bookingId)) addWalletTx({ userId, deltaCents: cents, kind: "refund", description, bookingId });
  };
  /** Why an account can't be deleted yet, or null. */
  const removalProblem = (u: User, self: boolean): string | null => {
    if (u.role === "admin" || u.role === "support") return self ? "Staff accounts are removed by another administrator." : "Remove this account's staff access first.";
    if (get().bookings.some((b) => (b.bookerId === u.id || (u.tutorId && b.tutorId === u.tutorId)) && ["pending", "confirmed", "in_progress"].includes(b.status)))
      return self ? "Cancel or complete your upcoming lessons before deleting your account." : "This account has upcoming lessons. Cancel or complete them first.";
    if (get().disputes.some((d) => d.openedBy === u.id && !["resolved", "rejected"].includes(d.status)))
      return self ? "You have an open dispute. We can delete your account once it's resolved." : "This account has an open dispute. Resolve it first.";
    return null;
  };
  /** Removes personal data. Booking and payment records are kept for tax and dispute obligations. */
  const removeAccount = (u: User) =>
    set((s) => {
      const { [u.id]: _fav, ...favorites } = s.favorites;
      const { [u.id]: _jobs, ...savedJobs } = s.savedJobs;
      const { [u.id]: _prefs, ...notificationPrefs } = s.notificationPrefs;
      const { [u.id]: _profile, ...studentProfiles } = s.studentProfiles;
      const { [u.id]: _draft, ...onboarding } = s.onboarding;
      void _fav; void _jobs; void _prefs; void _profile; void _draft;
      const removedReqIds = new Set(s.requirements.filter((q) => q.ownerId === u.id).map((q) => q.id));
      return {
        users: s.users.filter((x) => x.id !== u.id),
        favorites, savedJobs, notificationPrefs, studentProfiles, onboarding,
        children: s.children.filter((c) => c.parentId !== u.id),
        savedSearches: s.savedSearches.filter((x) => x.userId !== u.id),
        requirements: s.requirements.filter((q) => !removedReqIds.has(q.id)),
        applications: s.applications.filter((a) => !removedReqIds.has(a.requirementId)),
        notifications: s.notifications.filter((n) => n.userId !== u.id),
      };
    });
  const findReview = (id: string) => get().reviews.find((x) => x.id === id);
  const upsertReview = (rev: Review) =>
    set((s) => ({ reviews: s.reviews.some((x) => x.id === rev.id) ? s.reviews.map((x) => (x.id === rev.id ? rev : x)) : [rev, ...s.reviews] }));
  const patchTutor = (tutorId: string, patch: Partial<Tutor>) =>
    set((s) => ({ tutorOverrides: { ...s.tutorOverrides, [tutorId]: { ...s.tutorOverrides[tutorId], ...patch } } }));

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

  /** Moves an item one place up or down among its peers. Null when it's already at the edge. */
  const swapBy = <T,>(list: T[], key: (x: T) => string, id: string, direction: -1 | 1, peers: (x: T) => boolean = () => true): T[] | null => {
    const i = list.findIndex((x) => key(x) === id);
    if (i < 0) return null;
    let j = i + direction;
    while (j >= 0 && j < list.length && !peers(list[j])) j += direction;
    if (j < 0 || j >= list.length) return null;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  const actions: DomainActions = {
    /* ─── Account ──────────────────────────────────────────── */
    updateMe(patch) {
      const r = requireUser();
      if (!r.ok) return r;
      // Others see your name, so it can't carry contact details (your own phone number field is private and fine).
      if (contactIn(patch.firstName, patch.lastName).found) return fail(NAME_RULE, "contact_blocked");
      const badPlace = placeProblem(patch, r.data);
      if (badPlace) return fail(badPlace);
      set((s) => ({ users: s.users.map((u) => (u.id === r.data.id ? { ...u, ...definedOnly({ ...patch, zip: patch.zip?.trim() }) } : u)) }));
      return ok(undefined);
    },
    saveStudentProfile(patch, opts) {
      const r = requireUser(["student"]);
      if (!r.ok) return r;
      const user = r.data;
      const current = get().studentProfiles[user.id] ?? emptyStudentProfile(user.id);
      const next: StudentProfile = { ...current, ...definedOnly(patch), userId: user.id };
      // Students aged 13–17 signed up with a parent's consent; their age has to match that.
      const teen = !!user.parentalConsent;
      if (patch.age !== undefined && (!Number.isInteger(patch.age) || (teen ? patch.age < 13 || patch.age > 17 : patch.age < 18 || patch.age > 99)))
        return fail(teen ? "You signed up as 13–17, so your age must be between 13 and 17." : "Enter an age between 18 and 99.");
      if (patch.photoUrl && !/^data:image\/(jpeg|png|webp);base64,/.test(patch.photoUrl)) return fail("Upload a PNG, JPG or WebP photo.");
      if (patch.photoUrl && patch.photoUrl.length > 1_500_000) return fail("That photo is too large. Choose one under 1 MB.");
      if (next.subjects.length > 5) return fail("Choose up to 5 subjects.");
      if ((next.details ?? "").length > 600) return fail("Keep the details under 600 characters.");
      if (next.travelMiles < 1 || next.travelMiles > 50) return fail("Travel distance must be 1–50 miles.");
      if (!Number.isInteger(next.sessionsPerWeek) || next.sessionsPerWeek < 1 || next.sessionsPerWeek > 7) return fail("Choose 1 to 7 lessons a week.");
      if (![30, 45, 60, 90, 120].includes(next.lessonMinutes)) return fail("Choose a lesson length.");
      const cents = (n: number) => Number.isInteger(n) && n >= 1000 && n <= 50000;
      if (!cents(next.budgetMinCents) || !cents(next.budgetMaxCents)) return fail("Your budget must be between $10 and $500 an hour.");
      if (next.budgetMinCents > next.budgetMaxCents) return fail("The lowest budget can't be more than the highest.");
      const saved: StudentProfile = {
        ...next,
        ...("photoUrl" in patch && !patch.photoUrl ? { photoUrl: "" } : {}),
        ...(patch.details !== undefined ? { details: maskContactInfo(patch.details.trim()).text } : {}),
        step: Math.max(current.step, opts?.step ?? 0),
        completedAt: current.completedAt ?? (opts?.complete ? nowIso() : undefined),
        updatedAt: nowIso(),
      };
      set((st) => ({ studentProfiles: { ...st.studentProfiles, [user.id]: saved } }));
      return ok(saved);
    },
    deleteMyAccount() {
      const r = requireUser();
      if (!r.ok) return r;
      const problem = removalProblem(r.data, true);
      if (problem) return fail(problem);
      removeAccount(r.data);
      return ok(undefined);
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

    /* ─── Discovery ────────────────────────────────────────── */
    toggleFavorite(tutorId) {
      const r = requireUser(["student", "parent"]);
      if (!r.ok) return r;
      const list = get().favorites[r.data.id] ?? [];
      const saved = !list.includes(tutorId);
      if (saved && !resolveTutor(get(), tutorId)) return fail("This tutor is no longer available.");
      set((s) => ({ favorites: { ...s.favorites, [r.data.id]: saved ? [...list, tutorId] : list.filter((x) => x !== tutorId) } }));
      return ok(saved);
    },
    saveSearch(input) {
      const r = requireUser();
      if (!r.ok) return r;
      if (!input.label.trim()) return fail("Give the search a name.");
      if (get().savedSearches.filter((x) => x.userId === r.data.id).length >= 50) return fail("You can save up to 50 searches. Delete one to add another.");
      const s: SavedSearch = { ...input, label: input.label.trim(), id: uid("ss"), userId: r.data.id, createdAt: nowIso() };
      set((st) => ({ savedSearches: [s, ...st.savedSearches] }));
      return ok(s);
    },
    updateSavedSearch(id, patch) {
      const r = requireUser();
      if (!r.ok) return r;
      if (!get().savedSearches.some((x) => x.id === id && x.userId === r.data.id)) return fail("Saved search not found.");
      set((s) => ({ savedSearches: s.savedSearches.map((x) => (x.id === id ? { ...x, ...definedOnly(patch) } : x)) }));
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
      if (saved && !get().requirements.some((q) => q.id === requirementId && q.status === "published")) return fail("This job is no longer open.");
      set((s) => ({ savedJobs: { ...s.savedJobs, [r.data.id]: saved ? [...list, requirementId] : list.filter((x) => x !== requirementId) } }));
      return ok(saved);
    },

    /* ─── Requirements ─────────────────────────────────────── */
    saveRequirementDraft(input) {
      const r = requireUser(["student", "parent"]);
      if (!r.ok) return r;
      if (input.childId && !get().children.some((c) => c.id === input.childId && c.parentId === r.data.id)) return fail("Choose one of your children.");
      const existing = input.id ? get().requirements.find((x) => x.id === input.id) : undefined;
      if (input.id && !existing) return fail("Requirement not found.");
      if (existing && existing.ownerId !== r.data.id) return fail("You can only edit your own requirements.");
      const { id: _id, ownerId: _o, status: _s, createdAt: _c, updatedAt: _u, publishedAt: _p, ...editable } = input;
      void _id; void _o; void _s; void _c; void _u; void _p;
      // Tutors read job posts, so contact details in them are hidden.
      const clean = (t: string | undefined) => (typeof t === "string" ? maskContactInfo(t).text : t);
      editable.title = clean(editable.title);
      editable.objectives = clean(editable.objectives);
      editable.preferences = clean(editable.preferences);
      editable.details = clean(editable.details);
      if (editable.attachments) editable.attachments = editable.attachments.map((a) => ({ ...a, name: maskMatches(a.name, fileNameContact(a.name).matches, "[hidden]") }));
      const req: Requirement = {
        id: existing?.id ?? uid("req"), ownerId: r.data.id, title: "", subject: "", grade: "9", objectives: "", modes: ["online"],
        country: r.data.country, city: r.data.city ?? "", state: r.data.state ?? "", zip: r.data.zip ?? "", days: [], timesOfDay: [], sessionsPerWeek: 1,
        budgetMinCents: 4000, budgetMaxCents: 8000, languages: ["English"], preferences: "", details: "", status: "draft",
        createdAt: nowIso(), ...existing, ...definedOnly(editable), updatedAt: nowIso(),
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
        !req.modes.length && "teaching mode", req.modes.includes("in_person") && (req.zip || postalRequired(req.country ?? "US")) && !isPostalCode(req.zip, req.country ?? "US") && `a valid ${postalLabel(req.country ?? "US")}`,
        req.budgetMaxCents < req.budgetMinCents && "a valid budget range",
      ].filter(Boolean);
      if (missing.length) return fail(`Please add ${missing.join(", ")} before publishing.`);
      const updated = { ...req, status: "published" as const, publishedAt: req.publishedAt ?? nowIso(), updatedAt: nowIso(), draftStep: undefined };
      set((s) => ({ requirements: s.requirements.map((x) => (x.id === id ? updated : x)) }));
      // Job alerts for tutors whose saved searches match the subject
      get().savedSearches.filter((ss) => ss.kind === "jobs" && ss.frequency === "instant" && ss.userId !== r.data.id && (ss.query.subject ?? "").split(",").includes(req.subject))
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
      if (message.trim().length > 3000) return fail("Keep your message under 3,000 characters.");
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
      const isTutor = !!r.data.tutorId && r.data.tutorId === app.tutorId;
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
    topUpWallet(packId, method) {
      const r = requireUser(["student", "parent"]);
      if (!r.ok) return r;
      if (r.data.parentalConsent?.status === "pending") return fail("A parent or guardian needs to approve your account before you can add credits.");
      const pack = STUDY_CREDIT_PACKS.find((p) => p.id === packId);
      if (!pack) return fail("Choose an amount to add.");
      if (method !== "card" && method !== "upi") return fail("Pay for credits with a card or UPI.");
      if (!env.paymentsEnabled) return fail("Adding Study Credits needs card or UPI payments, which aren't switched on yet.");
      const label = `${formatCents(pack.amountCents)} Study Credits`;
      addPayment({ userId: r.data.id, kind: "study_credits", amountCents: pack.amountCents, status: "succeeded", description: label, method: PAY_METHOD_LABEL[method] });
      const tx = addWalletTx({ userId: r.data.id, deltaCents: pack.amountCents, kind: "top_up", description: `Added with ${method === "upi" ? "UPI" : "card"}` });
      notify(r.data.id, { type: "payment", title: "Study Credits added", body: `${label} are in your wallet. Pay for any lesson in one tap.`, href: "/dashboard/payments" });
      return ok(tx);
    },
    createBooking(input) {
      const r = requireUser(["student", "parent"]);
      if (!r.ok) return r;
      const user = r.data;
      const dupe = get().bookings.find((b) => b.idempotencyKey === input.idempotencyKey);
      if (dupe) return dupe.bookerId === user.id ? ok(dupe) : fail("This booking request was already used. Please try again."); // idempotent retry
      if (user.parentalConsent?.status === "pending") return fail("A parent or guardian needs to approve your account before you can book.");
      const tutor = resolveTutor(get(), input.tutorId);
      if (!tutor || tutor.hidden) return fail("This tutor isn't available right now.");
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
      // Checked inside the transaction (and by a database constraint) so two people can't take the same slot.
      if (slotConflict(tutor.id, input.startUtc, input.durationMin)) return fail("That time was just booked. Please choose another slot.");

      const priceCents = input.type === "trial" ? tutor.trial.priceCents : sessionPrice(tutor.hourlyRateCents, input.durationMin);
      let discountCents = 0;
      let couponId: string | null = null;
      if (input.couponCode) {
        const c = get().validateCoupon(input.couponCode, priceCents);
        if (!c.ok) return c;
        discountCents = c.data.discountCents;
        couponId = c.data.coupon.id;
      }
      const instant = !tutor.rules.requiresApproval && flag("instant_booking");
      const status: BookingStatus = instant ? "confirmed" : "pending";
      const charge = priceCents - discountCents;
      const payWith: PayMethod = input.payWith ?? "card";
      if (!(payWith in PAY_METHOD_LABEL)) return fail("Choose how you'd like to pay.");
      if (charge > 0 && payWith !== "wallet" && !env.paymentsEnabled) return fail(PAYMENTS_OFF);
      if (payWith === "wallet" && charge > walletBalance(user.id)) return fail("You don't have enough Study Credits for this lesson. Add credits or choose another way to pay.");
      if (couponId) set((s) => ({ coupons: s.coupons.map((x) => (x.id === couponId ? { ...x, redemptions: x.redemptions + 1 } : x)) }));
      const id = uid("bk");
      const booking: Booking = {
        id, tutorId: tutor.id, bookerId: user.id, childId: input.childId, subject: input.subject, type: input.type, status,
        startUtc: new Date(input.startUtc).toISOString(), durationMin: input.durationMin, mode: input.mode, priceCents, discountCents,
        platformFeeCents: applyBps(charge, commissionBps(tutor.id)),
        // Pending bookings are authorized and captured on confirmation (see docs: Stripe manual capture).
        paymentStatus: charge === 0 ? "unpaid" : instant ? "paid" : "authorized",
        // Online lessons happen in the built-in classroom page.
        meetingUrl: input.mode === "online" ? `/classroom/${id}` : undefined,
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
      if (charge > 0) {
        const description = `${input.type === "trial" ? "Trial lesson" : "Lesson"} with ${tutor.firstName} ${tutor.lastName.charAt(0)}.`;
        addPayment({ bookingId: id, userId: user.id, kind: "booking", amountCents: charge, status: instant ? "succeeded" : "pending", description, method: PAY_METHOD_LABEL[payWith] });
        // Credits leave the wallet straight away; a declined or expired request puts them back.
        if (payWith === "wallet") addWalletTx({ userId: user.id, deltaCents: -charge, kind: "lesson", description, bookingId: id });
      }
      get().startConversation(tutor.id, { childId: input.childId, subject: input.subject });
      const tutorUser = tutorUserId(tutor.id);
      notify(user.id, { type: instant ? "booking_confirmed" : "booking_request", title: instant ? "Lesson confirmed" : "Request sent", body: `${subjectName(input.subject)} with ${tutor.firstName} · ${formatDateTime(booking.startUtc, tzOf(user.id))}`, href: `/dashboard/bookings/${id}` });
      notify(tutorUser, { type: "booking_request", title: instant ? "New lesson booked" : "New booking request", body: `${user.firstName} ${user.lastName.charAt(0)}. · ${subjectName(input.subject)} · ${formatDateTime(booking.startUtc, tzOf(tutorUser))}`, href: `/dashboard/bookings/${id}` });
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
      if (to === "pending" && b.status === "payment_failed" && paid > 0 && !paidFromWallet(id) && !env.paymentsEnabled) return fail(PAYMENTS_OFF);

      const safeNote = note ? maskContactInfo(note).text : note;
      const patch: Partial<Booking> = { status: to, history: [...b.history, { at: nowIso(), by: r.data.id, from: b.status, to, note: [safeNote, refund?.rule].filter(Boolean).join(" · ") || undefined }] };
      const tutor = resolveTutor(get(), b.tutorId)!;
      if (to === "confirmed" && paid > 0) {
        // Capture the authorized payment now that the tutor accepted.
        patch.paymentStatus = "paid";
        set((s) => ({ payments: s.payments.map((p) => (p.bookingId === id && p.status === "pending" ? { ...p, status: "succeeded" } : p)) }));
      }
      if (to === "pending" && b.status === "payment_failed") {
        // Retry payment: place a fresh authorization.
        patch.paymentStatus = paid > 0 ? "authorized" : "unpaid";
        if (paid > 0) addPayment({ bookingId: id, userId: b.bookerId, kind: "booking", amountCents: paid, status: "pending", description: "Payment retry — authorized", method: PAY_METHOD_LABEL.card });
      }
      if (b.paymentStatus === "authorized" && (to === "cancelled_by_student" || to === "cancelled_by_tutor")) {
        patch.paymentStatus = "refunded"; // authorization released, nothing was charged
        set((s) => ({ payments: s.payments.map((p) => (p.bookingId === id && p.status === "pending" ? { ...p, status: "refunded", description: `${p.description} — authorization released` } : p)) }));
        refundToWallet(id, b.bookerId, paid, "Request cancelled — credits returned");
      } else if (refund && refund.cents > 0) {
        patch.paymentStatus = refund.cents >= paid ? "refunded" : "partially_refunded";
        addPayment({ bookingId: id, userId: b.bookerId, kind: "booking", amountCents: -refund.cents, status: "refunded", description: `Refund — ${refund.rule}`, method: paidFromWallet(id) ? PAY_METHOD_LABEL.wallet : "Original payment method" });
        refundToWallet(id, b.bookerId, refund.cents, `Refund — ${refund.rule}`);
      }
      patchBooking(id, patch);
      if (to === "no_show_tutor" && policy.tutorNoShowCreditCents > 0) {
        addWalletTx({ userId: b.bookerId, deltaCents: policy.tutorNoShowCreditCents, kind: "credit", description: "Platform credit — tutor didn't show", bookingId: id });
        notify(b.bookerId, { type: "refund", title: "We're sorry your tutor didn't show", body: `${formatCents(policy.tutorNoShowCreditCents)} platform credit has been added to your account.`, href: `/dashboard/bookings/${id}` });
      }
      if (actor === "admin") audit("booking.transition", "booking", id, { from: b.status, to });

      const label = STATUS_META[to].label.toLowerCase();
      const other = actor === "booker" ? tutorUserId(b.tutorId) : b.bookerId;
      notify(other, { type: to.startsWith("cancelled") ? "booking_cancelled" : to === "confirmed" ? "booking_confirmed" : "reminder", title: `Lesson ${label}`, body: `${subjectName(b.subject)} · ${formatDateTime(b.startUtc, tzOf(other))}`, href: `/dashboard/bookings/${id}` });
      if (actor === "admin") notify(tutorUserId(b.tutorId), { type: to.startsWith("cancelled") ? "booking_cancelled" : "reminder", title: `Lesson ${label}`, body: `${subjectName(b.subject)} · ${formatDateTime(b.startUtc, tzOf(tutorUserId(b.tutorId)))}`, href: `/dashboard/bookings/${id}` });
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
      const start = new Date(newStartUtc).toISOString();
      const availErr = withinAvailability(tutor, start, b.durationMin);
      if (availErr) return fail(availErr);
      if (slotConflict(b.tutorId, start, b.durationMin, b.id)) return fail("That time isn't available. Please choose another slot.");
      const newId = uid("bk");
      const instant = actor === "tutor" || b.status === "confirmed";
      const next: Booking = {
        ...b, id: newId, startUtc: start, status: instant ? "confirmed" : "pending", rescheduledFromId: b.id, rescheduleCount: (b.rescheduleCount ?? 0) + 1, reviewId: undefined,
        meetingUrl: b.mode === "online" ? `/classroom/${newId}` : undefined, recordingUrl: undefined, idempotencyKey: `${b.idempotencyKey}_r${b.history.length}`,
        history: [{ at: nowIso(), by: r.data.id, from: null, to: instant ? "confirmed" : "pending", note: `Rescheduled from ${formatDateTime(b.startUtc, tzOf(r.data.id))}` }], createdAt: nowIso(),
      };
      set((s) => ({
        bookings: [next, ...s.bookings.map((x) => (x.id === id ? { ...x, status: "rescheduled" as const, history: [...x.history, { at: nowIso(), by: r.data.id, from: x.status, to: "rescheduled" as const, note: `Moved to ${formatDateTime(start, tzOf(r.data.id))}` }] } : x))],
        payments: s.payments.map((p) => (p.bookingId === id ? { ...p, bookingId: newId } : p)),
        walletTransactions: s.walletTransactions.map((t) => (t.bookingId === id ? { ...t, bookingId: newId } : t)),
      }));
      const other = actor === "booker" ? tutorUserId(b.tutorId) : b.bookerId;
      notify(other, { type: "booking_rescheduled", title: "Lesson rescheduled", body: `${subjectName(b.subject)} moved to ${formatDateTime(start, tzOf(other))}`, href: `/dashboard/bookings/${newId}` });
      return ok(next);
    },
    setLessonVideo(bookingId, input) {
      const check = lessonVideoAccess(bookingId);
      if (!check.ok) return check;
      const { booking: b, actor } = check.data;
      if (!["pending", "confirmed", "in_progress"].includes(b.status) || endMs(b) <= Date.now()) return fail("This lesson has ended or isn't taking place, so its meeting link can't be changed.");
      const parsed = parseVideoLink(input.link);
      if (!parsed.ok) return fail(parsed.error);
      const pass = checkPasscode(input.passcode);
      if (!pass.ok) return fail(pass.error);
      if (pass.passcode && contactIn(pass.passcode).found) return fail("That passcode looks like a phone number or contact detail. Use the passcode Zoom made, or a shorter one.");
      const name = VIDEO_PROVIDER_LABEL[parsed.link.provider];
      const patch = { videoLink: parsed.link.url, videoPasscode: pass.passcode };
      const changed = (x: Booking) => x.videoLink !== patch.videoLink || (x.videoPasscode ?? undefined) !== patch.videoPasscode;
      // The tutor's other upcoming online lessons without a link can use the same meeting.
      const others =
        input.applyToUpcoming && actor === "tutor"
          ? get().bookings.filter((x) => x.id !== b.id && x.tutorId === b.tutorId && x.mode === "online" && !x.videoLink && ["pending", "confirmed"].includes(x.status) && startMs(x) > Date.now())
          : [];
      const targets = [b, ...others].filter(changed);
      for (const x of targets) {
        patchBooking(x.id, patch);
        const when = (to?: string) => `${subjectName(x.subject)} · ${formatDateTime(x.startUtc, tzOf(to))}`;
        notify(x.bookerId, { type: "reminder", title: x.videoLink ? `${name} link updated for your lesson` : `${name} link added for your lesson`, body: `${when(x.bookerId)}. Open the lesson to join.`, href: `/dashboard/bookings/${x.id}` });
        if (actor === "admin") notify(tutorUserId(x.tutorId), { type: "reminder", title: `Staff set the ${name} link for a lesson`, body: when(tutorUserId(x.tutorId)), href: `/dashboard/bookings/${x.id}` });
      }
      if (actor === "admin") audit("booking.video_link", "booking", b.id, { provider: parsed.link.provider });
      return ok({ updated: targets.length });
    },
    removeLessonVideo(bookingId) {
      const check = lessonVideoAccess(bookingId);
      if (!check.ok) return check;
      const { booking: b, actor } = check.data;
      if (!b.videoLink) return fail("This lesson has no meeting link.");
      if (endMs(b) <= Date.now()) return fail("This lesson has ended, so its meeting link can't be changed.");
      patchBooking(b.id, { videoLink: undefined, videoPasscode: undefined });
      notify(b.bookerId, { type: "reminder", title: "Meeting link removed from your lesson", body: `${subjectName(b.subject)} · ${formatDateTime(b.startUtc, tzOf(b.bookerId))}. Join through the TutorLink classroom instead.`, href: `/dashboard/bookings/${b.id}` });
      if (actor === "admin") audit("booking.video_link_removed", "booking", b.id);
      return ok({ ...b, videoLink: undefined, videoPasscode: undefined });
    },
    setLessonRecording(bookingId, link) {
      const check = lessonVideoAccess(bookingId);
      if (!check.ok) return check;
      const { booking: b, actor } = check.data;
      if (startMs(b) > Date.now() || !["in_progress", "completed", "confirmed", "disputed", "refunded"].includes(b.status)) return fail("A recording can be added once the lesson has started.");
      if (!link.trim()) {
        patchBooking(b.id, { recordingUrl: undefined });
        return ok({ ...b, recordingUrl: undefined });
      }
      const parsed = parseRecordingLink(link);
      if (!parsed.ok) return fail(parsed.error);
      patchBooking(b.id, { recordingUrl: parsed.url });
      if (b.recordingUrl !== parsed.url) notify(b.bookerId, { type: "reminder", title: "Your lesson recording is ready", body: `${subjectName(b.subject)} · ${formatDateTime(b.startUtc, tzOf(b.bookerId))}`, href: `/dashboard/bookings/${b.id}` });
      if (actor === "admin") audit("booking.recording", "booking", b.id);
      return ok({ ...b, recordingUrl: parsed.url });
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
      if (body.trim().length > 3000) return fail("Keep your review under 3,000 characters.");
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
      if (!rev || !r.data.tutorId || rev.tutorId !== r.data.tutorId) return fail("You can only respond to reviews of your lessons.");
      if (rev.tutorResponse) return fail("You've already responded to this review.");
      if (body.trim().length < 10) return fail("Write at least 10 characters.");
      if (body.trim().length > 2000) return fail("Keep your response under 2,000 characters.");
      upsertReview({ ...rev, tutorResponse: { body: maskContactInfo(body.trim()).text, createdAt: nowIso() } });
      return ok(undefined);
    },

    /* ─── Messaging ────────────────────────────────────────── */
    startConversation(tutorId, opts = {}) {
      const r = requireUser(["student", "parent"]);
      if (!r.ok) return r;
      if (r.data.parentalConsent?.status === "pending") return fail("A parent or guardian needs to approve your account before you can message tutors.");
      if (!resolveTutor(get(), tutorId) || resolveTutor(get(), tutorId)?.hidden) return fail("This tutor is no longer available.");
      if (opts.childId && !get().children.some((c) => c.id === opts.childId && c.parentId === r.data.id)) return fail("Choose one of your children.");
      const existing = get().conversations.find((c) => c.tutorId === tutorId && c.userId === r.data.id && (c.childId ?? null) === (opts.childId ?? null));
      if (existing) return ok(existing);
      const paused = pausedMessage(r.data);
      if (paused) return fail(paused);
      const conv: Conversation = {
        id: uid("cnv"), tutorId, userId: r.data.id, childId: opts.childId, subject: opts.subject, createdAt: nowIso(), lastMessageAt: nowIso(),
        involvesMinor: r.data.role === "parent" || !!r.data.parentalConsent,
      };
      set((s) => ({ conversations: [conv, ...s.conversations] }));
      return ok(conv);
    },
    contactLearner(source) {
      const r = requireUser(["tutor"]);
      if (!r.ok) return r;
      const tutorId = r.data.tutorId;
      if (!tutorId) return fail("Finish your tutor profile before messaging families.");
      if (resolveTutor(get(), tutorId)?.hidden) return fail("Your profile is hidden from search. Contact support to resolve it before messaging families.");
      // Only families the tutor already has a real connection with: a lesson, or a job they applied to.
      let target: { userId: string; childId?: string; subject?: string } | null = null;
      if (source.bookingId) {
        const b = get().bookings.find((x) => x.id === source.bookingId && x.tutorId === tutorId);
        if (!b) return fail("Booking not found.");
        target = { userId: b.bookerId, childId: b.childId, subject: b.subject };
      } else if (source.requirementId) {
        const req = get().requirements.find((q) => q.id === source.requirementId);
        const applied = get().applications.some((a) => a.requirementId === source.requirementId && a.tutorId === tutorId && !["withdrawn", "rejected", "closed"].includes(a.status));
        if (!req || !applied) return fail("You can message a family once you've applied to their job.");
        target = { userId: req.ownerId, childId: req.childId, subject: req.subject || undefined };
      }
      if (!target) return fail("Choose a student to message.");
      const learner = get().users.find((u) => u.id === target.userId);
      if (!learner || learner.status !== "active") return fail("This account isn't available right now.");
      if (learner.parentalConsent?.status === "pending") return fail("This student's parent hasn't approved their account yet, so they can't receive messages.");
      const existing = get().conversations.find((c) => c.tutorId === tutorId && c.userId === target.userId && (c.childId ?? null) === (target.childId ?? null));
      if (existing) return ok(existing);
      const paused = pausedMessage(r.data);
      if (paused) return fail(paused);
      const conv: Conversation = {
        id: uid("cnv"), tutorId, userId: target.userId, childId: target.childId, subject: target.subject, createdAt: nowIso(), lastMessageAt: nowIso(),
        involvesMinor: learner.role === "parent" || !!learner.parentalConsent,
      };
      set((s) => ({ conversations: [conv, ...s.conversations] }));
      return ok(conv);
    },
    sendMessage(conversationId, body, attachment) {
      const r = requireUser();
      if (!r.ok) return r;
      const c = get().conversations.find((x) => x.id === conversationId);
      if (!c) return fail("Conversation not found.");
      const senderId = r.data.tutorId && r.data.tutorId === c.tutorId ? c.tutorId : r.data.id === c.userId ? r.data.id : null;
      if (!senderId) return fail("You're not part of this conversation.");
      if (c.blockedBy) return fail(c.blockedBy === senderId ? "You blocked this conversation. Unblock to send messages." : "You can't reply to this conversation.");
      const paused = pausedMessage(r.data);
      if (paused) return fail(paused, "chat_paused");
      const trimmed = body.trim();
      if (!trimmed && !attachment) return fail("Write a message first.");
      if (trimmed.length > 4000) return fail("Messages are limited to 4,000 characters.");
      if (attachment && attachment.sizeKb > 10_240) return fail("Attachments must be 10 MB or smaller.");
      if (attachment && !/\.(pdf|png|jpe?g|webp|docx|txt)$/i.test(attachment.name)) return fail("Attach a PDF, image (PNG, JPG, WebP), Word (.docx) or text file.");
      // The other person sees the file name too.
      if (attachment && fileNameContact(attachment.name).found) return fail("The file name looks like it includes contact details. Rename the file and attach it again.", "contact_blocked");
      // Contact details are never delivered: the message is refused (nothing is saved) and the attempt is logged for Trust & Safety.
      const found = scanContact(trimmed, "chat");
      if (found.found) {
        const nowPaused = flagContact(r.data, { channel: "chat", source: "text", contextId: c.id, recipientId: counterpartOf(c, r.data), kinds: found.kinds, excerpt: redactedExcerpt(trimmed, found.matches) });
        const pause = nowPaused ? pausedMessage(get().users.find((x) => x.id === r.data.id) ?? r.data) : null;
        return fail(pause ? `${blockedMessage(found.kinds)} ${pause}` : blockedMessage(found.kinds), "contact_blocked");
      }
      // A number sent a piece at a time ("9", "1", "7" …, or "my number is 917" then "555 0123"): this person's
      // latest short messages (no reply in between, last 30 minutes) are read together with this one.
      const thread = get().messages.filter((m) => m.conversationId === c.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const recent: Message[] = [];
      for (let i = thread.length - 1; i >= 0 && recent.length < 40; i--) {
        const m = thread[i];
        if (m.senderId !== senderId || Date.now() - new Date(m.createdAt).getTime() > 30 * 60_000 || m.body.length > 60 || m.moderation) break;
        recent.unshift(m);
      }
      const split = trimmed ? scanSplitMessages(recent.map((m) => m.body), trimmed) : null;
      if (split?.found) {
        // The earlier pieces were already delivered, so they're hidden now as well.
        const hide = new Set(split.pieces.map((i) => recent[i].id));
        set((s) => ({ messages: s.messages.map((m) => (hide.has(m.id) ? { ...m, body: "[removed: part of a phone number or contact details]", moderation: "contact_info_masked" as const } : m)) }));
        const nowPaused = flagContact(r.data, {
          channel: "chat", source: "text", contextId: c.id, recipientId: counterpartOf(c, r.data), kinds: split.kinds,
          excerpt: `Contact details sent a few pieces at a time across ${split.pieces.length + 1} messages (the earlier pieces were hidden)`,
        });
        const pause = nowPaused ? pausedMessage(get().users.find((x) => x.id === r.data.id) ?? r.data) : null;
        return fail(pause ? `${blockedMessage(split.kinds, "split")} ${pause}` : blockedMessage(split.kinds, "split"), "contact_blocked");
      }
      const text = trimmed;
      const msg: Message = {
        id: uid("msg"), conversationId, senderId, body: text, createdAt: nowIso(),
        ...(attachment ? { attachment: { name: attachment.name, sizeKb: attachment.sizeKb, ...(attachment.path ? { path: attachment.path } : {}) } } : {}),
      };
      set((s) => ({ messages: [...s.messages, msg], conversations: s.conversations.map((x) => (x.id === conversationId ? { ...x, lastMessageAt: msg.createdAt } : x)) }));
      const recipient = senderId === c.tutorId ? c.userId : tutorUserId(c.tutorId);
      // A message that's only digits or a few letters doesn't show them in the notification (or its email copy).
      notify(recipient, { type: "message", title: `New message from ${r.data.firstName} ${r.data.lastName.charAt(0)}.`, body: numberPiece(text) || text.length <= 3 ? "Sent you a message." : text.slice(0, 90), href: `/dashboard/messages?c=${conversationId}` });
      return ok(msg);
    },
    markConversationRead(conversationId) {
      const u = me();
      const c = get().conversations.find((x) => x.id === conversationId);
      if (!u || !c) return ok(undefined);
      const mine = u.tutorId && u.tutorId === c.tutorId ? c.tutorId : u.id === c.userId ? u.id : null;
      if (!mine) return fail("You're not part of this conversation.");
      const at = nowIso();
      if (!get().messages.some((m) => m.conversationId === conversationId && m.senderId !== mine && !m.readAt)) return ok(undefined);
      set((s) => ({ messages: s.messages.map((m) => (m.conversationId === conversationId && m.senderId !== mine && !m.readAt ? { ...m, readAt: at } : m)) }));
      return ok(undefined);
    },
    toggleBlock(conversationId) {
      const r = requireUser();
      if (!r.ok) return r;
      const c = get().conversations.find((x) => x.id === conversationId);
      if (!c) return fail("Conversation not found.");
      const self = r.data.tutorId && r.data.tutorId === c.tutorId ? c.tutorId : r.data.id === c.userId ? r.data.id : null;
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
      if (input.details.length > 2000) return fail("Keep the details under 2,000 characters.");
      const rep: Report = { ...input, id: uid("rpt"), reporterId: r.data.id, status: "open", createdAt: nowIso() };
      set((s) => ({
        reports: [rep, ...s.reports],
        conversations: input.targetType === "message" ? s.conversations.map((c) => (s.messages.some((m) => m.id === input.targetId && m.conversationId === c.id) ? { ...c, reported: true } : c)) : s.conversations,
      }));
      return ok(rep);
    },
    recordContactFlag(input) {
      const r = requireUser();
      if (!r.ok) return r;
      if (!input.kinds.length) return fail("Nothing to record.");
      let contextId: string | undefined;
      let recipientId: string | undefined;
      // Only link the entry to something the person really is part of.
      if (input.channel === "chat") {
        const c = get().conversations.find((x) => x.id === input.contextId);
        if (c && (c.userId === r.data.id || (r.data.tutorId && c.tutorId === r.data.tutorId))) {
          contextId = c.id;
          recipientId = counterpartOf(c, r.data);
        }
      } else if (input.channel === "homework") {
        const hw = get().homework.find((h) => h.id === input.contextId);
        if (hw && learnerIdsFor(r.data).includes(hw.learnerId)) {
          contextId = hw.id;
          recipientId = tutorUserId(hw.tutorId) ?? hw.tutorId;
        }
      } else if (r.data.tutorId) contextId = r.data.tutorId;
      const fileName = input.fileName?.slice(0, 200);
      const paused = flagContact(r.data, { channel: input.channel, source: "file", contextId, recipientId, kinds: input.kinds, excerpt: fileName ? `File: ${fileName}` : "Profile photo", fileName });
      return ok({ paused });
    },
    requestChatUnlock(note) {
      const r = requireUser();
      if (!r.ok) return r;
      if (!pausedUntil(r.data)) return fail("Your messaging isn't paused.");
      if (r.data.chatModeration?.unlockRequestedAt) return fail("You've already asked. Our team will review it soon.");
      if (r.data.chatModeration?.unlockDeclinedAt) return fail("Our team already reviewed your request. You can send messages again when the pause ends.");
      // The note only goes to staff, but contact details still don't belong in it.
      const text = maskContactInfo(note.trim().slice(0, 500)).text;
      const chatModeration = { warnings: 0, ...r.data.chatModeration, unlockRequestedAt: nowIso(), unlockRequestNote: text || undefined };
      set((s) => ({ users: s.users.map((u) => (u.id === r.data.id ? { ...u, chatModeration } : u)) }));
      const moderators = get().users.filter((u) => u.status === "active" && hasPermission(u, "reports.moderate"));
      for (const m of moderators) {
        notify(m.id, { type: "security", title: `${r.data.firstName} ${r.data.lastName.charAt(0)}. asked to unlock messaging`, body: text || "No message added.", href: `/admin/chat-safety?user=${r.data.id}` });
      }
      audit("chat.unlock_request", "user", r.data.id, text ? { note: text } : undefined);
      return ok(undefined);
    },

    /* ─── Notifications ────────────────────────────────────── */
    markNotificationRead(id) {
      const r = requireUser();
      if (!r.ok) return r;
      set((s) => ({ notifications: s.notifications.map((n) => (n.id === id && n.userId === r.data.id ? { ...n, read: true } : n)) }));
      return ok(undefined);
    },
    markAllNotificationsRead() {
      const r = requireUser();
      if (!r.ok) return r;
      set((s) => ({ notifications: s.notifications.map((n) => (n.userId === r.data.id ? { ...n, read: true } : n)) }));
      return ok(undefined);
    },
    setNotificationPref(group, channel, value) {
      const r = requireUser();
      if (!r.ok) return r;
      const prefs = get().notificationPrefs[r.data.id] ?? DEFAULT_NOTIFICATION_PREFS;
      if (channel === "sms" && value && !flag("sms_notifications")) return fail("Text message notifications aren't available yet.");
      set((s) => ({ notificationPrefs: { ...s.notificationPrefs, [r.data.id]: { ...prefs, [group]: { ...prefs[group], [channel]: value } } } }));
      return ok(undefined);
    },

    /* ─── Children ─────────────────────────────────────────── */
    saveChild(input) {
      const r = requireUser(["parent"]);
      if (!r.ok) return r;
      if (!input.firstName.trim()) return fail("Enter your child's first name.");
      if (contactIn(input.firstName).found) return fail(NAME_RULE, "contact_blocked");
      if (input.notes) input = { ...input, notes: maskContactInfo(input.notes).text };
      if (input.learningGoals) input = { ...input, learningGoals: input.learningGoals.map((g) => maskContactInfo(g).text) };
      const existing = input.id ? get().children.find((c) => c.id === input.id) : undefined;
      if (input.id && (!existing || existing.parentId !== r.data.id)) return fail("Child not found.");
      if (!existing && get().children.filter((c) => c.parentId === r.data.id).length >= 10) return fail("You can add up to 10 children.");
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
      const tutorId = r.data.tutorId;
      if (!tutorId) return fail("Complete your tutor profile first.");
      if (!tutorTeachesLearner(tutorId, learnerId)) return fail("You can only add notes for students you teach.");
      if (body.trim().length < 10) return fail("Write a short note (10+ characters).");
      if (body.trim().length > 4000) return fail("Keep the note under 4,000 characters.");
      if (bookingId && !get().bookings.some((b) => b.id === bookingId && b.tutorId === tutorId)) return fail("Choose one of your lessons.");
      const found = scanContact(body, "chat");
      if (found.found) {
        flagContact(r.data, { channel: "lesson", source: "text", contextId: learnerId, recipientId: accountFor(learnerId), kinds: found.kinds, excerpt: redactedExcerpt(body.trim(), found.matches) });
        return fail(blockedMessage(found.kinds, "note"), "contact_blocked");
      }
      const n: ProgressNote = { id: uid("prg"), learnerId, tutorId, bookingId, body: body.trim(), rating, createdAt: nowIso() };
      set((s) => ({ progressNotes: [n, ...s.progressNotes] }));
      notify(accountFor(learnerId), { type: "progress", title: "New progress note", body: n.body.slice(0, 90), href: "/dashboard/progress" });
      return ok(n);
    },
    assignHomework(input) {
      const r = requireUser(["tutor"]);
      if (!r.ok) return r;
      const tutorId = r.data.tutorId;
      if (!tutorId) return fail("Complete your tutor profile first.");
      if (!tutorTeachesLearner(tutorId, input.learnerId)) return fail("You can only assign homework to students you teach.");
      if (!input.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) return fail("Add a title and due date.");
      const found = contactIn(input.title, input.instructions);
      if (found.found) {
        flagContact(r.data, { channel: "homework", source: "text", contextId: input.learnerId, recipientId: accountFor(input.learnerId), kinds: found.kinds, excerpt: redactedExcerpt(`${input.title}\n${input.instructions ?? ""}`.trim(), found.matches) });
        return fail(blockedMessage(found.kinds, "note"), "contact_blocked");
      }
      const hw: Homework = { ...input, title: input.title.trim(), id: uid("hw"), tutorId, status: "assigned", createdAt: nowIso() };
      set((s) => ({ homework: [hw, ...s.homework] }));
      notify(accountFor(input.learnerId), { type: "homework", title: "New homework", body: hw.title, href: "/dashboard/homework" });
      return ok(hw);
    },
    submitHomework(id, body, fileName, filePath) {
      const r = requireUser(["student", "parent"]);
      if (!r.ok) return r;
      const hw = get().homework.find((h) => h.id === id);
      if (!hw || !learnerIdsFor(r.data).includes(hw.learnerId)) return fail("Homework not found.");
      if (hw.status === "reviewed") return fail("This homework has already been reviewed.");
      if (!body.trim() && !fileName) return fail("Add a note or attach your work.");
      if (fileName && fileNameContact(fileName).found) return fail("The file name looks like it includes contact details. Rename the file and attach it again.", "contact_blocked");
      const found = scanContact(body, "chat");
      if (found.found) {
        flagContact(r.data, { channel: "homework", source: "text", contextId: hw.id, recipientId: tutorUserId(hw.tutorId) ?? hw.tutorId, kinds: found.kinds, excerpt: redactedExcerpt(body.trim(), found.matches) });
        return fail(blockedMessage(found.kinds, "note"), "contact_blocked");
      }
      set((s) => ({ homework: s.homework.map((h) => (h.id === id ? { ...h, status: "submitted", submission: { body: body.trim(), fileName, ...(fileName && filePath ? { filePath } : {}), submittedAt: nowIso() } } : h)) }));
      notify(tutorUserId(hw.tutorId), { type: "homework", title: "Homework submitted", body: hw.title, href: "/dashboard/homework" });
      return ok(undefined);
    },
    reviewHomework(id, body, grade) {
      const r = requireUser(["tutor"]);
      if (!r.ok) return r;
      const hw = get().homework.find((h) => h.id === id);
      if (!hw || !r.data.tutorId || hw.tutorId !== r.data.tutorId) return fail("Homework not found.");
      if (hw.status !== "submitted") return fail("Only submitted homework can be reviewed.");
      const found = scanContact(body, "chat");
      if (found.found) {
        flagContact(r.data, { channel: "homework", source: "text", contextId: hw.id, recipientId: accountFor(hw.learnerId), kinds: found.kinds, excerpt: redactedExcerpt(body.trim(), found.matches) });
        return fail(blockedMessage(found.kinds, "note"), "contact_blocked");
      }
      set((s) => ({ homework: s.homework.map((h) => (h.id === id ? { ...h, status: "reviewed", feedback: { body: body.trim(), grade, at: nowIso() } } : h)) }));
      notify(accountFor(hw.learnerId), { type: "homework", title: "Homework reviewed", body: hw.title, href: "/dashboard/homework" });
      return ok(undefined);
    },
    setTopicStatus(goalId, topic, status) {
      const r = requireUser(["tutor"]);
      if (!r.ok) return r;
      const g = get().goals.find((x) => x.id === goalId);
      if (!g || !r.data.tutorId || g.tutorId !== r.data.tutorId) return fail("Goal not found.");
      set((s) => ({ goals: s.goals.map((x) => (x.id === goalId ? { ...x, topics: x.topics.map((t) => (t.name === topic ? { ...t, status } : t)) } : x)) }));
      return ok(undefined);
    },
    addGoal(input) {
      const r = requireUser(["tutor", "parent", "student"]);
      if (!r.ok) return r;
      const tutorId = r.data.role === "tutor" ? r.data.tutorId : input.tutorId;
      if (!tutorId) return fail("Choose a tutor for this goal.");
      if (r.data.role === "tutor" ? !tutorTeachesLearner(tutorId, input.learnerId) : !learnerIdsFor(r.data).includes(input.learnerId)) return fail("You can't add goals for this learner.");
      if (r.data.role !== "tutor" && !resolveTutor(get(), tutorId)) return fail("Choose one of your tutors.");
      if (!input.title.trim()) return fail("Give the goal a title.");
      const goalText = [input.title, ...(input.topics ?? []).map((t) => t.name)];
      const found = contactIn(...goalText);
      if (found.found) {
        flagContact(r.data, { channel: "lesson", source: "text", contextId: input.learnerId, kinds: found.kinds, excerpt: redactedExcerpt(goalText.join("\n"), found.matches) });
        return fail(blockedMessage(found.kinds, "note"), "contact_blocked");
      }
      const goal: LearningGoal = { ...input, title: input.title.trim(), id: uid("gol"), tutorId, createdAt: nowIso() };
      set((s) => ({ goals: [goal, ...s.goals] }));
      return ok(goal);
    },

    /* ─── Tutor profile & business ─────────────────────────── */
    updateTutorProfile(patch) {
      const r = requireUser(["tutor"]);
      if (!r.ok || !r.data.tutorId) return r.ok ? fail("Tutor profile not found.") : r;
      if (patch.hourlyRateCents !== undefined && (!Number.isInteger(patch.hourlyRateCents) || patch.hourlyRateCents < 1500 || patch.hourlyRateCents > 50000)) return fail("Hourly rate must be between $15 and $500.");
      if (patch.bio !== undefined && patch.bio.trim().length < 80) return fail("Your bio should be at least 80 characters.");
      if (patch.introVideoUrl && !parseIntroVideo(patch.introVideoUrl)) return fail("Use a YouTube or Vimeo link, a direct MP4 link, or upload a video file.");
      if (patch.experienceYears !== undefined && (!Number.isInteger(patch.experienceYears) || patch.experienceYears < 0 || patch.experienceYears > 60)) return fail("Years of experience must be between 0 and 60.");
      if (patch.subjects !== undefined && (patch.subjects.length < 1 || patch.subjects.length > 10)) return fail("Choose 1 to 10 subjects.");
      if (patch.modes !== undefined && !patch.modes.length) return fail("Choose online, in person, or both.");
      const maxYear = new Date().getFullYear() + 6;
      const badYear = (y: number) => !Number.isInteger(y) || y < 1950 || y > maxYear;
      if (patch.education && (patch.education.length > 6 || patch.education.some((e) => e.degree.trim().length < 2 || e.field.trim().length < 2 || e.institution.trim().length < 2 || badYear(e.year))))
        return fail("Check your education entries: each needs a degree, field, school and year.");
      if (patch.certifications && (patch.certifications.length > 6 || patch.certifications.some((c) => c.name.trim().length < 2 || c.issuer.trim().length < 2 || badYear(c.year))))
        return fail("Check your certifications: each needs a name, issuer and year.");
      // A verified entry stays verified only while it is unchanged; new or edited entries start unverified.
      const current = resolveTutor(get(), r.data.tutorId)!;
      const keepVerified = <T extends { verified: boolean }>(list: T[], before: T[], same: (a: T, b: T) => boolean) =>
        list.map((x) => ({ ...x, verified: before.some((b) => b.verified && same(b, x)) }));
      const clean: Partial<Tutor> = {
        ...definedOnly(patch),
        ...(patch.bio ? { bio: maskContactInfo(patch.bio).text } : {}),
        ...(patch.approach ? { approach: maskContactInfo(patch.approach).text } : {}),
        ...(patch.headline ? { headline: maskContactInfo(patch.headline.trim()).text } : {}),
        ...(patch.introVideoUrl ? { introVideoUrl: patch.introVideoUrl.trim() } : {}),
        ...("photoUrl" in patch && !patch.photoUrl ? { photoUrl: "" } : {}),
        ...("introVideoUrl" in patch && !patch.introVideoUrl ? { introVideoUrl: "" } : {}),
        ...(patch.education
          ? { education: keepVerified(patch.education.map((e) => ({ ...e, degree: maskContactInfo(e.degree).text, field: maskContactInfo(e.field).text, institution: maskContactInfo(e.institution).text })), current.education, (a, b) => a.degree === b.degree && a.field === b.field && a.institution === b.institution && a.year === b.year) }
          : {}),
        ...(patch.certifications ? { certifications: keepVerified(patch.certifications.map((c) => ({ ...c, name: maskContactInfo(c.name).text, issuer: maskContactInfo(c.issuer).text })), current.certifications, (a, b) => a.name === b.name && a.issuer === b.issuer && a.year === b.year) } : {}),
      };
      patchTutor(r.data.tutorId, clean);
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
      patchTutor(r.data.tutorId, { availability: windows });
      return ok(undefined);
    },
    setExceptions(exceptions) {
      const r = requireUser(["tutor"]);
      if (!r.ok || !r.data.tutorId) return r.ok ? fail("Tutor profile not found.") : r;
      patchTutor(r.data.tutorId, { exceptions });
      return ok(undefined);
    },
    setBookingRules(rules) {
      const r = requireUser(["tutor"]);
      if (!r.ok || !r.data.tutorId) return r.ok ? fail("Tutor profile not found.") : r;
      const current = resolveTutor(get(), r.data.tutorId)!.rules;
      const next = { ...current, ...definedOnly(rules) };
      if (next.minNoticeHours < 1 || next.minNoticeHours > 168) return fail("Minimum notice must be between 1 and 168 hours.");
      if (next.maxAdvanceDays < 7 || next.maxAdvanceDays > 180) return fail("Advance booking window must be 7–180 days.");
      if (next.bufferMinutes < 0 || next.bufferMinutes > 60) return fail("Buffer must be 0–60 minutes.");
      if (!next.sessionLengths.length) return fail("Offer at least one session length.");
      if (rules.requiresApproval === false && !flag("instant_booking")) return fail("Instant booking is currently disabled by the platform.");
      patchTutor(r.data.tutorId, { rules: next });
      return ok(undefined);
    },
    setTrial(trial) {
      const r = requireUser(["tutor"]);
      if (!r.ok || !r.data.tutorId) return r.ok ? fail("Tutor profile not found.") : r;
      const next = { ...resolveTutor(get(), r.data.tutorId)!.trial, ...definedOnly(trial) };
      if (next.priceCents < 0 || next.priceCents > 20000 || !Number.isInteger(next.priceCents)) return fail("Trial price must be between $0 and $200.");
      if (![15, 20, 25, 30, 45, 60].includes(next.durationMin)) return fail("Choose a trial length between 15 and 60 minutes.");
      patchTutor(r.data.tutorId, { trial: next });
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
      const hourlyRateCents = Math.round(Number(d.hourlyRate) * 100);
      if (!Number.isInteger(hourlyRateCents) || hourlyRateCents < 1500 || hourlyRateCents > 50000) return fail("Hourly rate must be between $15 and $500.");
      // Tutors who already have a profile keep it — onboarding never creates a duplicate.
      if (r.data.tutorId && resolveTutor(get(), r.data.tutorId)) return ok(resolveTutor(get(), r.data.tutorId)!);
      const id = r.data.tutorId ?? uid("tut");
      const str = (v: unknown, max = 4000) => (typeof v === "string" ? v : "").slice(0, max);
      const tutorCountry = isCountryCode(String(d.country ?? "")) ? String(d.country) : (r.data.country ?? "US");
      if (d.zip && !isPostalCode(String(d.zip), tutorCountry)) return fail(postalError(tutorCountry));
      const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 20) : []);
      const tutor: Tutor = {
        id, slug: `${r.data.firstName}-${r.data.lastName}-${id.slice(-4)}`.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-"), firstName: r.data.firstName, lastName: r.data.lastName,
        headline: maskContactInfo(str(d.headline, 120)).text, bio: maskContactInfo(str(d.bio)).text, approach: maskContactInfo(str(d.approach)).text,
        subjects: strs(d.subjects), specialties: strs(d.specialties), levels: (strs(d.levels).length ? strs(d.levels) : ["high"]) as Tutor["levels"],
        category: (str(d.category) || "subject_expert") as Tutor["category"], learningSupport: strs(d.learningSupport),
        country: tutorCountry, city: str(d.city ?? r.data.city, 60), state: str(d.state ?? r.data.state, 60), zip: str(d.zip, 10).trim(),
        // Offline geocoding from a US ZIP / city (unknown US ZIPs fall back to the US centroid). Places outside the US
        // aren't on the map yet (0, 0), so distance isn't scored for them.
        ...(() => {
          if (tutorCountry !== "US") return { lat: 0, lng: 0 };
          const p = resolveLocation(String(d.zip)) ?? resolveLocation(`${d.city ?? ""}, ${d.state ?? ""}`);
          return p ? { lat: p.lat, lng: p.lng } : { lat: 39.83, lng: -98.58 };
        })(),
        serviceRadiusMiles: Math.min(100, Math.max(0, Math.round(Number(d.serviceRadiusMiles ?? 10)) || 10)), timezone: r.data.timezone, modes: strs(d.modes) as TeachingMode[],
        hourlyRateCents,
        trial: { enabled: Boolean(d.trialEnabled ?? true), priceCents: Math.min(20000, Math.max(0, Math.round(Number(d.trialPrice ?? 0) * 100) || 0)), durationMin: [15, 20, 25, 30, 45, 60].includes(Number(d.trialDuration)) ? Number(d.trialDuration) : 30 },
        rules: { minNoticeHours: 12, maxAdvanceDays: 45, bufferMinutes: 15, sessionLengths: [60], requiresApproval: true },
        experienceYears: Math.min(60, Math.max(0, Math.round(Number(d.experienceYears ?? 0)) || 0)),
        education: (Array.isArray(d.education) ? (d.education as unknown as Tutor["education"]) : []).slice(0, 6).map((e) => ({ degree: maskContactInfo(str(e.degree, 80)).text, field: maskContactInfo(str(e.field, 80)).text, institution: maskContactInfo(str(e.institution, 120)).text, year: Number(e.year) || 0, verified: false })),
        certifications: (Array.isArray(d.certifications) ? (d.certifications as unknown as Tutor["certifications"]) : []).slice(0, 6).map((c) => ({ name: maskContactInfo(str(c.name, 120)).text, issuer: maskContactInfo(str(c.issuer, 120)).text, year: Number(c.year) || 0, verified: false })),
        languages: strs(d.languages).length ? strs(d.languages) : ["English"],
        verification: { identity: d.idDocument ? "submitted" : "not_started", education: "not_started", certification: "not_started", background: "not_started" },
        rating: null, reviewCount: 0, lessonsCompleted: 0, responseTimeHours: null,
        availability: (Array.isArray(d.availability) ? (d.availability as unknown as WeeklyWindow[]) : []).filter((w) => w && [0, 1, 2, 3, 4, 5, 6].includes(w.day) && /^\d\d:\d\d$/.test(w.start) && /^\d\d:\d\d$/.test(w.end) && w.start < w.end),
        exceptions: [], featured: false, joinedAt: nowIso(), tone: 2,
        // The server stores an uploaded photo in Storage first, so this is normally its public URL.
        ...(typeof d.photoDataUrl === "string" && /^(data:image\/|https?:\/\/)/.test(String(d.photoDataUrl)) ? { photoUrl: String(d.photoDataUrl) } : {}),
        ...(typeof d.introVideoUrl === "string" && parseIntroVideo(d.introVideoUrl) ? { introVideoUrl: String(d.introVideoUrl).trim() } : {}),
      };
      if (!tutor.modes.length || tutor.modes.some((m) => m !== "online" && m !== "in_person")) return fail("Choose online, in person, or both.");
      const idDocument = d.idDocument ? { name: str(d.idDocument, 200), sizeKb: Number(d.idDocumentSizeKb ?? 0) || 1, ...(typeof d.idDocumentPath === "string" ? { path: String(d.idDocumentPath) } : {}) } : null;
      set((s) => ({
        registeredTutors: [...s.registeredTutors, tutor],
        users: s.users.map((u) => (u.id === r.data.id ? { ...u, tutorId: id } : u)),
        onboarding: { ...s.onboarding, [r.data.id]: { ...draft, submittedAt: nowIso() } },
        leadTransactions: [{ id: uid("lt"), tutorId: id, delta: 3, reason: "Starter plan — monthly credits", createdAt: nowIso() }, ...s.leadTransactions],
        verificationRequests: idDocument ? [{ id: uid("vr"), tutorId: id, kind: "identity", status: "submitted", documents: [idDocument], submittedAt: nowIso() }, ...s.verificationRequests] : s.verificationRequests,
      }));
      return ok(tutor);
    },
    submitVerification(kind, documents) {
      const r = requireUser(["tutor"]);
      if (!r.ok || !r.data.tutorId) return r.ok ? fail("Tutor profile not found.") : r;
      if (!documents.length) return fail("Upload at least one document.");
      if (documents.length > 10) return fail("Upload up to 10 documents.");
      if (documents.some((d) => d.sizeKb > 15_360)) return fail("Each document must be 15 MB or smaller.");
      if (documents.some((d) => !/\.(pdf|png|jpe?g|heic)$/i.test(d.name))) return fail("Upload PDF or image files only.");
      const tutorId = r.data.tutorId;
      const t = resolveTutor(get(), tutorId)!;
      if (["submitted", "under_review", "verified"].includes(t.verification[kind])) return fail("This check is already in progress or complete.");
      const req: VerificationRequest = { id: uid("vr"), tutorId, kind, status: "submitted", documents, submittedAt: nowIso() };
      set((s) => ({ verificationRequests: [req, ...s.verificationRequests] }));
      patchTutor(tutorId, { verification: { ...t.verification, [kind]: "submitted" } });
      return ok(req);
    },
    buyCredits(packId) {
      const r = requireUser(["tutor"]);
      if (!r.ok || !r.data.tutorId) return r.ok ? fail("Tutor profile not found.") : r;
      if (!flag("lead_credits")) return fail("Lead credits are currently disabled.");
      const pack = CREDIT_PACKS.find((p) => p.id === packId);
      if (!pack) return fail("Choose a credit pack.");
      if (!env.paymentsEnabled) return fail("Buying credits needs card payments, which aren't switched on yet.");
      const tx: LeadTransaction = { id: uid("lt"), tutorId: r.data.tutorId, delta: pack.credits, reason: `Purchased ${pack.credits} credits`, createdAt: nowIso() };
      set((s) => ({ leadTransactions: [tx, ...s.leadTransactions] }));
      addPayment({ userId: r.data.id, kind: "lead_credits", amountCents: pack.priceCents, status: "succeeded", description: `${pack.credits} lead credits`, method: PAY_METHOD_LABEL.card });
      return ok(tx);
    },
    changePlan(plan) {
      const r = requireUser(["tutor"]);
      if (!r.ok || !r.data.tutorId) return r.ok ? fail("Tutor profile not found.") : r;
      const p = TUTOR_PLANS.find((x) => x.id === plan);
      if (!p) return fail("Choose a plan.");
      if (p.priceCents > 0 && !env.paymentsEnabled) return fail("Paid plans need card payments, which aren't switched on yet.");
      const tutorId = r.data.tutorId;
      set((s) => ({ subscriptions: { ...s.subscriptions, [tutorId]: { plan, status: "active", renewsAt: new Date(Date.now() + 30 * 86_400_000).toISOString() } } }));
      if (p.priceCents > 0) {
        addPayment({ userId: r.data.id, kind: "subscription", amountCents: p.priceCents, status: "succeeded", description: `${p.name} plan — monthly`, method: PAY_METHOD_LABEL.card });
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
      if (details.trim().length > 4000) return fail("Keep the description under 4,000 characters.");
      const check = canTransition(b, "disputed", actor, Date.now(), get().policy);
      if (!check.ok) return fail(check.reason);
      const d: Dispute = { id: uid("dsp"), bookingId, openedBy: r.data.id, reason, details: details.trim(), evidence, status: "open", adminNotes: [], createdAt: nowIso(), updatedAt: nowIso() };
      set((s) => ({ disputes: [d, ...s.disputes] }));
      patchBooking(bookingId, { status: "disputed", history: [...b.history, { at: nowIso(), by: r.data.id, from: b.status, to: "disputed", note: reason.replace(/_/g, " ") }] });
      notify(actor === "booker" ? tutorUserId(b.tutorId) : b.bookerId, { type: "booking_cancelled", title: "A dispute was opened", body: "Our team will review and contact you.", href: `/dashboard/bookings/${bookingId}` });
      return ok(d);
    },
    addDisputeNote(id, body) {
      const r = requireStaff(["admin", "support"], "disputes.manage", "You don't have permission to manage disputes.");
      if (!r.ok) return r;
      if (!body.trim()) return fail("Write a note.");
      if (!get().disputes.some((d) => d.id === id)) return fail("Dispute not found.");
      set((s) => ({ disputes: s.disputes.map((d) => (d.id === id ? { ...d, adminNotes: [...d.adminNotes, { by: r.data.id, body: body.trim(), at: nowIso() }], updatedAt: nowIso() } : d)) }));
      audit("dispute.note", "dispute", id);
      return ok(undefined);
    },
    setDisputeStatus(id, status) {
      const r = requireStaff(["admin", "support"], "disputes.manage", "You don't have permission to manage disputes.");
      if (!r.ok) return r;
      if (status === "resolved" || status === "rejected") return fail("Use Resolve to record a decision.");
      const d = get().disputes.find((x) => x.id === id);
      if (!d) return fail("Dispute not found.");
      if (["resolved", "rejected"].includes(d.status)) return fail("This dispute is closed. Its decision can't be reopened here.");
      set((s) => ({ disputes: s.disputes.map((x) => (x.id === id ? { ...x, status, updatedAt: nowIso() } : x)) }));
      audit("dispute.status", "dispute", id, { status });
      return ok(undefined);
    },
    resolveDispute(id, outcome, amountCents, note) {
      const r = requireStaff(["admin", "support"], "disputes.manage", "You don't have permission to manage disputes.");
      if (!r.ok) return r;
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
      if ((outcome === "full_refund" || outcome === "partial_refund") && amount > 0) {
        const description = `Dispute refund (${outcome.replace("_", " ")})`;
        addPayment({ bookingId: b.id, userId: b.bookerId, kind: "booking", amountCents: -amount, status: "refunded", description, method: paidFromWallet(b.id) ? PAY_METHOD_LABEL.wallet : "Original payment method" });
        refundToWallet(b.id, b.bookerId, amount, description);
      }
      if (outcome === "credit" && amount > 0) addWalletTx({ userId: b.bookerId, deltaCents: amount, kind: "credit", description: "Platform credit — dispute decision", bookingId: b.id });
      audit("dispute.resolve", "dispute", id, { outcome, amountCents: amount });
      notify(b.bookerId, { type: "refund", title: "Dispute resolved", body: outcome === "no_refund" ? "No refund was issued. See details in your booking." : outcome === "credit" ? `${formatCents(amount)} platform credit added to your Study Credits.` : `${formatCents(amount)} refund issued.`, href: `/dashboard/bookings/${b.id}` });
      notify(tutorUserId(b.tutorId), { type: "booking_cancelled", title: "Dispute resolved", body: `${subjectName(b.subject)} · ${formatDateTime(b.startUtc, tzOf(tutorUserId(b.tutorId)))}`, href: `/dashboard/bookings/${b.id}` });
      return ok(undefined);
    },

    /* ─── Admin ────────────────────────────────────────────── */
    reviewVerification(id, decision, note) {
      const r = requireStaff(["admin", "support"], "tutors.verify", "You don't have permission to review verification.");
      if (!r.ok) return r;
      const vr = get().verificationRequests.find((x) => x.id === id);
      if (!vr) return fail("Request not found.");
      if (decision === "rejected" && (!note || note.trim().length < 10)) return fail("Explain why the documents were rejected so the tutor can fix it.");
      const t = resolveTutor(get(), vr.tutorId)!;
      set((s) => ({
        verificationRequests: s.verificationRequests.map((x) => (x.id === id ? { ...x, status: decision, reviewedBy: r.data.id, reviewedAt: nowIso(), note, ...(decision === "verified" ? { expiresAt: new Date(Date.now() + 730 * 86_400_000).toISOString() } : {}) } : x)),
      }));
      patchTutor(vr.tutorId, { verification: { ...t.verification, [vr.kind]: decision } });
      audit(`verification.${decision === "verified" ? "approve" : decision === "rejected" ? "reject" : "start_review"}`, "verification", id, { kind: vr.kind, tutor: vr.tutorId });
      notify(tutorUserId(vr.tutorId), { type: "verification", title: `${vr.kind[0].toUpperCase()}${vr.kind.slice(1)} verification ${decision.replace("_", " ")}`, body: note ?? "", href: "/dashboard/verification" });
      return ok(undefined);
    },
    setUserStatus(userId, status, reason) {
      const r = requireStaff(["admin", "support"], "users.write", "You don't have permission to change account status.");
      if (!r.ok) return r;
      if (userId === r.data.id) return fail("You can't change your own account status.");
      if (reason.trim().length < 5) return fail("Add a reason for the audit log.");
      const target = get().users.find((u) => u.id === userId);
      if (!target) return fail("Account not found.");
      if ((target.role === "admin" || target.role === "support") && r.data.role !== "admin") return fail("Only an administrator can change a staff account.");
      set((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, status } : u)) }));
      audit(`user.${status === "suspended" ? "suspend" : "reactivate"}`, "user", userId, { reason });
      return ok(undefined);
    },
    setReportStatus(id, status) {
      const r = requireStaff(["admin", "support"], "reports.moderate", "You don't have permission to moderate reports.");
      if (!r.ok) return r;
      if (!get().reports.some((x) => x.id === id)) return fail("Report not found.");
      set((s) => ({ reports: s.reports.map((x) => (x.id === id ? { ...x, status } : x)) }));
      audit("report.status", "report", id, { status });
      return ok(undefined);
    },
    moderateReview(id, status) {
      const r = requireStaff(["admin", "support"], "reports.moderate", "You don't have permission to moderate reviews.");
      if (!r.ok) return r;
      const rev = findReview(id);
      if (!rev) return fail("Review not found.");
      upsertReview({ ...rev, status });
      audit("review.moderate", "review", id, { status });
      return ok(undefined);
    },
    setFlag(key, patch) {
      const r = requireStaff(["admin"], "flags.manage", "You don't have permission to manage feature flags.");
      if (!r.ok) return r;
      if (patch.rolloutPercent !== undefined && (!Number.isInteger(patch.rolloutPercent) || patch.rolloutPercent < 0 || patch.rolloutPercent > 100)) return fail("Rollout must be 0–100%.");
      if (!get().flags.some((f) => f.key === key)) return fail("Flag not found.");
      set((s) => ({ flags: s.flags.map((f) => (f.key === key ? { ...f, ...definedOnly(patch) } : f)) }));
      audit("flag.update", "flag", key, patch as AuditLog["meta"]);
      return ok(undefined);
    },
    updatePolicy(patch) {
      const r = requireStaff(["admin"], "settings.manage", "You don't have permission to change platform settings.");
      if (!r.ok) return r;
      if (Object.values(patch).some((v) => typeof v !== "number" || v < 0 || !Number.isFinite(v))) return fail("Enter non-negative numbers.");
      if ((patch.lateCancellationRefundPercent ?? 0) > 100 || (patch.studentNoShowRefundPercent ?? 0) > 100 || (patch.tutorNoShowRefundPercent ?? 0) > 100) return fail("Refund percentages can't exceed 100%.");
      set((s) => ({ policy: { ...s.policy, ...definedOnly(patch) } }));
      audit("policy.update", "settings", "booking_policy", patch as AuditLog["meta"]);
      return ok(undefined);
    },
    setPlatformFee(bps) {
      const r = requireStaff(["admin"], "settings.manage", "You don't have permission to change platform settings.");
      if (!r.ok) return r;
      if (!Number.isInteger(bps) || bps < 0 || bps > 3000) return fail("Platform fee must be between 0% and 30%.");
      set({ platformFeeBps: bps });
      audit("settings.platform_fee", "settings", "platform_fee", { bps });
      return ok(undefined);
    },
    saveSubjectArea(input) {
      const r = requireCatalogEditor();
      if (!r.ok) return r;
      const name = input.name.trim().replace(/\s+/g, " ");
      const description = input.description.trim();
      if (name.length < 2 || name.length > 60) return fail("Give the subject a name of 2–60 characters.");
      if (description.length > 200) return fail("Keep the description under 200 characters.");
      const { categories } = get().catalog;
      if (categories.some((c) => c.slug !== input.slug && c.name.toLowerCase() === name.toLowerCase())) return fail("A subject with that name already exists.");
      if (input.slug) {
        const existing = categories.find((c) => c.slug === input.slug);
        if (!existing) return fail("That subject no longer exists.");
        const updated: SubjectCategory = { ...existing, name, description, hidden: !!input.hidden };
        set((st) => ({ catalog: { ...st.catalog, categories: st.catalog.categories.map((c) => (c.slug === updated.slug ? updated : c)) } }));
        audit("catalog.area.update", "subject_area", updated.slug, { name, hidden: !!input.hidden });
        return ok(updated);
      }
      const slug = uniqueSlug(slugify(name), categories.map((c) => c.slug));
      if (!slug) return fail("Use letters or numbers in the name.");
      const created: SubjectCategory = { slug, name, description, hidden: !!input.hidden };
      set((st) => ({ catalog: { ...st.catalog, categories: [...st.catalog.categories, created] } }));
      audit("catalog.area.create", "subject_area", slug, { name });
      return ok(created);
    },
    deleteSubjectArea(slug) {
      const r = requireCatalogEditor();
      if (!r.ok) return r;
      const area = get().catalog.categories.find((c) => c.slug === slug);
      if (!area) return fail("That subject no longer exists.");
      const inside = get().catalog.subjects.filter((x) => x.category === slug).length;
      if (inside > 0) return fail(`Move or delete the ${inside} ${inside === 1 ? "sub-category" : "sub-categories"} in ${area.name} first, or hide it instead.`);
      set((st) => ({ catalog: { ...st.catalog, categories: st.catalog.categories.filter((c) => c.slug !== slug) } }));
      audit("catalog.area.delete", "subject_area", slug, { name: area.name });
      return ok(undefined);
    },
    saveSubject(input) {
      const r = requireCatalogEditor();
      if (!r.ok) return r;
      const name = input.name.trim().replace(/\s+/g, " ");
      const summary = input.summary.trim();
      if (name.length < 2 || name.length > 60) return fail("Give the sub-category a name of 2–60 characters.");
      if (summary.length > 200) return fail("Keep the summary under 200 characters.");
      const { categories, subjects } = get().catalog;
      if (!categories.some((c) => c.slug === input.category)) return fail("Choose the subject it belongs to.");
      if (subjects.some((x) => x.slug !== input.slug && x.name.toLowerCase() === name.toLowerCase())) return fail("A sub-category with that name already exists.");
      if (input.slug) {
        const existing = subjects.find((x) => x.slug === input.slug);
        if (!existing) return fail("That sub-category no longer exists.");
        const updated: Subject = { ...existing, name, summary, category: input.category, popular: !!input.popular, hidden: !!input.hidden };
        set((st) => ({ catalog: { ...st.catalog, subjects: st.catalog.subjects.map((x) => (x.slug === updated.slug ? updated : x)) } }));
        audit("catalog.subject.update", "subject", updated.slug, { name, category: input.category, hidden: !!input.hidden, popular: !!input.popular });
        return ok(updated);
      }
      const slug = uniqueSlug(slugify(name), subjects.map((x) => x.slug));
      if (!slug) return fail("Use letters or numbers in the name.");
      const created: Subject = { slug, name, category: input.category, summary, popular: !!input.popular, hidden: !!input.hidden };
      set((st) => ({ catalog: { ...st.catalog, subjects: [...st.catalog.subjects, created] } }));
      audit("catalog.subject.create", "subject", slug, { name, category: input.category });
      return ok(created);
    },
    deleteSubject(slug) {
      const r = requireCatalogEditor();
      if (!r.ok) return r;
      const subject = get().catalog.subjects.find((x) => x.slug === slug);
      if (!subject) return fail("That sub-category no longer exists.");
      const st = get();
      const tutors = st.registeredTutors.filter((t) => resolveTutor(st, t.id)?.subjects.includes(slug)).length;
      const records = st.requirements.filter((q) => q.subject === slug).length + st.bookings.filter((b) => b.subject === slug).length;
      if (tutors + records > 0) {
        const parts = [tutors && `${tutors} ${tutors === 1 ? "tutor teaches" : "tutors teach"} it`, records && `${records} ${records === 1 ? "booking or request uses" : "bookings and requests use"} it`].filter(Boolean);
        return fail(`${parts.join(" and ")}. Hide it instead so those records keep its name.`);
      }
      set((x) => ({ catalog: { ...x.catalog, subjects: x.catalog.subjects.filter((y) => y.slug !== slug) } }));
      audit("catalog.subject.delete", "subject", slug, { name: subject.name });
      return ok(undefined);
    },
    moveCatalogItem(kind, slug, direction) {
      const r = requireCatalogEditor();
      if (!r.ok) return r;
      const { categories, subjects } = get().catalog;
      if (kind === "area") {
        const next = swapBy(categories, (x) => x.slug, slug, direction);
        if (!next) return fail("It's already at the edge.");
        set((st) => ({ catalog: { ...st.catalog, categories: next } }));
      } else {
        const area = subjects.find((x) => x.slug === slug)?.category;
        const next = swapBy(subjects, (x) => x.slug, slug, direction, (x) => x.category === area);
        if (!next) return fail("It's already at the edge.");
        set((st) => ({ catalog: { ...st.catalog, subjects: next } }));
      }
      audit("catalog.reorder", kind === "area" ? "subject_area" : "subject", slug, { direction });
      return ok(undefined);
    },
    loadStarterCatalog() {
      const r = requireCatalogEditor();
      if (!r.ok) return r;
      const res = withStarter(get().catalog);
      if (!res.areas && !res.subjects) return fail("Everything in the starter list is already here.");
      set({ catalog: res.catalog });
      audit("catalog.starter_loaded", "catalog", "starter", { areas: res.areas, subjects: res.subjects });
      return ok({ areas: res.areas, subjects: res.subjects });
    },
    saveCoupon(input) {
      const r = requireStaff(["admin"], "settings.manage", "You don't have permission to manage coupons.");
      if (!r.ok) return r;
      const code = input.code.trim().toUpperCase();
      if (!/^[A-Z0-9]{4,16}$/.test(code)) return fail("Codes are 4–16 letters or numbers.");
      if (get().coupons.some((c) => c.code === code && c.id !== input.id)) return fail("That code already exists.");
      if (input.kind === "percent" && (input.value <= 0 || input.value > 100)) return fail("Percent discounts must be 1–100.");
      if (input.kind === "fixed" && (input.value <= 0 || !Number.isInteger(input.value))) return fail("Enter a fixed discount in cents.");
      if (Number.isNaN(new Date(input.expiresAt).getTime())) return fail("Choose an expiry date.");
      const existing = input.id ? get().coupons.find((c) => c.id === input.id) : undefined;
      if (input.id && !existing) return fail("Coupon not found.");
      const coupon: Coupon = { ...input, code, id: existing?.id ?? uid("cpn"), redemptions: existing?.redemptions ?? 0 };
      set((s) => ({ coupons: existing ? s.coupons.map((c) => (c.id === coupon.id ? coupon : c)) : [coupon, ...s.coupons] }));
      audit(existing ? "coupon.update" : "coupon.create", "coupon", coupon.id, { code });
      return ok(coupon);
    },
    logConversationAccess(conversationId, reason) {
      const r = requireStaff(["admin", "support"], "conversations.read_flagged", "You don't have permission to read private conversations.");
      if (!r.ok) return r;
      if (reason.trim().length < 5) return fail("A reason is required to access a private conversation.");
      if (!get().conversations.some((c) => c.id === conversationId)) return fail("Conversation not found.");
      audit("conversation.access", "conversation", conversationId, { reason: reason.trim() });
      // The messages are released only now that the access is on record.
      return ok(get().messages.filter((m) => m.conversationId === conversationId));
    },

    /* ─── Chat safety (staff) ──────────────────────────────── */
    warnChatUser(userId, note) {
      const r = requireStaff(["admin", "support"], "reports.moderate", "You don't have permission to moderate chat.");
      if (!r.ok) return r;
      const target = get().users.find((u) => u.id === userId);
      if (!target) return fail("Account not found.");
      if (target.role === "admin" || target.role === "support") return fail("Staff accounts can't be warned here.");
      if (note.trim().length < 10) return fail("Write the warning the person will see (at least 10 characters).");
      const at = nowIso();
      const chatModeration = { ...target.chatModeration, warnings: (target.chatModeration?.warnings ?? 0) + 1, lastWarnedAt: at };
      set((s) => ({
        users: s.users.map((u) => (u.id === userId ? { ...u, chatModeration } : u)),
        contactFlags: s.contactFlags.map((f) => (f.userId === userId && f.status === "open" ? { ...f, status: "actioned" as const, reviewedBy: r.data.id, reviewedAt: at } : f)),
      }));
      notify(userId, { type: "security", title: "A warning from TutorLink Trust & Safety", body: note.trim().slice(0, 500), href: "/dashboard/messages" });
      audit("chat.warn", "user", userId, { reason: note.trim(), warnings: chatModeration.warnings });
      return ok(undefined);
    },
    restrictChat(userId, hours, reason) {
      const r = requireStaff(["admin", "support"], "reports.moderate", "You don't have permission to moderate chat.");
      if (!r.ok) return r;
      const target = get().users.find((u) => u.id === userId);
      if (!target) return fail("Account not found.");
      if (userId === r.data.id) return fail("You can't change your own messaging.");
      if (target.role === "admin" || target.role === "support") return fail("Staff accounts can't be paused here.");
      if (![0, 24, 72, 168, 720].includes(hours)) return fail("Choose how long to pause messaging.");
      if (reason.trim().length < 5) return fail("Add a reason for the audit log.");
      const at = nowIso();
      const warned = { warnings: target.chatModeration?.warnings ?? 0, ...(target.chatModeration?.lastWarnedAt ? { lastWarnedAt: target.chatModeration.lastWarnedAt } : {}) };
      const until = hours ? new Date(Date.now() + hours * 3_600_000).toISOString() : undefined;
      const chatModeration = until ? { ...warned, restrictedUntil: until, restrictionReason: reason.trim().slice(0, 300), restrictedBy: r.data.id } : warned;
      set((s) => ({
        users: s.users.map((u) => (u.id === userId ? { ...u, chatModeration } : u)),
        contactFlags: until ? s.contactFlags.map((f) => (f.userId === userId && f.status === "open" ? { ...f, status: "actioned" as const, reviewedBy: r.data.id, reviewedAt: at } : f)) : s.contactFlags,
      }));
      if (until) notify(userId, { type: "security", title: `Messaging paused until ${formatDateTime(until, target.timezone)}`, body: reason.trim().slice(0, 300), href: "/dashboard/messages" });
      else notify(userId, { type: "security", title: "Messaging is available again", body: "You can send messages on TutorLink again.", href: "/dashboard/messages" });
      audit(until ? "chat.restrict" : "chat.unrestrict", "user", userId, { reason: reason.trim(), ...(hours ? { hours } : {}) });
      return ok(undefined);
    },
    setContactFlagStatus(ids, status) {
      const r = requireStaff(["admin", "support"], "reports.moderate", "You don't have permission to moderate chat.");
      if (!r.ok) return r;
      const wanted = new Set(ids);
      const found = get().contactFlags.filter((f) => wanted.has(f.id));
      if (!found.length) return fail("Nothing to update. Those entries no longer exist.");
      const at = nowIso();
      set((s) => ({
        contactFlags: s.contactFlags.map((f) => {
          if (!wanted.has(f.id)) return f;
          return status === "open" ? { ...f, status, reviewedBy: undefined, reviewedAt: undefined } : { ...f, status, reviewedBy: r.data.id, reviewedAt: at };
        }),
      }));
      audit("contact_flag.status", "user", found[0].userId, { status, count: found.length });
      return ok(undefined);
    },
    declineChatUnlock(userId) {
      const r = requireStaff(["admin", "support"], "reports.moderate", "You don't have permission to moderate chat.");
      if (!r.ok) return r;
      const target = get().users.find((u) => u.id === userId);
      if (!target) return fail("Account not found.");
      const until = pausedUntil(target);
      if (!until || !target.chatModeration?.unlockRequestedAt) return fail("There's no request to answer. The pause may have ended already.");
      const chatModeration = { ...target.chatModeration, unlockRequestedAt: undefined, unlockRequestNote: undefined, unlockDeclinedAt: nowIso() };
      set((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, chatModeration } : u)) }));
      notify(userId, { type: "security", title: "Your messaging stays paused", body: `Our team reviewed your request. You can send messages again after ${formatDateTime(until, target.timezone)}.`, href: "/dashboard/messages" });
      audit("chat.unlock_declined", "user", userId);
      return ok(undefined);
    },

    /* ─── Accounts & moderation (staff) ────────────────────── */
    setStaffAccess(userId, role, permissions) {
      const r = requireStaff(["admin"], "users.write", "Only an administrator with users.write can change staff access.");
      if (!r.ok) return r;
      if (userId === r.data.id) return fail("You can't change your own staff access. Ask another administrator.");
      const target = get().users.find((u) => u.id === userId);
      if (!target) return fail("Account not found.");
      if (role !== "none" && target.tutorId) return fail("This account has a tutor profile. Staff need a separate account.");
      if (role !== "none" && target.status !== "active") return fail("Reactivate the account before giving it staff access.");
      const perms = role === "none" ? [] : [...new Set(permissions)].filter((p): p is Permission => ALL_PERMISSIONS.includes(p));
      if (role !== "none" && !perms.length) return fail("Choose at least one permission.");
      // Never leave the platform without an administrator who can manage staff.
      const managers = get().users.filter((u) => u.role === "admin" && u.status === "active" && u.permissions?.includes("users.write"));
      const losesManager = target.role === "admin" && target.permissions?.includes("users.write") && !(role === "admin" && perms.includes("users.write"));
      if (losesManager && managers.filter((u) => u.id !== target.id).length === 0) return fail("At least one administrator must keep the users.write permission.");
      const nextRole: Role = role === "none" ? (target.role === "admin" || target.role === "support" ? "student" : target.role) : role;
      set((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, role: nextRole, permissions: perms } : u)) }));
      audit("user.staff_access", "user", userId, { role: nextRole, permissions: perms.join(",") });
      notify(userId, {
        type: "security",
        title: role === "none" ? "Your staff access was removed" : `You now have ${role === "admin" ? "administrator" : "support"} access`,
        body: role === "none" ? "Your account is a regular account again." : "Sign out and back in, then open the admin panel. Turn on two-step login in Security.",
        href: role === "none" ? "/dashboard" : "/admin/security",
      });
      return ok(undefined);
    },
    updateUserDetails(userId, patch) {
      const r = requireStaff(["admin", "support"], "users.write", "You don't have permission to edit accounts.");
      if (!r.ok) return r;
      const target = get().users.find((u) => u.id === userId);
      if (!target) return fail("Account not found.");
      if ((target.role === "admin" || target.role === "support") && r.data.role !== "admin") return fail("Only an administrator can edit a staff account.");
      const clean = definedOnly({ ...patch, firstName: patch.firstName?.trim(), lastName: patch.lastName?.trim() });
      if (clean.firstName !== undefined && !clean.firstName) return fail("Enter a first name.");
      if (clean.lastName !== undefined && !clean.lastName) return fail("Enter a last name.");
      const badPlace = placeProblem(clean, target);
      if (badPlace) return fail(badPlace);
      set((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, ...clean } : u)) }));
      audit("user.update", "user", userId, { fields: Object.keys(clean).join(",") });
      return ok(undefined);
    },
    deleteAccount(userId, reason) {
      const r = requireStaff(["admin"], "users.write", "Only an administrator with users.write can delete accounts.");
      if (!r.ok) return r;
      if (userId === r.data.id) return fail("You can't delete your own account here.");
      if (reason.trim().length < 5) return fail("Add a reason for the audit log.");
      const target = get().users.find((u) => u.id === userId);
      if (!target) return fail("Account not found.");
      const problem = removalProblem(target, false);
      if (problem) return fail(problem);
      removeAccount(target);
      audit("user.delete", "user", userId, { reason: reason.trim(), email: target.email });
      return ok(undefined);
    },
    setTutorListing(tutorId, patch, reason) {
      const r = requireStaff(["admin", "support"], "users.write", "You don't have permission to change tutor listings.");
      if (!r.ok) return r;
      const t = resolveTutor(get(), tutorId);
      if (!t) return fail("Tutor not found.");
      if (patch.hidden === true && reason.trim().length < 5) return fail("Explain why the profile is hidden — the tutor will see it.");
      if (patch.featured === true && t.hidden && patch.hidden !== false) return fail("Show the profile again before featuring it.");
      const next: Partial<Tutor> = definedOnly({ featured: patch.featured, hidden: patch.hidden });
      if (patch.hidden === true) next.featured = false;
      patchTutor(tutorId, next);
      audit("tutor.listing", "tutor", tutorId, { ...(next as Record<string, boolean>), reason: reason.trim() || null });
      if (patch.hidden !== undefined && patch.hidden !== !!t.hidden) {
        notify(tutorUserId(tutorId), patch.hidden
          ? { type: "verification", title: "Your profile is hidden from search", body: `Our team hid your profile: “${reason.trim()}”. Contact support to resolve it.`, href: "/dashboard/profile" }
          : { type: "verification", title: "Your profile is visible again", body: "Families can find and book you again.", href: "/dashboard/profile" });
      }
      return ok(undefined);
    },
    takeDownRequirement(id, reason) {
      const r = requireStaff(["admin", "support"], "reports.moderate", "You don't have permission to moderate job posts.");
      if (!r.ok) return r;
      if (reason.trim().length < 10) return fail("Explain why the post is taken down (10+ characters) — the family will see it.");
      const req = get().requirements.find((q) => q.id === id);
      if (!req) return fail("Job post not found.");
      if (req.status === "closed" || req.status === "draft") return fail("This post isn't live.");
      const at = nowIso();
      const open = get().applications.filter((a) => a.requirementId === id && !["hired", "rejected", "withdrawn", "closed"].includes(a.status));
      set((s) => ({
        requirements: s.requirements.map((q) => (q.id === id ? { ...q, status: "closed" as const, updatedAt: at } : q)),
        applications: s.applications.map((a) => (open.some((o) => o.id === a.id) ? { ...a, status: "closed" as const, updatedAt: at } : a)),
      }));
      for (const a of open) notify(tutorUserId(a.tutorId), { type: "application", title: "A job you applied to was closed", body: `“${req.title}” is no longer taking applications.`, href: "/dashboard/applications" });
      audit("requirement.takedown", "requirement", id, { reason: reason.trim() });
      notify(req.ownerId, { type: "security", title: "Your job post was taken down", body: `“${req.title}” was closed by our team: ${reason.trim()}`, href: `/dashboard/requirements/${id}` });
      return ok(undefined);
    },
    sendAnnouncement(audience, title, body, href) {
      const r = requireStaff(["admin"], "content.manage", "You don't have permission to send announcements.");
      if (!r.ok) return r;
      if (title.trim().length < 3 || title.trim().length > 120) return fail("Write a title of 3–120 characters.");
      if (body.trim().length < 10 || body.trim().length > 600) return fail("Write a message of 10–600 characters.");
      if (href && !href.startsWith("/")) return fail("Links must point to a page on this site, e.g. /tutors.");
      const roles: Role[] = audience === "students" ? ["student"] : audience === "parents" ? ["parent"] : audience === "tutors" ? ["tutor"] : ["student", "parent", "tutor"];
      const people = get().users.filter((u) => roles.includes(u.role) && u.status === "active");
      for (const u of people) notify(u.id, { type: "announcement", title: title.trim(), body: body.trim(), ...(href ? { href } : {}) });
      audit("announcement.send", "announcement", audience, { title: title.trim(), recipients: people.length });
      return ok(people.length);
    },

    /* ─── Website content ──────────────────────────────────── */
    saveBlogPost(input) {
      const r = requireContentEditor();
      if (!r.ok) return r;
      const title = input.title.trim().replace(/\s+/g, " ");
      if (title.length < 4 || title.length > 140) return fail("Give the post a title of 4–140 characters.");
      if (input.excerpt.trim().length > 400) return fail("Keep the summary under 400 characters.");
      if (!input.author.trim()) return fail("Add the author.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return fail("Choose the publish date.");
      const body = input.body.map((b) => ({ ...(b.h?.trim() ? { h: b.h.trim() } : {}), p: b.p.trim() })).filter((b) => b.p || b.h);
      if (!body.length) return fail("Write the post before saving it.");
      const words = body.reduce((n, b) => n + `${b.h ?? ""} ${b.p}`.split(/\s+/).filter(Boolean).length, 0);
      const existing = input.slug ? get().blogPosts.find((p) => p.slug === input.slug) : undefined;
      if (input.slug && !existing) return fail("That post no longer exists.");
      const slug = existing?.slug ?? uniqueSlug(slugify(title), get().blogPosts.map((p) => p.slug));
      if (!slug) return fail("Use letters or numbers in the title.");
      const post: BlogPostItem = { ...input, slug, title, excerpt: input.excerpt.trim(), author: input.author.trim(), body, readMinutes: Math.max(1, Math.round(words / 220)) };
      set((s) => ({ blogPosts: existing ? s.blogPosts.map((p) => (p.slug === slug ? post : p)) : [post, ...s.blogPosts] }));
      audit(existing ? "content.blog.update" : "content.blog.create", "blog_post", slug, { status: post.status });
      return ok(post);
    },
    deleteBlogPost(slug) {
      const r = requireContentEditor();
      if (!r.ok) return r;
      if (!get().blogPosts.some((p) => p.slug === slug)) return fail("That post no longer exists.");
      set((s) => ({ blogPosts: s.blogPosts.filter((p) => p.slug !== slug) }));
      audit("content.blog.delete", "blog_post", slug);
      return ok(undefined);
    },
    saveFaq(input) {
      const r = requireContentEditor();
      if (!r.ok) return r;
      const q = input.q.trim();
      const a = input.a.trim();
      if (q.length < 5 || q.length > 200) return fail("Write a question of 5–200 characters.");
      if (a.length < 5 || a.length > 2000) return fail("Write an answer of 5–2,000 characters.");
      const existing = input.id ? get().faqs.find((f) => f.id === input.id) : undefined;
      if (input.id && !existing) return fail("That question no longer exists.");
      const faq: FaqItem = { id: existing?.id ?? uid("faq"), audience: input.audience, q, a, published: input.published };
      set((s) => ({ faqs: existing ? s.faqs.map((f) => (f.id === faq.id ? faq : f)) : [...s.faqs, faq] }));
      audit(existing ? "content.faq.update" : "content.faq.create", "faq", faq.id);
      return ok(faq);
    },
    deleteFaq(id) {
      const r = requireContentEditor();
      if (!r.ok) return r;
      if (!get().faqs.some((f) => f.id === id)) return fail("That question no longer exists.");
      set((s) => ({ faqs: s.faqs.filter((f) => f.id !== id) }));
      audit("content.faq.delete", "faq", id);
      return ok(undefined);
    },
    moveFaq(id, direction) {
      const r = requireContentEditor();
      if (!r.ok) return r;
      const audience = get().faqs.find((f) => f.id === id)?.audience;
      const next = swapBy(get().faqs, (f) => f.id, id, direction, (f) => f.audience === audience);
      if (!next) return fail("It's already at the edge.");
      set({ faqs: next });
      return ok(undefined);
    },
    saveTestimonial(input) {
      const r = requireContentEditor();
      if (!r.ok) return r;
      const quote = input.quote.trim();
      const name = input.name.trim();
      if (quote.length < 20 || quote.length > 400) return fail("Write a quote of 20–400 characters.");
      if (name.length < 2 || name.length > 80) return fail("Add who said it (2–80 characters), e.g. \"Parent of a 7th grader\".");
      if (input.published && !input.consentConfirmed) return fail("Confirm you have this customer's permission before publishing their story.");
      if (input.used.href && !input.used.href.startsWith("/")) return fail("Links must point to a page on this site, e.g. /tutors.");
      const existing = input.id ? get().testimonials.find((t) => t.id === input.id) : undefined;
      if (input.id && !existing) return fail("That story no longer exists.");
      const item: TestimonialItem = { ...input, id: existing?.id ?? uid("tst"), quote, name, context: input.context.trim(), used: { label: input.used.label.trim(), href: input.used.href.trim() } };
      set((s) => ({ testimonials: existing ? s.testimonials.map((t) => (t.id === item.id ? item : t)) : [...s.testimonials, item] }));
      audit(existing ? "content.testimonial.update" : "content.testimonial.create", "testimonial", item.id, { published: item.published });
      return ok(item);
    },
    deleteTestimonial(id) {
      const r = requireContentEditor();
      if (!r.ok) return r;
      if (!get().testimonials.some((t) => t.id === id)) return fail("That story no longer exists.");
      set((s) => ({ testimonials: s.testimonials.filter((t) => t.id !== id) }));
      audit("content.testimonial.delete", "testimonial", id);
      return ok(undefined);
    },

    /* ─── Background jobs ──────────────────────────────────── */
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
      const reminders = sendLessonReminders(now);
      if (!expired.length && !completed.length) return ok(reminders);
      const at = nowIso();
      const expiredIds = new Set(expired.map((b) => b.id));
      const completedIds = new Set(completed.map((b) => b.id));
      set((s) => ({
        bookings: s.bookings.map((b) =>
          expiredIds.has(b.id)
            ? { ...b, status: "cancelled_by_tutor" as const, paymentStatus: b.paymentStatus === "paid" || b.paymentStatus === "authorized" ? ("refunded" as const) : b.paymentStatus, history: [...b.history, { at, by: "system" as const, from: b.status, to: "cancelled_by_tutor" as const, note: "Request expired — the tutor didn't respond before the lesson time. Authorization released." }] }
            : completedIds.has(b.id)
              ? { ...b, status: "completed" as const, history: [...b.history, { at, by: "system" as const, from: b.status, to: "completed" as const, note: "Completed automatically — no issue was reported within 24 hours" }] }
              : b,
        ),
        payments: s.payments.map((p) => (p.bookingId && expiredIds.has(p.bookingId) && p.status === "pending" ? { ...p, status: "refunded" as const, description: `${p.description} — authorization released` } : p)),
      }));
      for (const b of expired) refundToWallet(b.id, b.bookerId, b.priceCents - b.discountCents, "Request expired — credits returned");
      for (const b of expired) notify(b.bookerId, { type: "booking_cancelled", title: "Lesson request expired", body: `${subjectName(b.subject)} · ${formatDateTime(b.startUtc, tzOf(b.bookerId))} — you weren't charged.`, href: `/dashboard/bookings/${b.id}` });
      for (const b of completed) notify(b.bookerId, { type: "review_request", title: "How was your lesson?", body: `${subjectName(b.subject)} · ${formatDateTime(b.startUtc, tzOf(b.bookerId))}`, href: `/dashboard/bookings/${b.id}` });
      return ok(expired.length + completed.length + reminders);
    },
  };
  return actions;
}

export type ActionName = keyof DomainActions;
