import type { Grade, Level, TeachingMode, Tutor } from "@/lib/types";
import { SUBJECT_BY_SLUG, gradeToLevel, LEVEL_LABEL, TIMES_OF_DAY, WEEKDAYS, subjectName } from "@/lib/data/catalog";
import { distanceMiles, resolveLocation } from "@/lib/data/geo";
import { formatCents } from "@/lib/format";

/**
 * Transparent, rules-based matching. Every factor, weight and explanation is visible to the user.
 * No hidden signals (e.g. paid placement) affect the score. Weights are admin-configurable.
 */

export interface MatchCriteria {
  subject?: string; // slug
  grade?: Grade;
  modes?: TeachingMode[]; // acceptable modes
  location?: string; // ZIP or city
  maxDistanceMiles?: number;
  budgetMaxCents?: number;
  days?: string[]; // "Mon"...
  timesOfDay?: ("morning" | "afternoon" | "evening")[];
  minExperienceYears?: number;
  language?: string;
  learningSupport?: string[];
}

export type FactorKey = "subject" | "grade" | "schedule" | "budget" | "location" | "experience" | "language" | "support";

export interface FactorResult {
  key: FactorKey;
  label: string;
  weight: number;
  score: number; // 0..1
  status: "match" | "partial" | "miss" | "neutral";
  detail: string;
}

export interface MatchResult {
  tutor: Tutor;
  percent: number;
  factors: FactorResult[];
  distanceMiles: number | null;
  /** Hard requirements not met (e.g. subject not taught). Such tutors are excluded from shortlists. */
  disqualified: boolean;
}

export const DEFAULT_WEIGHTS: Record<FactorKey, number> = {
  subject: 30,
  grade: 15,
  schedule: 15,
  budget: 15,
  location: 10,
  experience: 7,
  language: 4,
  support: 4,
};

export const FACTOR_LABEL: Record<FactorKey, string> = {
  subject: "Subject",
  grade: "Grade level",
  schedule: "Schedule",
  budget: "Budget",
  location: "Location & mode",
  experience: "Experience",
  language: "Language",
  support: "Learning support",
};

function relatedSubject(a: string, b: string): boolean {
  return SUBJECT_BY_SLUG[a]?.category !== undefined && SUBJECT_BY_SLUG[a]?.category === SUBJECT_BY_SLUG[b]?.category;
}

function timeWindowOverlaps(tutor: Tutor, days: string[] | undefined, times: MatchCriteria["timesOfDay"]): { overlap: number; total: number; matched: string[] } {
  const wantedDays = days?.length ? days : [...WEEKDAYS];
  const wantedTimes = times?.length ? times : (["morning", "afternoon", "evening"] as const);
  let overlap = 0;
  const matched: string[] = [];
  for (const d of wantedDays) {
    const dayIdx = WEEKDAYS.indexOf(d as (typeof WEEKDAYS)[number]);
    const windows = tutor.availability.filter((w) => w.day === dayIdx);
    const hit = wantedTimes.some((t) => {
      const range = TIMES_OF_DAY.find((x) => x.value === t)!;
      return windows.some((w) => {
        const s = parseInt(w.start, 10);
        const e = parseInt(w.end, 10) + (w.end.endsWith("30") ? 0.5 : 0);
        return s < range.end && e > range.start;
      });
    });
    if (hit) {
      overlap++;
      matched.push(d);
    }
  }
  return { overlap, total: wantedDays.length, matched };
}

