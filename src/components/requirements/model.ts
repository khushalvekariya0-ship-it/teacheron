import { z } from "zod";
import type { Resolver, ResolverResult } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Child, Grade, Requirement, TeachingMode, User } from "@/lib/types";
import { GRADE_LABEL, SUBJECT_BY_SLUG, US_STATES } from "@/lib/data/catalog";
import { METROS } from "@/lib/data/geo";
import { defaultTitle, type TimeOfDay } from "@/components/jobs/jobUtils";

/*
 * Post-requirement wizard model: form values, per-step zod schemas, and conversions to and from the
 * store's Requirement. Budgets are typed as whole dollars and stored as integer cents.
 */

export type Format = "" | "online" | "in_person" | "both";
export type FamilyRole = "student" | "parent";

export interface Attachment {
  name: string;
  sizeKb: number;
}

export interface ReqForm {
  childId: string;
  subject: string;
  grade: Grade | "";
  title: string;
  objectives: string;
  learningSupport: string[];
  format: Format;
  zip: string;
  city: string;
  state: string;
  days: string[];
  timesOfDay: TimeOfDay[];
  sessionsPerWeek: number;
  budgetMin: string;
  budgetMax: string;
  minExperience: string;
  languages: string[];
  preferences: string;
  details: string;
  attachments: Attachment[];
}

export const STEPS = [
  { title: "Learner & subject", description: "Who it's for and what to learn" },
  { title: "Goals", description: "What success looks like" },
  { title: "Format & location", description: "Online, in person or both" },
  { title: "Schedule", description: "Days and times that work" },
  { title: "Budget & preferences", description: "Rate, experience and extras" },
  { title: "Preview", description: "Check it, then publish" },
] as const;

export const PREVIEW_STEP = STEPS.length - 1;

export const LIMITS = { objectivesMin: 20, objectivesMax: 1500, titleMin: 8, titleMax: 100, preferencesMax: 500, detailsMax: 1500, maxFiles: 3, maxFileMb: 10 };

const dollars = (label: string) =>
  z
    .string()
    .min(1, `Enter a ${label} hourly rate.`)
    .refine((v) => /^\d+$/.test(v), "Use whole dollars.")
    .refine((v) => +v >= 10 && +v <= 500, "Enter an amount between $10 and $500.");

/** One schema per step (the preview step has none). Parents must pick a child. */
export function stepSchema(step: number, role: FamilyRole) {
  switch (step) {
    case 0:
      return z.object({
        childId: role === "parent" ? z.string().min(1, "Choose which child this requirement is for.") : z.string(),
        subject: z.string().min(1, "Choose a subject.").refine((v) => !!SUBJECT_BY_SLUG[v], "Choose a subject from the list."),
        grade: z.custom<Grade | "">((v) => typeof v === "string").refine((v) => v !== "" && !!GRADE_LABEL[v as Grade], "Choose a grade."),
        title: z
          .string()
          .trim()
          .min(LIMITS.titleMin, `Use at least ${LIMITS.titleMin} characters so tutors know what you need.`)
          .max(LIMITS.titleMax, `Keep the title under ${LIMITS.titleMax} characters.`),
      });
    case 1:
      return z.object({
        objectives: z
          .string()
          .trim()
          .min(LIMITS.objectivesMin, `Describe the goals in at least ${LIMITS.objectivesMin} characters.`)
          .max(LIMITS.objectivesMax, `Keep this under ${LIMITS.objectivesMax.toLocaleString("en-US")} characters.`),
        learningSupport: z.array(z.string()),
      });
    case 2:
      return z
        .object({
          format: z.enum(["", "online", "in_person", "both"]).refine((v) => v !== "", "Choose how lessons should happen."),
          zip: z.string(),
          city: z.string().max(60, "City name is too long."),
          state: z.string(),
        })
        .superRefine((v, ctx) => {
          const inPerson = v.format === "in_person" || v.format === "both";
          if (v.zip && !/^\d{5}$/.test(v.zip)) ctx.addIssue({ code: "custom", path: ["zip"], message: "Enter a 5-digit ZIP code." });
          if (inPerson) {
            if (!v.zip) ctx.addIssue({ code: "custom", path: ["zip"], message: "A ZIP code is required for in-person lessons." });
            if (v.city.trim().length < 2) ctx.addIssue({ code: "custom", path: ["city"], message: "Enter your city." });
            if (!v.state) ctx.addIssue({ code: "custom", path: ["state"], message: "Choose your state." });
          }
          if (v.state && !US_STATES.some((s) => s.value === v.state)) ctx.addIssue({ code: "custom", path: ["state"], message: "Choose a US state." });
        });
    case 3:
      return z.object({
        days: z.array(z.string()).min(1, "Pick at least one day."),
        timesOfDay: z.array(z.enum(["morning", "afternoon", "evening"])).min(1, "Pick at least one time of day."),
        sessionsPerWeek: z.number().int().min(1, "Choose how many sessions per week.").max(7),
      });
    case 4:
      return z
        .object({
          budgetMin: dollars("minimum"),
          budgetMax: dollars("maximum"),
          minExperience: z.string(),
          languages: z.array(z.string()).min(1, "Choose at least one language."),
          preferences: z.string().max(LIMITS.preferencesMax, `Keep this under ${LIMITS.preferencesMax} characters.`),
          details: z.string().max(LIMITS.detailsMax, `Keep this under ${LIMITS.detailsMax.toLocaleString("en-US")} characters.`),
          attachments: z.array(z.object({ name: z.string(), sizeKb: z.number() })).max(LIMITS.maxFiles, `Attach up to ${LIMITS.maxFiles} files.`),
        })
        .superRefine((v, ctx) => {
          if (/^\d+$/.test(v.budgetMin) && /^\d+$/.test(v.budgetMax) && +v.budgetMax < +v.budgetMin) {
            ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "The maximum must be at least the minimum." });
          }
        });
    default:
      return null;
  }
}

