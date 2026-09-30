import Link from "next/link";
import { ArrowRight, Check, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { Stagger, StaggerItem } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CREDIT_PACKS, CREDITS_PER_APPLICATION, TUTOR_PLANS } from "@/lib/data/platform";
import { formatCents } from "@/lib/format";

export const TUTOR_SIGNUP_HREF = "/register?role=tutor";

export function PlanCards() {
  return (
    <Stagger className="grid gap-4 lg:grid-cols-3" stagger={0.1}>
      {TUTOR_PLANS.map((p) => (
        <StaggerItem key={p.id} className="h-full">
          <div
            className={cn(
              "relative flex h-full flex-col rounded-2xl border bg-surface p-6 sm:p-7",
              p.highlighted ? "border-ink ring-1 ring-ink" : "border-line",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-2xl font-extrabold tracking-[-0.035em] text-ink">{p.name}</h3>
              {p.highlighted && <Badge tone="solid" size="sm">Recommended</Badge>}
            </div>
            <p className="mt-1.5 min-h-10 text-sm leading-relaxed text-ink-2">{p.description}</p>
            <p className="mt-6 flex items-baseline gap-1">
              <span className="font-heading text-5xl font-extrabold tracking-[-0.04em] text-ink tabular-nums">{formatCents(p.priceCents)}</span>
              <span className="text-sm text-muted">/ month</span>
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-canvas p-3.5">
              <div>
                <dt className="text-[12px] text-muted">Commission</dt>
                <dd className="mt-0.5 text-[16px] font-bold tabular-nums text-ink">{p.commissionBps / 100}%</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Job credits / month</dt>
                <dd className="mt-0.5 text-[16px] font-bold tabular-nums text-ink">{p.monthlyLeadCredits}</dd>
              </div>
            </dl>
            <ul className="mt-6 flex-1 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-ink-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-ink" strokeWidth={2.6} aria-hidden /> {f}
                </li>
              ))}
            </ul>
            <Button asChild size="lg" variant={p.highlighted ? "primary" : "secondary"} className="mt-8 w-full">
              <Link href={TUTOR_SIGNUP_HREF} aria-label={`Start with the ${p.name} plan`}>
                {p.priceCents === 0 ? "Start for free" : `Choose ${p.name}`} <ArrowRight />
              </Link>
            </Button>
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

export function CreditPacks() {
  const base = CREDIT_PACKS[0];
  const basePer = base.priceCents / base.credits;
  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="flex flex-col gap-2 border-b border-line p-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-heading text-xl font-extrabold tracking-[-0.03em] text-ink">
            <Coins className="size-5 text-ink" /> Credit packs
          </h3>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-2">
            Applying to a student job uses {CREDITS_PER_APPLICATION} credit. If you run out of your monthly credits, top up with a pack. Being contacted directly by a family never uses credits.
          </p>
        </div>
      </div>
      <ul className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {CREDIT_PACKS.map((pack) => {
          const per = Math.round(pack.priceCents / pack.credits);
          const saving = Math.round((1 - pack.priceCents / pack.credits / basePer) * 100);
          return (
            <li key={pack.id} className="p-6">
              <p className="text-sm text-muted">{pack.credits} credits</p>
              <p className="mt-1 font-heading text-3xl font-extrabold tracking-[-0.04em] tabular-nums text-ink">{formatCents(pack.priceCents)}</p>
              <p className="mt-1 text-[13px] tabular-nums text-muted">
                {formatCents(per, { exact: true })} per credit
                {saving > 0 && <span className="ml-1.5 font-semibold text-ink">· {saving}% less than the {base.credits}-pack</span>}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
