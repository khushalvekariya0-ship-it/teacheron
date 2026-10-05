"use client";

import * as React from "react";
import { BookOpen, CalendarClock, Check, ChevronDown, Monitor, Wallet, type LucideIcon } from "lucide-react";
import type { Grade, Level, TutorCategory } from "@/lib/types";
import { RADIUS_OPTIONS, type TutorSearch } from "@/lib/search";
import { GRADES, GRADE_LABEL, LANGUAGES, LEARNING_SUPPORT, LEVELS, SUBJECTS, SUBJECT_BY_SLUG, SUBJECT_CATEGORIES, TIMES_OF_DAY, TUTOR_CATEGORIES } from "@/lib/data/catalog";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/format";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Overlay";
import { Checkbox, ChipGroup, Segmented } from "@/components/ui/Controls";
import { Field, Select } from "@/components/ui/Input";
import { KeywordField, LocationField, RateFields, applyPatch } from "./FilterPanel";
import { EXPERIENCE_OPTIONS, RATING_OPTIONS, WEEK_ORDER, effectiveSchedule } from "./filters";
import { SortControl } from "./SortControl";

type Patch = Partial<TutorSearch>;
type Option = { value: string; label: string };

/* ─── Building blocks ────────────────────────────────────────────────────── */

/** Big two-line filter box (small label, current value) that opens a panel — the main filter row. */
function FilterBox({
  label,
  value,
  active,
  icon: Icon,
  panelClassName,
  children,
}: {
  label: string;
  value: string;
  active: boolean;
  icon: LucideIcon;
  panelClassName?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "group flex h-16 w-full min-w-0 items-center gap-3 rounded-xl px-3.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40",
          open ? "bg-brand-50" : "hover:bg-canvas",
        )}
      >
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg transition-colors", active ? "bg-brand-gradient text-white" : "bg-canvas text-ink-2")}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] text-muted">{label}</span>
          <span className={cn("block truncate text-[16px] font-semibold", active ? "text-ink" : "text-ink-2")}>{value}</span>
        </span>
        <ChevronDown className={cn("size-5 shrink-0 text-muted transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </PopoverTrigger>
      <PopoverContent className={cn("w-[340px] p-4", panelClassName)}>{children(() => setOpen(false))}</PopoverContent>
    </Popover>
  );
}

/** Smaller pill filter for the second row. */
function FilterPill({ label, active, children, panelClassName }: { label: string; active: boolean; children: (close: () => void) => React.ReactNode; panelClassName?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-[14px] font-medium transition-colors",
          open || active ? "border-ink bg-canvas text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
        )}
      >
        {label}
        <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </PopoverTrigger>
      <PopoverContent className={cn("w-[280px] p-2", panelClassName)}>{children(() => setOpen(false))}</PopoverContent>
    </Popover>
  );
}

