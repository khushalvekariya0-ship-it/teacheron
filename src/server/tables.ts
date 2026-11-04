import "server-only";
import type { Booking, Tutor } from "@/lib/types";
import type { Collection, Data } from "@/lib/domain/data";
import { resolveTutor } from "@/lib/domain/data";

/*
 * How each collection of the domain data maps to a table. A spec lists the domain fields and their
 * columns; `rowsOf` turns a collection into rows (for writing and for change detection) and
 * `fromRow` turns a row back into the domain object. Record-shaped collections (favorites by user,
 * subscriptions by tutor …) are flattened to one row per entry.
 */

export type Row = Record<string, unknown>;

/** v = plain value · ts = timestamptz (ISO string in the domain) · json = jsonb · flag = boolean column that is optional in the domain. */
type Kind = "v" | "ts" | "json" | "flag";
type Col = readonly [column: string, kind: Kind, optional?: boolean];

export interface TableSpec {
  collection: Collection;
  table: string;
  key: readonly string[];
  cols: Record<string, Col>;
  /** Columns written when a row is created but left alone on update. */
  insertOnly?: readonly string[];
  /** Domain value → rows. */
  rowsOf(data: Data): Row[];
  /** Row → domain value (for array collections; record collections use `assemble`). */
  fromRow?(row: Row): unknown;
  /** Rows → domain value for record-shaped and singleton collections. */
  assemble?(rows: Row[]): unknown;
  /** Rows are ordered by this when loaded. */
  order: string;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v === null || v === undefined ? v : new Date(String(v)).toISOString());

export function toRowWith(cols: Record<string, Col>, x: Record<string, unknown>): Row {
  const row: Row = {};
  for (const [field, [column, kind]] of Object.entries(cols)) {
    const v = x[field];
    row[column] = kind === "flag" ? !!v : v === undefined ? null : kind === "ts" && v !== null ? iso(v) : v;
  }
  return row;
}

export function fromRowWith<T>(cols: Record<string, Col>, row: Row): T {
  const out: Record<string, unknown> = {};
  for (const [field, [column, kind, optional]] of Object.entries(cols)) {
    const v = row[column];
    if (kind === "flag") {
      if (v) out[field] = true;
      else if (!optional) out[field] = false;
      continue;
    }
    if (v === null || v === undefined) {
      if (!optional) out[field] = null;
      continue;
    }
    out[field] = kind === "ts" ? iso(v) : v;
  }
  return out as T;
}

function arraySpec(
  collection: Collection,
  table: string,
  cols: Record<string, Col>,
  order: string,
  extra?: { key?: readonly string[]; insertOnly?: readonly string[]; extraCols?: (x: Record<string, unknown>, data: Data, index: number) => Row },
): TableSpec {
  return {
    collection,
    table,
    key: extra?.key ?? ["id"],
    cols,
    insertOnly: extra?.insertOnly,
    order,
    rowsOf: (data) =>
      (data[collection] as unknown as Record<string, unknown>[]).map((x, i) => ({ ...toRowWith(cols, x), ...extra?.extraCols?.(x, data, i) })),
    fromRow: (row) => fromRowWith(cols, row),
  };
}

/* ─── Specs ──────────────────────────────────────────────────────────────── */

const USER: Record<string, Col> = {
  id: ["id", "v"], role: ["role", "v"], firstName: ["first_name", "v"], lastName: ["last_name", "v"], email: ["email", "v"],
  phone: ["phone", "v", true], country: ["country", "v", true], city: ["city", "v", true], state: ["state", "v", true], zip: ["zip", "v", true],
  timezone: ["timezone", "v"], createdAt: ["created_at", "ts"], emailVerified: ["email_verified", "v"], mfaEnabled: ["mfa_enabled", "flag", true],
  tutorId: ["tutor_id", "v", true], permissions: ["permissions", "v", true], status: ["status", "v"],
  parentalConsent: ["parental_consent", "json", true], lastLoginAt: ["last_login_at", "ts", true], chatModeration: ["chat_moderation", "json", true],
};

const CHILD: Record<string, Col> = {
  id: ["id", "v"], parentId: ["parent_id", "v"], firstName: ["first_name", "v"], grade: ["grade", "v"], birthYear: ["birth_year", "v", true],
  learningGoals: ["learning_goals", "v"], notes: ["notes", "v", true], subjects: ["subjects", "v"],
};

