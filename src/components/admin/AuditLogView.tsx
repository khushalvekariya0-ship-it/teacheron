"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Lock, ScrollText } from "lucide-react";
import type { AuditLog } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useNow, useViewerTimezone } from "@/lib/store/hooks";
import { ROLE_LABEL } from "@/lib/data/users";
import { formatDate, formatRelative, pluralize } from "@/lib/format";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Sheet, SheetContent } from "@/components/ui/Overlay";
import { EmptyState } from "@/components/ui/States";
import {
  ClearFilters, ExportButton, Facts, FilterSelect, Mono, PersonCell, SearchInput, Section, TextLink, Toolbar, humanize, matches,
  useDirectory, useSticky, useUrlParam, type Directory,
} from "./kit";

/* ─── Shared audit helpers (also used by Reports, Reviews and Feature flags) ─── */

/** Known action prefixes, in the order they appear in the filter. */
export const AUDIT_PREFIXES = ["user", "verification", "dispute", "booking", "report", "review", "flag", "policy", "settings", "coupon", "conversation"];

/** Seed entries aren't stored in chronological order — always sort before display. */
export function sortAudit(list: AuditLog[]): AuditLog[] {
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Admin page that owns a record type, when there is one. */
export function auditTargetHref(type: string, id: string): string | null {
  const q = encodeURIComponent(id);
  switch (type) {
    case "user":
      return `/admin/users?id=${q}`;
    case "verification":
      return `/admin/verification?id=${q}`;
    case "dispute":
      return `/admin/disputes/${q}`;
    case "booking":
      return `/admin/bookings?id=${q}`;
    case "report":
      return `/admin/reports?id=${q}`;
    case "review":
      return `/admin/reviews?id=${q}`;
    case "flag":
      return "/admin/feature-flags";
    case "coupon":
      return "/admin/promotions";
    case "settings":
      return "/admin/settings";
    default:
      return null;
  }
}

type MetaValue = NonNullable<AuditLog["meta"]>[string];

function metaText(v: MetaValue): string {
  if (v === null) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

/** Human summary of a flag.update entry: "Turned off · Rollout set to 25%". */
export function describeFlagChange(meta: AuditLog["meta"]): string {
  const parts: string[] = [];
  if (meta && "enabled" in meta) parts.push(meta.enabled ? "Turned on" : "Turned off");
  if (meta && "rolloutPercent" in meta) parts.push(`Rollout set to ${metaText(meta.rolloutPercent)}%`);
  return parts.join(" · ") || "Flag updated";
}

/** One-line description of an audit entry for timelines and table sub-lines. */
export function describeAudit(a: AuditLog): string {
  const m = a.meta ?? {};
  const s = (k: string) => (m[k] === undefined || m[k] === null ? "" : String(m[k]));
  switch (a.action) {
    case "user.suspend":
      return "Account suspended";
    case "user.reactivate":
      return "Account reactivated";
    case "verification.approve":
      return `${humanize(s("kind") || "verification")} check approved`;
    case "verification.reject":
      return `${humanize(s("kind") || "verification")} check rejected`;
    case "verification.start_review":
      return `${humanize(s("kind") || "verification")} review started`;
    case "dispute.note":
      return "Note added to dispute";
    case "dispute.status":
      return `Dispute moved to ${humanize(s("status")).toLowerCase()}`;
    case "dispute.resolve":
      return `Dispute decided — ${humanize(s("outcome")).toLowerCase()}`;
    case "booking.transition":
      return `Booking ${humanize(s("from")).toLowerCase()} → ${humanize(s("to")).toLowerCase()}`;
    case "report.status":
      return m.status === "open" ? "Report reopened" : m.status === "reviewing" ? "Report marked reviewing" : m.status === "actioned" ? "Report closed — action taken" : m.status === "dismissed" ? "Report dismissed" : "Report updated";
    case "review.moderate":
      return m.status === "published" ? "Review restored" : m.status === "flagged" ? "Review flagged" : m.status === "removed" ? "Review removed" : "Review moderated";
    case "flag.update":
      return `${a.targetId}: ${describeFlagChange(a.meta).toLowerCase()}`;
    case "policy.update":
      return "Booking policy updated";
    case "settings.platform_fee":
      return typeof m.bps === "number" ? `Platform fee set to ${m.bps / 100}%` : "Platform fee changed";
    case "coupon.create":
      return `Coupon ${s("code")} created`;
    case "coupon.update":
      return `Coupon ${s("code")} updated`;
    case "conversation.access":
      return "Private conversation opened";
    default:
      return humanize(a.action);
  }
}

export function auditTone(a: AuditLog): "default" | "accent" | "success" | "warning" | "danger" {
  const m = a.meta ?? {};
  if (a.action === "user.suspend" || a.action === "verification.reject") return "danger";
  if (a.action === "review.moderate") return m.status === "removed" ? "danger" : m.status === "flagged" ? "warning" : "success";
  if (a.action === "report.status") return m.status === "actioned" ? "success" : m.status === "dismissed" ? "default" : "accent";
  if (a.action === "user.reactivate" || a.action === "verification.approve" || a.action === "dispute.resolve") return "success";
  if (a.action === "conversation.access") return "warning";
  return "accent";
}

/** Compact "key: value" chips for audit metadata. */
export function MetaChips({ meta, max, className }: { meta: AuditLog["meta"]; max?: number; className?: string }) {
  const entries = Object.entries(meta ?? {});
  if (!entries.length) return <span className="text-muted">—</span>;
  const shown = max ? entries.slice(0, max) : entries;
  const rest = entries.length - shown.length;
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {shown.map(([k, v]) => (
        <span key={k} className="inline-flex max-w-56 items-center gap-1 rounded border border-line bg-canvas px-1.5 py-0.5 text-[11.5px] leading-4">
          <span className="shrink-0 text-muted">{k}:</span>
          <span className="truncate font-medium text-ink-2">{metaText(v)}</span>
        </span>
      ))}
      {rest > 0 && <span className="self-center text-[11.5px] text-muted">+{rest} more</span>}
    </span>
  );
}

export function ActionCode({ action, className }: { action: string; className?: string }) {
  return <span className={cn("inline-flex max-w-full items-center rounded border border-line bg-sunken px-1.5 py-0.5 font-mono text-[11.5px] leading-4 text-ink", className)}>{action}</span>;
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */

type DateRange = "all" | "24h" | "7d" | "30d";
const DAY = 86_400_000;
const RANGE_MS: Record<Exclude<DateRange, "all">, number> = { "24h": DAY, "7d": 7 * DAY, "30d": 30 * DAY };
const DATE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "all", label: "Any time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

/** Audit entries span years, so the table always shows the year. */
const STAMP: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" };

const prefixOf = (action: string) => action.split(".")[0];

function targetName(a: AuditLog, dir: Directory, flagLabel: Map<string, string>): string | undefined {
  if (a.targetType === "user") return dir.name(a.targetId);
  if (a.targetType === "flag") return flagLabel.get(a.targetId);
  if (a.targetType === "verification" && typeof a.meta?.tutor === "string") return dir.name(a.meta.tutor);
  return undefined;
}

function actorSub(id: string, dir: Directory): string | undefined {
  if (id === "system") return "Automated";
  const u = dir.userById.get(id);
  return u ? ROLE_LABEL[u.role] : undefined;
}

export function AuditLogView() {
  return (
    <PermissionGate permission="audit.read">
      <AuditInner />
    </PermissionGate>
  );
}

function AuditInner() {
  const auditLogs = useApp((s) => s.auditLogs);
  const flags = useApp((s) => s.flags);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const now = useNow(60_000);

  // ?q= (e.g. from another admin page) prefills the search; re-sync when it changes.
  const qParam = useSearchParams().get("q") ?? "";
  const [q, setQ] = React.useState(qParam);
  const [lastQ, setLastQ] = React.useState(qParam);
  if (lastQ !== qParam) {
    setLastQ(qParam);
    setQ(qParam);
  }
  const [actor, setActor] = React.useState("all");
  const [prefix, setPrefix] = React.useState("all");
  const [range, setRange] = React.useState<DateRange>("all");
  const [openId, setOpenId] = useUrlParam("id");

  const sorted = React.useMemo(() => sortAudit(auditLogs), [auditLogs]);
  const flagLabel = React.useMemo(() => new Map(flags.map((f) => [f.key, f.label])), [flags]);

  const actorOptions = React.useMemo(() => {
    const ids = Array.from(new Set(sorted.map((a) => a.actorId)));
    return [{ value: "all", label: "Any actor" }, ...ids.map((id) => ({ value: id, label: dir.name(id) })).sort((a, b) => a.label.localeCompare(b.label))];
  }, [sorted, dir]);

  const prefixOptions = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of sorted) counts.set(prefixOf(a.action), (counts.get(prefixOf(a.action)) ?? 0) + 1);
    const order = (p: string) => (AUDIT_PREFIXES.includes(p) ? AUDIT_PREFIXES.indexOf(p) : AUDIT_PREFIXES.length);
    const present = Array.from(counts.keys()).sort((a, b) => order(a) - order(b) || a.localeCompare(b));
    return [{ value: "all", label: "Any action" }, ...present.map((p) => ({ value: p, label: `${humanize(p)} (${counts.get(p)})` }))];
  }, [sorted]);

  const rows = React.useMemo(
    () =>
      sorted.filter((a) => {
        if (actor !== "all" && a.actorId !== actor) return false;
        if (prefix !== "all" && prefixOf(a.action) !== prefix) return false;
        if (range !== "all" && now - new Date(a.createdAt).getTime() > RANGE_MS[range]) return false;
        const metaStr = a.meta ? Object.entries(a.meta).map(([k, v]) => `${k} ${metaText(v)}`).join(" ") : "";
        return matches(q, a.id, a.action, describeAudit(a), a.targetType, a.targetId, targetName(a, dir, flagLabel), dir.name(a.actorId), metaStr);
      }),
    [sorted, actor, prefix, range, now, q, dir, flagLabel],
  );

  const filtered = q.trim() !== "" || actor !== "all" || prefix !== "all" || range !== "all";

  const columns: Column<AuditLog>[] = [
    {
      key: "time",
      header: "Time",
      sortValue: (a) => a.createdAt,
      cell: (a) => (
        <span className="whitespace-nowrap tabular-nums" title={a.createdAt}>
          {formatDate(a.createdAt, tz, STAMP)}
        </span>
      ),
    },
    { key: "actor", header: "Actor", sortValue: (a) => dir.name(a.actorId), cell: (a) => <PersonCell name={dir.name(a.actorId)} sub={actorSub(a.actorId, dir)} className="max-w-44" /> },
    {
      key: "action",
      header: "Action",
      sortValue: (a) => a.action,
      cell: (a) => (
        <span className="block min-w-0 max-w-64">
          <ActionCode action={a.action} />
          <span className="mt-1 block truncate text-[12px] text-muted">{describeAudit(a)}</span>
        </span>
      ),
    },
    { key: "target", header: "Target", sortValue: (a) => `${a.targetType}:${a.targetId}`, cell: (a) => <TargetCell entry={a} name={targetName(a, dir, flagLabel)} /> },
    { key: "meta", header: "Details", cell: (a) => <MetaChips meta={a.meta} max={3} className="max-w-72" /> },
  ];

  const open = sorted.find((a) => a.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every privileged action taken by staff, newest first. Entries are append-only — they can't be edited or deleted."
        actions={
          <ExportButton
            filename="tutorlink-audit-log"
            headers={["ID", "Time (UTC)", "Actor ID", "Actor", "Action", "Target type", "Target ID", "Details"]}
            rows={() => rows.map((a) => [a.id, a.createdAt, a.actorId, dir.name(a.actorId), a.action, a.targetType, a.targetId, a.meta ? JSON.stringify(a.meta) : ""])}
          />
        }
      />

      <Toolbar summary={pluralize(rows.length, "entry", "entries")}>
        <SearchInput value={q} onChange={setQ} placeholder="Search actions, targets, people…" label="Search the audit log" />
        <FilterSelect label="Actor" value={actor} onChange={setActor} options={actorOptions} />
        <FilterSelect label="Action type" value={prefix} onChange={setPrefix} options={prefixOptions} />
        <FilterSelect label="Date range" value={range} onChange={setRange} options={DATE_OPTIONS} />
        <ClearFilters
          active={filtered}
          onClear={() => {
            setQ("");
            setActor("all");
            setPrefix("all");
            setRange("all");
          }}
        />
      </Toolbar>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(a) => a.id}
        onRowClick={(a) => setOpenId(a.id)}
        mobileTitle="action"
        pageSize={15}
        empty={
          <EmptyState
            icon={<ScrollText />}
            title={filtered ? "No entries match these filters" : "No audit entries yet"}
            description={filtered ? "Try a wider date range, another actor or action type, or clear the filters." : "Staff actions such as suspensions, verification decisions, refunds and flag changes are recorded here."}
          />
        }
      />

      <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-muted">
        <Lock className="size-3.5 shrink-0" aria-hidden /> Times are shown in your time zone ({tz}). Entries are written by the system when an action succeeds and can&apos;t be changed.
      </p>

      <AuditSheet entry={open} all={sorted} onClose={() => setOpenId(null)} onOpen={setOpenId} flagLabel={flagLabel} />
    </>
  );
}

