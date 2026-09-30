import type { Subject, Tutor } from "@/lib/types";
import { SUBJECTS, SUBJECT_CATEGORIES } from "@/lib/data/catalog";
import { METROS, distanceMiles, type Metro } from "@/lib/data/geo";
import { TUTORS } from "@/lib/data/tutors";

/*
 * Figures shown on public marketing pages. Everything here is computed from the sample data in
 * src/lib/data — nothing is typed in by hand — so the pages stay honest as the catalog changes.
 */

export function tutorsForSubject(slug: string, tutors: Tutor[] = TUTORS): Tutor[] {
  return tutors.filter((t) => t.subjects.includes(slug));
}

export function tutorCountBySubject(tutors: Tutor[] = TUTORS): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(SUBJECTS.map((s) => [s.slug, 0]));
  for (const t of tutors) for (const s of t.subjects) if (s in counts) counts[s] += 1;
  return counts;
}

/** Unique tutors who teach at least one subject in a category. */
export function tutorsInCategory(category: string, tutors: Tutor[] = TUTORS): Tutor[] {
  const slugs = new Set(SUBJECTS.filter((s) => s.category === category).map((s) => s.slug));
  return tutors.filter((t) => t.subjects.some((s) => slugs.has(s)));
}

export function subjectsInCategory(category: string): Subject[] {
  return SUBJECTS.filter((s) => s.category === category);
}

export function categoryName(slug: string): string {
  return SUBJECT_CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}

/** Subjects with at least one tutor — the only subject pages we ask search engines to index. */
export function indexableSubjects(tutors: Tutor[] = TUTORS): Subject[] {
  const counts = tutorCountBySubject(tutors);
  return SUBJECTS.filter((s) => counts[s.slug] > 0);
}

export interface NearbyTutor {
  tutor: Tutor;
  distance: number;
}

/**
 * Tutors who teach in person and whose own service radius covers the metro centroid.
 * Sorted by distance, then lessons completed — never by featured status or plan.
 */
export function inPersonTutorsForMetro(metro: Pick<Metro, "lat" | "lng">, tutors: Tutor[] = TUTORS): NearbyTutor[] {
  return tutors
    .filter((t) => t.modes.includes("in_person") && t.serviceRadiusMiles > 0)
    .map((t) => ({ tutor: t, distance: Math.round(distanceMiles(metro, t) * 10) / 10 }))
    .filter((r) => r.distance <= r.tutor.serviceRadiusMiles)
    .sort((a, b) => a.distance - b.distance || b.tutor.lessonsCompleted - a.tutor.lessonsCompleted || a.tutor.lastName.localeCompare(b.tutor.lastName));
}

export function onlineTutors(tutors: Tutor[] = TUTORS): Tutor[] {
  return tutors.filter((t) => t.modes.includes("online"));
}

/** Metros with at least one in-person tutor — the only location pages we index. */
export function indexableMetros(tutors: Tutor[] = TUTORS): Metro[] {
  return METROS.filter((m) => inPersonTutorsForMetro(m, tutors).length > 0);
}

export function rateRange(tutors: Tutor[]): { min: number; max: number } | null {
  if (!tutors.length) return null;
  const rates = tutors.map((t) => t.hourlyRateCents);
  return { min: Math.min(...rates), max: Math.max(...rates) };
}

/** Median hourly rate in cents (lower middle for even counts, so it is always a real listed rate). */
export function medianRate(tutors: Tutor[] = TUTORS): number {
  const sorted = tutors.map((t) => t.hourlyRateCents).sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

export function trialStats(tutors: Tutor[] = TUTORS): { offering: number; free: number } {
  const offering = tutors.filter((t) => t.trial.enabled);
  return { offering: offering.length, free: offering.filter((t) => t.trial.priceCents === 0).length };
}

/** Stable ordering for public lists that must not favour paid or featured tutors. */
export function neutralOrder(tutors: Tutor[]): Tutor[] {
  return [...tutors].sort((a, b) => b.lessonsCompleted - a.lessonsCompleted || a.lastName.localeCompare(b.lastName));
}
