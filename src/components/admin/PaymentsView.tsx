"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Check, Gavel, Landmark, Lock, Receipt, Undo2 } from "lucide-react";
import type { Payment, Payout } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useViewerTimezone } from "@/lib/store/hooks";
import { subjectName } from "@/lib/data/catalog";
import { formatCents, formatDateTime, pluralize } from "@/lib/format";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Disclosure";
import { Sheet, SheetContent } from "@/components/ui/Overlay";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import {
  ClearFilters, ExportButton, Facts, FilterSelect, MiniStat, Mono, PermissionNotice, PersonCell, RowOpen, SearchInput, Section, StatusPill, TextLink, Toolbar,
  centsToDecimal, matches, settledNet, useDirectory, useStaff, useSticky, useUrlParam,
} from "./kit";
import { PaymentRows } from "./BookingsView";
import { DISPUTE_STATUS_META, PAYMENT_KIND_LABEL, PAYMENT_ROW_META, PAYOUT_META, formatCalendarDate, isDisputeOpen, refundSource, signedCents } from "./money";

type TabKey = "payments" | "refunds" | "payouts";
type KindFilter = "all" | Payment["kind"];
type PayStatusFilter = "all" | Payment["status"];
type SourceFilter = "all" | "dispute" | "policy";
type PayoutFilter = "all" | Payout["status"];

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Any type" },
  ...(Object.keys(PAYMENT_KIND_LABEL) as Payment["kind"][]).map((k) => ({ value: k, label: PAYMENT_KIND_LABEL[k] })),
];
const PAY_STATUS_OPTIONS: { value: PayStatusFilter; label: string }[] = [
  { value: "all", label: "Any status" },
  ...(Object.keys(PAYMENT_ROW_META) as Payment["status"][]).map((s) => ({ value: s, label: PAYMENT_ROW_META[s].label })),
];
const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "Any source" },
  { value: "dispute", label: "Dispute resolution" },
  { value: "policy", label: "Booking policy" },
];
const PAYOUT_OPTIONS: { value: PayoutFilter; label: string }[] = [
  { value: "all", label: "Any status" },
  ...(Object.keys(PAYOUT_META) as Payout["status"][]).map((s) => ({ value: s, label: PAYOUT_META[s].label })),
];

const SOURCE_LABEL = { dispute: "Dispute resolution", policy: "Booking policy" } as const;

const sum = (rows: { amountCents: number }[]) => rows.reduce((a, r) => a + r.amountCents, 0);
const byNewest = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);

export function PaymentsView() {
  return (
    <PermissionGate permission="payments.read">
      <PaymentsInner />
    </PermissionGate>
  );
}

