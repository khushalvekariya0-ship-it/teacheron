"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, CircleX, ExternalLink, FileCheck2, FileImage, FileText, Lock, PlayCircle } from "lucide-react";
import type { Tutor, VerificationKind, VerificationRequest, VerificationStatus } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useNow, useViewerTimezone } from "@/lib/store/hooks";
import { TUTOR_CATEGORY_LABEL } from "@/lib/data/catalog";
import { formatDate, formatDateTime, pluralize } from "@/lib/format";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Disclosure";
import { ConfirmDialog, Sheet, SheetContent } from "@/components/ui/Overlay";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { VERIFICATION_LABEL, VerificationStatusBadge } from "@/components/domain/Badges";
import { cn } from "@/lib/utils";
import {
  ClearFilters, Facts, FilterSelect, MiniStat, PermissionButton, ReasonDialog, RowOpen, SearchInput, Section, TextLink, Timeline, Toolbar, formatAge,
  fullName, matches, useDirectory, useSticky, useUrlParam,
} from "./kit";

/** Queue target used to flag slow reviews. A UI setting for the preview, not a published SLA. */
const REVIEW_TARGET_HOURS = 48;
const HOUR = 3_600_000;

type TabKey = "submitted" | "under_review" | "verified" | "rejected" | "expired";
const TABS: { value: TabKey; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

const KIND_OPTIONS: { value: "all" | VerificationKind; label: string }[] = [
  { value: "all", label: "Any check" },
  { value: "identity", label: "Identity" },
  { value: "education", label: "Education" },
  { value: "certification", label: "Teaching certification" },
  { value: "background", label: "Background screening" },
];

const isOpen = (s: VerificationStatus) => s === "submitted" || s === "under_review";

export function VerificationView() {
  return (
    <PermissionGate permission="tutors.verify">
      <VerificationInner />
    </PermissionGate>
  );
}

function VerificationInner() {
  const requests = useApp((s) => s.verificationRequests);
  const dir = useDirectory();
  const now = useNow(60_000);
  const tz = useViewerTimezone();
  const [openId, setOpenId] = useUrlParam("id");

  // Deep links open the tab that holds the record.
  const linked = requests.find((r) => r.id === openId);
  const [tab, setTab] = React.useState<TabKey>((linked?.status as TabKey | undefined) ?? "submitted");
  const [lastLinked, setLastLinked] = React.useState(openId);
  if (lastLinked !== openId) {
    setLastLinked(openId);
    if (linked && linked.status !== tab && linked.status !== "not_started") setTab(linked.status as TabKey);
  }
  const [q, setQ] = React.useState("");
  const [kind, setKind] = React.useState<"all" | VerificationKind>("all");

  const searched = React.useMemo(
    () => requests.filter((r) => matches(q, dir.name(r.tutorId), r.id, r.tutorId) && (kind === "all" || r.kind === kind)),
    [requests, q, kind, dir],
  );
  const counts = React.useMemo(() => Object.fromEntries(TABS.map((t) => [t.value, searched.filter((r) => r.status === t.value).length])) as Record<TabKey, number>, [searched]);
  const rows = React.useMemo(() => {
    const list = searched.filter((r) => r.status === tab);
    // Open queues: oldest first. Decided: most recent decision first.
    return isOpen(tab) ? list.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)) : list.sort((a, b) => (b.reviewedAt ?? b.submittedAt).localeCompare(a.reviewedAt ?? a.submittedAt));
  }, [searched, tab]);

  const stats = React.useMemo(() => {
    const open = requests.filter((r) => isOpen(r.status));
    const ages = open.map((r) => now - new Date(r.submittedAt).getTime());
    return {
      waiting: open.length,
      overdue: ages.filter((a) => a > REVIEW_TARGET_HOURS * HOUR).length,
      oldest: ages.length ? Math.max(...ages) : 0,
      decided30: requests.filter((r) => (r.status === "verified" || r.status === "rejected") && r.reviewedAt && now - new Date(r.reviewedAt).getTime() <= 30 * 24 * HOUR).length,
    };
  }, [requests, now]);

  const filtered = q.trim() !== "" || kind !== "all";
  const visibleTabs = TABS.filter((t) => t.value !== "expired" || requests.some((r) => r.status === "expired"));

  const columns: Column<VerificationRequest>[] = [
    {
      key: "tutor",
      header: "Tutor",
      sortValue: (r) => dir.name(r.tutorId),
      cell: (r) => {
        const t = dir.tutorById.get(r.tutorId);
        return (
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar name={dir.name(r.tutorId)} tone={t?.tone} size="sm" className="hidden md:inline-flex" />
            <span className="min-w-0">
              <RowOpen onOpen={() => setOpenId(r.id)} label={`Review ${VERIFICATION_LABEL[r.kind].toLowerCase()} for ${dir.name(r.tutorId)}`} className="block truncate font-medium text-ink">{dir.name(r.tutorId)}</RowOpen>
              <span className="block truncate text-[12px] text-muted">{t ? `${t.city}, ${t.state}` : r.tutorId}</span>
            </span>
          </span>
        );
      },
    },
    { key: "kind", header: "Check", sortValue: (r) => r.kind, cell: (r) => VERIFICATION_LABEL[r.kind] },
    { key: "docs", header: "Documents", align: "right", sortValue: (r) => r.documents.length, cell: (r) => r.documents.length },
    { key: "submitted", header: "Submitted", sortValue: (r) => r.submittedAt, cell: (r) => <span className="tabular-nums">{formatDateTime(r.submittedAt, tz)}</span> },
    isOpen(tab)
      ? {
          key: "age",
          header: "Waiting",
          sortValue: (r) => now - new Date(r.submittedAt).getTime(),
          cell: (r) => <AgeCell ms={now - new Date(r.submittedAt).getTime()} />,
        }
      : {
          key: "decided",
          header: "Decided",
          sortValue: (r) => r.reviewedAt ?? "",
          cell: (r) => (r.reviewedAt ? <span className="tabular-nums">{formatDate(r.reviewedAt, tz)} · {dir.name(r.reviewedBy)}</span> : "—"),
        },
    { key: "status", header: "Status", sortValue: (r) => r.status, cell: (r) => <VerificationStatusBadge status={r.status} /> },
  ];

  const open = requests.find((r) => r.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Verification"
        description={`Review identity, education, certification and background documents. Oldest first; requests waiting over ${REVIEW_TARGET_HOURS} hours are flagged.`}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Waiting for review" value={stats.waiting} />
        <MiniStat label={`Over ${REVIEW_TARGET_HOURS} h`} value={stats.overdue} tone={stats.overdue ? "warning" : undefined} hint={stats.overdue ? "Prioritise these" : "Within target"} />
        <MiniStat label="Oldest waiting" value={stats.waiting ? formatAge(stats.oldest) : "—"} />
        <MiniStat label="Decided (30 days)" value={stats.decided30} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList aria-label="Filter by status">
          {visibleTabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} count={counts[t.value]}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab}>
          <Toolbar summary={pluralize(rows.length, "request")}>
            <SearchInput value={q} onChange={setQ} placeholder="Search tutor or request ID…" label="Search verification requests" />
            <FilterSelect label="Check type" value={kind} onChange={setKind} options={KIND_OPTIONS} />
            <ClearFilters
              active={filtered}
              onClear={() => {
                setQ("");
                setKind("all");
              }}
            />
          </Toolbar>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            onRowClick={(r) => setOpenId(r.id)}
            empty={
              <EmptyState
                icon={<FileCheck2 />}
                title={filtered ? "No requests match these filters" : isOpen(tab) ? "Queue is clear" : `No ${TABS.find((t) => t.value === tab)!.label.toLowerCase()} requests`}
                description={filtered ? "Clear the search or check type to see more." : isOpen(tab) ? "New submissions from tutors will appear here, oldest first." : "Decisions appear here once requests are reviewed."}
              />
            }
          />
        </TabsContent>
      </Tabs>

      <ReviewSheet request={open} onClose={() => setOpenId(null)} />
    </>
  );
}

