"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Clock3, ExternalLink, FileSearch, GraduationCap, ScrollText, ShieldCheck, Upload } from "lucide-react";
import type { VerificationKind, VerificationRequest, VerificationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useViewerTimezone } from "@/lib/store/hooks";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/Shell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { EASE } from "@/components/motion";
import { VERIFICATION_LABEL, VerificationStatusBadge } from "@/components/domain/Badges";
import { FileList, FilePicker, NeedsTutorProfile, formatKb, toPicked, validateDocs, type PickedFile } from "./shared";
import { useMyTutor } from "./hooks";

const KINDS: VerificationKind[] = ["identity", "education", "certification", "background"];

const COPY: Record<VerificationKind, { icon: React.ComponentType<{ className?: string }>; involves: string; upload: string }> = {
  identity: {
    icon: BadgeCheck,
    involves: "We match a government-issued photo ID to the name on your account. Families see an “ID verified” badge once it's approved.",
    upload: "Driver's license, state ID or passport. Include the back if your ID has information there.",
  },
  education: {
    icon: GraduationCap,
    involves: "We confirm the degrees on your profile against your diploma or transcript. Only verified entries show as verified.",
    upload: "Diploma, official transcript, or an enrollment letter if you're a current student.",
  },
  certification: {
    icon: ScrollText,
    involves: "We check teaching licenses and certificates with the issuing organization, including the dates they're valid.",
    upload: "Certificate or license showing your name, the issuer and the date issued.",
  },
  background: {
    icon: ShieldCheck,
    involves: "A background screening run with your written consent. Recommended for anyone working with students under 18.",
    upload: "Your signed background check consent form.",
  },
};

const CAN_SUBMIT: VerificationStatus[] = ["not_started", "rejected", "expired"];
const EMPTY: VerificationRequest[] = [];

export function VerificationView() {
  const { tutor } = useMyTutor();
  const tz = useViewerTimezone();
  const all = useApp((s) => s.verificationRequests);
  const submit = useApp((s) => s.submitVerification);
  const requests = React.useMemo(() => (tutor ? all.filter((r) => r.tutorId === tutor.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)) : EMPTY), [all, tutor]);

  if (!tutor) return <NeedsTutorProfile what="verification" />;

  const verified = KINDS.filter((k) => tutor.verification[k] === "verified").length;

  const columns: Column<VerificationRequest>[] = [
    { key: "kind", header: "Check", cell: (r) => <span className="font-medium text-ink">{VERIFICATION_LABEL[r.kind]}</span>, sortValue: (r) => r.kind },
    { key: "submitted", header: "Submitted", cell: (r) => <span className="tabular-nums">{formatDate(r.submittedAt, tz)}</span>, sortValue: (r) => r.submittedAt },
    {
      key: "docs",
      header: "Documents",
      cell: (r) => (
        <span className="block max-w-56 truncate" title={r.documents.map((d) => d.name).join(", ")}>
          {r.documents.map((d) => d.name).join(", ")}
        </span>
      ),
      hideOnMobile: true,
    },
    { key: "status", header: "Status", cell: (r) => <VerificationStatusBadge status={r.status} /> },
    { key: "reviewed", header: "Reviewed", cell: (r) => (r.reviewedAt ? <span className="tabular-nums">{formatDate(r.reviewedAt, tz)}</span> : "—") },
    { key: "expires", header: "Expires", cell: (r) => (r.expiresAt ? <span className="tabular-nums">{formatDate(r.expiresAt, tz)}</span> : "—"), hideOnMobile: true },
    { key: "note", header: "Reviewer note", cell: (r) => (r.note ? <span className="block max-w-64 whitespace-normal text-ink-2">{r.note}</span> : "—") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verification"
        description="Build trust with families. Each check is reviewed by the TutorLink trust team."
        actions={
          <Button asChild variant="secondary">
            <Link href={`/tutors/${tutor.slug}`}>
              See your public profile <ExternalLink />
            </Link>
          </Button>
        }
      />

      <InlineAlert tone="info" title={`${verified} of ${KINDS.length} checks verified`}>
        Badges appear on your public profile only after a check is verified. Checks that are submitted or under review are never shown as verified.
      </InlineAlert>

      <div className="grid gap-4 lg:grid-cols-2">
        {KINDS.map((kind, i) => (
          <motion.div key={kind} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE, delay: i * 0.05 }}>
            <CheckCard kind={kind} status={tutor.verification[kind]} latest={requests.find((r) => r.kind === kind)} tz={tz} onSubmit={(docs) => submit(kind, docs)} />
          </motion.div>
        ))}
      </div>

      <section aria-labelledby="vh-h" className="space-y-3">
        <div>
          <h2 id="vh-h" className="text-[15px] font-semibold tracking-tight text-ink">
            Request history
          </h2>
          <p className="text-[13px] text-muted">Every document you&apos;ve submitted and the outcome.</p>
        </div>
        <DataTable rows={requests} columns={columns} rowKey={(r) => r.id} pageSize={8} empty={<EmptyState compact icon={<FileSearch />} title="No requests yet" description="Submit documents for a check above to start a review." />} />
      </section>
    </div>
  );
}

