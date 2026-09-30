"use client";

import * as React from "react";
import { MapPin, Search, X } from "lucide-react";
import type { Grade, Level, TutorCategory } from "@/lib/types";
import { RADIUS_OPTIONS, type TutorSearch } from "@/lib/search";
import { GRADES, LANGUAGES, LEARNING_SUPPORT, LEVELS, SUBJECTS, SUBJECT_CATEGORIES, TIMES_OF_DAY, TUTOR_CATEGORIES } from "@/lib/data/catalog";
import { isValidZip, resolveLocation } from "@/lib/data/geo";
import { cn } from "@/lib/utils";
import { Field, Input, Select } from "@/components/ui/Input";
import { Checkbox, ChipGroup, Segmented } from "@/components/ui/Controls";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/Disclosure";
import { AnimatePresence, motion } from "@/components/motion";
import { EXPERIENCE_OPTIONS, RATING_OPTIONS, WEEK_ORDER, effectiveSchedule, groupCount, type FilterGroupKey } from "./filters";

type Patch = Partial<TutorSearch>;

/** Applies a patch, dropping keys whose value is cleared so the URL stays tidy. */
export function applyPatch(s: TutorSearch, patch: Patch): TutorSearch {
  const next: TutorSearch = { ...s, ...patch };
  for (const k of Object.keys(patch) as (keyof TutorSearch)[]) {
    const v = next[k];
    if (v === undefined || v === "" || v === false || (Array.isArray(v) && v.length === 0)) delete next[k];
  }
  return next;
}

/* ─── Text inputs that commit on blur / Enter (URL writes stay cheap) ───────── */

function KeywordField({ value, onCommit }: { value: string | undefined; onCommit: (q: string | undefined) => void }) {
  const [text, setText] = React.useState(value ?? "");
  const [prev, setPrev] = React.useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(value ?? "");
  }
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => {
    const t = timer;
    return () => clearTimeout(t.current);
  }, []);

  const commit = (raw: string) => {
    clearTimeout(timer.current);
    const v = raw.trim() || undefined;
    if (v !== value) onCommit(v);
  };

  return (
    <form
      role="search"
      aria-label="Search tutors by keyword"
      onSubmit={(e) => {
        e.preventDefault();
        commit(text);
      }}
    >
      <Field label="Keyword">
        <Input
          type="search"
          icon={<Search />}
          value={text}
          placeholder="Name, subject or specialty"
          enterKeyHint="search"
          onChange={(e) => {
            const t = e.target.value;
            setText(t);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => commit(t), 450);
          }}
          onBlur={() => commit(text)}
          suffix={
            text ? (
              <button
                type="button"
                onClick={() => {
                  setText("");
                  commit("");
                }}
                className="grid size-7 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink"
                aria-label="Clear keyword"
              >
                <X className="size-3.5" />
              </button>
            ) : undefined
          }
        />
      </Field>
    </form>
  );
}

function LocationField({ value, onCommit }: { value: string | undefined; onCommit: (loc: string | undefined) => void }) {
  const [text, setText] = React.useState(value ?? "");
  const [prev, setPrev] = React.useState(value);
  const [error, setError] = React.useState<string | undefined>();
  if (prev !== value) {
    setPrev(value);
    setText(value ?? "");
    setError(undefined);
  }
  const resolved = value ? resolveLocation(value) : null;

  const commit = () => {
    const v = text.trim();
    if (!v) {
      setError(undefined);
      if (value) onCommit(undefined);
      return;
    }
    if (!resolveLocation(v)) {
      setError(isValidZip(v) ? "We don't have tutors near this ZIP yet. Try a nearby city, or choose Online." : "Enter a 5-digit ZIP or a city like “Austin, TX”.");
      return;
    }
    setError(undefined);
    if (v !== value) onCommit(v);
  };

  return (
    <Field label="ZIP or city" error={error} hint={!error && resolved ? `Searching near ${resolved.label}` : !error ? "Used for in-person lessons and distance." : undefined}>
      <Input
        icon={<MapPin />}
        value={text}
        placeholder="e.g. 60614 or Chicago, IL"
        autoComplete="postal-code"
        enterKeyHint="done"
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(undefined);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
      />
    </Field>
  );
}

