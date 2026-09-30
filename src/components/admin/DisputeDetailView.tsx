"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, Gavel, Lock, MessageSquare, Paperclip, ScrollText, SearchX, StickyNote } from "lucide-react";
import type { AuditLog, Booking, Dispute, DisputeStatus } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useNow, useViewerTimezone } from "@/lib/store/hooks";
import { STATUS_META } from "@/lib/booking";
import { subjectName } from "@/lib/data/catalog";
import { formatCents, formatDateTime, formatDuration, pluralize, tzAbbrev } from "@/lib/format";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/domain/Badges";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RadioCards } from "@/components/ui/Controls";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { ConversationAccess, Facts, Mono, PermissionButton, PermissionNotice, StatusPill, TextLink, Timeline, formatAge, humanize, useDirectory, useStaff } from "./kit";
import { PaymentRows, bookingHistoryItems } from "./BookingsView";
import { DISPUTE_REASON_LABEL, DISPUTE_STATUS_META, RESOLUTION_LABEL, bookingPaid, isDisputeOpen, parseDollars, refundedCents } from "./money";

type Outcome = NonNullable<Dispute["resolution"]>["outcome"];

const WORKING_STATUSES: DisputeStatus[] = ["open", "under_review", "awaiting_information", "escalated"];

function fileSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

export function DisputeDetailView({ id }: { id: string }) {
  return (
    <PermissionGate permission="disputes.manage">
      <DisputeInner id={id} />
    </PermissionGate>
  );
}

