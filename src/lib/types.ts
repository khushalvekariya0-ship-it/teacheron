/**
 * Domain types shared by every page. Monetary values are always integer cents.
 * Timestamps are ISO-8601 strings in UTC; convert to the viewer's time zone only when rendering.
 */

export type ID = string;
export type Cents = number;
export type ISODate = string;

/* ─── Users & roles ─────────────────────────────────────────────────────────── */

export type Role = "student" | "parent" | "tutor" | "admin" | "support";

export interface User {
  id: ID;
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
  zip?: string;
  timezone: string;
  createdAt: ISODate;
  emailVerified: boolean;
  mfaEnabled?: boolean;
  /** Links a tutor user to their public profile. */
  tutorId?: ID;
  /** For admins / support: fine-grained permissions. */
  permissions?: Permission[];
  status: "active" | "suspended" | "pending_verification";
  /** Students aged 13–17 need a parent's consent before booking or messaging. Under-13s cannot register. */
  parentalConsent?: { parentEmail: string; status: "pending" | "granted" };
  lastLoginAt?: ISODate;
}

export type Permission =
  | "users.read"
  | "users.write"
  | "tutors.verify"
  | "bookings.manage"
  | "payments.read"
  | "payments.refund"
  | "disputes.manage"
  | "reports.moderate"
  | "conversations.read_flagged"
  | "content.manage"
  | "settings.manage"
  | "flags.manage"
  | "audit.read";

export interface Child {
  id: ID;
  parentId: ID;
  firstName: string;
  grade: Grade;
  birthYear?: number;
  learningGoals: string[];
  notes?: string;
  subjects: string[];
}

/* ─── Catalog ───────────────────────────────────────────────────────────────── */

export type Grade =
  | "K" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12"
  | "college" | "adult";

export type Level = "elementary" | "middle" | "high" | "college" | "adult";

export interface SubjectCategory {
  slug: string;
  name: string;
  description: string;
}

export interface Subject {
  slug: string;
  name: string;
  category: string; // SubjectCategory.slug
  /** Short SEO-ready summary for subject landing pages. */
  summary: string;
  popular?: boolean;
}

/* ─── Tutors ────────────────────────────────────────────────────────────────── */

export type TeachingMode = "online" | "in_person";

export type VerificationStatus =
  | "not_started"
  | "submitted"
  | "under_review"
  | "verified"
  | "rejected"
  | "expired";

export type VerificationKind = "identity" | "education" | "certification" | "background";

export type TutorCategory =
  | "certified_teacher"
  | "subject_expert"
  | "graduate_student"
  | "test_prep_specialist"
  | "learning_specialist";

export interface Education {
  degree: string;
  field: string;
  institution: string;
  year: number;
  verified: boolean;
}

export interface Certification {
  name: string;
  issuer: string;
  year: number;
  verified: boolean;
}

