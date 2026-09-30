"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gavel } from "lucide-react";
import type { Booking, Dispute, DisputeStatus } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useNow, useViewerTimezone } from "@/lib/store/hooks";
import { subjectName } from "@/lib/data/catalog";
import { formatCents, formatDate, pluralize } from "@/lib/format";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Disclosure";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { ClearFilters, ExportButton, FilterSelect, Mono, PersonCell, SearchInput, StatusPill, Toolbar, centsToDecimal, formatAge, matches, useDirectory } from "./kit";
import { DISPUTE_REASON_LABEL, DISPUTE_STATUS_META, bookingPaid } from "./money";

type ReasonFilter = "all" | Dispute["reason"];

const TABS: DisputeStatus[] = ["open", "under_review", "awaiting_information", "escalated", "resolved", "rejected"];

const REASON_OPTIONS: { value: ReasonFilter; label: string }[] = [
  { value: "all", label: "Any reason" },
  ...(Object.keys(DISPUTE_REASON_LABEL) as Dispute["reason"][]).map((r) => ({ value: r, label: DISPUTE_REASON_LABEL[r] })),
];

const EMPTY_COPY: Record<DisputeStatus, string> = {
  open: "New disputes from learners and tutors land here first.",
  under_review: "Move a dispute here once someone is investigating it.",
  awaiting_information: "Disputes waiting on the learner or tutor to reply appear here.",
  escalated: "Disputes handed to an administrator appear here.",
  resolved: "Disputes closed with a refund or credit appear here.",
  rejected: "Disputes closed with no refund appear here.",
};

interface Row {
  d: Dispute;
  b: Booking | undefined;
  openedBy: string;
  other: string;
  paid: number;
}

export function DisputesView() {
  return (
    <PermissionGate permission="disputes.manage">
      <DisputesInner />
    </PermissionGate>
  );
}

