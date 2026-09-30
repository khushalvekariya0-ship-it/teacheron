"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, CircleAlert, Gavel, MapPin, Video } from "lucide-react";
import type { Booking, BookingStatus, BookingType, Payment } from "@/lib/types";
import type { BookingPolicy } from "@/lib/data/platform";
import { useApp } from "@/lib/store";
import { useNow, useViewerTimezone } from "@/lib/store/hooks";
import { availableTransitions, cancellationRefund, endMs, STATUS_META } from "@/lib/booking";
import { subjectName } from "@/lib/data/catalog";
import { REVIEWS } from "@/lib/data/reviews";
import { formatCents, formatDateTime, formatDuration, formatTime, percentOf, pluralize, tzAbbrev } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/domain/Badges";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Disclosure";
import { Sheet, SheetContent } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import {
  ClearFilters, ExportButton, Facts, FilterSelect, Mono, PermissionButton, PermissionNotice, RANGE_OPTIONS, ReasonDialog, SearchInput, Section, StatusPill,
  TextLink, Timeline, Toolbar, centsToDecimal, inRange, matches, settledNet, useDirectory, useStaff, useSticky, useUrlParam, type Directory, type RangePreset,
} from "./kit";
import {
  DISPUTE_REASON_LABEL, DISPUTE_STATUS_META, PAYMENT_ROW_META, adminTransitionLabel, attentionReason, bookingPaid, isDestructiveTransition,
  isDisputeOpen, refundedCents, signedCents,
} from "./money";

type TabKey = "upcoming" | "attention" | "all";
type StatusFilter = "all" | BookingStatus;
type TypeFilter = "all" | BookingType;

const TABS: { value: TabKey; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "attention", label: "Needs attention" },
  { value: "all", label: "All" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Any status" },
  ...(Object.keys(STATUS_META) as BookingStatus[]).map((s) => ({ value: s, label: STATUS_META[s].label })),
];

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "Trial and regular" },
  { value: "trial", label: "Trial lessons" },
  { value: "regular", label: "Regular lessons" },
];

const LIVE: BookingStatus[] = ["pending", "confirmed", "in_progress"];

function inTab(b: Booking, tab: TabKey, now: number): boolean {
  if (tab === "upcoming") return LIVE.includes(b.status) && endMs(b) > now;
  if (tab === "attention") return attentionReason(b, now) !== null;
  return true;
}

const modeLabel = (b: Booking) => (b.mode === "online" ? "Online" : "In person");
const typeLabel = (b: Booking) => (b.type === "trial" ? "Trial" : "Regular");

export function BookingsView() {
  return (
    <PermissionGate permission="bookings.manage">
      <BookingsInner />
    </PermissionGate>
  );
}