function TargetCell({ entry, name }: { entry: AuditLog; name?: string }) {
  const href = auditTargetHref(entry.targetType, entry.targetId);
  const body = (
    <>
      <span className={cn("block truncate text-ink", href && "underline-offset-4 group-hover:text-ink group-hover:underline")}>
        {humanize(entry.targetType)}
        {name && name !== entry.targetId ? <span className="text-ink-2"> · {name}</span> : null}
      </span>
      <Mono className="block truncate">{entry.targetId}</Mono>
    </>
  );
  if (!href) return <span className="block min-w-0 max-w-56">{body}</span>;
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="group relative block min-w-0 max-w-56 rounded-sm pr-5"
      aria-label={`Open ${entry.targetType} ${entry.targetId}${name && name !== entry.targetId ? ` (${name})` : ""}`}
    >
      {body}
      <ArrowUpRight className="absolute right-0 top-0.5 size-3.5 text-muted group-hover:text-ink" aria-hidden />
    </Link>
  );
}

/* ─── Detail drawer ──────────────────────────────────────────────────────────── */

function AuditSheet({ entry: current, all, onClose, onOpen, flagLabel }: { entry: AuditLog | null; all: AuditLog[]; onClose: () => void; onOpen: (id: string) => void; flagLabel: Map<string, string> }) {
  const entry = useSticky(current);
  return (
    <Sheet open={!!current} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        title={entry ? describeAudit(entry) : "Audit entry"}
        description={entry ? `${entry.action} · ${entry.id}` : undefined}
        className="sm:w-[34rem]"
        footer={
          <p className="flex items-start gap-2 text-[13px] text-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Audit entries are append-only. They can&apos;t be edited or deleted — from this panel or anywhere else.
          </p>
        }
      >
        {entry && <AuditDetail entry={entry} all={all} onOpen={onOpen} flagLabel={flagLabel} />}
      </SheetContent>
    </Sheet>
  );
}

