import * as React from "react";
import type { ApplicationStatus, RequirementStatus } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "outline";

export const REQUIREMENT_STATUS_META: Record<RequirementStatus, { label: string; tone: Tone; description: string }> = {
  draft: { label: "Draft", tone: "neutral", description: "Only you can see this. Publish it so tutors can apply." },
  published: { label: "Published", tone: "success", description: "Visible to tutors and accepting applications." },
  paused: { label: "Paused", tone: "warning", description: "Hidden from tutors. Resume any time to accept applications again." },
  closed: { label: "Closed", tone: "outline", description: "No longer accepting applications." },
};

export function RequirementStatusBadge({ status, size = "sm" }: { status: RequirementStatus; size?: "sm" | "md" }) {
  const meta = REQUIREMENT_STATUS_META[status];
  return (
    <Badge tone={meta.tone} size={size} dot>
      {meta.label}
    </Badge>
  );
}

export const APPLICATION_STATUS_META: Record<ApplicationStatus, { label: string; tone: Tone }> = {
  applied: { label: "New", tone: "accent" },
  viewed: { label: "Viewed", tone: "neutral" },
  shortlisted: { label: "Shortlisted", tone: "accent" },
  contacted: { label: "Contacted", tone: "accent" },
  trial_requested: { label: "Trial requested", tone: "warning" },
  hired: { label: "Hired", tone: "success" },
  rejected: { label: "Declined", tone: "outline" },
  withdrawn: { label: "Withdrawn", tone: "outline" },
  closed: { label: "Closed", tone: "outline" },
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = APPLICATION_STATUS_META[status];
  return (
    <Badge tone={meta.tone} size="sm">
      {meta.label}
    </Badge>
  );
}

/** Applications that still count toward a requirement (withdrawn ones are hidden from families). */
export const isVisibleApplication = (status: ApplicationStatus) => status !== "withdrawn";
