"use client";

import * as React from "react";
import { ArrowUpRight, CircleSlash, FileText, Flag, LockKeyhole, LockOpen, MessageSquareWarning, PauseCircle, RotateCcw, ShieldAlert, TriangleAlert, UserRoundX } from "lucide-react";
import type { ContactFlag, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useNow, useViewerTimezone } from "@/lib/store/hooks";
import { ROLE_LABEL } from "@/lib/data/users";
import { formatDateTime, pluralize } from "@/lib/format";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Disclosure";
import { Sheet, SheetContent } from "@/components/ui/Overlay";
import { Badge } from "@/components/ui/Badge";
import { Field, Select } from "@/components/ui/Input";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import {
  ClearFilters, ExportButton, Facts, FilterSelect, MiniStat, PermissionButton, PermissionNotice, PersonCell, ReasonDialog, RowOpen, SearchInput, Section,
  StatusPill, TextLink, Timeline, Toolbar, formatAge, fullName, matches, useDirectory, useStaff, useSticky, useUrlParam,
} from "./kit";
import { REPORT_STATUS_META } from "./ReportsView";
import { auditTone, describeAudit, sortAudit } from "./AuditLogView";

/*
 * Admin → Chat safety. Every message, homework note, file and profile photo that was stopped because it
 * contained a phone number, email or other-app contact is listed here, with the contact details already
 * removed (they're never stored). Moderators warn people, pause their messaging or suspend the account;
 * every action is written to the audit log. Requires reports.moderate (suspending also needs users.write).
 */

type Kind = ContactFlag["kinds"][number];
type FlagStatus = ContactFlag["status"];

const KIND_LABEL: Record<Kind, string> = { phone: "Phone number", email: "Email", social: "Social / app", link: "Outside link" };
const STATUS_META: Record<FlagStatus, { label: string; tone: "warning" | "success" | "neutral" }> = {
  open: { label: "Needs review", tone: "warning" },
  actioned: { label: "Dealt with", tone: "success" },
  dismissed: { label: "Dismissed", tone: "neutral" },
};
const DURATIONS = [
  { value: "24", label: "24 hours" },
  { value: "72", label: "3 days" },
  { value: "168", label: "7 days" },
  { value: "720", label: "30 days" },
];
const DAY = 86_400_000;

function whereLabel(f: ContactFlag): string {
  if (f.channel === "profile") return f.source === "file" ? "Profile photo" : "Profile";
  if (f.channel === "lesson") return "Lesson note or goal";
  const what = f.channel === "homework" ? "Homework" : "Chat";
  return `${what} ${f.source === "file" ? "file" : f.channel === "homework" ? "note" : "message"}`;
}

