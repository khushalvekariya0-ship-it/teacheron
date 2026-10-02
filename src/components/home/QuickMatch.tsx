"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { GRADES, SUBJECTS, subjectName } from "@/lib/data/catalog";
import { DEFAULT_WEIGHTS, FACTOR_LABEL, type FactorKey } from "@/lib/matching";
import { SCHEDULE_PRESETS, searchTutors, toQueryString, type SchedulePreset, type TutorSearch } from "@/lib/search";
import type { Grade, TeachingMode } from "@/lib/types";
import { useHydrated, useTutors } from "@/lib/store/hooks";
import { motion } from "@/components/motion";
import { SelectMenu, type SelectOption } from "@/components/ui/SelectMenu";

const BUDGETS = [40, 60, 80, 100];
const SHOWN: FactorKey[] = ["subject", "grade", "schedule", "budget", "location"];

/** A dropdown styled as a chip: shows a check and the brand tint when a value is chosen. */
function ChipSelect({ label, value, onChange, placeholder, options }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; options: SelectOption[] }) {
  const set = value !== "";
  return (
    <SelectMenu
      variant="bare"
      aria-label={label}
      value={value}
      onValueChange={onChange}
      placeholder={placeholder}
      options={options}
      leading={set ? <Check className="size-3.5 shrink-0" strokeWidth={2.8} aria-hidden /> : undefined}
      renderValue={(o) => <span className="whitespace-nowrap">{o?.label ?? placeholder}</span>}
      className={cn(
        "h-9 w-auto gap-1.5 rounded-lg border px-2.5 text-[13.5px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand/30",
        set ? "border-brand/30 bg-brand-50 text-brand" : "border-line bg-surface text-ink-2 hover:border-line-strong",
      )}
    />
  );
}

const GRADE_OPTIONS: SelectOption[] = GRADES.map((g) => ({ value: g.value, label: g.label }));
const MODE_OPTIONS: SelectOption[] = [
  { value: "online", label: "Online" },
  { value: "in_person", label: "In person" },
];
const SCHEDULE_OPTIONS: SelectOption[] = SCHEDULE_PRESETS.map((p) => ({ value: p.value, label: p.label }));
const BUDGET_OPTIONS: SelectOption[] = BUDGETS.map((b) => ({ value: String(b), label: `Up to $${b}/hr` }));

/**
 * Step 1 of "How it works", working for real: type a subject, set grade / lesson type / time / budget,
 * see how many tutors match and how the score is weighted for this search, then open the results.
 * Uses the same searchTutors() and weights as the directory.
 */
