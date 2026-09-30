"use client";

import * as React from "react";
import Link from "next/link";
import { z } from "zod";
import { Gift, Pencil, Plus, Tag, ToggleLeft } from "lucide-react";
import type { Coupon } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useFlag, useNow, useViewerTimezone } from "@/lib/store/hooks";
import { dateKey, zonedToUtc } from "@/lib/time";
import { formatCents, formatDate, pluralize } from "@/lib/format";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Checkbox, Progress, Segmented, Switch } from "@/components/ui/Controls";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog, Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import {
  ClearFilters, ExportButton, FilterSelect, MiniStat, Mono, PermissionButton, PermissionNotice, SearchInput, StatusPill, TextLink, Toolbar,
  centsToDecimal, matches, useStaff, useUrlParam,
} from "./kit";

type StatusFilter = "all" | "live" | "inactive" | "expired" | "exhausted";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Any status" },
  { value: "live", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "expired", label: "Expired" },
  { value: "exhausted", label: "Usage limit reached" },
];

const isExpired = (c: Coupon, now: number) => new Date(c.expiresAt).getTime() < now;
const isExhausted = (c: Coupon) => c.redemptions >= c.maxRedemptions;
const isLive = (c: Coupon, now: number) => c.active && !isExpired(c, now) && !isExhausted(c);

function statusOf(c: Coupon, now: number): { label: string; tone: "success" | "neutral" | "warning" | "danger" } {
  if (isExpired(c, now)) return { label: "Expired", tone: "neutral" };
  if (isExhausted(c)) return { label: "Limit reached", tone: "warning" };
  if (!c.active) return { label: "Inactive", tone: "neutral" };
  return { label: "Active", tone: "success" };
}

function discountLabel(c: Pick<Coupon, "kind" | "value">): string {
  return c.kind === "percent" ? `${c.value}%` : formatCents(c.value, { exact: c.value % 100 !== 0 });
}

function toInput(c: Coupon) {
  const { id, code, kind, value, minPurchaseCents, maxRedemptions, expiresAt, firstBookingOnly, active } = c;
  return { id, code, kind, value, minPurchaseCents, maxRedemptions, expiresAt, firstBookingOnly, active };
}

export function PromotionsView() {
  return (
    <PermissionGate permission="settings.manage">
      <PromotionsInner />
    </PermissionGate>
  );
}