function Kinds({ kinds }: { kinds: Kind[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {kinds.map((k) => (
        <Badge key={k} size="sm" tone="danger">
          {KIND_LABEL[k]}
        </Badge>
      ))}
    </span>
  );
}

const pausedUntil = (u: User | undefined, now: number) => {
  const until = u?.chatModeration?.restrictedUntil;
  return until && new Date(until).getTime() > now ? until : null;
};

interface Person {
  id: string;
  user?: User;
  name: string;
  flags: ContactFlag[];
  open: number;
  last: string;
  kinds: Kind[];
  paused: string | null;
  /** When they asked to unlock (only while still paused). */
  requested: string | null;
  warnings: number;
}

/** One click: unlocks a paused person's messaging. They're told, and the audit log gets a standard reason. */
export function UnlockChatButton({ user, className }: { user: User; className?: string }) {
  const restrict = useApp((s) => s.restrictChat);
  const [busy, setBusy] = React.useState(false);
  return (
    <PermissionButton
      permission="reports.moderate"
      size="sm"
      className={className}
      loading={busy}
      onClick={async (e: React.MouseEvent) => {
        e.stopPropagation();
        setBusy(true);
        const res = await restrict(user.id, 0, user.chatModeration?.unlockRequestedAt ? "Unlock request approved" : "Unlocked by staff");
        setBusy(false);
        if (!res.ok) return void toast.error(res.error);
        toast.success(`${user.firstName}'s chat is unlocked`, { description: "They've been told and can message again. Recorded in the audit log." });
      }}
    >
      <LockOpen /> Unlock chat
    </PermissionButton>
  );
}

/** A paused person's messaging at a glance: why, until when, their unlock request, and one-click answers. */
export function ChatPauseControls({ user, className }: { user: User; className?: string }) {
  const decline = useApp((s) => s.declineChatUnlock);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const now = useNow(60_000);
  const [busy, setBusy] = React.useState(false);
  const until = pausedUntil(user, now);
  const cm = user.chatModeration;
  if (!until || !cm) return null;
  const asked = cm.unlockRequestedAt;
  return (
    <div className={cn("rounded-lg border border-warning-200 bg-warning-50/60 px-3.5 py-3 text-[13px] leading-snug", className)}>
      <p className="flex items-center gap-1.5 font-semibold text-ink">
        <LockKeyhole className="size-4 shrink-0 text-warning" aria-hidden /> Messaging paused until {formatDateTime(until, tz)}
      </p>
      <p className="mt-1 text-ink-2">
        {cm.restrictedBy === "system" ? "Automatic pause after repeated attempts to share contact details." : `Paused by ${dir.name(cm.restrictedBy)}${cm.restrictionReason ? `: ${cm.restrictionReason}` : "."}`}
      </p>
      {asked && (
        <p className="mt-2.5 rounded-md border border-line bg-surface px-3 py-2 text-ink">
          <span className="font-medium">{user.firstName} asked to unlock</span> {formatAge(now - new Date(asked).getTime())} ago
          {cm.unlockRequestNote ? <span className="mt-1 block text-ink-2">“{cm.unlockRequestNote}”</span> : "."}
        </p>
      )}
      {cm.unlockDeclinedAt && <p className="mt-2 text-muted">An unlock request was declined {formatAge(now - new Date(cm.unlockDeclinedAt).getTime())} ago.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <UnlockChatButton user={user} />
        {asked && (
          <PermissionButton
            permission="reports.moderate"
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const res = await decline(user.id);
              setBusy(false);
              if (!res.ok) return void toast.error(res.error);
              toast.success("Kept paused", { description: `${user.firstName} has been told. Recorded in the audit log.` });
            }}
          >
            <LockKeyhole /> Keep paused
          </PermissionButton>
        )}
      </div>
    </div>
  );
}

export function ChatSafetyView() {
  return (
    <PermissionGate permission="reports.moderate">
      <ChatSafetyInner />
    </PermissionGate>
  );
}

