"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, CircleCheck, CircleSlash, ClipboardList, Eye, Flag, GraduationCap, MessageSquare, Paperclip, RotateCcw, Star, UserRound, UserRoundX } from "lucide-react";
import type { Message, Report, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useNow, useViewerTimezone } from "@/lib/store/hooks";
import { ROLE_LABEL } from "@/lib/data/users";
import { subjectName } from "@/lib/data/catalog";
import { verifiedKinds } from "@/lib/data/tutors";
import { formatCents, formatDate, formatDateTime, pluralize } from "@/lib/format";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Disclosure";
import { ConfirmDialog, Sheet, SheetContent } from "@/components/ui/Overlay";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { StarRating } from "@/components/ui/StarRating";
import { EmptyState } from "@/components/ui/States";
import { VERIFICATION_LABEL } from "@/components/domain/Badges";
import { toast } from "@/components/ui/Toast";
import {
  ClearFilters, ExportButton, Facts, FilterSelect, Mono, PermissionButton, PermissionNotice, ReasonDialog, SearchInput, Section, StatusPill,
  RowOpen, TextLink, Timeline, Toolbar, ConversationAccess, formatAge, fullName, humanize, matches, useDirectory, useStaff, useSticky, useUrlParam,
  type Directory,
} from "./kit";
import { REVIEW_STATUS_META, RatingStars, useAllReviews } from "./ReviewsView";
import { auditTone, describeAudit, sortAudit } from "./AuditLogView";

type Status = Report["status"];
type TargetType = Report["targetType"];

export const REPORT_STATUS_META: Record<Status, { label: string; tone: "warning" | "accent" | "success" | "neutral" }> = {
  open: { label: "Open", tone: "warning" },
  reviewing: { label: "Reviewing", tone: "accent" },
  actioned: { label: "Action taken", tone: "success" },
  dismissed: { label: "Dismissed", tone: "neutral" },
};

const TABS: { value: Status; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "reviewing", label: "Reviewing" },
  { value: "actioned", label: "Actioned" },
  { value: "dismissed", label: "Dismissed" },
];

const TARGET_META: Record<TargetType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  message: { label: "Message", icon: MessageSquare },
  review: { label: "Review", icon: Star },
  tutor: { label: "Tutor", icon: GraduationCap },
  user: { label: "User", icon: UserRound },
  requirement: { label: "Requirement", icon: ClipboardList },
};

const TYPE_OPTIONS: { value: "all" | TargetType; label: string }[] = [
  { value: "all", label: "Any target" },
  { value: "message", label: "Messages" },
  { value: "review", label: "Reviews" },
  { value: "tutor", label: "Tutor profiles" },
  { value: "user", label: "Users" },
  { value: "requirement", label: "Requirements" },
];

