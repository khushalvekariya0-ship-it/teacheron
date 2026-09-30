import { z } from "zod";
import type { User } from "@/lib/types";
import { validateWeek } from "@/components/dashboard/tutor/AvailabilityEditor";

/*
 * Tutor onboarding: one zod schema per step. Keys match what the store's `submitOnboarding()` reads
 * (hourlyRate and trialPrice are whole dollars; everything else is stored as-is).
 */

const MAX_YEAR = new Date().getFullYear() + 6;
const year = z
  .number({ invalid_type_error: "Enter a year." })
  .int("Enter a year.")
  .min(1950, "Enter a year after 1950.")
  .max(MAX_YEAR, `Enter a year up to ${MAX_YEAR}.`);

export const personalSchema = z.object({
  phone: z.string().trim().refine((v) => v.replace(/\D/g, "").length === 10, "Enter a 10-digit US phone number."),
  city: z.string().trim().min(2, "Enter your city.").max(60, "Keep it under 60 characters."),
  state: z.string().min(2, "Choose your state."),
  zip: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit ZIP code."),
});

export const subjectsSchema = z.object({
  subjects: z.array(z.string()).min(1, "Choose at least one subject.").max(10, "Choose up to 10 subjects."),
  levels: z.array(z.enum(["elementary", "middle", "high", "college", "adult"])).min(1, "Choose at least one level."),
  specialties: z.array(z.string().max(40)).max(8, "Add up to 8 specialties."),
});

export const experienceSchema = z.object({
  experienceYears: z
    .number({ invalid_type_error: "Enter your years of teaching experience." })
    .int("Use whole years.")
    .min(0, "Enter 0 or more years.")
    .max(60, "Enter 60 years or fewer."),
  category: z.enum(["certified_teacher", "subject_expert", "graduate_student", "test_prep_specialist", "learning_specialist"], {
    errorMap: () => ({ message: "Choose the option that best describes you." }),
  }),
  learningSupport: z.array(z.string()),
});

export const credentialsSchema = z.object({
  education: z
    .array(
      z.object({
        degree: z.string().trim().min(2, "Add the degree, e.g. B.S."),
        field: z.string().trim().min(2, "Add the field of study."),
        institution: z.string().trim().min(2, "Add the school or university."),
        year,
      }),
    )
    .max(6, "Add up to 6 entries."),
  certifications: z
    .array(
      z.object({
        name: z.string().trim().min(2, "Add the certification name."),
        issuer: z.string().trim().min(2, "Add the issuing organization."),
        year,
      }),
    )
    .max(6, "Add up to 6 entries."),
});

export const modesSchema = z.object({
  modes: z.array(z.enum(["online", "in_person"])).min(1, "Choose at least one way to teach."),
  serviceRadiusMiles: z
    .number({ invalid_type_error: "Enter a distance in miles." })
    .int("Use whole miles.")
    .min(1, "Enter at least 1 mile.")
    .max(50, "Enter 50 miles or fewer."),
});

export const TRIAL_LENGTHS = [15, 30, 45, 60] as const;

export const pricingSchema = z.object({
  hourlyRate: z
    .number({ invalid_type_error: "Enter your hourly rate." })
    .int("Use whole dollars.")
    .min(15, "The minimum rate is $15 per hour.")
    .max(500, "The maximum rate is $500 per hour."),
  trialEnabled: z.boolean(),
  trialPrice: z
    .number({ invalid_type_error: "Enter a trial price (0 for free)." })
    .int("Use whole dollars.")
    .min(0, "Enter 0 or more.")
    .max(200, "Trial lessons can be up to $200."),
  trialDuration: z.number().refine((v) => (TRIAL_LENGTHS as readonly number[]).includes(v), "Choose a trial length."),
});

