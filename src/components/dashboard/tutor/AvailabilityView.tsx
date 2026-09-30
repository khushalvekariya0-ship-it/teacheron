"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarOff, CalendarPlus, CalendarRange, Clock3, Globe, RotateCcw, Trash2, Zap } from "lucide-react";
import type { AvailabilityException, WeeklyWindow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useFlag, useNow, useViewerTimezone } from "@/lib/store/hooks";
import { generateSlots, zonedParts } from "@/lib/time";
import { formatDuration, formatTime, tzAbbrev } from "@/lib/format";
import { US_TIMEZONES } from "@/lib/data/catalog";
import { PageHeader } from "@/components/dashboard/Shell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, DetailRow } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Controls";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { NeedsTutorProfile } from "./shared";
import { formatDateKey, todayKey, useMyBookings, useMyTutor } from "./hooks";
import { AddRangeButton, RangeList, WeeklyAvailabilityEditor, formatHours, normalizeWeek, timeLabel, validateRanges, validateWeek, weeklyMinutes, type Range } from "./AvailabilityEditor";

const sameWeek = (a: WeeklyWindow[], b: WeeklyWindow[]) => JSON.stringify(normalizeWeek(a)) === JSON.stringify(normalizeWeek(b));
const NO_WINDOWS: WeeklyWindow[] = [];

