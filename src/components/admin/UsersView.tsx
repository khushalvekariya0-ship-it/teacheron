"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, CircleSlash, CircleX, KeyRound, Mail, Megaphone, MoreHorizontal, Pencil, RotateCcw, Send, ShieldCheck, ShieldOff, Trash2, UserRoundX, Users } from "lucide-react";
import type { Permission, Role, User } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useNow, useViewerTimezone } from "@/lib/store/hooks";
import { ROLE_LABEL } from "@/lib/data/users";
import { subjectName } from "@/lib/data/catalog";
import { formatCents, formatDate, formatDateTime, formatRelative, pluralize } from "@/lib/format";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Disclosure";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Sheet, SheetContent } from "@/components/ui/Overlay";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox, RadioCards } from "@/components/ui/Controls";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { describeAudit } from "./AuditLogView";
import {
  ALL_PERMISSIONS, BulkBar, ClearFilters, ExportButton, Facts, FilterSelect, PERMISSION_META, PermissionButton, PermissionNotice, ReasonDialog, SearchInput, Section,
  RowOpen, StatusPill, TextLink, Timeline, Toolbar, fullName, humanize, matches, settledNet, useDirectory, useStaff, useSticky, useUrlParam,
} from "./kit";
import { ChatPauseControls } from "./ChatSafetyView";
import { POSTAL_MAX_LENGTH, postalLabel } from "@/lib/postal";
import { COUNTRIES, DEFAULT_COUNTRY } from "@/lib/location";

type TabKey = "all" | "student" | "parent" | "tutor" | "staff";
type StatusFilter = "all" | User["status"];

const TABS: { value: TabKey; label: string; roles: Role[] }[] = [
  { value: "all", label: "All", roles: ["student", "parent", "tutor", "admin", "support"] },
  { value: "student", label: "Students", roles: ["student"] },
  { value: "parent", label: "Parents", roles: ["parent"] },
  { value: "tutor", label: "Tutors", roles: ["tutor"] },
  { value: "staff", label: "Staff", roles: ["admin", "support"] },
];

export const USER_STATUS_META: Record<User["status"], { label: string; tone: "success" | "danger" | "warning" }> = {
  active: { label: "Active", tone: "success" },
  suspended: { label: "Suspended", tone: "danger" },
  pending_verification: { label: "Pending verification", tone: "warning" },
};

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Any status" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "pending_verification", label: "Pending verification" },
];

function location(u: User) {
  return [u.city, u.state].filter(Boolean).join(", ") || "—";
}

export function UsersView() {
  return (
    <PermissionGate permission="users.read">
      <UsersInner />
    </PermissionGate>
  );
}