export const TUTOR_COLS: Record<string, Col> = {
  id: ["id", "v"], slug: ["slug", "v"], firstName: ["first_name", "v"], lastName: ["last_name", "v"], headline: ["headline", "v"], bio: ["bio", "v"],
  approach: ["approach", "v"], subjects: ["subjects", "v"], specialties: ["specialties", "v"], levels: ["levels", "v"], category: ["category", "v"],
  learningSupport: ["learning_support", "v"], country: ["country", "v", true], city: ["city", "v"], state: ["state", "v"], zip: ["zip", "v"], lat: ["lat", "v"], lng: ["lng", "v"],
  serviceRadiusMiles: ["service_radius_miles", "v"], timezone: ["timezone", "v"], modes: ["modes", "v"], hourlyRateCents: ["hourly_rate_cents", "v"],
  trial: ["trial", "json"], rules: ["rules", "json"], experienceYears: ["experience_years", "v"], education: ["education", "json"],
  certifications: ["certifications", "json"], languages: ["languages", "v"], verification: ["verification", "json"], rating: ["rating", "v"],
  reviewCount: ["review_count", "v"], lessonsCompleted: ["lessons_completed", "v"], responseTimeHours: ["response_time_hours", "v"],
  availability: ["availability", "json"], exceptions: ["exceptions", "json"], featured: ["featured", "v"], joinedAt: ["joined_at", "ts"],
  tone: ["tone", "v"], photoUrl: ["photo_url", "v", true], introVideoUrl: ["intro_video_url", "v", true], hidden: ["hidden", "flag", true],
};

const REQUIREMENT: Record<string, Col> = {
  id: ["id", "v"], ownerId: ["owner_id", "v"], childId: ["child_id", "v", true], title: ["title", "v"], subject: ["subject", "v"], grade: ["grade", "v"],
  objectives: ["objectives", "v"], modes: ["modes", "v"], country: ["country", "v", true], city: ["city", "v"], state: ["state", "v"], zip: ["zip", "v"], days: ["days", "v"],
  timesOfDay: ["times_of_day", "v"], sessionsPerWeek: ["sessions_per_week", "v"], budgetMinCents: ["budget_min_cents", "v"],
  budgetMaxCents: ["budget_max_cents", "v"], minExperienceYears: ["min_experience_years", "v", true], languages: ["languages", "v"],
  preferences: ["preferences", "v"], details: ["details", "v"], attachments: ["attachments", "json", true], learningSupport: ["learning_support", "v", true],
  status: ["status", "v"], createdAt: ["created_at", "ts"], updatedAt: ["updated_at", "ts"], publishedAt: ["published_at", "ts", true],
  draftStep: ["draft_step", "v", true],
};

const APPLICATION: Record<string, Col> = {
  id: ["id", "v"], requirementId: ["requirement_id", "v"], tutorId: ["tutor_id", "v"], message: ["message", "v"],
  proposedRateCents: ["proposed_rate_cents", "v"], status: ["status", "v"], createdAt: ["created_at", "ts"], updatedAt: ["updated_at", "ts"],
};

const BOOKING: Record<string, Col> = {
  id: ["id", "v"], tutorId: ["tutor_id", "v"], bookerId: ["booker_id", "v"], childId: ["child_id", "v", true], subject: ["subject", "v"], type: ["type", "v"],
  status: ["status", "v"], startUtc: ["start_utc", "ts"], durationMin: ["duration_min", "v"], mode: ["mode", "v"], priceCents: ["price_cents", "v"],
  platformFeeCents: ["platform_fee_cents", "v"], discountCents: ["discount_cents", "v"], paymentStatus: ["payment_status", "v"],
  meetingUrl: ["meeting_url", "v", true], videoLink: ["video_link", "v", true], videoPasscode: ["video_passcode", "v", true], recordingUrl: ["recording_url", "v", true],
  locationNote: ["location_note", "v", true], notes: ["notes", "v", true],
  rescheduledFromId: ["rescheduled_from_id", "v", true], rescheduleCount: ["reschedule_count", "v", true], reviewId: ["review_id", "v", true],
  idempotencyKey: ["idempotency_key", "v"], history: ["history", "json"], createdAt: ["created_at", "ts"],
};