function AgeCell({ ms }: { ms: number }) {
  const over = ms > REVIEW_TARGET_HOURS * HOUR;
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", over ? "font-medium text-warning" : "text-ink-2")}>
      {over && <AlertTriangle className="size-3.5" aria-hidden />}
      {formatAge(ms)}
      {over && <span className="sr-only">(over the {REVIEW_TARGET_HOURS}-hour review target)</span>}
    </span>
  );
}

/* ─── Review drawer ──────────────────────────────────────────────────────────── */

function ReviewSheet({ request: current, onClose }: { request: VerificationRequest | null; onClose: () => void }) {
  const request = useSticky(current);
  const dir = useDirectory();
  return (
    <Sheet open={!!current} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        title={request ? `${VERIFICATION_LABEL[request.kind]} · ${dir.name(request.tutorId)}` : "Verification request"}
        description={request ? request.id : undefined}
        className="sm:w-[34rem]"
        footer={request ? <ReviewActions request={request} /> : undefined}
      >
        {request && <ReviewDetail request={request} />}
      </SheetContent>
    </Sheet>
  );
}

function ClaimList({ tutor, kind }: { tutor: Tutor; kind: VerificationKind }) {
  if (kind === "education") {
    if (!tutor.education.length) return <p className="text-[13px] text-muted">No education listed on the profile.</p>;
    return (
      <ul className="space-y-2 text-[13.5px]">
        {tutor.education.map((e, i) => (
          <li key={i} className="flex items-start justify-between gap-3">
            <span className="min-w-0 text-ink">
              {e.degree}, {e.field}
              <span className="block text-[12.5px] text-muted">{e.institution} · {e.year}</span>
            </span>
            {e.verified ? <Badge size="sm" tone="success"><BadgeCheck /> Verified</Badge> : <Badge size="sm">Unverified</Badge>}
          </li>
        ))}
      </ul>
    );
  }
  if (kind === "certification") {
    if (!tutor.certifications.length) return <p className="text-[13px] text-muted">No certifications listed on the profile.</p>;
    return (
      <ul className="space-y-2 text-[13.5px]">
        {tutor.certifications.map((c, i) => (
          <li key={i} className="flex items-start justify-between gap-3">
            <span className="min-w-0 text-ink">
              {c.name}
              <span className="block text-[12.5px] text-muted">{c.issuer} · {c.year}</span>
            </span>
            {c.verified ? <Badge size="sm" tone="success"><BadgeCheck /> Verified</Badge> : <Badge size="sm">Unverified</Badge>}
          </li>
        ))}
      </ul>
    );
  }
  if (kind === "identity") {
    return (
      <Facts
        items={[
          { label: "Legal name on profile", value: fullName(tutor) },
          { label: "Location", value: `${tutor.city}, ${tutor.state} ${tutor.zip}` },
        ]}
      />
    );
  }
  return <p className="text-[13px] leading-relaxed text-muted">Background screening runs with the tutor&apos;s signed consent through the screening provider in production. Confirm the consent form is complete and signed before approving.</p>;
}