function RateFields({ min, max, onCommit }: { min: number | undefined; max: number | undefined; onCommit: (min: number | undefined, max: number | undefined) => void }) {
  const [minText, setMinText] = React.useState(min ? String(min) : "");
  const [maxText, setMaxText] = React.useState(max ? String(max) : "");
  const [prev, setPrev] = React.useState(`${min}|${max}`);
  const [error, setError] = React.useState<string | undefined>();
  if (prev !== `${min}|${max}`) {
    setPrev(`${min}|${max}`);
    setMinText(min ? String(min) : "");
    setMaxText(max ? String(max) : "");
    setError(undefined);
  }

  const parse = (t: string): number | undefined | null => {
    const v = t.trim();
    if (!v) return undefined;
    if (!/^\d{1,4}$/.test(v)) return null;
    const n = Number(v);
    return n === 0 ? undefined : n;
  };

  const commit = () => {
    const a = parse(minText);
    const b = parse(maxText);
    if (a === null || b === null) return setError("Enter whole dollar amounts, like 40.");
    if (a !== undefined && b !== undefined && a > b) return setError("Minimum can't be more than maximum.");
    setError(undefined);
    if (a !== min || b !== max) onCommit(a, b);
  };

  const keyCommit = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  };

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink">Hourly rate</legend>
      <div className="grid grid-cols-2 gap-2.5">
        <Field>
          <Input
            aria-label="Minimum hourly rate in dollars"
            prefixText="$"
            inputMode="numeric"
            placeholder="Min"
            value={minText}
            aria-invalid={!!error || undefined}
            onChange={(e) => setMinText(e.target.value)}
            onBlur={commit}
            onKeyDown={keyCommit}
          />
        </Field>
        <Field>
          <Input
            aria-label="Maximum hourly rate in dollars"
            prefixText="$"
            inputMode="numeric"
            placeholder="Max"
            value={maxText}
            aria-invalid={!!error || undefined}
            onChange={(e) => setMaxText(e.target.value)}
            onBlur={commit}
            onKeyDown={keyCommit}
          />
        </Field>
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-1.5 text-[13px] text-danger">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </fieldset>
  );
}

/* ─── Panel ─────────────────────────────────────────────────────────────────── */

const GROUP_LABEL: Record<FilterGroupKey, string> = {
  subject: "Subject & level",
  location: "Location & format",
  price: "Price, experience & rating",
  schedule: "Availability",
  tutor: "Tutor",
};

