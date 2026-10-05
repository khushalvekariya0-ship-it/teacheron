"use client";

import * as React from "react";
import { FileText, Flag, Gavel, Paperclip, ShieldCheck, Star, X } from "lucide-react";
import type { Booking, Dispute, Review } from "@/lib/types";
import { useApp } from "@/lib/store";
import { REVIEWS } from "@/lib/data/reviews";
import type { BookingPolicy } from "@/lib/data/platform";
import { formatCents, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AnimatePresence, EASE, motion } from "@/components/motion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Select, Textarea } from "@/components/ui/Input";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { StarInput } from "@/components/ui/StarRating";
import { toast } from "@/components/ui/Toast";

/* ─── Review ────────────────────────────────────────────────────────────────── */

export function useLessonReview(b: Booking): Review | undefined {
  const local = useApp((s) => s.reviews);
  return React.useMemo(() => {
    if (!b.reviewId) return local.find((r) => r.bookingId === b.id);
    return local.find((r) => r.id === b.reviewId) ?? REVIEWS.find((r) => r.id === b.reviewId);
  }, [local, b.reviewId, b.id]);
}

export function ReviewForm({ booking: b, tutorFirstName }: { booking: Booking; tutorFirstName: string }) {
  const submitReview = useApp((s) => s.submitReview);
  const [rating, setRating] = React.useState(0);
  const [body, setBody] = React.useState("");
  const [errors, setErrors] = React.useState<{ rating?: string; body?: string }>({});
  const [busy, setBusy] = React.useState(false);
  const checkBody = (v: string) => (v.trim().length < 20 ? `Write at least 20 characters (${v.trim().length}/20).` : undefined);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = { rating: rating ? undefined : "Choose a star rating.", body: checkBody(body) };
    setErrors(next);
    if (next.rating || next.body) return;
    setBusy(true);
    const res = submitReview(b.id, rating as Review["rating"], body);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("Thanks for your review", { description: `It's now on ${tutorFirstName}'s profile.` });
  };

  return (
    <div id="review" tabIndex={-1} className="scroll-mt-24 rounded-xl outline-none">
    <Card>
      <CardHeader title={`How was your lesson with ${tutorFirstName}?`} description="Reviews can only be left for completed lessons, so every review on TutorLink comes from a real booking." />
      <CardContent className="pt-4">
        <form onSubmit={submit} noValidate className="space-y-4">
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">
              Your rating<span className="ml-0.5 text-danger" aria-hidden>*</span>
            </legend>
            <StarInput value={rating} onChange={(v) => { setRating(v); setErrors((x) => ({ ...x, rating: undefined })); }} />
            {errors.rating && <p role="alert" className="mt-1.5 text-[13px] text-danger">{errors.rating}</p>}
          </fieldset>
          <Field label="Your review" required error={errors.body} hint="Shown publicly with your first name and last initial. Contact details are removed automatically.">
            <Textarea value={body} onChange={(e) => { setBody(e.target.value); if (errors.body) setErrors((x) => ({ ...x, body: checkBody(e.target.value) })); }} onBlur={() => body && setErrors((x) => ({ ...x, body: checkBody(body) }))} rows={4} maxLength={2000} showCount placeholder="What went well? What should other families know?" />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={busy}>
              <Star /> Publish review
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
    </div>
  );
}

