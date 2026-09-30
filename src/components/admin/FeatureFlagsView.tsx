"use client";

import * as React from "react";
import { Info, ToggleLeft, X } from "lucide-react";
import type { AuditLog, FeatureFlag } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { isFlagOn } from "@/lib/flags";
import { useNow, useViewerTimezone } from "@/lib/store/hooks";
import { formatDateTime, formatRelative, pluralize } from "@/lib/format";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { ConfirmDialog, Tooltip } from "@/components/ui/Overlay";
import { Switch } from "@/components/ui/Controls";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { ClearFilters, FilterSelect, MiniStat, SearchInput, TextLink, Toolbar, matches, useDirectory, useStaff, useSticky } from "./kit";
import { describeFlagChange, sortAudit } from "./AuditLogView";

/**
 * Core flags gate booking and money flows, so turning one off needs a confirmation. Impact copy
 * describes what the store actually enforces in this preview.
 */
const CORE: Record<string, { impact: string; enforced: boolean }> = {
  trial_lessons: { impact: "Families can't book trial lessons — trial requests are rejected at checkout, even for tutors who offer a trial.", enforced: true },
  instant_booking: { impact: "New bookings wait for tutor approval instead of confirming instantly, and tutors can't switch instant booking on in their booking rules.", enforced: true },
  online_lessons: { impact: "Online bookings are blocked at checkout (“Online lessons are temporarily unavailable”). In-person bookings continue.", enforced: true },
  lead_credits: { impact: "Tutors apply to jobs without spending credits, and credit pack purchases are blocked.", enforced: true },
  coupons: { impact: "Promo codes are rejected at checkout (“Promo codes aren't available right now”).", enforced: true },
  parent_accounts: { impact: "Parent accounts and child profiles are switched off for the platform.", enforced: false },
};

type View = "all" | "on" | "off" | "partial" | "core";
const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: "all", label: "All flags" },
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
  { value: "partial", label: "Partial rollout" },
  { value: "core", label: "Core flags" },
];

const isPartial = (f: FeatureFlag) => f.enabled && f.rolloutPercent > 0 && f.rolloutPercent < 100;
/** Enabled, but a 0% rollout means no account gets it. */
const reachesNobody = (f: FeatureFlag) => f.enabled && f.rolloutPercent <= 0;

/** Whole number 0–100, or null. */
function parseRollout(input: string): number | null {
  const s = input.trim();
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  return n >= 0 && n <= 100 ? n : null;
}

export function FeatureFlagsView() {
  return (
    <PermissionGate permission="flags.manage">
      <FlagsInner />
    </PermissionGate>
  );
}

