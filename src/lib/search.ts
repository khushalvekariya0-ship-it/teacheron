import type { Grade, Level, TeachingMode, Tutor, TutorCategory } from "@/lib/types";
import { gradeToLevel, subjectName, SUBJECT_BY_SLUG, WEEKDAYS, TIMES_OF_DAY, GRADE_LABEL, LEVEL_LABEL } from "@/lib/data/catalog";
import { distanceMiles, resolveLocation } from "@/lib/data/geo";
import { rankTutors, type MatchCriteria } from "@/lib/matching";
import { formatCents } from "@/lib/format";

/**
 * URL contract for tutor search. Used by the homepage search, /tutors, subject/location landing pages
 * and saved searches, so every entry point produces the same results.
 */
export interface TutorSearch {
  q?: string;
  subject?: string; // subject slug
  grade?: Grade;
  level?: Level;
  location?: string; // ZIP or "City, ST"
  radius?: number; // miles
  mode?: TeachingMode;
  schedule?: SchedulePreset;
  days?: string[]; // Mon..Sun
  times?: ("morning" | "afternoon" | "evening")[];
  minRate?: number; // dollars
  maxRate?: number; // dollars
  exp?: number; // min years
  lang?: string;
  rating?: number; // min rating
  category?: TutorCategory;
  support?: string;
  verified?: boolean;
  trial?: boolean;
  instant?: boolean;
  certified?: boolean;
  sort?: SortKey;
}

export type SortKey = "match" | "rating" | "price_asc" | "price_desc" | "experience";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "match", label: "Best match" },
  { value: "rating", label: "Highest rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "experience", label: "Most experienced" },
];

export type SchedulePreset = "weekday_afternoons" | "weekday_evenings" | "weekends" | "mornings";

export const SCHEDULE_PRESETS: { value: SchedulePreset; label: string; days: string[]; times: ("morning" | "afternoon" | "evening")[] }[] = [
  { value: "weekday_afternoons", label: "Weekday afternoons", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], times: ["afternoon"] },
  { value: "weekday_evenings", label: "Weekday evenings", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], times: ["evening"] },
  { value: "weekends", label: "Weekends", days: ["Sat", "Sun"], times: ["morning", "afternoon", "evening"] },
  { value: "mornings", label: "Mornings", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], times: ["morning"] },
];

export const RADIUS_OPTIONS = [5, 10, 25, 50];

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function get(src: ParamSource, key: string): string | undefined {
  if (src instanceof URLSearchParams) return src.get(key) ?? undefined;
  const v = src[key];
  return Array.isArray(v) ? v[0] : v;
}

const num = (v?: string) => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined);
const bool = (v?: string) => (v === "1" || v === "true" ? true : undefined);

export function parseTutorSearch(src: ParamSource): TutorSearch {
  const days = get(src, "days")?.split(",").filter((d) => (WEEKDAYS as readonly string[]).includes(d));
  const times = get(src, "times")?.split(",").filter((t) => TIMES_OF_DAY.some((x) => x.value === t)) as TutorSearch["times"];
  const mode = get(src, "mode");
  const subject = get(src, "subject");
  const grade = get(src, "grade") as Grade | undefined;
  return {
    q: get(src, "q")?.trim() || undefined,
    subject: subject && SUBJECT_BY_SLUG[subject] ? subject : undefined,
    grade: grade && GRADE_LABEL[grade] ? grade : undefined,
    level: (get(src, "level") as Level) || undefined,
    location: get(src, "location")?.trim() || undefined,
    radius: num(get(src, "radius")),
    mode: mode === "online" || mode === "in_person" ? mode : undefined,
    schedule: SCHEDULE_PRESETS.some((p) => p.value === get(src, "schedule")) ? (get(src, "schedule") as SchedulePreset) : undefined,
    days: days?.length ? days : undefined,
    times: times?.length ? times : undefined,
    minRate: num(get(src, "minRate")),
    maxRate: num(get(src, "maxRate")),
    exp: num(get(src, "exp")),
    lang: get(src, "lang") || undefined,
    rating: num(get(src, "rating")),
    category: (get(src, "category") as TutorCategory) || undefined,
    support: get(src, "support") || undefined,
    verified: bool(get(src, "verified")),
    trial: bool(get(src, "trial")),
    instant: bool(get(src, "instant")),
    certified: bool(get(src, "certified")),
    sort: (SORT_OPTIONS.some((s) => s.value === get(src, "sort")) ? get(src, "sort") : undefined) as SortKey | undefined,
  };
}

export function toQueryString(s: TutorSearch): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(s)) {
    if (v === undefined || v === "" || v === false) continue;
    if (Array.isArray(v)) {
      if (v.length) p.set(k, v.join(","));
    } else p.set(k, v === true ? "1" : String(v));
  }
  return p.toString();
}

export function toRecord(s: TutorSearch): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(toQueryString(s)));
}

/** Number of active filters, excluding sort and free-text query. */
export function activeFilterCount(s: TutorSearch): number {
  const { sort: _s, q: _q, ...rest } = s;
  void _s; void _q;
  return Object.values(rest).filter((v) => v !== undefined && v !== false && !(Array.isArray(v) && !v.length)).length;
}

