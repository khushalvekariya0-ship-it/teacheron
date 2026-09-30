"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Plus, X } from "lucide-react";
import type { WeeklyWindow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Controls";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Tooltip } from "@/components/ui/Overlay";
import { EASE } from "@/components/motion";

/* ─── Time helpers ──────────────────────────────────────────────────────────── */

export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const toHHMM = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function timeLabel(hhmm: string): string {
  const m = toMin(hhmm);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = h >= 12 && h < 24 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

const FIRST = 5 * 60; // 5:00 AM
const LAST = 23 * 60 + 30; // 11:30 PM
/** 30-minute steps. */
export const TIME_OPTIONS = Array.from({ length: (LAST - FIRST) / 30 + 1 }, (_, i) => {
  const v = toHHMM(FIRST + i * 30);
  return { value: v, label: timeLabel(v) };
});

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
/** Monday-first display order. */
export const DAY_ORDER: WeeklyWindow["day"][] = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_SET: WeeklyWindow["day"][] = [1, 2, 3, 4, 5];

export interface Range {
  start: string;
  end: string;
}

/** Returns an error for a set of same-day ranges (end before start, or overlapping), else null. */
export function validateRanges(ranges: Range[]): string | null {
  if (ranges.some((r) => r.start >= r.end)) return "Each time range must end after it starts.";
  const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < sorted.length; i++) if (sorted[i].start < sorted[i - 1].end) return "Time ranges on the same day can't overlap.";
  return null;
}

export function validateWeek(windows: WeeklyWindow[]): Partial<Record<WeeklyWindow["day"], string>> {
  const out: Partial<Record<WeeklyWindow["day"], string>> = {};
  for (const d of DAY_ORDER) {
    const err = validateRanges(windows.filter((w) => w.day === d));
    if (err) out[d] = err;
  }
  return out;
}

export function weeklyMinutes(windows: WeeklyWindow[]): number {
  return windows.reduce((sum, w) => sum + Math.max(0, toMin(w.end) - toMin(w.start)), 0);
}

export function formatHours(minutes: number): string {
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} ${h === 1 ? "hour" : "hours"}`;
}

/** Sorted, de-duplicated windows so saved data is predictable. */
export function normalizeWeek(windows: WeeklyWindow[]): WeeklyWindow[] {
  return [...windows].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
}

/** Suggests the next range after the last one on a day (2 hours, clamped to the day). */
function nextRange(ranges: Range[]): Range | null {
  if (!ranges.length) return { start: "16:00", end: "19:00" };
  const lastEnd = Math.max(...ranges.map((r) => toMin(r.end)));
  const start = Math.ceil(lastEnd / 30) * 30 + 30;
  if (start >= LAST) return null;
  return { start: toHHMM(start), end: toHHMM(Math.min(LAST, start + 120)) };
}

/* ─── Range list (shared by the weekly editor and custom date hours) ────────── */

export function RangeList({
  ranges,
  onChange,
  labelPrefix,
  error,
}: {
  ranges: Range[];
  onChange: (next: Range[]) => void;
  labelPrefix: string;
  error?: string | null;
}) {
  const errorId = React.useId();
  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {ranges.map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2">
              <Select
                aria-label={`${labelPrefix} range ${i + 1} start`}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className="min-w-0 flex-1"
                value={r.start}
                options={TIME_OPTIONS}
                onChange={(e) => onChange(ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
              />
              <span className="text-sm text-muted" aria-hidden>
                –
              </span>
              <Select
                aria-label={`${labelPrefix} range ${i + 1} end`}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className="min-w-0 flex-1"
                value={r.end}
                options={TIME_OPTIONS}
                onChange={(e) => onChange(ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
              />
              <button
                type="button"
                onClick={() => onChange(ranges.filter((_, j) => j !== i))}
                className="grid size-10 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink"
                aria-label={`Remove ${labelPrefix} range ${i + 1} (${timeLabel(r.start)} to ${timeLabel(r.end)})`}
              >
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {error && (
        <p id={errorId} role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function AddRangeButton({ ranges, onChange, label }: { ranges: Range[]; onChange: (next: Range[]) => void; label: string }) {
  const next = nextRange(ranges);
  return (
    <button
      type="button"
      disabled={!next}
      onClick={() => next && onChange([...ranges, next])}
      className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-canvas disabled:opacity-40"
      aria-label={label}
    >
      <Plus className="size-4" /> Add hours
    </button>
  );
}

/* ─── Weekly editor ─────────────────────────────────────────────────────────── */

export function WeeklyAvailabilityEditor({
  value,
  onChange,
  className,
}: {
  value: WeeklyWindow[];
  onChange: (next: WeeklyWindow[]) => void;
  className?: string;
}) {
  const errors = validateWeek(value);

  const setDay = (day: WeeklyWindow["day"], ranges: Range[]) => {
    onChange(normalizeWeek([...value.filter((w) => w.day !== day), ...ranges.map((r) => ({ day, start: r.start, end: r.end }))]));
  };

  const copyTo = (from: WeeklyWindow["day"], days: WeeklyWindow["day"][]) => {
    const src = value.filter((w) => w.day === from);
    const targets = days.filter((d) => d !== from);
    onChange(normalizeWeek([...value.filter((w) => !targets.includes(w.day)), ...targets.flatMap((d) => src.map((w) => ({ ...w, day: d })))]));
  };

  return (
    <ul className={cn("divide-y divide-line", className)}>
      {DAY_ORDER.map((day) => {
        const ranges = value.filter((w) => w.day === day).map(({ start, end }) => ({ start, end }));
        const on = ranges.length > 0;
        const name = DAY_NAMES[day];
        return (
          <li key={day} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 py-3.5 sm:grid-cols-[9rem_1fr_auto] sm:items-start sm:gap-x-4">
            <div className="flex h-10 items-center gap-3">
              <Switch checked={on} onCheckedChange={(v) => setDay(day, v ? [{ start: "16:00", end: "19:00" }] : [])} aria-label={`Available on ${name}`} />
              <span className={cn("text-sm font-medium", on ? "text-ink" : "text-muted")}>{name}</span>
            </div>
            <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
              {on ? (
                <RangeList ranges={ranges} onChange={(r) => setDay(day, r)} labelPrefix={name} error={errors[day]} />
              ) : (
                <p className="flex h-10 items-center text-sm text-muted">Unavailable</p>
              )}
            </div>
            <div className="col-start-2 row-start-1 flex h-10 items-center gap-0.5 sm:col-start-3">
              {on && <AddRangeButton ranges={ranges} onChange={(r) => setDay(day, r)} label={`Add hours on ${name}`} />}
              <DropdownMenu>
                <Tooltip content={`Copy ${name}'s hours`}>
                  <DropdownMenuTrigger
                    disabled={!on}
                    className="grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-40"
                    aria-label={`Copy ${name}'s hours to other days`}
                  >
                    <Copy className="size-4" />
                  </DropdownMenuTrigger>
                </Tooltip>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => copyTo(day, WEEKDAY_SET)}>Copy to weekdays (Mon–Fri)</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => copyTo(day, [0, 1, 2, 3, 4, 5, 6])}>Copy to every day</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => copyTo(day, [0, 6])}>Copy to weekends</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