function FlagsInner() {
  const flags = useApp((s) => s.flags);
  const auditLogs = useApp((s) => s.auditLogs);
  const setFlag = useApp((s) => s.setFlag);
  const { me, can } = useStaff();
  const dir = useDirectory();
  const now = useNow(60_000);

  // setFlag also requires the administrator role, on top of flags.manage.
  const canEdit = can("flags.manage") && me?.role === "admin";
  const [q, setQ] = React.useState("");
  const [view, setView] = React.useState<View>("all");
  const [confirmKey, setConfirmKey] = React.useState<string | null>(null);

  const lastChange = React.useMemo(() => {
    const m = new Map<string, AuditLog>();
    for (const a of sortAudit(auditLogs)) if (a.action === "flag.update" && !m.has(a.targetId)) m.set(a.targetId, a);
    return m;
  }, [auditLogs]);
  const latest = React.useMemo(() => sortAudit(auditLogs).find((a) => a.action === "flag.update"), [auditLogs]);

  const rows = React.useMemo(
    () =>
      flags.filter((f) => {
        if (view === "on" && !f.enabled) return false;
        if (view === "off" && f.enabled) return false;
        if (view === "partial" && !isPartial(f)) return false;
        if (view === "core" && !CORE[f.key]) return false;
        return matches(q, f.label, f.key, f.description);
      }),
    [flags, view, q],
  );

  const enabled = flags.filter((f) => f.enabled);
  const partial = flags.filter(isPartial);
  const disabled = flags.filter((f) => !f.enabled);
  const zero = flags.filter(reachesNobody);
  const filtered = q.trim() !== "" || view !== "all";

  const apply = (flag: FeatureFlag, patch: Partial<Pick<FeatureFlag, "enabled" | "rolloutPercent">>, message: string) => {
    const res = setFlag(flag.key, patch);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success(message, { description: "Applies immediately. Recorded in the audit log." });
    return true;
  };

  const toggle = (flag: FeatureFlag, next: boolean) => {
    if (!next && CORE[flag.key]) {
      setConfirmKey(flag.key);
      return;
    }
    const ok = apply(flag, { enabled: next }, `${flag.label} turned ${next ? "on" : "off"}`);
    if (ok && next && flag.rolloutPercent <= 0) toast("Rollout is at 0%", { description: `${flag.label} reaches no accounts until you raise the rollout.` });
  };

  const confirmFlag = useSticky(flags.find((f) => f.key === confirmKey) ?? null);

  return (
    <>
      <PageHeader title="Feature flags" description="Turn platform features on or off and roll them out gradually to a share of accounts. Every change is written to the audit log." />

      {!canEdit && (
        <InlineAlert tone="info" title="Read-only" className="mb-5">
          Changing flags requires the <span className="font-mono text-[12px]">flags.manage</span> permission and an administrator account.
        </InlineAlert>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat
          label="Enabled"
          value={`${enabled.length} of ${flags.length}`}
          hint={zero.length ? `${pluralize(zero.length, "flag")} at 0% rollout` : flags.length ? `${Math.round((enabled.length / flags.length) * 100)}% of flags` : undefined}
        />
        <MiniStat
          label="Partial rollouts"
          value={partial.length}
          hint={partial.length ? partial.slice(0, 2).map((f) => `${f.label} ${f.rolloutPercent}%`).join(", ") + (partial.length > 2 ? ` +${partial.length - 2}` : "") : "Every enabled flag is at 100%"}
        />
        <MiniStat label="Off" value={disabled.length} hint={disabled.length ? disabled.slice(0, 2).map((f) => f.label).join(", ") + (disabled.length > 2 ? ` +${disabled.length - 2}` : "") : "Nothing is switched off"} />
        <MiniStat label="Last change" value={latest ? formatRelative(latest.createdAt, now) : "—"} hint={latest ? `${dir.name(latest.actorId)} · ${latest.targetId}` : "No flag changes recorded"} />
      </div>

      <Toolbar summary={pluralize(rows.length, "flag")}>
        <SearchInput value={q} onChange={setQ} placeholder="Search name, key or description…" label="Search feature flags" />
        <FilterSelect label="Show" value={view} onChange={setView} options={VIEW_OPTIONS} />
        <ClearFilters
          active={filtered}
          onClear={() => {
            setQ("");
            setView("all");
          }}
        />
      </Toolbar>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={<ToggleLeft />}
            title={filtered ? "No flags match these filters" : "No feature flags"}
            description={filtered ? "Try another name or key, or clear the filters." : "Feature flags are defined by engineering and appear here once they ship."}
          />
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {rows.map((f) => (
            <FlagRow
              key={f.key}
              flag={f}
              canEdit={canEdit}
              showHistoryLink={can("audit.read")}
              last={lastChange.get(f.key)}
              viewerOn={isFlagOn(flags, f.key, me?.id)}
              onToggle={(v) => toggle(f, v)}
              onRollout={(n) => apply(f, { rolloutPercent: n }, `${f.label} rollout set to ${n}%`)}
            />
          ))}
        </ul>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Changes apply immediately. A partial rollout is bucketed by account: each account gets a stable bucket from 0 to 99 per flag (signed-out visitors share one), and the flag is on when that bucket is below the rollout percentage. Checks run against the account taking the action.
        </span>
      </p>

      <ConfirmDialog
        open={!!confirmKey}
        onOpenChange={(o) => !o && setConfirmKey(null)}
        title={confirmFlag ? `Turn off ${confirmFlag.label}?` : "Turn off flag?"}
        description="This is a core flag. The change applies to everyone on the platform immediately."
        confirmLabel={confirmFlag ? `Turn off ${confirmFlag.label.toLowerCase()}` : "Turn off"}
        tone="danger"
        onConfirm={() => {
          const f = flags.find((x) => x.key === confirmKey);
          if (f && apply(f, { enabled: false }, `${f.label} turned off`)) setConfirmKey(null);
        }}
      >
        {confirmFlag && (
          <div className="space-y-3 text-[13.5px] leading-relaxed text-ink-2">
            <p>
              <span className="font-medium text-ink">Controls: </span>
              {confirmFlag.description}
            </p>
            <p>
              <span className="font-medium text-ink">Impact: </span>
              {CORE[confirmFlag.key]?.impact}
            </p>
            {CORE[confirmFlag.key] && !CORE[confirmFlag.key].enforced && (
              <p className="text-[13px] text-muted">This preview doesn&apos;t enforce this flag yet; in production the feature-flag service applies it.</p>
            )}
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}

/* ─── Row ────────────────────────────────────────────────────────────────────── */

function FlagRow({
  flag,
  canEdit,
  showHistoryLink,
  last,
  viewerOn,
  onToggle,
  onRollout,
}: {
  flag: FeatureFlag;
  canEdit: boolean;
  showHistoryLink: boolean;
  last?: AuditLog;
  viewerOn: boolean;
  onToggle: (v: boolean) => void;
  onRollout: (n: number) => boolean;
}) {
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const now = useNow(60_000);
  const id = React.useId();
  const core = !!CORE[flag.key];

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3.5 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_20rem_auto] lg:items-center lg:gap-x-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 id={`${id}-label`} className="text-[14.5px] font-semibold text-ink">
            {flag.label}
          </h2>
          {core && (
            <Tooltip content="Turning a core flag off asks for confirmation first.">
              <span tabIndex={0} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ink/30">
                <Badge size="sm" tone="outline">Core</Badge>
              </span>
            </Tooltip>
          )}
          {isPartial(flag) && <Badge size="sm" tone="accent">Partial · {flag.rolloutPercent}%</Badge>}
          {reachesNobody(flag) && <Badge size="sm" tone="warning">On · reaches no accounts</Badge>}
        </div>
        <p className="mt-0.5 font-mono text-[12px] text-muted">{flag.key}</p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{flag.description}</p>
        <p className="mt-1.5 text-[12.5px] text-muted">
          {last ? (
            <>
              Last change: {describeFlagChange(last.meta)} · {dir.name(last.actorId)} ·{" "}
              <time dateTime={last.createdAt} title={formatDateTime(last.createdAt, tz)}>
                {formatRelative(last.createdAt, now)}
              </time>
            </>
          ) : (
            "No changes recorded"
          )}
          {showHistoryLink && (
            <>
              {" · "}
              <TextLink href={`/admin/audit-log?q=${encodeURIComponent(flag.key)}`}>History</TextLink>
            </>
          )}
        </p>
      </div>

      <div className="col-span-2 row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
        <RolloutControl flag={flag} disabled={!canEdit} onApply={onRollout} />
        {isPartial(flag) && (
          <p className="mt-1 text-[12px] text-muted">{viewerOn ? "Your account is inside this rollout, so it's on for you." : "Your account is outside this rollout, so it's off for you."}</p>
        )}
      </div>

      <div className="col-start-2 row-start-1 flex items-center gap-2.5 self-start justify-self-end lg:col-start-3 lg:self-center">
        <span className={cn("w-7 text-right text-[13px] font-medium", flag.enabled ? "text-ink" : "text-muted")} aria-hidden>
          {flag.enabled ? "On" : "Off"}
        </span>
        <Switch checked={flag.enabled} onCheckedChange={onToggle} disabled={!canEdit} aria-labelledby={`${id}-label`} />
      </div>
    </li>
  );
}

function RolloutControl({ flag, disabled, onApply }: { flag: FeatureFlag; disabled: boolean; onApply: (n: number) => boolean }) {
  const id = React.useId();
  const [draft, setDraft] = React.useState(String(flag.rolloutPercent));
  const [error, setError] = React.useState<string>();
  // Reset the draft whenever the stored value changes (after Apply, or a change elsewhere).
  const [base, setBase] = React.useState(flag.rolloutPercent);
  if (base !== flag.rolloutPercent) {
    setBase(flag.rolloutPercent);
    setDraft(String(flag.rolloutPercent));
    setError(undefined);
  }

  const parsed = parseRollout(draft);
  const dirty = draft.trim() !== String(flag.rolloutPercent);
  const slider = parsed ?? flag.rolloutPercent;
  const invalidMsg = "Enter a whole number from 0 to 100.";

  const reset = () => {
    setDraft(String(flag.rolloutPercent));
    setError(undefined);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseRollout(draft);
    if (n === null) {
      setError(invalidMsg);
      return;
    }
    if (n === flag.rolloutPercent) {
      reset();
      return;
    }
    onApply(n);
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      onKeyDown={(e) => {
        if (e.key === "Escape" && dirty) {
          e.stopPropagation();
          reset();
        }
      }}
    >
      <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
        <label htmlFor={`${id}-range`} className="font-medium text-muted">
          Rollout
        </label>
        <span className="tabular-nums text-muted">
          {dirty && parsed !== null ? (
            <>
              {flag.rolloutPercent}% → <span className="font-medium text-ink">{parsed}%</span> of accounts
            </>
          ) : !flag.enabled ? (
            `${flag.rolloutPercent}% · applies when on`
          ) : flag.rolloutPercent >= 100 ? (
            "All accounts"
          ) : flag.rolloutPercent <= 0 ? (
            "No accounts"
          ) : (
            `${flag.rolloutPercent}% of accounts`
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-range`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={slider}
          disabled={disabled}
          aria-valuetext={`${slider}%`}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(undefined);
          }}
          className="h-9 min-w-0 flex-1 cursor-pointer accent-ink disabled:cursor-not-allowed disabled:opacity-50"
        />
        <label htmlFor={`${id}-num`} className="sr-only">
          Rollout percent for {flag.label}
        </label>
        <Input
          id={`${id}-num`}
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          value={draft}
          disabled={disabled}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error && parseRollout(e.target.value) !== null) setError(undefined);
          }}
          onBlur={(e) => setError(parseRollout(e.currentTarget.value) === null ? invalidMsg : undefined)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          suffix={<span className="pr-1 text-[13px]">%</span>}
          className="w-[4.5rem] shrink-0 [&_input]:h-9 [&_input]:pl-2.5 [&_input]:pr-7 [&_input]:text-sm [&_input]:tabular-nums"
        />
        {dirty && !disabled && (
          <>
            <Button type="submit" size="sm">
              Apply
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" onClick={reset} aria-label={`Discard rollout change for ${flag.label}`}>
              <X />
            </Button>
          </>
        )}
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-[12.5px] text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