function PromotionsInner() {
  const coupons = useApp((s) => s.coupons);
  const saveCoupon = useApp((s) => s.saveCoupon);
  const couponsOn = useFlag("coupons");
  const referralsOn = useFlag("referrals");
  const { me, can } = useStaff();
  const tz = useViewerTimezone();
  const now = useNow(60_000);
  const isAdmin = me?.role === "admin";
  const editable = can("settings.manage") && isAdmin;

  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [openId, setOpenId] = useUrlParam("id");
  const [creating, setCreating] = React.useState(false);
  const [deactivating, setDeactivating] = React.useState<Coupon | null>(null);

  const rows = React.useMemo(
    () =>
      coupons
        .filter((c) => matches(q, c.code))
        .filter((c) => {
          switch (status) {
            case "all":
              return true;
            case "live":
              return isLive(c, now);
            case "inactive":
              return !c.active;
            case "expired":
              return isExpired(c, now);
            case "exhausted":
              return isExhausted(c);
          }
        })
        .sort((a, b) => Number(isLive(b, now)) - Number(isLive(a, now)) || a.expiresAt.localeCompare(b.expiresAt)),
    [coupons, q, status, now],
  );

  const stats = React.useMemo(
    () => ({
      live: coupons.filter((c) => isLive(c, now)).length,
      redemptions: coupons.reduce((sum, c) => sum + c.redemptions, 0),
      inactive: coupons.filter((c) => !c.active).length,
      ended: coupons.filter((c) => isExpired(c, now) || isExhausted(c)).length,
    }),
    [coupons, now],
  );

  const filtered = q.trim() !== "" || status !== "all";
  const editing = coupons.find((c) => c.id === openId) ?? null;

  const setActive = (c: Coupon, active: boolean) => {
    const res = saveCoupon({ ...toInput(c), active });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    if (active) {
      const why = isExpired(c, now) ? "it has expired" : isExhausted(c) ? "it has reached its usage limit" : null;
      toast.success(`${c.code} activated`, { description: why ? `Checkout will still reject it because ${why}. Edit the coupon to extend it.` : "Recorded in the audit log." });
    } else toast.success(`${c.code} deactivated`, { description: "Checkout rejects it from now on." });
    return true;
  };

  const columns: Column<Coupon>[] = [
    { key: "code", header: "Code", sortValue: (c) => c.code, cell: (c) => <Mono className="text-[13px] font-medium text-ink">{c.code}</Mono> },
    {
      key: "discount",
      header: "Discount",
      sortValue: (c) => `${c.kind}:${String(c.value).padStart(9, "0")}`,
      cell: (c) => (
        <span className="tabular-nums">
          <span className="font-medium text-ink">{discountLabel(c)}</span> <span className="text-muted">{c.kind === "percent" ? "off" : "fixed"}</span>
        </span>
      ),
    },
    { key: "min", header: "Min. purchase", sortValue: (c) => c.minPurchaseCents, cell: (c) => <span className="tabular-nums">{c.minPurchaseCents ? formatCents(c.minPurchaseCents) : "None"}</span>, hideOnMobile: true },
    {
      key: "usage",
      header: "Usage",
      sortValue: (c) => c.redemptions / Math.max(1, c.maxRedemptions),
      cell: (c) => (
        <span className="block min-w-28">
          <span className="block text-[12.5px] tabular-nums text-ink-2">
            {c.redemptions.toLocaleString("en-US")} / {c.maxRedemptions.toLocaleString("en-US")}
          </span>
          <Progress value={(c.redemptions / Math.max(1, c.maxRedemptions)) * 100} className="mt-1" label={`${c.code} usage`} />
        </span>
      ),
    },
    {
      key: "expires",
      header: "Expires",
      sortValue: (c) => c.expiresAt,
      cell: (c) => (
        <span className="inline-flex flex-wrap items-center gap-1.5 tabular-nums">
          {formatDate(c.expiresAt, tz)}
          {isExpired(c, now) && (
            <Badge size="sm" tone="danger">
              Expired
            </Badge>
          )}
        </span>
      ),
    },
    { key: "first", header: "First booking only", sortValue: (c) => Number(c.firstBookingOnly), cell: (c) => (c.firstBookingOnly ? "Yes" : "No"), hideOnMobile: true },
    { key: "status", header: "Status", sortValue: (c) => statusOf(c, now).label, cell: (c) => <StatusPill tone={statusOf(c, now).tone}>{statusOf(c, now).label}</StatusPill> },
    {
      key: "active",
      header: "Active",
      sortValue: (c) => Number(c.active),
      cell: (c) => (
        <Switch
          checked={c.active}
          disabled={!editable}
          aria-label={`${c.code} active`}
          title={editable ? undefined : "Requires an administrator account with settings.manage"}
          onCheckedChange={(v) => (v ? setActive(c, true) : setDeactivating(c))}
        />
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-px",
      cell: (c) => (
        <PermissionButton permission="settings.manage" variant="ghost" size="xs" onClick={() => setOpenId(c.id)} aria-label={`Edit ${c.code}`}>
          <Pencil /> Edit
        </PermissionButton>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Coupons & promotions"
        description="Promo codes accepted at checkout. Every change is written to the audit log."
        actions={
          <>
            <ExportButton
              filename="tutorlink-coupons"
              headers={["Code", "Type", "Value", "Min purchase (USD)", "Redemptions", "Max redemptions", "Expires", "First booking only", "Active", "Status"]}
              rows={() =>
                rows.map((c) => [
                  c.code,
                  c.kind,
                  c.kind === "percent" ? `${c.value}%` : centsToDecimal(c.value),
                  centsToDecimal(c.minPurchaseCents),
                  c.redemptions,
                  c.maxRedemptions,
                  c.expiresAt,
                  c.firstBookingOnly,
                  c.active,
                  statusOf(c, now).label,
                ])
              }
            />
            <PermissionButton permission="settings.manage" size="sm" disabled={!isAdmin} onClick={() => setCreating(true)}>
              <Plus /> New coupon
            </PermissionButton>
          </>
        }
      />

      {!isAdmin && (
        <div className="mb-5">
          <PermissionNotice permission="settings.manage">Only administrator accounts can create or change coupons, even with</PermissionNotice>
        </div>
      )}

      {couponsOn ? (
        <p className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
          <StatusPill tone="success">Coupons flag on</StatusPill>
          Active codes are accepted at checkout. Controlled in <TextLink href="/admin/feature-flags">Feature flags</TextLink>.
        </p>
      ) : (
        <InlineAlert tone="warning" title="Coupons are switched off" className="mb-5" action={<Button asChild size="sm" variant="secondary"><Link href="/admin/feature-flags">Feature flags</Link></Button>}>
          The <span className="font-mono text-[12px]">coupons</span> feature flag is off, so checkout ignores every code below — even active ones.
        </InlineAlert>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Active codes" value={stats.live} hint="Active, unexpired, under their limit" />
        <MiniStat label="Total redemptions" value={stats.redemptions.toLocaleString("en-US")} hint="Across all codes" />
        <MiniStat label="Inactive" value={stats.inactive} hint="Switched off by staff" />
        <MiniStat label="Expired or used up" value={stats.ended} tone={stats.ended ? "warning" : undefined} hint="Rejected at checkout" />
      </div>

      <Toolbar summary={pluralize(rows.length, "coupon")}>
        <SearchInput value={q} onChange={setQ} placeholder="Search codes…" label="Search coupons" />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <ClearFilters
          active={filtered}
          onClear={() => {
            setQ("");
            setStatus("all");
          }}
        />
      </Toolbar>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(c) => c.id}
        pageSize={10}
        empty={
          <EmptyState
            icon={<Tag />}
            title={filtered ? "No coupons match these filters" : "No coupons yet"}
            description={filtered ? "Try another code or clear the filters." : "Create a code to offer a percentage or fixed discount at checkout."}
            action={
              filtered ? undefined : (
                <PermissionButton permission="settings.manage" disabled={!isAdmin} onClick={() => setCreating(true)}>
                  <Plus /> New coupon
                </PermissionButton>
              )
            }
          />
        }
      />

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Referral program"
            description="Referral codes and credits for families and tutors."
            action={referralsOn ? <StatusPill tone="success">Flag on</StatusPill> : <StatusPill tone="neutral">Disabled</StatusPill>}
          />
          <CardContent className="space-y-3 text-[13.5px] text-ink-2">
            {referralsOn ? (
              <p>The <span className="font-mono text-[12px]">referrals</span> flag is on. Referral codes and credit tracking are handled by the referrals service in production; no referral activity is recorded in this preview.</p>
            ) : (
              <p>
                Off — the <span className="font-mono text-[12px]">referrals</span> feature flag is disabled, so no referral codes are issued or redeemed. There&apos;s no referral activity to report.
              </p>
            )}
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/feature-flags">
                <ToggleLeft /> Manage in Feature flags
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="How codes are checked" description="Rules applied at checkout, in order." />
          <CardContent>
            <ol className="list-decimal space-y-1.5 pl-5 text-[13.5px] text-ink-2 marker:text-muted">
              <li>The coupons flag must be on and the code must be active.</li>
              <li>The code must not be expired or past its redemption limit.</li>
              <li>The lesson price must meet the minimum purchase.</li>
              <li>First-booking codes only work on a learner&apos;s first paid booking.</li>
              <li>Percent discounts apply to the lesson price; fixed discounts never exceed it.</li>
            </ol>
          </CardContent>
        </Card>
      </div>

      <CouponDialog
        open={creating || !!editing}
        coupon={editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setOpenId(null);
          }
        }}
      />

      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title={deactivating ? `Deactivate ${deactivating.code}?` : "Deactivate coupon?"}
        description="Checkout will reject this code immediately. Bookings that already used it keep their discount."
        confirmLabel="Deactivate"
        tone="danger"
        onConfirm={() => {
          if (deactivating && setActive(deactivating, false)) setDeactivating(null);
        }}
      />
    </>
  );
}

/* ─── Create / edit ──────────────────────────────────────────────────────────── */

interface FormValues {
  code: string;
  kind: Coupon["kind"];
  value: string;
  minPurchase: string;
  maxRedemptions: string;
  expires: string; // YYYY-MM-DD in the viewer's time zone
  firstBookingOnly: boolean;
  active: boolean;
}
type FormField = keyof FormValues;

const EMPTY_FORM: FormValues = { code: "", kind: "percent", value: "", minPurchase: "0", maxRedemptions: "", expires: "", firstBookingOnly: false, active: true };

function toForm(c: Coupon, tz: string): FormValues {
  return {
    code: c.code,
    kind: c.kind,
    value: c.kind === "percent" ? String(c.value) : centsToDecimal(c.value),
    minPurchase: centsToDecimal(c.minPurchaseCents),
    maxRedemptions: String(c.maxRedemptions),
    expires: dateKey(new Date(c.expiresAt), tz),
    firstBookingOnly: c.firstBookingOnly,
    active: c.active,
  };
}

/** Dollars → cents without float drift. Returns null when the format is wrong. */
function dollarsToCents(v: string): number | null {
  const m = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(v.trim().replace(/^\$/, ""));
  return m ? Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0")) : null;
}

/** End of the chosen day (23:59:59) in the viewer's time zone, as a UTC ISO string. */
function endOfDayIso(ymd: string, tz: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return new Date(zonedToUtc(Number(m[1]), Number(m[2]), Number(m[3]), 23, 59, tz).getTime() + 59_000).toISOString();
}

function couponSchema(ctx: { existing: Coupon | null; others: Coupon[]; now: number; tz: string }) {
  return z
    .object({
      code: z.string().trim().toUpperCase(),
      kind: z.enum(["percent", "fixed"]),
      value: z.string().trim(),
      minPurchase: z.string().trim(),
      maxRedemptions: z.string().trim(),
      expires: z.string().trim(),
      firstBookingOnly: z.boolean(),
      active: z.boolean(),
    })
    .superRefine((v, c) => {
      const issue = (path: FormField, message: string) => c.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

      if (!/^[A-Z0-9]{4,16}$/.test(v.code)) issue("code", "Use 4–16 letters or numbers, with no spaces or symbols.");
      else if (ctx.others.some((o) => o.code === v.code)) issue("code", "That code already exists.");

      if (v.kind === "percent") {
        const n = /^\d{1,3}$/.test(v.value) ? Number(v.value) : NaN;
        if (!Number.isInteger(n) || n < 1 || n > 100) issue("value", "Enter a whole percentage from 1 to 100.");
      } else {
        const cents = dollarsToCents(v.value);
        if (cents === null) issue("value", "Enter a dollar amount such as 10 or 12.50.");
        else if (cents <= 0) issue("value", "The discount must be more than $0.");
      }

      if (dollarsToCents(v.minPurchase || "0") === null) issue("minPurchase", "Enter a dollar amount such as 0 or 40.");

      if (!/^\d{1,7}$/.test(v.maxRedemptions) || Number(v.maxRedemptions) < 1) issue("maxRedemptions", "Enter a whole number, 1 or more.");
      else if (ctx.existing && Number(v.maxRedemptions) < ctx.existing.redemptions) issue("maxRedemptions", `Already redeemed ${ctx.existing.redemptions.toLocaleString("en-US")} times — the limit can't be lower.`);

      const iso = v.expires ? endOfDayIso(v.expires, ctx.tz) : null;
      if (!v.expires) issue("expires", "Choose an expiry date.");
      else if (!iso) issue("expires", "Choose a valid date.");
      else if (!ctx.existing && new Date(iso).getTime() <= ctx.now) issue("expires", "New coupons must expire in the future.");
    })
    .transform((v) => ({
      code: v.code,
      kind: v.kind,
      value: v.kind === "percent" ? Number(v.value) : dollarsToCents(v.value)!,
      minPurchaseCents: dollarsToCents(v.minPurchase || "0")!,
      maxRedemptions: Number(v.maxRedemptions),
      expiresAt: endOfDayIso(v.expires, ctx.tz)!,
      firstBookingOnly: v.firstBookingOnly,
      active: v.active,
    }));
}

function CouponDialog({ open, coupon, onOpenChange }: { open: boolean; coupon: Coupon | null; onOpenChange: (o: boolean) => void }) {
  const coupons = useApp((s) => s.coupons);
  const saveCoupon = useApp((s) => s.saveCoupon);
  const { me } = useStaff();
  const tz = useViewerTimezone();
  const now = useNow(60_000);

  const [values, setValues] = React.useState<FormValues>(EMPTY_FORM);
  const [touched, setTouched] = React.useState<Partial<Record<FormField, boolean>>>({});
  const [submitted, setSubmitted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  // Reset whenever the dialog opens (or switches to another coupon).
  const openKey = open ? coupon?.id ?? "new" : null;
  const [lastKey, setLastKey] = React.useState<string | null>(null);
  if (lastKey !== openKey) {
    setLastKey(openKey);
    if (openKey) {
      setValues(coupon ? toForm(coupon, tz) : EMPTY_FORM);
      setTouched({});
      setSubmitted(false);
      setBusy(false);
    }
  }

  const schema = React.useMemo(
    () => couponSchema({ existing: coupon, others: coupons.filter((c) => c.id !== coupon?.id), now, tz }),
    [coupon, coupons, now, tz],
  );
  const result = schema.safeParse(values);
  const errors: Partial<Record<FormField, string>> = {};
  if (!result.success) {
    for (const i of result.error.issues) {
      const k = i.path[0] as FormField;
      if (!errors[k]) errors[k] = i.message;
    }
  }
  const show = (k: FormField) => (touched[k] || submitted ? errors[k] : undefined);
  const set = <K extends FormField>(k: K, v: FormValues[K]) => setValues((s) => ({ ...s, [k]: v }));
  const blur = (k: FormField) => () => setTouched((t) => ({ ...t, [k]: true }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!result.success) return;
    setBusy(true);
    const res = saveCoupon({ ...result.data, id: coupon?.id });
    setBusy(false);
    if (!res.ok) {
      if (/code/i.test(res.error)) {
        setTouched((t) => ({ ...t, code: true }));
        toast.error(res.error);
      } else toast.error(res.error);
      return;
    }
    toast.success(coupon ? `${res.data.code} updated` : `${res.data.code} created`, { description: "Recorded in the audit log." });
    onOpenChange(false);
  };

  const preview = result.success ? result.data : null;
  const isAdmin = me?.role === "admin";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={coupon ? `Edit ${coupon.code}` : "New coupon"} description={coupon ? `Redeemed ${pluralize(coupon.redemptions, "time")} so far.` : "Codes are case-insensitive at checkout and stored in upper case."} size="md">
        <form onSubmit={submit} noValidate>
          <DialogBody className="space-y-4">
            <Field label="Code" required error={show("code")} hint="4–16 letters or numbers, e.g. SPRING20.">
              <Input
                value={values.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                onBlur={blur("code")}
                maxLength={16}
                autoComplete="off"
                spellCheck={false}
                className="font-mono uppercase tracking-wide"
                autoFocus={!coupon}
              />
            </Field>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-ink" aria-hidden>
                Discount type
              </p>
              <Segmented
                label="Discount type"
                value={values.kind}
                onChange={(v) => {
                  set("kind", v);
                  set("value", "");
                }}
                options={[
                  { value: "percent", label: "Percentage" },
                  { value: "fixed", label: "Fixed amount" },
                ]}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={values.kind === "percent" ? "Percent off" : "Amount off"} required error={show("value")} hint={values.kind === "percent" ? "Whole number, 1–100." : "In dollars, e.g. 10 or 12.50."}>
                <Input
                  inputMode={values.kind === "percent" ? "numeric" : "decimal"}
                  value={values.value}
                  onChange={(e) => set("value", e.target.value)}
                  onBlur={blur("value")}
                  prefixText={values.kind === "fixed" ? "$" : undefined}
                  suffix={values.kind === "percent" ? <span className="pr-1 text-[13px]">%</span> : undefined}
                  className="tabular-nums"
                />
              </Field>
              <Field label="Minimum purchase" error={show("minPurchase")} hint="Lesson price needed. $0 for none.">
                <Input inputMode="decimal" value={values.minPurchase} onChange={(e) => set("minPurchase", e.target.value)} onBlur={blur("minPurchase")} prefixText="$" className="tabular-nums" />
              </Field>
              <Field
                label="Max redemptions"
                required
                error={show("maxRedemptions")}
                hint={coupon ? `At least ${coupon.redemptions.toLocaleString("en-US")} (already used).` : "Total uses across all learners."}
              >
                <Input inputMode="numeric" value={values.maxRedemptions} onChange={(e) => set("maxRedemptions", e.target.value)} onBlur={blur("maxRedemptions")} className="tabular-nums" />
              </Field>
              <Field label="Expires" required error={show("expires")} hint="Ends at 11:59 PM in your time zone.">
                <Input type="date" value={values.expires} onChange={(e) => set("expires", e.target.value)} onBlur={blur("expires")} min={coupon ? undefined : dateKey(new Date(now), tz)} />
              </Field>
            </div>

            <div className="space-y-3 rounded-lg border border-line px-3.5 py-3">
              <Checkbox
                label="First paid booking only"
                description="Only learners without an earlier paid booking can use it."
                checked={values.firstBookingOnly}
                onCheckedChange={(v) => set("firstBookingOnly", v === true)}
              />
              <Checkbox label="Active" description="Inactive codes are rejected at checkout." checked={values.active} onCheckedChange={(v) => set("active", v === true)} />
            </div>

            <div className="rounded-lg bg-canvas px-3.5 py-3 text-[13px]" aria-live="polite">
              <p className="flex items-center gap-1.5 font-medium text-ink">
                <Gift className="size-3.5 text-muted" aria-hidden /> Summary
              </p>
              <p className="mt-1 text-ink-2">
                {preview
                  ? [
                      `${discountLabel(preview)} off`,
                      preview.minPurchaseCents ? `lessons of ${formatCents(preview.minPurchaseCents)} or more` : "any lesson price",
                      preview.firstBookingOnly ? "first paid booking only" : null,
                      `up to ${pluralize(preview.maxRedemptions, "use")}`,
                      `expires ${formatDate(preview.expiresAt, tz)}`,
                      preview.active ? null : "inactive",
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "Complete the required fields to see how the code will work."}
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" loading={busy} disabled={!isAdmin}>
              {coupon ? "Save changes" : "Create coupon"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
