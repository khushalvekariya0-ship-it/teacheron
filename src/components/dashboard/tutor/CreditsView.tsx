"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Briefcase, Coins, History, Repeat, Send, Tag } from "lucide-react";
import type { LeadTransaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useCreditBalance, useFlag, useViewerTimezone } from "@/lib/store/hooks";
import { CREDITS_PER_APPLICATION, CREDIT_PACKS } from "@/lib/data/platform";
import { formatCents, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/Shell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { EASE } from "@/components/motion";
import { AnimatedNumber, NeedsTutorProfile } from "./shared";
import { useMyPlan, useMyTutor } from "./hooks";

type Pack = (typeof CREDIT_PACKS)[number];
interface TxRow extends LeadTransaction {
  balance: number;
}

export function CreditsView() {
  const { tutor } = useMyTutor();
  const tz = useViewerTimezone();
  const enabled = useFlag("lead_credits");
  const balance = useCreditBalance(tutor?.id);
  const { plan } = useMyPlan(tutor?.id);
  const all = useApp((s) => s.leadTransactions);
  const buyCredits = useApp((s) => s.buyCredits);
  const [pack, setPack] = React.useState<Pack | null>(null);

  const rows: TxRow[] = React.useMemo(() => {
    if (!tutor) return [];
    const mine = all.filter((t) => t.tutorId === tutor.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let running = 0;
    return mine.map((t) => ({ ...t, balance: (running += t.delta) })).reverse();
  }, [all, tutor]);

  if (!tutor) return <NeedsTutorProfile what="lead credits" />;

  const basePer = Math.round(CREDIT_PACKS[0].priceCents / CREDIT_PACKS[0].credits);
  const spent = rows.filter((r) => r.delta < 0).reduce((n, r) => n - r.delta, 0);

  const columns: Column<TxRow>[] = [
    { key: "date", header: "Date", cell: (r) => <span className="tabular-nums">{formatDate(r.createdAt, tz)}</span>, sortValue: (r) => r.createdAt },
    { key: "reason", header: "Description", cell: (r) => <span className="text-ink">{r.reason}</span> },
    {
      key: "delta",
      header: "Change",
      align: "right",
      cell: (r) => <span className={cn("font-medium", r.delta > 0 ? "text-success" : "text-ink")}>{r.delta > 0 ? `+${r.delta}` : `−${Math.abs(r.delta)}`}</span>,
      sortValue: (r) => r.delta,
    },
    { key: "balance", header: "Balance", align: "right", cell: (r) => <span className="text-ink-2">{r.balance}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Lead credits" description={`Credits let you apply to student jobs. Each application uses ${CREDITS_PER_APPLICATION} credit.`} />

      {!enabled && (
        <InlineAlert tone="info" title="Lead credits are turned off">
          Applying to jobs doesn&apos;t use credits right now, so you can&apos;t buy packs. Your balance is kept for when credits return.
        </InlineAlert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className={cn("overflow-hidden", !enabled && "opacity-80")}>
          <CardContent className="flex h-full flex-col p-6">
            <p className="flex items-center gap-2 text-[13px] font-medium text-muted">
              <Coins className="size-4" aria-hidden /> Available balance
            </p>
            <p className="mt-3 text-5xl font-semibold tracking-[-0.03em] text-ink" aria-live="polite">
              <AnimatedNumber value={balance} />
              <span className="ml-2 text-base font-medium tracking-normal text-muted">{balance === 1 ? "credit" : "credits"}</span>
            </p>
            <p className="mt-2 text-sm text-muted">
              Enough for <span className="font-medium tabular-nums text-ink">{Math.floor(Math.max(0, balance) / CREDITS_PER_APPLICATION)}</span> applications · {spent} used so far
            </p>
            <div className="mt-auto flex flex-wrap gap-2 pt-6">
              <Button asChild>
                <Link href="/dashboard/jobs">
                  <Briefcase /> Find jobs
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/dashboard/subscription">Compare plans</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="How credits work" />
          <CardContent className="pt-4">
            <ol className="space-y-4">
              {[
                { icon: Send, title: `${CREDITS_PER_APPLICATION} credit per application`, body: "Credits are used only when you send an application. Messaging families who contact you is always free." },
                { icon: Repeat, title: `${plan.monthlyLeadCredits} credits each month on ${plan.name}`, body: plan.priceCents ? "Monthly credits are added when your plan renews. Unused credits roll over." : "Upgrade to Professional or Premium for more monthly credits." },
                { icon: Tag, title: "Top up any time", body: "Buy a pack below when you need more. Larger packs cost less per credit." },
              ].map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-[13px] font-bold text-ink">{i + 1}</span>
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                      <s.icon className="size-3.5 text-muted" aria-hidden /> {s.title}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-snug text-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="packs-h">
        <h2 id="packs-h" className="mb-3 text-[15px] font-semibold tracking-tight text-ink">
          Buy credits
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {CREDIT_PACKS.map((p, i) => {
            const per = Math.round(p.priceCents / p.credits);
            const save = Math.round((1 - per / basePer) * 100);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: i * 0.06 }}
                className="flex flex-col rounded-xl border border-line bg-surface p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-2xl font-semibold tracking-tight tabular-nums text-ink">
                    {p.credits} <span className="text-sm font-medium tracking-normal text-muted">credits</span>
                  </p>
                  {save > 0 && (
                    <Badge tone="success" size="sm">
                      Save {save}%
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">
                  <span className="font-medium tabular-nums text-ink">{formatCents(p.priceCents)}</span> · {formatCents(per)} per credit
                </p>
                <Button className="mt-5" variant={i === 1 ? "primary" : "secondary"} disabled={!enabled} onClick={() => setPack(p)}>
                  Buy {p.credits} credits
                </Button>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="hist-h" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="hist-h" className="text-[15px] font-semibold tracking-tight text-ink">
              Credit history
            </h2>
            <p className="text-[13px] text-muted">Purchases, monthly plan credits and applications.</p>
          </div>
          <Link href="/dashboard/applications" className="hidden items-center gap-1 text-[13px] font-medium text-ink hover:underline sm:inline-flex">
            My applications <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} pageSize={10} mobileTitle="reason" empty={<EmptyState compact icon={<History />} title="No credit activity yet" description="Purchases and applications will show here." />} />
      </section>

      <ConfirmDialog
        open={!!pack}
        onOpenChange={(o) => !o && setPack(null)}
        title={pack ? `Buy ${pack.credits} credits?` : ""}
        description={pack ? `${formatCents(pack.priceCents)} is charged to your card on file. Credits are added to your balance right away.` : undefined}
        confirmLabel={pack ? `Pay ${formatCents(pack.priceCents)}` : "Confirm"}
        onConfirm={() => {
          if (!pack) return;
          const res = buyCredits(pack.id);
          if (!res.ok) toast.error(res.error);
          else toast.success(`${pack.credits} credits added`, { description: `New balance: ${balance + pack.credits} credits` });
          setPack(null);
        }}
      />
    </div>
  );
}
