"use client";

import * as React from "react";
import { CalendarClock, Info, Repeat } from "lucide-react";
import type { Booking, BookingStatus, Tutor } from "@/lib/types";
import type { Actor } from "@/lib/booking";
import { cancellationRefund, policySummary } from "@/lib/booking";
import { useApp } from "@/lib/store";
import { useViewerTimezone } from "@/lib/store/hooks";
import { formatCents, formatDateTime, percentOf } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DialogClose } from "@/components/ui/Overlay";
import { toast } from "@/components/ui/Toast";
import { SlotPicker } from "@/components/domain/SlotPicker";
import { tzShort } from "./shared";

const NOTE_MAX = 500;

/* ─── Decline a request (tutor) ─────────────────────────────────────────────── */

export function DeclineDialog({ booking, open, onOpenChange, counterpart }: { booking: Booking; open: boolean; onOpenChange: (o: boolean) => void; counterpart: string }) {
  const transition = useApp((s) => s.transitionBooking);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const paid = booking.priceCents - booking.discountCents;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setNote("");
      }}
      title="Decline this request?"
      description={`${counterpart} will be notified${paid > 0 ? ` and the ${formatCents(paid)} card authorization released` : ""}. This can't be undone.`}
      confirmLabel="Decline request"
      tone="danger"
      loading={busy}
      onConfirm={() => {
        setBusy(true);
        const res = transition(booking.id, "cancelled_by_tutor", note.trim() || undefined);
        setBusy(false);
        if (!res.ok) return void toast.error(res.error);
        toast.success("Request declined", { description: `${counterpart} has been notified.` });
        onOpenChange(false);
        setNote("");
      }}
    >
      <Field label="Message to the family" optional hint="Suggest another time or explain why — it's added to the booking history.">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} showCount rows={3} placeholder="e.g. I'm not available then — could we try Thursday at 5 PM?" />
      </Field>
    </ConfirmDialog>
  );
}

/* ─── Cancel ────────────────────────────────────────────────────────────────── */

export function CancelDialog({ booking, actor, open, onOpenChange, counterpart, now }: { booking: Booking; actor: Actor; open: boolean; onOpenChange: (o: boolean) => void; counterpart: string; now: number }) {
  const transition = useApp((s) => s.transitionBooking);
  const policy = useApp((s) => s.policy);
  const [note, setNote] = React.useState("");
  const by = actor === "booker" ? "booker" : actor === "tutor" ? "tutor" : "admin";
  const { refundCents, rule } = cancellationRefund(booking, by, now, policy);
  const paid = booking.priceCents - booking.discountCents;
  const to: BookingStatus = actor === "tutor" ? "cancelled_by_tutor" : "cancelled_by_student";
  const learnerView = actor === "booker";

  // Refunds only apply to captured payments; a pending request only holds an authorization.
  const captured = booking.paymentStatus === "paid";
  let amount = formatCents(0);
  let refundLine: React.ReactNode;
  if (paid <= 0) refundLine = "Nothing was charged for this lesson.";
  else if (booking.paymentStatus === "authorized")
    refundLine = learnerView ? `Your card hold of ${formatCents(paid)} will be released — you won't be charged.` : `The family's ${formatCents(paid)} card hold is released — they won't be charged.`;
  else if (captured) {
    amount = formatCents(refundCents);
    refundLine = learnerView
      ? refundCents > 0 ? `${formatCents(refundCents)} of ${formatCents(paid)} goes back to your original payment method.` : "This cancellation isn't eligible for a refund."
      : `The family is refunded ${formatCents(refundCents)}.`;
  } else refundLine = "No payment was captured for this lesson, so there's nothing to refund.";

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setNote("");
      }}
      title="Cancel this lesson?"
      description={`${counterpart} will be notified right away.`}
      confirmLabel="Cancel lesson"
      tone="danger"
      onConfirm={() => {
        const res = transition(booking.id, to, note.trim() || undefined);
        if (!res.ok) return void toast.error(res.error);
        toast.success("Lesson cancelled", { description: captured ? rule : booking.paymentStatus === "authorized" ? "The card hold was released." : undefined });
        onOpenChange(false);
        setNote("");
      }}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-line bg-canvas p-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-medium text-ink">{learnerView ? "Your refund" : "Refund to the family"}</p>
            <p className="text-lg font-semibold tabular-nums text-ink">{captured ? amount : "No charge"}</p>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-muted">{refundLine}</p>
          {captured && (
            <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-ink-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden /> {rule}
            </p>
          )}
        </div>
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Cancellation policy</p>
          <ul className="mt-1.5 space-y-1 text-[13px] text-ink-2">
            {policySummary(booking.type, policy).map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-subtle" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <Field label="Reason" optional hint={`Shared with ${counterpart} in the booking history.`}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} showCount rows={2} />
        </Field>
      </div>
    </ConfirmDialog>
  );
}

/* ─── Reschedule ────────────────────────────────────────────────────────────── */

