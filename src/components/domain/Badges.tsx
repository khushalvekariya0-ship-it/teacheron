import * as React from "react";
import { BadgeCheck, GraduationCap, ScrollText, ShieldCheck, Clock3, CircleDashed, CircleX, CircleAlert } from "lucide-react";
import type { BookingStatus, PaymentStatus, Tutor, VerificationKind, VerificationStatus } from "@/lib/types";
import { STATUS_META } from "@/lib/booking";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export const VERIFICATION_LABEL: Record<VerificationKind, string> = {
  identity: "Identity",
  education: "Education",
  certification: "Teaching certification",
  background: "Background screening",
};

const VERIFICATION_ICON: Record<VerificationKind, React.ComponentType<{ className?: string }>> = {
  identity: BadgeCheck,
  education: GraduationCap,
  certification: ScrollText,
  background: ShieldCheck,
};

export const VERIFICATION_STATUS_META: Record<VerificationStatus, { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  not_started: { label: "Not started", tone: "neutral" },
  submitted: { label: "Submitted", tone: "accent" },
  under_review: { label: "Under review", tone: "warning" },
  verified: { label: "Verified", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  expired: { label: "Expired", tone: "danger" },
};

/** Renders nothing unless identity verification has actually been completed. */
export function VerifiedBadge({ tutor, className, size = "md" }: { tutor: Pick<Tutor, "verification">; className?: string; size?: "sm" | "md" }) {
  if (tutor.verification.identity !== "verified") return null;
  return (
    <Badge tone="accent" size={size} className={className}>
      <BadgeCheck /> ID verified
    </Badge>
  );
}

/** Lists only the checks that are complete. Nothing is implied for checks in progress. */
export function VerificationChecks({ tutor, className }: { tutor: Pick<Tutor, "verification">; className?: string }) {
  const done = (Object.keys(tutor.verification) as VerificationKind[]).filter((k) => tutor.verification[k] === "verified");
  if (!done.length) return <p className={cn("text-sm text-muted", className)}>No verification checks completed yet.</p>;
  return (
    <ul className={cn("space-y-2", className)}>
      {done.map((k) => {
        const Icon = VERIFICATION_ICON[k];
        return (
          <li key={k} className="flex items-center gap-2.5 text-sm text-ink-2">
            <Icon className="size-4 text-navy" />
            {VERIFICATION_LABEL[k]} verified
          </li>
        );
      })}
    </ul>
  );
}

export function VerificationStatusBadge({ status }: { status: VerificationStatus }) {
  const meta = VERIFICATION_STATUS_META[status];
  const Icon = status === "verified" ? BadgeCheck : status === "not_started" ? CircleDashed : status === "rejected" ? CircleX : status === "expired" ? CircleAlert : Clock3;
  return (
    <Badge tone={meta.tone} size="sm">
      <Icon /> {meta.label}
    </Badge>
  );
}

export function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone} size="sm" dot className={className}>
      {meta.label}
    </Badge>
  );
}

const PAYMENT_META: Record<PaymentStatus, { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  unpaid: { label: "No charge", tone: "neutral" },
  authorized: { label: "Authorized", tone: "accent" },
  paid: { label: "Paid", tone: "success" },
  refunded: { label: "Refunded", tone: "neutral" },
  partially_refunded: { label: "Partially refunded", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const meta = PAYMENT_META[status];
  return (
    <Badge tone={meta.tone} size="sm">
      {meta.label}
    </Badge>
  );
}