function DisputesInner() {
  const disputes = useApp((s) => s.disputes);
  const bookings = useApp((s) => s.bookings);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const now = useNow(60_000);
  const router = useRouter();

  const [tab, setTab] = React.useState<DisputeStatus>("open");
  const [q, setQ] = React.useState("");
  const [reason, setReason] = React.useState<ReasonFilter>("all");

  const all = React.useMemo<Row[]>(() => {
    const byId = new Map(bookings.map((b) => [b.id, b]));
    return disputes.map((d) => {
      const b = byId.get(d.bookingId);
      const openerIsBooker = b ? d.openedBy === b.bookerId : true;
      const other = b ? (openerIsBooker ? dir.name(b.tutorId) : dir.name(b.bookerId)) : "—";
      return { d, b, openedBy: dir.name(d.openedBy), other, paid: b ? bookingPaid(b) : 0 };
    });
  }, [disputes, bookings, dir]);

  const searched = React.useMemo(
    () => all.filter((r) => (reason === "all" || r.d.reason === reason) && matches(q, r.d.id, r.d.bookingId, r.openedBy, r.other, r.b ? subjectName(r.b.subject) : undefined)),
    [all, reason, q],
  );
  const counts = React.useMemo(() => Object.fromEntries(TABS.map((s) => [s, searched.filter((r) => r.d.status === s).length])) as Record<DisputeStatus, number>, [searched]);
  // Oldest first: the longest-waiting dispute is at the top of every queue.
  const rows = React.useMemo(() => searched.filter((r) => r.d.status === tab).sort((a, b) => a.d.createdAt.localeCompare(b.d.createdAt)), [searched, tab]);

  const filtered = q.trim() !== "" || reason !== "all";
  const clear = () => {
    setQ("");
    setReason("all");
  };

  const columns: Column<Row>[] = [
    {
      key: "opened",
      header: "Opened",
      sortValue: (r) => r.d.createdAt,
      cell: (r) => (
        <span className="block whitespace-nowrap tabular-nums">
          <span className="block text-ink">{formatAge(now - new Date(r.d.createdAt).getTime())} ago</span>
          <span className="block text-[12px] text-muted">{formatDate(r.d.createdAt, tz)}</span>
        </span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      sortValue: (r) => DISPUTE_REASON_LABEL[r.d.reason],
      cell: (r) => (
        <PersonCell
          name={DISPUTE_REASON_LABEL[r.d.reason]}
          sub={
            <Link href={`/admin/disputes/${r.d.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[12px] text-muted underline-offset-4 hover:text-ink hover:underline" aria-label={`Open dispute ${r.d.id}`}>
              {r.d.id}
            </Link>
          }
        />
      ),
    },
    {
      key: "booking",
      header: "Booking",
      sortValue: (r) => r.b?.startUtc ?? "",
      cell: (r) =>
        r.b ? (
          <span className="block min-w-0">
            <span className="block truncate text-ink-2">
              {subjectName(r.b.subject)} · <span className="tabular-nums">{formatDate(r.b.startUtc, tz, { month: "short", day: "numeric" })}</span>
            </span>
            <Mono>{r.b.id}</Mono>
          </span>
        ) : (
          <Mono>{r.d.bookingId}</Mono>
        ),
    },
    { key: "openedBy", header: "Opened by", sortValue: (r) => r.openedBy, cell: (r) => <span className="block max-w-40 truncate">{r.openedBy}</span> },
    { key: "other", header: "Other party", sortValue: (r) => r.other, cell: (r) => <span className="block max-w-40 truncate">{r.other}</span>, hideOnMobile: true },
    { key: "stake", header: "At stake", align: "right", sortValue: (r) => r.paid, cell: (r) => <span className="font-medium text-ink">{r.paid ? formatCents(r.paid) : "Free lesson"}</span> },
    { key: "status", header: "Status", sortValue: (r) => r.d.status, cell: (r) => <StatusPill tone={DISPUTE_STATUS_META[r.d.status].tone}>{DISPUTE_STATUS_META[r.d.status].label}</StatusPill> },
  ];

  return (
    <>
      <PageHeader
        title="Disputes"
        description="Problems reported with a lesson. Work the oldest first; every note, status change and decision is written to the audit log."
        actions={
          <ExportButton
            filename="tutorlink-disputes"
            headers={["ID", "Opened (UTC)", "Status", "Reason", "Booking ID", "Subject", "Lesson start (UTC)", "Opened by", "Other party", "Amount paid", "Outcome", "Resolution amount"]}
            rows={() =>
              rows.map((r) => [
                r.d.id, r.d.createdAt, DISPUTE_STATUS_META[r.d.status].label, DISPUTE_REASON_LABEL[r.d.reason], r.d.bookingId, r.b ? subjectName(r.b.subject) : "",
                r.b?.startUtc ?? "", r.openedBy, r.other, centsToDecimal(r.paid), r.d.resolution?.outcome ?? "", r.d.resolution ? centsToDecimal(r.d.resolution.amountCents) : "",
              ])
            }
          />
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as DisputeStatus)}>
        <TabsList aria-label="Dispute status">
          {TABS.map((s) => (
            <TabsTrigger key={s} value={s} count={counts[s]}>
              {DISPUTE_STATUS_META[s].label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab}>
          <Toolbar summary={pluralize(rows.length, "dispute")}>
            <SearchInput value={q} onChange={setQ} placeholder="Search booking ID, dispute ID or person…" label="Search disputes" />
            <FilterSelect label="Reason" value={reason} onChange={setReason} options={REASON_OPTIONS} />
            <ClearFilters active={filtered} onClear={clear} />
          </Toolbar>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.d.id}
            onRowClick={(r) => router.push(`/admin/disputes/${r.d.id}`)}
            mobileTitle="reason"
            pageSize={12}
            empty={
              filtered ? (
                <EmptyState
                  icon={<Gavel />}
                  title="No disputes match these filters"
                  description="Try another booking ID or name, or clear the filters."
                  action={<Button variant="secondary" size="sm" onClick={clear}>Clear filters</Button>}
                />
              ) : (
                <EmptyState icon={<Gavel />} title={`No ${DISPUTE_STATUS_META[tab].label.toLowerCase()} disputes`} description={EMPTY_COPY[tab]} />
              )
            }
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
