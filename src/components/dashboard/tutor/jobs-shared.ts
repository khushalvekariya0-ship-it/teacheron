import type { ApplicationStatus, Requirement } from "@/lib/types";
import type { MatchCriteria } from "@/lib/matching";
import { formatCents } from "@/lib/format";

/** What each application status means, in the tutor's words. */
export const APPLICATION_STATUS_META: Record<ApplicationStatus, { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger"; description: string }> = {
  applied: { label: "Applied", tone: "neutral", description: "Sent. The family sees it on their requirement." },
  viewed: { label: "Viewed", tone: "accent", description: "The family opened your application." },
  shortlisted: { label: "Shortlisted", tone: "accent", description: "You're on the family's shortlist." },
  contacted: { label: "Contacted", tone: "accent", description: "The family reached out — check your messages." },
  trial_requested: { label: "Trial requested", tone: "warning", description: "The family wants a trial. Watch for a booking request." },
  hired: { label: "Hired", tone: "success", description: "The family chose you. Lessons are booked through TutorLink." },
  rejected: { label: "Not selected", tone: "neutral", description: "The family chose another tutor this time." },
  withdrawn: { label: "Withdrawn", tone: "neutral", description: "You withdrew this application." },
  closed: { label: "Job closed", tone: "neutral", description: "The family closed the requirement." },
};

/** The forward path an application can take. */
export const APPLICATION_PIPELINE: ApplicationStatus[] = ["applied", "viewed", "shortlisted", "contacted", "trial_requested", "hired"];
export const ACTIVE_APPLICATION: ApplicationStatus[] = ["applied", "viewed", "shortlisted", "contacted", "trial_requested"];

/** Converts a family's requirement into matching criteria, so tutors see the same transparent score families do. */
export function requirementCriteria(r: Requirement): MatchCriteria {
  return {
    subject: r.subject,
    grade: r.grade,
    modes: r.modes,
    location: r.zip || undefined,
    budgetMaxCents: r.budgetMaxCents,
    days: r.days,
    timesOfDay: r.timesOfDay,
    minExperienceYears: r.minExperienceYears,
    language: r.languages.find((l) => l !== "English"),
    learningSupport: r.learningSupport,
  };
}

export function budgetLabel(r: Pick<Requirement, "budgetMinCents" | "budgetMaxCents">): string {
  return r.budgetMinCents === r.budgetMaxCents ? `${formatCents(r.budgetMaxCents)}/hr` : `${formatCents(r.budgetMinCents)}–${formatCents(r.budgetMaxCents)}/hr`;
}

const TIME_LABEL: Record<string, string> = { morning: "mornings", afternoon: "afternoons", evening: "evenings" };

export function scheduleLabel(r: Pick<Requirement, "days" | "timesOfDay" | "sessionsPerWeek">): string {
  const days = r.days.length ? r.days.join(", ") : "Flexible days";
  const times = r.timesOfDay.length ? r.timesOfDay.map((t) => TIME_LABEL[t] ?? t).join(" or ") : "any time";
  return `${r.sessionsPerWeek}× per week · ${days} · ${times}`;
}