function BookingsInner() {
  const bookings = useApp((s) => s.bookings);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const now = useNow(60_000);

  const [tab, setTab] = React.useState<TabKey>("upcoming");
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [type, setType] = React.useState<TypeFilter>("all");
  const [range, setRange] = React.useState<RangePreset>("all");
  const [openId, setOpenId] = useUrlParam("id");

  const searched = React.useMemo(
    () =>
      bookings.filter(
        (b) =>
          (status === "all" || b.status === status) &&
          (type === "all" || b.type === type) &&
          inRange(b.startUtc, range, now) &&
          matches(q, dir.name(b.tutorId), dir.name(b.bookerId), b.childId ? dir.name(b.childId) : undefined, b.id, subjectName(b.subject)),
      ),
    [bookings, status, type, range, now, q, dir],
  );
  const counts = React.useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.value, searched.filter((b) => inTab(b, t.value, now)).length])) as Record<TabKey, number>,
    [searched, now],
  );
  const rows = React.useMemo(() => {
    const list = searched.filter((b) => inTab(b, tab, now));
    // Upcoming and attention queues read soonest-first; the full list reads newest-first.
    return list.sort((a, b) => (tab === "all" ? b.startUtc.localeCompare(a.startUtc) : a.startUtc.localeCompare(b.startUtc)));
  }, [searched, tab, now]);

  const filtered = q.trim() !== "" || status !== "all" || type !== "all" || range !== "all";

  const columns: Column<Booking>[] = [
    {
      key: "when",
      header: "When",
      sortValue: (b) => b.startUtc,
      cell: (b) => (
        <span className="block whitespace-nowrap tabular-nums">
          <span className="block text-ink">{formatDateTime(b.startUtc, tz)}</span>
          <span className="block text-[12px] text-muted">{formatDuration(b.durationMin)}</span>
        </span>
      ),
    },
    {
      key: "subject",
      header: "Subject",
      sortValue: (b) => subjectName(b.subject),
      cell: (b) => (
        <PersonCellLike
          title={subjectName(b.subject)}
          sub={
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenId(b.id);
              }}
              className="font-mono text-[12px] text-muted underline-offset-4 hover:text-ink hover:underline"
              aria-label={`Open booking ${b.id}`}
            >
              {b.id}
            </button>
          }
        />
      ),
    },
    { key: "tutor", header: "Tutor", sortValue: (b) => dir.name(b.tutorId), cell: (b) => <span className="block max-w-40 truncate">{dir.name(b.tutorId)}</span> },
    {
      key: "booker",
      header: "Booked by",
      sortValue: (b) => dir.name(b.bookerId),
      cell: (b) => <PersonCellLike title={dir.name(b.bookerId)} sub={b.childId ? `for ${dir.name(b.childId)}` : undefined} plain />,
    },
    {
      key: "type",
      header: "Type",
      sortValue: (b) => `${b.type}${b.mode}`,
      hideOnMobile: true,
      cell: (b) => (
        <span className="block whitespace-nowrap">
          <span className="block">{typeLabel(b)}</span>
          <span className="block text-[12px] text-muted">{modeLabel(b)}</span>
        </span>
      ),
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      sortValue: (b) => bookingPaid(b),
      cell: (b) => (
        <span className="block whitespace-nowrap">
          <span className="block text-ink">{bookingPaid(b) === 0 ? "Free" : formatCents(bookingPaid(b))}</span>
          {b.discountCents > 0 && <span className="block text-[12px] text-muted">−{formatCents(b.discountCents)} coupon</span>}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (b) => STATUS_META[b.status].label,
      cell: (b) => {
        const reason = attentionReason(b, now);
        return (
          <span className="flex flex-col items-start gap-1">
            <BookingStatusBadge status={b.status} />
            {reason && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] text-warning">
                <CircleAlert className="size-3" aria-hidden /> {reason}
              </span>
            )}
          </span>
        );
      },
    },
    { key: "payment", header: "Payment", sortValue: (b) => b.paymentStatus, cell: (b) => <PaymentStatusBadge status={b.paymentStatus} /> },
  ];

  const open = bookings.find((b) => b.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Every lesson booked on TutorLink. Admin status changes follow the booking policy and are written to the booking history and the audit log."
        actions={
          <ExportButton
            filename="tutorlink-bookings"
            headers={["ID", "Start (UTC)", "Duration (min)", "Subject", "Tutor", "Booked by", "Learner", "Type", "Mode", "List price", "Discount", "Charged", "Platform fee", "Status", "Payment status"]}
            rows={() =>
              rows.map((b) => [
                b.id, b.startUtc, b.durationMin, subjectName(b.subject), dir.name(b.tutorId), dir.name(b.bookerId), b.childId ? dir.name(b.childId) : "",
                b.type, b.mode, centsToDecimal(b.priceCents), centsToDecimal(b.discountCents), centsToDecimal(bookingPaid(b)), centsToDecimal(b.platformFeeCents),
                STATUS_META[b.status].label, b.paymentStatus,
              ])
            }
          />
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList aria-label="Booking queues">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} count={counts[t.value]}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab}>
          <Toolbar summary={pluralize(rows.length, "booking")}>
            <SearchInput value={q} onChange={setQ} placeholder="Search tutor, booker, learner or ID…" label="Search bookings" />
            <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
            <FilterSelect label="Lesson type" value={type} onChange={setType} options={TYPE_OPTIONS} />
            <FilterSelect label="Lesson date" value={range} onChange={setRange} options={RANGE_OPTIONS} />
            <ClearFilters
              active={filtered}
              onClear={() => {
                setQ("");
                setStatus("all");
                setType("all");
                setRange("all");
              }}
            />
          </Toolbar>

          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(b) => b.id}
            onRowClick={(b) => setOpenId(b.id)}
            mobileTitle="subject"
            pageSize={12}
            empty={
              <EmptyState
                icon={<BookOpen />}
                title={filtered ? "No bookings match these filters" : tab === "attention" ? "Nothing needs attention" : tab === "upcoming" ? "No upcoming lessons" : "No bookings yet"}
                description={
                  filtered
                    ? "Try another name or date range, or clear the filters."
                    : tab === "attention"
                      ? "Disputes, failed payments, unconfirmed requests and lessons that ended without being closed out show up here."
                      : "Bookings appear here as learners book lessons."
                }
                action={filtered ? <Button variant="secondary" size="sm" onClick={() => { setQ(""); setStatus("all"); setType("all"); setRange("all"); }}>Clear filters</Button> : undefined}
              />
            }
          />
        </TabsContent>
      </Tabs>

      <BookingSheet booking={open} onClose={() => setOpenId(null)} onOpen={setOpenId} />
    </>
  );
}

