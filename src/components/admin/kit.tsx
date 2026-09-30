"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Lock, Search, ShieldAlert, X } from "lucide-react";
import type { Child, Payment, Permission, Tutor, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useSession, useTutors } from "@/lib/store/hooks";
import { hasPermission } from "@/lib/permissions";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, Tooltip } from "@/components/ui/Overlay";
import { Badge } from "@/components/ui/Badge";
import { InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";

/* ─── Permissions ────────────────────────────────────────────────────────────── */

export const PERMISSION_META: Record<Permission, { label: string; description: string }> = {
  "users.read": { label: "View users", description: "Browse member, tutor and staff accounts and their activity." },
  "users.write": { label: "Change account status", description: "Suspend and reactivate accounts." },
  "tutors.verify": { label: "Review verification", description: "Approve or reject identity, education, certification and background checks." },
  "bookings.manage": { label: "Manage bookings", description: "View all bookings and apply admin status changes." },
  "payments.read": { label: "View payments", description: "Payments, refunds and tutor payouts." },
  "payments.refund": { label: "Issue refunds", description: "Resolve disputes with a full or partial refund." },
  "disputes.manage": { label: "Manage disputes", description: "Work the dispute queue, add notes and record decisions." },
  "reports.moderate": { label: "Moderate reports", description: "Work the report queue and moderate reviews." },
  "conversations.read_flagged": { label: "Read flagged conversations", description: "Open private conversations for a logged reason." },
  "content.manage": { label: "Manage content", description: "Catalog, CMS pages, SEO, blog and FAQs." },
  "settings.manage": { label: "Platform settings", description: "Booking policy, platform fee, plans and coupons." },
  "flags.manage": { label: "Feature flags", description: "Enable features and change rollout percentages." },
  "audit.read": { label: "Read audit log", description: "Every privileged action taken by staff." },
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_META) as Permission[];

/** The signed-in staff member and a permission check bound to them. */
export function useStaff() {
  const me = useSession();
  const can = React.useCallback((p: Permission) => hasPermission(me, p), [me]);
  return { me, can };
}

/** Plain text of a React node tree (for accessible names). */
function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ").replace(/\s+/g, " ");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/**
 * A button that is only functional when the viewer holds `permission`. Without it, the button is
 * disabled and a tooltip names the permission that's required (never a silent no-op).
 */
export function PermissionButton({ permission, children, className, ...props }: ButtonProps & { permission: Permission }) {
  const { can } = useStaff();
  if (can(permission)) {
    return (
      <Button className={className} {...props}>
        {children}
      </Button>
    );
  }
  return (
    <Tooltip content={<>Requires the <span className="font-mono">{permission}</span> permission</>}>
      <span role="button" aria-disabled="true" tabIndex={0} className={cn("inline-flex cursor-not-allowed rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ink/30", className)} aria-label={`${textOf(children).trim() || "Action"} — requires the ${permission} permission`}>
        <Button {...props} disabled className="pointer-events-none w-full" tabIndex={-1} aria-hidden>
          <Lock aria-hidden />
          {children}
        </Button>
      </span>
    </Tooltip>
  );
}

/** Inline notice explaining that an area is read-only for the viewer's role. */
export function PermissionNotice({ permission, children }: { permission: Permission; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-canvas px-3.5 py-3 text-[13px] text-ink-2">
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
      <p>
        {children ?? "You can view this, but changes need"} <span className="font-mono text-[12px] text-ink">{permission}</span>
        {children ? null : "."}
      </p>
    </div>
  );
}

/* ─── Directory: resolve ids to people ──────────────────────────────────────── */

export interface Directory {
  users: User[];
  tutors: Tutor[];
  children: Child[];
  userById: Map<string, User>;
  tutorById: Map<string, Tutor>;
  /** The user account that owns a tutor profile, when one exists in this preview. */
  tutorUser: Map<string, User>;
  name: (id: string | undefined | null) => string;
  email: (id: string | undefined | null) => string | undefined;
}

export function fullName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`;
}

export function useDirectory(): Directory {
  const users = useApp((s) => s.users);
  const kids = useApp((s) => s.children);
  const tutors = useTutors();
  return React.useMemo(() => {
    const userById = new Map(users.map((u) => [u.id, u]));
    const tutorById = new Map(tutors.map((t) => [t.id, t]));
    const childById = new Map(kids.map((c) => [c.id, c]));
    const tutorUser = new Map(users.filter((u) => u.tutorId).map((u) => [u.tutorId!, u]));
    const name = (id: string | undefined | null) => {
      if (!id) return "—";
      if (id === "system") return "System";
      const u = userById.get(id);
      if (u) return fullName(u);
      const t = tutorById.get(id);
      if (t) return fullName(t);
      const c = childById.get(id);
      if (c) return c.firstName;
      return id;
    };
    const email = (id: string | undefined | null) => {
      if (!id) return undefined;
      return userById.get(id)?.email ?? (tutorUser.get(id)?.email);
    };
    return { users, tutors, children: kids, userById, tutorById, tutorUser, name, email };
  }, [users, tutors, kids]);
}

/* ─── Layout primitives ─────────────────────────────────────────────────────── */

/** Search + filters row that sits above a table. Wraps on small screens. */
export function Toolbar({ children, className, summary }: { children: React.ReactNode; className?: string; summary?: React.ReactNode }) {
  return (
    <div className={cn("mb-4 flex flex-col gap-3 lg:flex-row lg:items-center", className)}>
      <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>
      {summary && <div className="shrink-0 text-[13px] tabular-nums text-muted" aria-live="polite">{summary}</div>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, label, className }: { value: string; onChange: (v: string) => void; placeholder: string; label?: string; className?: string }) {
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Input
        type="text"
        role="searchbox"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        icon={<Search />}
        className="[&_input]:h-9 [&_input]:pr-8 [&_input]:text-sm"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted hover:bg-canvas hover:text-ink" aria-label="Clear search">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Compact native select for filter rows, with an accessible (visually hidden) label. */
export function FilterSelect<T extends string>({ label, value, onChange, options, className }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  const id = React.useId();
  return (
    <div className={cn("w-full sm:w-auto", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} options={options} className="[&_select]:h-9 [&_select]:text-sm sm:[&_select]:min-w-40" />
    </div>
  );
}

/** Small "Clear filters" link shown only when something is filtered. */
export function ClearFilters({ active, onClear }: { active: boolean; onClear: () => void }) {
  if (!active) return null;
  return (
    <Button variant="ghost" size="sm" onClick={onClear} className="self-start sm:self-auto">
      <X /> Clear filters
    </Button>
  );
}

/** Titled block inside a drawer or card. */
export function Section({ title, action, children, className, description }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; description?: React.ReactNode }) {
  return (
    <section className={cn("px-5 py-5", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">{title}</h3>
          {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Definition list for label/value facts. */
export function Facts({ items, className }: { items: { label: React.ReactNode; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line rounded-lg border border-line", className)}>
      {items.map((it, i) => (
        <div key={i} className="flex items-start justify-between gap-4 px-3.5 py-2.5 text-[13.5px]">
          <dt className="shrink-0 text-muted">{it.label}</dt>
          <dd className="min-w-0 text-right font-medium text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Compact KPI used in page strips (lighter than StatTile). */
export function MiniStat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "warning" | "danger" | "success" }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
      <p className="text-[12.5px] font-medium text-muted">{label}</p>
      <p className={cn("mt-1 font-heading text-[22px] font-bold tabular-nums tracking-[-0.02em] text-ink", tone === "warning" && "text-warning", tone === "danger" && "text-danger", tone === "success" && "text-success")}>{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

/** Vertical event timeline (booking history, audit trail). */
export function Timeline({ items, empty = "No events yet." }: { items: { key: string; title: React.ReactNode; meta?: React.ReactNode; body?: React.ReactNode; tone?: "default" | "accent" | "success" | "warning" | "danger" }[]; empty?: string }) {
  if (!items.length) return <p className="text-[13px] text-muted">{empty}</p>;
  return (
    <ol className="relative space-y-4 pl-5 before:absolute before:bottom-1.5 before:left-[5px] before:top-1.5 before:w-px before:bg-line">
      {items.map((it) => (
        <li key={it.key} className="relative">
          <span
            className={cn(
              "absolute -left-5 top-1.5 size-[11px] rounded-full border-2 border-surface ring-1",
              it.tone === "success" ? "bg-success ring-success/30" : it.tone === "danger" ? "bg-danger ring-danger/30" : it.tone === "warning" ? "bg-warning ring-warning/30" : it.tone === "accent" ? "bg-ink ring-ink/30" : "bg-line-strong ring-line",
            )}
            aria-hidden
          />
          <p className="text-[13.5px] font-medium text-ink">{it.title}</p>
          {it.meta && <p className="mt-0.5 text-[12px] text-muted">{it.meta}</p>}
          {it.body && <div className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{it.body}</div>}
        </li>
      ))}
    </ol>
  );
}

/** Person cell: name over email, optional id. */
export function PersonCell({ name, sub, className }: { name: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("block min-w-0", className)}>
      <span className="block truncate font-medium text-ink">{name}</span>
      {sub && <span className="block truncate text-[12px] text-muted">{sub}</span>}
    </span>
  );
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[12px] text-muted", className)}>{children}</span>;
}

/**
 * Keyboard access for clickable table rows. DataTable rows open on click, but desktop <tr>s aren't
 * focusable, so the key cell renders a real button on desktop (plain text on the stacked mobile
 * layout, where the whole card is already a button).
 */
export function RowOpen({ onOpen, label, children, className }: { onOpen: () => void; label: string; children: React.ReactNode; className?: string }) {
  return (
    <>
      <span className={cn("md:hidden", className)}>{children}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        aria-label={label}
        className="hidden min-w-0 max-w-full rounded-sm text-left underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ink/40 md:block"
      >
        <span className={cn("block truncate", className)}>{children}</span>
      </button>
    </>
  );
}

/** Floating bulk-action bar that appears when table rows are selected. */
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-brand bg-brand-soft px-3.5 py-2"
          role="region"
          aria-label="Bulk actions"
        >
          <span className="text-[13px] font-semibold tabular-nums text-ink">{count} selected</span>
          <div className="flex flex-wrap items-center gap-2">{children}</div>
          <Button variant="ghost" size="xs" className="ml-auto" onClick={onClear}>
            Clear selection
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── CSV export ─────────────────────────────────────────────────────────────── */

type Cell = string | number | boolean | null | undefined;

function csvCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v !== "number" ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function downloadCsv(filename: string, headers: string[], rows: Cell[][]) {
  const body = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["﻿", body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Exports exactly what the current filters show. */
export function ExportButton({ filename, headers, rows, label = "Export CSV" }: { filename: string; headers: string[]; rows: () => Cell[][]; label?: string }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        const data = rows();
        if (!data.length) {
          toast.error("Nothing to export", { description: "Adjust the filters to include at least one row." });
          return;
        }
        const stamp = new Date().toISOString().slice(0, 10);
        downloadCsv(`${filename}-${stamp}.csv`, headers, data);
        toast.success(`Exported ${data.length} ${data.length === 1 ? "row" : "rows"}`);
      }}
    >
      <Download /> {label}
    </Button>
  );
}

/**
 * Money that actually settled: positive charges that succeeded (or were partly refunded) minus every
 * refund record. Seed payments marked "refunded" were never captured, so they count as zero.
 */
export function settledNet(payments: Payment[]): { gross: number; refunds: number; net: number } {
  let gross = 0;
  let refunds = 0;
  for (const p of payments) {
    if (p.amountCents < 0) refunds += -p.amountCents;
    else if (p.status === "succeeded" || p.status === "partially_refunded") gross += p.amountCents;
  }
  return { gross, refunds, net: gross - refunds };
}

/** Cents → "123.45" for CSV (no currency symbol, no float drift). */
export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/* ─── Reason dialog ─────────────────────────────────────────────────────────── */

/**
 * Confirmation that requires a written reason (recorded in the audit log). `onConfirm` returns true
 * when the action succeeded so the dialog can close; on failure it stays open for a retry.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "Reason",
  hint = "Recorded in the audit log.",
  placeholder,
  minLength = 5,
  confirmLabel = "Confirm",
  tone = "default",
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: React.ReactNode;
  label?: string;
  hint?: string;
  placeholder?: string;
  minLength?: number;
  confirmLabel?: string;
  tone?: "default" | "danger";
  onConfirm: (reason: string) => boolean | Promise<boolean>;
  children?: React.ReactNode;
}) {
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setReason("");
      setTouched(false);
      setBusy(false);
    }
  }
  const tooShort = reason.trim().length < minLength;
  const error = touched && tooShort ? `Write at least ${minLength} characters.` : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (tooShort) return;
    setBusy(true);
    const ok = await onConfirm(reason.trim());
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description} size="md">
        <form onSubmit={submit} noValidate>
          <DialogBody className="space-y-4">
            {children}
            <Field label={label} hint={hint} error={error} required>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} onBlur={() => setTouched(true)} placeholder={placeholder} maxLength={500} showCount rows={3} autoFocus />
            </Field>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant={tone === "danger" ? "danger" : "primary"} loading={busy}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Private conversation access ───────────────────────────────────────────── */

/**
 * Gate in front of a private conversation. Staff must hold `conversations.read_flagged` and enter a
 * reason; the access is written to the audit log before any message is shown.
 */
export function ConversationAccess({ conversationId, context, children }: { conversationId: string; context?: string; children: () => React.ReactNode }) {
  const { can } = useStaff();
  const logAccess = useApp((s) => s.logConversationAccess);
  const [granted, setGranted] = React.useState<{ reason: string; at: string } | null>(null);
  const [open, setOpen] = React.useState(false);

  if (!can("conversations.read_flagged")) {
    return (
      <div className="rounded-lg border border-line bg-canvas px-4 py-3.5">
        <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
          <Lock className="size-4 text-muted" aria-hidden /> Private conversation
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Reading private messages requires the <span className="font-mono text-[12px] text-ink">conversations.read_flagged</span> permission. Escalate to an administrator if the messages are needed.
        </p>
      </div>
    );
  }

  if (!granted) {
    return (
      <div className="rounded-lg border border-line bg-canvas px-4 py-3.5">
        <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
          <Lock className="size-4 text-muted" aria-hidden /> Private conversation
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">Messages stay hidden until you record why you need them. Each access is written to the audit log with your name and reason.</p>
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
          View conversation
        </Button>
        <ReasonDialog
          open={open}
          onOpenChange={setOpen}
          title="Access a private conversation"
          description="Only open private messages when it's necessary to investigate a report or dispute."
          label="Reason for access"
          placeholder={context ? `e.g. Investigating ${context}` : "e.g. Investigating a report"}
          confirmLabel="Log access and view"
          onConfirm={(reason) => {
            const res = logAccess(conversationId, reason);
            if (!res.ok) {
              toast.error(res.error);
              return false;
            }
            setGranted({ reason, at: new Date().toISOString() });
            toast.success("Access logged");
            return true;
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <InlineAlert tone="warning" title="Access logged">
        Reason: “{granted.reason}”. This view is recorded in the audit log.
      </InlineAlert>
      {children()}
    </div>
  );
}

/* ─── URL state ─────────────────────────────────────────────────────────────── */

/**
 * A single search param as state (e.g. `?id=` for the open drawer), so records are linkable.
 * Uses the native History API, which Next.js syncs with `useSearchParams` without a navigation.
 * Components calling this must sit inside a <Suspense> boundary.
 */
export function useUrlParam(key: string): [string | null, (v: string | null) => void] {
  const params = useSearchParams();
  const pathname = usePathname();
  const value = params.get(key);
  const set = React.useCallback(
    (v: string | null) => {
      const next = new URLSearchParams(window.location.search);
      if (v) next.set(key, v);
      else next.delete(key);
      const qs = next.toString();
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [key, pathname],
  );
  return [value, set];
}

/** Keeps the last non-null value so drawers keep their content while animating closed. */
export function useSticky<T>(value: T | null | undefined): T | null {
  const [kept, setKept] = React.useState<T | null>(value ?? null);
  if (value != null && value !== kept) setKept(value);
  return value ?? kept;
}

/* ─── Misc ──────────────────────────────────────────────────────────────────── */

const HOUR = 3_600_000;

/** "3h", "2d 4h" — compact age for queues. */
export function formatAge(ms: number): string {
  const h = Math.max(0, Math.floor(ms / HOUR));
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m`;
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const rem = h % 24;
  return rem ? `${d}d ${rem}h` : `${d}d`;
}

