import type { Tutor } from "@/lib/types";

/*
 * The Top tutor badge: earned automatically, never bought or set by hand. Ratings come from published reviews of
 * real lessons; lessons completed and response time are counted by the scheduler (src/server/tutor-stats.ts).
 */
export const TOP_TUTOR = {
  minRating: 4.8,
  minReviews: 5,
  minLessons: 20,
  /** Usually replies within this many hours. */
  maxResponseHours: 24,
} as const;

export const TOP_TUTOR_RULE = `Rated ${TOP_TUTOR.minRating}+ from at least ${TOP_TUTOR.minReviews} reviews, ${TOP_TUTOR.minLessons}+ lessons taught, and usually replies within ${TOP_TUTOR.maxResponseHours} hours.`;

export function isTopTutor(t: Pick<Tutor, "rating" | "reviewCount" | "lessonsCompleted" | "responseTimeHours">): boolean {
  return (
    (t.rating ?? 0) >= TOP_TUTOR.minRating &&
    (t.reviewCount ?? 0) >= TOP_TUTOR.minReviews &&
    (t.lessonsCompleted ?? 0) >= TOP_TUTOR.minLessons &&
    t.responseTimeHours != null &&
    t.responseTimeHours <= TOP_TUTOR.maxResponseHours
  );
}
