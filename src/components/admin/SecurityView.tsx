"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BadgeCheck, Check, CircleX, FileLock2, KeyRound, LogOut, Minus, MonitorSmartphone, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Permission, User } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useNow, useViewerTimezone } from "@/lib/store/hooks";
import { ROLE_LABEL } from "@/lib/data/users";
import { formatDateTime, formatRelative, pluralize } from "@/lib/format";
import { isStaff } from "@/lib/permissions";
import { PageHeader } from "@/components/dashboard/Shell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Controls";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { cn } from "@/lib/utils";
import { ALL_PERMISSIONS, FilterSelect, MiniStat, PERMISSION_META, PermissionNotice, TextLink, fullName, useDirectory, useStaff } from "./kit";

const DAY = 86_400_000;
/** Accounts with this many failed sign-ins inside the window are flagged. */
const FAILURE_THRESHOLD = 3;
const FAILURE_WINDOW_MS = DAY;

/**
 * Role templates for production RBAC. Each staff account's real permissions are listed separately
 * and matched against these; the templates themselves are a proposal for the product owner.
 */
const ROLE_TEMPLATES: { key: string; label: string; description: string; permissions: Permission[] }[] = [
  { key: "super", label: "Super admin", description: "Everything, including platform configuration.", permissions: ALL_PERMISSIONS },
  {
    key: "admin",
    label: "Administrator",
    description: "Runs the marketplace day to day; platform configuration stays with super admins.",
    permissions: ALL_PERMISSIONS.filter((p) => p !== "settings.manage" && p !== "flags.manage"),
  },
  {
    key: "support",
    label: "Support staff",
    description: "Front-line support: read access, bookings, disputes and moderation.",
    permissions: ["users.read", "bookings.manage", "reports.moderate", "disputes.manage", "payments.read"],
  },
];

type LoginRow = { userId: string; at: string; device: string; success: boolean; key: string };

const noop = () => () => {};
function readAgent(): string {
  return typeof navigator === "undefined" ? "" : navigator.userAgent;
}

/** "Chrome on Windows" from a user-agent string. Good enough for a session label. */
function describeAgent(ua: string): string {
  if (!ua) return "This browser";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "an unknown OS";
  return `${browser} on ${os}`;
}

