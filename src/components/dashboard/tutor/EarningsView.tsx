"use client";

import * as React from "react";
import { ArrowDownToLine, Banknote, CalendarClock, CircleDollarSign, Clock3, CreditCard, Landmark, Percent, ShieldCheck, Undo2, Wallet } from "lucide-react";
import type { Booking, Payout } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useNow, useViewerTimezone } from "@/lib/store/hooks";
import { endMs } from "@/lib/booking";
import { formatDate } from "@/lib/format";
import { CURRENCIES, asCurrency, formatMoney, formatSums, sumByCurrency, type Currency } from "@/lib/money";
import { subjectName } from "@/lib/data/catalog";
import { PageHeader } from "@/components/dashboard/Shell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/States";
import { AreaChart, StatTile } from "@/components/charts";
import { Stagger, StaggerItem } from "@/components/motion";
import { NeedsTutorProfile } from "./shared";
import { DAY_MS, chartCurrency, grossCents, isCleared, isEarned, learnerIdOf, netCents, sumCents, useLearnerName, useMyBookings, useMyTutor, weeklyNet } from "./hooks";

type TxStatus = "available" | "clearing" | "upcoming" | "on_hold" | "refunded";

const TX_META: Record<TxStatus, { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  available: { label: "Available", tone: "success" },
  clearing: { label: "Clearing", tone: "warning" },
  upcoming: { label: "Upcoming lesson", tone: "accent" },
  on_hold: { label: "On hold · dispute", tone: "warning" },
  refunded: { label: "Refunded", tone: "neutral" },
};