export function scoreTutor(tutor: Tutor, c: MatchCriteria, weights = DEFAULT_WEIGHTS): MatchResult {
  const factors: FactorResult[] = [];
  let disqualified = false;
  const push = (key: FactorKey, score: number, detail: string, neutral = false) => {
    factors.push({
      key,
      label: FACTOR_LABEL[key],
      weight: weights[key],
      score,
      status: neutral ? "neutral" : score >= 0.85 ? "match" : score > 0.2 ? "partial" : "miss",
      detail,
    });
  };

  // Subject
  if (c.subject) {
    if (tutor.subjects.includes(c.subject)) push("subject", 1, `Teaches ${subjectName(c.subject)}`);
    else if (tutor.subjects.some((s) => relatedSubject(s, c.subject!))) {
      push("subject", 0.35, `Teaches related ${SUBJECT_BY_SLUG[c.subject]?.category === "math" ? "math" : "subjects"}, not ${subjectName(c.subject)} specifically`);
    } else {
      push("subject", 0, `Does not list ${subjectName(c.subject)}`);
      disqualified = true;
    }
  } else push("subject", 1, "No subject specified", true);

  // Grade
  if (c.grade) {
    const level: Level = gradeToLevel(c.grade);
    if (tutor.levels.includes(level)) push("grade", 1, `Works with ${LEVEL_LABEL[level].toLowerCase()} students`);
    else push("grade", 0.1, `Usually teaches ${tutor.levels.map((l) => LEVEL_LABEL[l].toLowerCase()).join(", ")}`);
  } else push("grade", 1, "No grade specified", true);

  // Schedule
  if (c.days?.length || c.timesOfDay?.length) {
    const { overlap, total, matched } = timeWindowOverlaps(tutor, c.days, c.timesOfDay);
    const score = total ? overlap / total : 1;
    push(
      "schedule",
      score,
      overlap === 0 ? "No regular availability at the preferred times" : overlap === total ? "Available on all preferred days" : `Available ${matched.join(", ")} (${overlap} of ${total} days)`,
    );
  } else push("schedule", 1, "No schedule preference", true);

  // Budget
  if (c.budgetMaxCents) {
    const rate = tutor.hourlyRateCents;
    if (rate <= c.budgetMaxCents) push("budget", 1, `${formatCents(rate)}/hr is within budget`);
    else {
      const over = (rate - c.budgetMaxCents) / c.budgetMaxCents;
      push("budget", over <= 0.15 ? 0.5 : 0, `${formatCents(rate)}/hr is ${formatCents(rate - c.budgetMaxCents)} above budget`);
    }
  } else push("budget", 1, "No budget specified", true);

  // Location & mode
  let dist: number | null = null;
  const wantsInPerson = c.modes?.includes("in_person");
  const wantsOnline = !c.modes?.length || c.modes.includes("online");
  const point = c.location ? resolveLocation(c.location) : null;
  if (point) dist = Math.round(distanceMiles(point, tutor) * 10) / 10;
  if (wantsInPerson && !wantsOnline) {
    if (!tutor.modes.includes("in_person")) {
      push("location", 0, "Teaches online only");
      disqualified = true;
    } else if (dist == null) push("location", 0.6, "Teaches in person — add a ZIP to check distance");
    else if (dist <= Math.max(tutor.serviceRadiusMiles, c.maxDistanceMiles ?? 0)) push("location", 1, `In-person within ~${Math.max(1, Math.round(dist))} mi`);
    else push("location", 0, `About ${Math.round(dist)} mi away — outside the tutor's service area`);
  } else if (wantsInPerson && wantsOnline) {
    if (tutor.modes.includes("in_person") && dist != null && dist <= tutor.serviceRadiusMiles) push("location", 1, `Online or in person (~${Math.max(1, Math.round(dist))} mi)`);
    else if (tutor.modes.includes("online")) push("location", 0.8, "Available online");
    else push("location", 0.2, "In person only, outside the area");
  } else {
    if (tutor.modes.includes("online")) push("location", 1, "Teaches online");
    else {
      push("location", 0, "In-person only");
      disqualified = true;
    }
  }

  // Experience
  if (c.minExperienceYears) {
    if (tutor.experienceYears >= c.minExperienceYears) push("experience", 1, `${tutor.experienceYears} years of teaching experience`);
    else push("experience", tutor.experienceYears / c.minExperienceYears * 0.6, `${tutor.experienceYears} years — below the ${c.minExperienceYears}-year preference`);
  } else push("experience", 1, `${tutor.experienceYears} years of experience`, true);

  // Language
  if (c.language && c.language !== "English") {
    if (tutor.languages.includes(c.language)) push("language", 1, `Speaks ${c.language}`);
    else push("language", 0, `Does not list ${c.language}`);
  } else push("language", 1, "English", true);

  // Learning support
  if (c.learningSupport?.length) {
    const hits = c.learningSupport.filter((s) => tutor.learningSupport.includes(s));
    push("support", hits.length / c.learningSupport.length, hits.length ? `Experience with ${hits.join(", ")}` : "No listed experience with these specific needs");
  } else push("support", 1, "No specific needs listed", true);

  const active = factors.filter((f) => f.status !== "neutral");
  const totalWeight = active.reduce((s, f) => s + f.weight, 0);
  const percent = totalWeight === 0 ? 100 : Math.round((active.reduce((s, f) => s + f.weight * f.score, 0) / totalWeight) * 100);

  return { tutor, percent: disqualified ? Math.min(percent, 40) : percent, factors, distanceMiles: dist, disqualified };
}

/**
 * Ranks tutors by match score. Ties are broken by lessons completed, then alphabetically —
 * never by subscription tier or featured status.
 */
export function rankTutors(tutors: Tutor[], c: MatchCriteria, weights = DEFAULT_WEIGHTS): MatchResult[] {
  return tutors
    .map((t) => scoreTutor(t, c, weights))
    .sort((a, b) => Number(a.disqualified) - Number(b.disqualified) || b.percent - a.percent || b.tutor.lessonsCompleted - a.tutor.lessonsCompleted || a.tutor.lastName.localeCompare(b.tutor.lastName));
}

/**
 * Lightweight natural-language parser for the concierge text box. Runs locally — no personal
 * data leaves the browser. Everything it extracts is shown back to the user for confirmation.
 */
