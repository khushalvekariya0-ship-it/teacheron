"use client";

import * as React from "react";
import Link from "next/link";
import { CreditCard, Download, Lock, Plus, ReceiptText, RotateCcw, Wallet, BookOpenCheck } from "lucide-react";
import type { Booking, Payment, Tutor, User } from "@/lib/types";
import { PageHeader, RoleGate } from "@/components/dashboard/Shell";
import { Stagger, StaggerItem } from "@/components/motion";
import { StatTile } from "@/components/charts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, DetailRow } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Controls";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogClose } from "@/components/ui/Overlay";
import { EmptyState } from "@/components/ui/States";
import { useApp } from "@/lib/store";
import { useSession, useViewerTimezone, useWalletBalance } from "@/lib/store/hooks";
import { WalletDrawer, formatCredits } from "@/components/wallet/WalletDrawer";
import { formatCents, formatDate, formatDateTime, pluralize, tzAbbrev } from "@/lib/format";
import { subjectName } from "@/lib/data/catalog";
import { SITE } from "@/lib/site";
import { tutorFullName, useTutorMap } from "@/components/dashboard/shared/hooks";

type Tone = "neutral" | "success" | "warning" | "danger";

function statusMeta(p: Payment): { label: string; tone: Tone } {
  if (p.amountCents < 0) return { label: "Refund", tone: "neutral" };
  switch (p.status) {
    case "succeeded":
      return { label: "Paid", tone: "success" };
    case "pending":
      return { label: "Pending", tone: "warning" };
    case "failed":
      return { label: "Failed", tone: "danger" };
    case "refunded":
      return { label: "Refunded", tone: "neutral" };
    case "partially_refunded":
      return { label: "Partially refunded", tone: "warning" };
  }
}

function signedAmount(cents: number) {
  return cents < 0 ? `−${formatCents(-cents, { exact: true })}` : formatCents(cents, { exact: true });
}

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PaymentsView() {
  return (
    <RoleGate roles={["student", "parent"]}>
      <Inner />
    </RoleGate>
  );
}

type FilterKey = "all" | "charges" | "refunds";

