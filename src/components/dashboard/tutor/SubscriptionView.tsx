"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, Coins, Info, Percent, Receipt, Sparkles } from "lucide-react";
import type { Payment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useViewerTimezone } from "@/lib/store/hooks";
import { TUTOR_PLANS, type Plan } from "@/lib/data/platform";
import { formatCents, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/Shell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { EASE } from "@/components/motion";
import { NeedsTutorProfile } from "./shared";
import { useMyPlan, useMyTutor } from "./hooks";

const PAYMENT_TONE: Record<Payment["status"], "success" | "warning" | "danger" | "neutral"> = {
  succeeded: "success",
  pending: "warning",
  failed: "danger",
  refunded: "neutral",
  partially_refunded: "neutral",
};
const PAYMENT_LABEL: Record<Payment["status"], string> = { succeeded: "Paid", pending: "Pending", failed: "Failed", refunded: "Refunded", partially_refunded: "Partially refunded" };

const RANK: Record<Plan["id"], number> = { free: 0, pro: 1, premium: 2 };

export function SubscriptionView() {
  const { me, tutor } = useMyTutor();
  const tz = useViewerTimezone();
  const { plan: current, status, renewsAt } = useMyPlan(tutor?.id);
  const payments = useApp((s) => s.payments);
  const changePlan = useApp((s) => s.changePlan);
  const [target, setTarget] = React.useState<Plan | null>(null);

  const history = React.useMemo(() => (me ? payments.filter((p) => p.userId === me.id && p.kind === "subscription").sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []), [payments, me]);

  if (!me || !tutor) return <NeedsTutorProfile what="subscriptions" />;

  const columns: Column<Payment>[] = [
    { key: "date", header: "Date", cell: (p) => <span className="tabular-nums">{formatDate(p.createdAt, tz)}</span>, sortValue: (p) => p.createdAt },
    { key: "desc", header: "Description", cell: (p) => <span className="font-medium text-ink">{p.description}</span> },
    { key: "method", header: "Payment method", cell: (p) => p.method, hideOnMobile: true },
    { key: "amount", header: "Amount", align: "right", cell: (p) => <span className="font-medium text-ink">{formatCents(p.amountCents)}</span>, sortValue: (p) => p.amountCents },
    {
      key: "status",
      header: "Status",
      cell: (p) => (
        <Badge tone={PAYMENT_TONE[p.status]} size="sm">
          {PAYMENT_LABEL[p.status]}
        </Badge>
      ),
    },
  ];

  const confirm = () => {
    if (!target) return;
    const res = changePlan(target.id);
    if (!res.ok) toast.error(res.error);
    else
      toast.success(`You're on ${target.name}`, {
        description: target.priceCents > 0 ? `${formatCents(target.priceCents)} charged · ${target.monthlyLeadCredits} credits added` : "No charge. Your existing credits stay in your balance.",
      });
    setTarget(null);
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Subscription" description="Choose the plan that fits how much you teach. Plans never change your match score in search." />

      {/* Current plan */}
      <Card className="overflow-hidden">
        <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-medium text-muted">Current plan</p>
              <Badge tone={status === "active" ? "success" : status === "past_due" ? "warning" : "neutral"} size="sm" dot>
                {status === "active" ? "Active" : status === "past_due" ? "Past due" : "Canceled"}
              </Badge>
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-ink">{current.name}</h2>
            <p className="mt-1 text-sm text-muted">
              {current.priceCents > 0 ? `${formatCents(current.priceCents)} per month` : "Free"}
              {renewsAt && current.priceCents > 0 ? ` · renews ${formatDate(renewsAt, tz)}` : ""}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:min-w-80">
            <div className="rounded-lg border border-line bg-canvas px-4 py-3">
              <dt className="flex items-center gap-1.5 text-[12.5px] text-muted">
                <Percent className="size-3.5" aria-hidden /> Plan commission
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">{current.commissionBps / 100}%</dd>
            </div>
            <div className="rounded-lg border border-line bg-canvas px-4 py-3">
              <dt className="flex items-center gap-1.5 text-[12.5px] text-muted">
                <Coins className="size-3.5" aria-hidden /> Credits / month
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">{current.monthlyLeadCredits}</dd>
            </div>
          </dl>
        </div>
      </Card>

      {/* Plans */}
      <section aria-labelledby="plans-h">
        <h2 id="plans-h" className="mb-3 text-[15px] font-semibold tracking-tight text-ink">
          Plans
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {TUTOR_PLANS.map((p, i) => {
            const isCurrent = p.id === current.id;
            const upgrade = RANK[p.id] > RANK[current.id];
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: i * 0.06 }}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-surface p-5 sm:p-6",
                  isCurrent ? "border-ink ring-1 ring-ink" : "border-line",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-ink">{p.name}</h3>
                  {isCurrent ? (
                    <Badge tone="solid" size="sm">
                      Current plan
                    </Badge>
                  ) : p.highlighted ? (
                    <Badge tone="accent" size="sm">
                      <Sparkles /> Most popular
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-[13.5px] leading-snug text-muted">{p.description}</p>
                <p className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-[-0.03em] tabular-nums text-ink">{p.priceCents ? formatCents(p.priceCents) : "$0"}</span>
                  <span className="text-sm text-muted">/ month</span>
                </p>
                <p className="mt-1 text-[12.5px] text-muted">
                  {p.commissionBps / 100}% commission · {p.monthlyLeadCredits} credits / month
                </p>
                <ul className="mt-5 flex-1 space-y-2.5 border-t border-line pt-5">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2.5 text-[13.5px] text-ink-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden /> {f}
                    </li>
                  ))}
                </ul>
                <Button className="mt-6 w-full" variant={isCurrent ? "secondary" : upgrade ? "primary" : "secondary"} disabled={isCurrent} onClick={() => setTarget(p)}>
                  {isCurrent ? "Your current plan" : upgrade ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                </Button>
              </motion.div>
            );
          })}
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[12.5px] text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Paid plans are charged monthly from the day you switch. Credits you already have never expire when you change plans.
        </p>
      </section>

      {/* Billing history */}
      <section aria-labelledby="billing-h" className="space-y-3">
        <div>
          <h2 id="billing-h" className="text-[15px] font-semibold tracking-tight text-ink">
            Billing history
          </h2>
          <p className="text-[13px] text-muted">Subscription charges on your account.</p>
        </div>
        <DataTable rows={history} columns={columns} rowKey={(p) => p.id} pageSize={8} mobileTitle="desc" empty={<EmptyState compact icon={<Receipt />} title="No subscription charges" description="You're on the free Starter plan. Charges appear here if you upgrade." />} />
      </section>

      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target ? (RANK[target.id] > RANK[current.id] ? `Upgrade to ${target.name}?` : `Switch to ${target.name}?`) : ""}
        description={target ? (target.priceCents > 0 ? `${formatCents(target.priceCents)} is charged today and each month after.` : "Starter is free. Your paid plan stops renewing.") : undefined}
        confirmLabel={target ? (target.priceCents > 0 ? `Pay ${formatCents(target.priceCents)} and switch` : "Switch to Starter") : "Confirm"}
        onConfirm={confirm}
      >
        {target && (
          <ul className="space-y-2 text-sm text-ink-2">
            <li className="flex gap-2">
              <Coins className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
              {target.priceCents > 0 ? `${target.monthlyLeadCredits} lead credits are added to your balance now.` : `Starter includes ${target.monthlyLeadCredits} job application credits per month.`}
            </li>
            <li className="flex gap-2">
              <Percent className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
              Plan commission: {target.commissionBps / 100}% (currently {current.commissionBps / 100}%).
            </li>
          </ul>
        )}
      </ConfirmDialog>
    </div>
  );
}
