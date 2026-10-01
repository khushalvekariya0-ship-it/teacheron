"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, LayoutGrid, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUBJECTS, SUBJECT_CATEGORIES } from "@/lib/data/catalog";
import { Button } from "@/components/ui/Button";

type Option = { key: string; label: string; hint: string; href: string; area?: boolean };

const SUBJECT_OPTIONS: Option[] = SUBJECTS.map((s) => ({
  key: s.slug,
  label: s.name,
  hint: SUBJECT_CATEGORIES.find((c) => c.slug === s.category)?.name ?? "",
  href: `/tutors?subject=${s.slug}`,
}));
const AREA_OPTIONS: Option[] = SUBJECT_CATEGORIES.map((c) => ({ key: `area:${c.slug}`, label: c.name, hint: "All subjects in this area", href: `/subjects#${c.slug}`, area: true }));
/** Everyday words people type for an area. */
const AREA_ALIASES: Record<string, string> = { math: "math", maths: "math", coding: "computer-science", programming: "computer-science", music: "arts", art: "arts", "study skills": "learning-support" };
const POPULAR = SUBJECT_OPTIONS.filter((o) => SUBJECTS.find((s) => s.slug === o.key)?.popular).slice(0, 6);

function match(q: string): Option[] {
  if (!q) return POPULAR;
  const aliased = new Set(q.length >= 2 ? Object.entries(AREA_ALIASES).filter(([word]) => word.startsWith(q)).map(([, slug]) => `area:${slug}`) : []);
  const areas = AREA_OPTIONS.filter((o) => o.label.toLowerCase().includes(q) || aliased.has(o.key));
  const starts = SUBJECT_OPTIONS.filter((o) => o.label.toLowerCase().startsWith(q));
  const contains = SUBJECT_OPTIONS.filter((o) => !o.label.toLowerCase().startsWith(q) && o.label.toLowerCase().includes(q));
  return [...areas.slice(0, 2), ...starts, ...contains].slice(0, 7);
}

/**
 * Big "What do you want to learn?" search: subjects and areas are suggested as you type;
 * anything else (a skill, a tutor's name) becomes a keyword search of the directory.
 */
export function SubjectSearch({ className }: { className?: string }) {
  const router = useRouter();
  const id = React.useId();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);

  const q = query.trim().toLowerCase();
  const options = React.useMemo(() => match(q), [q]);
  const showList = open && options.length > 0;

  const go = (option?: Option) => {
    setOpen(false);
    if (option) return router.push(option.href);
    const exact = SUBJECT_OPTIONS.find((o) => o.label.toLowerCase() === q);
    if (exact) return router.push(exact.href);
    router.push(q ? `/tutors?q=${encodeURIComponent(query.trim())}` : "/tutors");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        go(showList && active >= 0 ? options[active] : undefined);
      }}
    >
      <label htmlFor={`${id}-input`} className="mb-2.5 block text-left text-[15px] font-semibold text-ink">
        What do you want to learn?
      </label>
      <div className="flex items-center gap-2 rounded-2xl border border-line-strong bg-surface p-2 shadow-lg transition-[border-color,box-shadow] focus-within:border-brand focus-within:shadow-xl">
        <Search className="ml-3 size-5 shrink-0 text-muted" aria-hidden />
        <input
          id={`${id}-input`}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          value={query}
          placeholder="Search subjects, skills or tutors…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="h-12 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-muted sm:h-14 sm:text-[17px]"
        />
        <Button type="submit" variant="brand" size="lg" className="h-12 shrink-0 px-4 sm:h-14 sm:px-7 sm:text-[16px]">
          Search
          <ArrowRight className="hidden sm:block" />
        </Button>
      </div>

      {showList && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={q ? "Suggestions" : "Popular subjects"}
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 text-left shadow-xl"
        >
          {!q && (
            <li className="px-3 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-wide text-muted" role="presentation">
              Popular subjects
            </li>
          )}
          {options.map((o, i) => (
            <li
              key={o.key}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              // Keep focus in the input so the list doesn't close before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(o)}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-ink", i === active && "bg-brand-soft")}
            >
              {o.area ? <LayoutGrid className="size-4 shrink-0 text-muted" aria-hidden /> : <BookOpen className="size-4 shrink-0 text-muted" aria-hidden />}
              <span className={cn("min-w-0 flex-1 truncate", i === active && "text-brand")}>{o.label}</span>
              <span className="hidden shrink-0 text-[12.5px] text-muted sm:inline">{o.hint}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
