"use client";

import * as React from "react";
import { BadgeCheck, CalendarClock, Landmark, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "@/components/motion";
import { DEFAULT_POLICY, TUTOR_PLANS } from "@/lib/data/platform";
import { applyBps, formatCents } from "@/lib/format";

const MIN = 2000;
const MAX = 15000;
const STEP = 500;

/**
 * Interactive split of one paid one-hour lesson: pick a rate and a plan, see what you keep,
 * the commission, and how many lesson hours a month make a paid plan worth it. Plan data only.
 */
export function EarningsSplit({ initialRateCents, isMedian }: { initialRateCents: number; isMedian: boolean }) {
  const [rate, setRate] = React.useState(() => Math.min(MAX, Math.max(MIN, Math.round(initialRateCents / STEP) * STEP)));
  const [planId, setPlanId] = React.useState(TUTOR_PLANS.find((p) => p.highlighted)?.id ?? TUTOR_PLANS[0].id);
  const plan = TUTOR_PLANS.find((p) => p.id === planId) ?? TUTOR_PLANS[0];
  const base = TUTOR_PLANS[0];

  const commission = applyBps(rate, plan.commissionBps);
  const keep = rate - commission;
  const keepPct = 100 - plan.commissionBps / 100;
  // Hours of lessons per month after which the plan's lower commission covers its monthly fee.
  const savedPerHour = applyBps(rate, base.commissionBps - plan.commissionBps);
  const breakEven = plan.priceCents > 0 && savedPerHour > 0 ? Math.ceil(plan.priceCents / savedPerHour) : null;

  return (
    <div className="grid overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-36px_rgb(15_23_42/0.45)] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      {/* Calculator */}
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <label htmlFor="es-rate" className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-muted">
              Your hourly rate
            </label>
            <p className="mt-1 font-heading text-[44px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular-nums">
              {formatCents(rate)}
              <span className="text-[18px] font-semibold text-muted">/hr</span>
            </p>
          </div>
          {isMedian && rate === Math.round(initialRateCents / STEP) * STEP && <span className="rounded-md bg-canvas px-2 py-1 text-[12px] font-medium text-muted">Median rate listed today</span>}
        </div>
        <input
          id="es-rate"
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          aria-valuetext={`${formatCents(rate)} per hour`}
          className="mt-5 w-full accent-[#4f46e5]"
        />
        <div className="mt-1 flex justify-between text-[12px] tabular-nums text-muted">
          <span>{formatCents(MIN)}</span>
          <span>{formatCents(MAX)}</span>
        </div>

        <div className="mt-6" role="radiogroup" aria-label="Plan">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-muted">Plan</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-xl bg-canvas p-1.5">
            {TUTOR_PLANS.map((p) => {
              const on = p.id === planId;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPlanId(p.id)}
                  className={cn("relative rounded-lg px-2 py-2 text-center transition-colors", on ? "text-ink" : "text-ink-2 hover:text-ink")}
                >
                  {on && <motion.span layoutId="es-plan" className="absolute inset-0 rounded-lg bg-surface shadow-sm ring-1 ring-line" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
                  <span className="relative block text-[14px] font-semibold">{p.name}</span>
                  <span className="relative block text-[12px] tabular-nums text-muted">{p.priceCents ? `${formatCents(p.priceCents)}/mo` : "Free"}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* The split of one lesson */}
        <div className="mt-7">
          <div className="flex items-baseline justify-between text-[13px] text-ink-2">
            <span>One paid 1-hour lesson</span>
            <span className="tabular-nums">Family pays {formatCents(rate)}</span>
          </div>
          <div className="mt-2 flex h-12 overflow-hidden rounded-xl" aria-hidden>
            <motion.div
              className="flex items-center bg-brand-gradient px-3 text-[13px] font-semibold text-white"
              initial={false}
              animate={{ width: `${keepPct}%` }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              You keep {keepPct}%
            </motion.div>
            <div className="flex flex-1 items-center justify-center bg-canvas text-[12px] font-semibold tabular-nums text-muted">{plan.commissionBps / 100}%</div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line p-4">
              <dt className="text-[12.5px] text-muted">You keep</dt>
              <dd className="mt-1 font-heading text-[26px] font-bold tabular-nums text-ink" aria-live="polite">
                {formatCents(keep, { exact: true })}
              </dd>
            </div>
            <div className="rounded-xl border border-line p-4">
              <dt className="text-[12.5px] text-muted">TutorLink commission</dt>
              <dd className="mt-1 font-heading text-[26px] font-bold tabular-nums text-ink-2">{formatCents(commission, { exact: true })}</dd>
            </div>
          </dl>
          <p className="mt-4 text-[13.5px] leading-relaxed text-ink-2">
            {breakEven ? (
              <>
                At this rate, {plan.name} pays for itself after <span className="font-semibold text-ink">{breakEven} lesson hours a month</span> compared with Starter.
              </>
            ) : (
              <>Starter is free — you only pay commission on lessons you&rsquo;re paid for.</>
            )}
          </p>
        </div>
      </div>

      {/* When you get paid */}
      <div className="border-t border-line bg-canvas p-6 sm:p-8 lg:border-l lg:border-t-0">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-muted">When you get paid</p>
        <ol className="mt-6 space-y-6">
          {[
            { icon: BadgeCheck, title: "Lesson completed", body: "The family paid when they booked; you teach the lesson." },
            { icon: CalendarClock, title: `${DEFAULT_POLICY.disputeWindowDays}-day review window`, body: `Families can report a problem within ${DEFAULT_POLICY.disputeWindowDays} days of a lesson.` },
            { icon: Landmark, title: "Paid out to your bank", body: "Earnings become available and are paid out through Stripe Connect." },
          ].map((s, i, arr) => (
            <li key={s.title} className="relative flex gap-4">
              {i < arr.length - 1 && <span className="absolute left-5 top-11 h-[calc(100%-1rem)] w-px bg-line" aria-hidden />}
              <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white">
                <s.icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block text-[15.5px] font-semibold text-ink">{s.title}</span>
                <span className="mt-0.5 block text-[14px] leading-relaxed text-ink-2">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-7 rounded-xl border border-line bg-surface p-4">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            <Wallet className="size-4 text-brand" aria-hidden /> {plan.name} plan
          </p>
          <ul className="mt-2 space-y-1 text-[13.5px] text-ink-2">
            <li>{plan.priceCents ? `${formatCents(plan.priceCents)} a month` : "No monthly fee"}</li>
            <li>{plan.commissionBps / 100}% commission per paid lesson</li>
            <li>{plan.monthlyLeadCredits} job application credits a month</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