function PersonCellLike({ title, sub, plain }: { title: React.ReactNode; sub?: React.ReactNode; plain?: boolean }) {
  return (
    <span className="block min-w-0">
      <span className={cn("block max-w-44 truncate", plain ? "text-ink-2" : "font-medium text-ink")}>{title}</span>
      {sub && <span className="block max-w-44 truncate text-[12px] text-muted">{sub}</span>}
    </span>
  );
}

/* ─── Shared pieces (also used by the dispute page) ──────────────────────────── */

/** Every payment row for a booking — charges and refunds — linked to the payments page. */
export function PaymentRows({ rows, tz, empty = "No payment records for this booking." }: { rows: Payment[]; tz: string; empty?: string }) {
  if (!rows.length) return <p className="text-[13px] text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {rows.map((p) => (
        <li key={p.id}>
          <Link href={`/admin/payments?id=${p.id}`} className="flex items-start justify-between gap-3 px-3.5 py-2.5 text-[13px] transition-colors hover:bg-canvas">
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{p.description}</span>
              <span className="block truncate text-muted">
                {formatDateTime(p.createdAt, tz)} · {p.method}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-medium tabular-nums text-ink">{signedCents(p.amountCents)}</span>
              <span className="block text-[12px] text-muted">{p.amountCents < 0 ? "Refund" : PAYMENT_ROW_META[p.status].label}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const EVENT_TONE = (to: BookingStatus): "default" | "accent" | "success" | "warning" | "danger" =>
  to === "completed" ? "success" : to === "confirmed" || to === "in_progress" ? "accent" : to === "disputed" || to === "pending" ? "warning" : STATUS_META[to].tone === "danger" ? "danger" : "default";

/** Booking lifecycle, oldest first, with the people who made each change. */
export function bookingHistoryItems(b: Booking, dir: Directory, tz: string) {
  return b.history.map((e, i) => ({
    key: `${e.at}-${i}`,
    tone: EVENT_TONE(e.to),
    title: e.from ? `${STATUS_META[e.from].label} → ${STATUS_META[e.to].label}` : `Created · ${STATUS_META[e.to].label}`,
    meta: `${dir.name(e.by)} · ${formatDateTime(e.at, tz)}`,
    body: e.note,
  }));
}

/* ─── Detail drawer ──────────────────────────────────────────────────────────── */

function BookingSheet({ booking: current, onClose, onOpen }: { booking: Booking | null; onClose: () => void; onOpen: (id: string) => void }) {
  const booking = useSticky(current);
  const dir = useDirectory();
  return (
    <Sheet open={!!current} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        title={booking ? `${subjectName(booking.subject)} with ${dir.name(booking.tutorId)}` : "Booking"}
        description={booking ? `${typeLabel(booking)} lesson · ${booking.id}` : undefined}
        className="sm:w-[34rem]"
        footer={booking ? <BookingActions booking={booking} /> : undefined}
      >
        {booking && <BookingDetail booking={booking} onOpen={onOpen} />}
      </SheetContent>
    </Sheet>
  );
}

function BookingDetail({ booking: b, onOpen }: { booking: Booking; onOpen: (id: string) => void }) {
  const bookings = useApp((s) => s.bookings);
  const payments = useApp((s) => s.payments);
  const disputes = useApp((s) => s.disputes);
  const localReviews = useApp((s) => s.reviews);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const now = useNow(60_000);

  const data = React.useMemo(() => {
    const rows = payments.filter((p) => p.bookingId === b.id).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
    const linkedDisputes = disputes.filter((d) => d.bookingId === b.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    const movedTo = bookings.find((x) => x.rescheduledFromId === b.id);
    const review = b.reviewId ? (localReviews.find((r) => r.id === b.reviewId) ?? REVIEWS.find((r) => r.id === b.reviewId)) : undefined;
    return { rows, linkedDisputes, movedTo, review };
  }, [payments, disputes, bookings, localReviews, b]);

  const paid = bookingPaid(b);
  const net = settledNet(data.rows);
  const reason = attentionReason(b, now);
  const child = b.childId ? dir.children.find((c) => c.id === b.childId) : undefined;
  const end = new Date(endMs(b)).toISOString();

  return (
    <div className="divide-y divide-line">
      <div className="space-y-3 px-5 py-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <BookingStatusBadge status={b.status} />
          <PaymentStatusBadge status={b.paymentStatus} />
        </div>
        {reason && (
          <p className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3.5 py-2.5 text-[13px] text-warning">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> Needs attention: {reason}.
          </p>
        )}
        {data.linkedDisputes.map((d) => (
          <Link
            key={d.id}
            href={`/admin/disputes/${d.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas px-3.5 py-2.5 text-[13px] transition-colors hover:border-line-strong"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Gavel className="size-4 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 truncate">
                <span className="font-medium text-ink">Dispute {d.id}</span>
                <span className="text-muted"> · {DISPUTE_REASON_LABEL[d.reason]}</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <StatusPill tone={DISPUTE_STATUS_META[d.status].tone}>{DISPUTE_STATUS_META[d.status].label}</StatusPill>
              <ArrowUpRight className="size-3.5 text-muted" aria-hidden />
            </span>
          </Link>
        ))}
      </div>

      <Section title="Lesson">
        <Facts
          items={[
            { label: "Booking ID", value: <Mono className="text-ink">{b.id}</Mono> },
            { label: "Starts", value: <span className="tabular-nums">{formatDateTime(b.startUtc, tz)} {tzAbbrev(tz, new Date(b.startUtc))}</span> },
            { label: "Ends", value: <span className="tabular-nums">{formatTime(end, tz)}</span> },
            { label: "Duration", value: formatDuration(b.durationMin) },
            { label: "Type", value: typeLabel(b) },
            {
              label: "Mode",
              value: (
                <span className="inline-flex items-center gap-1.5">
                  {b.mode === "online" ? <Video className="size-3.5 text-muted" aria-hidden /> : <MapPin className="size-3.5 text-muted" aria-hidden />}
                  {modeLabel(b)}
                </span>
              ),
            },
            ...(b.mode === "online" ? [{ label: "Meeting link", value: b.meetingUrl ? "Issued — shown to participants shortly before the start" : "Not issued" }] : []),
            ...(b.locationNote ? [{ label: "Location", value: <span className="font-normal text-ink-2">{b.locationNote}</span> }] : []),
            ...(b.notes ? [{ label: "Lesson notes", value: <span className="font-normal text-ink-2">{b.notes}</span> }] : []),
            ...(b.rescheduledFromId
              ? [{ label: "Rescheduled from", value: <LinkButton onClick={() => onOpen(b.rescheduledFromId!)}>{b.rescheduledFromId}</LinkButton> }]
              : []),
            ...(data.movedTo ? [{ label: "Rescheduled to", value: <LinkButton onClick={() => onOpen(data.movedTo!.id)}>{data.movedTo.id}</LinkButton> }] : []),
            { label: "Booked", value: <span className="tabular-nums">{formatDateTime(b.createdAt, tz)}</span> },
          ]}
        />
      </Section>

      <Section title="People">
        <Facts
          items={[
            { label: "Tutor", value: <TextLink href={`/admin/tutors?id=${b.tutorId}`}>{dir.name(b.tutorId)}</TextLink> },
            { label: "Booked by", value: <TextLink href={`/admin/users?id=${b.bookerId}`}>{dir.name(b.bookerId)}</TextLink> },
            ...(b.childId ? [{ label: "Learner", value: child ? `${child.firstName} · ${child.grade === "college" || child.grade === "adult" ? child.grade : `Grade ${child.grade}`}` : dir.name(b.childId) }] : []),
          ]}
        />
      </Section>

      <Section title="Money">
        <Facts
          items={[
            { label: "List price", value: <span className="tabular-nums">{formatCents(b.priceCents)}</span> },
            { label: "Discount", value: <span className="tabular-nums">{b.discountCents ? `−${formatCents(b.discountCents)}` : "None"}</span> },
            { label: b.paymentStatus === "authorized" ? "Authorized (not captured)" : "Booking total", value: <span className="tabular-nums">{paid === 0 ? "Nothing (free lesson)" : formatCents(paid)}</span> },
            { label: "Platform fee (commission)", value: <span className="tabular-nums">{formatCents(b.platformFeeCents)}</span> },
            { label: "Refunded", value: <span className="tabular-nums">{formatCents(refundedCents(data.rows))}</span> },
            { label: "Net settled", value: <span className="tabular-nums">{formatCents(net.net)}</span> },
          ]}
        />
      </Section>

      <Section title="Payments" description="Charges and refunds recorded for this booking.">
        <PaymentRows rows={data.rows} tz={tz} empty={b.paymentStatus === "authorized" ? "Card authorized — no charge captured yet." : "No payment records for this booking."} />
      </Section>

      <Section title="History">
        <Timeline items={bookingHistoryItems(b, dir, tz)} />
      </Section>

      {b.reviewId && (
        <Section title="Review">
          <Link href={`/admin/reviews?id=${b.reviewId}`} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5 text-[13px] transition-colors hover:bg-canvas">
            <span className="min-w-0">
              <span className="block font-medium text-ink">{data.review ? `${data.review.rating} of 5 stars · ${data.review.authorName}` : `Review ${b.reviewId}`}</span>
              {data.review && <span className="block truncate text-muted">{data.review.body}</span>}
            </span>
            <ArrowUpRight className="size-3.5 shrink-0 text-muted" aria-hidden />
          </Link>
        </Section>
      )}
    </div>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="font-mono text-[12px] font-medium text-ink underline-offset-4 hover:underline">
      {children}
    </button>
  );
}

/* ─── Admin transitions ──────────────────────────────────────────────────────── */

/**
 * Money an admin transition would move, mirroring the store: refunds only apply to captured payments
 * ("paid"); an authorization hold is released instead. Staff need payments.refund when this is > 0.
 */
function transitionRefund(b: Booking, to: BookingStatus, now: number, policy: BookingPolicy): { cents: number; rule?: string } {
  const paid = bookingPaid(b);
  const captured = b.paymentStatus === "paid";
  if (to === "cancelled_by_student" || to === "cancelled_by_tutor") {
    const res = cancellationRefund(b, "admin", now, policy);
    return { cents: captured ? res.refundCents : 0, rule: res.rule };
  }
  if (to === "no_show_tutor") return { cents: captured ? percentOf(paid, policy.tutorNoShowRefundPercent) : 0, rule: `Tutor no-show — ${policy.tutorNoShowRefundPercent}% refund.` };
  if (to === "no_show_student") return { cents: captured ? percentOf(paid, policy.studentNoShowRefundPercent) : 0, rule: `Student no-show — ${policy.studentNoShowRefundPercent}% refund.` };
  return { cents: 0 };
}

/** Plain-language consequence of an admin transition, computed from the same rules the store applies. */
function consequence(b: Booking, to: BookingStatus, now: number, policy: BookingPolicy, refunded: number): { summary: string; refundCents: number } {
  const paid = bookingPaid(b);
  const { cents, rule } = transitionRefund(b, to, now, policy);
  const held = b.paymentStatus === "authorized" && paid > 0;
  const lead = cents > 0 && rule ? `${rule} ` : "";
  const money =
    cents > 0 ? `${formatCents(cents)} goes back to the original payment method.` : held ? "Nothing was captured, so no refund is due." : paid === 0 ? "Nothing was charged for this lesson." : "No refund is issued.";
  switch (to) {
    case "confirmed":
      return { summary: held ? `Captures the authorized ${formatCents(paid)} and confirms the lesson for both people.` : "Confirms the lesson for both people.", refundCents: 0 };
    case "cancelled_by_student":
    case "cancelled_by_tutor":
      if (held) return { summary: `Releases the ${formatCents(paid)} card authorization — nothing was captured. The booker is notified.`, refundCents: 0 };
      return { summary: `${lead}${money} The booker is notified.`, refundCents: cents };
    case "no_show_tutor":
      return {
        summary: `${lead}${money}${policy.tutorNoShowCreditCents > 0 ? ` The booker is also told ${formatCents(policy.tutorNoShowCreditCents)} platform credit was added (credit balances aren't simulated in this preview).` : ""}`,
        refundCents: cents,
      };
    case "no_show_student":
      return { summary: `${lead}${money} The booker is notified.`, refundCents: cents };
    case "completed":
      return b.status === "disputed"
        ? { summary: "Closes the booking as completed with no refund. The dispute record itself isn't changed.", refundCents: 0 }
        : { summary: "Marks the lesson as delivered and asks the booker for a review. No refund is issued.", refundCents: 0 };
    case "refunded":
      return {
        summary:
          refunded > 0
            ? `Closes the booking as refunded. ${formatCents(refunded)} is already recorded as refunded; this change doesn't create a new payment record.`
            : "Closes the booking as refunded. No refund is recorded for this booking and this change doesn't create one.",
        refundCents: 0,
      };
    default:
      return { summary: `The booking becomes ${STATUS_META[to].label.toLowerCase()}.`, refundCents: 0 };
  }
}

function BookingActions({ booking: b }: { booking: Booking }) {
  const transition = useApp((s) => s.transitionBooking);
  const policy = useApp((s) => s.policy);
  const payments = useApp((s) => s.payments);
  const disputes = useApp((s) => s.disputes);
  const { can } = useStaff();
  const now = useNow(30_000);
  const [pending, setPending] = React.useState<BookingStatus | null>(null);
  const chosen = useSticky(pending);

  const openDispute = disputes.find((d) => d.bookingId === b.id && isDisputeOpen(d));
  const refunded = refundedCents(payments.filter((p) => p.bookingId === b.id));
  // Disputed lessons are refunded only through a dispute decision; with an open dispute, everything goes through it.
  const shown = b.status === "disputed" && openDispute ? [] : availableTransitions(b, "admin", now, policy).filter((to) => !(b.status === "disputed" && to === "refunded"));
  const movesMoney = (to: BookingStatus) => transitionRefund(b, to, now, policy).cents > 0;
  const lacksRefund = !can("payments.refund") && shown.some(movesMoney);

  const info = chosen ? consequence(b, chosen, now, policy, refunded) : null;

  return (
    <div className="space-y-3">
      {openDispute && b.status === "disputed" ? (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-muted">Refund or close this booking by resolving dispute {openDispute.id}.</p>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/admin/disputes/${openDispute.id}`}>
              <Gavel /> Open dispute
            </Link>
          </Button>
        </div>
      ) : shown.length === 0 ? (
        <p className="text-[13px] text-muted">No admin changes are available for a {STATUS_META[b.status].label.toLowerCase()} booking right now.</p>
      ) : (
        <>
          {lacksRefund && <PermissionNotice permission="payments.refund">Changes that refund the booker need</PermissionNotice>}
          {b.status === "disputed" && <p className="text-[13px] text-muted">Refunds for disputed lessons are issued by resolving a dispute.</p>}
          <div className="flex flex-wrap justify-end gap-2">
            {shown.map((to) => (
              <PermissionButton
                key={to}
                permission={movesMoney(to) ? "payments.refund" : "bookings.manage"}
                size="sm"
                variant={isDestructiveTransition(to) ? "danger-outline" : to === "confirmed" || to === "completed" ? "primary" : "secondary"}
                onClick={() => setPending(to)}
              >
                {adminTransitionLabel(b.status, to)}
              </PermissionButton>
            ))}
          </div>
        </>
      )}

      <ReasonDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={chosen ? `${adminTransitionLabel(b.status, chosen)}?` : "Change booking"}
        description={chosen ? `${subjectName(b.subject)} · ${b.id} will change from ${STATUS_META[b.status].label.toLowerCase()} to ${STATUS_META[chosen].label.toLowerCase()}.` : undefined}
        label="Note"
        hint="Saved to the booking history. The change itself is written to the audit log."
        placeholder="e.g. Tutor emailed support — family illness, can't attend"
        confirmLabel={chosen ? adminTransitionLabel(b.status, chosen) : "Confirm"}
        tone={chosen && isDestructiveTransition(chosen) ? "danger" : "default"}
        onConfirm={(note) => {
          if (!chosen) return false;
          const res = transition(b.id, chosen, note);
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          toast.success(`Booking ${STATUS_META[chosen].label.toLowerCase()}`, { description: info?.refundCents ? `${formatCents(info.refundCents)} refund recorded.` : "Recorded in the booking history." });
          return true;
        }}
      >
        {info && (
          <InlineAlert tone={info.refundCents ? "warning" : "info"} title={info.refundCents ? `Refund: ${formatCents(info.refundCents)}` : "What happens"}>
            {info.summary}
          </InlineAlert>
        )}
      </ReasonDialog>
    </div>
  );
}