const USER_STATUS_META: Record<User["status"], { label: string; tone: "success" | "danger" | "warning" }> = {
  active: { label: "Active", tone: "success" },
  suspended: { label: "Suspended", tone: "danger" },
  pending_verification: { label: "Pending verification", tone: "warning" },
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function TargetBadge({ type }: { type: TargetType }) {
  const { label, icon: Icon } = TARGET_META[type];
  return (
    <Badge size="sm" className="gap-1.5">
      <Icon className="size-3" aria-hidden /> {label}
    </Badge>
  );
}

/** Admin link for a person id that may be a user or a tutor profile. */
function personHref(id: string, dir: Directory): string | null {
  if (dir.userById.has(id)) return `/admin/users?id=${encodeURIComponent(id)}`;
  if (dir.tutorById.has(id)) return `/admin/tutors?id=${encodeURIComponent(id)}`;
  return null;
}

/** Resolves a one-line summary of what was reported (used in the table, search and export). */
function useTargetSummary() {
  const messages = useApp((s) => s.messages);
  const requirements = useApp((s) => s.requirements);
  const reviews = useAllReviews();
  const dir = useDirectory();
  return React.useMemo(() => {
    const msgById = new Map(messages.map((m) => [m.id, m]));
    const revById = new Map(reviews.map((r) => [r.id, r]));
    const reqById = new Map(requirements.map((r) => [r.id, r]));
    return (r: Report): { text: string; missing: boolean } => {
      switch (r.targetType) {
        case "message": {
          const m = msgById.get(r.targetId);
          return m ? { text: `${dir.name(m.senderId)}: “${clip(m.body, 80)}”`, missing: false } : { text: `Message ${r.targetId} — not in this preview`, missing: true };
        }
        case "review": {
          const v = revById.get(r.targetId);
          return v ? { text: `${v.rating}-star review of ${dir.name(v.tutorId)} by ${v.authorName}`, missing: false } : { text: `Review ${r.targetId} — not in this preview`, missing: true };
        }
        case "tutor": {
          const t = dir.tutorById.get(r.targetId);
          return t ? { text: `${fullName(t)} · tutor profile`, missing: false } : { text: `Tutor ${r.targetId} — not in this preview`, missing: true };
        }
        case "user": {
          const u = dir.userById.get(r.targetId);
          return u ? { text: `${fullName(u)} · ${ROLE_LABEL[u.role]}`, missing: false } : { text: `Account ${r.targetId} — not in this preview`, missing: true };
        }
        case "requirement": {
          const q = reqById.get(r.targetId);
          return q ? { text: q.title || "Untitled requirement", missing: false } : { text: `Requirement ${r.targetId} — not in this preview`, missing: true };
        }
      }
    };
  }, [messages, requirements, reviews, dir]);
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */

export function ReportsView() {
  return (
    <PermissionGate permission="reports.moderate">
      <ReportsInner />
    </PermissionGate>
  );
}

function ReportsInner() {
  const reports = useApp((s) => s.reports);
  const dir = useDirectory();
  const summary = useTargetSummary();
  const now = useNow(60_000);

  const [openId, setOpenId] = useUrlParam("id");
  const [tab, setTab] = React.useState<Status>(() => reports.find((r) => r.id === openId)?.status ?? "open");
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<"all" | TargetType>("all");

  const searched = React.useMemo(
    () => reports.filter((r) => (type === "all" || r.targetType === type) && matches(q, r.id, r.reason, r.details, r.targetId, dir.name(r.reporterId), summary(r).text)),
    [reports, type, q, dir, summary],
  );
  const counts = React.useMemo(() => Object.fromEntries(TABS.map((t) => [t.value, searched.filter((r) => r.status === t.value).length])) as Record<Status, number>, [searched]);
  // Active queues read oldest first (longest waiting at the top); closed reports newest first.
  const active = tab === "open" || tab === "reviewing";
  const rows = React.useMemo(
    () => searched.filter((r) => r.status === tab).sort((a, b) => (active ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt))),
    [searched, tab, active],
  );
  const filtered = q.trim() !== "" || type !== "all";

  const columns: Column<Report>[] = [
    {
      key: "age",
      header: "Reported",
      sortValue: (r) => r.createdAt,
      cell: (r) => (
        <RowOpen onOpen={() => setOpenId(r.id)} label={`Open report ${r.id}: ${r.reason}`} className="whitespace-nowrap tabular-nums">
          {formatAge(now - new Date(r.createdAt).getTime())} ago
        </RowOpen>
      ),
    },
    { key: "type", header: "Target", sortValue: (r) => r.targetType, cell: (r) => <TargetBadge type={r.targetType} /> },
    {
      key: "summary",
      header: "Reported content",
      sortValue: (r) => summary(r).text,
      cell: (r) => {
        const s = summary(r);
        return <span className={cn("block max-w-72 truncate", s.missing && "text-muted")}>{s.text}</span>;
      },
    },
    { key: "reason", header: "Reason", sortValue: (r) => r.reason, cell: (r) => <span className="block max-w-56 truncate font-medium text-ink">{r.reason}</span> },
    { key: "reporter", header: "Reporter", sortValue: (r) => dir.name(r.reporterId), cell: (r) => <span className="block max-w-40 truncate">{dir.name(r.reporterId)}</span> },
    { key: "status", header: "Status", sortValue: (r) => r.status, cell: (r) => <StatusPill tone={REPORT_STATUS_META[r.status].tone}>{REPORT_STATUS_META[r.status].label}</StatusPill> },
  ];

  const open = reports.find((r) => r.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Member reports about messages, reviews, profiles and jobs. Status changes are written to the audit log."
        actions={
          <ExportButton
            filename="tutorlink-reports"
            headers={["ID", "Reported (UTC)", "Status", "Target type", "Target ID", "Reported content", "Reason", "Details", "Reporter ID", "Reporter"]}
            rows={() => rows.map((r) => [r.id, r.createdAt, r.status, r.targetType, r.targetId, summary(r).text, r.reason, r.details, r.reporterId, dir.name(r.reporterId)])}
          />
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
        <TabsList aria-label="Filter by report status">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} count={counts[t.value]}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab}>
          <Toolbar summary={`${pluralize(rows.length, "report")}${rows.length > 1 ? (active ? " · oldest first" : " · newest first") : ""}`}>
            <SearchInput value={q} onChange={setQ} placeholder="Search reason, reporter or content…" label="Search reports" />
            <FilterSelect label="Target type" value={type} onChange={setType} options={TYPE_OPTIONS} />
            <ClearFilters
              active={filtered}
              onClear={() => {
                setQ("");
                setType("all");
              }}
            />
          </Toolbar>

          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            onRowClick={(r) => setOpenId(r.id)}
            mobileTitle="reason"
            pageSize={12}
            empty={
              <EmptyState
                icon={<Flag />}
                title={filtered ? "No reports match these filters" : tab === "open" ? "The queue is clear" : `No ${TABS.find((t) => t.value === tab)!.label.toLowerCase()} reports`}
                description={
                  filtered
                    ? "Try another phrase or target type, or clear the filters."
                    : tab === "open"
                      ? "New reports from members land here. Nothing is waiting for review."
                      : tab === "reviewing"
                        ? "Mark an open report as reviewing while you investigate it."
                        : "Reports you close appear here and can be reopened."
                }
              />
            }
          />
        </TabsContent>
      </Tabs>

      <ReportSheet report={open} onClose={() => setOpenId(null)} />
    </>
  );
}