export function StatusPill({ tone, children }: { tone: "neutral" | "accent" | "success" | "warning" | "danger"; children: React.ReactNode }) {
  return (
    <Badge tone={tone} size="sm" dot>
      {children}
    </Badge>
  );
}

export function TextLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("font-semibold text-ink underline-offset-4 hover:underline", className)}>
      {children}
    </Link>
  );
}

/** Common date-range presets for filter rows. */
export type RangePreset = "all" | "past7" | "past30" | "next7" | "upcoming";
export const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: "all", label: "Any date" },
  { value: "upcoming", label: "Upcoming" },
  { value: "next7", label: "Next 7 days" },
  { value: "past7", label: "Past 7 days" },
  { value: "past30", label: "Past 30 days" },
];

export function inRange(iso: string, preset: RangePreset, now: number): boolean {
  const t = new Date(iso).getTime();
  const DAY = 86_400_000;
  switch (preset) {
    case "all":
      return true;
    case "upcoming":
      return t >= now;
    case "next7":
      return t >= now && t <= now + 7 * DAY;
    case "past7":
      return t <= now && t >= now - 7 * DAY;
    case "past30":
      return t <= now && t >= now - 30 * DAY;
  }
}

/** "under_review" → "Under review". */
export function humanize(s: string): string {
  const t = s.replace(/[_.]/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Case-insensitive "contains" across several fields. */
export function matches(q: string, ...fields: (string | undefined | null)[]): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => f?.toLowerCase().includes(needle));
}

