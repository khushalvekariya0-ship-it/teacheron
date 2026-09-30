"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Coins, Receipt } from "lucide-react";
import type { LeadTransaction, Payment, Subscription } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useFlag, useNow, useTutors, useViewerTimezone } from "@/lib/store/hooks";
import { CREDIT_PACKS, CREDITS_PER_APPLICATION, TUTOR_PLANS, type Plan } from "@/lib/data/platform";
import { formatCents, formatDateTime, formatRelative, pluralize } from "@/lib/format";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { ExportButton, MiniStat, PersonCell, StatusPill, TextLink, humanize, settledNet, useDirectory } from "./kit";
import { PlatformFeeCard, bpsToPercent } from "./PlatformFeeCard";

type SubStatus = Subscription["status"];
const STATUS_LABEL: Record<SubStatus, string> = { active: "Active", past_due: "Past due", canceled: "Canceled" };
const STATUS_TONE: Record<SubStatus, "success" | "warning" | "neutral"> = { active: "success", past_due: "warning", canceled: "neutral" };

const PLAN_GRANT = /plan — monthly credits$/;
const PURCHASE = /^Purchased (\d+) credits$/;

interface TutorCredits {
  tutorId: string;
  plan: Plan;
  subStatus: SubStatus | null;
  balance: number;
  granted: number;
  purchased: number;
  spent: number;
  applications: number;
  lastAt: string;
}

export function MonetizationView() {
  return (
    <PermissionGate permission="settings.manage">
      <MonetizationInner />
    </PermissionGate>
  );
}