/* ─── Detail drawer ──────────────────────────────────────────────────────────── */

function ReportSheet({ report: current, onClose }: { report: Report | null; onClose: () => void }) {
  const report = useSticky(current);
  return (
    <Sheet open={!!current} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        title={report ? report.reason : "Report"}
        description={report ? `${TARGET_META[report.targetType].label} report · ${report.id}` : undefined}
        className="sm:w-[34rem]"
        footer={report ? <ReportActions report={report} /> : undefined}
      >
        {report && <ReportDetail report={report} />}
      </SheetContent>
    </Sheet>
  );
}

function ReportDetail({ report }: { report: Report }) {
  const messages = useApp((s) => s.messages);
  const auditLogs = useApp((s) => s.auditLogs);
  const dir = useDirectory();
  const { can } = useStaff();
  const tz = useViewerTimezone();
  const now = useNow(60_000);

  const message = report.targetType === "message" ? messages.find((m) => m.id === report.targetId) : undefined;
  const reporter = dir.userById.get(report.reporterId);

  const related = React.useMemo(() => {
    const needle = report.id.toLowerCase();
    const targets = new Set<string>([report.targetId]);
    if (message) targets.add(message.conversationId);
    if (report.targetType === "tutor") {
      const account = dir.tutorUser.get(report.targetId);
      if (account) targets.add(account.id);
    }
    return sortAudit(
      auditLogs.filter(
        (a) =>
          (a.targetType === "report" && a.targetId === report.id) ||
          (a.targetType !== "report" && targets.has(a.targetId)) ||
          Object.values(a.meta ?? {}).some((v) => typeof v === "string" && v.toLowerCase().includes(needle)),
      ),
    ).slice(0, 10);
  }, [auditLogs, report, message, dir]);

  return (
    <div className="divide-y divide-line">
      <div className="px-5 py-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill tone={REPORT_STATUS_META[report.status].tone}>{REPORT_STATUS_META[report.status].label}</StatusPill>
          <TargetBadge type={report.targetType} />
        </div>
        <p className="mt-2.5 text-[13px] text-muted">
          Reported {formatDateTime(report.createdAt, tz)} ·{" "}
          {report.status === "open" || report.status === "reviewing" ? `waiting ${formatAge(now - new Date(report.createdAt).getTime())}` : `${formatAge(now - new Date(report.createdAt).getTime())} ago`}
        </p>
      </div>

      <Section title="Report">
        {report.details ? (
          <blockquote className="rounded-lg border border-line bg-canvas px-4 py-3 text-[14px] leading-relaxed text-ink">{report.details}</blockquote>
        ) : (
          <p className="text-[13px] text-muted">The reporter didn&apos;t add any details beyond the reason.</p>
        )}
        <Facts
          className="mt-3"
          items={[
            { label: "Reason", value: report.reason },
            {
              label: "Reporter",
              value: reporter ? (
                <span className="block">
                  <TextLink href={`/admin/users?id=${encodeURIComponent(reporter.id)}`}>{fullName(reporter)}</TextLink>
                  <span className="block text-[12px] font-normal text-muted">{ROLE_LABEL[reporter.role]} · {reporter.email}</span>
                </span>
              ) : (
                <Mono>{report.reporterId}</Mono>
              ),
            },
            { label: "Report ID", value: <Mono>{report.id}</Mono> },
          ]}
        />
      </Section>

      <Section title={`Reported ${TARGET_META[report.targetType].label.toLowerCase()}`}>
        <TargetPreview report={report} message={message} />
      </Section>

      {message && (
        <Section title="Conversation" description="The rest of the thread stays private until you log a reason for access.">
          <ConversationAccess key={`${report.id}:${message.conversationId}`} conversationId={message.conversationId} context={`report ${report.id}`}>
            {() => <Transcript conversationId={message.conversationId} highlightId={message.id} />}
          </ConversationAccess>
        </Section>
      )}

      <Section
        title="Related activity"
        description="Staff actions on this report and on the reported content."
        action={can("audit.read") ? <TextLink href={`/admin/audit-log?q=${encodeURIComponent(report.id)}`} className="shrink-0 text-[12.5px]">Audit log</TextLink> : undefined}
      >
        <Timeline
          empty="No staff actions recorded yet."
          items={related.map((a) => ({
            key: a.id,
            tone: auditTone(a),
            title: describeAudit(a),
            meta: `${dir.name(a.actorId)} · ${formatDateTime(a.createdAt, tz)}`,
            body: typeof a.meta?.reason === "string" ? `“${a.meta.reason}”` : undefined,
          }))}
        />
      </Section>
    </div>
  );
}