function AuditDetail({ entry, all, onOpen, flagLabel }: { entry: AuditLog; all: AuditLog[]; onOpen: (id: string) => void; flagLabel: Map<string, string> }) {
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const now = useNow(60_000);
  const href = auditTargetHref(entry.targetType, entry.targetId);
  const actorUser = dir.userById.get(entry.actorId);
  const name = targetName(entry, dir, flagLabel);
  const sameTarget = all.filter((a) => a.id !== entry.id && a.targetType === entry.targetType && a.targetId === entry.targetId).slice(0, 8);
  const meta = Object.entries(entry.meta ?? {});

  return (
    <div className="divide-y divide-line">
      <Section title="Entry">
        <Facts
          items={[
            {
              label: "When",
              value: (
                <span className="block">
                  <span className="block tabular-nums">{formatDate(entry.createdAt, tz, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short" })}</span>
                  <span className="block text-[12px] font-normal text-muted">{formatRelative(entry.createdAt, now)}</span>
                </span>
              ),
            },
            {
              label: "Actor",
              value:
                entry.actorId === "system" ? (
                  "System (automated)"
                ) : actorUser ? (
                  <span className="block">
                    <TextLink href={`/admin/users?id=${encodeURIComponent(actorUser.id)}`}>{dir.name(actorUser.id)}</TextLink>
                    <span className="block text-[12px] font-normal text-muted">{ROLE_LABEL[actorUser.role]} · {actorUser.email}</span>
                  </span>
                ) : (
                  <Mono>{entry.actorId}</Mono>
                ),
            },
            { label: "Action", value: <ActionCode action={entry.action} /> },
            {
              label: "Target",
              value: (
                <span className="block">
                  <span className="block">
                    {humanize(entry.targetType)}
                    {name && name !== entry.targetId ? ` · ${name}` : ""}
                  </span>
                  <Mono className="block">{entry.targetId}</Mono>
                  {href ? (
                    <TextLink href={href} className="text-[12.5px]">
                      Open record
                    </TextLink>
                  ) : (
                    <span className="block text-[12px] font-normal text-muted">No admin page for this record type</span>
                  )}
                </span>
              ),
            },
            { label: "Entry ID", value: <Mono>{entry.id}</Mono> },
          ]}
        />
      </Section>

      <Section title="Details">
        {meta.length === 0 ? (
          <p className="text-[13px] text-muted">No additional details were recorded with this action.</p>
        ) : (
          <Facts items={meta.map(([k, v]) => ({ label: <span className="font-mono text-[12px]">{k}</span>, value: <span className="break-words">{metaText(v)}</span> }))} />
        )}
      </Section>

      <Section title="Raw entry" description="Exactly as stored.">
        <pre className="max-h-72 overflow-auto rounded-lg border border-line bg-canvas p-3 font-mono text-[12px] leading-relaxed text-ink-2">{JSON.stringify(entry, null, 2)}</pre>
      </Section>

      <Section title="Same target" description={`Other entries for ${entry.targetType} ${entry.targetId}.`}>
        {sameTarget.length === 0 ? (
          <p className="text-[13px] text-muted">No other entries for this record.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {sameTarget.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => onOpen(a.id)} className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[13px] hover:bg-canvas">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{describeAudit(a)}</span>
                    <span className="block truncate text-muted">{dir.name(a.actorId)}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">{formatDate(a.createdAt, tz, STAMP)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
