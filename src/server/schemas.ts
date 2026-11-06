import "server-only";
import { z } from "zod";
import type { ActionName } from "@/lib/domain/actions";
import { ALL_PERMISSIONS } from "@/lib/data/users";
import { isCountryCode } from "@/lib/location";

/*
 * Shape checks for the arguments of every action the browser may call. They run before the domain
 * rules, so an action always receives the types it was written for; unknown object keys are dropped
 * (an object can never smuggle in fields such as `status` or `ownerId`). Business rules — ownership,
 * prices, states — are still checked by the action itself.
 */

const id = z.string().min(1).max(120);
const text = (max: number) => z.string().max(max);
/** An ISO 3166-1 country code from the site's list ("US", "IN"). */
const COUNTRY = z.string().refine((v) => isCountryCode(v), "Unknown country.");
const int = (min: number, max: number) => z.number().int().min(min).max(max);
const strings = (maxItems: number, maxLen = 120) => z.array(text(maxLen)).max(maxItems);
const iso = z.string().max(40).refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/);
const file = z.object({ name: text(200), sizeKb: z.number().min(0).max(1_000_000), path: text(500).optional() });
const zone = z.string().max(60).refine((tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "Unknown time zone");

const GRADE = z.enum(["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "college", "adult"]);
const LEVEL = z.enum(["elementary", "middle", "high", "college", "adult"]);
const MODE = z.enum(["online", "in_person"]);
const TUTOR_CATEGORY = z.enum(["certified_teacher", "subject_expert", "graduate_student", "test_prep_specialist", "learning_specialist"]);
const DAY_NAME = z.enum(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
const TIME_OF_DAY = z.enum(["morning", "afternoon", "evening"]);
const PAY_METHOD = z.enum(["card", "upi", "wallet"]);
const BOOKING_STATUS = z.enum([
  "pending", "confirmed", "in_progress", "completed", "cancelled_by_student", "cancelled_by_tutor", "rescheduled", "no_show_student", "no_show_tutor",
  "payment_failed", "disputed", "refunded",
]);
const APPLICATION_STATUS = z.enum(["applied", "viewed", "shortlisted", "contacted", "trial_requested", "hired", "rejected", "withdrawn", "closed"]);
const year = int(1950, 2100);

const education = z.array(z.object({ degree: text(80), field: text(80), institution: text(120), year, verified: z.boolean().optional().default(false) })).max(6);
const certifications = z.array(z.object({ name: text(120), issuer: text(120), year, verified: z.boolean().optional().default(false) })).max(6);

const studentProfilePatch = z.object({
  age: int(0, 120).optional(),
  gender: z.enum(["female", "male", "non_binary", "prefer_not"]).optional(),
  photoUrl: text(1_600_000).optional(),
  grade: GRADE.optional(),
  subjects: strings(10).optional(),
  goals: strings(12, 200).optional(),
  details: text(1000).optional(),
  learningSupport: strings(10).optional(),
  modes: z.array(MODE).max(2).optional(),
  travelMiles: z.number().min(0).max(200).optional(),
  tutorGender: z.enum(["any", "female", "male"]).optional(),
  tutorLanguages: strings(12, 40).optional(),
  tutorCategories: z.array(TUTOR_CATEGORY).max(5).optional(),
  minExperienceYears: int(0, 60).optional(),
  days: z.array(DAY_NAME).max(7).optional(),
  timesOfDay: z.array(TIME_OF_DAY).max(3).optional(),
  sessionsPerWeek: int(0, 14).optional(),
  lessonMinutes: int(0, 240).optional(),
  startWhen: z.enum(["asap", "this_month", "exploring"]).optional(),
  budgetMinCents: int(0, 1_000_000).optional(),
  budgetMaxCents: int(0, 1_000_000).optional(),
  payer: z.enum(["self", "parent"]).optional(),
  payMethod: PAY_METHOD.optional(),
});

const requirementDraft = z.object({
  id: id.optional(),
  childId: id.optional(),
  title: text(140).optional(),
  subject: text(80).optional(),
  grade: GRADE.optional(),
  objectives: text(3000).optional(),
  modes: z.array(MODE).max(2).optional(),
  country: COUNTRY.optional(),
  city: text(60).optional(),
  state: text(60).optional(),
  zip: text(10).optional(),
  days: z.array(DAY_NAME).max(7).optional(),
  timesOfDay: z.array(TIME_OF_DAY).max(3).optional(),
  sessionsPerWeek: int(1, 14).optional(),
  budgetMinCents: int(0, 100_000).optional(),
  budgetMaxCents: int(0, 100_000).optional(),
  minExperienceYears: int(0, 60).optional(),
  languages: strings(10, 40).optional(),
  preferences: text(2000).optional(),
  details: text(4000).optional(),
  attachments: z.array(file).max(10).optional(),
  learningSupport: strings(10).optional(),
  draftStep: int(0, 20).optional(),
});

const tutorPatch = z.object({
  headline: text(120).optional(),
  bio: text(5000).optional(),
  approach: text(5000).optional(),
  hourlyRateCents: int(0, 1_000_000).optional(),
  modes: z.array(MODE).max(2).optional(),
  subjects: strings(10).optional(),
  specialties: strings(8, 40).optional(),
  levels: z.array(LEVEL).max(5).optional(),
  languages: strings(12, 40).optional(),
  serviceRadiusMiles: int(0, 100).optional(),
  learningSupport: strings(10).optional(),
  photoUrl: text(2_000_000).optional(),
  introVideoUrl: text(1000).optional(),
  experienceYears: int(0, 100).optional(),
  category: TUTOR_CATEGORY.optional(),
  education: education.optional(),
  certifications: certifications.optional(),
});

const policyPatch = z.object(
  Object.fromEntries(
    [
      "freeCancellationHours", "lateCancellationRefundPercent", "trialFreeCancellationHours", "rescheduleMinHours", "maxReschedulesPerBooking",
      "studentNoShowRefundPercent", "tutorNoShowRefundPercent", "tutorNoShowCreditCents", "disputeWindowDays", "noShowGraceMinutes",
      "meetingLinkVisibleMinutesBefore",
    ].map((k) => [k, z.number().min(0).max(1_000_000).optional()]),
  ),
);

const t = (...items: z.ZodTypeAny[]) => z.tuple(items as [z.ZodTypeAny, ...z.ZodTypeAny[]]);
const none = z.tuple([]);

/** Actions the browser may call through POST /api/actions, with their argument shapes. */
export const ACTION_ARGS: Partial<Record<ActionName, z.ZodTypeAny>> = {
  updateMe: t(z.object({ firstName: text(60).optional(), lastName: text(60).optional(), phone: text(30).optional(), country: COUNTRY.optional(), city: text(60).optional(), state: text(60).optional(), zip: text(10).optional(), timezone: zone.optional() })),
  saveStudentProfile: t(studentProfilePatch, z.object({ step: int(0, 10).optional(), complete: z.boolean().optional() }).optional()),
  deleteMyAccount: none,

  toggleFavorite: t(id),
  saveSearch: t(z.object({ kind: z.enum(["tutors", "jobs"]), label: text(80), query: z.record(text(500)).refine((q) => Object.keys(q).length <= 30), frequency: z.enum(["instant", "daily", "weekly", "off"]) })),
  updateSavedSearch: t(id, z.object({ label: text(80).optional(), frequency: z.enum(["instant", "daily", "weekly", "off"]).optional() })),
  deleteSavedSearch: t(id),
  toggleSavedJob: t(id),

  saveRequirementDraft: t(requirementDraft),
  publishRequirement: t(id),
  setRequirementStatus: t(id, z.enum(["draft", "published", "paused", "closed"])),
  deleteRequirement: t(id),

  applyToJob: t(id, text(3000), int(0, 1_000_000)),
  setApplicationStatus: t(id, APPLICATION_STATUS),

  createBooking: t(z.object({
    tutorId: id, startUtc: iso, durationMin: int(15, 240), type: z.enum(["trial", "regular"]), mode: MODE, subject: text(80),
    childId: id.optional(), notes: text(1000).optional(), couponCode: text(20).optional(), payWith: PAY_METHOD.optional(), idempotencyKey: text(100).min(8),
  })),
  transitionBooking: t(id, BOOKING_STATUS, text(500).optional()),
  rescheduleBooking: t(id, iso),
  setLessonVideo: t(id, z.object({ link: text(500), passcode: text(20).optional(), applyToUpcoming: z.boolean().optional() })),
  removeLessonVideo: t(id),
  setLessonRecording: t(id, text(500)),
  validateCoupon: t(text(20), int(0, 10_000_000)),
  topUpWallet: t(text(20), z.enum(["card", "upi"])),
  submitReview: t(id, int(1, 5), text(3000)),
  respondToReview: t(id, text(2000)),

  startConversation: t(id, z.object({ childId: id.optional(), subject: text(80).optional() }).optional()),
  contactLearner: t(z.object({ bookingId: id.optional(), requirementId: id.optional() })),
  sendMessage: t(id, text(4000), file.optional()),
  markConversationRead: t(id),
  toggleBlock: t(id),
  warnChatUser: t(id, text(500)),
  requestChatUnlock: t(text(500)),
  declineChatUnlock: t(id),
  restrictChat: t(id, z.union([z.literal(0), z.literal(24), z.literal(72), z.literal(168), z.literal(720)]), text(500)),
  setContactFlagStatus: t(z.array(id).min(1).max(200), z.enum(["open", "actioned", "dismissed"])),
  report: t(z.object({ targetType: z.enum(["user", "tutor", "message", "review", "requirement"]), targetId: id, reason: text(100), details: text(2000) })),

  markNotificationRead: t(id),
  markAllNotificationsRead: none,
  setNotificationPref: t(z.enum(["messages", "bookings", "reminders", "payments", "jobs", "progress", "marketing"]), z.enum(["in_app", "email", "sms"]), z.boolean()),

  saveChild: t(z.object({ id: id.optional(), firstName: text(60), grade: GRADE, birthYear: year.optional(), learningGoals: strings(10, 200), notes: text(1000).optional(), subjects: strings(10) })),
  removeChild: t(id),

  addProgressNote: t(id, text(4000), int(1, 5).optional(), id.optional()),
  assignHomework: t(z.object({ learnerId: id, subject: text(80), title: text(140), instructions: text(4000), dueDate: day })),
  submitHomework: t(id, text(4000), text(200).optional(), text(500).optional()),
  reviewHomework: t(id, text(4000), text(20).optional()),
  setTopicStatus: t(id, text(200), z.enum(["not_started", "in_progress", "completed"])),
  addGoal: t(z.object({
    learnerId: id, tutorId: id.optional(), subject: text(80), title: text(140),
    topics: z.array(z.object({ name: text(100), status: z.enum(["not_started", "in_progress", "completed"]) })).max(30), targetDate: day.optional(),
  })),

  updateTutorProfile: t(tutorPatch),
  setAvailability: t(z.array(z.object({ day: int(0, 6), start: hhmm, end: hhmm })).max(70)),
  setExceptions: t(z.array(z.object({ date: day, type: z.enum(["blocked", "custom"]), windows: z.array(z.object({ start: hhmm, end: hhmm })).max(10).optional(), note: text(200).optional() })).max(366)),
  setBookingRules: t(z.object({ minNoticeHours: z.number().min(0).max(10_000).optional(), maxAdvanceDays: z.number().min(0).max(10_000).optional(), bufferMinutes: z.number().min(0).max(10_000).optional(), sessionLengths: z.array(int(15, 240)).max(8).optional(), requiresApproval: z.boolean().optional() })),
  setTrial: t(z.object({ enabled: z.boolean().optional(), priceCents: int(0, 1_000_000).optional(), durationMin: int(0, 240).optional(), notes: text(500).optional() })),
  saveOnboarding: t(int(0, 30), z.record(z.unknown()).refine((d) => JSON.stringify(d).length < 2_500_000, "Too large")),
  submitOnboarding: none,
  submitVerification: t(z.enum(["identity", "education", "certification", "background"]), z.array(file).max(10)),
  buyCredits: t(text(20)),
  changePlan: t(z.enum(["free", "pro", "premium"])),

  openDispute: t(id, z.enum(["missed_session", "tutor_no_show", "student_no_show", "service_issue", "payment_issue", "refund_issue", "other"]), text(4000), z.array(file).max(10)),
  addDisputeNote: t(id, text(4000)),
  setDisputeStatus: t(id, z.enum(["open", "under_review", "awaiting_information", "resolved", "rejected", "escalated"])),
  resolveDispute: t(id, z.enum(["full_refund", "partial_refund", "credit", "no_refund"]), int(0, 10_000_000), text(2000)),

  reviewVerification: t(id, z.enum(["verified", "rejected", "under_review"]), text(2000).optional()),
  setUserStatus: t(id, z.enum(["active", "suspended", "pending_verification"]), text(500)),
  setReportStatus: t(id, z.enum(["open", "reviewing", "actioned", "dismissed"])),
  moderateReview: t(id, z.enum(["published", "flagged", "removed"])),
  setFlag: t(text(60), z.object({ enabled: z.boolean().optional(), rolloutPercent: z.number().optional() })),
  updatePolicy: t(policyPatch),
  setPlatformFee: t(z.number()),
  saveCoupon: t(z.object({ id: id.optional(), code: text(20), kind: z.enum(["percent", "fixed"]), value: z.number(), currency: z.string().regex(/^[A-Z]{3}$/).optional(), minPurchaseCents: int(0, 10_000_000), maxRedemptions: int(0, 10_000_000), expiresAt: iso, firstBookingOnly: z.boolean(), active: z.boolean() })),
  saveSubjectArea: t(z.object({ slug: text(80).optional(), name: text(120), description: text(400), hidden: z.boolean().optional() })),
  deleteSubjectArea: t(text(80)),
  saveSubject: t(z.object({ slug: text(80).optional(), name: text(120), category: text(80), summary: text(400), popular: z.boolean().optional(), hidden: z.boolean().optional() })),
  deleteSubject: t(text(80)),
  moveCatalogItem: t(z.enum(["area", "subject"]), text(80), z.union([z.literal(-1), z.literal(1)])),
  loadStarterCatalog: none,
  logConversationAccess: t(id, text(500)),
  setStaffAccess: t(id, z.enum(["admin", "support", "none"]), z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).max(20)),
  updateUserDetails: t(id, z.object({ firstName: text(60).optional(), lastName: text(60).optional(), phone: text(30).optional(), country: COUNTRY.optional(), city: text(60).optional(), state: text(60).optional(), zip: text(10).optional() })),
  deleteAccount: t(id, text(500)),
  setTutorListing: t(id, z.object({ featured: z.boolean().optional(), hidden: z.boolean().optional() }), text(500)),
  takeDownRequirement: t(id, text(500)),
  sendAnnouncement: t(z.enum(["everyone", "students", "parents", "tutors"]), text(200), text(1000), text(200).optional()),

  saveBlogPost: t(z.object({
    slug: text(140).optional(), title: text(200), excerpt: text(600), category: z.enum(["Parents", "Students", "Tutors", "Test prep"]), author: text(80),
    date: day, readMinutes: int(0, 600).optional().default(1), body: z.array(z.object({ h: text(200).optional(), p: text(6000) })).max(80), status: z.enum(["draft", "published"]),
  })),
  deleteBlogPost: t(text(140)),
  saveFaq: t(z.object({ id: id.optional(), audience: z.enum(["families", "tutors", "payments", "safety"]), q: text(300), a: text(3000), published: z.boolean() })),
  deleteFaq: t(id),
  moveFaq: t(id, z.union([z.literal(-1), z.literal(1)])),
  saveTestimonial: t(z.object({ id: id.optional(), quote: text(600), name: text(120), context: text(200), used: z.object({ label: text(80), href: text(200) }), consentConfirmed: z.boolean(), published: z.boolean() })),
  deleteTestimonial: t(id),
};

/** Validates and normalizes arguments; JSON turns a trailing `undefined` into `null`, which is mapped back. */
export function parseArgs(name: ActionName, raw: unknown): { ok: true; args: unknown[] } | { ok: false; error: string } {
  const schema = ACTION_ARGS[name];
  if (!schema) return { ok: false, error: "Unknown action." };
  if (!Array.isArray(raw)) return { ok: false, error: "Invalid request." };
  const length = (schema as z.ZodTuple)._def.items.length;
  if (raw.length > length) return { ok: false, error: "Invalid request." };
  const args = Array.from({ length }, (_, i) => (raw[i] === null ? undefined : raw[i]));
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Some of the information isn't valid${issue?.path.length ? ` (${issue.path.join(".")})` : ""}. Please check and try again.` };
  }
  return { ok: true, args: parsed.data as unknown[] };
}