export function QuickMatch() {
  const router = useRouter();
  const id = React.useId();
  const hydrated = useHydrated();
  const tutors = useTutors();

  const [text, setText] = React.useState("Algebra");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const [grade, setGrade] = React.useState<Grade | "">("9");
  const [mode, setMode] = React.useState<TeachingMode | "">("online");
  const [schedule, setSchedule] = React.useState<SchedulePreset | "">("weekday_evenings");
  const [budget, setBudget] = React.useState<number | "">(60);

  // A typed subject name selects that subject; anything else searches by keyword.
  const q = text.trim().toLowerCase();
  const exact = SUBJECTS.find((s) => s.name.toLowerCase() === q);
  const suggestions = React.useMemo(() => {
    if (!q || exact) return [];
    const starts = SUBJECTS.filter((s) => s.name.toLowerCase().startsWith(q));
    const contains = SUBJECTS.filter((s) => !s.name.toLowerCase().startsWith(q) && s.name.toLowerCase().includes(q));
    return [...starts, ...contains].slice(0, 5);
  }, [q, exact]);
  const showList = open && suggestions.length > 0;

  const params: TutorSearch = {
    subject: exact?.slug,
    q: !exact && q ? text.trim() : undefined,
    grade: grade || undefined,
    mode: mode || undefined,
    schedule: schedule || undefined,
    maxRate: budget || undefined,
  };
  const matches = hydrated ? searchTutors(tutors, params).length : null;

  // Factors that count for this search — unset criteria are left out and the rest re-scaled (as in scoreTutor()).
  const counts: Record<FactorKey, boolean> = {
    subject: !!params.subject,
    grade: !!params.grade,
    schedule: !!params.schedule,
    budget: !!params.maxRate,
    location: true,
    experience: false,
    language: false,
    support: false,
  };
  const total = (Object.keys(counts) as FactorKey[]).reduce((s, k) => s + (counts[k] ? DEFAULT_WEIGHTS[k] : 0), 0);
  const share = (k: FactorKey) => (counts[k] && total ? Math.round((DEFAULT_WEIGHTS[k] / total) * 100) : 0);

  const pick = (name: string) => {
    setText(name);
    setOpen(false);
    setActive(-1);
  };
  const search = () => {
    const qs = toQueryString(params);
    router.push(qs ? `/tutors?${qs}` : "/tutors");
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <form
        role="search"
        aria-label="Try a tutor search"
        className="relative z-20"
        onSubmit={(e) => {
          e.preventDefault();
          if (showList && active >= 0) pick(suggestions[active].name);
          else search();
        }}
      >
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2 pl-4 shadow-sm transition-colors focus-within:border-brand">
          <Search className="size-5 shrink-0 text-muted" aria-hidden />
          <label htmlFor={`${id}-q`} className="sr-only">
            Subject, skill or tutor name
          </label>
          <input
            id={`${id}-q`}
            role="combobox"
            aria-expanded={showList}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 ? `${id}-o${active}` : undefined}
            autoComplete="off"
            value={text}
            placeholder="Subject, skill or tutor"
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (!showList) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => (i + 1) % suggestions.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
              } else if (e.key === "Escape") setOpen(false);
            }}
            className="h-10 min-w-0 flex-1 bg-transparent text-[15px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-muted"
          />
          <button type="submit" className="shrink-0 rounded-lg bg-brand-gradient px-3.5 py-2 text-[13.5px] font-semibold text-white shadow-sm transition-[filter] hover:brightness-110">
            Search
          </button>
        </div>
        {showList && (
          <ul id={`${id}-list`} role="listbox" aria-label="Subjects" className="absolute inset-x-0 top-full mt-1.5 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-xl">
            {suggestions.map((s, i) => (
              <li
                key={s.slug}
                id={`${id}-o${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s.name)}
                onMouseEnter={() => setActive(i)}
                className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] text-ink", i === active && "bg-brand-soft text-brand")}
              >
                <BookOpen className="size-4 shrink-0 opacity-60" aria-hidden /> {s.name}
              </li>
            ))}
          </ul>
        )}
      </form>

      <div className="flex flex-wrap gap-2">
        <ChipSelect label="Grade" placeholder="Any grade" options={GRADE_OPTIONS} value={grade} onChange={(v) => setGrade(v as Grade | "")} />
        <ChipSelect label="Lesson type" placeholder="Online or in person" options={MODE_OPTIONS} value={mode} onChange={(v) => setMode(v as TeachingMode | "")} />
        <ChipSelect label="When" placeholder="Any time" options={SCHEDULE_OPTIONS} value={schedule} onChange={(v) => setSchedule(v as SchedulePreset | "")} />
        <ChipSelect label="Budget" placeholder="Any budget" options={BUDGET_OPTIONS} value={budget === "" ? "" : String(budget)} onChange={(v) => setBudget(v ? Number(v) : "")} />
      </div>

      <p className="-mt-1 text-[13px] text-ink-2" aria-live="polite">
        {matches === null ? (
          <span className="skeleton inline-block h-3 w-40" />
        ) : tutors.length === 0 ? (
          "Tutors are joining — search now and see them as they're listed."
        ) : (
          <>
            <span className="font-semibold tabular-nums text-ink">{matches}</span> {matches === 1 ? "tutor matches" : "tutors match"} {exact ? subjectName(exact.slug) : q ? `“${text.trim()}”` : "these filters"}
          </>
        )}
      </p>

      <div className="mt-auto rounded-xl border border-line bg-surface p-5 shadow-sm">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">How matches are ranked</p>
        <ul className="mt-4 space-y-2.5">
          {SHOWN.map((k) => (
            <li key={k} className="flex items-center gap-3 text-[13px]">
              <span className={cn("w-28 shrink-0", counts[k] ? "text-ink-2" : "text-subtle")}>{FACTOR_LABEL[k]}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <motion.span className="block h-full rounded-full bg-brand-gradient" initial={false} animate={{ width: `${share(k)}%` }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} />
              </span>
              <span className={cn("w-12 text-right tabular-nums", counts[k] ? "text-muted" : "text-subtle")}>{counts[k] ? `${share(k)}%` : "Not set"}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12.5px] text-muted">Unset criteria don&rsquo;t count · paid placement never does</p>
      </div>
    </div>
  );
}
