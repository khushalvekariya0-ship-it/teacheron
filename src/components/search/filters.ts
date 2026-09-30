import type { TutorSearch } from "@/lib/search";
import { SCHEDULE_PRESETS } from "@/lib/search";
import { GRADE_LABEL, LEVEL_LABEL, subjectName, TIMES_OF_DAY, TUTOR_CATEGORY_LABEL } from "@/lib/data/catalog";
import { formatCents } from "@/lib/format";

/** Days in the order people read a week (the catalog stores Sun-first for Date math). */
export const WEEK_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const EXPERIENCE_OPTIONS = [
  { value: "1", label: "1+ years" },
  { value: "3", label: "3+ years" },
  { value: "5", label: "5+ years" },
  { value: "10", label: "10+ years" },
];

export const RATING_OPTIONS = [
  { value: "4.5", label: "4.5 and up" },
  { value: "4", label: "4.0 and up" },
  { value: "3.5", label: "3.5 and up" },
];

export type FilterGroupKey = "subject" | "location" | "price" | "schedule" | "tutor";

/** Which URL keys belong to which collapsible group (used for active counts). */
export const GROUP_KEYS: Record<FilterGroupKey, (keyof TutorSearch)[]> = {
  subject: ["subject", "grade", "level"],
  location: ["location", "radius", "mode"],
  price: ["minRate", "maxRate", "exp", "rating"],
  schedule: ["days", "times", "schedule"],
  tutor: ["category", "lang", "support", "certified", "verified", "trial", "instant"],
};

const isActive = (v: unknown) => v !== undefined && v !== false && v !== "" && !(Array.isArray(v) && v.length === 0);

export function groupCount(s: TutorSearch, group: FilterGroupKey): number {
  return GROUP_KEYS[group].filter((k) => isActive(s[k])).length;
}

/** Effective schedule shown in the panel: explicit days/times win, otherwise the preset's. */
export function effectiveSchedule(s: TutorSearch): { days: string[]; times: NonNullable<TutorSearch["times"]> } {
  const preset = SCHEDULE_PRESETS.find((p) => p.value === s.schedule);
  return { days: s.days ?? preset?.days ?? [], times: s.times ?? preset?.times ?? [] };
}

export interface FilterChip {
  id: string;
  label: string;
  remove: (s: TutorSearch) => TutorSearch;
}

const without = (...keys: (keyof TutorSearch)[]) => (s: TutorSearch): TutorSearch => {
  const next = { ...s };
  for (const k of keys) delete next[k];
  return next;
};

const orderDays = (days: string[]) => WEEK_ORDER.filter((d) => days.includes(d));

/** Removable chips for every active filter, in a stable, readable order. */
export function filterChips(s: TutorSearch): FilterChip[] {
  const chips: FilterChip[] = [];
  const add = (id: string, label: string, remove: FilterChip["remove"]) => chips.push({ id, label, remove });

  if (s.q) add("q", `“${s.q}”`, without("q"));
  if (s.subject) add("subject", subjectName(s.subject), without("subject"));
  if (s.grade) add("grade", GRADE_LABEL[s.grade], without("grade"));
  if (s.level) add("level", LEVEL_LABEL[s.level] ?? s.level, without("level"));
  if (s.location) add("location", `Near ${s.location}`, without("location", "radius"));
  if (s.radius && s.location) add("radius", `Within ${s.radius} mi`, without("radius"));
  if (s.mode) add("mode", s.mode === "online" ? "Online" : "In person", without("mode"));
  if (s.schedule && !s.days && !s.times) add("schedule", SCHEDULE_PRESETS.find((p) => p.value === s.schedule)?.label ?? "Schedule", without("schedule"));
  if (s.days?.length) add("days", orderDays(s.days).join(", "), without("days"));
  if (s.times?.length) add("times", s.times.map((t) => TIMES_OF_DAY.find((x) => x.value === t)?.label ?? t).join(", "), without("times"));
  if (s.minRate) add("minRate", `From ${formatCents(s.minRate * 100)}/hr`, without("minRate"));
  if (s.maxRate) add("maxRate", `Up to ${formatCents(s.maxRate * 100)}/hr`, without("maxRate"));
  if (s.exp) add("exp", `${s.exp}+ yrs experience`, without("exp"));
  if (s.rating) add("rating", `${s.rating.toFixed(1)}+ rating`, without("rating"));
  if (s.category) add("category", TUTOR_CATEGORY_LABEL[s.category] ?? s.category, without("category"));
  if (s.lang) add("lang", `Speaks ${s.lang}`, without("lang"));
  if (s.support) add("support", `${s.support} support`, without("support"));
  if (s.certified) add("certified", "Certified teachers", without("certified"));
  if (s.verified) add("verified", "ID verified", without("verified"));
  if (s.trial) add("trial", "Offers a trial", without("trial"));
  if (s.instant) add("instant", "Instant booking", without("instant"));
  return chips;
}

/** Resets every filter but keeps the chosen sort order. */
export function clearedSearch(s: TutorSearch): TutorSearch {
  return s.sort ? { sort: s.sort } : {};
}

/** Filters that count toward "Filters (n)": everything except sort (keyword included). */
export function filterCount(s: TutorSearch): number {
  return filterChips(s).length;
}