export function AvailabilityView() {
  const { tutor } = useMyTutor();
  const tz = useViewerTimezone();
  const now = useNow(60_000);
  const bookings = useMyBookings(tutor?.id);
  const setAvailability = useApp((s) => s.setAvailability);
  const setExceptions = useApp((s) => s.setExceptions);
  const instantFlag = useFlag("instant_booking");

  const saved = tutor?.availability ?? NO_WINDOWS;
  const [draft, setDraft] = React.useState<WeeklyWindow[]>(saved);
  const [base, setBase] = React.useState(saved);
  // Reset the editor when the saved schedule changes elsewhere (another tab, a reset).
  if (base !== saved) {
    setBase(saved);
    if (sameWeek(draft, base)) setDraft(saved);
  }
  const [saving, setSaving] = React.useState(false);
  const [adding, setAdding] = React.useState(false);

  if (!tutor) return <NeedsTutorProfile what="availability" />;

  const errors = validateWeek(draft);
  const invalid = Object.keys(errors).length > 0;
  const dirty = !sameWeek(draft, saved);
  const minutes = weeklyMinutes(draft);
  const tzLabel = US_TIMEZONES.find((t) => t.value === tutor.timezone)?.label ?? tutor.timezone;
  const today = todayKey(now, tutor.timezone);
  const upcomingExceptions = [...tutor.exceptions].filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));

  const save = () => {
    setSaving(true);
    const res = setAvailability(normalizeWeek(draft));
    setSaving(false);
    if (!res.ok) toast.error(res.error);
    else toast.success("Availability saved", { description: `${formatHours(minutes)} per week. Families see the new times right away.` });
  };

  const removeException = (ex: AvailabilityException) => {
    const before = tutor.exceptions;
    const res = setExceptions(before.filter((e) => e.date !== ex.date));
    if (!res.ok) return toast.error(res.error);
    toast.success(`${formatDateKey(ex.date)} removed`, {
      action: {
        label: "Undo",
        onClick: () => {
          const r = setExceptions(before);
          if (!r.ok) toast.error(r.error);
        },
      },
    });
  };

  return (
    <div className="pb-20 sm:pb-0">
      <PageHeader
        title="Availability"
        description="Set your regular weekly hours, block dates you're away and preview what families can book."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-muted">
            <Globe className="size-3.5" aria-hidden /> {tzLabel}
          </span>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Weekly hours"
              description={minutes ? `${formatHours(minutes)} per week across ${new Set(draft.map((w) => w.day)).size} days` : "No weekly hours yet — families can't book you until you add some."}
              action={
                <div className="hidden items-center gap-2 sm:flex">
                  {dirty && (
                    <Button variant="ghost" size="sm" onClick={() => setDraft(saved)}>
                      <RotateCcw /> Discard
                    </Button>
                  )}
                  <Button size="sm" onClick={save} disabled={!dirty || invalid} loading={saving}>
                    Save hours
                  </Button>
                </div>
              }
            />
            <CardContent className="pt-2">
              <WeeklyAvailabilityEditor value={draft} onChange={setDraft} />
              {invalid && (
                <InlineAlert tone="danger" className="mt-3">
                  Fix the highlighted days before saving.
                </InlineAlert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Date exceptions"
              description="Block a day off or set different hours for a specific date. Exceptions override your weekly hours."
              action={
                <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
                  <CalendarPlus /> Add date
                </Button>
              }
            />
            <CardContent className="pt-4">
              {upcomingExceptions.length === 0 ? (
                <EmptyState compact icon={<CalendarOff />} title="No upcoming exceptions" description="Going away or need a lighter day? Add a date and families won't see those times." />
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  <AnimatePresence initial={false}>
                    {upcomingExceptions.map((ex) => (
                      <motion.li key={ex.date} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 px-3.5 py-3">
                        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", ex.type === "blocked" ? "bg-canvas text-muted" : "bg-sky-soft text-ink")} aria-hidden>
                          {ex.type === "blocked" ? <CalendarOff className="size-4" /> : <CalendarRange className="size-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink">{formatDateKey(ex.date, { weekday: "long", month: "long", day: "numeric" })}</p>
                          <p className="truncate text-[13px] text-muted">
                            {ex.type === "blocked" ? "Unavailable all day" : (ex.windows ?? []).map((w) => `${timeLabel(w.start)} – ${timeLabel(w.end)}`).join(", ")}
                            {ex.note ? ` · ${ex.note}` : ""}
                          </p>
                        </div>
                        <Badge tone={ex.type === "blocked" ? "neutral" : "accent"} size="sm" className="hidden sm:inline-flex">
                          {ex.type === "blocked" ? "Blocked" : "Custom hours"}
                        </Badge>
                        <Button variant="ghost" size="icon-sm" onClick={() => removeException(ex)} aria-label={`Remove exception on ${formatDateKey(ex.date)}`}>
                          <Trash2 />
                        </Button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <SlotPreview tutor={{ ...tutor, availability: draft }} bookings={bookings} tz={tz} now={now} dirty={dirty} invalid={invalid} />

          <Card>
            <CardHeader
              title="Booking rules"
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard/profile#booking-rules">Edit</Link>
                </Button>
              }
            />
            <CardContent className="pt-2">
              <dl className="divide-y divide-line">
                <DetailRow label="Minimum notice">{tutor.rules.minNoticeHours} hours</DetailRow>
                <DetailRow label="Book up to">{tutor.rules.maxAdvanceDays} days ahead</DetailRow>
                <DetailRow label="Buffer between lessons">{tutor.rules.bufferMinutes ? `${tutor.rules.bufferMinutes} min` : "None"}</DetailRow>
                <DetailRow label="Lesson lengths">{tutor.rules.sessionLengths.map(formatDuration).join(", ")}</DetailRow>
                <DetailRow label="Booking approval">
                  {!tutor.rules.requiresApproval && instantFlag ? (
                    <span className="inline-flex items-center gap-1">
                      <Zap className="size-3.5 text-ink" aria-hidden /> Instant booking
                    </span>
                  ) : (
                    "You approve each request"
                  )}
                </DetailRow>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile save bar */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 80 }}
            animate={{ y: 0 }}
            exit={{ y: 80 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
            data-fixed-bottom className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 py-3 sm:hidden"
          >
            <div className="flex items-center gap-2">
              <p className="flex-1 text-[13px] text-muted">{invalid ? "Fix errors to save" : "Unsaved changes"}</p>
              <Button variant="secondary" size="sm" onClick={() => setDraft(saved)}>
                Discard
              </Button>
              <Button size="sm" onClick={save} disabled={invalid} loading={saving}>
                Save hours
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ExceptionDialog
        open={adding}
        onOpenChange={setAdding}
        today={today}
        maxDays={tutor.rules.maxAdvanceDays}
        existing={tutor.exceptions}
        onSave={(ex) => {
          const res = setExceptions([...tutor.exceptions.filter((e) => e.date !== ex.date), ex].sort((a, b) => a.date.localeCompare(b.date)));
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          toast.success(ex.type === "blocked" ? `${formatDateKey(ex.date)} blocked` : `Custom hours set for ${formatDateKey(ex.date)}`);
          return true;
        }}
      />
    </div>
  );
}

/* ─── Open-slot preview ─────────────────────────────────────────────────────── */

function SlotPreview({
  tutor,
  bookings,
  tz,
  now,
  dirty,
  invalid,
}: {
  tutor: Parameters<typeof generateSlots>[0] & { rules: { sessionLengths: number[]; minNoticeHours: number } };
  bookings: Parameters<typeof generateSlots>[1]["bookings"];
  tz: string;
  now: number;
  dirty: boolean;
  invalid: boolean;
}) {
  const duration = Math.min(...tutor.rules.sessionLengths);
  const days = React.useMemo(() => {
    const p = zonedParts(new Date(now), tz);
    const keys = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.UTC(p.year, p.month - 1, p.day + i));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    });
    const slots = invalid ? [] : generateSlots(tutor, { durationMin: duration, viewerTz: tz, bookings, now, days: 8, stepMin: 30 });
    return keys.map((key) => ({ key, slots: slots.filter((s) => s.day === key) }));
  }, [tutor, duration, tz, bookings, now, invalid]);
  const total = days.reduce((n, d) => n + d.slots.length, 0);

  return (
    <Card>
      <CardHeader
        title="Open times · next 7 days"
        description={`${duration}-minute lessons, after notice, buffers and existing bookings.`}
        action={dirty ? <Badge tone="warning" size="sm">Unsaved</Badge> : undefined}
      />
      <CardContent className="pt-4">
        {invalid ? (
          <p className="text-sm text-muted">Fix your weekly hours to see a preview.</p>
        ) : (
          <>
            <p className="mb-3 text-[13px] text-muted">
              <span className="font-semibold tabular-nums text-ink">{total}</span> bookable start {total === 1 ? "time" : "times"} · shown in {tzAbbrev(tz)}
            </p>
            <ul className="space-y-2.5">
              {days.map((d) => (
                <li key={d.key} className="grid grid-cols-[4.5rem_1fr] gap-3 text-[13px]">
                  <span className="pt-1 font-medium text-ink-2">{formatDateKey(d.key, { weekday: "short", day: "numeric" })}</span>
                  {d.slots.length === 0 ? (
                    <span className="pt-1 text-muted">No open times</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {d.slots.slice(0, 5).map((s) => (
                        <span key={s.startUtc} className="rounded-md border border-line bg-canvas px-1.5 py-0.5 tabular-nums text-ink-2">
                          {formatTime(s.startUtc, tz)}
                        </span>
                      ))}
                      {d.slots.length > 5 && <span className="px-1 py-0.5 text-muted">+{d.slots.length - 5} more</span>}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-start gap-1.5 text-[12.5px] leading-snug text-muted">
              <Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Nothing is bookable within {tutor.rules.minNoticeHours} hours of now (your minimum notice).
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Add exception ─────────────────────────────────────────────────────────── */

function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function ExceptionDialog({
  open,
  onOpenChange,
  today,
  maxDays,
  existing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  today: string;
  maxDays: number;
  existing: AvailabilityException[];
  onSave: (ex: AvailabilityException) => boolean;
}) {
  const [date, setDate] = React.useState("");
  const [type, setType] = React.useState<AvailabilityException["type"]>("blocked");
  const [ranges, setRanges] = React.useState<Range[]>([{ start: "10:00", end: "14:00" }]);
  const [note, setNote] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setDate("");
      setType("blocked");
      setRanges([{ start: "10:00", end: "14:00" }]);
      setNote("");
      setTouched(false);
    }
  }

  const max = addDays(today, maxDays);
  const dateError = !date ? "Choose a date." : date < today ? "Choose today or a later date." : date > max ? `Choose a date within ${maxDays} days.` : null;
  const rangeError = type === "custom" ? (ranges.length ? validateRanges(ranges) : "Add at least one time range.") : null;
  const replaces = date && existing.some((e) => e.date === date);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (dateError || rangeError) return;
    const ok = onSave({ date, type, ...(type === "custom" ? { windows: [...ranges].sort((a, b) => a.start.localeCompare(b.start)) } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add a date exception" description="Overrides your weekly hours for one day. Existing bookings aren't affected." size="md">
        <form noValidate onSubmit={submit}>
          <DialogBody className="space-y-5">
            <Field label="Date" required error={touched ? dateError ?? undefined : undefined} hint={replaces ? "This replaces the exception already set for that date." : undefined}>
              <Input type="date" min={today} max={max} value={date} onChange={(e) => setDate(e.target.value)} onBlur={() => setTouched(true)} />
            </Field>
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">On this date</p>
              <Segmented
                label="Exception type"
                value={type}
                onChange={setType}
                options={[
                  { value: "blocked", label: "Unavailable all day" },
                  { value: "custom", label: "Custom hours" },
                ]}
              />
            </div>
            <AnimatePresence initial={false}>
              {type === "custom" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-ink">Hours for this date</p>
                    <RangeList ranges={ranges} onChange={setRanges} labelPrefix="Custom hours" error={touched ? rangeError : null} />
                    <AddRangeButton ranges={ranges} onChange={setRanges} label="Add hours for this date" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <Field label="Note" optional hint="Only you see this.">
              <Input maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Conference, family trip" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save exception</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