/** Human summary for saved-search labels and result headings. */
export function describeSearch(s: TutorSearch): string {
  const parts: string[] = [];
  if (s.subject) parts.push(subjectName(s.subject));
  else if (s.q) parts.push(`“${s.q}”`);
  if (s.grade) parts.push(GRADE_LABEL[s.grade]);
  else if (s.level) parts.push(LEVEL_LABEL[s.level]);
  if (s.mode) parts.push(s.mode === "online" ? "Online" : "In person");
  if (s.location) parts.push(`Near ${s.location}`);
  if (s.maxRate) parts.push(`Up to ${formatCents(s.maxRate * 100)}/hr`);
  return parts.join(" · ") || "All tutors";
}

function toCriteria(s: TutorSearch): MatchCriteria {
  const preset = SCHEDULE_PRESETS.find((p) => p.value === s.schedule);
  return {
    subject: s.subject,
    grade: s.grade,
    modes: s.mode ? [s.mode] : undefined,
    location: s.location,
    maxDistanceMiles: s.radius,
    budgetMaxCents: s.maxRate ? s.maxRate * 100 : undefined,
    days: s.days ?? preset?.days,
    timesOfDay: s.times ?? preset?.times,
    minExperienceYears: s.exp,
    language: s.lang,
    learningSupport: s.support ? [s.support] : undefined,
  };
}

export interface SearchResult {
  tutor: Tutor;
  distance: number | null;
  matchPercent: number;
}

function availableIn(t: Tutor, days?: string[], times?: TutorSearch["times"]): boolean {
  if (!days?.length && !times?.length) return true;
  const wantDays = (days?.length ? days : [...WEEKDAYS]).map((d) => WEEKDAYS.indexOf(d as (typeof WEEKDAYS)[number]));
  const wantTimes = times?.length ? times : (["morning", "afternoon", "evening"] as const);
  return t.availability.some((w) => {
    if (!wantDays.includes(w.day)) return false;
    const s = parseInt(w.start, 10);
    const e = parseInt(w.end, 10) + (w.end.endsWith("30") ? 0.5 : 0);
    return wantTimes.some((tod) => {
      const r = TIMES_OF_DAY.find((x) => x.value === tod)!;
      return s < r.end && e > r.start;
    });
  });
}

/**
 * Filters then sorts. Filters are hard constraints; "Best match" ordering uses the same transparent
 * factors shown on the concierge page. Featured status and subscription tier never affect order.
 */
export function searchTutors(tutors: Tutor[], s: TutorSearch): SearchResult[] {
  const point = s.location ? resolveLocation(s.location) : null;
  const preset = SCHEDULE_PRESETS.find((p) => p.value === s.schedule);
  const days = s.days ?? preset?.days;
  const times = s.times ?? preset?.times;
  const q = s.q?.toLowerCase();

  const filtered = tutors.filter((t) => {
    if (q) {
      const hay = [t.firstName, t.lastName, t.headline, t.bio, ...t.subjects.map(subjectName), ...t.specialties].join(" ").toLowerCase();
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    if (s.subject && !t.subjects.includes(s.subject)) return false;
    if (s.grade && !t.levels.includes(gradeToLevel(s.grade))) return false;
    if (s.level && !t.levels.includes(s.level)) return false;
    if (s.mode && !t.modes.includes(s.mode)) return false;
    if (point && s.mode === "in_person") {
      // In person: within the visitor's chosen radius, or the tutor's own service area by default.
      if (distanceMiles(point, t) > (s.radius ?? t.serviceRadiusMiles)) return false;
    } else if (point && s.radius && !t.modes.includes("online")) {
      // Either mode: online tutors are always reachable; in-person-only tutors must be within the radius.
      if (distanceMiles(point, t) > s.radius) return false;
    }
    if (s.minRate && t.hourlyRateCents < s.minRate * 100) return false;
    if (s.maxRate && t.hourlyRateCents > s.maxRate * 100) return false;
    if (s.exp && t.experienceYears < s.exp) return false;
    if (s.lang && !t.languages.includes(s.lang)) return false;
    if (s.rating && (t.rating ?? 0) < s.rating) return false;
    if (s.category && t.category !== s.category) return false;
    if (s.support && !t.learningSupport.includes(s.support)) return false;
    if (s.verified && t.verification.identity !== "verified") return false;
    if (s.certified && !t.certifications.some((c) => c.verified)) return false;
    if (s.trial && !t.trial.enabled) return false;
    if (s.instant && t.rules.requiresApproval) return false;
    if (!availableIn(t, days, times)) return false;
    return true;
  });

  const ranked = rankTutors(filtered, toCriteria(s));
  const results: SearchResult[] = ranked.map((r) => ({ tutor: r.tutor, distance: point ? Math.round(distanceMiles(point, r.tutor) * 10) / 10 : null, matchPercent: r.percent }));

  switch (s.sort ?? "match") {
    case "rating":
      return results.sort((a, b) => (b.tutor.rating ?? 0) - (a.tutor.rating ?? 0) || b.tutor.reviewCount - a.tutor.reviewCount);
    case "price_asc":
      return results.sort((a, b) => a.tutor.hourlyRateCents - b.tutor.hourlyRateCents);
    case "price_desc":
      return results.sort((a, b) => b.tutor.hourlyRateCents - a.tutor.hourlyRateCents);
    case "experience":
      return results.sort((a, b) => b.tutor.experienceYears - a.tutor.experienceYears);
    default:
      return results;
  }
}