function UsersInner() {
  const users = useApp((s) => s.users);
  const setUserStatus = useApp((s) => s.setUserStatus);
  const { me } = useStaff();
  const tz = useViewerTimezone();

  // Top-bar search arrives as ?q=; re-sync when it changes while this page is open.
  const qParam = useSearchParams().get("q") ?? "";
  const [q, setQ] = React.useState(qParam);
  const [lastQ, setLastQ] = React.useState(qParam);
  if (lastQ !== qParam) {
    setLastQ(qParam);
    setQ(qParam);
  }
  const [tab, setTab] = React.useState<TabKey>("all");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [announce, setAnnounce] = React.useState(false);
  const [openId, setOpenId] = useUrlParam("id");

  const searched = React.useMemo(
    () => users.filter((u) => matches(q, fullName(u), u.email, u.id) && (status === "all" || u.status === status)),
    [users, q, status],
  );
  const counts = React.useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.value, searched.filter((u) => t.roles.includes(u.role)).length])) as Record<TabKey, number>,
    [searched],
  );
  const rows = React.useMemo(() => {
    const roles = TABS.find((t) => t.value === tab)!.roles;
    return searched.filter((u) => roles.includes(u.role)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [searched, tab]);

  // Only act on selected rows that are still visible and can actually be suspended.
  const bulkTargets = React.useMemo(() => {
    const visible = new Set(rows.map((r) => r.id));
    return users.filter((u) => selected.includes(u.id) && visible.has(u.id) && u.status !== "suspended" && u.id !== me?.id);
  }, [users, rows, selected, me]);

  const filtered = q.trim() !== "" || status !== "all";

  const columns: Column<User>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (u) => fullName(u),
      cell: (u) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={fullName(u)} size="sm" className="hidden md:inline-flex" />
          <RowOpen onOpen={() => setOpenId(u.id)} label={`Open ${fullName(u)}`} className="truncate font-medium text-ink">{fullName(u)}</RowOpen>
        </span>
      ),
    },
    { key: "email", header: "Email", sortValue: (u) => u.email, cell: (u) => <span className="block max-w-56 truncate">{u.email}</span> },
    { key: "role", header: "Role", sortValue: (u) => u.role, cell: (u) => <Badge size="sm">{ROLE_LABEL[u.role]}</Badge> },
    { key: "location", header: "Location", sortValue: location, cell: location, hideOnMobile: true },
    { key: "joined", header: "Joined", sortValue: (u) => u.createdAt, cell: (u) => <span className="tabular-nums">{formatDate(u.createdAt, tz)}</span> },
    {
      key: "verified",
      header: "Email status",
      sortValue: (u) => (u.emailVerified ? 1 : 0),
      cell: (u) =>
        u.emailVerified ? (
          <span className="inline-flex items-center gap-1 text-ink-2"><BadgeCheck className="size-3.5 text-success" aria-hidden /> Verified</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-muted"><CircleX className="size-3.5" aria-hidden /> Unverified</span>
        ),
    },
    { key: "status", header: "Status", sortValue: (u) => u.status, cell: (u) => <StatusPill tone={USER_STATUS_META[u.status].tone}>{USER_STATUS_META[u.status].label}</StatusPill> },
  ];

  const open = users.find((u) => u.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Users"
        description="Every account on TutorLink — learners, parents, tutors and staff. Every change is written to the audit log."
        actions={
          <>
            {me?.role === "admin" && (
              <PermissionButton permission="content.manage" variant="secondary" onClick={() => setAnnounce(true)}>
                <Megaphone /> Send announcement
              </PermissionButton>
            )}
            <ExportButton
              filename="tutorlink-users"
              headers={["ID", "First name", "Last name", "Email", "Role", "City", "State", "Joined", "Email verified", "Status"]}
              rows={() => rows.map((u) => [u.id, u.firstName, u.lastName, u.email, ROLE_LABEL[u.role], u.city, u.state, u.createdAt, u.emailVerified, u.status])}
            />
          </>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as TabKey);
          setSelected([]);
        }}
      >
        <TabsList aria-label="Filter by account type">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} count={counts[t.value]}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab}>
          <Toolbar summary={`${pluralize(rows.length, "account")}`}>
            <SearchInput value={q} onChange={setQ} placeholder="Search name or email…" label="Search users" />
            <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
            <ClearFilters
              active={filtered}
              onClear={() => {
                setQ("");
                setStatus("all");
              }}
            />
          </Toolbar>

          <BulkBar count={selected.length} onClear={() => setSelected([])}>
            <PermissionButton permission="users.write" size="xs" variant="danger-outline" disabled={!bulkTargets.length} onClick={() => setBulkOpen(true)}>
              <UserRoundX /> Suspend {bulkTargets.length ? pluralize(bulkTargets.length, "account") : ""}
            </PermissionButton>
          </BulkBar>

          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(u) => u.id}
            onRowClick={(u) => setOpenId(u.id)}
            selectable
            selected={selected}
            onSelectedChange={setSelected}
            pageSize={12}
            empty={
              <EmptyState
                icon={<Users />}
                title={filtered ? "No accounts match these filters" : "No accounts yet"}
                description={filtered ? "Try a different name or email, or clear the filters." : "Accounts appear here as people sign up."}
              />
            }
          />
        </TabsContent>
      </Tabs>

      <UserSheet user={open} onClose={() => setOpenId(null)} />
      <AnnounceDialog open={announce} onOpenChange={setAnnounce} />

      <ReasonDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`Suspend ${pluralize(bulkTargets.length, "account")}?`}
        description="Suspended accounts can't sign in, book, message or apply to jobs until reactivated."
        label="Reason (applies to every selected account)"
        placeholder="e.g. Coordinated spam messages reported on Sep 30"
        confirmLabel="Suspend accounts"
        tone="danger"
        onConfirm={async (reason) => {
          let done = 0;
          const errors: string[] = [];
          for (const u of bulkTargets) {
            const res = await setUserStatus(u.id, "suspended", reason);
            if (res.ok) done++;
            else errors.push(`${fullName(u)}: ${res.error}`);
          }
          if (done) toast.success(`Suspended ${pluralize(done, "account")}`);
          if (errors.length) toast.error(errors.length === 1 ? errors[0] : `${errors.length} accounts couldn't be suspended`, { description: errors.length > 1 ? errors[0] : undefined });
          if (done) setSelected([]);
          return errors.length === 0;
        }}
      >
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-line bg-canvas px-3 py-2 text-[13px]">
          {bulkTargets.map((u) => (
            <li key={u.id} className="flex justify-between gap-3">
              <span className="truncate text-ink">{fullName(u)}</span>
              <span className="shrink-0 text-muted">{ROLE_LABEL[u.role]}</span>
            </li>
          ))}
        </ul>
      </ReasonDialog>
    </>
  );
}