const REVIEW: Record<string, Col> = {
  id: ["id", "v"], tutorId: ["tutor_id", "v"], bookingId: ["booking_id", "v"], authorName: ["author_name", "v"], authorRole: ["author_role", "v"],
  rating: ["rating", "v"], body: ["body", "v"], subject: ["subject", "v"], createdAt: ["created_at", "ts"], tutorResponse: ["tutor_response", "json", true],
  status: ["status", "v"],
};

const CONVERSATION: Record<string, Col> = {
  id: ["id", "v"], tutorId: ["tutor_id", "v"], userId: ["user_id", "v"], childId: ["child_id", "v", true], subject: ["subject", "v", true],
  createdAt: ["created_at", "ts"], lastMessageAt: ["last_message_at", "ts"], blockedBy: ["blocked_by", "v", true], reported: ["reported", "flag", true],
  involvesMinor: ["involves_minor", "v"],
};

const MESSAGE: Record<string, Col> = {
  id: ["id", "v"], conversationId: ["conversation_id", "v"], senderId: ["sender_id", "v"], body: ["body", "v"], createdAt: ["created_at", "ts"],
  readAt: ["read_at", "ts", true], attachment: ["attachment", "json", true], moderation: ["moderation", "v", true],
};

const NOTIFICATION: Record<string, Col> = {
  id: ["id", "v"], userId: ["user_id", "v"], type: ["type", "v"], title: ["title", "v"], body: ["body", "v"], href: ["href", "v", true],
  createdAt: ["created_at", "ts"], read: ["read", "v"],
};

const GOAL: Record<string, Col> = {
  id: ["id", "v"], learnerId: ["learner_id", "v"], tutorId: ["tutor_id", "v"], subject: ["subject", "v"], title: ["title", "v"], topics: ["topics", "json"],
  targetDate: ["target_date", "v", true], createdAt: ["created_at", "ts"],
};

const PROGRESS: Record<string, Col> = {
  id: ["id", "v"], learnerId: ["learner_id", "v"], tutorId: ["tutor_id", "v"], bookingId: ["booking_id", "v", true], body: ["body", "v"],
  rating: ["rating", "v", true], createdAt: ["created_at", "ts"],
};

const HOMEWORK: Record<string, Col> = {
  id: ["id", "v"], learnerId: ["learner_id", "v"], tutorId: ["tutor_id", "v"], subject: ["subject", "v"], title: ["title", "v"],
  instructions: ["instructions", "v"], dueDate: ["due_date", "v"], status: ["status", "v"], submission: ["submission", "json", true],
  feedback: ["feedback", "json", true], createdAt: ["created_at", "ts"],
};

const PAYMENT: Record<string, Col> = {
  id: ["id", "v"], bookingId: ["booking_id", "v", true], userId: ["user_id", "v"], kind: ["kind", "v"], amountCents: ["amount_cents", "v"],
  status: ["status", "v"], description: ["description", "v"], createdAt: ["created_at", "ts"], method: ["method", "v"],
};

const PAYOUT: Record<string, Col> = {
  id: ["id", "v"], tutorId: ["tutor_id", "v"], amountCents: ["amount_cents", "v"], status: ["status", "v"], arrivalDate: ["arrival_date", "v"], createdAt: ["created_at", "ts"],
};

const LEAD_TX: Record<string, Col> = { id: ["id", "v"], tutorId: ["tutor_id", "v"], delta: ["delta", "v"], reason: ["reason", "v"], createdAt: ["created_at", "ts"] };

const WALLET_TX: Record<string, Col> = {
  id: ["id", "v"], userId: ["user_id", "v"], deltaCents: ["delta_cents", "v"], kind: ["kind", "v"], description: ["description", "v"],
  bookingId: ["booking_id", "v", true], createdAt: ["created_at", "ts"],
};

const REPORT: Record<string, Col> = {
  id: ["id", "v"], reporterId: ["reporter_id", "v"], targetType: ["target_type", "v"], targetId: ["target_id", "v"], reason: ["reason", "v"],
  details: ["details", "v"], status: ["status", "v"], createdAt: ["created_at", "ts"],
};

