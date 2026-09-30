"use client";

import * as React from "react";
import { ArrowRight, Percent } from "lucide-react";
import { useApp } from "@/lib/store";
import { useViewerTimezone } from "@/lib/store/hooks";
import { SITE } from "@/lib/site";
import { TUTOR_PLANS } from "@/lib/data/platform";
import { applyBps, formatCents, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { toast } from "@/components/ui/Toast";
import { PermissionButton, PermissionNotice, useDirectory, useStaff } from "./kit";

const EXAMPLE_CENTS = 10_000; // a $100 lesson
export const MAX_FEE_BPS = 3000;

/** 1500 → "15", 1250 → "12.5", 1234 → "12.34" (integer math only). */
export function bpsToPercent(bps: number): string {
  const whole = Math.floor(bps / 100);
  const frac = bps % 100;
  if (!frac) return String(whole);
  return `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}

/** "12.5" → 1250 basis points, validated to 0–30% with at most 2 decimals. */
export function parsePercentToBps(input: string): { ok: true; bps: number } | { ok: false; error: string } {
  const v = input.trim();
  if (!v) return { ok: false, error: "Enter a percentage between 0 and 30." };
  const m = /^(\d{1,3})(?:\.(\d+))?$/.exec(v);
  if (!m) return { ok: false, error: "Enter a number such as 15 or 12.5." };
  if (m[2] && m[2].length > 2) return { ok: false, error: "Use at most 2 decimal places." };
  const bps = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  if (bps > MAX_FEE_BPS) return { ok: false, error: "The commission can't be more than 30%." };
  return { ok: true, bps };
}

const STARTER = TUTOR_PLANS.find((p) => p.id === "free");
const PAID_RATES = TUTOR_PLANS.filter((p) => p.id !== "free")
  .map((p) => `${p.name} ${bpsToPercent(p.commissionBps)}%`)
  .join(" · ");

/**
 * Platform fee editor shared by Plans & credits and Platform settings. The fee (basis points) is the
 * commission for Starter-plan tutors; paid plans use their own rate. It's recorded on each booking at
 * creation, so a change only affects bookings made afterwards.
 */
export function PlatformFeeCard({ className, id }: { className?: string; id?: string }) {
  const bps = useApp((s) => s.platformFeeBps);
  const setPlatformFee = useApp((s) => s.setPlatformFee);
  const auditLogs = useApp((s) => s.auditLogs);
  const { me, can } = useStaff();
  const dir = useDirectory();
  const tz = useViewerTimezone();

  const [value, setValue] = React.useState(() => bpsToPercent(bps));
  const [touched, setTouched] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  // Re-sync the input when the saved fee changes (after a save here or in another tab).
  const [savedBps, setSavedBps] = React.useState(bps);
  if (savedBps !== bps) {
    setSavedBps(bps);
    setValue(bpsToPercent(bps));
    setTouched(false);
  }

  const parsed = parsePercentToBps(value);
  const error = touched && !parsed.ok ? parsed.error : undefined;
  const nextBps = parsed.ok ? parsed.bps : null;
  const dirty = nextBps !== null && nextBps !== bps;
  const isAdmin = me?.role === "admin";

  const lastChange = React.useMemo(
    () => auditLogs.filter((a) => a.action === "settings.platform_fee").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null,
    [auditLogs],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!parsed.ok || !dirty) return;
    setConfirmOpen(true);
  };

  const confirm = () => {
    if (nextBps === null) return;
    const res = setPlatformFee(nextBps);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setConfirmOpen(false);
    toast.success(`Starter commission set to ${bpsToPercent(nextBps)}%`, { description: "Applies to new Starter-plan bookings. Recorded in the audit log." });
  };

  const feeNow = applyBps(EXAMPLE_CENTS, bps);
  const feeNext = nextBps === null ? null : applyBps(EXAMPLE_CENTS, nextBps);

  return (
    <Card id={id} className={cn("scroll-mt-24", className)}>
      <CardHeader
        title="Starter plan commission (default platform fee)"
        description={`Commission on bookings with Starter-plan tutors, including tutors with no subscription. Paid plans use their own rate (${PAID_RATES}).`}
        action={
          <span className="inline-flex items-baseline gap-1 rounded-lg border border-line bg-canvas px-2.5 py-1 text-sm">
            <span className="text-muted">Current</span>
            <span className="font-semibold tabular-nums text-ink">{bpsToPercent(bps)}%</span>
          </span>
        }
      />
      <form onSubmit={submit} noValidate>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-start">
            <Field
              label="New commission"
              hint={`0–30%, up to 2 decimals. Default: ${bpsToPercent(SITE.platformFeeBps)}%.`}
              error={error}
            >
              <Input
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => setTouched(true)}
                suffix={<Percent className="size-4" aria-hidden />}
                disabled={!can("settings.manage") || !isAdmin}
                className="tabular-nums"
              />
            </Field>
            <dl className="grid grid-cols-2 gap-2.5 text-[13px] sm:mt-7">
              <div className="rounded-lg border border-line px-3 py-2.5">
                <dt className="text-muted">Fee on a $100 Starter lesson</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 font-medium tabular-nums text-ink">
                  {formatCents(feeNow, { exact: true })}
                  {dirty && feeNext !== null && (
                    <>
                      <ArrowRight className="size-3.5 text-muted" aria-hidden /><span className="sr-only">changes to</span>
                      {formatCents(feeNext, { exact: true })}
                    </>
                  )}
                </dd>
              </div>
              <div className="rounded-lg border border-line px-3 py-2.5">
                <dt className="text-muted">Tutor keeps</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 font-medium tabular-nums text-ink">
                  {formatCents(EXAMPLE_CENTS - feeNow, { exact: true })}
                  {dirty && feeNext !== null && (
                    <>
                      <ArrowRight className="size-3.5 text-muted" aria-hidden /><span className="sr-only">changes to</span>
                      {formatCents(EXAMPLE_CENTS - feeNext, { exact: true })}
                    </>
                  )}
                </dd>
              </div>
            </dl>
          </div>
          <p className="text-[13px] leading-relaxed text-muted">
            Applies to <span className="font-medium text-ink-2">new bookings only</span>. Existing bookings keep the fee recorded when they were booked, so earnings already shown to tutors don&apos;t change.
          </p>
          {STARTER && bps !== STARTER.commissionBps && (
            <p className="rounded-lg border border-warning-200 bg-warning-50 px-3.5 py-2.5 text-[13px] text-warning">
              The pricing page and plan features still list Starter at {bpsToPercent(STARTER.commissionBps)}% — that copy comes from the plan catalog and won&apos;t match {bpsToPercent(bps)}% until it&apos;s updated.
            </p>
          )}
          {can("settings.manage") && !isAdmin && <PermissionNotice permission="settings.manage">Changing the Starter commission needs an administrator account with</PermissionNotice>}
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-muted">
            {lastChange ? (
              <>
                Last changed by {dir.name(lastChange.actorId)} · {formatDateTime(lastChange.createdAt, tz)}
              </>
            ) : (
              <>No changes recorded — using the launch default.</>
            )}
          </p>
          <div className="flex gap-2 sm:justify-end">
            {dirty && (
              <PermissionButton
                permission="settings.manage"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setValue(bpsToPercent(bps));
                  setTouched(false);
                }}
              >
                Reset
              </PermissionButton>
            )}
            <PermissionButton permission="settings.manage" type="submit" size="sm" disabled={!isAdmin || (touched && !parsed.ok) || !dirty}>
              Review change
            </PermissionButton>
          </div>
        </CardFooter>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={nextBps === null ? "Change the Starter commission?" : `Change the Starter commission to ${bpsToPercent(nextBps)}%?`}
        description="Applies to Starter-plan bookings created after this change. Existing bookings keep their recorded fee; paid plans are unaffected."
        confirmLabel="Change commission"
        onConfirm={confirm}
      >
        {nextBps !== null && (
          <dl className="divide-y divide-line rounded-lg border border-line text-[13.5px]">
            <CompareRow label="Commission" from={`${bpsToPercent(bps)}%`} to={`${bpsToPercent(nextBps)}%`} />
            <CompareRow label="Fee on a $100 Starter lesson" from={formatCents(feeNow, { exact: true })} to={formatCents(applyBps(EXAMPLE_CENTS, nextBps), { exact: true })} />
            <CompareRow label="Tutor keeps" from={formatCents(EXAMPLE_CENTS - feeNow, { exact: true })} to={formatCents(EXAMPLE_CENTS - applyBps(EXAMPLE_CENTS, nextBps), { exact: true })} />
          </dl>
        )}
      </ConfirmDialog>
    </Card>
  );
}

export function CompareRow({ label, from, to }: { label: React.ReactNode; from: React.ReactNode; to: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3.5 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="flex items-center gap-2 tabular-nums">
        <span className="text-muted line-through decoration-line-strong">{from}</span>
        <ArrowRight className="size-3.5 text-subtle" aria-hidden /><span className="sr-only">changes to</span>
        <span className="font-medium text-ink">{to}</span>
      </dd>
    </div>
  );
}
