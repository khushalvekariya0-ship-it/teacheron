import Link from "next/link";
import type * as React from "react";
import { ArrowRight, Check, Coins, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Stagger, StaggerItem } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { CREDITS_PER_APPLICATION, PLATFORM_CURRENCIES, offeredPacks, offeredPlans, packPrice, planFeatureLines, planPrice, type Plan, type PlatformCurrency, type Pricing } from "@/lib/data/platform";
import { applyBps } from "@/lib/format";
import { formatMoney, type Currency } from "@/lib/money";

export const TUTOR_SIGNUP_HREF = "/register?role=tutor";

/*
 * Tutors pay TutorLink in rupees when they charge in ₹, and in US dollars otherwise, so plan and pack
 * prices are shown in both lists ("$29 / ₹999"). They are two separate price lists, not a conversion.
 * Plans and packs come from Admin → Plans & credits (`pricing`, loaded by the page).
 */
/** "$29 / ₹999": the amount from each price list. */
const inBothLists = (amountIn: (c: PlatformCurrency) => number, opts?: { exact?: boolean }) => PLATFORM_CURRENCIES.map((c) => formatMoney(amountIn(c), c, opts)).join(" / ");
const isFreePlan = (p: Plan) => PLATFORM_CURRENCIES.every((c) => p.prices[c] === 0);
const planPrices = (p: Plan) => (isFreePlan(p) ? "Free" : inBothLists((c) => p.prices[c]));

/** Plan cards. `exampleCents` (in `exampleCurrency`, US dollars by default) is the lesson used for "You keep". */
export function PlanCards({ pricing, exampleCents = 5000, exampleCurrency = "USD" }: { pricing: Pricing; exampleCents?: number; exampleCurrency?: Currency }) {
  const plans = offeredPlans(pricing);
  return (
    <Stagger className={cn("grid items-stretch gap-4", plans.length >= 4 ? "md:grid-cols-2 xl:grid-cols-4" : "lg:grid-cols-3")} stagger={0.1}>
      {plans.map((p) => {
        const keepPct = 100 - p.commissionBps / 100;
        const keep = exampleCents - applyBps(exampleCents, p.commissionBps);
        return (
          <StaggerItem key={p.id} className="h-full">
            <div className={cn("relative h-full rounded-2xl p-px", p.highlighted ? "bg-brand-gradient shadow-[0_24px_60px_-30px_rgb(75_102_245/0.6)]" : "bg-line")}>
              <div className="flex h-full flex-col rounded-[15px] bg-surface p-6 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-heading text-[22px] font-bold tracking-[-0.02em] text-ink">{p.name}</h3>
                  {p.highlighted && <span className="rounded-md bg-brand-gradient px-2 py-0.5 text-[11.5px] font-semibold text-on-brand">Recommended</span>}
                </div>
                <p className="mt-1.5 min-h-[46px] text-[14px] leading-relaxed text-ink-2">{p.description}</p>

                <p className="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  {isFreePlan(p) ? (
                    <span className="font-heading text-[44px] font-extrabold leading-none tracking-[-0.03em] text-ink">Free</span>
                  ) : (
                    <>
                      <span className="font-heading text-[44px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular-nums">{formatMoney(planPrice(pricing, p.id, "USD").amount, "USD")}</span>
                      <span className="font-heading text-[24px] font-bold leading-none tracking-[-0.02em] text-ink-2 tabular-nums">/ {formatMoney(planPrice(pricing, p.id, "INR").amount, "INR")}</span>
                      <span className="text-[14px] text-muted">per month</span>
                    </>
                  )}
                </p>

                {/* What you keep */}
                <div className="mt-6 rounded-xl bg-canvas p-4">
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="text-ink-2">You keep</span>
                    <span className="font-semibold tabular-nums text-ink">
                      {keepPct}% <span className="font-normal text-muted">· {p.commissionBps / 100}% commission</span>
                    </span>
                  </div>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-line" aria-hidden>
                    <span className="h-full rounded-full bg-brand-gradient" style={{ width: `${keepPct}%` }} />
                  </div>
                  <p className="mt-2.5 text-[12.5px] text-muted">
                    <span className="font-semibold tabular-nums text-ink">{formatMoney(keep, exampleCurrency, { exact: true })}</span> of a {formatMoney(exampleCents, exampleCurrency)} lesson ·{" "}
                    <span className="font-semibold tabular-nums text-ink">{p.monthlyLeadCredits}</span> job credits a month
                  </p>
                </div>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {planFeatureLines(p).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[14px] text-ink-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.6} aria-hidden /> {f}
                    </li>
                  ))}
                </ul>
                <Button asChild size="lg" variant={p.highlighted ? "brand" : "secondary"} className="mt-8 w-full">
                  <Link href={TUTOR_SIGNUP_HREF} aria-label={`Start with the ${p.name} plan`}>
                    {isFreePlan(p) ? "Start for free" : `Choose ${p.name}`} <ArrowRight />
                  </Link>
                </Button>
              </div>
            </div>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}

/**
 * Every plan side by side. Number rows come from the plan data; ✓ / — rows from the plans' feature lists
 * (a plan that lists "Everything in …" also has everything the plan before it has).
 */