const CONTACT_FLAG: Record<string, Col> = {
  id: ["id", "v"], userId: ["user_id", "v"], channel: ["channel", "v"], source: ["source", "v"], contextId: ["context_id", "v", true],
  recipientId: ["recipient_id", "v", true], kinds: ["kinds", "v"], excerpt: ["excerpt", "v"], fileName: ["file_name", "v", true], status: ["status", "v"],
  reviewedBy: ["reviewed_by", "v", true], reviewedAt: ["reviewed_at", "ts", true], createdAt: ["created_at", "ts"],
};

const DISPUTE: Record<string, Col> = {
  id: ["id", "v"], bookingId: ["booking_id", "v"], openedBy: ["opened_by", "v"], reason: ["reason", "v"], details: ["details", "v"],
  evidence: ["evidence", "json"], status: ["status", "v"], resolution: ["resolution", "json", true], adminNotes: ["admin_notes", "json"],
  createdAt: ["created_at", "ts"], updatedAt: ["updated_at", "ts"],
};

const VERIFICATION: Record<string, Col> = {
  id: ["id", "v"], tutorId: ["tutor_id", "v"], kind: ["kind", "v"], status: ["status", "v"], documents: ["documents", "json"],
  submittedAt: ["submitted_at", "ts"], reviewedBy: ["reviewed_by", "v", true], reviewedAt: ["reviewed_at", "ts", true], note: ["note", "v", true],
  expiresAt: ["expires_at", "ts", true],
};

const AUDIT: Record<string, Col> = {
  id: ["id", "v"], actorId: ["actor_id", "v"], action: ["action", "v"], targetType: ["target_type", "v"], targetId: ["target_id", "v"],
  meta: ["meta", "json", true], createdAt: ["created_at", "ts"],
};

const COUPON: Record<string, Col> = {
  id: ["id", "v"], code: ["code", "v"], kind: ["kind", "v"], value: ["value", "v"], minPurchaseCents: ["min_purchase_cents", "v"],
  maxRedemptions: ["max_redemptions", "v"], redemptions: ["redemptions", "v"], expiresAt: ["expires_at", "ts"],
  firstBookingOnly: ["first_booking_only", "v"], active: ["active", "v"],
};

const SAVED_SEARCH: Record<string, Col> = {
  id: ["id", "v"], userId: ["user_id", "v"], kind: ["kind", "v"], label: ["label", "v"], query: ["query", "json"], frequency: ["frequency", "v"],
  createdAt: ["created_at", "ts"],
};

const FLAG: Record<string, Col> = { key: ["key", "v"], label: ["label", "v"], description: ["description", "v"], enabled: ["enabled", "v"], rolloutPercent: ["rollout_percent", "v"] };
const CATEGORY: Record<string, Col> = { slug: ["slug", "v"], name: ["name", "v"], description: ["description", "v"], hidden: ["hidden", "flag", true] };
const SUBJECT: Record<string, Col> = {
  slug: ["slug", "v"], name: ["name", "v"], category: ["category", "v"], summary: ["summary", "v"], popular: ["popular", "flag", true], hidden: ["hidden", "flag", true],
};
const BLOG: Record<string, Col> = {
  slug: ["slug", "v"], title: ["title", "v"], excerpt: ["excerpt", "v"], category: ["category", "v"], author: ["author", "v"], date: ["published_on", "v"],
  readMinutes: ["read_minutes", "v"], body: ["body", "json"], status: ["status", "v"],
};
const FAQ: Record<string, Col> = { id: ["id", "v"], audience: ["audience", "v"], q: ["question", "v"], a: ["answer", "v"], published: ["published", "v"] };

/** Tutors are written with their pending overrides merged in. */
const tutorSpec: TableSpec = {
  collection: "registeredTutors",
  table: "tutors",
  key: ["id"],
  cols: TUTOR_COLS,
  order: "joined_at",
  rowsOf: (data) => data.registeredTutors.map((t) => toRowWith(TUTOR_COLS, resolveTutor(data, t.id) as unknown as Record<string, unknown>)),
  fromRow: (row) => fromRowWith<Tutor>(TUTOR_COLS, row),
};

function bufferMs(data: Data, tutorId: string) {
  return (resolveTutor(data, tutorId)?.rules.bufferMinutes ?? 0) * 60_000;
}