export function ReviewDisplay({ review, isTutor, tz }: { review: Review; isTutor: boolean; tz: string }) {
  return (
    <Card>
      <CardHeader
        title={isTutor ? "Review from this lesson" : "Your review"}
        description={`${review.authorName} · ${formatDate(review.createdAt, tz)}`}
        action={review.status !== "published" ? <Badge tone="warning" size="sm">{review.status === "flagged" ? "Under moderation" : "Removed"}</Badge> : <Badge tone="success" size="sm">Published</Badge>}
      />
      <CardContent className="pt-3">
        <div className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5 stars`} role="img">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className={cn("size-4", i <= review.rating ? "fill-star text-star" : "fill-sunken text-line-strong")} aria-hidden />
          ))}
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{review.body}</p>
        {review.tutorResponse && (
          <div className="mt-3 border-l-2 border-ink/30 pl-3">
            <p className="text-[12px] font-medium text-muted">Tutor response · {formatDate(review.tutorResponse.createdAt, tz)}</p>
            <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-2">{review.tutorResponse.body}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Disputes ──────────────────────────────────────────────────────────────── */

export const DISPUTE_REASONS: { value: Dispute["reason"]; label: string }[] = [
  { value: "missed_session", label: "Missed session" },
  { value: "tutor_no_show", label: "Tutor didn't show up" },
  { value: "student_no_show", label: "Student didn't show up" },
  { value: "service_issue", label: "Problem with the lesson itself" },
  { value: "payment_issue", label: "Payment issue" },
  { value: "refund_issue", label: "Refund issue" },
  { value: "other", label: "Something else" },
];
const REASON_LABEL = Object.fromEntries(DISPUTE_REASONS.map((r) => [r.value, r.label])) as Record<Dispute["reason"], string>;

const DISPUTE_STATUS: Record<Dispute["status"], { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  open: { label: "Open", tone: "warning" },
  under_review: { label: "Under review", tone: "accent" },
  awaiting_information: { label: "Awaiting information", tone: "warning" },
  escalated: { label: "Escalated", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
  rejected: { label: "Closed", tone: "neutral" },
};

const OUTCOME_LABEL: Record<NonNullable<Dispute["resolution"]>["outcome"], string> = {
  full_refund: "Full refund",
  partial_refund: "Partial refund",
  credit: "Platform credit",
  no_refund: "No refund",
};

export function useLessonDispute(bookingId: string): Dispute | undefined {
  const disputes = useApp((s) => s.disputes);
  return React.useMemo(() => disputes.filter((d) => d.bookingId === bookingId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0], [disputes, bookingId]);
}

export function DisputeCard({ dispute: d, myId, tz }: { dispute: Dispute; myId: string; tz: string }) {
  const meta = DISPUTE_STATUS[d.status];
  const closed = d.status === "resolved" || d.status === "rejected";
  const events: { at: string; title: string; body?: string }[] = [
    { at: d.createdAt, title: d.openedBy === myId ? "You reported a problem" : "The other party reported a problem", body: REASON_LABEL[d.reason] },
    ...d.adminNotes.map((n) => ({ at: n.at, title: "TutorLink support updated the case" })),
    ...(!closed && d.status !== "open" ? [{ at: d.updatedAt, title: `Status: ${meta.label}` }] : []),
    ...(closed ? [{ at: d.updatedAt, title: d.resolution ? `Decision: ${OUTCOME_LABEL[d.resolution.outcome]}${d.resolution.amountCents ? ` · ${formatCents(d.resolution.amountCents, { exact: true })}` : ""}` : "Case closed", body: d.resolution?.note }] : []),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Gavel className="size-4 text-muted" aria-hidden /> Reported problem</span>}
        description={closed ? "This case is closed." : "Our Trust & Safety team reviews every case and will contact both of you."}
        action={<Badge tone={meta.tone} size="sm" dot>{meta.label}</Badge>}
      />
      <CardContent className="space-y-4 pt-4">
        <div className="rounded-lg border border-line bg-canvas p-3.5">
          <p className="text-[13px] font-medium text-ink">{REASON_LABEL[d.reason]}</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{d.details}</p>
          {d.evidence.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Evidence">
              {d.evidence.map((f) => (
                <li key={f.name} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-1 text-[12px] text-ink-2">
                  <FileText className="size-3.5 text-muted" aria-hidden /> {f.name} <span className="text-muted">{f.sizeKb} KB</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {d.resolution && (
          <div className={cn("rounded-lg border p-3.5", d.resolution.outcome === "no_refund" ? "border-line" : "border-success-200 bg-success-50/60")}>
            <p className="text-[13px] font-medium text-ink">
              {OUTCOME_LABEL[d.resolution.outcome]}
              {d.resolution.amountCents > 0 && <span className="tabular-nums"> · {formatCents(d.resolution.amountCents, { exact: true })}</span>}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{d.resolution.note}</p>
          </div>
        )}
        <ol className="relative space-y-3 pl-5 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-line" aria-label="Case timeline">
          {events.map((e, i) => (
            <li key={`${e.at}-${i}`} className="relative">
              <span className={cn("absolute -left-5 top-1.5 size-[11px] rounded-full border-2 border-surface", i === events.length - 1 ? "bg-ink" : "bg-line-strong")} aria-hidden />
              <p className="text-[13px] font-medium text-ink">{e.title}</p>
              <p className="text-[12px] text-muted">{formatDateTime(e.at, tz)}</p>
              {e.body && <p className="mt-0.5 text-[12.5px] text-ink-2">{e.body}</p>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

export function ReportProblemCard({ onReport, policy }: { onReport: () => void; policy: BookingPolicy }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-canvas text-muted">
            <ShieldCheck className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">Something not right with this lesson?</p>
            <p className="text-[13px] text-muted">Report it within {policy.disputeWindowDays} days and our team will review what happened.</p>
          </div>
        </div>
        <Button variant="secondary" onClick={onReport} className="shrink-0">
          <Flag /> Report a problem
        </Button>
      </CardContent>
    </Card>
  );
}

const MAX_FILES = 5;
const MAX_KB = 10_240;

export function DisputeDialog({ booking, open, onOpenChange, isTutor }: { booking: Booking; open: boolean; onOpenChange: (o: boolean) => void; isTutor: boolean }) {
  const openDispute = useApp((s) => s.openDispute);
  const [reason, setReason] = React.useState<Dispute["reason"] | "">("");
  const [details, setDetails] = React.useState("");
  const [files, setFiles] = React.useState<Dispute["evidence"]>([]);
  const [errors, setErrors] = React.useState<{ reason?: string; details?: string; files?: string; form?: string }>({});
  const fileRef = React.useRef<HTMLInputElement>(null);
  const checkDetails = (v: string) => (v.trim().length < 30 ? `Describe what happened in at least 30 characters (${v.trim().length}/30).` : undefined);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setReason("");
      setDetails("");
      setFiles([]);
      setErrors({});
    }
  };

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list).map((f) => ({ name: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)) }));
    const tooBig = picked.filter((f) => f.sizeKb > MAX_KB);
    const ok = picked.filter((f) => f.sizeKb <= MAX_KB && !files.some((x) => x.name === f.name));
    const next = [...files, ...ok].slice(0, MAX_FILES);
    setFiles(next);
    setErrors((x) => ({ ...x, files: tooBig.length ? `${tooBig.map((f) => f.name).join(", ")} ${tooBig.length > 1 ? "are" : "is"} over 10 MB.` : files.length + ok.length > MAX_FILES ? `You can attach up to ${MAX_FILES} files.` : undefined }));
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = { reason: reason ? undefined : "Choose what went wrong.", details: checkDetails(details) };
    setErrors(next);
    if (next.reason || next.details || !reason) return;
    const res = openDispute(booking.id, reason, details, files);
    if (!res.ok) return setErrors({ form: res.error });
    toast.success("Problem reported", { description: "Our Trust & Safety team will review it and contact you." });
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title="Report a problem" description={`Tell us what happened. ${isTutor ? "The family" : "Your tutor"} is notified and our team reviews the booking history, messages and anything you attach.`}>
        <form onSubmit={submit} noValidate>
          <DialogBody className="space-y-4">
            <Field label="What went wrong?" required error={errors.reason}>
              <Select value={reason} onChange={(e) => { setReason(e.target.value as Dispute["reason"]); setErrors((x) => ({ ...x, reason: undefined })); }} placeholder="Choose a reason" options={DISPUTE_REASONS} />
            </Field>
            <Field label="Details" required error={errors.details} hint="Include times, what was agreed, and what you'd like to happen.">
              <Textarea value={details} onChange={(e) => { setDetails(e.target.value); if (errors.details) setErrors((x) => ({ ...x, details: checkDetails(e.target.value) })); }} onBlur={() => details && setErrors((x) => ({ ...x, details: checkDetails(details) }))} rows={5} maxLength={2000} showCount />
            </Field>
            <div>
              <p className="text-sm font-medium text-ink">
                Evidence <span className="font-normal text-muted">(optional)</span>
              </p>
              <p className="text-[12.5px] text-muted">Screenshots or documents, up to {MAX_FILES} files, 10 MB each.</p>
              <input ref={fileRef} type="file" multiple className="sr-only" tabIndex={-1} aria-hidden accept=".pdf,.png,.jpg,.jpeg,.heic,.txt,.doc,.docx" onChange={(e) => onFiles(e.target.files)} />
              <AnimatePresence initial={false}>
                {files.length > 0 && (
                  <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease: EASE }} className="mt-2 flex flex-wrap gap-1.5 overflow-hidden">
                    {files.map((f) => (
                      <li key={f.name} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas py-1 pl-2 pr-1 text-[12.5px] text-ink-2">
                        <FileText className="size-3.5 text-muted" aria-hidden />
                        <span className="max-w-44 truncate">{f.name}</span>
                        <span className="text-muted">{f.sizeKb} KB</span>
                        <button type="button" onClick={() => setFiles((x) => x.filter((y) => y.name !== f.name))} className="grid size-6 place-items-center rounded hover:bg-sunken" aria-label={`Remove ${f.name}`}>
                          <X className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
              <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => fileRef.current?.click()} disabled={files.length >= MAX_FILES}>
                <Paperclip /> Add files
              </Button>
              {errors.files && <p role="alert" className="mt-1.5 text-[13px] text-danger">{errors.files}</p>}
            </div>
            {errors.form && <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-[13px] text-danger">{errors.form}</p>}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
            <Button type="submit"><Flag /> Submit report</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
