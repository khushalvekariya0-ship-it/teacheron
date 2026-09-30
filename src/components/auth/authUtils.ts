import type { Role } from "@/lib/types";
import { homeFor } from "@/lib/permissions";

/**
 * Only same-origin, path-absolute redirects are honoured. Anything else (absolute URLs,
 * protocol-relative "//evil.com", backslash tricks) falls back to the role's home.
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

/** Where to send a user after signing in: the requested page when their role can open it, else their home. */
export function destinationFor(role: Role, next: string | null): string {
  if (!next) return homeFor(role);
  const staff = role === "admin" || role === "support";
  const isAdminPath = next === "/admin" || next.startsWith("/admin/") || next.startsWith("/admin?");
  const isMemberDashboard = next === "/dashboard" || next.startsWith("/dashboard/") || next.startsWith("/dashboard?");
  if (isAdminPath && !staff) return homeFor(role);
  if (isMemberDashboard && staff) return homeFor(role);
  return next;
}

export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

/** Simple, explainable password strength estimate. Length matters most. */
export function passwordStrength(pw: string): { level: StrengthLevel; label: string; hint: string } {
  if (!pw) return { level: 0, label: "", hint: "Use at least 10 characters." };
  if (pw.length < 10) return { level: 1, label: "Too short", hint: `${10 - pw.length} more character${10 - pw.length === 1 ? "" : "s"} needed.` };
  let variety = 0;
  if (/[a-z]/.test(pw)) variety++;
  if (/[A-Z]/.test(pw)) variety++;
  if (/\d/.test(pw)) variety++;
  if (/[^A-Za-z0-9]/.test(pw)) variety++;
  const common = /^(password|1234567890|qwertyuiop|tutorlink)/i.test(pw) || /^(.)\1+$/.test(pw);
  if (common) return { level: 1, label: "Weak", hint: "Avoid common words and repeated characters." };
  if (pw.length >= 16 && variety >= 2) return { level: 4, label: "Strong", hint: "Great — long passphrases are the hardest to guess." };
  if (variety >= 3 || pw.length >= 14) return { level: 3, label: "Good", hint: "Longer is even better — try a short phrase." };
  return { level: 2, label: "Fair", hint: "Mix in numbers or symbols, or make it longer." };
}
