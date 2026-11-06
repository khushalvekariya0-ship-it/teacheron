"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/components/motion";
import { Badge } from "@/components/ui/Badge";
import { planPrice, platformCurrency, TUTOR_PLANS, type PlatformCurrency } from "@/lib/data/platform";
import { applyBps } from "@/lib/format";
import { formatMoney, fromDollarSetting, type Currency } from "@/lib/money";
import { useViewerCurrency } from "@/lib/store/hooks";

const WEEKS = 4;

/** The rate slider in whole units: $30–$200 in $5 steps, scaled with TutorLink's local amounts elsewhere (₹ ×50). */
function rateScale(currency: PlatformCurrency) {
  const local = (dollars: number) => fromDollarSetting(dollars * 100, currency) / 100;
  return { min: local(30), max: local(200), step: local(5) };
}
function startRate(currency: PlatformCurrency, cents: number): number {
  const { min, max, step } = rateScale(currency);
  return Math.min(max, Math.max(min, Math.round(cents / 100 / step) * step));
}

function Range({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
  ends = [String(min), String(max)],
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
  /** Labels under the two ends of the slider. */
  ends?: [string, string];
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
        <output htmlFor={id} className="text-sm font-bold tabular-nums text-ink">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={display}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-10 w-full cursor-pointer accent-ink"
      />
      <div className="flex justify-between text-[12px] tabular-nums text-muted" aria-hidden>
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </div>
    </div>
  );
}

/**
 * Estimates take-home per plan over four weeks: lesson revenue, minus plan commission (integer-cent
 * math via applyBps, per lesson), minus the monthly plan price. Taxes are not included.
 *
 * The plan price is taken off the lesson money, so both must be in one currency: the estimate is in
 * rupees for visitors who charge in ₹ and in US dollars for everyone else (the currencies plans are
 * billed in). `defaultRateCents` (in `currency`, US dollars by default) is the starting rate.
 */
export function EarningsCalculator({ defaultRateCents, currency: given = "USD" }: { defaultRateCents: number; currency?: Currency }) {
  const viewer = useViewerCurrency();
  const currency = platformCurrency(viewer);
  const startCents = currency === given ? defaultRateCents : fromDollarSetting(5000, currency);
  const [rate, setRate] = React.useState(() => startRate(currency, startCents));
  // The visitor's currency is known only after the page loads: start again in it.
  const [shownIn, setShownIn] = React.useState(currency);
  if (shownIn !== currency) {
    setShownIn(currency);
    setRate(startRate(currency, startCents));
  }
  const [lessons, setLessons] = React.useState(8);
  const scale = rateScale(currency);
  const money = (cents: number) => formatMoney(cents, currency);
  const fee = (planId: string) => planPrice(planId, currency).amount;
  const rateCents = rate * 100;
  const count = lessons * WEEKS;
  const gross = rateCents * count;

  const rows = TUTOR_PLANS.map((p) => {
    const commission = applyBps(rateCents, p.commissionBps) * count;
    return { plan: p, commission, net: gross - commission - fee(p.id) };
  });
  const best = rows.reduce((a, b) => (b.net > a.net ? b : a));
  const maxNet = Math.max(...rows.map((r) => r.net), 1);

  // Where each paid plan starts to pay for itself versus the plan below it (monthly lesson revenue).
  const breakEvens = TUTOR_PLANS.slice(1).map((p, i) => {
    const prev = TUTOR_PLANS[i];
    const cents = Math.ceil(((fee(p.id) - fee(prev.id)) * 10_000) / (prev.commissionBps - p.commissionBps));
    return { from: prev.name, to: p.name, cents };
  });

  return (
    <div className="grid overflow-hidden rounded-2xl border border-line bg-surface lg:grid-cols-[1fr_1.2fr]">
      <div className="border-b border-line bg-canvas p-6 sm:p-8 lg:border-b-0 lg:border-r">
        <p className="flex items-center gap-2 font-heading text-xl font-bold tracking-[-0.03em] text-ink">
          <Calculator className="size-5 text-ink" /> Earnings estimate
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-2">Adjust your rate and weekly lessons to compare plans over four weeks of 60-minute lessons.</p>
        {viewer !== currency && <p className="mt-2 text-[12.5px] leading-relaxed text-muted">Shown in US dollars: tutors outside India pay for plans in US dollars.</p>}
        <div className="mt-8 space-y-7">
          <Range id="calc-rate" label="Hourly rate" value={rate} min={scale.min} max={scale.max} step={scale.step} onChange={setRate} display={`${money(rateCents)}/hr`} ends={[money(scale.min * 100), money(scale.max * 100)]} />
          <Range id="calc-lessons" label="Lessons per week" value={lessons} min={1} max={30} step={1} onChange={setLessons} display={`${lessons} ${lessons === 1 ? "lesson" : "lessons"}`} />
        </div>
        <dl className="mt-8 flex items-baseline justify-between border-t border-line pt-4 text-sm">
          <dt className="text-muted">Lesson revenue · {WEEKS} weeks</dt>
          <dd className="font-bold tabular-nums text-ink">{money(gross)}</dd>
        </dl>
      </div>
      <div className="p-6 sm:p-8">
        <ul className="space-y-5" aria-live="polite">
          {rows.map((r) => {
            const isBest = r.plan.id === best.plan.id;
            return (
              <li key={r.plan.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    {r.plan.name}
                    {isBest && <Badge tone="accent" size="sm">Best for these numbers</Badge>}
                  </p>
                  <p className={cn("font-heading text-xl font-bold tabular-nums tracking-[-0.03em]", isBest ? "text-ink" : "text-ink-2")}>{money(r.net)}</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken" aria-hidden>
                  <motion.div
                    className={cn("h-full rounded-full", isBest ? "bg-brand-gradient" : "bg-ink/25")}
                    initial={false}
                    animate={{ width: `${Math.max(0, (r.net / maxNet) * 100)}%` }}
                    transition={{ duration: 0.5, ease: EASE }}
                  />
                </div>
                <p className="mt-1.5 text-[12.5px] tabular-nums text-muted">
                  {r.plan.commissionBps / 100}% commission ({money(r.commission)}) · plan {money(fee(r.plan.id))}
                </p>
              </li>
            );
          })}
        </ul>
        <div className="mt-7 space-y-1.5 border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">
          {breakEvens.map((b) => (
            <p key={b.to}>
              {b.to} costs less than {b.from} once your lesson revenue passes <span className="font-semibold tabular-nums text-ink">{money(b.cents)}</span> a month.
            </p>
          ))}
          <p>Estimates before taxes. Lead credits and trial lessons aren&rsquo;t included.</p>
        </div>
      </div>
    </div>
  );
}