export function parseNaturalLanguage(text: string): MatchCriteria {
  const t = text.toLowerCase();
  const c: MatchCriteria = {};

  // Whole-word matching so "Saturday" never reads as SAT and "act" never matches "practice".
  const hasWord = (k: string) => new RegExp(`(^|[^a-z0-9])${k.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`).test(t);
  const subjectHit = Object.values(SUBJECT_BY_SLUG)
    .map((s) => ({ s, keys: [s.name.toLowerCase(), s.slug.replace(/-/g, " "), ...(SUBJECT_ALIASES[s.slug] ?? [])] }))
    .find(({ keys }) => keys.some(hasWord));
  if (subjectHit) c.subject = subjectHit.s.slug;

  const gradeMatch = t.match(/(\d{1,2})(?:st|nd|rd|th)?[\s-]*grade/) ?? t.match(/grade\s*(\d{1,2})/);
  if (gradeMatch && +gradeMatch[1] >= 1 && +gradeMatch[1] <= 12) c.grade = String(+gradeMatch[1]) as Grade;
  else if (/kindergarten/.test(t)) c.grade = "K";
  else if (/college|university|undergrad/.test(t)) c.grade = "college";
  else if (/adult|professional|career/.test(t)) c.grade = "adult";
  else if (/junior/.test(t)) c.grade = "11";
  else if (/senior/.test(t)) c.grade = "12";
  else if (/sophomore/.test(t)) c.grade = "10";
  else if (/freshman/.test(t)) c.grade = "9";

  const budget = t.match(/\$\s?(\d{2,3})/) ?? t.match(/(\d{2,3})\s?(?:dollars|\/hr|per hour|an hour)/);
  if (budget) c.budgetMaxCents = +budget[1] * 100;

  const zip = t.match(/\b(\d{5})\b/);
  if (zip) c.location = zip[1];

  const inPerson = /in[- ]person|at (?:our|my) home|in my area|nearby|local/.test(t);
  const online = /online|virtual|remote|zoom/.test(t);
  if (inPerson && online) c.modes = ["online", "in_person"];
  else if (inPerson) c.modes = ["in_person"];
  else if (online) c.modes = ["online"];

  const DAY_PATTERNS: Record<(typeof WEEKDAYS)[number], RegExp> = {
    Sun: /\bsun(day)?s?\b/, Mon: /\bmon(day)?s?\b/, Tue: /\btues?(day)?s?\b/, Wed: /\bwed(nesday)?s?\b/,
    // "sat" alone means the test, so Saturday must be spelled out.
    Thu: /\bthu(rs?)?(day)?s?\b/, Fri: /\bfri(day)?s?\b/, Sat: /\bsaturdays?\b/,
  };
  const days = WEEKDAYS.filter((d) => DAY_PATTERNS[d].test(t));
  if (/weekend/.test(t)) days.push("Sat", "Sun");
  if (/weekday/.test(t)) days.push("Mon", "Tue", "Wed", "Thu", "Fri");
  if (days.length) c.days = Array.from(new Set(days));

  const times: NonNullable<MatchCriteria["timesOfDay"]> = [];
  if (/morning/.test(t)) times.push("morning");
  if (/afternoon|after school/.test(t)) times.push("afternoon");
  if (/evening|night/.test(t)) times.push("evening");
  if (times.length) c.timesOfDay = times;

  const exp = t.match(/(\d{1,2})\+?\s*years?/);
  if (exp) c.minExperienceYears = +exp[1];

  const lang = ["Spanish", "Mandarin", "French", "Hindi", "Korean", "Vietnamese", "Arabic", "Portuguese", "Russian"].find((l) =>
    new RegExp(`(speaks?|in|bilingual)\\s+${l.toLowerCase()}`).test(t),
  );
  if (lang) c.language = lang;

  const support: string[] = [];
  if (/adhd|attention/.test(t)) support.push("ADHD");
  if (/dyslexi/.test(t)) support.push("Dyslexia");
  if (/autis/.test(t)) support.push("Autism spectrum");
  if (/anxiety|nervous/.test(t)) support.push("Test anxiety");
  if (/gifted|advanced/.test(t)) support.push("Gifted & talented");
  if (/esl|english learner/.test(t)) support.push("English learners");
  if (support.length) c.learningSupport = support;

  return c;
}

const SUBJECT_ALIASES: Record<string, string[]> = {
  calculus: ["calc", "ap calc"],
  algebra: ["algebra 1", "algebra 2", "algebra ii"],
  sat: ["sat prep", "digital sat", "sat math", "sat test", "sat exam", "the sat"],
  act: ["act prep", "act test", "act exam", "the act"],
  "college-essays": ["college essay", "personal statement", "common app"],
  "us-history": ["apush", "american history"],
  "ap-computer-science": ["ap csa", "ap cs"],
  "executive-function": ["organization", "organisation", "planning skills"],
  "dyslexia-support": ["orton", "dyslexia"],
  "elementary-math": ["multiplication", "fractions", "math facts"],
  python: ["coding", "programming"],
  esl: ["toefl", "english as a second"],
  mandarin: ["chinese"],
};
