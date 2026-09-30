"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CircleDollarSign, FileCheck2, Flag, Gavel, ScrollText, UserRound } from "lucide-react";
import type { Permission } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useNow, useTutors, useViewerTimezone } from "@/lib/store/hooks";
import { zonedParts, zonedToUtc } from "@/lib/time";
import { formatCents, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { subjectName } from "@/lib/data/catalog";
import { VERIFICATION_LABEL } from "@/components/domain/Badges";
import { PageHeader } from "@/components/dashboard/Shell";
import { AreaChart, ColumnChart, StatTile } from "@/components/charts";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Stagger, StaggerItem } from "@/components/motion";
import { cn } from "@/lib/utils";
import { Mono, PermissionNotice, formatAge, humanize, settledNet, useDirectory, useStaff } from "./kit";

const DAY = 86_400_000;
const WEEKS = 8;
const OPEN_DISPUTE = ["open", "under_review", "awaiting_information", "escalated"];
const OPEN_REPORT = ["open", "reviewing"];

export const DISPUTE_REASON_LABEL: Record<string, string> = {
  missed_session: "Missed session",
  tutor_no_show: "Tutor no-show",
  student_no_show: "Student no-show",
  service_issue: "Service issue",
  payment_issue: "Payment issue",
  refund_issue: "Refund issue",
  other: "Other",
};

/** Monday 00:00 (viewer time zone) of the week containing `now`, then the previous weeks. */
function weekStarts(now: number, tz: string, count: number): number[] {
  const p = zonedParts(new Date(now), tz);
  const sinceMonday = (p.weekday + 6) % 7;
  return Array.from({ length: count }, (_, i) => zonedToUtc(p.year, p.month, p.day - sinceMonday - (count - 1 - i) * 7, 0, 0, tz).getTime());
}

function bucketIndex(t: number, starts: number[]): number {
  for (let i = starts.length - 1; i >= 0; i--) {
    if (t >= starts[i]) return t < starts[i] + 7 * DAY ? i : -1;
  }
  return -1;
}

function pctChange(current: number, previous: number): number | undefined {
  if (previous <= 0) return undefined;
  return Math.round(((current - previous) / previous) * 100);
}

