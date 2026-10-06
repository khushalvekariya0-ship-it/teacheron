"use client";

import * as React from "react";
import { CalendarX2, Flag, Repeat, UserX, UserRoundX, XCircle, CheckCircle2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "@/components/motion";
import { DEFAULT_POLICY, type BookingPolicy } from "@/lib/data/platform";
import { formatCents, percentOf } from "@/lib/format";

const WHEN = [
  { hours: 48, label: "2 days before" },
  { hours: 20, label: "20 hours before" },
  { hours: 8, label: "8 hours before" },
  { hours: 2, label: "2 hours before" },
];

/**
 * "What if I cancel?" — the same rule as cancellationRefund(): a full refund inside the free window
 * (24h regular, 4h trial), otherwise the late-cancellation percentage; rescheduling until the cut-off.
 */
export function RefundCalculator({ exampleCents, policy = DEFAULT_POLICY }: { exampleCents: number; policy?: BookingPolicy }) {
  const [type, setType] = React.useState<"regular" | "trial">("regular");
  const [when, setWhen] = React.useState(1);
  const hours = WHEN[when].hours;
  const freeWindow = type === "trial" ? policy.trialFreeCancellationHours : policy.freeCancellationHours;
  const full = hours >= freeWindow;
  const pct = full ? 100 : policy.lateCancellationRefundPercent;
  const back = full ? exampleCents : percentOf(exampleCents, policy.lateCancellationRefundPercent);
  const canReschedule = hours >= policy.rescheduleMinHours;

  const situations: { icon: LucideIcon; who: string; outcome: string; good: boolean; body: string }[] = [
    { icon: CalendarX2, who: "Your tutor cancels", outcome: "Full refund", good: true, body: "Whenever a tutor or TutorLink cancels, you get everything back." },
    { icon: UserX, who: "Your tutor doesn't show", outcome: "Full refund", good: true, body: `Report it ${policy.noShowGraceMinutes} minutes after the start time.` },
    {
      icon: UserRoundX,
      who: "You don't show",
      outcome: policy.studentNoShowRefundPercent === 0 ? "No refund" : `${policy.studentNoShowRefundPercent}% refund`,
      good: false,
      body: "Cancel or reschedule ahead of time instead — it's always better for you.",
    },
    { icon: Flag, who: "Something goes wrong", outcome: "We review it", good: true, body: `Open a dispute from the lesson page within ${policy.disputeWindowDays} days; our team looks at both sides.` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid overflow-hidden rounded-2xl border border-line bg-surface lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Choices */}
        <div className="border-b border-line p-6 sm:p-7 lg:border-b-0 lg:border-r">
          <p className="font-heading text-[19px] font-bold tracking-[-0.015em] text-ink">What if I cancel?</p>
          <p className="mt-1 text-[14px] text-muted">Example: a {formatCents(exampleCents)} lesson. Pick the details.</p>

          <fieldset className="mt-6">
            <legend className="mb-2 text-[13.5px] font-semibold text-ink">Lesson type</legend>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1">
              {(["regular", "trial"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={type === t}
                  onClick={() => setType(t)}
                  className={cn("relative rounded-lg px-3 py-2 text-[14px] font-semibold transition-colors", type === t ? "text-ink" : "text-muted hover:text-ink")}
                >
                  {type === t && <motion.span layoutId="rc-type" className="absolute inset-0 rounded-lg bg-surface shadow-sm ring-1 ring-line" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
                  <span className="relative">{t === "regular" ? "Regular lesson" : "Paid trial"}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="mb-2 text-[13.5px] font-semibold text-ink">When you cancel</legend>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {WHEN.map((w, i) => (
                <button
                  key={w.hours}
                  type="button"
                  aria-pressed={when === i}
                  onClick={() => setWhen(i)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-[13.5px] font-medium transition-colors",
                    when === i ? "border-transparent bg-brand-gradient text-on-brand shadow-sm" : "border-line text-ink-2 hover:border-brand/40 hover:text-ink",
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="mt-5 text-[13px] leading-relaxed text-muted">
            Free cancellation up to {policy.freeCancellationHours} hours before a regular lesson and {policy.trialFreeCancellationHours} hours before a trial. A free trial has nothing to refund.
          </p>
        </div>

        {/* Outcome */}
        <div className="flex flex-col justify-center p-6 sm:p-7" aria-live="polite">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-muted">You get back</p>
          <motion.p key={`${type}-${when}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mt-1 font-heading text-[52px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular-nums">
            {formatCents(back, { exact: true })}
          </motion.p>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
            <motion.div className={cn("h-full rounded-full", full ? "bg-brand-gradient" : "bg-warning")} initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
          </div>
          <p className="mt-2 text-[14px] font-semibold text-ink">
            {pct}% refund <span className="font-normal text-muted">— {full ? `${hours}h is inside the free window` : `under ${freeWindow} hours, so it's a late cancellation`}</span>
          </p>
          <p className={cn("mt-5 flex items-start gap-2.5 rounded-xl p-3.5 text-[14px] leading-snug", canReschedule ? "bg-brand-50 text-ink" : "bg-canvas text-ink-2")}>
            <Repeat className={cn("mt-0.5 size-4 shrink-0", canReschedule ? "text-brand" : "text-muted")} aria-hidden />
            {canReschedule
              ? `Or reschedule instead and keep the full lesson — allowed up to ${policy.rescheduleMinHours} hours before, ${policy.maxReschedulesPerBooking} times.`
              : `Too late to reschedule — that's possible up to ${policy.rescheduleMinHours} hours before the lesson.`}
          </p>
        </div>
      </div>

      {/* Other situations */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {situations.map((s) => (
          <div key={s.who} className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5">
            <span className="grid size-10 place-items-center rounded-lg border border-line text-brand">
              <s.icon className="size-5" aria-hidden />
            </span>
            <p className="mt-4 text-[15.5px] font-semibold text-ink">{s.who}</p>
            <p className={cn("mt-1 flex items-center gap-1.5 text-[14px] font-semibold", s.good ? "text-success" : "text-danger")}>
              {s.good ? <CheckCircle2 className="size-4" aria-hidden /> : <XCircle className="size-4" aria-hidden />}
              {s.outcome}
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
