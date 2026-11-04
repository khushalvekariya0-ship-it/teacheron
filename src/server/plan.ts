import "server-only";
import type { User } from "@/lib/types";
import type { ActionName } from "@/lib/domain/actions";
import type { Loader } from "./load";

/*
 * What each action needs loaded before it runs. Most need the signed-in account's own world; actions
 * about a booking, conversation or job also load the other person's side, and admin actions load
 * their target. Messages and notifications are only loaded where an action reads them.
 */

type Plan = (L: Loader, me: User | null, args: unknown[]) => Promise<void>;

const self: Plan = (L, me) => L.self(me);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

async function cms(L: Loader) {
  await Promise.all([L.load("blog_posts", "true"), L.load("faqs", "true"), L.load("testimonials", "true")]);
}

/** The account's stopped attempts in the last hour (for the automatic pause). */
async function recentFlags(L: Loader, me: User | null) {
  await L.load("contact_flags", "user_id = $1 and created_at > now() - interval '1 hour'", [me?.id ?? ""]);
}

async function jobAlerts(L: Loader) {
  await L.load("saved_searches", "kind = 'jobs' and frequency = 'instant'");
}

export const PLANS: Record<ActionName, Plan> = {
  updateMe: self,
  saveStudentProfile: self,
  deleteMyAccount: self,
  confirmParentalConsent: (L, _me, [userId]) => L.world([str(userId)]),

  toggleFavorite: async (L, me, [tutorId]) => {
    await Promise.all([L.self(me), L.tutors([str(tutorId)])]);
  },
  saveSearch: self,
  updateSavedSearch: self,
  deleteSavedSearch: self,
  toggleSavedJob: async (L, me, [requirementId]) => {
    await Promise.all([L.self(me), L.byId("requirements", [str(requirementId)])]);
  },

  saveRequirementDraft: async (L, me, [input]) => {
    await Promise.all([L.self(me), L.byId("requirements", [str(obj(input).id)])]);
  },
  publishRequirement: async (L, me) => {
    await Promise.all([L.self(me), jobAlerts(L)]);
  },
  setRequirementStatus: async (L, me) => {
    await Promise.all([L.self(me), jobAlerts(L)]);
  },
  deleteRequirement: self,

  applyToJob: async (L, me, [requirementId]) => {
    await Promise.all([L.self(me), L.byId("requirements", [str(requirementId)])]);
  },
  setApplicationStatus: async (L, me, [id]) => {
    const [app] = await L.byId("applications", [str(id)]);
    await Promise.all([L.self(me), L.byId("requirements", [app?.requirement_id as string]), L.usersByTutor([app?.tutor_id as string])]);
  },

  validateCoupon: async (L, me, [code]) => {
    await Promise.all([L.self(me), L.load("coupons", "code = upper($1)", [String(code ?? "").trim()])]);
  },
  topUpWallet: self,
  createBooking: async (L, me, [input]) => {
    const i = obj(input);
    await Promise.all([
      L.world([me?.id], [me?.tutorId, str(i.tutorId)]),
      L.load("bookings", "idempotency_key = $1", [String(i.idempotencyKey ?? "")]),
      str(i.couponCode) ? L.load("coupons", "code = upper($1)", [String(i.couponCode).trim()]) : Promise.resolve(),
    ]);
  },
  transitionBooking: (L, me, [id]) => L.bookingParticipants(str(id), me),
  rescheduleBooking: (L, me, [id]) => L.bookingParticipants(str(id), me),
  // The tutor's world holds their other upcoming lessons (for "use this link for my other lessons").
  setLessonVideo: (L, me, [id]) => L.bookingParticipants(str(id), me),
  removeLessonVideo: (L, me, [id]) => L.bookingParticipants(str(id), me),
  setLessonRecording: (L, me, [id]) => L.bookingParticipants(str(id), me),
  submitReview: (L, me, [bookingId]) => L.bookingParticipants(str(bookingId), me),
  respondToReview: self,

  startConversation: async (L, me, [tutorId]) => {
    await Promise.all([L.self(me), L.tutors([str(tutorId)])]);
  },
  contactLearner: async (L, me, [source]) => {
    const s = (source ?? {}) as { bookingId?: unknown; requirementId?: unknown };
    const [bookings, requirements] = await Promise.all([L.byId("bookings", [str(s.bookingId)]), L.byId("requirements", [str(s.requirementId)]), L.self(me)]);
    await L.users([bookings[0]?.booker_id as string, requirements[0]?.owner_id as string]);
  },
  sendMessage: async (L, me, [conversationId]) => {
    const [c] = await L.byId("conversations", [str(conversationId)]);
    await Promise.all([
      L.self(me), L.users([c?.user_id as string]), L.usersByTutor([c?.tutor_id as string]), recentFlags(L, me),
      // The latest messages, so a number sent a piece at a time is noticed.
      L.load("messages", "id in (select id from public.messages where conversation_id = $1 order by created_at desc limit 45)", [str(conversationId) ?? ""]),
    ]);
  },
  markConversationRead: async (L, me, [conversationId]) => {
    await Promise.all([L.self(me), L.byId("conversations", [str(conversationId)]), L.load("messages", "conversation_id = $1 and read_at is null", [str(conversationId) ?? ""])]);
  },
  toggleBlock: async (L, me, [conversationId]) => {
    await Promise.all([L.self(me), L.byId("conversations", [str(conversationId)])]);
  },
  requestChatUnlock: async (L, me) => {
    // Staff who moderate chat are told about the request.
    await Promise.all([L.self(me), L.load("users", "role in ('admin', 'support') and status = 'active' and 'reports.moderate' = any(permissions)")]);
  },
  recordContactFlag: async (L, me, [input]) => {
    const i = obj(input);
    await Promise.all([L.self(me), recentFlags(L, me)]);
    if (i.channel === "chat") {
      const [c] = await L.byId("conversations", [str(i.contextId)]);
      await L.usersByTutor([c?.tutor_id as string]);
    } else if (i.channel === "homework") {
      const [hw] = await L.byId("homework", [str(i.contextId)]);
      await L.usersByTutor([hw?.tutor_id as string]);
    }
  },
  report: async (L, me, [input]) => {
    const i = obj(input);
    await L.self(me);
    if (i.targetType === "message") {
      const [m] = await L.byId("messages", [str(i.targetId)]);
      await L.byId("conversations", [m?.conversation_id as string]);
    }
  },

  markNotificationRead: async (L, me, [id]) => {
    await Promise.all([L.self(me), L.load("notifications", "id = $1 and user_id = $2", [str(id) ?? "", me?.id ?? ""])]);
  },
  markAllNotificationsRead: async (L, me) => {
    await Promise.all([L.self(me), L.load("notifications", "user_id = $1 and not read", [me?.id ?? ""])]);
  },
  setNotificationPref: self,

  saveChild: self,
  removeChild: self,

  addProgressNote: async (L, me, [learnerId]) => {
    await Promise.all([L.self(me), L.byId("children", [str(learnerId)])]);
  },
  assignHomework: async (L, me, [input]) => {
    await Promise.all([L.self(me), L.byId("children", [str(obj(input).learnerId)])]);
  },
  submitHomework: async (L, me, [id]) => {
    const [hw] = await L.byId("homework", [str(id)]);
    await Promise.all([L.self(me), L.usersByTutor([hw?.tutor_id as string]), recentFlags(L, me)]);
  },
  reviewHomework: async (L, me, [id]) => {
    const [hw] = await L.byId("homework", [str(id)]);
    await Promise.all([L.self(me), L.byId("children", [hw?.learner_id as string]), recentFlags(L, me)]);
  },
  setTopicStatus: self,
  addGoal: async (L, me, [input]) => {
    await Promise.all([L.self(me), L.tutors([str(obj(input).tutorId)])]);
  },

  updateTutorProfile: self,
  setAvailability: self,
  setExceptions: self,
  setBookingRules: self,
  setTrial: self,
  saveOnboarding: self,
  submitOnboarding: self,
  submitVerification: self,
  buyCredits: self,
  changePlan: self,

  openDispute: (L, me, [bookingId]) => L.bookingParticipants(str(bookingId), me),
  addDisputeNote: disputePlan,
  setDisputeStatus: disputePlan,
  resolveDispute: disputePlan,

  reviewVerification: async (L, me, [id]) => {
    const [vr] = await L.byId("verification_requests", [str(id)]);
    await Promise.all([L.self(me), L.tutors([vr?.tutor_id as string]), L.usersByTutor([vr?.tutor_id as string])]);
  },
  setUserStatus: async (L, me, [userId]) => {
    await Promise.all([L.self(me), L.users([str(userId)])]);
  },
  setReportStatus: async (L, me, [id]) => {
    await Promise.all([L.self(me), L.byId("reports", [str(id)])]);
  },
  moderateReview: async (L, me, [id]) => {
    await Promise.all([L.self(me), L.byId("reviews", [str(id)])]);
  },
  setFlag: self,
  updatePolicy: self,
  setPlatformFee: self,
  saveCoupon: async (L, me) => {
    await Promise.all([L.self(me), L.load("coupons", "true")]);
  },
  saveSubjectArea: self,
  deleteSubjectArea: self,
  saveSubject: self,
  deleteSubject: async (L, me, [slug]) => {
    const s = str(slug) ?? "";
    await Promise.all([
      L.self(me),
      L.load("tutors", "$1 = any(subjects)", [s]),
      L.load("requirements", "subject = $1", [s]),
      L.load("bookings", "subject = $1", [s]),
    ]);
  },
  moveCatalogItem: self,
  loadStarterCatalog: self,
  setStaffAccess: async (L, me, [userId]) => {
    await Promise.all([L.self(me), L.users([str(userId)]), L.load("users", "role = 'admin'")]);
  },
  updateUserDetails: async (L, me, [userId]) => {
    await Promise.all([L.self(me), L.users([str(userId)])]);
  },
  deleteAccount: async (L, me, [userId]) => {
    await Promise.all([L.self(me), L.world([str(userId)])]);
  },
  setTutorListing: async (L, me, [tutorId]) => {
    await Promise.all([L.self(me), L.tutors([str(tutorId)]), L.usersByTutor([str(tutorId)])]);
  },
  takeDownRequirement: async (L, me, [id]) => {
    const [, , apps] = await Promise.all([L.self(me), L.byId("requirements", [str(id)]), L.byId("applications", [str(id)], "requirement_id")]);
    await L.usersByTutor(apps.map((a) => a.tutor_id as string));
  },
  sendAnnouncement: async (L, me, [audience]) => {
    const roles = audience === "students" ? ["student"] : audience === "parents" ? ["parent"] : audience === "tutors" ? ["tutor"] : ["student", "parent", "tutor"];
    await Promise.all([L.self(me), L.load("users", "role = any($1) and status = 'active'", [roles])]);
  },
  warnChatUser: async (L, me, [userId]) => {
    await Promise.all([L.self(me), L.users([str(userId)]), L.load("contact_flags", "user_id = $1 and status = 'open'", [str(userId) ?? ""])]);
  },
  restrictChat: async (L, me, [userId]) => {
    await Promise.all([L.self(me), L.users([str(userId)]), L.load("contact_flags", "user_id = $1 and status = 'open'", [str(userId) ?? ""])]);
  },
  declineChatUnlock: async (L, me, [userId]) => {
    await Promise.all([L.self(me), L.users([str(userId)])]);
  },
  setContactFlagStatus: async (L, me, [ids]) => {
    await Promise.all([L.self(me), L.byId("contact_flags", Array.isArray(ids) ? ids.map(str) : [])]);
  },
  logConversationAccess: async (L, me, [conversationId]) => {
    await Promise.all([
      L.self(me),
      L.byId("conversations", [str(conversationId)]),
      L.load("messages", "conversation_id = $1", [str(conversationId) ?? ""], 2000),
    ]);
  },

  saveBlogPost: async (L, me) => {
    await Promise.all([L.self(me), cms(L)]);
  },
  deleteBlogPost: async (L, me) => {
    await Promise.all([L.self(me), cms(L)]);
  },
  saveFaq: async (L, me) => {
    await Promise.all([L.self(me), cms(L)]);
  },
  deleteFaq: async (L, me) => {
    await Promise.all([L.self(me), cms(L)]);
  },
  moveFaq: async (L, me) => {
    await Promise.all([L.self(me), cms(L)]);
  },
  saveTestimonial: async (L, me) => {
    await Promise.all([L.self(me), cms(L)]);
  },
  deleteTestimonial: async (L, me) => {
    await Promise.all([L.self(me), cms(L)]);
  },

  runScheduledJobs: async (L) => {
    const due = await L.load(
      "bookings",
      "(status = 'pending' and start_utc <= now()) or (status in ('confirmed', 'in_progress') and end_utc + interval '24 hours' <= now())",
      [],
      500,
    );
    const bookingIds = due.map((b) => b.id as string);
    await Promise.all([
      L.byId("disputes", bookingIds, "booking_id"),
      L.byId("payments", bookingIds, "booking_id"),
      L.users(due.map((b) => b.booker_id as string)),
      L.tutors(due.map((b) => b.tutor_id as string)),
    ]);
  },
};

async function disputePlan(L: Loader, me: User | null, [id]: unknown[]) {
  const [d] = await L.byId("disputes", [str(id)]);
  await L.bookingParticipants(d?.booking_id as string, me);
}