/** Field names validated by each step — used to find which step holds a given error. */
export const STEP_FIELDS: (keyof ReqForm)[][] = [
  ["childId", "subject", "grade", "title"],
  ["objectives", "learningSupport"],
  ["format", "zip", "city", "state"],
  ["days", "timesOfDay", "sessionsPerWeek"],
  ["budgetMin", "budgetMax", "minExperience", "languages", "preferences", "details", "attachments"],
  [],
];

export interface WizardContext {
  step: number;
  role: FamilyRole;
}

/** Validates only the current step (read from the form's context on every call). */
export const wizardResolver: Resolver<ReqForm, WizardContext> = async (values, context, options) => {
  const schema = stepSchema(context?.step ?? 0, context?.role ?? "student");
  if (!schema) return { values, errors: {} };
  const run = zodResolver(schema as z.ZodTypeAny, undefined, { raw: true }) as unknown as Resolver<ReqForm, WizardContext>;
  return (await run(values, context, options)) as ResolverResult<ReqForm>;
};

/** Returns the first step whose schema fails, with its issues, or null when everything is valid. */
export function firstInvalidStep(values: ReqForm, role: FamilyRole): { step: number; issues: { path: keyof ReqForm; message: string }[] } | null {
  for (let s = 0; s < PREVIEW_STEP; s++) {
    const r = stepSchema(s, role)!.safeParse(values);
    if (!r.success) return { step: s, issues: r.error.issues.map((i) => ({ path: i.path[0] as keyof ReqForm, message: i.message })) };
  }
  return null;
}

/* ─── Conversions ───────────────────────────────────────────────────────────── */

export function formatToModes(f: Format): TeachingMode[] {
  return f === "both" ? ["online", "in_person"] : f === "in_person" ? ["in_person"] : f === "online" ? ["online"] : [];
}

export function modesToFormat(modes: TeachingMode[]): Format {
  const on = modes.includes("online");
  const ip = modes.includes("in_person");
  return on && ip ? "both" : ip ? "in_person" : on ? "online" : "";
}

/** City/state for ZIPs that match a known metro exactly (offline geocoding in the preview build). */
export function cityForZip(zip: string): { city: string; state: string } | null {
  const m = METROS.find((x) => x.zip === zip);
  return m ? { city: m.city, state: m.state } : null;
}

