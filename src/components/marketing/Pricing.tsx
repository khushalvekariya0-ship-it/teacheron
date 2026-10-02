import Link from "next/link";
import type * as React from "react";
import { ArrowRight, Check, Coins, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Stagger, StaggerItem } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { CREDIT_PACKS, CREDITS_PER_APPLICATION, TUTOR_PLANS } from "@/lib/data/platform";
import { applyBps, formatCents } from "@/lib/format";

export const TUTOR_SIGNUP_HREF = "/register?role=tutor";

export function PlanCards({ exampleCents = 5000 }: { exampleCents?: number }) {
  return (
    <Stagger className="grid items-stretch gap-4 lg:grid-cols-3" stagger={0.1}>
      {TUTOR_PLANS.map((p) => {
        const keepPct = 100 - p.commissionBps / 100;
        const keep = exampleCents - applyBps(exampleCents, p.commissionBps);
        return (
          <StaggerItem key={p.id} className="h-full">
            <div className={cn("relative h-full rounded-2xl p-px", p.highlighted ? "bg-brand-gradient shadow-[0_24px_60px_-30px_rgb(75_102_245/0.6)]" : "bg-line")}>
              <div className="flex h-full flex-col rounded-[15px] bg-surface p-6 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-heading text-[22px] font-bold tracking-[-0.02em] text-ink">{p.name}</h3>
                  {p.highlighted && <span className="rounded-md bg-brand-gradient px-2 py-0.5 text-[11.5px] font-semibold text-white">Recommended</span>}
                </div>
                <p className="mt-1.5 min-h-[46px] text-[14px] leading-relaxed text-ink-2">{p.description}</p>

                <p className="mt-6 flex items-baseline gap-1">
                  <span className="font-heading text-[44px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular-nums">{formatCents(p.priceCents)}</span>
                  <span className="text-[14px] text-muted">/ month</span>
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
                    <span className="font-semibold tabular-nums text-ink">{formatCents(keep, { exact: true })}</span> of a {formatCents(exampleCents)} lesson ·{" "}
                    <span className="font-semibold tabular-nums text-ink">{p.monthlyLeadCredits}</span> job credits a month
                  </p>
                </div>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[14px] text-ink-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.6} aria-hidden /> {f}
                    </li>
                  ))}
                </ul>
                <Button asChild size="lg" variant={p.highlighted ? "brand" : "secondary"} className="mt-8 w-full">
                  <Link href={TUTOR_SIGNUP_HREF} aria-label={`Start with the ${p.name} plan`}>
                    {p.priceCents === 0 ? "Start for free" : `Choose ${p.name}`} <ArrowRight />
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

/** Every plan side by side. Rows come from the plan data; ✓ / — rows from each plan's feature list. */
export function PlanComparison({ exampleCents = 5000 }: { exampleCents?: number }) {
  const has = (planIndex: number, text: string) => TUTOR_PLANS.slice(0, planIndex + 1).some((p) => p.features.some((f) => f.toLowerCase().includes(text)));
  const rows: { label: string; values: React.ReactNode[] }[] = [
    { label: "Monthly price", values: TUTOR_PLANS.map((p) => formatCents(p.priceCents)) },
    { label: "Commission per paid lesson", values: TUTOR_PLANS.map((p) => `${p.commissionBps / 100}%`) },
    { label: `You keep on a ${formatCents(exampleCents)} lesson`, values: TUTOR_PLANS.map((p) => formatCents(exampleCents - applyBps(exampleCents, p.commissionBps), { exact: true })) },
    { label: "Job application credits a month", values: TUTOR_PLANS.map((p) => String(p.monthlyLeadCredits)) },
    ...[
      { label: "Public profile, messages and bookings", key: "public tutor profile" },
      { label: "Calendar and availability", key: "calendar" },
      { label: "Instant job alerts", key: "instant job alerts" },
      { label: "Priority support", key: "priority support" },
      { label: "Eligible for featured placement", key: "featured placement" },
      { label: "Advanced earnings reports", key: "advanced earnings" },
    ].map((r) => ({ label: r.label, values: TUTOR_PLANS.map((_, i) => (has(i, r.key) ? <Check key={i} className="mx-auto size-4 text-success" strokeWidth={2.8} aria-label="Included" /> : <Minus key={i} className="mx-auto size-4 text-subtle" aria-label="Not included" />)) })),
    { label: "Search ranking and match score", values: TUTOR_PLANS.map(() => "Same for all") },
  ];
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[560px] text-left text-[14px]">
        <caption className="sr-only">Compare tutor plans</caption>
        <thead>
          <tr className="border-b border-line bg-canvas">
            <th scope="col" className="px-5 py-3.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted sm:px-6">Compare plans</th>
            {TUTOR_PLANS.map((p) => (
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
                <td key={i} className={cn("px-4 py-3 text-center font-semibold tabular-nums text-ink", TUTOR_PLANS[i].highlighted && "bg-brand-50/60")}>
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

export function CreditPacks() {
  const base = CREDIT_PACKS[0];
  const basePer = base.priceCents / base.credits;
  const best = CREDIT_PACKS[CREDIT_PACKS.length - 1].id;
  return (
    <div className="grid gap-6 rounded-2xl border border-line bg-surface p-6 sm:p-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:items-center">
      <div>
        <h3 className="flex items-center gap-2.5 font-heading text-[22px] font-bold tracking-[-0.02em] text-ink">
          <span className="grid size-10 place-items-center rounded-lg bg-brand-gradient text-white">
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
      <ul className="grid gap-3 sm:grid-cols-3">
        {CREDIT_PACKS.map((pack) => {
          const per = Math.round(pack.priceCents / pack.credits);
          const saving = Math.round((1 - pack.priceCents / pack.credits / basePer) * 100);
          const isBest = pack.id === best;
          return (
            <li key={pack.id} className={cn("relative rounded-xl border p-4 text-center", isBest ? "border-brand/40 bg-brand-50" : "border-line")}>
              {saving > 0 && <span className={cn("absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold", isBest ? "bg-brand-gradient text-white" : "bg-surface text-brand ring-1 ring-brand/30")}>Save {saving}%</span>}
              <p className="text-[13px] font-medium text-muted">{pack.credits} credits</p>
              <p className="mt-1 font-heading text-[28px] font-bold tracking-[-0.03em] tabular-nums text-ink">{formatCents(pack.priceCents)}</p>
              <p className="mt-0.5 text-[12.5px] tabular-nums text-muted">{formatCents(per, { exact: true })} per credit</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
