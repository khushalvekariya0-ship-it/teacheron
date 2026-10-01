import type {
  AppNotification, AuditLog, Booking, BookingStatus, Conversation, Dispute, Homework, LeadTransaction, LearningGoal,
  Message, Payment, Payout, ProgressNote, Report, SavedSearch, TeachingMode, VerificationRequest,
} from "@/lib/types";
import { TUTOR_BY_ID } from "@/lib/data/tutors";
import { applyBps, sessionPrice } from "@/lib/format";
import { zonedParts, zonedToUtc } from "@/lib/time";
import { SITE } from "@/lib/site";

/*
 * SAMPLE DATA generated relative to the moment the demo is first opened, so dashboards always
 * show a realistic mix of upcoming, live and past lessons.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function at(now: number, daysFromNow: number, hour: number, minute: number, tz: string): string {
  const p = zonedParts(new Date(now + daysFromNow * DAY), tz);
  return zonedToUtc(p.year, p.month, p.day, hour, minute, tz).toISOString();
}

interface BSeed {
  id: string;
  tutorId: string;
  bookerId: string;
  childId?: string;
  subject: string;
  type?: Booking["type"];
  status: BookingStatus;
  startUtc: string;
  durationMin?: number;
  mode?: TeachingMode;
  notes?: string;
  reviewed?: boolean;
}

function mkBooking(s: BSeed, now: number): Booking {
  const tutor = TUTOR_BY_ID[s.tutorId];
  const type = s.type ?? "regular";
  const durationMin = s.durationMin ?? (type === "trial" ? tutor.trial.durationMin : 60);
  const priceCents = type === "trial" ? tutor.trial.priceCents : sessionPrice(tutor.hourlyRateCents, durationMin);
  const created = new Date(Math.min(now - 2 * HOUR, new Date(s.startUtc).getTime() - 3 * DAY)).toISOString();
  const paid = ["confirmed", "in_progress", "completed", "no_show_student", "disputed"].includes(s.status);
  const history: Booking["history"] = [{ at: created, by: s.bookerId, from: null, to: "pending", note: type === "trial" ? "Trial requested" : "Booking requested" }];
  if (s.status !== "pending" && s.status !== "payment_failed") {
    history.push({ at: new Date(new Date(created).getTime() + 2 * HOUR).toISOString(), by: tutor.rules.requiresApproval ? s.tutorId : "system", from: "pending", to: "confirmed", note: tutor.rules.requiresApproval ? "Accepted by tutor" : "Instant booking" });
  }
  if (!["pending", "confirmed", "payment_failed"].includes(s.status)) {
    history.push({ at: new Date(new Date(s.startUtc).getTime() + durationMin * 60_000).toISOString(), by: "system", from: "confirmed", to: s.status });
  }
  return {
    id: s.id,
    tutorId: s.tutorId,
    bookerId: s.bookerId,
    childId: s.childId,
    subject: s.subject,
    type,
    status: s.status,
    startUtc: s.startUtc,
    durationMin,
    mode: s.mode ?? "online",
    priceCents,
    // Sarah Chen is on the Professional plan (15%); other sample tutors are on Starter (18%).
    platformFeeCents: applyBps(priceCents, s.tutorId === "tut_sarah_chen" ? 1500 : SITE.platformFeeBps),
    discountCents: 0,
    paymentStatus: s.status === "payment_failed" ? "failed" : s.status.startsWith("cancelled") ? (priceCents ? "refunded" : "unpaid") : s.status === "refunded" ? "refunded" : paid ? (priceCents ? "paid" : "unpaid") : "authorized",
    meetingUrl: (s.mode ?? "online") === "online" ? `https://meet.tutorlink.example/${s.id}` : undefined,
    locationNote: s.mode === "in_person" ? "Public library study room — details shared after confirmation" : undefined,
    notes: s.notes,
    idempotencyKey: `seed_${s.id}`,
    history,
    createdAt: created,
  };
}

/** Activity for an empty marketplace (sample-data switch off). */
export function emptySeed(): ReturnType<typeof createSeed> {
  return {
    bookings: [], conversations: [], messages: [], notifications: [], goals: [], progressNotes: [], homework: [], payments: [], payouts: [],
    leadTransactions: [], verificationRequests: [], reports: [], disputes: [], savedSearches: [], auditLogs: [], reviewedBookingIds: [],
  };
}