export function toPayload(v: ReqForm, role: FamilyRole): Partial<Requirement> {
  const p: Partial<Requirement> = {
    title: v.title.trim(),
    subject: v.subject,
    objectives: v.objectives.trim(),
    learningSupport: v.learningSupport,
    city: v.city.trim(),
    state: v.state,
    zip: v.zip,
    days: v.days,
    timesOfDay: v.timesOfDay,
    sessionsPerWeek: v.sessionsPerWeek,
    minExperienceYears: v.minExperience ? Number(v.minExperience) : undefined,
    languages: v.languages,
    preferences: v.preferences.trim(),
    details: v.details.trim(),
    attachments: v.attachments,
  };
  if (role === "parent") p.childId = v.childId || undefined;
  if (v.grade) p.grade = v.grade;
  const modes = formatToModes(v.format);
  if (modes.length) p.modes = modes;
  if (/^\d+$/.test(v.budgetMin) && /^\d+$/.test(v.budgetMax)) {
    p.budgetMinCents = Number(v.budgetMin) * 100;
    p.budgetMaxCents = Number(v.budgetMax) * 100;
  }
  return p;
}

/** Loads a saved requirement. Store defaults for steps the family never completed are shown as blank. */
export function fromRequirement(req: Requirement): ReqForm {
  const completed = req.status === "draft" ? req.draftStep ?? 0 : PREVIEW_STEP;
  const untouchedFormat = completed <= 2 && req.modes.length === 1 && req.modes[0] === "online";
  const untouchedBudget = completed <= 4 && req.budgetMinCents === 4000 && req.budgetMaxCents === 8000;
  return {
    childId: req.childId ?? "",
    subject: req.subject,
    grade: req.subject ? req.grade : "",
    title: req.title,
    objectives: req.objectives,
    learningSupport: req.learningSupport ?? [],
    format: untouchedFormat ? "" : modesToFormat(req.modes),
    zip: req.zip,
    city: req.city,
    state: req.state,
    days: req.days,
    timesOfDay: req.timesOfDay,
    sessionsPerWeek: req.sessionsPerWeek || 1,
    budgetMin: untouchedBudget ? "" : String(Math.round(req.budgetMinCents / 100)),
    budgetMax: untouchedBudget ? "" : String(Math.round(req.budgetMaxCents / 100)),
    minExperience: req.minExperienceYears ? String(req.minExperienceYears) : "",
    languages: req.languages.length ? req.languages : ["English"],
    preferences: req.preferences,
    details: req.details,
    attachments: req.attachments ?? [],
  };
}

export interface Prefill {
  subject?: string;
  grade?: string;
  mode?: string;
  zip?: string;
  goal?: string;
  /** Parent hand-off from the Children page. */
  childId?: string;
}

/** A fresh form, prefilled from URL params (concierge / search hand-off) and the family's profile. */
export function newForm(me: User, children: Child[], prefill: Prefill): ReqForm {
  const subject = prefill.subject && SUBJECT_BY_SLUG[prefill.subject] ? prefill.subject : "";
  const grade = prefill.grade && GRADE_LABEL[prefill.grade as Grade] ? (prefill.grade as Grade) : "";
  const format: Format = prefill.mode === "online" ? "online" : prefill.mode === "in_person" ? "in_person" : prefill.mode === "both" || prefill.mode === "either" ? "both" : "";
  const zip = prefill.zip && /^\d{5}$/.test(prefill.zip) ? prefill.zip : me.zip && /^\d{5}$/.test(me.zip) ? me.zip : "";
  const loc = !zip || zip === me.zip ? { city: me.city ?? "", state: me.state ?? "" } : cityForZip(zip) ?? { city: "", state: "" };
  const onlyChild =
    me.role !== "parent" ? undefined : children.find((c) => c.id === prefill.childId) ?? (children.length === 1 ? children[0] : undefined);
  const g = grade || onlyChild?.grade || "";
  return {
    childId: onlyChild?.id ?? "",
    subject,
    grade: g,
    title: defaultTitle(subject, g),
    objectives: (prefill.goal ?? "").slice(0, LIMITS.objectivesMax),
    learningSupport: [],
    format,
    zip,
    city: loc.city,
    state: loc.state,
    days: [],
    timesOfDay: [],
    sessionsPerWeek: 1,
    budgetMin: "",
    budgetMax: "",
    minExperience: "",
    languages: ["English"],
    preferences: "",
    details: "",
    attachments: [],
  };
}
