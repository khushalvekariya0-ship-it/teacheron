"use client";

import * as React from "react";
import { CalendarClock, Check, Flag, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "@/components/motion";
import { policySummary } from "@/lib/booking";
import { DEFAULT_POLICY, type BookingPolicy } from "@/lib/data/platform";

const SPAN_HOURS = 48;
/** Position on the track for "h hours before the lesson" (lesson start is the right edge). */
const x = (h: number) => 100 - (Math.min(h, SPAN_HOURS) / SPAN_HOURS) * 100;

/**
 * The cancellation and reschedule windows drawn on a track, from DEFAULT_POLICY so the picture
 * always matches the rules. Toggle between regular and trial lessons.
 */
export function RefundTimeline({ policy = DEFAULT_POLICY }: { policy?: BookingPolicy }) {
  const [type, setType] = React.useState<"regular" | "trial">("regular");
  const free = type === "trial" ? policy.trialFreeCancellationHours : policy.freeCancellationHours;
  const cut = x(free);
  const resched = x(policy.rescheduleMinHours);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-col gap-4 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p className="flex items-center gap-2 font-heading text-[18px] font-bold tracking-[-0.01em] text-ink">
          <CalendarClock className="size-5 text-brand" aria-hidden /> Cancel or reschedule
        </p>
        <div role="radiogroup" aria-label="Lesson type" className="grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1">
          {(["regular", "trial"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={cn("relative rounded-lg px-4 py-1.5 text-[14px] font-semibold transition-colors", type === t ? "text-ink" : "text-muted hover:text-ink")}
            >
              {type === t && <motion.span layoutId="policy-type" className="absolute inset-0 rounded-lg bg-surface shadow-sm ring-1 ring-line" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
              <span className="relative">{t === "regular" ? "Regular lesson" : "Trial lesson"}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-6 pt-8 sm:px-7">
        {/* Track */}
        <div className="relative pt-10" aria-hidden>
          {/* Reschedule cut-off marker */}
          <motion.div className="absolute top-0 -translate-x-1/2 text-center" initial={false} animate={{ left: `${resched}%` }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-brand-soft px-2 py-1 text-[11.5px] font-semibold text-brand">
              <Repeat className="size-3" /> Reschedule until here
            </span>
            <span className="mx-auto mt-1 block h-3 w-0 border-l-2 border-dashed border-brand" />
          </motion.div>

          <div className="relative flex h-12 overflow-hidden rounded-xl">
            <motion.div className="flex items-center justify-center bg-success-50 px-2 text-[12.5px] font-semibold text-success" initial={false} animate={{ width: `${cut}%` }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
              <span className="truncate">Full refund</span>
            </motion.div>
            <div className="flex flex-1 items-center bg-warning-50 px-3 text-[12.5px] font-semibold text-warning">
              <span className="truncate">{policy.lateCancellationRefundPercent}%</span>
            </div>
            <span className="absolute inset-y-0 right-0 w-1 bg-ink" />
            <motion.span className="absolute inset-y-0 w-0 border-l-2 border-dashed border-brand" initial={false} animate={{ left: `${resched}%` }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
          </div>

          <div className="relative mt-2 h-10 text-[12px] text-muted">
            <span className="absolute left-0 top-0">When you book</span>
            <motion.span className="absolute top-5 -translate-x-1/2 whitespace-nowrap font-semibold text-ink-2" initial={false} animate={{ left: `${cut}%` }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
              {free}h before
            </motion.span>
            <span className="absolute right-0 top-0 font-semibold text-ink">Lesson starts</span>
          </div>
        </div>

        {/* Legend + the full rule list for this lesson type */}
        <div className="grid gap-6 border-t border-line pt-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <ul className="space-y-3 text-[14px]">
            <li className="flex items-center gap-2.5 text-ink-2">
              <span className="size-3 rounded-sm bg-success-50 ring-1 ring-success/40" aria-hidden />
              <span>
                <span className="font-semibold text-ink">Full refund</span> — cancel {free} hours or more before
              </span>
            </li>
            <li className="flex items-center gap-2.5 text-ink-2">
              <span className="size-3 rounded-sm bg-warning-50 ring-1 ring-warning/40" aria-hidden />
              <span>
                <span className="font-semibold text-ink">{policy.lateCancellationRefundPercent}% refund</span> — cancel later than that
              </span>
            </li>
            <li className="flex items-center gap-2.5 text-ink-2">
              <Repeat className="size-3.5 text-brand" aria-hidden />
              <span>
                <span className="font-semibold text-ink">Reschedule</span> up to {policy.rescheduleMinHours} hours before, {policy.maxReschedulesPerBooking} times
              </span>
            </li>
            <li className="flex items-center gap-2.5 text-ink-2">
              <Flag className="size-3.5 text-brand" aria-hidden />
              <span>
                <span className="font-semibold text-ink">After the lesson</span> — report a problem within {policy.disputeWindowDays} days
              </span>
            </li>
          </ul>
          <div className="rounded-xl bg-canvas p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">{type === "regular" ? "Regular lesson" : "Trial lesson"} — in full</p>
            <ul className="mt-3 space-y-2">
              {policySummary(type, policy).map((l) => (
                <li key={l} className="flex items-start gap-2.5 text-[14px] leading-snug text-ink-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.6} aria-hidden /> {l}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