function DisputeInner({ id }: { id: string }) {
  const disputes = useApp((s) => s.disputes);
  const bookings = useApp((s) => s.bookings);
  const payments = useApp((s) => s.payments);
  const conversations = useApp((s) => s.conversations);
  const auditLogs = useApp((s) => s.auditLogs);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const now = useNow(60_000);
  const { can } = useStaff();
  const [resolveOpen, setResolveOpen] = React.useState(false);

  const d = disputes.find((x) => x.id === id);
  const b = d ? bookings.find((x) => x.id === d.bookingId) : undefined;

  const related = React.useMemo(() => {
    if (!d) return null;
    const rows = payments.filter((p) => p.bookingId === d.bookingId).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
    const between = b ? conversations.filter((c) => c.userId === b.bookerId && c.tutorId === b.tutorId) : [];
    const conversation = between.find((c) => (b?.childId ? c.childId === b.childId : !c.childId)) ?? between[0];
    const audit = auditLogs
      .filter((a) => a.targetId === d.id || (conversation && a.action === "conversation.access" && a.targetId === conversation.id))
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    return { rows, conversation, audit };
  }, [d, b, payments, conversations, auditLogs]);

  if (!d || !related) {
    return (
      <>
        <PageHeader title="Dispute" back={{ href: "/admin/disputes", label: "Disputes" }} />
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={<SearchX />}
            title="Dispute not found"
            description={
              <>
                There&apos;s no dispute with the ID <span className="font-mono text-[13px] text-ink">{id}</span>. Preview data lives in this browser, so records created elsewhere won&apos;t appear here.
              </>
            }
            action={
              <Button asChild variant="secondary">
                <Link href="/admin/disputes">Back to disputes</Link>
              </Button>
            }
          />
        </div>
      </>
    );
  }

  const closed = !isDisputeOpen(d);
  const opener = dir.name(d.openedBy);
  const openerRole = b ? (d.openedBy === b.bookerId ? "booker" : "tutor") : undefined;
  const paid = b ? bookingPaid(b) : 0;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/disputes", label: "Disputes" }}
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <Mono>{d.id}</Mono>
            <StatusPill tone={DISPUTE_STATUS_META[d.status].tone}>{DISPUTE_STATUS_META[d.status].label}</StatusPill>
          </span>
        }
        title={b ? `${DISPUTE_REASON_LABEL[d.reason]} · ${subjectName(b.subject)} with ${dir.name(b.tutorId)}` : DISPUTE_REASON_LABEL[d.reason]}
        description={`Opened by ${opener}${openerRole ? ` (${openerRole})` : ""} ${formatAge(now - new Date(d.createdAt).getTime())} ago · updated ${formatAge(now - new Date(d.updatedAt).getTime())} ago`}
        actions={
          <>
            {b && (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/admin/bookings?id=${b.id}`}>
                  <BookOpen /> Open booking
                </Link>
              </Button>
            )}
            {!closed && (
              <PermissionButton permission="disputes.manage" size="sm" onClick={() => setResolveOpen(true)} disabled={!b}>
                <Gavel /> Resolve dispute
              </PermissionButton>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="What was reported" description={`${DISPUTE_REASON_LABEL[d.reason]} · ${formatDateTime(d.createdAt, tz)}`} />
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap rounded-lg border border-line bg-canvas px-4 py-3 text-[14px] leading-relaxed text-ink">{d.details}</p>
              <div>
                <h3 className="mb-2 text-[13px] font-medium text-ink">Evidence</h3>
                {d.evidence.length === 0 ? (
                  <p className="text-[13px] text-muted">No files were attached.</p>
                ) : (
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {d.evidence.map((f) => (
                      <li key={f.name} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px]">
                        <span className="flex min-w-0 items-center gap-2">
                          <Paperclip className="size-3.5 shrink-0 text-muted" aria-hidden />
                          <span className="truncate text-ink">{f.name}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-muted">{fileSize(f.sizeKb)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-muted">
                  <Lock className="size-3 shrink-0" aria-hidden /> Files open from secure storage in production; access is logged.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Session" description="The lesson this dispute is about and everything that happened to it." />
            <CardContent className="space-y-5">
              {b ? (
                <>
                  <Facts
                    items={[
                      { label: "Booking", value: <TextLink href={`/admin/bookings?id=${b.id}`}>{b.id}</TextLink> },
                      { label: "Lesson", value: `${subjectName(b.subject)} · ${b.type === "trial" ? "Trial" : "Regular"} · ${b.mode === "online" ? "Online" : "In person"}` },
                      { label: "Scheduled", value: <span className="tabular-nums">{formatDateTime(b.startUtc, tz)} {tzAbbrev(tz, new Date(b.startUtc))} · {formatDuration(b.durationMin)}</span> },
                      { label: "Session status", value: <BookingStatusBadge status={b.status} /> },
                      { label: "Payment", value: <PaymentStatusBadge status={b.paymentStatus} /> },
                    ]}
                  />
                  <div>
                    <h3 className="mb-3 text-[13px] font-medium text-ink">Booking history</h3>
                    <Timeline items={bookingHistoryItems(b, dir, tz)} />
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-muted">
                  Booking <Mono>{d.bookingId}</Mono> isn&apos;t in this preview&apos;s data.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Payments" description="Charges and refunds recorded for this booking." />
            <CardContent>
              <PaymentRows rows={related.rows} tz={tz} empty={b?.paymentStatus === "authorized" ? "Card authorized only — no charge was captured for this booking." : "No payment records for this booking."} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Messages" description={b ? `Conversation between ${dir.name(b.bookerId)} and ${dir.name(b.tutorId)}.` : undefined} />
            <CardContent>
              {related.conversation ? (
                <ConversationAccess conversationId={related.conversation.id} context={`dispute ${d.id}`}>
                  {() => <MessageList conversationId={related.conversation!.id} />}
                </ConversationAccess>
              ) : (
                <p className="flex items-start gap-2 text-[13px] text-muted">
                  <MessageSquare className="mt-0.5 size-4 shrink-0" aria-hidden /> No conversation on record between these two people.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Staff notes" description="Internal only — never shown to the learner or tutor." />
            <CardContent className="space-y-4">
              {d.adminNotes.length === 0 ? (
                <p className="text-[13px] text-muted">No notes yet.</p>
              ) : (
                <ul className="space-y-3">
                  {d.adminNotes.map((n, i) => (
                    <li key={`${n.at}-${i}`} className="rounded-lg border border-line px-3.5 py-3">
                      <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[12px]">
                        <span className="font-medium text-ink">{dir.name(n.by)}</span>
                        <span className="tabular-nums text-muted">{formatDateTime(n.at, tz)}</span>
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-2">{n.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              {closed ? <p className="text-[13px] text-muted">This dispute is closed, so notes are read-only.</p> : <NoteForm disputeId={d.id} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Audit trail"
              description="Staff actions on this dispute and access to its conversation."
              action={
                can("audit.read") ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/audit-log?q=${encodeURIComponent(d.id)}`}>
                      <ScrollText /> Audit log
                    </Link>
                  </Button>
                ) : undefined
              }
            />
            <CardContent>
              <Timeline items={related.audit.map((a) => auditItem(a, dir.name(a.actorId), tz))} empty="No staff actions recorded yet." />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6" aria-label="Dispute summary">
          <Card>
            <CardHeader title={closed ? "Decision" : "Status"} />
            <CardContent className="space-y-4">
              {closed ? (
                <ResolutionSummary dispute={d} tz={tz} />
              ) : (
                <>
                  <StatusControl dispute={d} />
                  <div className="space-y-2.5 border-t border-line pt-4">
                    <p className="text-[13px] text-muted">Record the outcome once you have both sides. The booker is notified of the decision.</p>
                    {!can("payments.refund") && <PermissionNotice permission="payments.refund">Refund outcomes need</PermissionNotice>}
                    <PermissionButton permission="disputes.manage" className="w-full" onClick={() => setResolveOpen(true)} disabled={!b}>
                      <Gavel /> Resolve dispute
                    </PermissionButton>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {b && (
            <Card>
              <CardHeader title="Parties" />
              <CardContent>
                <Facts
                  items={[
                    {
                      label: "Booker",
                      value: (
                        <span className="inline-flex flex-col items-end gap-0.5">
                          <TextLink href={`/admin/users?id=${b.bookerId}`}>{dir.name(b.bookerId)}</TextLink>
                          {openerRole === "booker" && <span className="text-[12px] font-normal text-muted">Opened the dispute</span>}
                        </span>
                      ),
                    },
                    ...(b.childId ? [{ label: "Learner", value: dir.name(b.childId) }] : []),
                    {
                      label: "Tutor",
                      value: (
                        <span className="inline-flex flex-col items-end gap-0.5">
                          <TextLink href={`/admin/tutors?id=${b.tutorId}`}>{dir.name(b.tutorId)}</TextLink>
                          {openerRole === "tutor" && <span className="text-[12px] font-normal text-muted">Opened the dispute</span>}
                        </span>
                      ),
                    },
                  ]}
                />
              </CardContent>
            </Card>
          )}

          {b && (
            <Card>
              <CardHeader title="At stake" />
              <CardContent>
                <Facts
                  items={[
                    { label: b.paymentStatus === "authorized" ? "Authorized (not captured)" : "Booking total", value: <span className="tabular-nums">{paid ? formatCents(paid) : "Free lesson"}</span> },
                    ...(b.discountCents ? [{ label: "Coupon", value: <span className="tabular-nums">−{formatCents(b.discountCents)}</span> }] : []),
                    { label: "Refunded so far", value: <span className="tabular-nums">{formatCents(refundedCents(related.rows))}</span> },
                    { label: "Platform fee (commission)", value: <span className="tabular-nums">{formatCents(b.platformFeeCents)}</span> },
                  ]}
                />
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      {b && <ResolveDialog open={resolveOpen} onOpenChange={setResolveOpen} dispute={d} booking={b} />}
    </>
  );
}

/* ─── Pieces ─────────────────────────────────────────────────────────────────── */

function auditItem(a: AuditLog, actor: string, tz: string) {
  const meta = a.meta ?? {};
  let title: string;
  let tone: "default" | "accent" | "success" | "warning" | "danger" = "default";
  let body: string | undefined;
  switch (a.action) {
    case "dispute.note":
      title = "Note added";
      break;
    case "dispute.status": {
      const s = String(meta.status ?? "");
      title = `Status set to ${DISPUTE_STATUS_META[s as DisputeStatus]?.label.toLowerCase() ?? humanize(s)}`;
      tone = s === "escalated" ? "danger" : "accent";
      break;
    }
    case "dispute.resolve": {
      const outcome = String(meta.outcome ?? "") as Outcome;
      const amount = typeof meta.amountCents === "number" ? meta.amountCents : 0;
      title = `Decision: ${RESOLUTION_LABEL[outcome] ?? humanize(outcome)}${amount ? ` · ${formatCents(amount)}` : ""}`;
      tone = "success";
      break;
    }
    case "conversation.access":
      title = "Private conversation opened";
      tone = "warning";
      body = meta.reason ? `Reason: “${String(meta.reason)}”` : undefined;
      break;
    default:
      title = humanize(a.action);
  }
  return { key: a.id, title, tone, body, meta: `${actor} · ${formatDateTime(a.createdAt, tz)}` };
}

function MessageList({ conversationId }: { conversationId: string }) {
  const messages = useApp((s) => s.messages);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const list = React.useMemo(() => messages.filter((m) => m.conversationId === conversationId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [messages, conversationId]);
  if (!list.length) return <p className="text-[13px] text-muted">This conversation has no messages.</p>;
  return (
    <ul className="max-h-[28rem] space-y-2.5 overflow-y-auto pr-1" aria-label={`${pluralize(list.length, "message")}`}>
      {list.map((m) => (
        <li key={m.id} className="rounded-lg border border-line px-3.5 py-2.5">
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[12px]">
            <span className="font-medium text-ink">{dir.name(m.senderId)}</span>
            <span className="tabular-nums text-muted">{formatDateTime(m.createdAt, tz)}</span>
          </p>
          <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-2">{m.body}</p>
          {m.attachment && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted">
              <Paperclip className="size-3" aria-hidden /> {m.attachment.name} · {fileSize(m.attachment.sizeKb)}
            </p>
          )}
          {m.moderation && (
            <Badge tone="warning" size="sm" className="mt-1.5">
              {m.moderation === "contact_info_masked" ? "Contact details masked" : "Flagged by moderation"}
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

function StatusControl({ dispute: d }: { dispute: Dispute }) {
  const setStatus = useApp((s) => s.setDisputeStatus);
  const [value, setValue] = React.useState<DisputeStatus>(d.status);
  const [prev, setPrev] = React.useState(d.status);
  if (prev !== d.status) {
    setPrev(d.status);
    setValue(d.status);
  }
  return (
    <form
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (value === d.status) return;
        const res = setStatus(d.id, value);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(`Status set to ${DISPUTE_STATUS_META[value].label.toLowerCase()}`, { description: "Recorded in the audit log." });
      }}
    >
      <Field label="Queue status" hint="Resolving is a separate step.">
        <Select value={value} onChange={(e) => setValue(e.target.value as DisputeStatus)} options={WORKING_STATUSES.map((s) => ({ value: s, label: DISPUTE_STATUS_META[s].label }))} />
      </Field>
      <Button type="submit" variant="secondary" size="sm" className="w-full" disabled={value === d.status}>
        Update status
      </Button>
    </form>
  );
}

function NoteForm({ disputeId }: { disputeId: string }) {
  const addNote = useApp((s) => s.addDisputeNote);
  const [body, setBody] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const error = touched && body.trim().length < 3 ? "Write at least 3 characters." : undefined;
  return (
    <form
      noValidate
      className="space-y-2.5 border-t border-line pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (body.trim().length < 3) return;
        const res = addNote(disputeId, body);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setBody("");
        setTouched(false);
        toast.success("Note added");
      }}
    >
      <Field label="Add a note" error={error} hint="Visible to staff only. Adding a note is recorded in the audit log.">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} onBlur={() => body && setTouched(true)} rows={3} maxLength={1000} showCount placeholder="e.g. Asked the tutor for their session log" />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="secondary">
          <StickyNote /> Add note
        </Button>
      </div>
    </form>
  );
}

function ResolutionSummary({ dispute: d, tz }: { dispute: Dispute; tz: string }) {
  const r = d.resolution;
  return (
    <div className="space-y-3">
      {r ? (
        <>
          <Facts
            items={[
              { label: "Outcome", value: RESOLUTION_LABEL[r.outcome] },
              ...(r.outcome !== "no_refund" ? [{ label: r.outcome === "credit" ? "Credit" : "Refund", value: <span className="tabular-nums">{formatCents(r.amountCents)}</span> }] : []),
              { label: "Closed", value: <span className="tabular-nums">{formatDateTime(d.updatedAt, tz)}</span> },
            ]}
          />
          <p className="whitespace-pre-wrap rounded-lg border border-line bg-canvas px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-2">{r.note}</p>
        </>
      ) : (
        <p className="text-[13px] text-muted">Closed as {DISPUTE_STATUS_META[d.status].label.toLowerCase()} with no recorded decision.</p>
      )}
      <p className="text-[12.5px] text-muted">Closed disputes are read-only.</p>
    </div>
  );
}

/* ─── Resolve dialog ─────────────────────────────────────────────────────────── */

function ResolveDialog({ open, onOpenChange, dispute: d, booking: b }: { open: boolean; onOpenChange: (o: boolean) => void; dispute: Dispute; booking: Booking }) {
  const resolve = useApp((s) => s.resolveDispute);
  const policy = useApp((s) => s.policy);
  const { can } = useStaff();
  const paid = bookingPaid(b);
  const canRefund = can("payments.refund");
  const refundable = canRefund && paid > 0;

  const [outcome, setOutcome] = React.useState<Outcome | undefined>(undefined);
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [touched, setTouched] = React.useState({ outcome: false, amount: false, note: false });
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setOutcome(undefined);
      setAmount("");
      setNote("");
      setTouched({ outcome: false, amount: false, note: false });
    }
  }

  const needsAmount = outcome === "partial_refund" || outcome === "credit";
  const parsed = parseDollars(amount);
  const amountError = (() => {
    if (!needsAmount) return undefined;
    if (!parsed.ok) return parsed.error;
    if (parsed.cents <= 0) return "Enter an amount greater than $0.";
    if (outcome === "partial_refund" && parsed.cents > paid) return `A refund can't exceed the ${formatCents(paid)} that was paid.`;
    if (outcome === "partial_refund" && parsed.cents === paid) return "That's the full amount — choose Full refund instead.";
    return undefined;
  })();
  const outcomeError = !outcome ? "Choose an outcome." : (outcome === "full_refund" || outcome === "partial_refund") && !refundable ? "Refunds aren't available for this dispute." : undefined;
  const noteError = note.trim().length < 10 ? "Explain the decision in at least 10 characters." : undefined;

  const cents = outcome === "full_refund" ? paid : needsAmount && parsed.ok ? parsed.cents : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ outcome: true, amount: true, note: true });
    if (outcomeError || amountError || noteError || !outcome) return;
    const res = resolve(d.id, outcome, cents, note.trim());
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(outcome === "no_refund" ? "Dispute rejected" : "Dispute resolved", {
      description: outcome === "full_refund" || outcome === "partial_refund" ? `${formatCents(cents)} refund recorded. The booker has been notified.` : "The booker has been notified.",
    });
    onOpenChange(false);
  };

  const bookingAfter = b.status === "disputed" ? (outcome === "full_refund" || outcome === "partial_refund" ? "refunded" : "completed") : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Resolve dispute" description={`${DISPUTE_REASON_LABEL[d.reason]} · ${subjectName(b.subject)} · ${formatCents(paid)} charged`} size="lg">
        <form onSubmit={submit} noValidate>
          <DialogBody className="space-y-5">
            {!canRefund && (
              <PermissionNotice permission="payments.refund">
                You can record platform credit or no refund, or escalate the dispute to an administrator. Full and partial refunds require
              </PermissionNotice>
            )}
            {canRefund && paid === 0 && <InlineAlert tone="info">Nothing was charged for this lesson, so there&apos;s nothing to refund.</InlineAlert>}
            {paid > 0 && b.paymentStatus === "authorized" && (
              <InlineAlert tone="info">The card for this booking was authorized but no charge was captured. Check the payment records before choosing a refund.</InlineAlert>
            )}

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">
                Outcome<span className="ml-0.5 text-danger" aria-hidden>*</span>
              </legend>
              <RadioCards<Outcome>
                name="outcome"
                value={outcome}
                onValueChange={(v) => {
                  setOutcome(v);
                  setTouched((t) => ({ ...t, outcome: true }));
                }}
                options={[
                  { value: "full_refund", label: "Full refund", description: refundable ? `Return ${formatCents(paid)} to the original payment method.` : !canRefund ? "Requires payments.refund." : "Nothing to refund.", disabled: !refundable },
                  { value: "partial_refund", label: "Partial refund", description: refundable ? "Return part of the payment to the card." : !canRefund ? "Requires payments.refund." : "Nothing to refund.", disabled: !refundable },
                  { value: "credit", label: "Platform credit", description: "Record credit for the booker instead of a card refund." },
                  { value: "no_refund", label: "No refund", description: "Reject the claim. The dispute closes as rejected." },
                ]}
              />
              {touched.outcome && outcomeError && (
                <p role="alert" className="mt-1.5 text-[13px] text-danger">
                  {outcomeError}
                </p>
              )}
            </fieldset>

            {needsAmount && (
              <Field
                label={outcome === "credit" ? "Credit amount" : "Refund amount"}
                required
                error={touched.amount ? amountError : undefined}
                hint={outcome === "credit" ? `Booking policy credit for a tutor no-show: ${formatCents(policy.tutorNoShowCreditCents)}. Credit balances aren't simulated in this preview.` : `Up to ${formatCents(paid)}.`}
              >
                <Input
                  inputMode="decimal"
                  prefixText="$"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
                  placeholder="0.00"
                  autoComplete="off"
                  className="sm:max-w-48"
                />
              </Field>
            )}

            <Field label="Decision note" required error={touched.note ? noteError : undefined} hint="Saved with the decision on this dispute.">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, note: true }))}
                rows={3}
                maxLength={1000}
                showCount
                placeholder="e.g. Session log confirms the lesson ended 25 minutes early; refunding the missed portion."
              />
            </Field>

            {outcome && !outcomeError && (
              <InlineAlert tone={outcome === "full_refund" || outcome === "partial_refund" ? "warning" : "info"} title="What happens">
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  <li>
                    The dispute closes as <strong className="font-medium text-ink">{outcome === "no_refund" ? "rejected" : "resolved"}</strong>.
                  </li>
                  <li>
                    {outcome === "full_refund" || outcome === "partial_refund"
                      ? `${cents ? formatCents(cents) : "The amount above"} is refunded to the original payment method and recorded under Payments.`
                      : outcome === "credit"
                        ? `${cents ? formatCents(cents) : "The amount above"} is recorded as platform credit. No card refund is made.`
                        : "No money is returned."}
                  </li>
                  <li>
                    {bookingAfter
                      ? `Booking ${b.id} becomes ${STATUS_META[bookingAfter].label.toLowerCase()}.`
                      : `Booking ${b.id} stays ${STATUS_META[b.status].label.toLowerCase()}.`}
                  </li>
                  <li>The booker is notified.</li>
                </ul>
              </InlineAlert>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit">Record decision</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