/** A recurring weekly window, expressed in the tutor's own time zone. day: 0 = Sunday. */
export interface WeeklyWindow {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export interface AvailabilityException {
  date: string; // YYYY-MM-DD in tutor time zone
  type: "blocked" | "custom";
  windows?: { start: string; end: string }[];
  note?: string;
}

export interface BookingRules {
  minNoticeHours: number;
  maxAdvanceDays: number;
  bufferMinutes: number;
  sessionLengths: number[]; // minutes
  requiresApproval: boolean; // false => instant booking
}

export interface TrialConfig {
  enabled: boolean;
  priceCents: Cents; // 0 => free trial
  durationMin: number;
  notes?: string;
}

export interface Tutor {
  id: ID;
  slug: string;
  firstName: string;
  lastName: string;
  headline: string;
  bio: string;
  approach: string;
  subjects: string[]; // Subject.slug
  specialties: string[];
  levels: Level[];
  category: TutorCategory;
  learningSupport: string[];
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  serviceRadiusMiles: number;
  timezone: string;
  modes: TeachingMode[];
  hourlyRateCents: Cents;
  trial: TrialConfig;
  rules: BookingRules;
  experienceYears: number;
  education: Education[];
  certifications: Certification[];
  languages: string[];
  verification: Record<VerificationKind, VerificationStatus>;
  /** Computed only from reviews attached to completed bookings. null when there are none. */
  rating: number | null;
  reviewCount: number;
  lessonsCompleted: number;
  responseTimeHours: number | null;
  availability: WeeklyWindow[];
  exceptions: AvailabilityException[];
  featured: boolean;
  joinedAt: ISODate;
  /** Avatar tone index for initials avatars (no stock photos in the preview build). */
  tone: number;
}

export interface Review {
  id: ID;
  tutorId: ID;
  bookingId: ID;
  authorName: string; // "Jordan L."
  authorRole: "student" | "parent";
  rating: 1 | 2 | 3 | 4 | 5;
  body: string;
  subject: string;
  createdAt: ISODate;
  tutorResponse?: { body: string; createdAt: ISODate };
  status: "published" | "flagged" | "removed";
}

/* ─── Requirements (tutor jobs) & applications ─────────────────────────────── */

export type RequirementStatus = "draft" | "published" | "paused" | "closed";

export interface Requirement {
  id: ID;
  ownerId: ID;
  childId?: ID;
  title: string;
  subject: string; // Subject.slug
  grade: Grade;
  objectives: string;
  modes: TeachingMode[];
  city: string;
  state: string;
  zip: string;
  days: string[]; // "Mon" ...
  timesOfDay: ("morning" | "afternoon" | "evening")[];
  sessionsPerWeek: number;
  budgetMinCents: Cents;
  budgetMaxCents: Cents;
  minExperienceYears?: number;
  languages: string[];
  preferences: string;
  details: string;
  /** File metadata only in the preview build; production stores files in S3 via signed uploads. */
  attachments?: { name: string; sizeKb: number }[];
  /** Learning-support needs, e.g. "ADHD". */
  learningSupport?: string[];
  status: RequirementStatus;
  createdAt: ISODate;
  updatedAt: ISODate;
  publishedAt?: ISODate;
  /** Last completed step of the multi-step form (drafts). */
  draftStep?: number;
}

export type ApplicationStatus =
  | "applied"
  | "viewed"
  | "shortlisted"
  | "contacted"
  | "trial_requested"
  | "hired"
  | "rejected"
  | "withdrawn"
  | "closed";

export interface Application {
  id: ID;
  requirementId: ID;
  tutorId: ID;
  message: string;
  proposedRateCents: Cents;
  status: ApplicationStatus;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/* ─── Bookings ──────────────────────────────────────────────────────────────── */

export type BookingType = "trial" | "regular";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled_by_student"
  | "cancelled_by_tutor"
  | "rescheduled"
  | "no_show_student"
  | "no_show_tutor"
  | "payment_failed"
  | "disputed"
  | "refunded";

export type PaymentStatus = "unpaid" | "authorized" | "paid" | "refunded" | "partially_refunded" | "failed";

export interface BookingEvent {
  at: ISODate;
  by: ID | "system";
  from: BookingStatus | null;
  to: BookingStatus;
  note?: string;
}

export interface Booking {
  id: ID;
  tutorId: ID;
  /** The account that booked and pays (student or parent). */
  bookerId: ID;
  /** When a parent books for a child. */
  childId?: ID;
  subject: string;
  type: BookingType;
  status: BookingStatus;
  startUtc: ISODate;
  durationMin: number;
  mode: TeachingMode;
  priceCents: Cents;
  platformFeeCents: Cents;
  discountCents: Cents;
  paymentStatus: PaymentStatus;
  meetingUrl?: string;
  locationNote?: string;
  notes?: string;
  rescheduledFromId?: ID;
  /** How many times this lesson has been moved (carried across the reschedule chain). */
  rescheduleCount?: number;
  reviewId?: ID;
  idempotencyKey: string;
  history: BookingEvent[];
  createdAt: ISODate;
}

/* ─── Messaging ─────────────────────────────────────────────────────────────── */

export interface Conversation {
  id: ID;
  tutorId: ID;
  userId: ID; // student or parent account
  childId?: ID;
  subject?: string;
  createdAt: ISODate;
  lastMessageAt: ISODate;
  blockedBy?: ID;
  reported?: boolean;
  /** Conversations about minors are visible to the parent account and flagged for safeguarding. */
  involvesMinor: boolean;
}

export interface Message {
  id: ID;
  conversationId: ID;
  /** Student/parent messages carry the user id; tutor messages carry the tutor id (Conversation.tutorId). */
  senderId: ID;
  body: string;
  createdAt: ISODate;
  readAt?: ISODate;
  attachment?: { name: string; sizeKb: number };
  /** Set when contact details were detected and masked. */
  moderation?: "contact_info_masked" | "flagged";
}

/* ─── Notifications ─────────────────────────────────────────────────────────── */

export type NotificationType =
  | "message"
  | "application"
  | "application_status"
  | "job_match"
  | "booking_request"
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "reminder"
  | "payment"
  | "refund"
  | "payout"
  | "verification"
  | "review_request"
  | "homework"
  | "progress"
  | "security";

export interface AppNotification {
  id: ID;
  userId: ID;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  createdAt: ISODate;
  read: boolean;
}

export type Channel = "in_app" | "email" | "sms";

export type NotificationPrefs = Record<
  "messages" | "bookings" | "reminders" | "payments" | "jobs" | "progress" | "marketing",
  Record<Channel, boolean>
>;

/* ─── Saved searches ────────────────────────────────────────────────────────── */

export type AlertFrequency = "instant" | "daily" | "weekly" | "off";

export interface SavedSearch {
  id: ID;
  userId: ID;
  kind: "tutors" | "jobs";
  label: string;
  query: Record<string, string>;
  frequency: AlertFrequency;
  createdAt: ISODate;
}

/* ─── Learning ──────────────────────────────────────────────────────────────── */

export interface LearningGoal {
  id: ID;
  learnerId: ID; // user id or child id
  tutorId: ID;
  subject: string;
  title: string;
  topics: { name: string; status: "not_started" | "in_progress" | "completed" }[];
  targetDate?: string;
  createdAt: ISODate;
}

export interface ProgressNote {
  id: ID;
  learnerId: ID;
  tutorId: ID;
  bookingId?: ID;
  body: string;
  rating?: 1 | 2 | 3 | 4 | 5; // understanding / confidence
  createdAt: ISODate;
}

export interface Homework {
  id: ID;
  learnerId: ID;
  tutorId: ID;
  subject: string;
  title: string;
  instructions: string;
  dueDate: string;
  status: "assigned" | "submitted" | "reviewed" | "overdue";
  submission?: { body: string; fileName?: string; submittedAt: ISODate };
  feedback?: { body: string; grade?: string; at: ISODate };
  createdAt: ISODate;
}

/* ─── Money ─────────────────────────────────────────────────────────────────── */

export interface Payment {
  id: ID;
  bookingId?: ID;
  userId: ID;
  kind: "booking" | "subscription" | "lead_credits";
  amountCents: Cents;
  status: "succeeded" | "pending" | "failed" | "refunded" | "partially_refunded";
  description: string;
  createdAt: ISODate;
  method: string; // "Visa •••• 4242"
}

export interface Payout {
  id: ID;
  tutorId: ID;
  amountCents: Cents;
  status: "scheduled" | "in_transit" | "paid" | "failed";
  arrivalDate: string;
  createdAt: ISODate;
}

export interface LeadTransaction {
  id: ID;
  tutorId: ID;
  delta: number; // + purchase, - spend
  reason: string;
  createdAt: ISODate;
}

/* ─── Trust & safety ────────────────────────────────────────────────────────── */

export interface Report {
  id: ID;
  reporterId: ID;
  targetType: "user" | "tutor" | "message" | "review" | "requirement";
  targetId: ID;
  reason: string;
  details: string;
  status: "open" | "reviewing" | "actioned" | "dismissed";
  createdAt: ISODate;
}

export type DisputeStatus =
  | "open"
  | "under_review"
  | "awaiting_information"
  | "resolved"
  | "rejected"
  | "escalated";

export interface Dispute {
  id: ID;
  bookingId: ID;
  openedBy: ID;
  reason:
    | "missed_session"
    | "tutor_no_show"
    | "student_no_show"
    | "service_issue"
    | "payment_issue"
    | "refund_issue"
    | "other";
  details: string;
  evidence: { name: string; sizeKb: number }[];
  status: DisputeStatus;
  resolution?: { outcome: "full_refund" | "partial_refund" | "credit" | "no_refund"; amountCents: Cents; note: string };
  adminNotes: { by: ID; body: string; at: ISODate }[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface VerificationRequest {
  id: ID;
  tutorId: ID;
  kind: VerificationKind;
  status: VerificationStatus;
  documents: { name: string; sizeKb: number }[];
  submittedAt: ISODate;
  reviewedBy?: ID;
  reviewedAt?: ISODate;
  note?: string;
  expiresAt?: ISODate;
}

export interface AuditLog {
  id: ID;
  actorId: ID;
  action: string; // "booking.transition", "verification.approve" ...
  targetType: string;
  targetId: ID;
  meta?: Record<string, string | number | boolean | null>;
  createdAt: ISODate;
}

export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  rolloutPercent: number; // 0-100
}

export interface Coupon {
  id: ID;
  code: string;
  kind: "percent" | "fixed";
  value: number; // percent (0-100) or cents
  minPurchaseCents: Cents;
  maxRedemptions: number;
  redemptions: number;
  expiresAt: ISODate;
  firstBookingOnly: boolean;
  active: boolean;
}

export interface Subscription {
  plan: "free" | "pro" | "premium";
  status: "active" | "past_due" | "canceled";
  renewsAt?: ISODate;
}