const bookingSpec = arraySpec("bookings", "bookings", BOOKING, "created_at desc", {
  insertOnly: ["blocked_until"],
  extraCols: (x, data) => {
    const b = x as unknown as Booking;
    const end = new Date(b.startUtc).getTime() + b.durationMin * 60_000;
    return { end_utc: new Date(end).toISOString(), blocked_until: new Date(end + bufferMs(data, b.tutorId)).toISOString() };
  },
});

/** One row per (owner, item) pair, keeping list order in `position`. */
function listMapSpec(collection: "favorites" | "savedJobs", table: string, itemColumn: string): TableSpec {
  return {
    collection,
    table,
    key: ["user_id", itemColumn],
    cols: {},
    order: "position",
    rowsOf: (data) => Object.entries(data[collection]).flatMap(([userId, ids]) => ids.map((id, position) => ({ user_id: userId, [itemColumn]: id, position }))),
    assemble: (rows) => {
      const out: Record<string, string[]> = {};
      for (const r of rows) (out[String(r.user_id)] ??= []).push(String(r[itemColumn]));
      return out;
    },
  };
}

export const SPECS: TableSpec[] = [
  arraySpec("users", "users", USER, "created_at"),
  tutorSpec,
  arraySpec("children", "children", CHILD, "created_at"),
  {
    collection: "studentProfiles", table: "student_profiles", key: ["user_id"], cols: {}, order: "user_id",
    rowsOf: (d) => Object.values(d.studentProfiles).map((p) => ({ user_id: p.userId, profile: p, updated_at: p.updatedAt || new Date().toISOString() })),
    assemble: (rows) => Object.fromEntries(rows.map((r) => [String(r.user_id), r.profile])),
  },
  {
    collection: "notificationPrefs", table: "notification_prefs", key: ["user_id"], cols: {}, order: "user_id",
    rowsOf: (d) => Object.entries(d.notificationPrefs).map(([userId, prefs]) => ({ user_id: userId, prefs })),
    assemble: (rows) => Object.fromEntries(rows.map((r) => [String(r.user_id), r.prefs])),
  },
  {
    collection: "onboarding", table: "onboarding_drafts", key: ["user_id"], cols: {}, order: "user_id",
    rowsOf: (d) => Object.entries(d.onboarding).map(([userId, x]) => ({ user_id: userId, step: x.step, data: x.data, updated_at: x.updatedAt, submitted_at: x.submittedAt ?? null })),
    assemble: (rows) => Object.fromEntries(rows.map((r) => [String(r.user_id), { step: r.step, data: r.data, updatedAt: iso(r.updated_at), ...(r.submitted_at ? { submittedAt: iso(r.submitted_at) } : {}) }])),
  },
  {
    collection: "subscriptions", table: "subscriptions", key: ["tutor_id"], cols: {}, order: "tutor_id",
    rowsOf: (d) => Object.entries(d.subscriptions).map(([tutorId, s]) => ({ tutor_id: tutorId, plan: s.plan, status: s.status, renews_at: s.renewsAt ?? null })),
    assemble: (rows) => Object.fromEntries(rows.map((r) => [String(r.tutor_id), { plan: r.plan, status: r.status, ...(r.renews_at ? { renewsAt: iso(r.renews_at) } : {}) }])),
  },
  listMapSpec("favorites", "favorites", "tutor_id"),
  arraySpec("savedSearches", "saved_searches", SAVED_SEARCH, "created_at desc"),
  arraySpec("requirements", "requirements", REQUIREMENT, "created_at desc"),
  listMapSpec("savedJobs", "saved_jobs", "requirement_id"),
  arraySpec("applications", "applications", APPLICATION, "created_at desc"),
  bookingSpec,
  arraySpec("reviews", "reviews", REVIEW, "created_at desc"),
  arraySpec("conversations", "conversations", CONVERSATION, "created_at desc"),
  arraySpec("messages", "messages", MESSAGE, "created_at"),
  arraySpec("notifications", "notifications", NOTIFICATION, "created_at desc"),
  arraySpec("goals", "learning_goals", GOAL, "created_at desc"),
  arraySpec("progressNotes", "progress_notes", PROGRESS, "created_at desc"),
  arraySpec("homework", "homework", HOMEWORK, "created_at desc"),
  arraySpec("payments", "payments", PAYMENT, "created_at desc"),
  arraySpec("payouts", "payouts", PAYOUT, "created_at desc"),
  arraySpec("leadTransactions", "lead_transactions", LEAD_TX, "created_at desc"),
  arraySpec("walletTransactions", "wallet_transactions", WALLET_TX, "created_at desc"),
  arraySpec("reports", "reports", REPORT, "created_at desc"),
  arraySpec("contactFlags", "contact_flags", CONTACT_FLAG, "created_at desc"),
  arraySpec("disputes", "disputes", DISPUTE, "created_at desc"),
  arraySpec("verificationRequests", "verification_requests", VERIFICATION, "submitted_at desc"),
  arraySpec("auditLogs", "audit_logs", AUDIT, "created_at desc"),
  arraySpec("coupons", "coupons", COUPON, "created_at desc"),
  arraySpec("flags", "feature_flags", FLAG, "position", { key: ["key"], extraCols: (_x, _d, i) => ({ position: i }) }),
  {
    collection: "catalog", table: "subject_categories", key: ["slug"], cols: CATEGORY, order: "position",
    rowsOf: (d) => d.catalog.categories.map((c, i) => ({ ...toRowWith(CATEGORY, c as unknown as Record<string, unknown>), position: i })),
    fromRow: (r) => fromRowWith(CATEGORY, r),
  },
  {
    collection: "catalog", table: "subjects", key: ["slug"], cols: SUBJECT, order: "position",
    rowsOf: (d) => d.catalog.subjects.map((s, i) => ({ ...toRowWith(SUBJECT, s as unknown as Record<string, unknown>), position: i })),
    fromRow: (r) => fromRowWith(SUBJECT, r),
  },
  {
    collection: "policy", table: "platform_settings", key: ["key"], cols: {}, order: "key",
    rowsOf: (d) => [{ key: "booking_policy", value: d.policy }],
  },
  {
    collection: "platformFeeBps", table: "platform_settings", key: ["key"], cols: {}, order: "key",
    rowsOf: (d) => [{ key: "platform_fee_bps", value: d.platformFeeBps }],
  },
  arraySpec("blogPosts", "blog_posts", BLOG, "published_on desc", { key: ["slug"] }),
  arraySpec("faqs", "faqs", FAQ, "position", { extraCols: (_x, _d, i) => ({ position: i }) }),
  {
    collection: "testimonials", table: "testimonials", key: ["id"], cols: {}, order: "position",
    rowsOf: (d) =>
      d.testimonials.map((t, i) => ({
        id: t.id, quote: t.quote, name: t.name, context: t.context, used_label: t.used.label, used_href: t.used.href,
        consent_confirmed: t.consentConfirmed, published: t.published, position: i,
      })),
    fromRow: (r) => ({
      id: r.id, quote: r.quote, name: r.name, context: r.context, used: { label: r.used_label, href: r.used_href },
      consentConfirmed: r.consent_confirmed, published: r.published,
    }),
  },
];