function ChatSafetyInner() {
  const flags = useApp((s) => s.contactFlags);
  const reports = useApp((s) => s.reports);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const now = useNow(60_000);

  const [personId, setPersonId] = useUrlParam("user");
  const [tab, setTab] = React.useState<"people" | "log" | "reported">("people");
  const [q, setQ] = React.useState("");
  const [who, setWho] = React.useState<"review" | "paused" | "all">("review");
  const [kind, setKind] = React.useState<"all" | Kind>("all");
  const [status, setStatus] = React.useState<"all" | FlagStatus>("all");

  const people = React.useMemo<Person[]>(() => {
    const byUser = new Map<string, ContactFlag[]>();
    for (const f of flags) byUser.set(f.userId, [...(byUser.get(f.userId) ?? []), f]);
    // People paused by staff without any entry still show under "Paused now".
    for (const u of dir.users) if (pausedUntil(u, now) && !byUser.has(u.id)) byUser.set(u.id, []);
    return [...byUser.entries()].map(([id, list]) => {
      const user = dir.userById.get(id);
      return {
        id,
        user,
        name: dir.name(id),
        flags: list,
        open: list.filter((f) => f.status === "open").length,
        last: list.reduce((m, f) => (f.createdAt > m ? f.createdAt : m), ""),
        kinds: [...new Set(list.flatMap((f) => f.kinds))],
        paused: pausedUntil(user, now),
        requested: pausedUntil(user, now) ? (user?.chatModeration?.unlockRequestedAt ?? null) : null,
        warnings: user?.chatModeration?.warnings ?? 0,
      };
    });
  }, [flags, dir, now]);

  const stats = React.useMemo(
    () => ({
      day: flags.filter((f) => now - new Date(f.createdAt).getTime() < DAY).length,
      week: flags.filter((f) => now - new Date(f.createdAt).getTime() < 7 * DAY).length,
      review: people.filter((p) => p.open > 0 || p.requested).length,
      paused: people.filter((p) => p.paused).length,
    }),
    [flags, people, now],
  );

  const peopleRows = React.useMemo(
    () =>
      people
        .filter((p) => (who === "review" ? p.open > 0 || !!p.requested : who === "paused" ? !!p.paused : true) && matches(q, p.name, p.id, p.user?.email))
        // Unlock requests first, then the most entries to review.
        .sort((a, b) => Number(!!b.requested) - Number(!!a.requested) || b.open - a.open || b.last.localeCompare(a.last)),
    [people, who, q],
  );
  const logRows = React.useMemo(
    () =>
      flags
        .filter((f) => (kind === "all" || f.kinds.includes(kind)) && (status === "all" || f.status === status) && matches(q, dir.name(f.userId), dir.name(f.recipientId), f.excerpt, f.fileName, whereLabel(f)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [flags, kind, status, q, dir],
  );
  const reported = React.useMemo(
    () => reports.filter((r) => r.targetType === "message" && matches(q, r.reason, r.details, dir.name(r.reporterId))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reports, q, dir],
  );
  const openReported = reported.filter((r) => r.status === "open" || r.status === "reviewing").length;

  const filtered = q.trim() !== "" || kind !== "all" || status !== "all" || who !== "review";
  const clear = () => {
    setQ("");
    setKind("all");
    setStatus("all");
    setWho("review");
  };

  const peopleColumns: Column<Person>[] = [
    {
      key: "person",
      header: "Person",
      sortValue: (p) => p.name,
      cell: (p) => (
        <RowOpen onOpen={() => setPersonId(p.id)} label={`Open ${p.name}`}>
          <PersonCell name={p.name} sub={p.user ? ROLE_LABEL[p.user.role] : undefined} />
        </RowOpen>
      ),
    },
    { key: "open", header: "Needs review", align: "right", sortValue: (p) => p.open, cell: (p) => <span className={cn("font-semibold tabular-nums", p.open ? "text-ink" : "text-muted")}>{p.open}</span> },
    { key: "total", header: "All attempts", align: "right", sortValue: (p) => p.flags.length, cell: (p) => <span className="tabular-nums">{p.flags.length}</span>, hideOnMobile: true },
    { key: "kinds", header: "Tried to share", cell: (p) => (p.kinds.length ? <Kinds kinds={p.kinds} /> : <span className="text-muted">—</span>) },
    { key: "last", header: "Last attempt", sortValue: (p) => p.last, cell: (p) => <span className="whitespace-nowrap tabular-nums text-ink-2">{p.last ? `${formatAge(now - new Date(p.last).getTime())} ago` : "—"}</span> },
    {
      key: "state",
      header: "Messaging",
      sortValue: (p) => (p.user?.status === "suspended" ? 2 : p.paused ? 1 : 0),
      cell: (p) =>
        p.user?.status === "suspended" ? (
          <StatusPill tone="danger">Account suspended</StatusPill>
        ) : p.paused ? (
          <span className="flex flex-col items-start gap-1">
            <StatusPill tone="warning">Paused until {formatDateTime(p.paused, tz)}</StatusPill>
            {p.requested && (
              <Badge size="sm" tone="accent">
                Asked to unlock
              </Badge>
            )}
          </span>
        ) : (
          <StatusPill tone="success">Active</StatusPill>
        ),
    },
    { key: "warnings", header: "Warnings", align: "right", sortValue: (p) => p.warnings, cell: (p) => <span className="tabular-nums">{p.warnings}</span>, hideOnMobile: true },
    {
      key: "unlock",
      header: <span className="sr-only">Unlock</span>,
      cell: (p) => (p.paused && p.user && p.user.status !== "suspended" ? <UnlockChatButton user={p.user} className="whitespace-nowrap" /> : null),
    },
  ];

  const logColumns: Column<ContactFlag>[] = [
    {
      key: "when",
      header: "When",
      sortValue: (f) => f.createdAt,
      cell: (f) => (
        <RowOpen onOpen={() => setPersonId(f.userId)} label={`Open ${dir.name(f.userId)}`} className="whitespace-nowrap tabular-nums">
          {formatAge(now - new Date(f.createdAt).getTime())} ago
        </RowOpen>
      ),
    },
    { key: "who", header: "From", sortValue: (f) => dir.name(f.userId), cell: (f) => <PersonCell name={dir.name(f.userId)} sub={f.recipientId ? `to ${dir.name(f.recipientId)}` : undefined} /> },
    { key: "where", header: "Where", sortValue: (f) => whereLabel(f), cell: (f) => <span className="whitespace-nowrap text-ink-2">{whereLabel(f)}</span>, hideOnMobile: true },
    { key: "kinds", header: "Found", cell: (f) => <Kinds kinds={f.kinds} /> },
    { key: "excerpt", header: "What was stopped", cell: (f) => <span className="block max-w-80 truncate text-ink-2">{f.excerpt}</span> },
    { key: "status", header: "Status", sortValue: (f) => f.status, cell: (f) => <StatusPill tone={STATUS_META[f.status].tone}>{STATUS_META[f.status].label}</StatusPill> },
  ];

  const open = people.find((p) => p.id === personId) ?? null;

  return (
    <>
      <PageHeader
        title="Chat safety"
        description="Messages, homework notes, files and profile photos that were stopped for containing phone numbers, emails or other-app contacts. They were never delivered, and the contact details themselves aren't stored. Actions are written to the audit log."
        actions={
          <ExportButton
            filename="tutorlink-chat-safety"
            headers={["ID", "When (UTC)", "From", "From ID", "To", "Where", "Found", "What was stopped (contact details removed)", "File", "Status"]}
            rows={() => logRows.map((f) => [f.id, f.createdAt, dir.name(f.userId), f.userId, f.recipientId ? dir.name(f.recipientId) : "", whereLabel(f), f.kinds.map((k) => KIND_LABEL[k]).join(", "), f.excerpt, f.fileName ?? "", STATUS_META[f.status].label])}
          />
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Stopped, last 24 hours" value={stats.day} />
        <MiniStat label="Stopped, last 7 days" value={stats.week} />
        <MiniStat label="People to review" value={stats.review} tone={stats.review ? "warning" : undefined} />
        <MiniStat label="Messaging paused now" value={stats.paused} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList aria-label="Chat safety views">
          <TabsTrigger value="people" count={stats.review}>People</TabsTrigger>
          <TabsTrigger value="log" count={flags.filter((f) => f.status === "open").length}>All attempts</TabsTrigger>
          <TabsTrigger value="reported" count={openReported}>Reported messages</TabsTrigger>
        </TabsList>

        <TabsContent value="people">
          <Toolbar summary={pluralize(peopleRows.length, "person", "people")}>
            <SearchInput value={q} onChange={setQ} placeholder="Search name or email…" label="Search people" />
            <FilterSelect
              label="Show"
              value={who}
              onChange={setWho}
              options={[
                { value: "review", label: "Needs review" },
                { value: "paused", label: "Messaging paused" },
                { value: "all", label: "Everyone with attempts" },
              ]}
            />
            <ClearFilters active={filtered} onClear={clear} />
          </Toolbar>
          <DataTable
            rows={peopleRows}
            columns={peopleColumns}
            rowKey={(p) => p.id}
            onRowClick={(p) => setPersonId(p.id)}
            mobileTitle="person"
            pageSize={12}
            empty={
              <EmptyState
                icon={<MessageSquareWarning />}
                title={who === "review" && !q ? "Nobody needs review" : "No one matches"}
                description={who === "review" && !q ? "When someone tries to share contact details, they appear here." : "Try another name, or clear the filters."}
              />
            }
          />
        </TabsContent>

        <TabsContent value="log">
          <Toolbar summary={pluralize(logRows.length, "attempt")}>
            <SearchInput value={q} onChange={setQ} placeholder="Search person, text or file…" label="Search attempts" />
            <FilterSelect
              label="Found"
              value={kind}
              onChange={setKind}
              options={[{ value: "all", label: "Anything" }, ...(Object.keys(KIND_LABEL) as Kind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))]}
            />
            <FilterSelect
              label="Status"
              value={status}
              onChange={setStatus}
              options={[{ value: "all", label: "Any status" }, ...(Object.keys(STATUS_META) as FlagStatus[]).map((s) => ({ value: s, label: STATUS_META[s].label }))]}
            />
            <ClearFilters active={filtered} onClear={clear} />
          </Toolbar>
          <DataTable
            rows={logRows}
            columns={logColumns}
            rowKey={(f) => f.id}
            onRowClick={(f) => setPersonId(f.userId)}
            mobileTitle="who"
            pageSize={15}
            empty={<EmptyState icon={<ShieldAlert />} title="Nothing stopped yet" description="Messages and files with contact details are listed here once someone tries to send them." />}
          />
        </TabsContent>

        <TabsContent value="reported">
          <Toolbar summary={pluralize(reported.length, "report")}>
            <SearchInput value={q} onChange={setQ} placeholder="Search reason or reporter…" label="Search reported messages" />
          </Toolbar>
          {reported.length === 0 ? (
            <EmptyState icon={<Flag />} title="No reported messages" description="When someone reports a conversation, it appears here and in Reports." />
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              {reported.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{r.reason}</p>
                    <p className="truncate text-[12.5px] text-muted">
                      Reported by {dir.name(r.reporterId)} · {formatAge(now - new Date(r.createdAt).getTime())} ago
                    </p>
                  </div>
                  <StatusPill tone={REPORT_STATUS_META[r.status].tone}>{REPORT_STATUS_META[r.status].label}</StatusPill>
                  <TextLink href={`/admin/reports?id=${encodeURIComponent(r.id)}`} className="inline-flex items-center gap-1 text-[13px]">
                    Review <ArrowUpRight className="size-3.5" aria-hidden />
                  </TextLink>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <PersonSheet person={open} onClose={() => setPersonId(null)} />
    </>
  );
}

/* ─── One person ─────────────────────────────────────────────────────────────── */

function PersonSheet({ person: current, onClose }: { person: Person | null; onClose: () => void }) {
  const person = useSticky(current);
  return (
    <Sheet open={!!current} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        title={person?.name ?? "Person"}
        description={person?.user ? `${ROLE_LABEL[person.user.role]} · chat safety` : "Chat safety"}
        className="sm:w-[36rem]"
        footer={person ? <PersonActions person={person} /> : undefined}
      >
        {person && <PersonDetail person={person} />}
      </SheetContent>
    </Sheet>
  );
}

function PersonDetail({ person }: { person: Person }) {
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const auditLogs = useApp((s) => s.auditLogs);
  const setStatus = useApp((s) => s.setContactFlagStatus);
  const { can } = useStaff();
  const u = person.user;
  const cm = u?.chatModeration;
  const history = React.useMemo(
    () => sortAudit(auditLogs.filter((a) => a.targetId === person.id && (a.action.startsWith("chat.") || a.action.startsWith("contact_flag.") || a.action.startsWith("user.")))).slice(0, 10),
    [auditLogs, person.id],
  );
  const flags = [...person.flags].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const reopen = async (f: ContactFlag) => {
    const res = await setStatus([f.id], "open");
    if (!res.ok) return void toast.error(res.error);
    toast.success("Entry reopened");
  };

  return (
    <div className="divide-y divide-line">
      {u && person.paused && u.status !== "suspended" && (
        <div className="px-5 py-4">
          <ChatPauseControls user={u} />
        </div>
      )}
      <Section title="Account">
        <Facts
          items={[
            { label: "Account", value: u ? (u.status === "suspended" ? <StatusPill tone="danger">Suspended</StatusPill> : <StatusPill tone="success">Active</StatusPill>) : "—" },
            {
              label: "Messaging",
              value: person.paused ? (
                <span className="block">
                  <StatusPill tone="warning">Paused</StatusPill>
                  <span className="mt-1 block text-[12px] font-normal text-muted">
                    until {formatDateTime(person.paused, tz)} · {cm?.restrictedBy === "system" ? "automatic (repeated attempts)" : `by ${dir.name(cm?.restrictedBy)}`}
                  </span>
                </span>
              ) : (
                <StatusPill tone="success">Can send messages</StatusPill>
              ),
            },
            { label: "Warnings", value: cm?.warnings ? `${cm.warnings}${cm.lastWarnedAt ? ` · last ${formatDateTime(cm.lastWarnedAt, tz)}` : ""}` : "None" },
            { label: "Attempts", value: `${person.flags.length} in total · ${person.open} to review` },
            ...(can("users.read") ? [{ label: "Account page", value: <TextLink href={`/admin/users?id=${encodeURIComponent(person.id)}`}>Open in Users</TextLink> }] : []),
          ]}
        />
      </Section>

      <Section title="What was stopped" description="Contact details were removed before saving. The recipient never saw these.">
        {flags.length === 0 ? (
          <p className="text-[13px] text-muted">No attempts on record. Messaging was paused by staff.</p>
        ) : (
          <ol className="space-y-2.5">
            {flags.map((f) => (
              <li key={f.id} className="rounded-lg border border-line bg-surface px-3.5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
                  <span>
                    <span className="font-medium text-ink">{whereLabel(f)}</span>
                    {f.recipientId ? ` to ${dir.name(f.recipientId)}` : ""} · {formatDateTime(f.createdAt, tz)}
                  </span>
                  <StatusPill tone={STATUS_META[f.status].tone}>{STATUS_META[f.status].label}</StatusPill>
                </div>
                <p className="mt-2 flex items-start gap-1.5 text-[13.5px] leading-relaxed text-ink-2">
                  {f.source === "file" && <FileText className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />}
                  <span className="break-words">{f.excerpt || "—"}</span>
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <Kinds kinds={f.kinds} />
                  {f.status !== "open" && (
                    <PermissionButton permission="reports.moderate" size="xs" variant="ghost" onClick={() => reopen(f)}>
                      <RotateCcw /> Reopen
                    </PermissionButton>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="History" action={can("audit.read") ? <TextLink href={`/admin/audit-log?q=${encodeURIComponent(person.id)}`} className="shrink-0 text-[12.5px]">Audit log</TextLink> : undefined}>
        <Timeline
          empty="Nothing yet."
          items={history.map((a) => ({ key: a.id, tone: auditTone(a), title: describeAudit(a), meta: `${dir.name(a.actorId)} · ${formatDateTime(a.createdAt, tz)}`, body: typeof a.meta?.reason === "string" ? `“${a.meta.reason}”` : undefined }))}
        />
      </Section>
    </div>
  );
}

function PersonActions({ person }: { person: Person }) {
  const warn = useApp((s) => s.warnChatUser);
  const restrict = useApp((s) => s.restrictChat);
  const setStatus = useApp((s) => s.setContactFlagStatus);
  const setUserStatus = useApp((s) => s.setUserStatus);
  const { me, can } = useStaff();
  const [dialog, setDialog] = React.useState<"warn" | "pause" | "suspend" | null>(null);
  const [hours, setHours] = React.useState("24");
  const u = person.user;
  const first = u?.firstName ?? person.name.split(" ")[0];
  const openIds = person.flags.filter((f) => f.status === "open").map((f) => f.id);
  const isStaff = u?.role === "admin" || u?.role === "support";

  if (!u || isStaff || u.id === me?.id) {
    return <p className="text-[13px] text-muted">{isStaff ? "Staff accounts are managed in Users." : "This account isn't available to act on."}</p>;
  }

  const done = (res: { ok: boolean; error?: string }, message: string) => {
    if (!res.ok) {
      toast.error(res.error ?? "That didn't work.");
      return false;
    }
    toast.success(message, { description: "Recorded in the audit log." });
    return true;
  };

  return (
    <div className="space-y-3">
      {u.status === "suspended" && (
        <InlineAlert tone="danger" title="Account suspended">
          {first} can&apos;t sign in or message anyone. Reactivate the account from Users.
        </InlineAlert>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {openIds.length > 0 && (
          <PermissionButton
            permission="reports.moderate"
            variant="ghost"
            size="sm"
            className="mr-auto"
            onClick={async () => done(await setStatus(openIds, "dismissed"), `${pluralize(openIds.length, "entry", "entries")} dismissed`)}
          >
            <CircleSlash /> Dismiss (false alarm)
          </PermissionButton>
        )}
        <PermissionButton permission="reports.moderate" variant="secondary" size="sm" onClick={() => setDialog("warn")}>
          <TriangleAlert /> Warn
        </PermissionButton>
        {person.paused ? (
          <UnlockChatButton user={u} />
        ) : (
          <PermissionButton permission="reports.moderate" variant="secondary" size="sm" onClick={() => setDialog("pause")}>
            <PauseCircle /> Pause messaging
          </PermissionButton>
        )}
        {u.status !== "suspended" && (
          <PermissionButton permission="users.write" variant="danger-outline" size="sm" onClick={() => setDialog("suspend")}>
            <UserRoundX /> Suspend account
          </PermissionButton>
        )}
      </div>
      {!can("users.write") && u.status !== "suspended" && <PermissionNotice permission="users.write">Suspending accounts requires</PermissionNotice>}

      <ReasonDialog
        open={dialog === "warn"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Warn ${first}?`}
        description={`${first} gets this as a notification. Open entries are marked as dealt with.`}
        label="Message"
        hint="Shown to the person and recorded in the audit log."
        minLength={10}
        initialValue={`Hi ${first}, a message you tried to send was stopped because it included contact details. For everyone's safety, please keep conversations and payments on TutorLink. Repeated attempts can lead to your messaging being paused or your account being suspended.`}
        confirmLabel="Send warning"
        onConfirm={async (note) => done(await warn(u.id, note), "Warning sent")}
      />
      <ReasonDialog
        open={dialog === "pause"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Pause ${first}'s messaging?`}
        description={`${first} can still sign in and use lessons, but can't send messages or start new chats until the pause ends. They're told why.`}
        placeholder="e.g. Kept trying to share a phone number after a warning"
        confirmLabel="Pause messaging"
        onConfirm={async (reason) => done(await restrict(u.id, Number(hours), reason), `Messaging paused for ${DURATIONS.find((d) => d.value === hours)?.label}`)}
      >
        <Field label="For how long">
          <Select value={hours} onChange={(e) => setHours(e.target.value)} options={DURATIONS} />
        </Field>
      </ReasonDialog>
      <ReasonDialog
        open={dialog === "suspend"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Suspend ${fullName(u)}?`}
        description="They won't be able to sign in, book, message or apply to jobs until reactivated. Upcoming lessons are not cancelled automatically."
        placeholder="e.g. Repeatedly shared contact details after a warning and a pause"
        confirmLabel="Suspend account"
        tone="danger"
        onConfirm={async (reason) => done(await setUserStatus(u.id, "suspended", reason), "Account suspended")}
      />
    </div>
  );
}