function CheckCard({
  kind,
  status,
  latest,
  tz,
  onSubmit,
}: {
  kind: VerificationKind;
  status: VerificationStatus;
  latest?: VerificationRequest;
  tz: string;
  onSubmit: (docs: PickedFile[]) => { ok: true } | { ok: false; error: string };
}) {
  const { icon: Icon, involves, upload } = COPY[kind];
  const [files, setFiles] = React.useState<PickedFile[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const canSubmit = CAN_SUBMIT.includes(status);
  const inputId = `verify-${kind}`;
  const errorId = `${inputId}-error`;

  const add = (list: File[]) => {
    const picked = list.map(toPicked);
    const next = [...files.filter((f) => !picked.some((p) => p.name === f.name)), ...picked].slice(0, 5);
    const err = validateDocs(next);
    setError(err);
    if (!err) setFiles(next);
  };

  const send = () => {
    const err = validateDocs(files);
    if (err) return setError(err);
    setBusy(true);
    const res = onSubmit(files);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setFiles([]);
    setError(null);
    toast.success(`${VERIFICATION_LABEL[kind]} documents submitted`, { description: "We'll notify you when the review is complete." });
  };

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-start gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", status === "verified" ? "bg-ink text-on-ink" : "bg-canvas text-ink")} aria-hidden>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">{VERIFICATION_LABEL[kind]}</h2>
            <VerificationStatusBadge status={status} />
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{involves}</p>
        </div>
      </div>

      <div className="mt-4 flex-1 border-t border-line pt-4">
        {status === "verified" ? (
          <p className="text-sm text-ink-2">
            Verified{latest?.reviewedAt ? ` on ${formatDate(latest.reviewedAt, tz)}` : ""}.
            {latest?.expiresAt ? ` Renew before ${formatDate(latest.expiresAt, tz)} to keep your badge.` : ""}
          </p>
        ) : status === "submitted" || status === "under_review" ? (
          <p className="flex items-start gap-2 text-sm text-ink-2">
            <Clock3 className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <span>
              {status === "submitted" ? "Submitted" : "Under review"}
              {latest ? ` since ${formatDate(latest.submittedAt, tz)}` : ""}. Reviews are handled in the order they&apos;re received and you&apos;ll get a notification with the outcome.
            </span>
          </p>
        ) : (
          <div className="space-y-3">
            {status === "rejected" && (
              <InlineAlert tone="danger" title="Documents weren't accepted">
                {latest?.note ?? "Please upload clearer or different documents."}
              </InlineAlert>
            )}
            {status === "expired" && <InlineAlert tone="warning" title="This check has expired">Upload current documents to renew your badge.</InlineAlert>}
            <p className="text-[13px] text-muted">
              <span className="font-medium text-ink-2">What to upload: </span>
              {upload}
            </p>
            <FilePicker id={inputId} multiple onFiles={add} invalid={!!error} describedBy={error ? errorId : undefined} hint="PDF, PNG, JPG or HEIC · up to 15 MB each · up to 5 files" />
            <AnimatePresence initial={false}>
              {files.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <FileList files={files} onRemove={(name) => setFiles((fs) => fs.filter((f) => f.name !== name))} />
                  <p className="mt-1.5 text-[12px] text-muted">
                    {files.length} {files.length === 1 ? "file" : "files"} · {formatKb(files.reduce((n, f) => n + f.sizeKb, 0))}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            {error && (
              <p id={errorId} role="alert" className="text-[13px] text-danger">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      {canSubmit && (
        <div className="mt-4 flex justify-end">
          <Button onClick={send} disabled={!files.length} loading={busy}>
            <Upload /> Submit for review
          </Button>
        </div>
      )}
    </Card>
  );
}