const PAYOUT_META: Record<Payout["status"], { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  scheduled: { label: "Scheduled", tone: "accent" },
  in_transit: { label: "In transit", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

interface Tx {
  booking: Booking;
  /** The booking's currency; every amount below is in it. */
  currency: Currency;
  learner: string;
  gross: number;
  fee: number;
  net: number;
  refund: number;
  status: TxStatus;
  clearsAt?: number;
}

const EMPTY_PAYOUTS: Payout[] = [];

/** "1234.50" from integer cents, without float math. */
const decimal = (cents: number) => `${cents < 0 ? "-" : ""}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;

export function EarningsView() {
  const { tutor } = useMyTutor();
  const now = useNow(60_000);
  const tz = useViewerTimezone();
  const policy = useApp((s) => s.policy);
  const payments = useApp((s) => s.payments);
  const allPayouts = useApp((s) => s.payouts);
  const bookings = useMyBookings(tutor?.id);
  const nameOf = useLearnerName();
  const payouts = React.useMemo(() => (tutor ? allPayouts.filter((p) => p.tutorId === tutor.id).sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate)) : EMPTY_PAYOUTS), [allPayouts, tutor]);

  /** Refunds issued to families on my lessons (explicit refund entries, else the original charge marked refunded). */
  const refundFor = React.useCallback(
    (b: Booking) => {
      const pays = payments.filter((p) => p.bookingId === b.id);
      const explicit = sumCents(pays.filter((p) => p.amountCents < 0).map((p) => -p.amountCents));
      return explicit || sumCents(pays.filter((p) => p.amountCents > 0 && p.status === "refunded").map((p) => p.amountCents));
    },
    [payments],
  );

  const txs: Tx[] = React.useMemo(() => {
    const out: Tx[] = [];
    for (const b of bookings) {
      const refund = refundFor(b);
      const base = { booking: b, currency: asCurrency(b.currency), learner: nameOf(learnerIdOf(b)), gross: grossCents(b), fee: b.platformFeeCents, refund };
      if (isEarned(b)) {
        const cleared = isCleared(b, now, policy);
        out.push({ ...base, net: netCents(b), status: cleared ? "available" : "clearing", clearsAt: endMs(b) + policy.disputeWindowDays * DAY_MS });
      } else if ((b.status === "confirmed" || b.status === "in_progress") && b.paymentStatus === "paid") {
        out.push({ ...base, net: netCents(b), status: "upcoming" });
      } else if (b.status === "disputed") {
        out.push({ ...base, net: netCents(b), status: "on_hold" });
      } else if (refund > 0) {
        out.push({ ...base, net: 0, fee: 0, status: "refunded" });
      }
    }
    return out.sort((a, b) => b.booking.startUtc.localeCompare(a.booking.startUtc));
  }, [bookings, refundFor, nameOf, now, policy]);

  const chartIn = React.useMemo(() => chartCurrency(bookings, tutor?.currency), [bookings, tutor?.currency]);
  const weekly = React.useMemo(() => weeklyNet(bookings, now, tz, 12, chartIn), [bookings, now, tz, chartIn]);

  if (!tutor) return <NeedsTutorProfile what="earnings" />;

  // Amounts are never added across currencies: a tutor who changed currency sees one total per currency.
  const own = asCurrency(tutor.currency);
  const total = (items: { amount: number; currency: Currency }[]) => formatSums(items, own);
  const earned = txs.filter((t) => t.status === "available" || t.status === "clearing");
  const totalNet = total(earned.map((t) => ({ amount: t.net, currency: t.currency })));
  const upcomingNet = total(txs.filter((t) => t.status === "upcoming").map((t) => ({ amount: t.net, currency: t.currency })));
  const payoutItems = (list: Payout[]) => list.map((p) => ({ amount: p.amountCents, currency: asCurrency(p.currency) }));
  const paid = payouts.filter((p) => p.status === "paid");
  const paidOut = total(payoutItems(paid));
  const inFlight = payouts.filter((p) => p.status === "scheduled" || p.status === "in_transit");
  const upcomingPayout = total(payoutItems(inFlight));
  const nextArrival = [...inFlight].sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate))[0];
  // Owed to you: completed lessons minus TutorLink's fee, less anything already paid out or on its way.
  const owed = total(
    sumByCurrency([
      ...earned.map((t) => ({ amount: t.net, currency: t.currency })),
      ...payoutItems(payouts.filter((p) => p.status !== "failed")).map((x) => ({ ...x, amount: -x.amount })),
    ]).map((x) => ({ ...x, amount: Math.max(0, x.amount) })),
  );
  const fees = total(earned.map((t) => ({ amount: t.fee, currency: t.currency })));
  const refunds = total(txs.map((t) => ({ amount: t.refund, currency: t.currency })));
  const severalCurrencies = new Set(txs.map((t) => t.currency)).size > 1;

  const downloadCsv = () => {
    const header = ["Lesson date", "Subject", "Student", "Type", "Currency", "Gross", "Platform fee", "Net", "Status"];
    const lines = txs.map((t) => [
      formatDate(t.booking.startUtc, tz),
      subjectName(t.booking.subject),
      t.learner,
      t.booking.type,
      t.currency,
      decimal(t.gross),
      decimal(t.fee),
      decimal(t.net),
      TX_META[t.status].label,
    ]);
    const csv = [header, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `tutorlink-earnings-${new Date(now).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const txColumns: Column<Tx>[] = [
    {
      key: "lesson",
      header: "Lesson",
      cell: (t) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-ink">{subjectName(t.booking.subject)}</span>
          <span className="block truncate text-[12.5px] text-muted">
            {t.learner}
            {t.booking.type === "trial" ? " · Trial" : ""}
          </span>
        </span>
      ),
      sortValue: (t) => subjectName(t.booking.subject),
    },
    { key: "date", header: "Date", cell: (t) => <span className="tabular-nums">{formatDate(t.booking.startUtc, tz)}</span>, sortValue: (t) => t.booking.startUtc },
    { key: "gross", header: "Gross", align: "right", cell: (t) => (t.gross ? formatMoney(t.gross, t.currency) : "Free"), sortValue: (t) => t.gross },
    { key: "fee", header: "Fee", align: "right", cell: (t) => (t.fee ? `−${formatMoney(t.fee, t.currency)}` : "—"), sortValue: (t) => t.fee, hideOnMobile: true },
    { key: "net", header: "Net", align: "right", cell: (t) => <span className="font-medium text-ink">{formatMoney(t.net, t.currency)}</span>, sortValue: (t) => t.net },
    {
      key: "status",
      header: "Status",
      cell: (t) => (
        <span className="inline-flex flex-col items-start gap-0.5">
          <Badge tone={TX_META[t.status].tone} size="sm">
            {TX_META[t.status].label}
          </Badge>
          {t.status === "clearing" && t.clearsAt && <span className="text-[11.5px] text-muted">Available {formatDate(new Date(t.clearsAt).toISOString(), tz, { month: "short", day: "numeric" })}</span>}
        </span>
      ),
      sortValue: (t) => t.status,
    },
  ];

  const payoutColumns: Column<Payout>[] = [
    { key: "arrival", header: "Arrival date", cell: (p) => <span className="font-medium tabular-nums text-ink">{formatDate(`${p.arrivalDate}T12:00:00Z`, "UTC")}</span>, sortValue: (p) => p.arrivalDate },
    { key: "amount", header: "Amount", align: "right", cell: (p) => <span className="font-medium text-ink">{formatMoney(p.amountCents, p.currency)}</span>, sortValue: (p) => p.amountCents },
    { key: "created", header: "Initiated", cell: (p) => <span className="tabular-nums">{formatDate(p.createdAt, tz)}</span>, sortValue: (p) => p.createdAt },
    {
      key: "status",
      header: "Status",
      cell: (p) => (
        <Badge tone={PAYOUT_META[p.status].tone} size="sm">
          {PAYOUT_META[p.status].label}
        </Badge>
      ),
      sortValue: (p) => p.status,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Earnings"
        description={`Money from your lessons after the platform fee. Earnings become available ${policy.disputeWindowDays} days after each lesson ends.`}
        actions={
          <Button variant="secondary" onClick={downloadCsv} disabled={!txs.length}>
            <ArrowDownToLine /> Export CSV
          </Button>
        }
      />

      <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 [&>div>div]:h-full" stagger={0.05}>
        <StaggerItem>
          <StatTile label="Total earned (net)" value={<span className="tabular-nums">{totalNet}</span>} icon={<CircleDollarSign />} hint={`${earned.length} paid ${earned.length === 1 ? "lesson" : "lessons"}`} />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Owed to you" value={<span className="tabular-nums">{owed}</span>} icon={<Wallet />} hint="Completed lessons, minus TutorLink's fee" />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Upcoming lessons"
            value={<span className="tabular-nums">{upcomingNet}</span>}
            icon={<Clock3 />}
            hint="Paid, not taught yet"
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Paid out" value={<span className="tabular-nums">{paidOut}</span>} icon={<Banknote />} hint={`${paid.length} ${paid.length === 1 ? "payout" : "payouts"}`} />
        </StaggerItem>
      </Stagger>
      <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 [&>div:first-child]:col-span-2 lg:[&>div:first-child]:col-span-1 [&>div>div]:h-full" stagger={0.05}>
        <StaggerItem>
          <StatTile
            label="Upcoming payout"
            value={<span className="tabular-nums">{upcomingPayout}</span>}
            icon={<CalendarClock />}
            hint={nextArrival ? `Arrives ${formatDate(`${nextArrival.arrivalDate}T12:00:00Z`, "UTC", { month: "short", day: "numeric" })}` : "Automatic payouts are being set up"}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Platform fees" value={<span className="tabular-nums">{fees}</span>} icon={<Percent />} hint="On paid lessons" />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Refund adjustments" value={<span className="tabular-nums">{refunds}</span>} icon={<Undo2 />} hint="Returned to families" />
        </StaggerItem>
      </Stagger>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader title="Net earnings by week" description={`Last 12 weeks, by lesson date.${severalCurrencies ? ` Lessons in ${chartIn} (${CURRENCIES[chartIn].name}) only.` : ""}`} />
          <CardContent>
            {weekly.some((w) => w.value > 0) ? (
              <AreaChart data={weekly} caption="Net earnings per week, last 12 weeks" format={(n) => formatMoney(Math.round(n), chartIn)} height={240} />
            ) : (
              <EmptyState compact icon={<Wallet />} title="No earnings yet" description="Your weekly earnings chart fills in after your first completed lesson." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Landmark className="size-4 text-ink" aria-hidden /> Bank payouts
              </span>
            }
            action={
              <Badge tone="neutral" size="sm" dot>
                Being set up
              </Badge>
            }
          />
          <CardContent className="space-y-4 pt-4 text-[13.5px] leading-relaxed text-muted">
            <p>TutorLink pays out to your bank account; automatic payouts are being set up.</p>
            <ol className="space-y-3">
              <li className="flex gap-2.5">
                <CreditCard className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
                <span>
                  <span className="font-medium text-ink">Families pay online.</span> With UPI or a card, in your currency. The payment is taken when you accept a lesson (or right away for instant bookings).
                </span>
              </li>
              <li className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
                <span>
                  <span className="font-medium text-ink">{policy.disputeWindowDays}-day dispute window.</span> After a lesson ends, families have {policy.disputeWindowDays} days to report a problem. Earnings show as Clearing until then.
                </span>
              </li>
              <li className="flex gap-2.5">
                <Banknote className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
                <span>
                  <span className="font-medium text-ink">Owed to you.</span> Each completed lesson, minus TutorLink&apos;s fee, is owed to you until it&apos;s paid to your bank.
                </span>
              </li>
            </ol>
            <p className="rounded-lg bg-canvas px-3 py-2 text-[12.5px]">Figures are worked out from your lessons and any payouts recorded below.</p>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="tx-h" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="tx-h" className="text-[15px] font-semibold tracking-tight text-ink">
              Lesson transactions
            </h2>
            <p className="text-[13px] text-muted">Paid, upcoming, held and refunded lessons.</p>
          </div>
        </div>
        <DataTable
          rows={txs}
          columns={txColumns}
          rowKey={(t) => t.booking.id}
          pageSize={8}
          empty={<EmptyState compact icon={<CircleDollarSign />} title="No transactions yet" description="Paid lessons appear here once families book and you confirm." />}
        />
      </section>

      <section aria-labelledby="po-h" className="space-y-3">
        <div>
          <h2 id="po-h" className="text-[15px] font-semibold tracking-tight text-ink">
            Payouts
          </h2>
          <p className="text-[13px] text-muted">Transfers to your bank account.</p>
        </div>
        <DataTable
          rows={payouts}
          columns={payoutColumns}
          rowKey={(p) => p.id}
          pageSize={6}
          empty={<EmptyState compact icon={<Banknote />} title="No payouts yet" description="TutorLink pays out to your bank account; automatic payouts are being set up." />}
        />
      </section>
    </div>
  );
}
