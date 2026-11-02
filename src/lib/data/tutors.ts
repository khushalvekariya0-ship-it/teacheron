import type { Tutor, VerificationKind } from "@/lib/types";

/* Display helpers for tutor profiles. Tutors themselves come from the database (see src/server). */

export function tutorName(t: Pick<Tutor, "firstName" | "lastName">): string {
  return `${t.firstName} ${t.lastName}`;
}

/** Public display name: first name + last initial, as shown on cards before contact. */
export function tutorShortName(t: Pick<Tutor, "firstName" | "lastName">): string {
  return `${t.firstName} ${t.lastName.charAt(0)}.`;
}

/** True only when identity has actually been verified. Badges must use this, never a hard-coded flag. */
export function isIdentityVerified(t: Pick<Tutor, "verification">): boolean {
  return t.verification.identity === "verified";
}

export function verifiedKinds(t: Pick<Tutor, "verification">): VerificationKind[] {
  return (Object.keys(t.verification) as VerificationKind[]).filter((k) => t.verification[k] === "verified");
}
