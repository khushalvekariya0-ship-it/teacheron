import { z } from "zod";
import type { Grade, TeachingMode, Tutor } from "@/lib/types";
import { GRADE_LABEL, LANGUAGES, LEARNING_SUPPORT, SUBJECT_BY_SLUG, subjectName } from "@/lib/data/catalog";
import { resolveLocation } from "@/lib/data/geo";
import { rankTutors, type MatchCriteria } from "@/lib/matching";
import { toQueryString, type TutorSearch } from "@/lib/search";
import { daysSummary, timesSummary, type TimeOfDay } from "@/components/jobs/jobUtils";

/*
 * Concierge answers: the editable, user-confirmed version of MatchCriteria. Everything the
 * natural-language parser extracts lands here and is shown back for review before scoring.
 */

export type ModeChoice = "" | "online" | "in_person" | "either";

export interface Answers {
  subject: string;
  grade: Grade | "";
  goal: string;
  budgetMax: string; // whole dollars, as typed
  days: string[];
  timesOfDay: TimeOfDay[];
  mode: ModeChoice;
  zip: string;
  minExperience: string; // "" | years
  language: string; // "" = no preference
  support: string[];
}

export type AnswerKey = keyof Answers;

export const EMPTY_ANSWERS: Answers = {
  subject: "", grade: "", goal: "", budgetMax: "", days: [], timesOfDay: [], mode: "", zip: "", minExperience: "", language: "", support: [],
};

export const answersSchema = z
  .object({
    subject: z.string().min(1, "Choose a subject so we can find tutors who teach it."),
    grade: z.custom<Grade | "">((v) => typeof v === "string"),
    goal: z.string().max(300, "Keep the goal under 300 characters."),
    budgetMax: z.string().refine((v) => v === "" || (/^\d+$/.test(v) && +v >= 10 && +v <= 500), "Enter a whole-dollar amount between $10 and $500."),
    days: z.array(z.string()),
    timesOfDay: z.array(z.enum(["morning", "afternoon", "evening"])),
    mode: z.enum(["", "online", "in_person", "either"]),
    zip: z.string().refine((v) => v === "" || /^\d{5}$/.test(v), "Enter a 5-digit ZIP code."),
    minExperience: z.string(),
    language: z.string(),
    support: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "in_person" && !v.zip) ctx.addIssue({ code: "custom", path: ["zip"], message: "Add your ZIP code so we can check who's within reach." });
  });

export function answersToCriteria(a: Answers): MatchCriteria {
  return {
    subject: a.subject || undefined,
    grade: a.grade || undefined,
    modes: a.mode === "online" ? ["online"] : a.mode === "in_person" ? ["in_person"] : a.mode === "either" ? ["online", "in_person"] : undefined,
    location: a.zip || undefined,
    budgetMaxCents: a.budgetMax ? Number(a.budgetMax) * 100 : undefined,
    days: a.days.length ? a.days : undefined,
    timesOfDay: a.timesOfDay.length ? a.timesOfDay : undefined,
    minExperienceYears: a.minExperience ? Number(a.minExperience) : undefined,
    language: a.language && a.language !== "English" ? a.language : undefined,
    learningSupport: a.support.length ? a.support : undefined,
  };
}

/** Maps parser output to answers, plus which fields were actually found in the text. */
export function criteriaToAnswers(c: MatchCriteria): { answers: Answers; found: AnswerKey[] } {
  const found: AnswerKey[] = [];
  const a: Answers = { ...EMPTY_ANSWERS };
  if (c.subject) { a.subject = c.subject; found.push("subject"); }
  if (c.grade) { a.grade = c.grade; found.push("grade"); }
  if (c.budgetMaxCents) { a.budgetMax = String(Math.round(c.budgetMaxCents / 100)); found.push("budgetMax"); }
  if (c.days?.length) { a.days = c.days; found.push("days"); }
  if (c.timesOfDay?.length) { a.timesOfDay = c.timesOfDay; found.push("timesOfDay"); }
  if (c.modes?.length) {
    a.mode = c.modes.length === 2 ? "either" : (c.modes[0] as TeachingMode);
    found.push("mode");
  }
  if (c.location) { a.zip = c.location; found.push("zip"); }
  if (c.minExperienceYears) { a.minExperience = String(c.minExperienceYears); found.push("minExperience"); }
  if (c.language) { a.language = c.language; found.push("language"); }
  if (c.learningSupport?.length) { a.support = c.learningSupport; found.push("support"); }
  return { answers: a, found };
}