function MonetizationInner() {
  const subs = useApp((s) => s.subscriptions);
  const ledger = useApp((s) => s.leadTransactions);
  const payments = useApp((s) => s.payments);
  const feeBps = useApp((s) => s.platformFeeBps);
  const creditsOn = useFlag("lead_credits");
  const tutors = useTutors();
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const now = useNow(60_000);

  const planById = React.useMemo(() => Object.fromEntries(TUTOR_PLANS.map((p) => [p.id, p])) as Record<Plan["id"], Plan>, []);

  /** Subscriber counts per plan and status. Tutors without a record are on Starter. */
  const planStats = React.useMemo(() => {
    const counts = Object.fromEntries(TUTOR_PLANS.map((p) => [p.id, { active: 0, past_due: 0, canceled: 0, implicit: 0 }])) as Record<Plan["id"], Record<SubStatus | "implicit", number>>;
    const ids = new Set([...tutors.map((t) => t.id), ...Object.keys(subs)]);
    for (const id of ids) {
      const sub = subs[id];
      if (!sub) {
        counts.free.active++;
        counts.free.implicit++;
      } else counts[sub.plan][sub.status]++;
    }
    return { counts, total: ids.size };
  }, [tutors, subs]);

  const credit = React.useMemo(() => {
    let purchased = 0;
    let planGrants = 0;
    let otherGrants = 0;
    let spent = 0;
    const byTutor = new Map<string, LeadTransaction[]>();
    for (const t of ledger) {
      if (t.delta > 0) {
        if (PURCHASE.test(t.reason)) purchased += t.delta;
        else if (PLAN_GRANT.test(t.reason)) planGrants += t.delta;
        else otherGrants += t.delta;
      } else spent += -t.delta;
      byTutor.set(t.tutorId, [...(byTutor.get(t.tutorId) ?? []), t]);
    }
    const perTutor: TutorCredits[] = [...byTutor.entries()].map(([tutorId, list]) => {
      const sub = subs[tutorId];
      return {
        tutorId,
        plan: planById[sub?.plan ?? "free"],
        subStatus: sub?.status ?? null,
        balance: list.reduce((a, t) => a + t.delta, 0),
        granted: list.filter((t) => t.delta > 0 && !PURCHASE.test(t.reason)).reduce((a, t) => a + t.delta, 0),
        purchased: list.filter((t) => t.delta > 0 && PURCHASE.test(t.reason)).reduce((a, t) => a + t.delta, 0),
        spent: list.filter((t) => t.delta < 0).reduce((a, t) => a - t.delta, 0),
        applications: list.filter((t) => t.delta < 0 && t.reason.startsWith("Applied:")).length,
        lastAt: list.reduce((a, t) => (t.createdAt > a ? t.createdAt : a), list[0].createdAt),
      };
    });
    perTutor.sort((a, b) => b.balance - a.balance || b.lastAt.localeCompare(a.lastAt));
    return { purchased, planGrants, otherGrants, spent, outstanding: purchased + planGrants + otherGrants - spent, perTutor };
  }, [ledger, subs, planById]);

  const packs = React.useMemo(
    () =>
      CREDIT_PACKS.map((p) => {
        const purchases = ledger.filter((t) => t.reason === `Purchased ${p.credits} credits`).length;
        const revenue = settledNet(payments.filter((x) => x.kind === "lead_credits" && x.description === `${p.credits} lead credits`)).net;
        return { ...p, purchases, revenue, perCredit: Math.round(p.priceCents / p.credits) };
      }),
    [ledger, payments],
  );

  const revenue = React.useMemo(() => {
    const sub = payments.filter((p) => p.kind === "subscription");
    const lead = payments.filter((p) => p.kind === "lead_credits");
    const recent = [...sub, ...lead].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
    return { sub: settledNet(sub), lead: settledNet(lead), subCount: sub.length, leadCount: lead.length, recent };
  }, [payments]);

  const paidActive = planStats.counts.pro.active + planStats.counts.premium.active;

  const columns: Column<TutorCredits>[] = [
    {
      key: "tutor",
      header: "Tutor",
      sortValue: (r) => dir.name(r.tutorId),
      cell: (r) => (
        <Link href={`/admin/tutors?id=${r.tutorId}`} className="block min-w-0 hover:underline">
          <PersonCell name={dir.name(r.tutorId)} sub={dir.email(r.tutorId) ?? r.tutorId} />
        </Link>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      sortValue: (r) => r.plan.priceCents,
      cell: (r) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Badge size="sm">{r.plan.name}</Badge>
          {r.subStatus && r.subStatus !== "active" && <StatusPill tone={STATUS_TONE[r.subStatus]}>{STATUS_LABEL[r.subStatus]}</StatusPill>}
        </span>
      ),
    },
    { key: "balance", header: "Balance", align: "right", sortValue: (r) => r.balance, cell: (r) => <span className="font-semibold text-ink">{r.balance}</span> },
    { key: "granted", header: "Plan & other grants", align: "right", sortValue: (r) => r.granted, cell: (r) => `+${r.granted}`, hideOnMobile: true },
    { key: "purchased", header: "Purchased", align: "right", sortValue: (r) => r.purchased, cell: (r) => (r.purchased ? `+${r.purchased}` : "0"), hideOnMobile: true },
    { key: "spent", header: "Spent", align: "right", sortValue: (r) => r.spent, cell: (r) => (r.spent ? `−${r.spent}` : "0") },
    { key: "last", header: "Last activity", sortValue: (r) => r.lastAt, cell: (r) => <span className="whitespace-nowrap tabular-nums text-muted">{formatRelative(r.lastAt, now)}</span>, hideOnMobile: true },
  ];

  return (
    <>
      <PageHeader
        title="Plans & credits"
        description="Tutor subscription plans, lead-credit packs and the revenue they bring in, from payments and the credit ledger."
        actions={
          <ExportButton
            filename="tutorlink-credit-ledger"
            label="Export credit ledger"
            headers={["Transaction", "Tutor ID", "Tutor", "Credits", "Reason", "Created (UTC)"]}
            rows={() => [...ledger].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((t) => [t.id, t.tutorId, dir.name(t.tutorId), t.delta, t.reason, t.createdAt])}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Subscription revenue" value={formatCents(revenue.sub.net)} hint={`${pluralize(revenue.subCount, "payment")} · settled net`} />
        <MiniStat label="Credit pack revenue" value={formatCents(revenue.lead.net)} hint={`${pluralize(revenue.leadCount, "payment")} · settled net`} />
        <MiniStat label="Paid subscribers" value={paidActive} hint={`of ${pluralize(planStats.total, "tutor")}`} />
        <MiniStat label="Credits outstanding" value={credit.outstanding.toLocaleString("en-US")} hint="Unspent across all tutors" />
      </div>

      {/* Plans */}
      <section className="mt-10" aria-labelledby="plans-heading">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="plans-heading" className="text-[15px] font-semibold tracking-tight text-ink">
              Tutor plans
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">
              Counts come from subscription records. <span className="font-medium text-ink-2">Tutors with no subscription record are on the Starter plan.</span> Professional and Premium commissions are fixed by each plan; Starter uses the editable default platform fee below.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {TUTOR_PLANS.map((p) => {
            const c = planStats.counts[p.id];
            return (
              <Card key={p.id} className="flex flex-col">
                <CardHeader
                  title={
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {p.name}
                      {p.highlighted && (
                        <Badge tone="accent" size="sm">
                          Recommended on pricing page
                        </Badge>
                      )}
                    </span>
                  }
                  description={p.description}
                />
                <CardContent className="flex flex-1 flex-col gap-4">
                  <p className="flex items-baseline gap-1">
                    <span className="text-2xl font-semibold tabular-nums tracking-tight text-ink">{p.priceCents ? formatCents(p.priceCents) : "Free"}</span>
                    {p.priceCents > 0 && <span className="text-[13px] text-muted">/ month</span>}
                  </p>
                  <dl className="grid grid-cols-2 gap-2.5 text-[13px]">
                    <div className="rounded-lg border border-line px-3 py-2">
                      <dt className="text-muted">Commission</dt>
                      <dd className="mt-0.5 font-medium tabular-nums text-ink">{bpsToPercent(p.id === "free" ? feeBps : p.commissionBps)}%</dd>
                      {p.id === "free" && (
                        <dd className="text-[11.5px] text-muted">
                          <a href="#platform-fee" className="underline-offset-2 hover:underline">Editable default</a>
                          {feeBps !== p.commissionBps && <span className="text-warning"> · pricing page says {bpsToPercent(p.commissionBps)}%</span>}
                        </dd>
                      )}
                    </div>
                    <div className="rounded-lg border border-line px-3 py-2">
                      <dt className="text-muted">Monthly credits</dt>
                      <dd className="mt-0.5 font-medium tabular-nums text-ink">{p.monthlyLeadCredits}</dd>
                    </div>
                  </dl>
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">Subscribers</p>
                    <ul className="mt-2 space-y-1.5 text-[13px]">
                      {(["active", "past_due", "canceled"] as SubStatus[]).map((s) => (
                        <li key={s} className="flex items-center justify-between gap-3">
                          <StatusPill tone={STATUS_TONE[s]}>{STATUS_LABEL[s]}</StatusPill>
                          <span className="font-medium tabular-nums text-ink">{c[s]}</span>
                        </li>
                      ))}
                    </ul>
                    {p.id === "free" && c.implicit > 0 && (
                      <p className="mt-2 text-[12px] text-muted">{pluralize(c.implicit, "tutor")} counted here because they have no subscription record.</p>
                    )}
                  </div>
                  <ul className="mt-auto space-y-1.5 border-t border-line pt-4 text-[13px] text-ink-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Credits */}
      <section className="mt-10" aria-labelledby="credits-heading">
        <h2 id="credits-heading" className="text-[15px] font-semibold tracking-tight text-ink">
          Lead credits
        </h2>
        <p className="mb-4 mt-0.5 text-[13px] text-muted">
          Tutors spend {pluralize(CREDITS_PER_APPLICATION, "credit")} per job application.{" "}
          {creditsOn ? (
            "The lead_credits flag is on."
          ) : (
            <span className="font-medium text-warning">The lead_credits flag is off — tutors can&apos;t buy or spend credits.</span>
          )}{" "}
          <TextLink href="/admin/feature-flags">Feature flags</TextLink>
        </p>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="Credit packs" description="Purchases are counted from the credit ledger; revenue from settled payments." />
            <CardContent className="pt-4">
              <div className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-[13px]">
                  <caption className="sr-only">Credit packs</caption>
                  <thead className="bg-canvas text-left text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Pack</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Price</th>
                      <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">Per credit</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Purchases</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line tabular-nums">
                    {packs.map((p) => (
                      <tr key={p.id}>
                        <td className="px-3 py-2.5 font-medium text-ink">{p.credits} credits</td>
                        <td className="px-3 py-2.5 text-right text-ink-2">{formatCents(p.priceCents)}</td>
                        <td className="hidden px-3 py-2.5 text-right text-ink-2 sm:table-cell">{formatCents(p.perCredit, { exact: true })}</td>
                        <td className="px-3 py-2.5 text-right text-ink-2">{p.purchases}</td>
                        <td className="px-3 py-2.5 text-right text-ink-2">{formatCents(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {packs.every((p) => !p.purchases) && <p className="mt-3 text-[12.5px] text-muted">No credit packs have been bought yet in this preview.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Credit volume" description="All-time totals from the credit ledger." />
            <CardContent className="pt-4">
              <dl className="divide-y divide-line rounded-lg border border-line text-[13.5px]">
                <VolumeRow label="Granted by plans" hint="Monthly plan credits" value={`+${credit.planGrants}`} />
                <VolumeRow label="Purchased" hint="Credit packs" value={`+${credit.purchased}`} />
                {credit.otherGrants > 0 && <VolumeRow label="Other grants" hint="Adjustments" value={`+${credit.otherGrants}`} />}
                <VolumeRow label="Spent" hint="Job applications" value={credit.spent ? `−${credit.spent}` : "0"} />
                <VolumeRow label="Outstanding" hint="Granted + purchased − spent" value={String(credit.outstanding)} strong />
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4">
          <DataTable
            rows={credit.perTutor}
            columns={columns}
            rowKey={(r) => r.tutorId}
            pageSize={8}
            empty={<EmptyState icon={<Coins />} title="No credit activity yet" description="Balances appear here once tutors receive plan credits, buy a pack or apply to a job." />}
          />
          <p className="mt-2 text-[12.5px] text-muted">Tutors with ledger activity, highest balance first. Plan shows Starter when there&apos;s no subscription record.</p>
        </div>
      </section>

      {/* Revenue */}
      <section className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" aria-label="Revenue">
        <Card>
          <CardHeader title="Revenue" description="Settled payments: succeeded or partly refunded charges, minus refunds." />
          <CardContent className="space-y-3 pt-4">
            <RevenueBlock label="Subscriptions" totals={revenue.sub} />
            <RevenueBlock label="Credit packs" totals={revenue.lead} />
            <p className="text-[12.5px] text-muted">
              Lesson payments and payouts are in <TextLink href="/admin/payments">Payments & payouts</TextLink>.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Recent plan & credit payments" />
          <CardContent className="pt-4">
            {revenue.recent.length === 0 ? (
              <EmptyState compact icon={<Receipt />} title="No payments yet" description="Subscription and credit-pack charges appear here." />
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {revenue.recent.map((p) => (
                  <PaymentRow key={p.id} p={p} name={dir.name(p.userId)} when={formatDateTime(p.createdAt, tz)} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-10" aria-label="Starter plan commission">
        <PlatformFeeCard id="platform-fee" />
      </section>
    </>
  );
}

function VolumeRow({ label, hint, value, strong }: { label: string; hint: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3.5 py-2.5">
      <dt>
        <span className={strong ? "font-medium text-ink" : "text-ink-2"}>{label}</span>
        <span className="block text-[12px] text-muted">{hint}</span>
      </dt>
      <dd className={strong ? "text-base font-semibold tabular-nums text-ink" : "font-medium tabular-nums text-ink"}>{value}</dd>
    </div>
  );
}

function RevenueBlock({ label, totals }: { label: string; totals: { gross: number; refunds: number; net: number } }) {
  return (
    <div className="rounded-lg border border-line px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13.5px] font-medium text-ink">{label}</p>
        <p className="text-lg font-semibold tabular-nums text-ink">{formatCents(totals.net)}</p>
      </div>
      <p className="mt-0.5 text-[12.5px] tabular-nums text-muted">
        {formatCents(totals.gross)} charged · {formatCents(totals.refunds)} refunded
      </p>
    </div>
  );
}

function PaymentRow({ p, name, when }: { p: Payment; name: string; when: string }) {
  const tone = p.status === "succeeded" ? "success" : p.status === "failed" ? "danger" : p.status === "pending" ? "warning" : "neutral";
  return (
    <li className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px]">
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{p.description}</span>
        <span className="block truncate text-muted">
          {name} · {when}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-medium tabular-nums text-ink">{formatCents(p.amountCents, { exact: true })}</span>
        <StatusPill tone={tone}>{p.status === "succeeded" ? "Paid" : humanize(p.status)}</StatusPill>
      </span>
    </li>
  );
}