function GroupTrigger({ group, value }: { group: FilterGroupKey; value: TutorSearch }) {
  const count = groupCount(value, group);
  return (
    <AccordionTrigger className="py-3.5 text-sm font-semibold hover:text-ink [&>span:last-child]:size-6">
      <span className="flex items-center gap-2">
        {GROUP_LABEL[group]}
        <AnimatePresence initial={false}>
          {count > 0 && (
            <motion.span
              key={count}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              className="grid h-5 min-w-5 place-items-center rounded-full bg-navy px-1.5 text-[11px] font-semibold tabular-nums text-on-ink"
              aria-label={`${count} active`}
            >
              {count}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </AccordionTrigger>
  );
}

const SUBJECT_OPTIONS = SUBJECT_CATEGORIES.flatMap((c) => SUBJECTS.filter((s) => s.category === c.slug).map((s) => ({ value: s.slug, label: `${s.name}` })));

export function FilterPanel({
  value,
  onChange,
  className,
  defaultOpen = ["subject", "location", "price"],
}: {
  value: TutorSearch;
  onChange: (next: TutorSearch) => void;
  className?: string;
  defaultOpen?: FilterGroupKey[];
}) {
  const set = (patch: Patch) => onChange(applyPatch(value, patch));
  const [open, setOpen] = React.useState<string[]>(() => {
    const withActive = (Object.keys(GROUP_LABEL) as FilterGroupKey[]).filter((g) => groupCount(value, g) > 0);
    return Array.from(new Set([...defaultOpen, ...withActive]));
  });
  const schedule = effectiveSchedule(value);

  return (
    <div className={cn("space-y-4", className)}>
      <KeywordField value={value.q} onCommit={(q) => set({ q })} />

      <Accordion type="multiple" value={open} onValueChange={setOpen} className="border-t border-line">
        <AccordionItem value="subject">
          <GroupTrigger group="subject" value={value} />
          <AccordionContent className="space-y-4 px-1 pb-5 pr-1 text-sm text-ink">
            <Field label="Subject">
              <Select value={value.subject ?? ""} onChange={(e) => set({ subject: e.target.value || undefined })} placeholder="Any subject" options={SUBJECT_OPTIONS} />
            </Field>
            <Field label="Grade">
              <Select value={value.grade ?? ""} onChange={(e) => set({ grade: (e.target.value || undefined) as Grade | undefined })} placeholder="Any grade" options={GRADES.map((g) => ({ value: g.value, label: g.label }))} />
            </Field>
            <Field label="Education level">
              <Select value={value.level ?? ""} onChange={(e) => set({ level: (e.target.value || undefined) as Level | undefined })} placeholder="Any level" options={LEVELS.map((l) => ({ value: l.value, label: l.label }))} />
            </Field>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="location">
          <GroupTrigger group="location" value={value} />
          <AccordionContent className="space-y-4 px-1 pb-5 pr-1 text-sm text-ink">
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">
                Teaching mode
              </p>
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
            </div>
            <LocationField value={value.location} onCommit={(location) => set(location ? { location } : { location: undefined, radius: undefined })} />
            <Field label="Distance" hint={value.location ? (value.mode === "in_person" ? "Only in-person tutors within this distance." : "Online tutors are always included.") : "Add a ZIP or city to filter by distance."}>
              <Select
                value={value.radius ? String(value.radius) : ""}
                disabled={!value.location}
                onChange={(e) => set({ radius: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Tutor's own service area"
                options={RADIUS_OPTIONS.map((r) => ({ value: String(r), label: `Within ${r} miles` }))}
              />
            </Field>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="price">
          <GroupTrigger group="price" value={value} />
          <AccordionContent className="space-y-4 px-1 pb-5 pr-1 text-sm text-ink">
            <RateFields min={value.minRate} max={value.maxRate} onCommit={(minRate, maxRate) => set({ minRate, maxRate })} />
            <Field label="Teaching experience">
              <Select value={value.exp ? String(value.exp) : ""} onChange={(e) => set({ exp: e.target.value ? Number(e.target.value) : undefined })} placeholder="Any experience" options={EXPERIENCE_OPTIONS} />
            </Field>
            <Field label="Minimum rating" hint="Ratings come only from reviews of completed lessons.">
              <Select value={value.rating ? String(value.rating) : ""} onChange={(e) => set({ rating: e.target.value ? Number(e.target.value) : undefined })} placeholder="Any rating" options={RATING_OPTIONS} />
            </Field>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="schedule">
          <GroupTrigger group="schedule" value={value} />
          <AccordionContent className="space-y-4 px-1 pb-5 pr-1 text-sm text-ink">
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Days</p>
              <ChipGroup
                size="sm"
                label="Available days"
                value={schedule.days}
                onChange={(days) => set({ days, times: schedule.times, schedule: undefined })}
                options={WEEK_ORDER.map((d) => ({ value: d, label: d }))}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Time of day</p>
              <ChipGroup
                size="sm"
                label="Times of day"
                value={schedule.times as string[]}
                onChange={(times) => set({ times: times as TutorSearch["times"], days: schedule.days, schedule: undefined })}
                options={TIMES_OF_DAY.map((t) => ({ value: t.value, label: t.label }))}
              />
              <p className="mt-2 text-[12.5px] leading-snug text-muted">Morning 8–12, afternoon 12–5, evening 5–9, in the tutor&rsquo;s local time.</p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tutor">
          <GroupTrigger group="tutor" value={value} />
          <AccordionContent className="space-y-4 px-1 pb-5 pr-1 text-sm text-ink">
            <Field label="Tutor category">
              <Select value={value.category ?? ""} onChange={(e) => set({ category: (e.target.value || undefined) as TutorCategory | undefined })} placeholder="Any category" options={TUTOR_CATEGORIES} />
            </Field>
            <Field label="Language">
              <Select value={value.lang ?? ""} onChange={(e) => set({ lang: e.target.value || undefined })} placeholder="Any language" options={LANGUAGES.map((l) => ({ value: l, label: l }))} />
            </Field>
            <Field label="Learning support">
              <Select value={value.support ?? ""} onChange={(e) => set({ support: e.target.value || undefined })} placeholder="No specific needs" options={LEARNING_SUPPORT.map((l) => ({ value: l, label: l }))} />
            </Field>
            <div className="space-y-3 pt-1">
              <Checkbox checked={!!value.certified} onCheckedChange={(c) => set({ certified: c === true || undefined })} label="Certified teachers only" description="Has a teaching certification our team verified." />
              <Checkbox checked={!!value.verified} onCheckedChange={(c) => set({ verified: c === true || undefined })} label="Verified identity only" description="Identity check completed." />
              <Checkbox checked={!!value.trial} onCheckedChange={(c) => set({ trial: c === true || undefined })} label="Offers a trial lesson" />
              <Checkbox checked={!!value.instant} onCheckedChange={(c) => set({ instant: c === true || undefined })} label="Instant booking" description="Lessons confirm right away." />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
