import { z } from "zod";
import type { Gender, PayMethod, StudentProfile, User } from "@/lib/types";
import { isPostalCode, postalError, postalRequired } from "@/lib/postal";
import { DEFAULT_COUNTRY, isCountryCode } from "@/lib/location";

/*
 * Student learning profile: one zod schema per setup step. The same schemas back the sections of
 * Dashboard → My profile. Money is entered in whole dollars here and stored in cents.
 */

export const GENDERS: { value: Gender; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not", label: "Prefer not to say" },
];
export const GENDER_LABEL = Object.fromEntries(GENDERS.map((g) => [g.value, g.label])) as Record<Gender, string>;

export const GOALS = [
  "Improve my grades",
  "Prepare for a test (SAT, ACT, AP…)",
  "Homework help",
  "Catch up on missed topics",
  "Get ahead of my class",
  "Learn a new skill",
  "College or career prep",
];

export const TUTOR_GENDER_LABEL: Record<StudentProfile["tutorGender"], string> = { any: "No preference", female: "Female tutor", male: "Male tutor" };

export const EXPERIENCE_OPTIONS = [
  { value: "0", label: "Any experience" },
  { value: "1", label: "1+ years" },
  { value: "3", label: "3+ years" },
  { value: "5", label: "5+ years" },
  { value: "10", label: "10+ years" },
];

export const LESSON_LENGTHS = [30, 45, 60, 90] as const;

export const START_OPTIONS: { value: StudentProfile["startWhen"]; label: string; description: string }[] = [
  { value: "asap", label: "As soon as possible", description: "Ready to book this week." },
  { value: "this_month", label: "Within a month", description: "Planning ahead." },
  { value: "exploring", label: "Just exploring", description: "Comparing tutors first." },
];
export const START_LABEL = Object.fromEntries(START_OPTIONS.map((o) => [o.value, o.label])) as Record<StudentProfile["startWhen"], string>;

export const PAYER_LABEL: Record<StudentProfile["payer"], string> = { self: "I pay", parent: "My parent or guardian pays" };

export const PAY_METHOD_OPTIONS: { value: PayMethod; label: string; description: string }[] = [
  { value: "card", label: "Credit or debit card", description: "Visa, Mastercard, Amex or Discover." },
  { value: "upi", label: "UPI", description: "Pay from your bank app." },
  { value: "wallet", label: "Study Credits", description: "A prepaid balance you top up." },
];
export const PAY_METHOD_NAME = Object.fromEntries(PAY_METHOD_OPTIONS.map((o) => [o.value, o.label])) as Record<PayMethod, string>;

export const BUDGET_PRESETS = [
  { label: "Under $30", min: 15, max: 30 },
  { label: "$30–$50", min: 30, max: 50 },
  { label: "$50–$80", min: 50, max: 80 },
  { label: "$80+", min: 80, max: 150 },
];

/** Basic information. Age limits depend on how the student signed up (13–17 with a parent's consent, or 18+). */
export function basicSchema(teen: boolean) {
  return z
    .object({
    firstName: z.string().trim().min(1, "Enter your first name.").max(50, "Keep it under 50 characters."),
    lastName: z.string().trim().min(1, "Enter your last name.").max(50, "Keep it under 50 characters."),
    age: z
      .number({ invalid_type_error: "Enter your age." })
      .int("Use whole years.")
      .refine((n) => (teen ? n >= 13 && n <= 17 : n >= 18 && n <= 99), teen ? "You signed up as 13–17, so enter an age from 13 to 17." : "Enter an age from 18 to 99."),
    gender: z.enum(["female", "male", "non_binary", "prefer_not"]).optional(),
    country: z.string().refine((v) => isCountryCode(v), "Choose your country."),
    city: z.string().trim().min(2, "Enter your city.").max(60, "Keep it under 60 characters."),
    state: z.string().min(1, "Choose your state or province.").max(60),
    zip: z.string().trim(),
    photoUrl: z.string().optional(),
  })
    .superRefine((v, ctx) => {
      if (v.zip ? !isPostalCode(v.zip, v.country) : postalRequired(v.country)) ctx.addIssue({ code: "custom", path: ["zip"], message: postalError(v.country) });
    });
}

