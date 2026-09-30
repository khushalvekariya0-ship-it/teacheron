"use client";

import * as React from "react";
import { ArrowDownToLine, Banknote, CalendarClock, CircleDollarSign, Clock3, CreditCard, Landmark, Percent, ShieldCheck, Undo2, Wallet } from "lucide-react";
import type { Booking, Payout } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useNow, useViewerTimezone } from "@/lib/store/hooks";
import { endMs } from "@/lib/booking";
import { formatCents, formatDate } from "@/lib/format";
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
import { DAY_MS, grossCents, isCleared, isEarned, learnerIdOf, netCents, sumCents, useLearnerName, useMyBookings, useMyTutor, weeklyNet } from "./hooks";

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
      const base = { booking: b, learner: nameOf(learnerIdOf(b)), gross: grossCents(b), fee: b.platformFeeCents, refund };
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

  const weekly = React.useMemo(() => weeklyNet(bookings, now, tz, 12), [bookings, now, tz]);

  if (!tutor) return <NeedsTutorProfile what="earnings" />;

  const earned = txs.filter((t) => t.status === "available" || t.status === "clearing");
  const totalNet = sumCents(earned.map((t) => t.net));
  const clearedNet = sumCents(txs.filter((t) => t.status === "available").map((t) => t.net));
  const clearingNet = sumCents(txs.filter((t) => t.status === "clearing").map((t) => t.net));
  const upcomingNet = sumCents(txs.filter((t) => t.status === "upcoming").map((t) => t.net));
  const pending = clearingNet + upcomingNet;
  const paidOut = sumCents(payouts.filter((p) => p.status === "paid").map((p) => p.amountCents));
  const inFlight = payouts.filter((p) => p.status === "scheduled" || p.status === "in_transit");
  const upcomingPayout = sumCents(inFlight.map((p) => p.amountCents));
  const nextArrival = [...inFlight].sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate))[0];
  const allocated = sumCents(payouts.filter((p) => p.status !== "failed").map((p) => p.amountCents));
  const available = Math.max(0, clearedNet - allocated);
  const fees = sumCents(earned.map((t) => t.fee));
  const refunds = sumCents(txs.map((t) => t.refund));
  const nextClear = txs.filter((t) => t.status === "clearing").sort((a, b) => (a.clearsAt ?? 0) - (b.clearsAt ?? 0))[0];

  const downloadCsv = () => {
    const header = ["Lesson date", "Subject", "Student", "Type", "Gross", "Platform fee", "Net", "Status"];
    const lines = txs.map((t) => [
      formatDate(t.booking.startUtc, tz),
      subjectName(t.booking.subject),
      t.learner,
      t.booking.type,
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
    { key: "gross", header: "Gross", align: "right", cell: (t) => (t.gross ? formatCents(t.gross) : "Free"), sortValue: (t) => t.gross },
    { key: "fee", header: "Fee", align: "right", cell: (t) => (t.fee ? `−${formatCents(t.fee)}` : "—"), sortValue: (t) => t.fee, hideOnMobile: true },
    { key: "net", header: "Net", align: "right", cell: (t) => <span className="font-medium text-ink">{formatCents(t.net)}</span>, sortValue: (t) => t.net },
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
    { key: "amount", header: "Amount", align: "right", cell: (p) => <span className="font-medium text-ink">{formatCents(p.amountCents)}</span>, sortValue: (p) => p.amountCents },
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
          <StatTile label="Total earned (net)" value={<span className="tabular-nums">{formatCents(totalNet)}</span>} icon={<CircleDollarSign />} hint={`${earned.length} paid ${earned.length === 1 ? "lesson" : "lessons"}`} />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Available balance" value={<span className="tabular-nums">{formatCents(available)}</span>} icon={<Wallet />} hint="Cleared, not yet paid out" />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Pending"
            value={<span className="tabular-nums">{formatCents(pending)}</span>}
            icon={<Clock3 />}
            hint={nextClear?.clearsAt ? `Next clears ${formatDate(new Date(nextClear.clearsAt).toISOString(), tz, { month: "short", day: "numeric" })}` : "Clearing and upcoming"}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Paid out" value={<span className="tabular-nums">{formatCents(paidOut)}</span>} icon={<Banknote />} hint={`${payouts.filter((p) => p.status === "paid").length} payouts`} />
        </StaggerItem>
      </Stagger>
      <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 [&>div:first-child]:col-span-2 lg:[&>div:first-child]:col-span-1 [&>div>div]:h-full" stagger={0.05}>
        <StaggerItem>
          <StatTile
            label="Upcoming payout"
            value={<span className="tabular-nums">{formatCents(upcomingPayout)}</span>}
            icon={<CalendarClock />}
            hint={nextArrival ? `Arrives ${formatDate(`${nextArrival.arrivalDate}T12:00:00Z`, "UTC", { month: "short", day: "numeric" })}` : "Nothing scheduled"}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Platform fees" value={<span className="tabular-nums">{formatCents(fees)}</span>} icon={<Percent />} hint="On paid lessons" />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Refund adjustments" value={<span className="tabular-nums">{formatCents(refunds)}</span>} icon={<Undo2 />} hint="Returned to families" />
        </StaggerItem>
      </Stagger>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader title="Net earnings by week" description="Last 12 weeks, by lesson date." />
          <CardContent>
            {weekly.some((w) => w.value > 0) ? (
              <AreaChart data={weekly} caption="Net earnings per week, last 12 weeks" format={(n) => formatCents(Math.round(n))} height={240} />
            ) : (
              <EmptyState compact icon={<Wallet />} title="No earnings yet" description="Your weekly earnings chart fills in after your first completed lesson." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Landmark className="size-4 text-ink" aria-hidden /> Stripe Connect
              </span>
            }
            action={
              <Badge tone="success" size="sm" dot>
                Connected · test mode
              </Badge>
            }
          />
          <CardContent className="space-y-4 pt-4 text-[13.5px] leading-relaxed text-muted">
            <p>Families pay through Stripe. TutorLink deducts the platform fee recorded on each booking and sends the rest to the bank account on your Stripe account.</p>
            <ol className="space-y-3">
              <li className="flex gap-2.5">
                <CreditCard className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
                <span>
                  <span className="font-medium text-ink">Charged on confirmation.</span> Payment is captured when you accept a lesson (or instantly for instant bookings).
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
                  <span className="font-medium text-ink">Paid out.</span> Cleared earnings are grouped into payouts; each payout&apos;s arrival date is listed below.
                </span>
              </li>
            </ol>
            <p className="rounded-lg bg-canvas px-3 py-2 text-[12.5px]">Preview build: no real money moves. Figures are computed from the lessons and payouts recorded here, so payouts can include lessons from before this sample history.</p>
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
          empty={<EmptyState compact icon={<Banknote />} title="No payouts yet" description="Your first payout is created once earnings clear the dispute window." />}
        />
      </section>
    </div>
  );
}