function ReviewDetail({ request }: { request: VerificationRequest }) {
  const all = useApp((s) => s.verificationRequests);
  const auditLogs = useApp((s) => s.auditLogs);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const now = useNow(60_000);
  const tutor = dir.tutorById.get(request.tutorId);

  const history = React.useMemo(() => {
    const events = auditLogs.filter((a) => a.targetType === "verification" && a.targetId === request.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const items: { key: string; title: string; meta: string; body?: string; tone: "default" | "accent" | "success" | "danger" | "warning" }[] = [
      { key: "submitted", title: "Submitted by tutor", meta: formatDateTime(request.submittedAt, tz), tone: "accent" },
    ];
    for (const e of events) {
      const action = e.action.split(".")[1];
      items.push({
        key: e.id,
        title: action === "approve" ? "Approved" : action === "reject" ? "Rejected" : action === "start_review" ? "Review started" : e.action,
        meta: `${dir.name(e.actorId)} · ${formatDateTime(e.createdAt, tz)}`,
        tone: action === "approve" ? "success" : action === "reject" ? "danger" : "warning",
      });
    }
    // Decisions recorded before the audit trail existed still show from the request itself.
    if (request.reviewedAt && !events.length) {
      items.push({ key: "reviewed", title: humanStatus(request.status), meta: `${dir.name(request.reviewedBy)} · ${formatDateTime(request.reviewedAt, tz)}`, tone: request.status === "verified" ? "success" : request.status === "rejected" ? "danger" : "warning" });
    }
    if (request.note) items[items.length - 1].body = `“${request.note}”`;
    return items;
  }, [auditLogs, request, dir, tz]);

  const previous = all.filter((r) => r.tutorId === request.tutorId && r.kind === request.kind && r.id !== request.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const waited = now - new Date(request.submittedAt).getTime();

  return (
    <div className="divide-y divide-line">
      {tutor && (
        <div className="flex items-start gap-3.5 px-5 py-5">
          <Avatar name={fullName(tutor)} tone={tutor.tone} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink">{fullName(tutor)}</p>
            <p className="text-[13px] text-muted">
              {TUTOR_CATEGORY_LABEL[tutor.category]} · {tutor.city}, {tutor.state} · joined {formatDate(tutor.joinedAt, tz)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
              <TextLink href={`/admin/tutors?id=${tutor.id}`}>Tutor record</TextLink>
              <Link href={`/tutors/${tutor.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-medium text-ink hover:underline">
                Public profile <ExternalLink className="size-3" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      )}

      <Section title="Request">
        <Facts
          items={[
            { label: "Check", value: VERIFICATION_LABEL[request.kind] },
            { label: "Status", value: <VerificationStatusBadge status={request.status} /> },
            { label: "Submitted", value: formatDateTime(request.submittedAt, tz) },
            ...(isOpen(request.status) ? [{ label: "Waiting", value: <AgeCell ms={waited} /> }] : []),
            ...(request.expiresAt ? [{ label: "Expires", value: formatDate(request.expiresAt, tz) }] : []),
          ]}
        />
      </Section>

      <Section title={`Documents (${request.documents.length})`}>
        <ul className="divide-y divide-line rounded-lg border border-line">
          {request.documents.map((d) => {
            const image = /\.(png|jpe?g|heic)$/i.test(d.name);
            const Icon = image ? FileImage : FileText;
            return (
              <li key={d.name} className="flex items-center gap-3 px-3.5 py-2.5 text-[13.5px]">
                <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-ink">{d.name}</span>
                <span className="shrink-0 tabular-nums text-muted">{d.sizeKb >= 1024 ? `${(d.sizeKb / 1024).toFixed(1)} MB` : `${d.sizeKb} KB`}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2.5 flex items-start gap-2 text-[12.5px] leading-relaxed text-muted">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Document viewer opens the secure S3 object in production; access is logged. The preview build stores file names only.
        </p>
      </Section>

      {tutor && (
        <Section title="Claims on the profile" description="Compare against the documents before deciding.">
          <ClaimList tutor={tutor} kind={request.kind} />
        </Section>
      )}

      <Section title="History">
        <Timeline items={history} />
        {previous.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[12.5px] font-medium text-muted">Earlier {VERIFICATION_LABEL[request.kind].toLowerCase()} requests</p>
            <ul className="space-y-1.5 text-[13px]">
              {previous.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <TextLink href={`/admin/verification?id=${p.id}`}>{p.id}</TextLink>
                  <span className="flex items-center gap-2 text-muted">
                    {formatDate(p.submittedAt, tz)} <VerificationStatusBadge status={p.status} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </div>
  );
}

function humanStatus(s: VerificationStatus) {
  return s === "verified" ? "Approved" : s === "rejected" ? "Rejected" : s === "under_review" ? "Review started" : s === "expired" ? "Expired" : "Submitted";
}

function ReviewActions({ request }: { request: VerificationRequest }) {
  const review = useApp((s) => s.reviewVerification);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const [approve, setApprove] = React.useState(false);
  const [reject, setReject] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const name = dir.name(request.tutorId);
  const label = VERIFICATION_LABEL[request.kind];

  if (!isOpen(request.status)) {
    if (request.status === "verified") {
      return (
        <InlineAlert tone="success" title="Verified">
          Approved {request.reviewedAt ? `${formatDate(request.reviewedAt, tz)} by ${dir.name(request.reviewedBy)}` : ""}
          {request.expiresAt ? ` · expires ${formatDate(request.expiresAt, tz)}` : ""}.
        </InlineAlert>
      );
    }
    return (
      <InlineAlert tone={request.status === "rejected" ? "danger" : "warning"} title={humanStatus(request.status)}>
        {request.status === "rejected" ? "The tutor can resubmit new documents from their verification page." : "The tutor needs to resubmit documents."}
      </InlineAlert>
    );
  }

  const run = (decision: "verified" | "rejected" | "under_review", note?: string) => {
    setBusy(true);
    const res = review(request.id, decision, note);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success(decision === "verified" ? `${label} verified` : decision === "rejected" ? `${label} rejected` : "Review started", {
      description: decision === "under_review" ? "Other staff will see you're reviewing this." : `${name} has been notified.`,
    });
    return true;
  };

  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
      {request.status === "submitted" && (
        <PermissionButton permission="tutors.verify" variant="ghost" loading={busy} onClick={() => run("under_review")} className="sm:mr-auto">
          <PlayCircle /> Start review
        </PermissionButton>
      )}
      <div className={cn("flex gap-2", request.status !== "submitted" && "sm:ml-auto")}>
        <PermissionButton permission="tutors.verify" variant="danger-outline" onClick={() => setReject(true)} className="flex-1 sm:flex-none">
          <CircleX /> Reject
        </PermissionButton>
        <PermissionButton permission="tutors.verify" onClick={() => setApprove(true)} className="flex-1 sm:flex-none">
          <BadgeCheck /> Approve
        </PermissionButton>
      </div>

      <ConfirmDialog
        open={approve}
        onOpenChange={setApprove}
        title={`Approve ${label.toLowerCase()} for ${name}?`}
        description={`The ${label.toLowerCase()} check shows as verified on their public profile immediately and expires in 2 years. Only approve after checking every document against the profile.`}
        confirmLabel="Approve"
        loading={busy}
        onConfirm={() => {
          if (run("verified")) setApprove(false);
        }}
      />
      <ReasonDialog
        open={reject}
        onOpenChange={setReject}
        title={`Reject ${label.toLowerCase()}?`}
        description={`${name} will see this note and can resubmit. Be specific about what needs to change.`}
        label="Note to the tutor"
        hint="At least 10 characters. Shared with the tutor and kept in the audit log."
        placeholder="e.g. The diploma name doesn't match the profile name. Upload a name-change document or an updated diploma."
        minLength={10}
        confirmLabel="Reject documents"
        tone="danger"
        onConfirm={(note) => run("rejected", note)}
      />
    </div>
  );
}