export const learningSchema = z.object({
  grade: z.enum(["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "college", "adult"], { errorMap: () => ({ message: "Choose your grade or level." }) }),
  subjects: z.array(z.string()).min(1, "Choose at least one subject.").max(5, "Choose up to 5 subjects."),
  goals: z.array(z.string()).min(1, "Choose at least one goal."),
  details: z.string().max(600, "Keep this under 600 characters."),
  learningSupport: z.array(z.string()),
});

export const preferencesSchema = z.object({
  modes: z.array(z.enum(["online", "in_person"])).min(1, "Choose online, in person, or both."),
  travelMiles: z.number().int().min(1).max(50),
  tutorGender: z.enum(["any", "female", "male"]),
  tutorLanguages: z.array(z.string()).min(1, "Choose at least one language."),
  tutorCategories: z.array(z.enum(["certified_teacher", "subject_expert", "graduate_student", "test_prep_specialist", "learning_specialist"])),
  minExperienceYears: z.number().int().min(0).max(60),
});

export const scheduleSchema = z.object({
  days: z.array(z.string()).min(1, "Choose at least one day."),
  timesOfDay: z.array(z.enum(["morning", "afternoon", "evening"])).min(1, "Choose at least one time of day."),
  sessionsPerWeek: z.number().int().min(1).max(7),
  lessonMinutes: z.number().refine((v) => (LESSON_LENGTHS as readonly number[]).includes(v), "Choose a lesson length."),
  startWhen: z.enum(["asap", "this_month", "exploring"]),
});

const dollars = z
  .number({ invalid_type_error: "Enter a whole-dollar amount." })
  .int("Use whole dollars.")
  .min(10, "The lowest is $10 an hour.")
  .max(500, "The highest is $500 an hour.");

export const budgetSchema = z
  .object({
    budgetMin: dollars,
    budgetMax: dollars,
    payer: z.enum(["self", "parent"]),
    payMethod: z.enum(["card", "upi", "wallet"]),
  })
  .refine((v) => v.budgetMin <= v.budgetMax, { path: ["budgetMax"], message: "This has to be at least your lowest amount." });

export type BasicValues = z.infer<ReturnType<typeof basicSchema>>;
export type LearningValues = z.infer<typeof learningSchema>;
export type PreferencesValues = z.infer<typeof preferencesSchema>;
export type ScheduleValues = z.infer<typeof scheduleSchema>;
export type BudgetValues = z.infer<typeof budgetSchema>;

export const STUDENT_STEPS = [
  { n: 1, title: "Basic information", short: "Basic info", description: "Who you are. Only you can see your age, gender and contact details." },
  { n: 2, title: "Learning requirements", short: "Learning", description: "What you want to learn and what you want to achieve." },
  { n: 3, title: "Tutor preferences", short: "Tutor", description: "The kind of tutor you'd like to work with." },
  { n: 4, title: "Schedule & availability", short: "Schedule", description: "When you're free for lessons. Times are in your own time zone." },
  { n: 5, title: "Budget & payment", short: "Budget", description: "What you'd like to spend, and how you'll pay when you book." },
  { n: 6, title: "Review & finish", short: "Review", description: "Check your answers. You can change any of them later in My profile." },
] as const;
export const STUDENT_TOTAL_STEPS = STUDENT_STEPS.length;

/* ─── Profile ⇄ form values ─────────────────────────────────────────────────── */

export const basicValues = (me: User, p: StudentProfile): BasicValues => ({
  firstName: me.firstName,
  lastName: me.lastName,
  age: p.age ?? Number.NaN,
  gender: p.gender,
  country: me.country ?? DEFAULT_COUNTRY,
  city: me.city ?? "",
  state: me.state ?? "",
  zip: me.zip ?? "",
  photoUrl: p.photoUrl || undefined,
});
export const learningValues = (p: StudentProfile): LearningValues => ({
  grade: p.grade as LearningValues["grade"],
  subjects: p.subjects,
  goals: p.goals,
  details: p.details ?? "",
  learningSupport: p.learningSupport,
});
export const preferencesValues = (p: StudentProfile): PreferencesValues => ({
  modes: p.modes,
  travelMiles: p.travelMiles,
  tutorGender: p.tutorGender,
  tutorLanguages: p.tutorLanguages,
  tutorCategories: p.tutorCategories,
  minExperienceYears: p.minExperienceYears,
});
export const scheduleValues = (p: StudentProfile): ScheduleValues => ({
  days: p.days,
  timesOfDay: p.timesOfDay,
  sessionsPerWeek: p.sessionsPerWeek,
  lessonMinutes: p.lessonMinutes,
  startWhen: p.startWhen,
});
export const budgetValues = (p: StudentProfile, teen: boolean): BudgetValues => ({
  budgetMin: Math.round(p.budgetMinCents / 100),
  budgetMax: Math.round(p.budgetMaxCents / 100),
  // Teens usually pay through a parent; that's the starting choice until they save their own.
  payer: p.step >= 5 ? p.payer : teen ? "parent" : p.payer,
  payMethod: p.payMethod,
});
export const budgetToProfile = (v: BudgetValues) => ({ budgetMinCents: v.budgetMin * 100, budgetMaxCents: v.budgetMax * 100, payer: v.payer, payMethod: v.payMethod });

/** What's filled in, for the profile-strength list. */
export function studentChecklist(me: User, p: StudentProfile) {
  return [
    { key: "basic", label: "Age and location", done: !!p.age && !!me.city && !!me.zip, href: "/dashboard/profile#basic" },
    { key: "photo", label: "Profile photo", done: !!p.photoUrl, href: "/dashboard/profile#basic" },
    { key: "learning", label: "Subjects and goals", done: p.subjects.length > 0 && p.goals.length > 0 && !!p.grade, href: "/dashboard/profile#learning" },
    { key: "preferences", label: "Tutor preferences", done: p.step >= 3, href: "/dashboard/profile#preferences" },
    { key: "schedule", label: "Days and times you're free", done: p.days.length > 0 && p.timesOfDay.length > 0, href: "/dashboard/profile#schedule" },
    { key: "budget", label: "Budget and payment", done: p.step >= 5, href: "/dashboard/profile#budget" },
  ];
}