function PaymentsInner() {
  const payments = useApp((s) => s.payments);
  const payouts = useApp((s) => s.payouts);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const { can } = useStaff();
  const [openId, setOpenId] = useUrlParam("id");

  const [tab, setTab] = React.useState<TabKey>(() => {
    if (openId?.startsWith("po_")) return "payouts";
    const p = payments.find((x) => x.id === openId);
    return p && p.amountCents < 0 ? "refunds" : "payments";
  });
  const [q, setQ] = React.useState("");
  const [kind, setKind] = React.useState<KindFilter>("all");
  const [payStatus, setPayStatus] = React.useState<PayStatusFilter>("all");
  const [source, setSource] = React.useState<SourceFilter>("all");
  const [payoutStatus, setPayoutStatus] = React.useState<PayoutFilter>("all");

  const charges = React.useMemo(
    () =>
      payments
        .filter((p) => p.amountCents > 0)
        .filter((p) => (kind === "all" || p.kind === kind) && (payStatus === "all" || p.status === payStatus))
        .filter((p) => matches(q, dir.name(p.userId), dir.email(p.userId), p.id, p.description, p.bookingId))
        .sort(byNewest),
    [payments, kind, payStatus, q, dir],
  );
  const refunds = React.useMemo(
    () =>
      payments
        .filter((p) => p.amountCents < 0)
        .filter((p) => source === "all" || refundSource(p) === source)
        .filter((p) => matches(q, dir.name(p.userId), dir.email(p.userId), p.id, p.description, p.bookingId))
        .sort(byNewest),
    [payments, source, q, dir],
  );
  const payoutRows = React.useMemo(
    () => payouts.filter((p) => (payoutStatus === "all" || p.status === payoutStatus) && matches(q, dir.name(p.tutorId), p.id, p.tutorId)).sort(byNewest),
    [payouts, payoutStatus, q, dir],
  );

  const platform = React.useMemo(() => settledNet(payments), [payments]);

  const filtered = q.trim() !== "" || (tab === "payments" ? kind !== "all" || payStatus !== "all" : tab === "refunds" ? source !== "all" : payoutStatus !== "all");
  const clear = () => {
    setQ("");
    setKind("all");
    setPayStatus("all");
    setSource("all");
    setPayoutStatus("all");
  };

  const payer = (p: Payment) => <PersonCell name={dir.name(p.userId)} sub={dir.email(p.userId)} className="max-w-52" />;

  const chargeColumns: Column<Payment>[] = [
    { key: "date", header: "Date", sortValue: (p) => p.createdAt, cell: (p) => <RowOpen onOpen={() => setOpenId(p.id)} label={`Open ${p.id}`} className="whitespace-nowrap tabular-nums">{formatDateTime(p.createdAt, tz)}</RowOpen> },
    { key: "payer", header: "Payer", sortValue: (p) => dir.name(p.userId), cell: payer },
    {
      key: "description",
      header: "Description",
      sortValue: (p) => p.description,
      cell: (p) => <PersonCell name={<span className="font-normal text-ink-2">{p.description}</span>} sub={<Mono>{p.id}</Mono>} className="max-w-56" />,
      hideOnMobile: true,
    },
    { key: "kind", header: "Type", sortValue: (p) => p.kind, cell: (p) => PAYMENT_KIND_LABEL[p.kind] },
    { key: "method", header: "Method", sortValue: (p) => p.method, cell: (p) => <span className="whitespace-nowrap">{p.method}</span>, hideOnMobile: true },
    { key: "amount", header: "Amount", align: "right", sortValue: (p) => p.amountCents, cell: (p) => <span className="font-medium text-ink">{formatCents(p.amountCents)}</span> },
    { key: "status", header: "Status", sortValue: (p) => p.status, cell: (p) => <StatusPill tone={PAYMENT_ROW_META[p.status].tone}>{PAYMENT_ROW_META[p.status].label}</StatusPill> },
  ];

  const refundColumns: Column<Payment>[] = [
    { key: "date", header: "Date", sortValue: (p) => p.createdAt, cell: (p) => <RowOpen onOpen={() => setOpenId(p.id)} label={`Open ${p.id}`} className="whitespace-nowrap tabular-nums">{formatDateTime(p.createdAt, tz)}</RowOpen> },
    { key: "payer", header: "Refunded to", sortValue: (p) => dir.name(p.userId), cell: payer },
    { key: "description", header: "Reason", sortValue: (p) => p.description, cell: (p) => <span className="block max-w-64 truncate">{p.description.replace(/^Refund — /, "")}</span> },
    { key: "source", header: "Source", sortValue: (p) => refundSource(p), cell: (p) => <Badge size="sm">{SOURCE_LABEL[refundSource(p)]}</Badge> },
    { key: "booking", header: "Booking", sortValue: (p) => p.bookingId ?? "", cell: (p) => (p.bookingId ? <Mono>{p.bookingId}</Mono> : "—"), hideOnMobile: true },
    { key: "amount", header: "Amount", align: "right", sortValue: (p) => p.amountCents, cell: (p) => <span className="font-medium text-ink">{signedCents(p.amountCents)}</span> },
  ];

  const payoutColumns: Column<Payout>[] = [
    { key: "created", header: "Created", sortValue: (p) => p.createdAt, cell: (p) => <RowOpen onOpen={() => setOpenId(p.id)} label={`Open payout ${p.id}`} className="whitespace-nowrap tabular-nums">{formatDateTime(p.createdAt, tz)}</RowOpen> },
    { key: "tutor", header: "Tutor", sortValue: (p) => dir.name(p.tutorId), cell: (p) => <PersonCell name={dir.name(p.tutorId)} sub={<Mono>{p.id}</Mono>} /> },
    { key: "amount", header: "Amount", align: "right", sortValue: (p) => p.amountCents, cell: (p) => <span className="font-medium text-ink">{formatCents(p.amountCents)}</span> },
    { key: "status", header: "Status", sortValue: (p) => p.status, cell: (p) => <StatusPill tone={PAYOUT_META[p.status].tone}>{PAYOUT_META[p.status].label}</StatusPill> },
    { key: "arrival", header: "Arrival date", sortValue: (p) => p.arrivalDate, cell: (p) => <span className="whitespace-nowrap tabular-nums">{formatCalendarDate(p.arrivalDate)}</span> },
  ];

  const exportConfig = {
    payments: {
      filename: "tutorlink-payments",
      headers: ["ID", "Date (UTC)", "Payer", "Payer email", "Type", "Description", "Method", "Amount", "Status", "Booking ID"],
      rows: () => charges.map((p) => [p.id, p.createdAt, dir.name(p.userId), dir.email(p.userId) ?? "", PAYMENT_KIND_LABEL[p.kind], p.description, p.method, centsToDecimal(p.amountCents), p.status, p.bookingId ?? ""]),
    },
    refunds: {
      filename: "tutorlink-refunds",
      headers: ["ID", "Date (UTC)", "Refunded to", "Email", "Reason", "Source", "Booking ID", "Amount"],
      rows: () => refunds.map((p) => [p.id, p.createdAt, dir.name(p.userId), dir.email(p.userId) ?? "", p.description, SOURCE_LABEL[refundSource(p)], p.bookingId ?? "", centsToDecimal(p.amountCents)]),
    },
    payouts: {
      filename: "tutorlink-payouts",
      headers: ["ID", "Created (UTC)", "Tutor", "Tutor ID", "Amount", "Status", "Arrival date"],
      rows: () => payoutRows.map((p) => [p.id, p.createdAt, dir.name(p.tutorId), p.tutorId, centsToDecimal(p.amountCents), p.status, p.arrivalDate]),
    },
  }[tab];

  const record: Payment | Payout | null = payments.find((p) => p.id === openId) ?? payouts.find((p) => p.id === openId) ?? null;

  const emptyFiltered = (
    <EmptyState
      icon={<Receipt />}
      title="Nothing matches these filters"
      description="Try another name or ID, or clear the filters."
      action={<Button variant="secondary" size="sm" onClick={clear}>Clear filters</Button>}
    />
  );

  return (
    <>
      <PageHeader
        title="Payments & payouts"
        description="Charges collected from learners, refunds returned to them and payouts sent to tutors."
        actions={<ExportButton key={tab} filename={exportConfig.filename} headers={exportConfig.headers} rows={exportConfig.rows} />}
      />

      <InlineAlert
        tone="info"
        title="How refunds work"
        className="mb-6"
        action={
          can("payments.refund") ? (
            <Badge tone="success" size="sm" className="mt-0.5 shrink-0">
              <Check aria-hidden /> You can issue refunds
            </Badge>
          ) : (
            <Badge size="sm" className="mt-0.5 shrink-0">
              <Lock aria-hidden /> No refund permission
            </Badge>
          )
        }
      >
        Refunds are issued by resolving a dispute (requires <span className="font-mono text-[12px]">payments.refund</span>) or automatically by the booking policy when a booking is cancelled or a tutor
        no-show is recorded. Card data is handled by Stripe — this preview stores only a masked payment method label.
      </InlineAlert>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList aria-label="Money records">
          <TabsTrigger value="payments" count={charges.length}>Payments</TabsTrigger>
          <TabsTrigger value="refunds" count={refunds.length}>Refunds</TabsTrigger>
          <TabsTrigger value="payouts" count={payoutRows.length}>Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat label="Gross succeeded" value={formatCents(settledNet(charges).gross)} hint={`${pluralize(charges.filter((p) => p.status === "succeeded" || p.status === "partially_refunded").length, "charge")} in view`} />
            <MiniStat label="Pending capture" value={formatCents(sum(charges.filter((p) => p.status === "pending")))} hint={`${pluralize(charges.filter((p) => p.status === "pending").length, "charge")} awaiting confirmation`} />
            <MiniStat
              label="Failed"
              value={charges.filter((p) => p.status === "failed").length}
              hint={`${formatCents(sum(charges.filter((p) => p.status === "failed")))} not collected`}
              tone={charges.some((p) => p.status === "failed") ? "danger" : undefined}
            />
            <MiniStat label="Net settled" value={formatCents(platform.net)} hint="All charges minus all refunds" />
          </div>
          <Toolbar summary={pluralize(charges.length, "payment")}>
            <SearchInput value={q} onChange={setQ} placeholder="Search payer, description or ID…" label="Search payments" />
            <FilterSelect label="Payment type" value={kind} onChange={setKind} options={KIND_OPTIONS} />
            <FilterSelect label="Payment status" value={payStatus} onChange={setPayStatus} options={PAY_STATUS_OPTIONS} />
            <ClearFilters active={filtered} onClear={clear} />
          </Toolbar>
          <DataTable
            rows={charges}
            columns={chargeColumns}
            rowKey={(p) => p.id}
            onRowClick={(p) => setOpenId(p.id)}
            pageSize={12}
            empty={filtered ? emptyFiltered : <EmptyState icon={<Receipt />} title="No payments yet" description="Charges appear here when learners book paid lessons, tutors subscribe or buy lead credits." />}
          />
        </TabsContent>

        <TabsContent value="refunds">
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStat label="Refunded" value={formatCents(-sum(refunds))} hint={`${pluralize(refunds.length, "refund")} in view`} />
            <MiniStat label="From disputes" value={formatCents(-sum(refunds.filter((p) => refundSource(p) === "dispute")))} hint={pluralize(refunds.filter((p) => refundSource(p) === "dispute").length, "refund")} />
            <MiniStat label="From booking policy" value={formatCents(-sum(refunds.filter((p) => refundSource(p) === "policy")))} hint="Cancellations and tutor no-shows" />
            <MiniStat label="Net settled" value={formatCents(platform.net)} hint={`${formatCents(platform.gross)} gross − ${formatCents(platform.refunds)} refunded`} />
          </div>
          <Toolbar summary={pluralize(refunds.length, "refund")}>
            <SearchInput value={q} onChange={setQ} placeholder="Search person, reason or ID…" label="Search refunds" />
            <FilterSelect label="Refund source" value={source} onChange={setSource} options={SOURCE_OPTIONS} />
            <ClearFilters active={filtered} onClear={clear} />
          </Toolbar>
          <DataTable
            rows={refunds}
            columns={refundColumns}
            rowKey={(p) => p.id}
            onRowClick={(p) => setOpenId(p.id)}
            pageSize={12}
            empty={
              filtered ? (
                emptyFiltered
              ) : (
                <EmptyState
                  icon={<Undo2 />}
                  title="No refunds recorded"
                  description="Refunds appear here when a dispute is resolved with a refund, or when a paid booking is cancelled or a tutor no-show is recorded."
                  action={<Button asChild variant="secondary" size="sm"><Link href="/admin/disputes">Open dispute queue</Link></Button>}
                />
              )
            }
          />
        </TabsContent>

        <TabsContent value="payouts">
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(Object.keys(PAYOUT_META) as Payout["status"][]).map((s) => {
              const list = payoutRows.filter((p) => p.status === s);
              return <MiniStat key={s} label={PAYOUT_META[s].label} value={formatCents(sum(list))} hint={pluralize(list.length, "payout")} tone={s === "failed" && list.length ? "danger" : undefined} />;
            })}
          </div>
          <Toolbar summary={pluralize(payoutRows.length, "payout")}>
            <SearchInput value={q} onChange={setQ} placeholder="Search tutor or payout ID…" label="Search payouts" />
            <FilterSelect label="Payout status" value={payoutStatus} onChange={setPayoutStatus} options={PAYOUT_OPTIONS} />
            <ClearFilters active={filtered} onClear={clear} />
          </Toolbar>
          <DataTable
            rows={payoutRows}
            columns={payoutColumns}
            rowKey={(p) => p.id}
            onRowClick={(p) => setOpenId(p.id)}
            pageSize={12}
            empty={filtered ? emptyFiltered : <EmptyState icon={<Landmark />} title="No payouts yet" description="Payouts appear here once tutors have completed paid lessons." />}
          />
        </TabsContent>
      </Tabs>

      <RecordSheet record={record} onClose={() => setOpenId(null)} />
    </>
  );
}