export const availabilitySchema = z.object({
  availability: z
    .array(z.object({ day: z.number().int().min(0).max(6), start: z.string(), end: z.string() }))
    .min(1, "Add at least one weekly time window so families can book you.")
    .superRefine((windows, ctx) => {
      const errs = validateWeek(windows as Parameters<typeof validateWeek>[0]);
      if (Object.keys(errs).length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fix the highlighted days before continuing." });
    }),
});

export const profileSchema = z.object({
  headline: z.string().trim().min(10, "Write at least 10 characters.").max(90, "Keep your headline under 90 characters."),
  bio: z.string().trim().min(80, "Write at least 80 characters so families get to know you.").max(1500, "Keep your bio under 1,500 characters."),
  approach: z.string().trim().min(40, "Write at least 40 characters about how you teach.").max(1000, "Keep this under 1,000 characters."),
  languages: z.array(z.string()).min(1, "Choose at least one language."),
  photoName: z.string().optional(),
});

export const verificationSchema = z.object({
  idDocument: z.string().optional(),
  idDocumentSizeKb: z.number().optional(),
});

export const reviewSchema = z.object({
  agree: z.boolean().refine((v) => v, "Confirm that your information is accurate to submit."),
});

export type PersonalValues = z.infer<typeof personalSchema>;
export type SubjectsValues = z.infer<typeof subjectsSchema>;
export type ExperienceValues = z.infer<typeof experienceSchema>;
export type CredentialsValues = z.infer<typeof credentialsSchema>;
export type ModesValues = z.infer<typeof modesSchema>;
export type PricingValues = z.infer<typeof pricingSchema>;
export type AvailabilityValues = z.infer<typeof availabilitySchema>;
export type ProfileValues = z.infer<typeof profileSchema>;
export type VerificationValues = z.infer<typeof verificationSchema>;

export type OnboardingData = Partial<
  PersonalValues & SubjectsValues & ExperienceValues & CredentialsValues & ModesValues & PricingValues & AvailabilityValues & ProfileValues & VerificationValues
>;

export interface StepDef {
  n: number;
  title: string;
  short: string;
  description: string;
  schema: z.ZodTypeAny | null;
}

export const STEPS: StepDef[] = [
  { n: 1, title: "Personal info", short: "Personal", description: "How we reach you. Your phone number and ZIP code are never shown publicly.", schema: personalSchema },
  { n: 2, title: "Subjects & levels", short: "Subjects", description: "Choose what you teach and who you teach. You can change this any time.", schema: subjectsSchema },
  { n: 3, title: "Experience", short: "Experience", description: "Help families understand your background.", schema: experienceSchema },
  { n: 4, title: "Education & certifications", short: "Education", description: "List degrees and certifications. Each is verified separately before a badge appears.", schema: credentialsSchema },
  { n: 5, title: "Teaching modes", short: "Modes", description: "Teach online, in person, or both.", schema: modesSchema },
  { n: 6, title: "Pricing", short: "Pricing", description: "Set your hourly rate and an optional trial lesson.", schema: pricingSchema },
  { n: 7, title: "Availability", short: "Availability", description: "Your regular weekly hours. Families only see open times.", schema: availabilitySchema },
  { n: 8, title: "Profile", short: "Profile", description: "Your headline, bio and teaching approach are what families read first.", schema: profileSchema },
  { n: 9, title: "Verification documents", short: "Verification", description: "Start your identity check now, or later from your dashboard.", schema: verificationSchema },
  { n: 10, title: "Review & submit", short: "Review", description: "Check everything, then publish your profile.", schema: null },
];

export const TOTAL_STEPS = STEPS.length;

/** Steps whose data currently passes validation (review excluded). */
export function validSteps(data: OnboardingData): number[] {
  return STEPS.filter((s) => s.schema?.safeParse(data).success).map((s) => s.n);
}

/** Starting values: saved draft first, then what we already know from the account. */
export function initialData(saved: Record<string, unknown> | undefined, me: User): OnboardingData {
  const d = (saved ?? {}) as OnboardingData;
  return {
    phone: me.phone ?? "",
    city: me.city ?? "",
    state: me.state ?? "",
    zip: me.zip ?? "",
    subjects: [],
    levels: [],
    specialties: [],
    learningSupport: [],
    education: [],
    certifications: [],
    modes: ["online"],
    serviceRadiusMiles: 10,
    trialEnabled: true,
    trialPrice: 0,
    trialDuration: 30,
    availability: [],
    headline: "",
    bio: "",
    approach: "",
    languages: ["English"],
    ...d,
  };
}

/** Converts form values to the exact shape the store persists (education/certifications start unverified). */
export function toStoreData(values: OnboardingData): Record<string, unknown> {
  const out: Record<string, unknown> = { ...values };
  if (values.education) out.education = values.education.map((e) => ({ ...e, verified: false }));
  if (values.certifications) out.certifications = values.certifications.map((c) => ({ ...c, verified: false }));
  return out;
}
