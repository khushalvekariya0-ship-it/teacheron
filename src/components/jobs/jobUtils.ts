import type { ApplicationStatus, Grade, Requirement, Role, TeachingMode } from "@/lib/types";
import type { MatchCriteria } from "@/lib/matching";
import { GRADE_LABEL, LEVEL_LABEL, TIMES_OF_DAY, gradeToLevel, subjectName } from "@/lib/data/catalog";
import { distanceMiles, resolveLocation, type GeoPoint } from "@/lib/data/geo";
import { formatCents, formatRelative } from "@/lib/format";

/*
 * Display and matching helpers for requirements ("tutor jobs"). Shared by the post-requirement
 * wizard preview, the public jobs board and the job detail page so every surface describes a job
 * the same way. Privacy: nothing here ever exposes the owner's name or street address.
 */

export type TimeOfDay = "morning" | "afternoon" | "evening";

/** Monday-first order used for scheduling UI. */
export const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const DAY_LONG: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

const TIME_PLURAL: Record<TimeOfDay, string> = { morning: "Mornings", afternoon: "Afternoons", evening: "Evenings" };

export function sortDays(days: readonly string[]): string[] {
  return DAY_ORDER.filter((d) => days.includes(d));
}

export function daysSummary(days: readonly string[]): string {
  const sorted = sortDays(days);
  if (!sorted.length) return "Flexible days";
  if (sorted.length === 7) return "Any day";
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  if (sorted.length === 5 && weekdays.every((d) => sorted.includes(d))) return "Weekdays";
  if (sorted.length === 2 && sorted.includes("Sat") && sorted.includes("Sun")) return "Weekends";
  return sorted.join(", ");
}

export function timesSummary(times: readonly TimeOfDay[]): string {
  if (!times.length || times.length === 3) return "Any time of day";
  const ordered = TIMES_OF_DAY.filter((t) => times.includes(t.value)).map((t) => TIME_PLURAL[t.value]);
  return ordered.map((t, i) => (i === 0 ? t : t.toLowerCase())).join(" & ");
}

export function scheduleSummary(req: Pick<Requirement, "days" | "timesOfDay">): string {
  return `${daysSummary(req.days)} · ${timesSummary(req.timesOfDay)}`;
}

export function budgetRange(req: Pick<Requirement, "budgetMinCents" | "budgetMaxCents">): string {
  if (req.budgetMinCents === req.budgetMaxCents) return `${formatCents(req.budgetMaxCents)}/hr`;
  return `${formatCents(req.budgetMinCents)}–${formatCents(req.budgetMaxCents)}/hr`;
}

export function modesLabel(modes: readonly TeachingMode[]): string {
  const online = modes.includes("online");
  const inPerson = modes.includes("in_person");
  if (online && inPerson) return "Online or in person";
  if (inPerson) return "In person";
  if (online) return "Online";
  return "Format not set";
}

export function locationLabel(req: Pick<Requirement, "city" | "state" | "zip">): string {
  if (req.city && req.state) return `${req.city}, ${req.state}`;
  if (req.state) return req.state;
  if (req.zip) return `ZIP ${req.zip}`;
  return "Location not shared";
}

/** "8th grader", "college student"… used for smart default titles. */
export function gradeNoun(grade: Grade): string {
  if (grade === "K") return "kindergartner";
  if (grade === "college") return "college student";
  if (grade === "adult") return "adult learner";
  return `${GRADE_LABEL[grade].replace(" grade", "")} grader`;
}

function article(word: string): string {
  return /^(8|11|18|a|e|i|o|u)/i.test(word) ? "an" : "a";
}

/** A smart, privacy-safe default title — never includes a child's name. */
export function defaultTitle(subject: string, grade: Grade | "" | undefined): string {
  if (!subject) return "";
  const s = subjectName(subject);
  if (!grade) return `${s} tutor`;
  const noun = gradeNoun(grade);
  return `${s} tutor for ${article(noun)} ${noun}`;
}

export function gradeLevelLabel(grade: Grade): string {
  return LEVEL_LABEL[gradeToLevel(grade)];
}

/** "2 days ago" — clamped so timestamps a little ahead of the viewer's clock never read "in 3 hours". */
export function postedAgo(iso: string, now: number): string {
  return formatRelative(new Date(Math.min(new Date(iso).getTime(), now)).toISOString(), now);
}

export function postedByLabel(role: Role | undefined): string {
  if (role === "parent") return "Posted by a parent";
  if (role === "student") return "Posted by a student";
  return "Posted by a family";
}

/** Converts a requirement into transparent match criteria for scoring tutors. */
export function criteriaFromRequirement(req: Requirement): MatchCriteria {
  const location = req.zip && /^\d{5}$/.test(req.zip) ? req.zip : req.city ? `${req.city}${req.state ? `, ${req.state}` : ""}` : undefined;
  return {
    subject: req.subject || undefined,
    grade: req.grade,
    modes: req.modes.length ? req.modes : undefined,
    location,
    budgetMaxCents: req.budgetMaxCents || undefined,
    days: req.days.length ? req.days : undefined,
    timesOfDay: req.timesOfDay.length ? req.timesOfDay : undefined,
    minExperienceYears: req.minExperienceYears || undefined,
    language: req.languages.find((l) => l !== "English"),
    learningSupport: req.learningSupport?.length ? req.learningSupport : undefined,
  };
}

/** Resolves the job's approximate position from its ZIP (or city). */
export function jobPoint(req: Pick<Requirement, "zip" | "city" | "state">): GeoPoint | null {
  if (req.zip) {
    const p = resolveLocation(req.zip);
    if (p) return p;
  }
  return req.city ? resolveLocation(`${req.city}${req.state ? `, ${req.state}` : ""}`) : null;
}

export function jobDistance(req: Pick<Requirement, "zip" | "city" | "state">, from: GeoPoint | null): number | null {
  if (!from) return null;
  const p = jobPoint(req);
  return p ? Math.round(distanceMiles(from, p) * 10) / 10 : null;
}

export const APPLICATION_STATUS_META: Record<ApplicationStatus, { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  applied: { label: "Applied", tone: "accent" },
  viewed: { label: "Viewed by family", tone: "accent" },
  shortlisted: { label: "Shortlisted", tone: "success" },
  contacted: { label: "Contacted", tone: "success" },
  trial_requested: { label: "Trial requested", tone: "success" },
  hired: { label: "Hired", tone: "success" },
  rejected: { label: "Not selected", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
  closed: { label: "Job closed", tone: "neutral" },
};

/** Minimum experience options (years). */
export const EXPERIENCE_OPTIONS = [
  { value: "", label: "No minimum" },
  { value: "1", label: "1+ years" },
  { value: "2", label: "2+ years" },
  { value: "3", label: "3+ years" },
  { value: "5", label: "5+ years" },
  { value: "10", label: "10+ years" },
];