export function SecurityView() {
  const { me, can } = useStaff();
  const loginHistory = useApp((s) => s.loginHistory);
  const auditLogs = useApp((s) => s.auditLogs);
  const logout = useApp((s) => s.logout);
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const now = useNow(60_000);
  const router = useRouter();
  const agent = React.useSyncExternalStore(noop, readAgent, () => "");
  const [scope, setScope] = React.useState<"mine" | "all">("mine");
  const [result, setResult] = React.useState<"all" | "success" | "failed">("all");
  const [signOut, setSignOut] = React.useState(false);

  const staff = React.useMemo(() => dir.users.filter((u) => isStaff(u)), [dir.users]);
  const mfaOn = staff.filter((u) => u.mfaEnabled).length;
  const canSeeAll = can("users.read");
  const effectiveScope = canSeeAll ? scope : "mine";

  const logins: LoginRow[] = React.useMemo(
    () =>
      loginHistory
        .filter((l) => (effectiveScope === "all" || l.userId === me?.id) && (result === "all" || (result === "success") === l.success))
        .map((l, i) => ({ ...l, key: `${l.userId}-${l.at}-${i}` })),
    [loginHistory, effectiveScope, result, me],
  );

  const suspicious = React.useMemo(() => {
    const byUser = new Map<string, { count: number; last: string }>();
    for (const l of loginHistory) {
      if (l.success || now - new Date(l.at).getTime() > FAILURE_WINDOW_MS) continue;
      const cur = byUser.get(l.userId);
      byUser.set(l.userId, { count: (cur?.count ?? 0) + 1, last: !cur || l.at > cur.last ? l.at : cur.last });
    }
    return [...byUser.entries()].filter(([, v]) => v.count >= FAILURE_THRESHOLD).map(([userId, v]) => ({ userId, ...v })).sort((a, b) => b.count - a.count);
  }, [loginHistory, now]);

  const accessLogs = React.useMemo(() => auditLogs.filter((a) => a.action === "conversation.access" && now - new Date(a.createdAt).getTime() <= 30 * DAY).length, [auditLogs, now]);

  if (!me) return null;

  const columns: Column<LoginRow>[] = [
    { key: "at", header: "Time", sortValue: (l) => l.at, cell: (l) => <span className="tabular-nums">{formatDateTime(l.at, tz)}</span> },
    { key: "user", header: "Account", sortValue: (l) => dir.name(l.userId), cell: (l) => <span className="font-medium text-ink">{dir.name(l.userId)}</span> },
    { key: "device", header: "Device", cell: (l) => l.device },
    {
      key: "result",
      header: "Result",
      sortValue: (l) => (l.success ? 1 : 0),
      cell: (l) =>
        l.success ? (
          <span className="inline-flex items-center gap-1 text-ink-2"><BadgeCheck className="size-3.5 text-success" aria-hidden /> Success</span>
        ) : (
          <span className="inline-flex items-center gap-1 font-medium text-danger"><CircleX className="size-3.5" aria-hidden /> Failed</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="Security" description="Your account security, staff MFA coverage, sign-in activity and the access model for staff roles." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Your account" description={`${fullName(me)} · ${ROLE_LABEL[me.role]}`} />
          <div className="space-y-4 p-5 pt-4">
            <div className={cn("flex items-start gap-3 rounded-lg border px-3.5 py-3", me.mfaEnabled ? "border-success-200 bg-success-50" : "border-warning-200 bg-warning-50")}>
              {me.mfaEnabled ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> : <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />}
              <div>
                <p className={cn("text-[13.5px] font-semibold", me.mfaEnabled ? "text-success" : "text-warning")}>{me.mfaEnabled ? "Multi-factor authentication is on" : "Multi-factor authentication is off"}</p>
                <p className="mt-0.5 text-[12.5px] text-ink-2">{me.mfaEnabled ? "Sign-ins require a second factor." : "Staff accounts must enable MFA before handling member data."} Enrollment is managed by the auth service in production.</p>
              </div>
            </div>
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Email</dt>
                <dd className="truncate font-medium text-ink">{me.email}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Last sign-in</dt>
                <dd className="font-medium text-ink">{me.lastLoginAt ? formatRelative(me.lastLoginAt, now) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Permissions</dt>
                <dd className="font-medium tabular-nums text-ink">
                  {me.permissions?.length ?? 0} of {ALL_PERMISSIONS.length}
                </dd>
              </div>
            </dl>
          </div>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader title="Staff MFA coverage" description={`${mfaOn} of ${pluralize(staff.length, "staff account")}`} />
          <div className="p-5 pt-4">
            <Progress value={(mfaOn / Math.max(1, staff.length)) * 100} tone={mfaOn === staff.length ? "success" : "navy"} label="Staff MFA coverage" />
            <ul className="mt-4 space-y-2.5 text-[13px]">
              {staff.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{fullName(u)}</span>
                    <span className="text-[12px] text-muted">{ROLE_LABEL[u.role]}</span>
                  </span>
                  {u.mfaEnabled ? <Badge size="sm" tone="success"><ShieldCheck /> MFA on</Badge> : <Badge size="sm" tone="warning"><ShieldAlert /> MFA off</Badge>}
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader title="Active sessions" description="Sessions for your account" />
          <div className="p-5 pt-4">
            <div className="flex items-start gap-3 rounded-lg border border-line px-3.5 py-3">
              <MonitorSmartphone className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium text-ink">
                  {describeAgent(agent)} <Badge size="sm" tone="accent">This device</Badge>
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted">Signed in {me.lastLoginAt ? formatDateTime(me.lastLoginAt, tz) : "earlier"}</p>
              </div>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">The preview keeps a single session in this browser. Cross-device session listing and revocation come from the auth service in production.</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => setSignOut(true)}>
              <LogOut /> Sign out of this session
            </Button>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Sign-in attempts recorded" value={loginHistory.length} hint="Last 50, this browser" />
        <MiniStat label="Failed (24 h)" value={loginHistory.filter((l) => !l.success && now - new Date(l.at).getTime() <= DAY).length} />
        <MiniStat label="Flagged accounts" value={suspicious.length} tone={suspicious.length ? "danger" : undefined} hint={`${FAILURE_THRESHOLD}+ failures in 24 h`} />
        <MiniStat label="Conversation access (30 d)" value={can("audit.read") ? accessLogs : "—"} hint={can("audit.read") ? <TextLink href="/admin/audit-log?q=conversation.access">View entries</TextLink> : "Needs audit.read"} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Failed sign-in tracking" description={`Accounts with ${FAILURE_THRESHOLD} or more failed attempts in the last 24 hours are flagged as suspicious.`} />
        <div className="p-5 pt-4">
          {suspicious.length === 0 ? (
            <p className="flex items-center gap-2 text-[13px] text-muted">
              <ShieldCheck className="size-4 text-success" aria-hidden /> No accounts with repeated failures.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {suspicious.map((s) => (
                <li key={s.userId} className="flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex items-center gap-2.5">
                    <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden />
                    <span>
                      <span className="block text-[13.5px] font-medium text-ink">{dir.name(s.userId)}</span>
                      <span className="text-[12.5px] text-muted">
                        {s.count} failed attempts · last {formatRelative(s.last, now)}
                      </span>
                    </span>
                  </span>
                  <Badge tone="danger" size="sm">Suspicious</Badge>
                  {can("users.read") && <TextLink href={`/admin/users?id=${s.userId}`} className="text-[13px]">Review account</TextLink>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <section className="mt-6" aria-labelledby="login-history">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="login-history" className="text-[15px] font-semibold tracking-tight text-ink">Login history</h2>
            <p className="mt-0.5 text-[13px] text-muted">Successful and failed sign-ins recorded in this browser.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canSeeAll && (
              <FilterSelect<"mine" | "all">
                label="Accounts"
                value={scope}
                onChange={setScope}
                options={[
                  { value: "mine", label: "My sign-ins" },
                  { value: "all", label: "All accounts" },
                ]}
              />
            )}
            <FilterSelect<"all" | "success" | "failed">
              label="Result"
              value={result}
              onChange={setResult}
              options={[
                { value: "all", label: "Any result" },
                { value: "success", label: "Successful" },
                { value: "failed", label: "Failed" },
              ]}
            />
          </div>
        </div>
        <DataTable
          rows={logins}
          columns={columns}
          rowKey={(l) => l.key}
          pageSize={8}
          empty={<EmptyState compact icon={<KeyRound />} title="No sign-ins recorded" description="Attempts appear here after signing in with a password or a demo account." />}
        />
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Password policy" description="Read-only. Enforced by the auth service." />
          <div className="p-5 pt-4">
            <ConfigList
              items={[
                { label: "Minimum length", value: "10 characters" },
                { label: "Applies to", value: "Registration and password changes" },
                { label: "Wrong email or password", value: "One generic error (no account enumeration)" },
                { label: "Staff accounts", value: "MFA expected for every staff account" },
                { label: "Storage", value: "Hashed; never stored or logged in plain text" },
              ]}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Rate limiting" description="Read-only. Configured at the API gateway." />
          <div className="p-5 pt-4">
            <ConfigList
              items={[
                { label: "Sign-in attempts", value: "Throttled per account and IP in production" },
                { label: "Messaging & applications", value: "Throttled per account in production" },
                { label: "Preview build", value: "Not simulated. Failed attempts are recorded and flagged above" },
              ]}
            />
            <InlineAlert tone="info" className="mt-4">
              Limits are changed through infrastructure configuration with review, not from this panel.
            </InlineAlert>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Roles & permissions" description="Proposed role templates for staff, compared with each account's actual permissions. Changes go through a super admin." />
        <div className="overflow-x-auto p-5 pt-4">
          <table className="w-full min-w-[36rem] text-[13px]">
            <caption className="sr-only">Permission matrix by staff role</caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-2.5 pr-4 font-medium text-muted">Permission</th>
                {ROLE_TEMPLATES.map((r) => (
                  <th key={r.key} scope="col" className="w-28 px-2 py-2.5 text-center font-medium text-ink">
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_PERMISSIONS.map((p) => (
                <tr key={p} className="border-b border-line last:border-0">
                  <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                    <span className="block font-medium text-ink">{PERMISSION_META[p].label}</span>
                    <span className="font-mono text-[11.5px] text-muted">{p}</span>
                  </th>
                  {ROLE_TEMPLATES.map((r) => (
                    <td key={r.key} className="px-2 py-2.5 text-center">
                      {r.permissions.includes(p) ? (
                        <Check className="mx-auto size-4 text-ink" aria-label="Included" />
                      ) : (
                        <Minus className="mx-auto size-4 text-subtle" aria-label="Not included" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {staff.map((u) => (
              <StaffAccess key={u.id} user={u} />
            ))}
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex items-start gap-3 p-5">
          <FileLock2 className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">Sensitive data access logging</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
              Private conversations open only after staff record a reason, and each access is written to the audit log with the staff member&apos;s name. Verification documents open from secure storage (S3 signed URLs) in production, and every document view is logged the same way. Staff can&apos;t edit or delete audit entries.
            </p>
            {!can("audit.read") && (
              <div className="mt-3">
                <PermissionNotice permission="audit.read">Reviewing these logs requires</PermissionNotice>
              </div>
            )}
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={signOut}
        onOpenChange={setSignOut}
        title="Sign out of this session?"
        description="You'll need to sign in again to use the admin panel."
        confirmLabel="Sign out"
        onConfirm={() => {
          setSignOut(false);
          logout();
          router.push("/login");
        }}
      />
    </>
  );
}

function ConfigList({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="divide-y divide-line rounded-lg border border-line">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col gap-0.5 px-3.5 py-2.5 text-[13px] sm:flex-row sm:justify-between sm:gap-4">
          <dt className="shrink-0 text-muted">{it.label}</dt>
          <dd className="font-medium text-ink sm:text-right">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StaffAccess({ user }: { user: User }) {
  const perms = user.permissions ?? [];
  const match = ROLE_TEMPLATES.find((r) => r.permissions.length === perms.length && r.permissions.every((p) => perms.includes(p)));
  return (
    <div className="rounded-lg border border-line px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13.5px] font-medium text-ink">{fullName(user)}</p>
        <Badge size="sm" tone={match ? "accent" : "warning"}>{match ? `Matches ${match.label}` : "Custom permissions"}</Badge>
      </div>
      <p className="mt-0.5 text-[12px] text-muted">
        {ROLE_LABEL[user.role]} · {perms.length} of {ALL_PERMISSIONS.length} permissions
      </p>
    </div>
  );
}