function Missing({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line-strong px-4 py-3 text-[13px] text-muted">{children}</p>;
}

function TargetPreview({ report, message }: { report: Report; message?: Message }) {
  switch (report.targetType) {
    case "message":
      return <MessageTarget report={report} message={message} />;
    case "review":
      return <ReviewTarget id={report.targetId} />;
    case "tutor":
      return <TutorTarget report={report} />;
    case "user":
      return <UserTarget report={report} />;
    case "requirement":
      return <RequirementTarget id={report.targetId} />;
  }
}

function MessageTarget({ report, message }: { report: Report; message?: Message }) {
  const conversations = useApp((s) => s.conversations);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  if (!message) return <Missing>Message <Mono>{report.targetId}</Mono> isn&apos;t in this preview&apos;s data, so its content can&apos;t be shown.</Missing>;
  const conv = conversations.find((c) => c.id === message.conversationId);
  const senderHref = personHref(message.senderId, dir);
  return (
    <div className="space-y-3">
      <figure className="rounded-lg border border-warning-200 bg-warning-50/60 px-4 py-3">
        <blockquote className="text-[14px] leading-relaxed text-ink">“{message.body}”</blockquote>
        {message.attachment && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-muted">
            <Paperclip className="size-3.5" aria-hidden /> {message.attachment.name} · {message.attachment.sizeKb} KB
          </p>
        )}
        <figcaption className="mt-2 text-[12.5px] text-muted">
          {dir.name(message.senderId)} · {formatDateTime(message.createdAt, tz)}
        </figcaption>
      </figure>
      <Facts
        items={[
          { label: "Sender", value: senderHref ? <TextLink href={senderHref}>{dir.name(message.senderId)}</TextLink> : <Mono>{message.senderId}</Mono> },
          { label: "Sent", value: formatDateTime(message.createdAt, tz) },
          {
            label: "Automatic moderation",
            value:
              message.moderation === "contact_info_masked" ? (
                <Badge size="sm" tone="warning">Contact details masked</Badge>
              ) : message.moderation === "flagged" ? (
                <Badge size="sm" tone="danger">Flagged</Badge>
              ) : (
                <span className="font-normal text-muted">No flag</span>
              ),
          },
          { label: "Conversation", value: conv ? `${dir.name(conv.userId)} and ${dir.name(conv.tutorId)}` : <Mono>{message.conversationId}</Mono> },
          ...(conv?.involvesMinor ? [{ label: "Safeguarding", value: <Badge size="sm" tone="warning">Involves a minor</Badge> }] : []),
        ]}
      />
    </div>
  );
}