function Inner() {
  const me = useSession() as User;
  const tz = useViewerTimezone();
  const payments = useApp((s) => s.payments);
  const bookings = useApp((s) => s.bookings);
  const tutorMap = useTutorMap();
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [receipt, setReceipt] = React.useState<Payment | null>(null);
  const balance = useWalletBalance();
  const [walletOpen, setWalletOpen] = React.useState(false);

  const bookingById = React.useMemo(() => new Map(bookings.map((b) => [b.id, b])), [bookings]);
  const mine = React.useMemo(() => payments.filter((p) => p.userId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [payments, me.id]);

  const summary = React.useMemo(() => {
    // Buying Study Credits isn't counted as "paid": the money is counted once, when the credits pay for a lesson.
    const charges = mine.filter((p) => p.kind !== "study_credits" && p.amountCents > 0 && ["succeeded", "partially_refunded", "refunded"].includes(p.status));
    const refundRows = mine.filter((p) => p.amountCents < 0);
    const refundedBookings = new Set(refundRows.map((p) => p.bookingId).filter(Boolean));
    // A charge marked "refunded" with no separate refund row was refunded in full on the original charge.
    const refundedOnCharge = charges.filter((p) => p.status === "refunded" && !(p.bookingId && refundedBookings.has(p.bookingId)));
    const paid = charges.reduce((s, p) => s + p.amountCents, 0);
    const refunds = refundRows.reduce((s, p) => s - p.amountCents, 0) + refundedOnCharge.reduce((s, p) => s + p.amountCents, 0);
    // Lessons with money still kept after refunds.
    const netByBooking = new Map<string, number>();
    const add = (id: string, cents: number) => netByBooking.set(id, (netByBooking.get(id) ?? 0) + cents);
    for (const p of charges) if (p.kind === "booking" && p.bookingId) add(p.bookingId, refundedOnCharge.includes(p) ? 0 : p.amountCents);
    for (const p of refundRows) if (p.bookingId) add(p.bookingId, p.amountCents);
    const lessonsPaid = [...netByBooking.values()].filter((v) => v > 0).length;
    const pending = mine.filter((p) => p.status === "pending" && p.amountCents > 0).reduce((s, p) => s + p.amountCents, 0);
    const methods = new Map<string, string>();
    for (const p of mine) if (p.method && !/original payment method/i.test(p.method) && !methods.has(p.method)) methods.set(p.method, p.createdAt);
    return { paid, refunds, refundCount: refundRows.length + refundedOnCharge.length, lessonsPaid, pending, methods: [...methods.entries()] };
  }, [mine]);

  const rows = filter === "all" ? mine : filter === "refunds" ? mine.filter((p) => p.amountCents < 0 || p.status === "refunded") : mine.filter((p) => p.amountCents > 0);

  const lessonLine = (p: Payment) => {
    const b = p.bookingId ? bookingById.get(p.bookingId) : undefined;
    if (!b) return null;
    return `${subjectName(b.subject)} · ${formatDate(b.startUtc, tz, { month: "short", day: "numeric" })}`;
  };

  const columns: Column<Payment>[] = [
    {
      key: "description",
      header: "Description",
      cell: (p) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-ink">{p.description}</span>
          {lessonLine(p) && <span className="block truncate text-[12.5px] font-normal text-muted">{lessonLine(p)}</span>}
        </span>
      ),
    },
    { key: "date", header: "Date", cell: (p) => <span className="whitespace-nowrap tabular-nums">{formatDate(p.createdAt, tz)}</span>, sortValue: (p) => p.createdAt },
    { key: "method", header: "Method", cell: (p) => <span className="whitespace-nowrap">{p.method}</span>, hideOnMobile: true },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (p) => <span className={p.amountCents < 0 ? "font-medium text-success" : "font-medium text-ink"}>{signedAmount(p.amountCents)}</span>,
      sortValue: (p) => p.amountCents,
    },
    {
      key: "status",
      header: "Status",
      cell: (p) => {
        const m = statusMeta(p);
        return (
          <Badge tone={m.tone} size="sm">
            {m.label}
          </Badge>
        );
      },
    },
    {
      key: "receipt",
      header: <span className="sr-only">Receipt</span>,
      align: "right",
      hideOnMobile: true,
      cell: (p) => (
        <Button
          variant="ghost"
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            setReceipt(p);
          }}
          aria-label={`View receipt for ${p.description}`}
        >
          <ReceiptText /> Receipt
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Payments" description="Charges, refunds and receipts for lessons booked from this account." />

      <Stagger className="space-y-5" stagger={0.06} amount={0.05}>
        <StaggerItem>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="Total paid" value={formatCents(summary.paid, { exact: summary.paid % 100 !== 0 })} icon={<Wallet />} hint={summary.pending ? `${formatCents(summary.pending)} authorized, not yet charged` : `Net ${formatCents(summary.paid - summary.refunds)} after refunds`} />
            <StatTile label="Refunds" value={formatCents(summary.refunds, { exact: summary.refunds % 100 !== 0 })} icon={<RotateCcw />} hint={summary.refundCount ? pluralize(summary.refundCount, "refund") : "No refunds"} />
            <StatTile label="Lessons paid" value={summary.lessonsPaid} icon={<BookOpenCheck />} hint="Trials with no charge aren't counted" />
          </div>
        </StaggerItem>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <StaggerItem>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">History</h2>
              <Segmented
                size="sm"
                label="Filter payments"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All", count: mine.length },
                  { value: "charges", label: "Charges", count: mine.filter((p) => p.amountCents > 0).length },
                  { value: "refunds", label: "Refunds", count: mine.filter((p) => p.amountCents < 0 || p.status === "refunded").length },
                ]}
              />
            </div>
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(p) => p.id}
              onRowClick={setReceipt}
              mobileTitle="description"
              empty={
                <EmptyState
                  icon={<CreditCard />}
                  title={mine.length ? "Nothing in this view" : "No payments yet"}
                  description={mine.length ? "Try a different filter." : "When you book a paid lesson, the charge and receipt appear here."}
                  action={
                    !mine.length && (
                      <Button asChild size="sm">
                        <Link href="/tutors">Find a tutor</Link>
                      </Button>
                    )
                  }
                />
              }
            />
          </StaggerItem>

          <StaggerItem className="space-y-5">
            <Card>
              <CardHeader title="Study wallet" description="Prepaid credits for one-tap booking." />
              <CardContent className="pt-3">
                <p className="font-heading text-[2rem] font-bold leading-none tracking-[-0.03em] tabular-nums text-ink">{formatCredits(balance)}</p>
                <p className="mt-2 text-[13px] leading-snug text-muted">Refunds for lessons paid with credits come back here.</p>
                <Button variant="cta" className="mt-4 w-full" onClick={() => setWalletOpen(true)}>
                  <Plus /> Add credits
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Payment methods" description="Ways you've paid on this account." />
              <CardContent className="pt-3">
                {summary.methods.length ? (
                  <ul className="space-y-2">
                    {summary.methods.map(([m, at]) => (
                      <li key={m} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                        <span className="grid h-7 w-10 place-items-center rounded-md border border-line bg-canvas text-ink-2">
                          <CreditCard className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13.5px] font-medium text-ink">{m}</span>
                          <span className="block text-[12px] text-muted">Last used {formatDate(at, tz)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-muted">Nothing yet. You&apos;ll choose a card, UPI or Study Credits when you book your first paid lesson.</p>
                )}
                <p className="mt-4 flex items-start gap-2 text-[12.5px] leading-relaxed text-muted">
                  <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Payments are handled by the payment gateway, never stored here. Test mode in this preview.
                </p>
              </CardContent>
            </Card>
          </StaggerItem>
        </div>
      </Stagger>

      <ReceiptDialog payment={receipt} booking={receipt?.bookingId ? bookingById.get(receipt.bookingId) : undefined} tutorMap={tutorMap} tz={tz} me={me} onClose={() => setReceipt(null)} />
      <WalletDrawer open={walletOpen} onOpenChange={setWalletOpen} />
    </div>
  );
}

function ReceiptDialog({ payment, booking, tutorMap, tz, me, onClose }: { payment: Payment | null; booking?: Booking; tutorMap: Map<string, Tutor>; tz: string; me: User; onClose: () => void }) {
  const tutor = booking ? tutorMap.get(booking.tutorId) : undefined;
  const meta = payment ? statusMeta(payment) : null;

  const download = () => {
    if (!payment) return;
    const lines = [
      `${SITE.legalName} — ${payment.amountCents < 0 ? "Refund receipt" : "Receipt"}`,
      `Receipt no.: ${payment.id.toUpperCase()}`,
      `Date: ${formatDateTime(payment.createdAt, tz)} ${tzAbbrev(tz, new Date(payment.createdAt))}`,
      `Billed to: ${me.firstName} ${me.lastName} <${me.email}>`,
      "",
      `Description: ${payment.description}`,
      ...(booking
        ? [
            `Lesson: ${subjectName(booking.subject)}${booking.type === "trial" ? " (trial)" : ""} with ${tutorFullName(tutor)}`,
            `Lesson date: ${formatDateTime(booking.startUtc, tz)}`,
            `Booking reference: ${booking.id}`,
          ]
        : []),
      `Payment method: ${payment.method}`,
      `Status: ${meta?.label}`,
      "",
      `Amount: ${signedAmount(payment.amountCents)} USD`,
      "",
      "Payments are processed by Stripe. Preview build — sample data, no real charge was made.",
    ];
    downloadText(`tutorlink-receipt-${payment.id}.txt`, lines.join("\n"));
  };

  return (
    <Dialog open={!!payment} onOpenChange={(o) => !o && onClose()}>
      {payment && meta && (
        <DialogContent title={payment.amountCents < 0 ? "Refund receipt" : "Receipt"} description={`Receipt no. ${payment.id.toUpperCase()}`}>
          <DialogBody>
            <div className="flex items-end justify-between gap-4 rounded-lg border border-line bg-canvas px-4 py-4">
              <div>
                <p className="text-[12px] text-muted">{payment.amountCents < 0 ? "Refunded" : "Amount"}</p>
                <p className="mt-1 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-ink">{signedAmount(payment.amountCents)}</p>
              </div>
              <Badge tone={meta.tone}>{meta.label}</Badge>
            </div>
            <dl className="mt-4 divide-y divide-line">
              <DetailRow label="Date">
                {formatDateTime(payment.createdAt, tz)} {tzAbbrev(tz, new Date(payment.createdAt))}
              </DetailRow>
              <DetailRow label="Description">{payment.description}</DetailRow>
              {booking && (
                <>
                  <DetailRow label="Lesson">
                    {subjectName(booking.subject)}
                    {booking.type === "trial" && " · Trial"}
                  </DetailRow>
                  <DetailRow label="Tutor">{tutorFullName(tutor)}</DetailRow>
                  <DetailRow label="Lesson date">{formatDateTime(booking.startUtc, tz)}</DetailRow>
                  {booking.discountCents > 0 && <DetailRow label="Discount">−{formatCents(booking.discountCents, { exact: true })}</DetailRow>}
                </>
              )}
              <DetailRow label="Payment method">{payment.method}</DetailRow>
              <DetailRow label="Billed to">
                {me.firstName} {me.lastName}
              </DetailRow>
            </dl>
            <p className="mt-4 text-[12.5px] text-muted">Payments are processed by Stripe. Preview build — sample data, no real charge was made.</p>
          </DialogBody>
          <DialogFooter>
            {booking && (
              <Button asChild variant="ghost">
                <Link href={`/dashboard/bookings/${booking.id}`}>View booking</Link>
              </Button>
            )}
            <Button variant="secondary" onClick={download}>
              <Download /> Download
            </Button>
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