export function createSeed(now: number) {
  const CT = "America/Chicago";
  const ET = "America/New_York";
  const minsFromNow = (m: number) => new Date(Math.floor((now + m * 60_000) / 300_000) * 300_000).toISOString();

  const bookingSeeds: BSeed[] = [
    // ── Demo student: Jordan Lee (Chicago) ─────────────────────────────
    { id: "bk_s01", tutorId: "tut_priya_raman", bookerId: "usr_student", subject: "chemistry", type: "trial", status: "completed", startUtc: at(now, -6, 18, 0, CT) },
    { id: "bk_s02", tutorId: "tut_priya_raman", bookerId: "usr_student", subject: "chemistry", status: "confirmed", startUtc: minsFromNow(10), notes: "Equilibrium — ICE tables and Le Chatelier's principle" },
    { id: "bk_s03", tutorId: "tut_priya_raman", bookerId: "usr_student", subject: "chemistry", status: "confirmed", startUtc: at(now, 3, 19, 0, CT) },
    { id: "bk_s04", tutorId: "tut_leah_goldberg", bookerId: "usr_student", subject: "chemistry", type: "trial", status: "pending", startUtc: at(now, 4, 17, 0, CT) },
    { id: "bk_s05", tutorId: "tut_marcus_bell", bookerId: "usr_student", subject: "python", status: "cancelled_by_student", startUtc: at(now, -10, 19, 0, CT) },
    // ── Demo parent: Dana Whitaker (Brooklyn) — Noah & Ava ─────────────
    { id: "bk_p01", tutorId: "tut_aisha_rahman", bookerId: "usr_parent", childId: "chd_noah", subject: "pre-algebra", type: "trial", status: "completed", startUtc: at(now, -15, 16, 0, ET) },
    { id: "bk_p02", tutorId: "tut_aisha_rahman", bookerId: "usr_parent", childId: "chd_noah", subject: "pre-algebra", status: "completed", startUtc: at(now, -8, 16, 0, ET), reviewed: true },
    { id: "bk_p03", tutorId: "tut_aisha_rahman", bookerId: "usr_parent", childId: "chd_noah", subject: "pre-algebra", status: "completed", startUtc: at(now, -1, 16, 0, ET) },
    { id: "bk_p04", tutorId: "tut_aisha_rahman", bookerId: "usr_parent", childId: "chd_noah", subject: "pre-algebra", status: "no_show_student", startUtc: at(now, -4, 16, 0, ET) },
    { id: "bk_p05", tutorId: "tut_aisha_rahman", bookerId: "usr_parent", childId: "chd_noah", subject: "pre-algebra", status: "confirmed", startUtc: at(now, 1, 16, 0, ET) },
    { id: "bk_p06", tutorId: "tut_aisha_rahman", bookerId: "usr_parent", childId: "chd_noah", subject: "pre-algebra", status: "confirmed", startUtc: at(now, 6, 16, 0, ET) },
    { id: "bk_p07", tutorId: "tut_elena_morales", bookerId: "usr_parent", childId: "chd_ava", subject: "spanish", status: "completed", startUtc: at(now, -7, 10, 0, ET), durationMin: 45 },
    { id: "bk_p08", tutorId: "tut_elena_morales", bookerId: "usr_parent", childId: "chd_ava", subject: "spanish", status: "confirmed", startUtc: at(now, 2, 10, 0, ET), durationMin: 45 },
    // ── Demo tutor: Sarah Chen (New York) ──────────────────────────────
    { id: "bk_t01", tutorId: "tut_sarah_chen", bookerId: "usr_m01", subject: "calculus", status: "completed", startUtc: at(now, -3, 17, 0, ET) },
    { id: "bk_t02", tutorId: "tut_sarah_chen", bookerId: "usr_m02", subject: "sat", status: "confirmed", startUtc: minsFromNow(-120), notes: "Practice test review — Module 2" },
    { id: "bk_t03", tutorId: "tut_sarah_chen", bookerId: "usr_m01", subject: "calculus", status: "confirmed", startUtc: at(now, 1, 17, 0, ET) },
    { id: "bk_t04", tutorId: "tut_sarah_chen", bookerId: "usr_m07", subject: "sat", type: "trial", status: "pending", startUtc: at(now, 2, 18, 0, ET) },
    { id: "bk_t05", tutorId: "tut_sarah_chen", bookerId: "usr_m01", subject: "calculus", status: "pending", startUtc: at(now, 3, 17, 0, ET), durationMin: 90, notes: "Extra session before the unit test" },
    { id: "bk_t06", tutorId: "tut_sarah_chen", bookerId: "usr_m02", subject: "sat", status: "completed", startUtc: at(now, -8, 18, 0, ET) },
    { id: "bk_t07", tutorId: "tut_sarah_chen", bookerId: "usr_m02", subject: "sat", status: "completed", startUtc: at(now, -15, 18, 0, ET) },
    { id: "bk_t08", tutorId: "tut_sarah_chen", bookerId: "usr_m01", subject: "calculus", status: "completed", startUtc: at(now, -10, 17, 0, ET) },
    { id: "bk_t09", tutorId: "tut_sarah_chen", bookerId: "usr_m01", subject: "calculus", status: "completed", startUtc: at(now, -17, 17, 0, ET) },
    { id: "bk_t10", tutorId: "tut_sarah_chen", bookerId: "usr_m07", subject: "sat", status: "cancelled_by_tutor", startUtc: at(now, -5, 18, 0, ET) },
    { id: "bk_t11", tutorId: "tut_sarah_chen", bookerId: "usr_m02", subject: "sat", status: "confirmed", startUtc: at(now, 5, 18, 0, ET), mode: "in_person" },
    // ── Other marketplace activity (admin views, disputes) ─────────────
    { id: "bk_x01", tutorId: "tut_andre_thomas", bookerId: "usr_m05", subject: "physics", status: "no_show_tutor", startUtc: at(now, -2, 19, 0, CT) },
    { id: "bk_x02", tutorId: "tut_rachel_adams", bookerId: "usr_m04", subject: "geometry", status: "disputed", startUtc: at(now, -4, 17, 0, CT) },
    { id: "bk_x03", tutorId: "tut_david_kim", bookerId: "usr_m07", subject: "sat", status: "completed", startUtc: at(now, -1, 15, 0, "America/Los_Angeles") },
    { id: "bk_x04", tutorId: "tut_elena_morales", bookerId: "usr_m03", subject: "spanish", status: "confirmed", startUtc: at(now, 1, 16, 0, ET), mode: "in_person" },
    { id: "bk_x05", tutorId: "tut_hannah_weiss", bookerId: "usr_m10", subject: "reading", status: "payment_failed", startUtc: at(now, 2, 15, 0, ET) },
    { id: "bk_x06", tutorId: "tut_naomi_fischer", bookerId: "usr_m08", subject: "executive-function", status: "completed", startUtc: at(now, -3, 16, 0, ET) },
    { id: "bk_x07", tutorId: "tut_marcus_bell", bookerId: "usr_m11", subject: "python", status: "confirmed", startUtc: at(now, 2, 18, 0, "America/Los_Angeles") },
  ];

  const bookings = bookingSeeds.map((s) => mkBooking(s, now));
  // Disputed booking history
  const disputed = bookings.find((b) => b.id === "bk_x02")!;
  disputed.history = [...disputed.history.filter((e) => e.to !== "disputed"), { at: new Date(now - 2 * DAY).toISOString(), by: "system", from: "confirmed", to: "completed" }, { at: new Date(now - 1 * DAY).toISOString(), by: "usr_m04", from: "completed", to: "disputed", note: "Session ended 25 minutes early" }];

  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

  const conversations: Conversation[] = [
    { id: "cnv_01", tutorId: "tut_priya_raman", userId: "usr_student", subject: "chemistry", createdAt: iso(9 * DAY), lastMessageAt: iso(40 * 60_000), involvesMinor: false },
    { id: "cnv_02", tutorId: "tut_leah_goldberg", userId: "usr_student", subject: "chemistry", createdAt: iso(3 * DAY), lastMessageAt: iso(26 * HOUR), involvesMinor: false },
    { id: "cnv_03", tutorId: "tut_aisha_rahman", userId: "usr_parent", childId: "chd_noah", subject: "pre-algebra", createdAt: iso(18 * DAY), lastMessageAt: iso(3 * HOUR), involvesMinor: true },
    { id: "cnv_04", tutorId: "tut_elena_morales", userId: "usr_parent", childId: "chd_ava", subject: "spanish", createdAt: iso(12 * DAY), lastMessageAt: iso(2 * DAY), involvesMinor: true },
    { id: "cnv_05", tutorId: "tut_sarah_chen", userId: "usr_m01", subject: "calculus", createdAt: iso(20 * DAY), lastMessageAt: iso(90 * 60_000), involvesMinor: true },
    { id: "cnv_06", tutorId: "tut_sarah_chen", userId: "usr_m07", subject: "sat", createdAt: iso(4 * DAY), lastMessageAt: iso(5 * HOUR), involvesMinor: true },
    { id: "cnv_07", tutorId: "tut_sarah_chen", userId: "usr_m02", subject: "sat", createdAt: iso(16 * DAY), lastMessageAt: iso(2 * DAY), involvesMinor: false },
  ];

  let mi = 0;
  const m = (conversationId: string, senderId: string, body: string, msAgo: number, read = true, extra: Partial<Message> = {}): Message => ({
    id: `msg_${String(++mi).padStart(3, "0")}`, conversationId, senderId, body, createdAt: iso(msAgo), readAt: read ? iso(msAgo - 60_000) : undefined, ...extra,
  });

  const messages: Message[] = [
    m("cnv_01", "usr_student", "Hi Dr. Raman — I'm taking AP Chem and equilibrium is really confusing me. Do you have time on Tuesday or Thursday evenings?", 9 * DAY),
    m("cnv_01", "tut_priya_raman", "Hi Jordan! Yes — Tuesdays and Thursdays after 5 PM work well. Want to start with a free 30-minute trial so I can see where things stand?", 9 * DAY - 2 * HOUR),
    m("cnv_01", "usr_student", "That would be great. I just booked the trial for Monday.", 8 * DAY),
    m("cnv_01", "tut_priya_raman", "Great session today. For next time, try problems 3, 5 and 8 from the ICE table worksheet I shared — don't worry if you get stuck on 8.", 6 * DAY - 3 * HOUR, true, { attachment: { name: "ICE-tables-practice.pdf", sizeKb: 184 } }),
    m("cnv_01", "usr_student", "Got it. Problem 8 was tough but I think I got it.", 2 * DAY),
    m("cnv_01", "tut_priya_raman", "See you shortly! I'll send the link a few minutes before we start — bring your attempt at #8 and we'll go through it first.", 40 * 60_000, false),
    m("cnv_02", "usr_student", "Hi Ms. Goldberg, I requested a trial for Thursday — is that time OK?", 30 * HOUR),
    m("cnv_02", "tut_leah_goldberg", "Hi Jordan, thanks for reaching out. I'll confirm by tonight — just checking one conflict.", 26 * HOUR, false),
    m("cnv_03", "usr_parent", "Hi Ms. Rahman, Noah is in 7th grade and has lost confidence in math this year. He does best with short breaks.", 18 * DAY),
    m("cnv_03", "tut_aisha_rahman", "Thank you for sharing that, Dana. Breaks every 15–20 minutes work well for a lot of my students. I'd love to meet Noah in a trial.", 18 * DAY - 4 * HOUR),
    m("cnv_03", "tut_aisha_rahman", "Noah did really well today with integer operations. I've assigned a short practice set — about 15 minutes.", 1 * DAY - 2 * HOUR),
    m("cnv_03", "usr_parent", "Thank you! He actually said math was 'kind of fun' at dinner.", 20 * HOUR),
    m("cnv_03", "tut_aisha_rahman", "That's wonderful to hear. Tomorrow we'll start one-step equations.", 3 * HOUR, false),
    m("cnv_04", "usr_parent", "Hola Elena! Ava loved her first lesson.", 6 * DAY),
    m("cnv_04", "tut_elena_morales", "¡Qué bueno! She has a great accent already. See you Saturday.", 2 * DAY),
    m("cnv_05", "usr_m01", "Hi Sarah — could we add an extra 90-minute session before the unit test on the 3rd?", 26 * HOUR),
    m("cnv_05", "tut_sarah_chen", "Yes, I think that's a good idea. Please send the request through the booking page and I'll accept it.", 24 * HOUR),
    m("cnv_05", "usr_m01", "Done — just sent it. Thank you!", 90 * 60_000, false),
    m("cnv_06", "usr_m07", "Hello! My son is taking the SAT in December. Is your free trial still available?", 4 * DAY),
    m("cnv_06", "tut_sarah_chen", "Hi Grace — my trial for SAT is 30 minutes and free. Feel free to book whichever time works.", 4 * DAY - 3 * HOUR),
    m("cnv_06", "usr_m07", "Great. It might be easier to text me at [contact details hidden] to coordinate.", 5 * HOUR, false, { moderation: "contact_info_masked" }),
    m("cnv_07", "usr_m02", "Thanks for today — the error log idea really helps.", 2 * DAY),
  ];

  const note = (userId: string, type: AppNotification["type"], title: string, body: string, msAgo: number, href?: string, read = false): AppNotification => ({
    id: `ntf_${userId}_${msAgo}`, userId, type, title, body, href, createdAt: iso(msAgo), read,
  });

  const notifications: AppNotification[] = [
    note("usr_student", "reminder", "Lesson starting soon", "Chemistry with Priya Raman starts in 10 minutes.", 5 * 60_000, "/dashboard/bookings/bk_s02"),
    note("usr_student", "message", "New message from Priya R.", "See you shortly! I'll send the link a few minutes before…", 40 * 60_000, "/dashboard/messages?c=cnv_01"),
    note("usr_student", "application", "3 tutors applied to your requirement", "“Chemistry tutor for AP Chem unit on equilibrium”", 20 * HOUR, "/dashboard/requirements/req_101"),
    note("usr_student", "review_request", "How was your trial with Priya?", "Leave a review to help other students.", 5 * DAY, "/dashboard/bookings/bk_s01", true),
    note("usr_parent", "message", "New message from Aisha R.", "Tomorrow we'll start one-step equations.", 3 * HOUR, "/dashboard/messages?c=cnv_03"),
    note("usr_parent", "homework", "New homework for Noah", "Integer operations practice — due in 2 days.", 22 * HOUR, "/dashboard/homework"),
    note("usr_parent", "progress", "Progress note for Noah", "Aisha added a note after Tuesday's lesson.", 23 * HOUR, "/dashboard/progress"),
    note("usr_parent", "application", "Aisha R. requested a trial", "For “Pre-algebra support for 7th grader”", 3 * DAY, "/dashboard/requirements/req_201", true),
    note("usr_tutor", "booking_request", "New booking request", "Emily R. requested a 90-minute Calculus session.", 90 * 60_000, "/dashboard/bookings/bk_t05"),
    note("usr_tutor", "booking_request", "New trial request", "Grace P. requested a free SAT trial.", 4 * DAY - 2 * HOUR, "/dashboard/bookings/bk_t04"),
    note("usr_tutor", "job_match", "4 new jobs match your subjects", "Calculus, SAT and Algebra near New York.", 6 * HOUR, "/dashboard/jobs"),
    note("usr_tutor", "payout", "Payout on the way", "$80.75 is scheduled to arrive in 2 days.", 2 * DAY, "/dashboard/earnings", true),
    note("usr_admin", "security", "New sign-in from Chrome on Windows", "If this wasn't you, reset your password.", 30 * 60_000, "/admin/security"),
    note("usr_admin", "verification", "7 verification requests waiting", "Oldest submitted 3 days ago.", 2 * HOUR, "/admin/verification"),
  ];

  const goals: LearningGoal[] = [
    {
      id: "gol_01", learnerId: "chd_noah", tutorId: "tut_aisha_rahman", subject: "pre-algebra", title: "Pre-algebra foundations", createdAt: iso(14 * DAY), targetDate: at(now, 60, 12, 0, ET).slice(0, 10),
      topics: [
        { name: "Integer operations", status: "completed" }, { name: "Order of operations", status: "completed" },
        { name: "Ratios and rates", status: "in_progress" }, { name: "One-step equations", status: "in_progress" },
        { name: "Two-step equations", status: "not_started" }, { name: "Inequalities", status: "not_started" },
      ],
    },
    {
      id: "gol_02", learnerId: "chd_ava", tutorId: "tut_elena_morales", subject: "spanish", title: "Conversational Spanish — beginner", createdAt: iso(8 * DAY),
      topics: [{ name: "Greetings & introductions", status: "completed" }, { name: "Numbers 1–100", status: "in_progress" }, { name: "Family vocabulary", status: "not_started" }, { name: "Present tense -ar verbs", status: "not_started" }],
    },
    {
      id: "gol_03", learnerId: "usr_student", tutorId: "tut_priya_raman", subject: "chemistry", title: "AP Chemistry — Units 7 & 8", createdAt: iso(6 * DAY), targetDate: "2027-05-05",
      topics: [{ name: "Equilibrium constant (K)", status: "completed" }, { name: "ICE tables", status: "in_progress" }, { name: "Le Chatelier's principle", status: "in_progress" }, { name: "Acids & bases, pH", status: "not_started" }, { name: "Buffers & titrations", status: "not_started" }],
    },
  ];

  const progressNotes: ProgressNote[] = [
    { id: "prg_01", learnerId: "chd_noah", tutorId: "tut_aisha_rahman", bookingId: "bk_p03", body: "Noah was focused and confident with integer operations today — 9/10 on the exit ticket. We'll start one-step equations next time.", rating: 4, createdAt: at(now, -1, 17, 5, ET) },
    { id: "prg_02", learnerId: "chd_noah", tutorId: "tut_aisha_rahman", bookingId: "bk_p02", body: "Worked on order of operations with a card game. He needed two breaks and came back ready each time.", rating: 3, createdAt: at(now, -8, 17, 5, ET) },
    { id: "prg_03", learnerId: "chd_ava", tutorId: "tut_elena_morales", bookingId: "bk_p07", body: "Ava can introduce herself and count to 30. Great pronunciation!", rating: 4, createdAt: at(now, -7, 10, 50, ET) },
    { id: "prg_04", learnerId: "usr_student", tutorId: "tut_priya_raman", bookingId: "bk_s01", body: "Solid grasp of K expressions; ICE tables need more practice with quadratic setups.", rating: 3, createdAt: at(now, -6, 18, 35, CT) },
  ];

  const homework: Homework[] = [
    { id: "hw_01", learnerId: "chd_noah", tutorId: "tut_aisha_rahman", subject: "pre-algebra", title: "Integer operations practice", instructions: "Complete problems 1–20 on the worksheet. Show your work for 15–20.", dueDate: at(now, 2, 12, 0, ET).slice(0, 10), status: "assigned", createdAt: iso(22 * HOUR) },
    { id: "hw_02", learnerId: "chd_noah", tutorId: "tut_aisha_rahman", subject: "pre-algebra", title: "Order of operations card game", instructions: "Play three rounds with a family member and write down one tricky expression.", dueDate: at(now, -5, 12, 0, ET).slice(0, 10), status: "reviewed", submission: { body: "8 − 2 × (3 + 1) was tricky. The answer is 0!", submittedAt: iso(6 * DAY) }, feedback: { body: "Perfect — you remembered parentheses first. Great job!", grade: "✓+", at: iso(5 * DAY) }, createdAt: iso(8 * DAY) },
    { id: "hw_03", learnerId: "chd_ava", tutorId: "tut_elena_morales", subject: "spanish", title: "Numbers 1–30 recording", instructions: "Record yourself counting from 1 to 30 in Spanish.", dueDate: at(now, 1, 12, 0, ET).slice(0, 10), status: "assigned", createdAt: iso(7 * DAY) },
    { id: "hw_04", learnerId: "usr_student", tutorId: "tut_priya_raman", subject: "chemistry", title: "ICE table problem set", instructions: "Problems 3, 5 and 8. Set up each ICE table before solving.", dueDate: at(now, -1, 12, 0, CT).slice(0, 10), status: "submitted", submission: { body: "Attached my work — #8 took two tries.", fileName: "ice-problems-jordan.pdf", submittedAt: iso(2 * DAY) }, createdAt: iso(6 * DAY) },
  ];

  // Payments for charged bookings
  const payments: Payment[] = bookings
    .filter((b) => b.priceCents > 0 && b.paymentStatus !== "authorized")
    .map((b) => ({
      id: `pay_${b.id}`, bookingId: b.id, userId: b.bookerId, kind: "booking" as const, amountCents: b.priceCents - b.discountCents,
      status: b.paymentStatus === "refunded" ? "refunded" as const : b.paymentStatus === "failed" ? "failed" as const : "succeeded" as const,
      description: `${b.type === "trial" ? "Trial lesson" : "Lesson"} with ${TUTOR_BY_ID[b.tutorId].firstName} ${TUTOR_BY_ID[b.tutorId].lastName.charAt(0)}.`,
      createdAt: b.createdAt, method: b.bookerId === "usr_parent" ? "Visa •••• 4242" : "Mastercard •••• 5454",
    }));
  payments.push({ id: "pay_sub_sarah", userId: "usr_tutor", kind: "subscription", amountCents: 2900, status: "succeeded", description: "Professional plan — monthly", createdAt: iso(12 * DAY), method: "Visa •••• 1881" });

  const payouts: Payout[] = [
    // Net per 60-min lesson for Sarah: $95.00 − 15% commission = $80.75. Payouts only include lessons past the 7-day dispute window.
    { id: "po_01", tutorId: "tut_sarah_chen", amountCents: 16150, status: "paid", arrivalDate: at(now, -5, 12, 0, ET).slice(0, 10), createdAt: iso(7 * DAY) },
    { id: "po_02", tutorId: "tut_sarah_chen", amountCents: 8075, status: "scheduled", arrivalDate: at(now, 2, 12, 0, ET).slice(0, 10), createdAt: iso(1 * DAY) },
  ];

  const leadTransactions: LeadTransaction[] = [
    { id: "lt_01", tutorId: "tut_sarah_chen", delta: 20, reason: "Professional plan — monthly credits", createdAt: iso(12 * DAY) },
    { id: "lt_02", tutorId: "tut_sarah_chen", delta: -1, reason: "Applied: APUSH DBQ writing practice", createdAt: iso(10 * DAY) },
    { id: "lt_03", tutorId: "tut_sarah_chen", delta: -1, reason: "Applied: Digital SAT prep — target 1450+", createdAt: iso(3 * DAY) },
    { id: "lt_04", tutorId: "tut_sarah_chen", delta: -1, reason: "Applied: AP Calculus BC tutor for junior", createdAt: iso(1 * DAY) },
  ];

  const verificationRequests: VerificationRequest[] = [
    { id: "vr_01", tutorId: "tut_andre_thomas", kind: "education", status: "under_review", documents: [{ name: "Rice-MS-diploma.pdf", sizeKb: 842 }], submittedAt: iso(3 * DAY) },
    { id: "vr_02", tutorId: "tut_ryan_patel", kind: "education", status: "submitted", documents: [{ name: "Rutgers-transcript.pdf", sizeKb: 1204 }, { name: "BC-enrollment-letter.pdf", sizeKb: 96 }], submittedAt: iso(2 * DAY) },
    { id: "vr_03", tutorId: "tut_ben_carter", kind: "identity", status: "submitted", documents: [{ name: "drivers-license-front.jpg", sizeKb: 1820 }, { name: "selfie.jpg", sizeKb: 960 }], submittedAt: iso(1 * DAY) },
    { id: "vr_04", tutorId: "tut_naomi_fischer", kind: "certification", status: "under_review", documents: [{ name: "PAAC-certificate.pdf", sizeKb: 310 }], submittedAt: iso(2.5 * DAY) },
    { id: "vr_05", tutorId: "tut_owen_park", kind: "background", status: "under_review", documents: [{ name: "background-consent.pdf", sizeKb: 120 }], submittedAt: iso(1.5 * DAY) },
    { id: "vr_06", tutorId: "tut_james_okafor", kind: "background", status: "under_review", documents: [{ name: "background-consent.pdf", sizeKb: 118 }], submittedAt: iso(20 * HOUR) },
    { id: "vr_07", tutorId: "tut_carlos_vega", kind: "background", status: "submitted", documents: [{ name: "background-consent.pdf", sizeKb: 122 }], submittedAt: iso(6 * HOUR) },
    { id: "vr_08", tutorId: "tut_sarah_chen", kind: "identity", status: "verified", documents: [{ name: "passport.jpg", sizeKb: 2100 }], submittedAt: iso(700 * DAY), reviewedBy: "usr_admin", reviewedAt: iso(699 * DAY), expiresAt: new Date(now + 400 * DAY).toISOString() },
  ];

  const reports: Report[] = [
    { id: "rpt_01", reporterId: "usr_tutor", targetType: "message", targetId: "msg_021", reason: "Sharing contact details", details: "Parent asked to move to text messages before booking.", status: "open", createdAt: iso(4 * HOUR) },
    { id: "rpt_02", reporterId: "usr_m09", targetType: "tutor", targetId: "tut_ben_carter", reason: "Profile information seems inaccurate", details: "Profile lists AP Environmental Science but tutor said they don't teach it.", status: "reviewing", createdAt: iso(1 * DAY) },
    { id: "rpt_03", reporterId: "usr_m12", targetType: "review", targetId: "rev_041", reason: "Review seems unrelated to a lesson", details: "", status: "open", createdAt: iso(2 * DAY) },
    { id: "rpt_04", reporterId: "usr_m03", targetType: "user", targetId: "usr_m08", reason: "Spam messages", details: "Received several identical promotional messages.", status: "actioned", createdAt: iso(9 * DAY) },
  ];

  const disputes: Dispute[] = [
    {
      id: "dsp_01", bookingId: "bk_x02", openedBy: "usr_m04", reason: "service_issue", details: "The session ended about 25 minutes early and the tutor did not offer to make up the time.",
      evidence: [{ name: "zoom-session-log.png", sizeKb: 420 }], status: "under_review",
      adminNotes: [{ by: "usr_support", body: "Requested tutor's account of the session.", at: iso(20 * HOUR) }], createdAt: iso(1 * DAY), updatedAt: iso(20 * HOUR),
    },
    {
      id: "dsp_02", bookingId: "bk_x01", openedBy: "usr_m05", reason: "tutor_no_show", details: "Tutor did not join the online lesson and didn't respond to messages.",
      evidence: [], status: "open", adminNotes: [], createdAt: iso(1.5 * DAY), updatedAt: iso(1.5 * DAY),
    },
  ];

  const auditLogs: AuditLog[] = [
    { id: "aud_01", actorId: "usr_admin", action: "verification.approve", targetType: "verification", targetId: "vr_08", meta: { kind: "identity", tutor: "tut_sarah_chen" }, createdAt: iso(699 * DAY) },
    { id: "aud_02", actorId: "usr_support", action: "dispute.note", targetType: "dispute", targetId: "dsp_01", createdAt: iso(20 * HOUR) },
    { id: "aud_03", actorId: "usr_admin", action: "user.suspend", targetType: "user", targetId: "usr_m08", meta: { reason: "Spam" }, createdAt: iso(8 * DAY) },
    { id: "aud_04", actorId: "usr_admin", action: "flag.update", targetType: "flag", targetId: "ai_matching", meta: { rolloutPercent: 25 }, createdAt: iso(5 * DAY) },
    { id: "aud_05", actorId: "usr_support", action: "conversation.access", targetType: "conversation", targetId: "cnv_06", meta: { reason: "Report rpt_01" }, createdAt: iso(3 * HOUR) },
  ];

  const savedSearches: SavedSearch[] = [
    { id: "ss_01", userId: "usr_student", kind: "tutors", label: "Chemistry · Online · under $110/hr", query: { subject: "chemistry", mode: "online", maxRate: "110" }, frequency: "daily", createdAt: iso(6 * DAY) },
    { id: "ss_02", userId: "usr_parent", kind: "tutors", label: "Reading · Elementary · Near 11201", query: { subject: "reading", level: "elementary", location: "11201" }, frequency: "weekly", createdAt: iso(10 * DAY) },
    { id: "ss_03", userId: "usr_tutor", kind: "jobs", label: "Calculus & SAT jobs", query: { subject: "calculus,sat" }, frequency: "instant", createdAt: iso(30 * DAY) },
  ];

  return {
    bookings, conversations, messages, notifications, goals, progressNotes, homework, payments, payouts,
    leadTransactions, verificationRequests, reports, disputes, savedSearches,
    auditLogs: [...auditLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), // newest first, like the live log
    reviewedBookingIds: bookingSeeds.filter((b) => b.reviewed).map((b) => b.id),
  };
}