export function PlanComparison({ pricing, exampleCents = 5000, exampleCurrency = "USD" }: { pricing: Pricing; exampleCents?: number; exampleCurrency?: Currency }) {
  const plans = offeredPlans(pricing);
  const inheritsAll = (p: Plan) => p.features.some((f) => /^everything in /i.test(f));
  const has = (i: number, feature: string): boolean => plans[i].features.includes(feature) || (i > 0 && inheritsAll(plans[i]) && has(i - 1, feature));
  const features = [...new Set(plans.flatMap((p) => p.features.filter((f) => !/^everything in /i.test(f))))];
  const rows: { label: string; values: React.ReactNode[] }[] = [
    { label: "Monthly price", values: plans.map(planPrices) },
    { label: "Commission per paid lesson", values: plans.map((p) => `${p.commissionBps / 100}%`) },
    { label: `You keep on a ${formatMoney(exampleCents, exampleCurrency)} lesson`, values: plans.map((p) => formatMoney(exampleCents - applyBps(exampleCents, p.commissionBps), exampleCurrency, { exact: true })) },
    { label: "Job application credits a month", values: plans.map((p) => String(p.monthlyLeadCredits)) },
    ...features.map((f) => ({
      label: f,
      values: plans.map((_, i) => (has(i, f) ? <Check key={i} className="mx-auto size-4 text-success" strokeWidth={2.8} aria-label="Included" /> : <Minus key={i} className="mx-auto size-4 text-subtle" aria-label="Not included" />)),
    })),
    { label: "Search ranking and match score", values: plans.map(() => "Same for all") },
  ];
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[560px] text-left text-[14px]">
        <caption className="sr-only">Compare tutor plans</caption>
        <thead>
          <tr className="border-b border-line bg-canvas">
            <th scope="col" className="px-5 py-3.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted sm:px-6">Compare plans</th>
            {plans.map((p) => (
              <th key={p.id} scope="col" className={cn("px-4 py-3.5 text-center text-[14.5px] font-bold", p.highlighted ? "bg-brand-50 text-brand" : "text-ink")}>
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="px-5 py-3 font-medium text-ink-2 sm:px-6">{r.label}</th>
              {r.values.map((v, i) => (
                <td key={i} className={cn("px-4 py-3 text-center font-semibold tabular-nums text-ink", plans[i].highlighted && "bg-brand-50/60")}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CreditPacks({ pricing }: { pricing: Pricing }) {
  const packs = offeredPacks(pricing);
  if (!packs.length) return null;
  const base = packs[0];
  const best = packs[packs.length - 1].id;
  // Saving per credit against the smallest pack, worked out within each price list ("Save 15–20%").
  const perCredit = (packId: string, credits: number, c: PlatformCurrency) => packPrice(pricing, packId, c).amount / credits;
  const savingLabel = (packId: string, credits: number): string | null => {
    const pcts = PLATFORM_CURRENCIES.map((c) => Math.round((1 - perCredit(packId, credits, c) / perCredit(base.id, base.credits, c)) * 100));
    const [low, high] = [Math.min(...pcts), Math.max(...pcts)];
    return high <= 0 ? null : low === high ? `${low}%` : low > 0 ? `${low}–${high}%` : `up to ${high}%`;
  };
  return (
    <div className="grid gap-6 rounded-2xl border border-line bg-surface p-6 sm:p-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:items-center">
      <div>
        <h3 className="flex items-center gap-2.5 font-heading text-[22px] font-bold tracking-[-0.02em] text-ink">
          <span className="grid size-10 place-items-center rounded-lg bg-brand-gradient text-on-brand">
            <Coins className="size-5" aria-hidden />
          </span>
          Credit packs
        </h3>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">
          Applying to a student job uses {CREDITS_PER_APPLICATION} credit. Run out of your monthly credits? Top up with a pack.
        </p>
        <p className="mt-3 flex items-start gap-2 text-[13.5px] leading-snug text-muted">
          <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.6} aria-hidden /> Families contacting you directly never uses credits.
        </p>
      </div>
      <ul className={cn("grid gap-3", packs.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : "sm:grid-cols-3")}>
        {packs.map((pack) => {
          const saving = savingLabel(pack.id, pack.credits);
          const isBest = pack.id === best && packs.length > 1;
          return (
            <li key={pack.id} className={cn("relative rounded-xl border p-4 text-center", isBest ? "border-brand/40 bg-brand-50" : "border-line")}>
              {saving && <span className={cn("absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold", isBest ? "bg-brand-gradient text-on-brand" : "bg-surface text-brand ring-1 ring-brand/30")}>Save {saving}</span>}
              <p className="text-[13px] font-medium text-muted">{pack.credits} credits</p>
              <p className="mt-1 font-heading text-[28px] font-bold tracking-[-0.03em] tabular-nums text-ink">{formatMoney(packPrice(pricing, pack.id, "USD").amount, "USD")}</p>
              <p className="font-heading text-[18px] font-bold tracking-[-0.02em] tabular-nums text-ink-2">{formatMoney(packPrice(pricing, pack.id, "INR").amount, "INR")}</p>
              <p className="mt-0.5 text-[12.5px] tabular-nums text-muted">{inBothLists((c) => Math.round(perCredit(pack.id, pack.credits, c)), { exact: true })} per credit</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