function Transcript({ conversationId, highlightId }: { conversationId: string; highlightId: string }) {
  const messages = useApp((s) => s.messages);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const list = React.useMemo(() => messages.filter((m) => m.conversationId === conversationId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [messages, conversationId]);
  if (!list.length) return <p className="text-[13px] text-muted">No messages in this conversation.</p>;
  return (
    <ol className="max-h-96 space-y-2 overflow-y-auto pr-1" aria-label="Conversation transcript">
      {list.map((m) => {
        const reported = m.id === highlightId;
        return (
          <li key={m.id} className={cn("rounded-lg border px-3.5 py-2.5", reported ? "border-warning-200 bg-warning-50/60" : "border-line bg-surface")}>
            <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[12px] text-muted">
              <span className="font-medium text-ink">{dir.name(m.senderId)}</span>
              <span className="tabular-nums">{formatDateTime(m.createdAt, tz)}</span>
            </p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{m.body}</p>
            {m.attachment && (
              <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-muted">
                <Paperclip className="size-3" aria-hidden /> {m.attachment.name}
              </p>
            )}
            {(reported || m.moderation) && (
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                {reported && (
                  <Badge size="sm" tone="warning">
                    <Flag aria-hidden /> Reported message
                  </Badge>
                )}
                {m.moderation === "contact_info_masked" && <Badge size="sm">Contact details masked</Badge>}
                {m.moderation === "flagged" && <Badge size="sm" tone="danger">Flagged</Badge>}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ReviewTarget({ id }: { id: string }) {
  const reviews = useAllReviews();
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const review = reviews.find((r) => r.id === id);
  if (!review) return <Missing>Review <Mono>{id}</Mono> isn&apos;t in this preview&apos;s data.</Missing>;
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-line px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <RatingStars rating={review.rating} />
          <StatusPill tone={REVIEW_STATUS_META[review.status].tone}>{REVIEW_STATUS_META[review.status].label}</StatusPill>
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{review.body}</p>
        <p className="mt-2 text-[12.5px] text-muted">
          {review.authorName} ({humanize(review.authorRole).toLowerCase()}) about {dir.name(review.tutorId)} · {subjectName(review.subject)} · {formatDate(review.createdAt, tz)}
        </p>
      </div>
      <TextLink href={`/admin/reviews?id=${encodeURIComponent(review.id)}`} className="inline-flex items-center gap-1 text-[13px]">
        Moderate in Reviews <ArrowUpRight className="size-3.5" aria-hidden />
      </TextLink>
    </div>
  );
}

function TutorTarget({ report }: { report: Report }) {
  const dir = useDirectory();
  const tutor = dir.tutorById.get(report.targetId);
  if (!tutor) return <Missing>Tutor <Mono>{report.targetId}</Mono> isn&apos;t in this preview&apos;s data.</Missing>;
  const account = dir.tutorUser.get(tutor.id);
  const verified = verifiedKinds(tutor);
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-lg border border-line px-4 py-3">
        <Avatar name={fullName(tutor)} tone={tutor.tone} verified={tutor.verification.identity === "verified"} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{fullName(tutor)}</p>
          <p className="line-clamp-2 text-[13px] text-muted">{tutor.headline}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
            <span>
              {tutor.city}, {tutor.state}
            </span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{formatCents(tutor.hourlyRateCents)}/hr</span>
            <span aria-hidden>·</span>
            <StarRating rating={tutor.rating} count={tutor.reviewCount} />
          </p>
        </div>
      </div>
      <Facts
        items={[
          { label: "Subjects", value: <span className="font-normal">{tutor.subjects.slice(0, 4).map(subjectName).join(", ")}{tutor.subjects.length > 4 ? ` +${tutor.subjects.length - 4}` : ""}</span> },
          { label: "Verified checks", value: verified.length ? verified.map((k) => VERIFICATION_LABEL[k]).join(", ") : <span className="font-normal text-muted">None completed</span> },
          {
            label: "Sign-in account",
            value: account ? <TextLink href={`/admin/users?id=${encodeURIComponent(account.id)}`}>{fullName(account)}</TextLink> : <span className="font-normal text-muted">None in this preview</span>,
          },
        ]}
      />
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
        <TextLink href={`/admin/tutors?id=${encodeURIComponent(tutor.id)}`}>Open tutor record</TextLink>
        <Link href={`/tutors/${tutor.slug}`} className="inline-flex items-center gap-1 font-medium text-ink underline-offset-4 hover:underline">
          Public profile <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      <SuspendAccount user={account ?? null} report={report} noAccountName={account ? undefined : fullName(tutor)} />
    </div>
  );
}

function UserTarget({ report }: { report: Report }) {
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const user = dir.userById.get(report.targetId);
  if (!user) return <Missing>Account <Mono>{report.targetId}</Mono> isn&apos;t in this preview&apos;s data.</Missing>;
  return (
    <div className="space-y-3">
      <Facts
        items={[
          { label: "Name", value: <TextLink href={`/admin/users?id=${encodeURIComponent(user.id)}`}>{fullName(user)}</TextLink> },
          { label: "Email", value: <span className="break-all font-normal">{user.email}</span> },
          { label: "Role", value: ROLE_LABEL[user.role] },
          { label: "Status", value: <StatusPill tone={USER_STATUS_META[user.status].tone}>{USER_STATUS_META[user.status].label}</StatusPill> },
          { label: "Joined", value: formatDate(user.createdAt, tz) },
        ]}
      />
      <SuspendAccount user={user} report={report} />
    </div>
  );
}

function RequirementTarget({ id }: { id: string }) {
  const requirements = useApp((s) => s.requirements);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const req = requirements.find((r) => r.id === id);
  if (!req) return <Missing>Requirement <Mono>{id}</Mono> isn&apos;t in this preview&apos;s data.</Missing>;
  return (
    <div className="space-y-3">
      <Facts
        items={[
          { label: "Title", value: req.title || "Untitled draft" },
          { label: "Subject", value: req.subject ? subjectName(req.subject) : "—" },
          { label: "Status", value: humanize(req.status) },
          { label: "Posted by", value: <TextLink href={`/admin/users?id=${encodeURIComponent(req.ownerId)}`}>{dir.name(req.ownerId)}</TextLink> },
          { label: "Last updated", value: formatDate(req.updatedAt, tz) },
        ]}
      />
      <TextLink href={`/admin/requirements?id=${encodeURIComponent(req.id)}`} className="inline-flex items-center gap-1 text-[13px]">
        Open requirement <ArrowUpRight className="size-3.5" aria-hidden />
      </TextLink>
    </div>
  );
}

/** Suspend the account behind a reported user or tutor, with a reason for the audit log. */
function SuspendAccount({ user, report, noAccountName }: { user: User | null; report: Report; noAccountName?: string }) {
  const setUserStatus = useApp((s) => s.setUserStatus);
  const { me, can } = useStaff();
  const [open, setOpen] = React.useState(false);

  if (!user) {
    return (
      <p className="rounded-lg border border-line bg-canvas px-3.5 py-3 text-[13px] leading-relaxed text-ink-2">
        {noAccountName ?? "This tutor"} has no sign-in account in this preview, so there&apos;s no account to suspend here. You can still close the report once you&apos;ve decided on it.
      </p>
    );
  }
  if (user.status === "suspended") {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-[13px] text-danger">
        <CircleSlash className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {fullName(user)}&apos;s account is suspended.{" "}
          <Link href={`/admin/users?id=${encodeURIComponent(user.id)}`} className="font-medium underline underline-offset-4">
            Manage account
          </Link>
        </span>
      </p>
    );
  }
  if (user.id === me?.id) return <p className="text-[13px] text-muted">You can&apos;t change the status of your own account.</p>;

  return (
    <div className="space-y-2.5">
      {!can("users.write") && <PermissionNotice permission="users.write">Suspending accounts requires</PermissionNotice>}
      <PermissionButton permission="users.write" variant="danger-outline" size="sm" onClick={() => setOpen(true)}>
        <UserRoundX /> Suspend {user.firstName}&apos;s account
      </PermissionButton>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={`Suspend ${fullName(user)}?`}
        description="They won't be able to sign in, book, message or apply to jobs until reactivated. Upcoming lessons are not cancelled automatically."
        placeholder={`e.g. ${report.reason} — confirmed (report ${report.id})`}
        confirmLabel="Suspend account"
        tone="danger"
        onConfirm={(reason) => {
          const res = setUserStatus(user.id, "suspended", reason);
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          toast.success("Account suspended", { description: "Recorded in the audit log. Close the report when you're done." });
          return true;
        }}
      />
    </div>
  );
}

/* ─── Status actions ─────────────────────────────────────────────────────────── */

const CLOSE_COPY: Record<"actioned" | "dismissed", { title: string; description: string; confirm: string; toast: string }> = {
  actioned: {
    title: "Close as action taken?",
    description: "Use this once you've dealt with the reported content — for example suspended the account or removed the review. You can reopen the report later.",
    confirm: "Mark action taken",
    toast: "Report closed — action taken",
  },
  dismissed: {
    title: "Dismiss this report?",
    description: "Use this when the reported content doesn't break the rules. You can reopen the report later.",
    confirm: "Dismiss report",
    toast: "Report dismissed",
  },
};

function ReportActions({ report }: { report: Report }) {
  const setReportStatus = useApp((s) => s.setReportStatus);
  const dir = useDirectory();
  const [confirm, setConfirm] = React.useState<"actioned" | "dismissed" | null>(null);
  const shown = useSticky(confirm);
  const closed = report.status === "actioned" || report.status === "dismissed";

  const apply = (status: Status, message: string) => {
    const res = setReportStatus(report.id, status);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success(message, { description: "Recorded in the audit log." });
    return true;
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {closed ? (
        <>
          <p className="mr-auto text-[13px] text-muted">Closed · {REPORT_STATUS_META[report.status].label.toLowerCase()}</p>
          <PermissionButton permission="reports.moderate" variant="secondary" onClick={() => apply("open", "Report reopened")}>
            <RotateCcw /> Reopen
          </PermissionButton>
        </>
      ) : (
        <>
          {report.status === "open" && (
            <PermissionButton permission="reports.moderate" variant="secondary" onClick={() => apply("reviewing", "Marked as reviewing")}>
              <Eye /> Mark reviewing
            </PermissionButton>
          )}
          <PermissionButton permission="reports.moderate" variant="secondary" onClick={() => setConfirm("dismissed")}>
            <CircleSlash /> Dismiss
          </PermissionButton>
          <PermissionButton permission="reports.moderate" onClick={() => setConfirm("actioned")}>
            <CircleCheck /> Action taken
          </PermissionButton>
        </>
      )}
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={shown ? CLOSE_COPY[shown].title : "Close report"}
        description={shown ? CLOSE_COPY[shown].description : undefined}
        confirmLabel={shown ? CLOSE_COPY[shown].confirm : "Confirm"}
        onConfirm={() => {
          if (confirm && apply(confirm, CLOSE_COPY[confirm].toast)) setConfirm(null);
        }}
      >
        <p className="text-[13px] text-ink-2">
          <span className="font-medium text-ink">{report.reason}</span> · reported by {dir.name(report.reporterId)}
        </p>
      </ConfirmDialog>
    </div>
  );
}
