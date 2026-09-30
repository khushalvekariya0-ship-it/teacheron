"use client";

import * as React from "react";
import { CalendarClock, CircleAlert, Link2, RotateCcw, Scale, Timer, Undo2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { useViewerTimezone } from "@/lib/store/hooks";
import { DEFAULT_POLICY, type BookingPolicy } from "@/lib/data/platform";
import { policySummary } from "@/lib/booking";
import { formatCents, formatDateTime, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, PermissionGate } from "@/components/dashboard/Shell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { PermissionButton, PermissionNotice, TextLink, useDirectory, useStaff } from "./kit";
import { CompareRow, PlatformFeeCard } from "./PlatformFeeCard";

type Key = keyof BookingPolicy;
type Unit = "hours" | "percent" | "count" | "days" | "minutes" | "dollars";

interface FieldDef {
  key: Key;
  label: string;
  unit: Unit;
  hint: string;
  /** Set when part of this value's effect isn't simulated in the preview build. */
  previewNote?: string;
}

const GROUPS: { title: string; description: string; icon: React.ReactNode; fields: FieldDef[] }[] = [
  {
    title: "Cancellations",
    description: "Refunds when a learner cancels. Cancellations by a tutor or by staff are always refunded in full.",
    icon: <CalendarClock />,
    fields: [
      { key: "freeCancellationHours", label: "Free cancellation window", unit: "hours", hint: "Cancelling at least this long before a regular lesson gets a full refund." },
      { key: "lateCancellationRefundPercent", label: "Late cancellation refund", unit: "percent", hint: "Share of the price refunded when a learner cancels inside the window." },
      { key: "trialFreeCancellationHours", label: "Trial free cancellation window", unit: "hours", hint: "Free cancellation window for trial lessons." },
    ],
  },
  {
    title: "Rescheduling",
    description: "When and how often a booking can be moved by the learner or tutor.",
    icon: <Undo2 />,
    fields: [
      { key: "rescheduleMinHours", label: "Reschedule cutoff", unit: "hours", hint: "Lessons can be moved until this many hours before the start time." },
      { key: "maxReschedulesPerBooking", label: "Reschedules per booking", unit: "count", hint: "How many times a single booking can be moved." },
    ],
  },
  {
    title: "No-shows",
    description: "Reporting window and outcomes when someone doesn't join.",
    icon: <Timer />,
    fields: [
      { key: "noShowGraceMinutes", label: "No-show grace period", unit: "minutes", hint: "A no-show can be reported this many minutes after the start time." },
      {
        key: "studentNoShowRefundPercent",
        label: "Student no-show refund",
        unit: "percent",
        hint: "Share refunded to the learner when they miss a lesson.",
      },
      {
        key: "tutorNoShowRefundPercent",
        label: "Tutor no-show refund",
        unit: "percent",
        hint: "Share refunded to the learner when the tutor misses a lesson.",
      },
      {
        key: "tutorNoShowCreditCents",
        label: "Tutor no-show credit",
        unit: "dollars",
        hint: "Platform credit the learner is told they've received after a tutor no-show.",
        previewNote: "Learners are notified of this credit, but credit balances aren't simulated in this preview.",
      },
    ],
  },
  {
    title: "Disputes & lessons",
    description: "How long problems can be reported, and when meeting links appear.",
    icon: <Scale />,
    fields: [
      { key: "disputeWindowDays", label: "Dispute window", unit: "days", hint: "A dispute can be opened for this many days after a lesson ends. Tutor earnings become available after it closes." },
      { key: "meetingLinkVisibleMinutesBefore", label: "Meeting link visible", unit: "minutes", hint: "The online lesson link appears this many minutes before the start time." },
    ],
  },
];

const FIELDS: FieldDef[] = GROUPS.flatMap((g) => g.fields);

const SUFFIX: Record<Unit, string> = { hours: "hours", percent: "%", count: "times", days: "days", minutes: "min", dollars: "" };

function formatValue(unit: Unit, n: number): string {
  switch (unit) {
    case "hours":
      return `${n} h`;
    case "percent":
      return `${n}%`;
    case "count":
      return pluralize(n, "time");
    case "days":
      return pluralize(n, "day");
    case "minutes":
      return `${n} min`;
    case "dollars":
      return formatCents(n, { exact: true });
  }
}

/** Cents → "10.00" for the dollar input (integer math). */
function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

function toDraft(p: BookingPolicy): Record<Key, string> {
  return Object.fromEntries(FIELDS.map((f) => [f.key, f.unit === "dollars" ? centsToInput(p[f.key]) : String(p[f.key])])) as Record<Key, string>;
}

type Parsed = { ok: true; value: number } | { ok: false; error: string };

function parseField(def: FieldDef, raw: string): Parsed {
  const v = raw.trim();
  if (!v) return { ok: false, error: "Enter a value." };
  if (v.startsWith("-")) return { ok: false, error: "Can't be negative." };
  if (def.unit === "dollars") {
    const m = /^(\d{1,6})(?:\.(\d+))?$/.exec(v);
    if (!m) return { ok: false, error: "Enter a dollar amount such as 10 or 12.50." };
    if (m[2] && m[2].length > 2) return { ok: false, error: "Use at most 2 decimal places." };
    return { ok: true, value: Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0")) };
  }
  if (!/^\d{1,6}$/.test(v)) return { ok: false, error: "Enter a whole number (0 or more)." };
  const n = Number(v);
  if (def.unit === "percent" && n > 100) return { ok: false, error: "Can't exceed 100%." };
  return { ok: true, value: n };
}

export function SettingsView() {
  return (
    <PermissionGate permission="settings.manage">
      <SettingsInner />
    </PermissionGate>
  );
}

function SettingsInner() {
  const policy = useApp((s) => s.policy);
  const updatePolicy = useApp((s) => s.updatePolicy);
  const auditLogs = useApp((s) => s.auditLogs);
  const { me, can } = useStaff();
  const dir = useDirectory();
  const tz = useViewerTimezone();
  const isAdmin = me?.role === "admin";
  const editable = can("settings.manage") && isAdmin;

  const [draft, setDraft] = React.useState<Record<Key, string>>(() => toDraft(policy));
  const [touched, setTouched] = React.useState<Partial<Record<Key, boolean>>>({});
  const [submitted, setSubmitted] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  // When the saved policy changes (after saving, or from another tab), start from it again.
  const [savedPolicy, setSavedPolicy] = React.useState(policy);
  if (savedPolicy !== policy) {
    setSavedPolicy(policy);
    setDraft(toDraft(policy));
    setTouched({});
    setSubmitted(false);
  }

  const saved = React.useMemo(() => toDraft(policy), [policy]);
  const parsed = React.useMemo(() => Object.fromEntries(FIELDS.map((f) => [f.key, parseField(f, draft[f.key])])) as Record<Key, Parsed>, [draft]);
  const invalid = FIELDS.filter((f) => !parsed[f.key].ok);
  const changed = FIELDS.filter((f) => {
    const p = parsed[f.key];
    return p.ok && p.value !== policy[f.key];
  });
  const dirty = FIELDS.some((f) => draft[f.key] !== saved[f.key]);

  /** Saved policy with every valid draft value applied — drives the live preview. */
  const previewPolicy = React.useMemo(() => {
    const next = { ...policy };
    for (const f of FIELDS) {
      const p = parsed[f.key];
      if (p.ok) next[f.key] = p.value;
    }
    return next;
  }, [policy, parsed]);

  const deviations = FIELDS.filter((f) => policy[f.key] !== DEFAULT_POLICY[f.key]).length;
  const lastChange = React.useMemo(
    () => auditLogs.filter((a) => a.action === "policy.update").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null,
    [auditLogs],
  );

  const errorFor = (k: Key) => {
    const p = parsed[k];
    return !p.ok && (touched[k] || submitted) ? p.error : undefined;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (invalid.length) {
      toast.error(invalid.length === 1 ? `Fix “${invalid[0].label}” before saving` : `Fix ${invalid.length} fields before saving`);
      return;
    }
    if (!changed.length) {
      toast("Nothing to save", { description: "The values match the current policy." });
      return;
    }
    setConfirmOpen(true);
  };

  const confirm = () => {
    const patch: Partial<BookingPolicy> = {};
    for (const f of changed) {
      const p = parsed[f.key];
      if (p.ok) patch[f.key] = p.value;
    }
    const res = updatePolicy(patch);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setConfirmOpen(false);
    toast.success(`Booking policy updated · ${pluralize(changed.length, "change")}`, { description: "Recorded in the audit log." });
  };

  const reset = () => {
    setDraft(saved);
    setTouched({});
    setSubmitted(false);
  };

  const loadDefaults = () => {
    setDraft(toDraft(DEFAULT_POLICY));
    setTouched({});
    setSubmitted(false);
  };

  return (
    <>
      <PageHeader
        title="Platform settings"
        description="Booking policy and the Starter plan commission. Changes are written to the audit log and take effect immediately."
      />

      {!isAdmin && (
        <div className="mb-6">
          <PermissionNotice permission="settings.manage">Only administrator accounts can change platform settings, even with</PermissionNotice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
        <form onSubmit={submit} noValidate>
          <Card>
            <CardHeader
              title="Booking policy"
              description={
                <>
                  Applies to every booking, including ones already confirmed — refunds and reschedule limits are checked against the policy in force when the action happens.{" "}
                  {deviations ? `${pluralize(deviations, "value")} differ from the launch defaults.` : "All values match the launch defaults."}
                </>
              }
            />
            <div className="mt-4 divide-y divide-line border-t border-line">
              {GROUPS.map((g) => (
                <fieldset key={g.title} className="px-5 py-5">
                  <legend className="sr-only">{g.title}</legend>
                  <div className="mb-4 flex items-start gap-2.5">
                    <span className="mt-0.5 text-muted [&_svg]:size-4" aria-hidden>
                      {g.icon}
                    </span>
                    <div>
                      <h2 className="text-[14px] font-semibold text-ink">{g.title}</h2>
                      <p className="mt-0.5 text-[13px] text-muted">{g.description}</p>
                    </div>
                  </div>
                  <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                    {g.fields.map((f) => (
                      <PolicyField
                        key={f.key}
                        def={f}
                        value={draft[f.key]}
                        savedValue={policy[f.key]}
                        edited={draft[f.key] !== saved[f.key]}
                        error={errorFor(f.key)}
                        disabled={!editable}
                        onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                        onBlur={() => setTouched((t) => ({ ...t, [f.key]: true }))}
                      />
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            <div className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-b-xl border-t border-line bg-surface px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12.5px] text-muted" aria-live="polite">
                {dirty ? (
                  invalid.length ? (
                    <span className="inline-flex items-center gap-1.5 text-danger">
                      <CircleAlert className="size-3.5" aria-hidden /> {pluralize(invalid.length, "field")} need{invalid.length === 1 ? "s" : ""} attention
                    </span>
                  ) : (
                    `${pluralize(changed.length, "unsaved change")}`
                  )
                ) : lastChange ? (
                  <>Last changed by {dir.name(lastChange.actorId)} · {formatDateTime(lastChange.createdAt, tz)}</>
                ) : (
                  "No changes recorded — using the launch defaults."
                )}
              </p>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={loadDefaults} disabled={!editable || FIELDS.every((f) => draft[f.key] === toDraft(DEFAULT_POLICY)[f.key])}>
                  Load defaults
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={reset} disabled={!dirty}>
                  <RotateCcw /> Reset
                </Button>
                <PermissionButton permission="settings.manage" type="submit" size="sm" disabled={!isAdmin || !dirty}>
                  Review & save
                </PermissionButton>
              </div>
            </div>
          </Card>
        </form>

        <PlatformFeeCard className="mt-6" id="platform-fee" />
        </div>

        <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start" aria-label="Policy preview">
          <PolicyPreview policy={previewPolicy} dirty={dirty && !invalid.length && changed.length > 0} />
        </aside>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Save ${pluralize(changed.length, "policy change")}?`}
        description="The new policy applies immediately to every booking, including confirmed ones."
        confirmLabel="Save policy"
        onConfirm={confirm}
      >
        <dl className="divide-y divide-line rounded-lg border border-line text-[13.5px]">
          {changed.map((f) => {
            const p = parsed[f.key];
            return <CompareRow key={f.key} label={f.label} from={formatValue(f.unit, policy[f.key])} to={p.ok ? formatValue(f.unit, p.value) : "—"} />;
          })}
        </dl>
      </ConfirmDialog>
    </>
  );
}

function PolicyField({
  def,
  value,
  savedValue,
  edited,
  error,
  disabled,
  onChange,
  onBlur,
}: {
  def: FieldDef;
  value: string;
  savedValue: number;
  edited: boolean;
  error?: string;
  disabled: boolean;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  const fallback = DEFAULT_POLICY[def.key];
  const deviates = savedValue !== fallback;
  return (
    <Field
      label={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {def.label}
          {edited && (
            <Badge tone="accent" size="sm">
              Edited
            </Badge>
          )}
          {def.previewNote && (
            <Badge tone="outline" size="sm">
              Partly simulated
            </Badge>
          )}
        </span>
      }
      error={error}
      hint={
        <>
          {def.hint}{" "}
          <span className={cn("whitespace-nowrap", deviates ? "font-medium text-warning" : "text-muted")}>
            Default: {formatValue(def.unit, fallback)}
            {deviates && " · changed"}
          </span>
          {def.previewNote && <span className="mt-1 block text-[12.5px] text-muted">{def.previewNote}</span>}
        </>
      }
    >
      <Input
        inputMode={def.unit === "dollars" ? "decimal" : "numeric"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        prefixText={def.unit === "dollars" ? "$" : undefined}
        suffix={SUFFIX[def.unit] ? <span className="pr-1 text-[13px]">{SUFFIX[def.unit]}</span> : undefined}
        className="tabular-nums [&_input]:pr-16"
      />
    </Field>
  );
}

function PolicyPreview({ policy, dirty }: { policy: BookingPolicy; dirty: boolean }) {
  const blocks: { title: string; lines: string[] }[] = [
    { title: "Regular lessons", lines: policySummary("regular", policy) },
    { title: "Trial lessons", lines: policySummary("trial", policy) },
  ];
  return (
    <Card>
      <CardHeader
        title="What learners see"
        description="The policy summary shown at checkout and on each booking."
        action={dirty ? <Badge tone="accent" size="sm">Unsaved preview</Badge> : <Badge size="sm">Live</Badge>}
      />
      <CardContent className="space-y-5">
        {blocks.map((b) => (
          <section key={b.title}>
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">{b.title}</h3>
            <ul className="mt-2 space-y-1.5 text-[13.5px] leading-relaxed text-ink-2">
              {b.lines.map((l) => (
                <li key={l} className="flex gap-2">
                  <span className="mt-[9px] size-1 shrink-0 rounded-full bg-line-strong" aria-hidden />
                  {l}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section>
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">Also applied</h3>
          <ul className="mt-2 space-y-1.5 text-[13.5px] leading-relaxed text-ink-2">
            <li className="flex gap-2">
              <Timer className="mt-[3px] size-3.5 shrink-0 text-muted" aria-hidden /> No-shows can be reported {policy.noShowGraceMinutes} minutes after the start time.
            </li>
            <li className="flex gap-2">
              <Link2 className="mt-[3px] size-3.5 shrink-0 text-muted" aria-hidden /> Meeting links appear {policy.meetingLinkVisibleMinutesBefore} minutes before online lessons.
            </li>
          </ul>
        </section>
        {policy.tutorNoShowRefundPercent !== 100 && (
          <InlineAlert tone="warning" title="Summary doesn't match the tutor no-show refund">
            The learner-facing summary always says tutor no-shows are refunded in full, but refunds will be issued at {policy.tutorNoShowRefundPercent}%.
          </InlineAlert>
        )}
        <p className="text-[12.5px] text-muted">
          The public policies page and booking dialogs read the same values. Feature availability lives in <TextLink href="/admin/feature-flags">Feature flags</TextLink>.
        </p>
      </CardContent>
    </Card>
  );
}