/** A single-choice list with an "any" option and a check on the current choice. */
function OptionList({ options, value, anyLabel, onSelect }: { options: Option[]; value: string | undefined; anyLabel: string; onSelect: (v: string | undefined) => void }) {
  return (
    <ul className="max-h-80 overflow-y-auto" data-lenis-prevent>
      {[{ value: "", label: anyLabel }, ...options].map((o) => {
        const selected = (value ?? "") === o.value;
        return (
          <li key={o.value || "__any"}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(o.value || undefined)}
              className={cn("flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-[14.5px] transition-colors hover:bg-canvas", selected ? "font-semibold text-brand" : "text-ink")}
            >
              {o.label}
              {selected && <Check className="size-4 shrink-0" aria-hidden />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ─── Labels for the current values ─────────────────────────────────────── */

function priceLabel(min?: number, max?: number) {
  if (min && max) return `${formatCents(min)} – ${formatCents(max)}`;
  if (min) return `${formatCents(min)}+`;
  if (max) return `Up to ${formatCents(max)}`;
  return "Any price";
}

function lessonLabel(s: TutorSearch) {
  if (s.mode === "online") return "Online";
  if (s.mode === "in_person") return s.location ? `In person · ${s.location}` : "In person";
  return s.location ? `Near ${s.location}` : "Online or in person";
}

function availabilityLabel(s: TutorSearch) {
  const { days, times } = effectiveSchedule(s);
  if (!days.length && !times.length) return "Any time";
  const d = days.length ? days.join(", ") : "Any day";
  const t = times.length ? times.map((x) => TIMES_OF_DAY.find((o) => o.value === x)?.label ?? x).join(", ") : "";
  return t ? `${d} · ${t}` : d;
}

const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: "Under $40", max: 4000 },
  { label: "$40 – $70", min: 4000, max: 7000 },
  { label: "$70 – $100", min: 7000, max: 10000 },
  { label: "$100+", min: 10000 },
];

/* ─── The bar ────────────────────────────────────────────────────────────── */

export function FilterBar({ value, onChange }: { value: TutorSearch; onChange: (next: TutorSearch) => void }) {
  const set = (patch: Patch) => onChange(applyPatch(value, patch));
  const schedule = effectiveSchedule(value);
  const moreCount = [value.verified, value.certified, value.trial, value.instant, value.exp, value.rating, value.support].filter(Boolean).length;

  return (
    <div className="space-y-3" role="search" aria-label="Filter tutors">
      {/* Row 1 — the four main filters in one connected console */}
      <div className="grid grid-cols-4 gap-1.5 rounded-2xl border border-line-strong bg-surface p-1.5 shadow-[0_18px_40px_-28px_rgb(15_23_42/0.45)]">
        <FilterBox icon={BookOpen} label="I want to learn" value={value.subject ? SUBJECT_BY_SLUG[value.subject]?.name ?? "Any subject" : "Any subject"} active={!!value.subject} panelClassName="w-[380px] p-2">
          {(close) => (
            <div className="max-h-96 overflow-y-auto" data-lenis-prevent>
              <button
                type="button"
                onClick={() => {
                  set({ subject: undefined });
                  close();
                }}
                className={cn("flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[14.5px] hover:bg-canvas", !value.subject ? "font-semibold text-brand" : "text-ink")}
              >
                Any subject {!value.subject && <Check className="size-4" aria-hidden />}
              </button>
              {SUBJECT_CATEGORIES.map((c) => (
                <div key={c.slug} className="mt-2">
                  <p className="px-3 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{c.name}</p>
                  {SUBJECTS.filter((s) => s.category === c.slug).map((s) => {
                    const selected = value.subject === s.slug;
                    return (
                      <button
                        key={s.slug}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          set({ subject: s.slug });
                          close();
                        }}
                        className={cn("flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[14.5px] hover:bg-canvas", selected ? "font-semibold text-brand" : "text-ink")}
                      >
                        {s.name}
                        {selected && <Check className="size-4" aria-hidden />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </FilterBox>

        <FilterBox icon={Wallet} label="Price per hour" value={priceLabel(value.minRate, value.maxRate)} active={!!(value.minRate || value.maxRate)}>
          {(close) => (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {PRICE_PRESETS.map((p) => {
                  const on = value.minRate === p.min && value.maxRate === p.max;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        set({ minRate: p.min, maxRate: p.max });
                        close();
                      }}
                      className={cn("h-9 rounded-lg border px-3 text-[14px] font-medium transition-colors", on ? "border-ink bg-ink text-on-ink" : "border-line text-ink hover:border-ink")}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <RateFields min={value.minRate} max={value.maxRate} onCommit={(minRate, maxRate) => set({ minRate, maxRate })} />
            </div>
          )}
        </FilterBox>

        <FilterBox icon={Monitor} label="Lesson type" value={lessonLabel(value)} active={!!(value.mode || value.location)} panelClassName="w-[360px]">
          {() => (
            <div className="space-y-4 text-sm">
              <Segmented
                label="Teaching mode"
                className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
                value={value.mode ?? "any"}
                onChange={(m) => set({ mode: m === "any" ? undefined : m })}
                options={[
                  { value: "any", label: "Either" },
                  { value: "online", label: "Online" },
                  { value: "in_person", label: "In person" },
                ]}
              />
              <LocationField value={value.location} onCommit={(location) => set(location ? { location } : { location: undefined, radius: undefined })} />
              <Field label="Distance">
                <Select
                  value={value.radius ? String(value.radius) : ""}
                  disabled={!value.location}
                  onChange={(e) => set({ radius: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="Tutor's own service area"
                  options={RADIUS_OPTIONS.map((r) => ({ value: String(r), label: `Within ${r} miles` }))}
                />
              </Field>
            </div>
          )}
        </FilterBox>

        <FilterBox icon={CalendarClock} label="I'm available" value={availabilityLabel(value)} active={schedule.days.length > 0 || schedule.times.length > 0} panelClassName="w-[360px]">
          {() => (
            <div className="space-y-4 text-sm">
              <div>
                <p className="mb-2 font-medium text-ink">Days</p>
                <ChipGroup size="sm" label="Available days" value={schedule.days} onChange={(days) => set({ days, times: schedule.times, schedule: undefined })} options={WEEK_ORDER.map((d) => ({ value: d, label: d }))} />
              </div>
              <div>
                <p className="mb-2 font-medium text-ink">Time of day</p>
                <ChipGroup
                  size="sm"
                  label="Times of day"
                  value={schedule.times as string[]}
                  onChange={(times) => set({ times: times as TutorSearch["times"], days: schedule.days, schedule: undefined })}
                  options={TIMES_OF_DAY.map((t) => ({ value: t.value, label: t.label }))}
                />
                <p className="mt-2 text-[12.5px] leading-snug text-muted">Morning 8–12, afternoon 12–5, evening 5–9, in the tutor&rsquo;s local time.</p>
              </div>
            </div>
          )}
        </FilterBox>
      </div>

      {/* Row 2 — smaller filters, sort and keyword */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill label={value.grade ? GRADE_LABEL[value.grade] : "Grade"} active={!!value.grade}>
          {(close) => (
            <OptionList
              anyLabel="Any grade"
              value={value.grade}
              options={GRADES.map((g) => ({ value: g.value, label: g.label }))}
              onSelect={(v) => {
                set({ grade: v as Grade | undefined });
                close();
              }}
            />
          )}
        </FilterPill>
        <FilterPill label={value.level ? LEVELS.find((l) => l.value === value.level)?.label ?? "Level" : "Level"} active={!!value.level}>
          {(close) => (
            <OptionList
              anyLabel="Any level"
              value={value.level}
              options={LEVELS.map((l) => ({ value: l.value, label: l.label }))}
              onSelect={(v) => {
                set({ level: v as Level | undefined });
                close();
              }}
            />
          )}
        </FilterPill>
        <FilterPill label={value.lang ? `Speaks ${value.lang}` : "Speaks"} active={!!value.lang}>
          {(close) => (
            <OptionList
              anyLabel="Any language"
              value={value.lang}
              options={LANGUAGES.map((l) => ({ value: l, label: l }))}
              onSelect={(v) => {
                set({ lang: v });
                close();
              }}
            />
          )}
        </FilterPill>
        <FilterPill label={value.category ? TUTOR_CATEGORIES.find((c) => c.value === value.category)?.label ?? "Tutor type" : "Tutor type"} active={!!value.category}>
          {(close) => (
            <OptionList
              anyLabel="Any tutor type"
              value={value.category}
              options={TUTOR_CATEGORIES}
              onSelect={(v) => {
                set({ category: v as TutorCategory | undefined });
                close();
              }}
            />
          )}
        </FilterPill>
        <FilterPill label={moreCount ? `More filters · ${moreCount}` : "More filters"} active={moreCount > 0} panelClassName="w-[320px] p-4">
          {() => (
            <div className="space-y-4 text-sm">
              <div className="space-y-3">
                <Checkbox checked={!!value.verified} onCheckedChange={(c) => set({ verified: c === true || undefined })} label="Verified identity only" />
                <Checkbox checked={!!value.certified} onCheckedChange={(c) => set({ certified: c === true || undefined })} label="Certified teachers only" />
                <Checkbox checked={!!value.trial} onCheckedChange={(c) => set({ trial: c === true || undefined })} label="Offers a trial lesson" />
                <Checkbox checked={!!value.instant} onCheckedChange={(c) => set({ instant: c === true || undefined })} label="Instant booking" />
              </div>
              <Field label="Teaching experience">
                <Select value={value.exp ? String(value.exp) : ""} onChange={(e) => set({ exp: e.target.value ? Number(e.target.value) : undefined })} placeholder="Any experience" options={EXPERIENCE_OPTIONS} />
              </Field>
              <Field label="Minimum rating">
                <Select value={value.rating ? String(value.rating) : ""} onChange={(e) => set({ rating: e.target.value ? Number(e.target.value) : undefined })} placeholder="Any rating" options={RATING_OPTIONS} />
              </Field>
              <Field label="Learning support">
                <Select value={value.support ?? ""} onChange={(e) => set({ support: e.target.value || undefined })} placeholder="No specific needs" options={LEARNING_SUPPORT.map((l) => ({ value: l, label: l }))} />
              </Field>
            </div>
          )}
        </FilterPill>

        <div className="ml-auto flex min-w-0 items-center gap-3">
          <SortControl value={value.sort} onChange={(sort) => set({ sort })} />
          <div className="w-[260px]">
            <KeywordField compact value={value.q} onCommit={(q) => set({ q })} />
          </div>
        </div>
      </div>
    </div>
  );
}