/** Tables whose collection holds one value in the settings table (not a list of rows). */
export const SETTING_COLLECTIONS = new Set<Collection>(["policy", "platformFeeBps"]);

/** jsonb columns per table — their values are sent with sql.json(). */
export const JSON_COLUMNS: Record<string, Set<string>> = Object.fromEntries(
  SPECS.map((s) => [s.table, new Set(Object.values(s.cols).filter(([, kind]) => kind === "json").map(([column]) => column))]),
);
for (const [table, cols] of [["student_profiles", ["profile"]], ["notification_prefs", ["prefs"]], ["onboarding_drafts", ["data"]], ["platform_settings", ["value"]]] as const) {
  JSON_COLUMNS[table] = new Set(cols);
}

/** Tables are written parents-first (and deleted children-first) so foreign keys hold. */
export const WRITE_ORDER = [
  "subject_categories", "subjects", "feature_flags", "platform_settings", "tutors", "users", "children", "student_profiles", "notification_prefs",
  "onboarding_drafts", "subscriptions", "lead_transactions", "verification_requests", "payouts", "favorites", "saved_searches", "requirements",
  "saved_jobs", "applications", "bookings", "reviews", "disputes", "conversations", "messages", "notifications", "learning_goals", "progress_notes",
  "homework", "payments", "wallet_transactions", "coupons", "reports", "contact_flags", "audit_logs", "blog_posts", "faqs", "testimonials",
];

export const keyOf = (spec: TableSpec, row: Row) => spec.key.map((k) => String(row[k])).join("\u0000");