export function OverviewView() {
  const bookings = useApp((s) => s.bookings);
  const payments = useApp((s) => s.payments);
  const disputes = useApp((s) => s.disputes);
  const reports = useApp((s) => s.reports);
  const verification = useApp((s) => s.verificationRequests);
  const auditLogs = useApp((s) => s.auditLogs);
  const tutors = useTutors();
  const dir = useDirectory();
  const { me, can } = useStaff();
  const tz = useViewerTimezone();
  const now = useNow(60_000);

  const m = React.useMemo(() => {
    const starts = weekStarts(now, tz, WEEKS);
    const counted = bookings.filter((b) => b.status !== "rescheduled");
    const perWeek = Array(WEEKS).fill(0) as number[];
    for (const b of counted) {
      const i = bucketIndex(new Date(b.startUtc).getTime(), starts);
      if (i >= 0) perWeek[i]++;
    }
    const bookingPayments = payments.filter((p) => p.kind === "booking");
    const gmv = settledNet(bookingPayments);
    const gmvWeeks = starts.map((_, i) => settledNet(bookingPayments.filter((p) => bucketIndex(new Date(p.createdAt).getTime(), starts) === i)).net);

    const activeTutorIds = new Set(
      bookings
        .filter((b) => ["pending", "confirmed", "in_progress", "completed"].includes(b.status) && Math.abs(new Date(b.startUtc).getTime() - now) <= 30 * DAY)
        .map((b) => b.tutorId),
    );
    const queue = verification.filter((v) => v.status === "submitted" || v.status === "under_review").sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    const openDisputes = disputes.filter((d) => OPEN_DISPUTE.includes(d.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const openReports = reports.filter((r) => OPEN_REPORT.includes(r.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const labels = starts.map((s) => formatDate(new Date(s).toISOString(), tz, { month: "short", day: "numeric" }));
    return {
      labels,
      perWeek,
      gmv,
      gmvWeeks,
      activeTutors: activeTutorIds.size,
      queue,
      openDisputes,
      openReports,
      recent: [...auditLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 7),
    };
  }, [bookings, payments, disputes, reports, verification, auditLogs, now, tz]);

  const thisWeek = m.perWeek[WEEKS - 1];
  const lastWeek = m.perWeek[WEEKS - 2];
  const hour = zonedParts(new Date(now), tz).hour;
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const bookingByid = new Map(bookings.map((b) => [b.id, b]));

  return (
    <>
      <PageHeader
        eyebrow={<p className="text-[13px] font-medium text-muted">{formatDate(new Date(now).toISOString(), tz, { weekday: "long", month: "long", day: "numeric" })}</p>}
        title={<>{greeting}, <span className="marker">{me?.firstName ?? "there"}</span></>}
        description="Marketplace health and the queues that need a decision. Figures come from this preview's sample data."
      />

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.05}>
        {can("payments.read") && (
          <StaggerItem>
            <StatTile
              label="GMV (settled)"
              value={formatCents(m.gmv.net)}
              icon={<CircleDollarSign />}
              trend={m.gmvWeeks}
              hint={<span>Booking charges {formatCents(m.gmv.gross)} − refunds {formatCents(m.gmv.refunds)}</span>}
            />
          </StaggerItem>
        )}
        <StaggerItem>
          <StatTile
            label="Bookings this week"
            value={thisWeek}
            icon={<BookOpen />}
            trend={m.perWeek}
            delta={pctChange(thisWeek, lastWeek)}
            deltaLabel="vs last week"
            hint={pctChange(thisWeek, lastWeek) === undefined ? <span>{lastWeek} last week · by lesson start, Mon–Sun</span> : undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile label="Active tutors" value={m.activeTutors} icon={<UserRound />} hint={<span>Lessons within ±30 days · of {tutors.length} listed</span>} />
        </StaggerItem>
        <StaggerItem>
          <AttentionTile label="Verification queue" value={m.queue.length} icon={<FileCheck2 />} href="/admin/verification" permission="tutors.verify" hint={m.queue[0] ? `Oldest waiting ${formatAge(now - new Date(m.queue[0].submittedAt).getTime())}` : "Nothing waiting"} />
        </StaggerItem>
        <StaggerItem>
          <AttentionTile label="Open disputes" value={m.openDisputes.length} icon={<Gavel />} href="/admin/disputes" permission="disputes.manage" hint={m.openDisputes[0] ? `Oldest opened ${formatAge(now - new Date(m.openDisputes[0].createdAt).getTime())} ago` : "Nothing open"} />
        </StaggerItem>
        <StaggerItem>
          <AttentionTile label="Open reports" value={m.openReports.length} icon={<Flag />} href="/admin/reports" permission="reports.moderate" hint={`${m.openReports.filter((r) => r.status === "open").length} new · ${m.openReports.filter((r) => r.status === "reviewing").length} in review`} />
        </StaggerItem>
      </Stagger>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Bookings per week" description={`Last ${WEEKS} weeks by lesson start (excludes rescheduled originals)`} />
          <div className="px-3 pb-4 pt-3 sm:px-5">
            <ColumnChart data={m.labels.map((label, i) => ({ label, value: m.perWeek[i] }))} caption="Bookings per week" height={220} />
          </div>
        </Card>
        {can("payments.read") ? (
          <Card>
            <CardHeader title="GMV by week" description="Settled booking charges minus refunds, by payment date" />
            <div className="px-3 pb-4 pt-3 sm:px-5">
              <AreaChart data={m.labels.map((label, i) => ({ label, value: Math.max(0, m.gmvWeeks[i]) }))} caption="GMV by week" format={(n) => formatCents(Math.round(n))} height={220} />
            </div>
          </Card>
        ) : (
          <Card className="p-5">
            <PermissionNotice permission="payments.read">Revenue charts require</PermissionNotice>
          </Card>
        )}
      </div>

      <h2 className="mb-3 mt-8 text-[15px] font-semibold tracking-tight text-ink">Needs attention</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <QueueCard title="Pending verifications" href="/admin/verification" permission="tutors.verify" count={m.queue.length} empty="No documents waiting for review.">
          {m.queue.slice(0, 5).map((v) => (
            <QueueRow
              key={v.id}
              href={`/admin/verification?id=${v.id}`}
              title={dir.name(v.tutorId)}
              sub={VERIFICATION_LABEL[v.kind]}
              right={<Badge size="sm" tone={v.status === "under_review" ? "warning" : "accent"}>{v.status === "under_review" ? "In review" : "Submitted"}</Badge>}
              age={formatAge(now - new Date(v.submittedAt).getTime())}
            />
          ))}
        </QueueCard>
        <QueueCard title="Open disputes" href="/admin/disputes" permission="disputes.manage" count={m.openDisputes.length} empty="No open disputes.">
          {m.openDisputes.slice(0, 5).map((d) => {
            const b = bookingByid.get(d.bookingId);
            return (
              <QueueRow
                key={d.id}
                href={`/admin/disputes/${d.id}`}
                title={DISPUTE_REASON_LABEL[d.reason]}
                sub={b ? `${subjectName(b.subject)} · ${formatCents(b.priceCents - b.discountCents)} at stake` : d.bookingId}
                right={<Badge size="sm" tone={d.status === "escalated" ? "danger" : d.status === "open" ? "warning" : "neutral"}>{humanize(d.status)}</Badge>}
                age={formatAge(now - new Date(d.createdAt).getTime())}
              />
            );
          })}
        </QueueCard>
        <QueueCard title="Open reports" href="/admin/reports" permission="reports.moderate" count={m.openReports.length} empty="No open reports.">
          {m.openReports.slice(0, 5).map((r) => (
            <QueueRow
              key={r.id}
              href={`/admin/reports?id=${r.id}`}
              title={r.reason}
              sub={`${r.targetType[0].toUpperCase()}${r.targetType.slice(1)} · reported by ${dir.name(r.reporterId)}`}
              right={<Badge size="sm" tone={r.status === "open" ? "warning" : "neutral"}>{humanize(r.status)}</Badge>}
              age={formatAge(now - new Date(r.createdAt).getTime())}
            />
          ))}
        </QueueCard>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Recent staff activity"
          description="Latest privileged actions from the audit log"
          action={
            can("audit.read") ? (
              <Link href="/admin/audit-log" className="inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:underline">
                Audit log <ArrowRight className="size-3.5" />
              </Link>
            ) : undefined
          }
        />
        <div className="p-5 pt-3">
          {!can("audit.read") ? (
            <PermissionNotice permission="audit.read">The audit log requires</PermissionNotice>
          ) : m.recent.length === 0 ? (
            <p className="text-[13px] text-muted">No staff actions recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {m.recent.map((a) => (
                <li key={a.id} className="flex flex-col gap-1 py-2.5 text-[13px] sm:flex-row sm:items-center sm:gap-4">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <ScrollText className="size-3.5 shrink-0 text-subtle" aria-hidden />
                    <span className="truncate text-ink">
                      <span className="font-medium">{dir.name(a.actorId)}</span> <Mono className="text-ink-2">{a.action}</Mono> <span className="text-muted">on</span> <Mono>{a.targetId}</Mono>
                    </span>
                  </span>
                  <span className="shrink-0 pl-5.5 tabular-nums text-muted sm:pl-0" title={formatDateTime(a.createdAt, tz)}>
                    {formatRelative(a.createdAt, now)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </>
  );
}

function AttentionTile({ label, value, icon, href, permission, hint }: { label: string; value: number; icon: React.ReactNode; href: string; permission: Permission; hint: string }) {
  const { can } = useStaff();
  const tile = <StatTile label={label} value={value} icon={icon} hint={<span>{hint}</span>} />;
  if (!can(permission)) return tile;
  return (
    <Link href={href} className="block rounded-xl [&>div]:transition-colors hover:[&>div]:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" aria-label={`${label}: ${value}. Open queue`}>
      {tile}
    </Link>
  );
}

function QueueCard({ title, href, permission, count, empty, children }: { title: string; href: string; permission: Permission; count: number; empty: string; children: React.ReactNode }) {
  const { can } = useStaff();
  const allowed = can(permission);
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {title}
            <span className="rounded-md bg-canvas px-1.5 py-px text-[11px] font-semibold tabular-nums text-ink-2">{count}</span>
          </span>
        }
        action={
          allowed && count > 0 ? (
            <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:underline">
              View all <ArrowRight className="size-3.5" />
            </Link>
          ) : undefined
        }
      />
      <div className="flex-1 p-3 pt-2">
        {!allowed ? (
          <div className="p-2">
            <PermissionNotice permission={permission}>This queue is worked by staff with</PermissionNotice>
          </div>
        ) : count === 0 ? (
          <p className="px-2 py-6 text-center text-[13px] text-muted">{empty}</p>
        ) : (
          <ul className="space-y-px">{children}</ul>
        )}
      </div>
    </Card>
  );
}

function QueueRow({ href, title, sub, right, age }: { href: string; title: string; sub: string; right: React.ReactNode; age: string }) {
  return (
    <li>
      <Link href={href} className={cn("group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-canvas")}>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-ink group-hover:text-ink">{title}</span>
          <span className="block truncate text-[12px] text-muted">{sub}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {right}
          <span className="text-[11.5px] tabular-nums text-muted" title="Time waiting">
            {age}
          </span>
        </span>
      </Link>
    </li>
  );
}