/* ─── Detail drawer ──────────────────────────────────────────────────────────── */

const isPayout = (r: Payment | Payout): r is Payout => "tutorId" in r && "arrivalDate" in r;

function RecordSheet({ record: current, onClose }: { record: Payment | Payout | null; onClose: () => void }) {
  const record = useSticky(current);
  const title = !record ? "Record" : isPayout(record) ? `Payout · ${formatCents(record.amountCents)}` : record.amountCents < 0 ? `Refund · ${formatCents(-record.amountCents)}` : `${PAYMENT_KIND_LABEL[record.kind]} payment · ${formatCents(record.amountCents)}`;
  return (
    <Sheet open={!!current} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" title={title} description={record?.id} className="sm:w-[34rem]" footer={record && !isPayout(record) ? <PaymentFooter payment={record} /> : undefined}>
        {record && (isPayout(record) ? <PayoutDetail payout={record} /> : <PaymentDetail payment={record} />)}
      </SheetContent>
    </Sheet>
  );
}

function PaymentDetail({ payment: p }: { payment: Payment }) {
  const payments = useApp((s) => s.payments);
  const bookings = useApp((s) => s.bookings);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const booking = p.bookingId ? bookings.find((b) => b.id === p.bookingId) : undefined;
  const related = React.useMemo(
    () => (p.bookingId ? payments.filter((x) => x.bookingId === p.bookingId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : []),
    [payments, p.bookingId],
  );
  const refund = p.amountCents < 0;

  return (
    <div className="divide-y divide-line">
      <div className="flex flex-wrap items-center gap-1.5 px-5 py-4">
        {refund ? <Badge size="sm">Refund · {SOURCE_LABEL[refundSource(p)]}</Badge> : <StatusPill tone={PAYMENT_ROW_META[p.status].tone}>{PAYMENT_ROW_META[p.status].label}</StatusPill>}
        <Badge size="sm">{PAYMENT_KIND_LABEL[p.kind]}</Badge>
      </div>

      <Section title={refund ? "Refund" : "Charge"}>
        <Facts
          items={[
            { label: "Record ID", value: <Mono className="text-ink">{p.id}</Mono> },
            { label: "Amount", value: <span className="tabular-nums">{signedCents(p.amountCents)}</span> },
            { label: "Description", value: <span className="font-normal text-ink-2">{p.description}</span> },
            { label: refund ? "Returned to" : "Payment method", value: p.method },
            { label: refund ? "Recorded" : "Created", value: <span className="tabular-nums">{formatDateTime(p.createdAt, tz)}</span> },
            ...(!refund ? [{ label: "Status", value: PAYMENT_ROW_META[p.status].label }] : []),
          ]}
        />
        <p className="mt-2.5 text-[12.5px] text-muted">Card details are held by Stripe. The preview stores only the masked label shown here.</p>
      </Section>

      <Section title="Linked records">
        <Facts
          items={[
            { label: refund ? "Refunded to" : "Payer", value: <TextLink href={`/admin/users?id=${p.userId}`}>{dir.name(p.userId)}</TextLink> },
            ...(booking
              ? [
                  { label: "Booking", value: <TextLink href={`/admin/bookings?id=${booking.id}`}>{`${subjectName(booking.subject)} · ${booking.id}`}</TextLink> },
                  { label: "Tutor", value: <TextLink href={`/admin/tutors?id=${booking.tutorId}`}>{dir.name(booking.tutorId)}</TextLink> },
                  { label: "Lesson", value: <span className="tabular-nums">{formatDateTime(booking.startUtc, tz)}</span> },
                ]
              : p.bookingId
                ? [{ label: "Booking", value: <Mono>{p.bookingId}</Mono> }]
                : [{ label: "Booking", value: <span className="font-normal text-muted">Not tied to a lesson</span> }]),
          ]}
        />
      </Section>

      {related.length > 1 && (
        <Section title="All records for this booking">
          <PaymentRows rows={related} tz={tz} />
        </Section>
      )}
    </div>
  );
}

function PaymentFooter({ payment: p }: { payment: Payment }) {
  const disputes = useApp((s) => s.disputes);
  const { can } = useStaff();
  const open = p.bookingId ? disputes.find((d) => d.bookingId === p.bookingId && isDisputeOpen(d)) : undefined;
  return (
    <div className="space-y-3">
      {!can("payments.refund") && <PermissionNotice permission="payments.refund">Refunding through a dispute decision requires</PermissionNotice>}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-muted">
          {open ? (
            <>
              Dispute {open.id} is {DISPUTE_STATUS_META[open.status].label.toLowerCase()}.
            </>
          ) : p.bookingId ? (
            "Refunds are issued by resolving a dispute on the booking."
          ) : (
            "Refunds for subscription and credit charges aren't simulated in this preview."
          )}
        </p>
        {open ? (
          <Button asChild size="sm" variant="secondary" className="shrink-0">
            <Link href={`/admin/disputes/${open.id}`}>
              <Gavel /> Open dispute
            </Link>
          </Button>
        ) : p.bookingId ? (
          <Button asChild size="sm" variant="secondary" className="shrink-0">
            <Link href={`/admin/bookings?id=${p.bookingId}`}>
              <BookOpen /> Open booking
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PayoutDetail({ payout: p }: { payout: Payout }) {
  const payouts = useApp((s) => s.payouts);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const others = React.useMemo(() => payouts.filter((x) => x.tutorId === p.tutorId && x.id !== p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [payouts, p]);

  return (
    <div className="divide-y divide-line">
      <div className="flex flex-wrap items-center gap-1.5 px-5 py-4">
        <StatusPill tone={PAYOUT_META[p.status].tone}>{PAYOUT_META[p.status].label}</StatusPill>
      </div>
      <Section title="Payout">
        <Facts
          items={[
            { label: "Payout ID", value: <Mono className="text-ink">{p.id}</Mono> },
            { label: "Tutor", value: <TextLink href={`/admin/tutors?id=${p.tutorId}`}>{dir.name(p.tutorId)}</TextLink> },
            { label: "Amount", value: <span className="tabular-nums">{formatCents(p.amountCents)}</span> },
            { label: "Status", value: PAYOUT_META[p.status].label },
            { label: p.status === "paid" ? "Arrived" : "Expected arrival", value: <span className="tabular-nums">{formatCalendarDate(p.arrivalDate)}</span> },
            { label: "Created", value: <span className="tabular-nums">{formatDateTime(p.createdAt, tz)}</span> },
          ]}
        />
        <p className="mt-2.5 text-[12.5px] text-muted">Bank transfers to tutors are handled by the payment processor in production. The preview shows sample payout records only.</p>
      </Section>
      <Section title="Other payouts to this tutor">
        {others.length === 0 ? (
          <p className="text-[13px] text-muted">No other payouts recorded.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {others.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/payments?id=${o.id}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] transition-colors hover:bg-canvas">
                  <span className="min-w-0">
                    <span className="block font-medium tabular-nums text-ink">{formatCents(o.amountCents)}</span>
                    <span className="block text-muted">Arrival {formatCalendarDate(o.arrivalDate)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <StatusPill tone={PAYOUT_META[o.status].tone}>{PAYOUT_META[o.status].label}</StatusPill>
                    <ArrowUpRight className="size-3.5 text-muted" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