/* ─── Detail drawer ──────────────────────────────────────────────────────────── */

function UserSheet({ user: current, onClose }: { user: User | null; onClose: () => void }) {
  const user = useSticky(current);
  return (
    <Sheet open={!!current} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" title={user ? fullName(user) : "Account"} description={user ? `${ROLE_LABEL[user.role]} · ${user.id}` : undefined} className="sm:w-[34rem]" footer={user ? <StatusActions user={user} /> : undefined}>
        {user && <UserDetail user={user} />}
      </SheetContent>
    </Sheet>
  );
}

function UserDetail({ user }: { user: User }) {
  const bookings = useApp((s) => s.bookings);
  const payments = useApp((s) => s.payments);
  const requirements = useApp((s) => s.requirements);
  const applications = useApp((s) => s.applications);
  const loginHistory = useApp((s) => s.loginHistory);
  const auditLogs = useApp((s) => s.auditLogs);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const now = useNow(60_000);

  const data = React.useMemo(() => {
    const booked = bookings.filter((b) => b.bookerId === user.id);
    const taught = user.tutorId ? bookings.filter((b) => b.tutorId === user.tutorId) : [];
    const spend = settledNet(payments.filter((p) => p.userId === user.id && p.kind === "booking")).net;
    const reqs = requirements.filter((r) => r.ownerId === user.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const appCount = new Map<string, number>();
    for (const a of applications) appCount.set(a.requirementId, (appCount.get(a.requirementId) ?? 0) + 1);
    const logins = loginHistory.filter((l) => l.userId === user.id).slice(0, 6);
    const failures24h = loginHistory.filter((l) => l.userId === user.id && !l.success && now - new Date(l.at).getTime() < 86_400_000).length;
    const history = auditLogs.filter((a) => a.targetId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
    return { booked, taught, spend, reqs, appCount, logins, failures24h, history };
  }, [bookings, payments, requirements, applications, loginHistory, auditLogs, user, now]);

  const kids = dir.children.filter((c) => c.parentId === user.id);
  const staff = user.role === "admin" || user.role === "support";

  return (
    <div className="divide-y divide-line">
      <div className="flex items-center gap-3.5 px-5 py-5">
        <Avatar name={fullName(user)} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{fullName(user)}</p>
          <p className="flex items-center gap-1.5 truncate text-[13px] text-muted">
            <Mail className="size-3.5 shrink-0" aria-hidden /> {user.email}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge size="sm">{ROLE_LABEL[user.role]}</Badge>
            <StatusPill tone={USER_STATUS_META[user.status].tone}>{USER_STATUS_META[user.status].label}</StatusPill>
            {staff && (user.mfaEnabled ? <Badge size="sm" tone="success"><ShieldCheck /> MFA on</Badge> : <Badge size="sm" tone="warning">MFA off</Badge>)}
          </div>
        </div>
      </div>

      {!staff && user.status !== "suspended" && <ChatPauseControls user={user} className="mx-5 my-4" />}

      {user.status === "suspended" && (
        <div className="px-5 py-4">
          <p className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-[13px] text-danger">
            <CircleSlash className="mt-0.5 size-4 shrink-0" aria-hidden /> This account is suspended and can&apos;t sign in.
          </p>
        </div>
      )}

      <Section title="Profile">
        <Facts
          items={[
            { label: "Email", value: <span className="inline-flex items-center gap-1">{user.emailVerified ? <><BadgeCheck className="size-3.5 text-success" aria-hidden /> Verified</> : "Not verified"}</span> },
            { label: "Phone", value: user.phone || "—" },
            { label: "Location", value: [user.city, user.state, user.zip].filter(Boolean).join(", ") || "—" },
            { label: "Time zone", value: user.timezone },
            { label: "Joined", value: formatDate(user.createdAt, tz) },
            { label: "Last sign-in", value: user.lastLoginAt ? formatRelative(user.lastLoginAt, now) : "No sign-ins recorded" },
            ...(user.chatModeration?.warnings
              ? [{ label: "Chat warnings", value: <TextLink href={`/admin/chat-safety?user=${encodeURIComponent(user.id)}`}>{pluralize(user.chatModeration.warnings, "warning")}</TextLink> }]
              : []),
            ...(user.parentalConsent ? [{ label: "Parental consent", value: `${user.parentalConsent.status === "granted" ? "Granted" : "Pending"} · ${user.parentalConsent.parentEmail}` }] : []),
            ...(user.tutorId ? [{ label: "Tutor profile", value: <TextLink href={`/admin/tutors?id=${user.tutorId}`}>Open tutor record</TextLink> }] : []),
          ]}
        />
      </Section>

      {!staff && (
        <Section title="Activity">
          <div className="grid grid-cols-2 gap-2.5">
            {user.role === "tutor" ? (
              <>
                <Metric label="Lessons (all statuses)" value={data.taught.length} />
                <Metric label="Completed" value={data.taught.filter((b) => b.status === "completed").length} />
              </>
            ) : (
              <>
                <Metric label="Bookings" value={data.booked.length} />
                <Metric label="Net spend" value={formatCents(data.spend)} />
              </>
            )}
          </div>
          {user.role !== "tutor" && data.booked.length > 0 && (
            <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
              {[...data.booked].sort((a, b) => b.startUtc.localeCompare(a.startUtc)).slice(0, 4).map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/bookings?id=${b.id}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] hover:bg-canvas">
                    <span className="min-w-0 truncate text-ink">
                      {subjectName(b.subject)} · {dir.name(b.tutorId)}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">{formatDate(b.startUtc, tz)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {kids.length > 0 && (
        <Section title="Children">
          <ul className="space-y-1.5 text-[13.5px]">
            {kids.map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                <span className="text-ink">{c.firstName}</span>
                <span className="text-muted">Grade {c.grade}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(user.role === "student" || user.role === "parent") && (
        <Section title="Requirements">
          {data.reqs.length === 0 ? (
            <p className="text-[13px] text-muted">No requirements posted.</p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {data.reqs.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/requirements?id=${r.id}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] hover:bg-canvas">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{r.title || "Untitled draft"}</span>
                      <span className="text-muted">{subjectName(r.subject)} · {pluralize(data.appCount.get(r.id) ?? 0, "application")}</span>
                    </span>
                    <Badge size="sm" tone={r.status === "published" ? "success" : r.status === "draft" ? "neutral" : "warning"}>{humanize(r.status)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section title="Recent sign-ins" description={data.failures24h >= 3 ? undefined : "The latest sign-in attempts on this account."}>
        {data.failures24h >= 3 && (
          <p className="mb-3 rounded-lg border border-warning-200 bg-warning-50 px-3.5 py-2 text-[13px] text-warning">{data.failures24h} failed sign-ins in the last 24 hours — possible credential stuffing.</p>
        )}
        {data.logins.length === 0 ? (
          <p className="text-[13px] text-muted">No sign-in attempts recorded for this account.</p>
        ) : (
          <ul className="space-y-2 text-[13px]">
            {data.logins.map((l) => (
              <li key={l.at + String(l.success)} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-ink-2">
                  {l.success ? <BadgeCheck className="size-3.5 text-success" aria-hidden /> : <CircleX className="size-3.5 text-danger" aria-hidden />}
                  {l.success ? "Signed in" : "Failed attempt"} · {l.device}
                </span>
                <span className="shrink-0 tabular-nums text-muted">{formatDateTime(l.at, tz)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Account history">
        <Timeline
          empty="No staff actions on this account yet."
          items={data.history.map((a) => ({
            key: a.id,
            tone: a.action === "user.suspend" ? "danger" : a.action === "user.reactivate" ? "success" : "default",
            title: describeAudit(a),
            meta: `${dir.name(a.actorId)} · ${formatDateTime(a.createdAt, tz)}`,
            body: a.meta?.reason ? `“${String(a.meta.reason)}”` : undefined,
          }))}
        />
      </Section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line px-3.5 py-2.5">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function StatusActions({ user }: { user: User }) {
  const setUserStatus = useApp((s) => s.setUserStatus);
  const { me, can } = useStaff();
  const [open, setOpen] = React.useState(false);
  const suspending = user.status !== "suspended";
  const self = me?.id === user.id;

  if (self) return <p className="text-[13px] text-muted">You can&apos;t change the status of your own account.</p>;

  return (
    <div className="space-y-3">
      {!can("users.write") && <PermissionNotice permission="users.write">Suspending, editing or deleting accounts requires</PermissionNotice>}
      <div className="flex flex-wrap justify-end gap-2">
        <AccountMenu user={user} />
        <PermissionButton permission="users.write" variant={suspending ? "danger-outline" : "primary"} onClick={() => setOpen(true)}>
          {suspending ? <><UserRoundX /> Suspend account</> : <><RotateCcw /> Reactivate account</>}
        </PermissionButton>
      </div>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={suspending ? `Suspend ${fullName(user)}?` : `Reactivate ${fullName(user)}?`}
        description={suspending ? "They won't be able to sign in, book, message or apply to jobs. Upcoming lessons are not cancelled automatically." : "They'll regain full access immediately."}
        placeholder={suspending ? "e.g. Repeated off-platform payment requests (report rpt_04)" : "e.g. Identity confirmed with support"}
        confirmLabel={suspending ? "Suspend account" : "Reactivate account"}
        tone={suspending ? "danger" : "default"}
        onConfirm={async (reason) => {
          const res = await setUserStatus(user.id, suspending ? "suspended" : "active", reason);
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          toast.success(suspending ? "Account suspended" : "Account reactivated", { description: "Recorded in the audit log." });
          return true;
        }}
      />
    </div>
  );
}

/* ─── More account actions ───────────────────────────────────────────────────── */

type AccountDialog = "edit" | "staff" | "delete" | "mfa" | null;

function AccountMenu({ user }: { user: User }) {
  const { me, can } = useStaff();
  const resend = useApp((s) => s.resendConfirmation);
  const resetMfa = useApp((s) => s.resetStaffMfa);
  const deleteAccount = useApp((s) => s.deleteAccount);
  const [dialog, setDialog] = React.useState<AccountDialog>(null);
  const [busy, setBusy] = React.useState(false);

  const admin = me?.role === "admin" && can("users.write");
  const staffTarget = user.role === "admin" || user.role === "support";
  const canEdit = can("users.write") && (!staffTarget || me?.role === "admin");
  const items = {
    edit: canEdit,
    resend: can("users.write") && !user.emailVerified && user.status !== "suspended",
    staff: admin && !user.tutorId,
    mfa: admin && !!user.mfaEnabled,
    delete: admin,
  };
  if (!Object.values(items).some(Boolean)) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" aria-label={`More actions for ${fullName(user)}`}>
            <MoreHorizontal /> More
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {items.edit && (
            <DropdownMenuItem onSelect={() => setDialog("edit")}>
              <Pencil /> Edit details
            </DropdownMenuItem>
          )}
          {items.resend && (
            <DropdownMenuItem
              onSelect={async () => {
                const r = await resend(user.email);
                if (r.ok) toast.success("Confirmation email sent", { description: user.email });
                else toast.error(r.error);
              }}
            >
              <Send /> Resend confirmation email
            </DropdownMenuItem>
          )}
          {items.staff && (
            <DropdownMenuItem onSelect={() => setDialog("staff")}>
              <KeyRound /> {staffTarget ? "Change staff access" : "Make staff"}
            </DropdownMenuItem>
          )}
          {items.mfa && (
            <DropdownMenuItem onSelect={() => setDialog("mfa")}>
              <ShieldOff /> Reset two-step login
            </DropdownMenuItem>
          )}
          {items.delete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem tone="danger" onSelect={() => setDialog("delete")}>
                <Trash2 /> Delete account
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditDetailsDialog user={user} open={dialog === "edit"} onOpenChange={(o) => setDialog(o ? "edit" : null)} />
      <StaffAccessDialog user={user} open={dialog === "staff"} onOpenChange={(o) => setDialog(o ? "staff" : null)} />
      <ConfirmDialog
        open={dialog === "mfa"}
        onOpenChange={(o) => setDialog(o ? "mfa" : null)}
        title={`Reset two-step login for ${fullName(user)}?`}
        description="Use this when they've lost their phone. Their authenticator app is removed and they sign in with just their password until they set it up again."
        confirmLabel="Reset two-step login"
        tone="danger"
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          const r = await resetMfa(user.id);
          setBusy(false);
          if (!r.ok) return toast.error(r.error);
          toast.success("Two-step login reset", { description: "They've been notified. Recorded in the audit log." });
          setDialog(null);
        }}
      />
      <ReasonDialog
        open={dialog === "delete"}
        onOpenChange={(o) => setDialog(o ? "delete" : null)}
        title={`Delete ${fullName(user)}'s account?`}
        description="This can't be undone. Their sign-in, profile and personal details are removed. Lessons, payments and reviews stay on record without their name. Accounts with upcoming lessons or unpaid earnings can't be deleted."
        placeholder="e.g. Requested by email on Nov 2 (ticket 1182)"
        confirmLabel="Delete account"
        tone="danger"
        onConfirm={async (reason) => {
          const r = await deleteAccount(user.id, reason);
          if (!r.ok) {
            toast.error(r.error);
            return false;
          }
          toast.success("Account deleted", { description: "Recorded in the audit log." });
          return true;
        }}
      />
    </>
  );
}

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

function EditDetailsDialog({ user, open, onOpenChange }: { user: User; open: boolean; onOpenChange: (o: boolean) => void }) {
  const update = useApp((s) => s.updateUserDetails);
  const initial = React.useMemo(
    () => ({ firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? "", country: user.country ?? DEFAULT_COUNTRY, city: user.city ?? "", state: user.state ?? "", zip: user.zip ?? "" }),
    [user],
  );
  const [form, setForm] = React.useState(initial);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setForm(initial);
      setError(null);
    }
  }
  const field = (k: keyof typeof form) => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value })) });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const patch = Object.fromEntries(Object.entries(form).filter(([k, v]) => v.trim() !== initial[k as keyof typeof form])) as Partial<typeof form>;
    if (!Object.keys(patch).length) return onOpenChange(false);
    setBusy(true);
    const r = await update(user.id, Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v!.trim()])));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success("Details saved", { description: "Recorded in the audit log." });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Edit ${fullName(user)}`} description="Fix a name, phone number or location. Email and password are changed by the account owner." size="md">
        <form onSubmit={save} noValidate>
          <DialogBody className="space-y-4">
            {error && <InlineAlert tone="danger">{error}</InlineAlert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required><Input {...field("firstName")} maxLength={60} autoComplete="off" /></Field>
              <Field label="Last name" required><Input {...field("lastName")} maxLength={60} autoComplete="off" /></Field>
            </div>
            <Field label="Phone" optional><Input {...field("phone")} maxLength={30} inputMode="tel" autoComplete="off" /></Field>
            <Field label="Country">
              <Select options={COUNTRY_OPTIONS} value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[1fr_9rem_7rem]">
              <Field label="City" optional><Input {...field("city")} maxLength={60} autoComplete="off" /></Field>
              <Field label={form.country === "US" ? "State" : "State / province"} optional><Input {...field("state")} maxLength={60} placeholder={form.country === "US" ? "CA" : ""} autoComplete="off" /></Field>
              <Field label={postalLabel(form.country)} optional><Input {...field("zip")} maxLength={POSTAL_MAX_LENGTH} autoComplete="off" /></Field>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={busy}>Save details</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const SUPPORT_DEFAULT: Permission[] = ["users.read", "bookings.manage", "reports.moderate", "disputes.manage", "payments.read"];

function StaffAccessDialog({ user, open, onOpenChange }: { user: User; open: boolean; onOpenChange: (o: boolean) => void }) {
  const setStaffAccess = useApp((s) => s.setStaffAccess);
  const current: "admin" | "support" | "none" = user.role === "admin" || user.role === "support" ? user.role : "none";
  const [role, setRole] = React.useState(current);
  const [perms, setPerms] = React.useState<Permission[]>(user.permissions ?? []);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setRole(current);
      setPerms(user.permissions?.length ? user.permissions : SUPPORT_DEFAULT);
      setError(null);
    }
  }
  const pickRole = (r: typeof role) => {
    setRole(r);
    if (r === "admin" && current !== "admin") setPerms(ALL_PERMISSIONS);
    if (r === "support" && current !== "support") setPerms(SUPPORT_DEFAULT);
  };
  const toggle = (p: Permission, on: boolean) => setPerms((list) => (on ? [...new Set([...list, p])] : list.filter((x) => x !== p)));

  const save = async () => {
    setBusy(true);
    const r = await setStaffAccess(user.id, role, role === "none" ? [] : perms);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(role === "none" ? "Staff access removed" : "Staff access saved", { description: `${fullName(user)} has been notified. Recorded in the audit log.` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Staff access for ${fullName(user)}`} description="Staff sign in with this same account and use the admin panel. They should turn on two-step login in Security." size="lg">
        <DialogBody className="space-y-5">
          {error && <InlineAlert tone="danger">{error}</InlineAlert>}
          <RadioCards<typeof role>
            value={role}
            onValueChange={pickRole}
            columns={3}
            options={[
              { value: "none", label: "No staff access", description: current === "none" ? "A regular account." : "Becomes a regular student account." },
              { value: "support", label: "Support", description: "Front-line help with the permissions you pick." },
              { value: "admin", label: "Administrator", description: "Runs the marketplace with the permissions you pick." },
            ]}
          />
          {role !== "none" && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">Permissions</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {ALL_PERMISSIONS.map((p) => (
                  <Checkbox key={p} checked={perms.includes(p)} onCheckedChange={(v) => toggle(p, v === true)} label={PERMISSION_META[p].label} description={PERMISSION_META[p].description} />
                ))}
              </div>
            </fieldset>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" variant={role === "none" && current !== "none" ? "danger" : "primary"} loading={busy} onClick={save}>
            {role === "none" && current !== "none" ? "Remove staff access" : "Save access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Announcements ──────────────────────────────────────────────────────────── */

type Audience = "everyone" | "students" | "parents" | "tutors";

function AnnounceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const users = useApp((s) => s.users);
  const send = useApp((s) => s.sendAnnouncement);
  const [audience, setAudience] = React.useState<Audience>("everyone");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [href, setHref] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setError(null);
  }
  const count = (roles: Role[]) => users.filter((u) => roles.includes(u.role) && u.status === "active").length;
  const counts: Record<Audience, number> = {
    everyone: count(["student", "parent", "tutor"]),
    students: count(["student"]),
    parents: count(["parent"]),
    tutors: count(["tutor"]),
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await send(audience, title.trim(), body.trim(), href.trim() || undefined);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(`Announcement sent to ${pluralize(r.data, "person", "people")}`, { description: "It appears in their notifications." });
    setTitle("");
    setBody("");
    setHref("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Send an announcement" description="Appears in the notifications of every active account in the group you pick." size="lg">
        <form onSubmit={submit} noValidate>
          <DialogBody className="space-y-4">
            {error && <InlineAlert tone="danger">{error}</InlineAlert>}
            <RadioCards<Audience>
              value={audience}
              onValueChange={setAudience}
              columns={4}
              options={[
                { value: "everyone", label: "Everyone", description: pluralize(counts.everyone, "account") },
                { value: "students", label: "Students", description: pluralize(counts.students, "account") },
                { value: "parents", label: "Parents", description: pluralize(counts.parents, "account") },
                { value: "tutors", label: "Tutors", description: pluralize(counts.tutors, "account") },
              ]}
            />
            <Field label="Title" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. New: Saturday SAT practice sessions" />
            </Field>
            <Field label="Message" required>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={600} showCount rows={4} />
            </Field>
            <Field label="Link" optional hint="A page on this site, e.g. /tutors or /blog/sat-tips">
              <Input value={href} onChange={(e) => setHref(e.target.value)} maxLength={200} placeholder="/tutors" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={busy} disabled={!counts[audience]}>
              <Megaphone /> Send to {pluralize(counts[audience], "person", "people")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