/* ─── URL contract (so results survive "back" from a tutor profile) ────────── */

export function answersToParams(a: Answers): URLSearchParams {
  const p = new URLSearchParams();
  if (a.subject) p.set("subject", a.subject);
  if (a.grade) p.set("grade", a.grade);
  if (a.goal.trim()) p.set("goal", a.goal.trim());
  if (a.budgetMax) p.set("maxRate", a.budgetMax);
  if (a.days.length) p.set("days", a.days.join(","));
  if (a.timesOfDay.length) p.set("times", a.timesOfDay.join(","));
  if (a.mode) p.set("mode", a.mode);
  if (a.zip) p.set("location", a.zip);
  if (a.minExperience) p.set("exp", a.minExperience);
  if (a.language) p.set("lang", a.language);
  if (a.support.length) p.set("support", a.support.join(","));
  return p;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMES: TimeOfDay[] = ["morning", "afternoon", "evening"];

export function paramsToAnswers(p: URLSearchParams): Answers {
  const subject = p.get("subject") ?? "";
  const grade = (p.get("grade") ?? "") as Grade | "";
  const mode = p.get("mode") ?? "";
  const maxRate = p.get("maxRate") ?? "";
  const zip = p.get("location") ?? "";
  const exp = p.get("exp") ?? "";
  const lang = p.get("lang") ?? "";
  return {
    subject: SUBJECT_BY_SLUG[subject] ? subject : "",
    grade: grade && GRADE_LABEL[grade as Grade] ? grade : "",
    goal: (p.get("goal") ?? "").slice(0, 300),
    budgetMax: /^\d{2,3}$/.test(maxRate) ? maxRate : "",
    days: (p.get("days") ?? "").split(",").filter((d) => DAYS.includes(d)),
    timesOfDay: (p.get("times") ?? "").split(",").filter((t): t is TimeOfDay => TIMES.includes(t as TimeOfDay)),
    mode: ["online", "in_person", "either"].includes(mode) ? (mode as ModeChoice) : "",
    zip: /^\d{5}$/.test(zip) ? zip : "",
    minExperience: /^\d{1,2}$/.test(exp) ? exp : "",
    language: LANGUAGES.includes(lang) ? lang : "",
    support: (p.get("support") ?? "").split(",").filter((s) => LEARNING_SUPPORT.includes(s)),
  };
}

/** Equivalent /tutors search so "See all matching tutors" shows the same constraints. */
export function tutorsHref(a: Answers): string {
  const s: TutorSearch = {
    subject: a.subject || undefined,
    grade: (a.grade || undefined) as Grade | undefined,
    mode: a.mode === "online" || a.mode === "in_person" ? a.mode : undefined,
    location: a.zip || undefined,
    maxRate: a.budgetMax ? Number(a.budgetMax) : undefined,
    days: a.days.length ? a.days : undefined,
    times: a.timesOfDay.length ? a.timesOfDay : undefined,
    exp: a.minExperience ? Number(a.minExperience) : undefined,
    lang: a.language && a.language !== "English" ? a.language : undefined,
    support: a.support[0],
    sort: "match",
  };
  const qs = toQueryString(s);
  return qs ? `/tutors?${qs}` : "/tutors";
}

export function postRequirementHref(a: Answers): string {
  const p = new URLSearchParams();
  if (a.subject) p.set("subject", a.subject);
  if (a.grade) p.set("grade", a.grade);
  if (a.mode) p.set("mode", a.mode === "either" ? "both" : a.mode);
  if (a.zip) p.set("zip", a.zip);
  if (a.goal.trim()) p.set("goal", a.goal.trim());
  const qs = p.toString();
  return qs ? `/post-requirement?${qs}` : "/post-requirement";
}

/* ─── Human summaries ───────────────────────────────────────────────────────── */

export const MODE_CHOICE_LABEL: Record<Exclude<ModeChoice, "">, string> = {
  online: "Online",
  in_person: "In person",
  either: "Online or in person",
};

export function summarize(a: Answers): { key: AnswerKey; label: string }[] {
  const out: { key: AnswerKey; label: string }[] = [];
  if (a.subject) out.push({ key: "subject", label: subjectName(a.subject) });
  if (a.grade) out.push({ key: "grade", label: GRADE_LABEL[a.grade] });
  if (a.mode) out.push({ key: "mode", label: MODE_CHOICE_LABEL[a.mode] });
  if (a.zip) {
    const p = resolveLocation(a.zip);
    out.push({ key: "zip", label: p ? `Near ${a.zip}` : `ZIP ${a.zip}` });
  }
  if (a.budgetMax) out.push({ key: "budgetMax", label: `Up to $${a.budgetMax}/hr` });
  if (a.days.length) out.push({ key: "days", label: daysSummary(a.days) });
  if (a.timesOfDay.length) out.push({ key: "timesOfDay", label: timesSummary(a.timesOfDay) });
  if (a.minExperience) out.push({ key: "minExperience", label: `${a.minExperience}+ yrs experience` });
  if (a.language) out.push({ key: "language", label: `Speaks ${a.language}` });
  if (a.support.length) out.push({ key: "support", label: a.support.join(", ") });
  return out;
}

/* ─── Concrete suggestions when results are empty or weak ──────────────────── */

export interface Suggestion {
  id: string;
  label: string;
  patch: Partial<Answers>;
  count: number;
  top: number;
}

function outcome(tutors: Tutor[], a: Answers): { count: number; top: number } {
  const ranked = rankTutors(tutors, answersToCriteria(a)).filter((r) => !r.disqualified);
  return { count: ranked.length, top: ranked[0]?.percent ?? 0 };
}

export function buildSuggestions(tutors: Tutor[], a: Answers): Suggestion[] {
  const base = outcome(tutors, a);
  const candidates: { id: string; label: string; patch: Partial<Answers> }[] = [];

  if (a.mode === "in_person") candidates.push({ id: "online", label: "Allow online lessons", patch: { mode: "either" } });
  if (a.budgetMax && a.subject) {
    const rates = tutors.filter((t) => t.subjects.includes(a.subject)).map((t) => t.hourlyRateCents).sort((x, y) => x - y);
    const target = rates[Math.min(2, rates.length - 1)];
    if (target && target > Number(a.budgetMax) * 100) {
      const dollars = Math.min(500, Math.ceil(target / 100 / 5) * 5);
      candidates.push({ id: "budget", label: `Raise your budget to $${dollars}/hr`, patch: { budgetMax: String(dollars) } });
    }
  }
  if (a.days.length || a.timesOfDay.length) candidates.push({ id: "schedule", label: "Be flexible on schedule", patch: { days: [], timesOfDay: [] } });
  if (a.minExperience) candidates.push({ id: "experience", label: "Remove the experience minimum", patch: { minExperience: "" } });
  if (a.language) candidates.push({ id: "language", label: `Don't require ${a.language}`, patch: { language: "" } });

  return candidates
    .map((c) => ({ ...c, ...outcome(tutors, { ...a, ...c.patch }) }))
    .filter((s) => s.count > base.count || s.top > base.top)
    .sort((x, y) => y.count - x.count || y.top - x.top)
    .slice(0, 4);
}