export function RescheduleDialog({
  booking,
  actor,
  tutor,
  open,
  onOpenChange,
  onDone,
}: {
  booking: Booking;
  actor: Actor;
  tutor: Tutor;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: (next: Booking) => void;
}) {
  const reschedule = useApp((s) => s.rescheduleBooking);
  const policy = useApp((s) => s.policy);
  const tz = useViewerTimezone();
  const [slot, setSlot] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const used = booking.rescheduleCount ?? 0;
  const left = Math.max(0, policy.maxReschedulesPerBooking - used);
  const autoConfirm = actor === "tutor" || booking.status === "confirmed";

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setSlot(null);
      setError(null);
    }
  };

  const submit = () => {
    if (!slot) return setError("Choose a new time first.");
    const res = reschedule(booking.id, slot);
    if (!res.ok) return setError(res.error);
    toast.success(res.data.status === "confirmed" ? "Lesson rescheduled" : "New time requested", {
      description: formatDateTime(res.data.startUtc, tz),
    });
    close(false);
    onDone(res.data);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="lg" title="Reschedule lesson" description={`Choose a new time from ${tutor.firstName}'s availability. The lesson length stays ${booking.durationMin} minutes.`}>
        <DialogBody className="space-y-5">
          <dl className="grid gap-3 rounded-lg border border-line bg-canvas p-3.5 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-muted">Current time</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {formatDateTime(booking.startUtc, tz)} <span className="font-normal text-muted">{tzShort(tz, booking.startUtc)}</span>
              </dd>
            </div>
            <div>
              <dt className="text-muted">Reschedules left</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-ink">
                <Repeat className="size-3.5 text-muted" aria-hidden />
                {left} of {policy.maxReschedulesPerBooking}
                <span className="font-normal text-muted">· up to {policy.rescheduleMinHours}h before</span>
              </dd>
            </div>
          </dl>
          <SlotPicker tutor={tutor} durationMin={booking.durationMin} value={slot} onChange={(v) => { setSlot(v); setError(null); }} excludeBookingId={booking.id} />
          <p className="flex items-start gap-2 text-[13px] text-muted">
            <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
            {autoConfirm
              ? "The new time is confirmed right away and the other person is notified."
              : `${tutor.firstName} will need to accept the new time. Your current request is replaced.`}
          </p>
          {error && (
            <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-[13px] text-danger">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Keep current time</Button>
          </DialogClose>
          <Button onClick={submit} disabled={!slot}>
            Confirm new time
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Other transitions (start, complete, no-show, retry payment) ──────────── */

export type ConfirmableTransition = Extract<BookingStatus, "in_progress" | "completed" | "no_show_student" | "no_show_tutor" | "pending">;

export function TransitionDialog({
  booking,
  to,
  onOpenChange,
  names,
}: {
  booking: Booking;
  to: ConfirmableTransition | null;
  onOpenChange: (o: boolean) => void;
  names: { tutor: string; learner: string };
}) {
  const transition = useApp((s) => s.transitionBooking);
  const policy = useApp((s) => s.policy);
  const [note, setNote] = React.useState("");
  const paid = booking.priceCents - booking.discountCents;
  const captured = booking.paymentStatus === "paid";
  const tutorNoShowRefund = captured ? percentOf(paid, policy.tutorNoShowRefundPercent) : 0;
  const studentNoShowRefund = captured ? percentOf(paid, policy.studentNoShowRefundPercent) : 0;
  const credit = policy.tutorNoShowCreditCents > 0 ? ` You'll also get ${formatCents(policy.tutorNoShowCreditCents)} in platform credit.` : "";

  const copy: Record<ConfirmableTransition, { title: string; description: string; confirm: string; success: string; danger?: boolean; note?: boolean }> = {
    in_progress: { title: "Start this lesson?", description: `The lesson will show as in progress for you and ${names.learner}.`, confirm: "Start lesson", success: "Lesson started" },
    completed: {
      title: "Mark this lesson as completed?",
      description: `${booking.childId ? "The family" : names.learner} will be asked to leave a review. You can add a progress note afterwards.`,
      confirm: "Mark completed",
      success: "Lesson completed",
    },
    no_show_student: {
      title: "Report a student no-show?",
      description: `Use this only if ${names.learner} didn't join within ${policy.noShowGraceMinutes} minutes of the start time. Student no-shows are refunded at ${policy.studentNoShowRefundPercent}%${captured && studentNoShowRefund > 0 ? ` (${formatCents(studentNoShowRefund)})` : ""} under the current policy.`,
      confirm: "Report no-show",
      success: "No-show reported",
      danger: true,
      note: true,
    },
    no_show_tutor: {
      title: "Report a tutor no-show?",
      description: `Use this only if ${names.tutor} didn't join within ${policy.noShowGraceMinutes} minutes of the start time. ${captured && tutorNoShowRefund > 0 ? `You'll be refunded ${formatCents(tutorNoShowRefund)} (${policy.tutorNoShowRefundPercent}%).` : "You weren't charged for this lesson."}${credit}`,
      confirm: "Report no-show",
      success: "No-show reported",
      danger: true,
      note: true,
    },
    pending: {
      title: "Retry payment?",
      description: `We'll place a new ${paid > 0 ? `${formatCents(paid)} ` : ""}authorization on your card and send the request to ${names.tutor} again. You're only charged once it's confirmed.`,
      confirm: "Retry payment",
      success: "Request resubmitted",
    },
  };
  const c = to ? copy[to] : null;

  return (
    <ConfirmDialog
      open={!!to}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setNote("");
      }}
      title={c?.title ?? ""}
      description={c?.description}
      confirmLabel={c?.confirm}
      tone={c?.danger ? "danger" : "default"}
      onConfirm={() => {
        if (!to || !c) return;
        const res = transition(booking.id, to, note.trim() || undefined);
        if (!res.ok) return void toast.error(res.error);
        toast.success(c.success);
        onOpenChange(false);
        setNote("");
      }}
    >
      {c?.note ? (
        <Field label="What happened?" optional hint="Added to the booking history and visible to our support team.">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} showCount rows={3} />
        </Field>
      ) : undefined}
    </ConfirmDialog>
  );
}
