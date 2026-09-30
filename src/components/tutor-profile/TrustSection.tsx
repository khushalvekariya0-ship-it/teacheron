"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarX2, CircleDashed, Clock3, Flag, MapPin, Monitor, ShieldCheck } from "lucide-react";
import type { Tutor, VerificationKind, VerificationStatus } from "@/lib/types";
import { policySummary } from "@/lib/booking";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/store/hooks";
import { VerificationChecks, VERIFICATION_LABEL } from "@/components/domain/Badges";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Input";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { toast } from "@/components/ui/Toast";
import { ProfileSection } from "./ProfileSections";

/** Neutral wording for checks that aren't complete — nothing is implied either way. */
function pendingPhrase(status: VerificationStatus): string {
  if (status === "submitted" || status === "under_review") return "review in progress";
  if (status === "expired") return "no longer current";
  return "not completed";
}

const REPORT_REASONS = [
  { value: "Misleading profile information", label: "Misleading profile information" },
  { value: "Inappropriate content", label: "Inappropriate content" },
  { value: "Asked to pay or talk off the platform", label: "Asked to pay or talk off the platform" },
  { value: "Safety concern", label: "Safety concern" },
  { value: "Something else", label: "Something else" },
];

function ReportDialog({ tutor, open, onOpenChange }: { tutor: Tutor; open: boolean; onOpenChange: (o: boolean) => void }) {
  const report = useApp((s) => s.report);
  const [reason, setReason] = React.useState("");
  const [details, setDetails] = React.useState("");
  const [errors, setErrors] = React.useState<{ reason?: string; details?: string }>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!reason) next.reason = "Choose a reason.";
    if (details.trim().length < 10) next.details = "Add a few words so our team can look into it (10+ characters).";
    setErrors(next);
    if (next.reason || next.details) return;
    const r = report({ targetType: "tutor", targetId: tutor.id, reason, details: details.trim() });
    if (!r.ok) return toast.error(r.error);
    onOpenChange(false);
    setReason("");
    setDetails("");
    toast.success("Report sent", { description: "Our trust & safety team reviews every report. Thank you for flagging it." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Report ${tutor.firstName}'s profile`} description="Reports are confidential. The tutor isn't told who sent them.">
        <form onSubmit={submit} noValidate>
          <DialogBody className="space-y-4">
            <Field label="Reason" required error={errors.reason}>
              <Select value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Choose a reason" options={REPORT_REASONS} />
            </Field>
            <Field label="What happened?" required error={errors.details}>
              <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} showCount rows={4} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Send report</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TrustSection({ tutor }: { tutor: Tutor }) {
  const policy = useApp((s) => s.policy);
  const me = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [reportOpen, setReportOpen] = React.useState(false);
  const pending = (Object.keys(tutor.verification) as VerificationKind[]).filter((k) => tutor.verification[k] !== "verified");
  const inPerson = tutor.modes.includes("in_person") && tutor.serviceRadiusMiles > 0;
  const regular = policySummary("regular", policy);
  const trialFirst = policySummary("trial", policy)[0];

  const openReport = () => {
    if (!me) {
      toast("Sign in to report a profile");
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setReportOpen(true);
  };

  return (
    <ProfileSection id="trust" title="Trust & safety">
      <div className="grid gap-4 md:grid-cols-2">
        <Reveal y={10} amount={0.1} className="rounded-xl border border-line p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ShieldCheck className="size-4 text-navy" aria-hidden /> Verification
          </h3>
          <VerificationChecks tutor={tutor} className="mt-3" />
          {pending.length > 0 && (
            <ul className="mt-3 space-y-2 border-t border-line pt-3">
              {pending.map((k) => (
                <li key={k} className="flex items-center gap-2.5 text-sm text-muted">
                  {tutor.verification[k] === "submitted" || tutor.verification[k] === "under_review" ? <Clock3 className="size-4 text-subtle" aria-hidden /> : <CircleDashed className="size-4 text-subtle" aria-hidden />}
                  {VERIFICATION_LABEL[k]}: {pendingPhrase(tutor.verification[k])}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
            Checks are reviewed by our team. A check shows as verified only once it&rsquo;s complete.{" "}
            <Link href="/trust-safety" className="font-medium text-navy underline-offset-4 hover:underline">
              How verification works
            </Link>
          </p>
        </Reveal>

        <Reveal y={10} delay={0.05} amount={0.1} className="rounded-xl border border-line p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            {inPerson ? <MapPin className="size-4 text-navy" aria-hidden /> : <Monitor className="size-4 text-navy" aria-hidden />} Service area
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            {inPerson ? `Teaches in person within ~${tutor.serviceRadiusMiles} mi of ${tutor.city}, ${tutor.state}.` : `Teaches online. Based in ${tutor.city}, ${tutor.state}.`}
            {inPerson && tutor.modes.includes("online") && " Also teaches online."}
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">We never show a tutor&rsquo;s address. For in-person lessons you agree on a meeting place in messages.</p>
        </Reveal>

        <Reveal y={10} delay={0.1} amount={0.1} className="rounded-xl border border-line p-5 md:col-span-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <CalendarX2 className="size-4 text-navy" aria-hidden /> Cancellation policy
          </h3>
          <ul className="mt-3 grid gap-x-8 gap-y-2 text-sm text-ink-2 sm:grid-cols-2">
            {regular.map((p) => (
              <li key={p} className="flex gap-2.5">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-subtle" aria-hidden />
                {p}
              </li>
            ))}
            {tutor.trial.enabled && (
              <li className="flex gap-2.5">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-subtle" aria-hidden />
                Trial lessons: {trialFirst.charAt(0).toLowerCase() + trialFirst.slice(1)}
              </li>
            )}
          </ul>
        </Reveal>
      </div>

      <div className="mt-6 flex flex-col gap-3 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>Keep messages and payments on TutorLink &mdash; it&rsquo;s how we can help if something goes wrong.</p>
        <Button variant="ghost" size="sm" onClick={openReport} className="self-start text-muted sm:self-auto">
          <Flag /> Report this profile
        </Button>
      </div>
      <ReportDialog tutor={tutor} open={reportOpen} onOpenChange={setReportOpen} />
    </ProfileSection>
  );
}
