import type { FeatureFlag } from "@/lib/types";

/** Stable 0–99 bucket for a user + flag, so a gradual rollout always shows the same result to the same person. */
export function rolloutBucket(key: string, subjectId: string): number {
  let h = 2166136261;
  for (const ch of `${key}:${subjectId}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100;
}

/**
 * A flag is on for a user when it is enabled and the user falls inside the rollout percentage.
 * Signed-out visitors are bucketed as "anonymous".
 */
export function isFlagOn(flags: FeatureFlag[], key: string, userId?: string | null): boolean {
  const f = flags.find((x) => x.key === key);
  if (!f?.enabled) return false;
  if (f.rolloutPercent >= 100) return true;
  if (f.rolloutPercent <= 0) return false;
  return rolloutBucket(key, userId ?? "anonymous") < f.rolloutPercent;
}
