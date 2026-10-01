"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUBJECTS } from "@/lib/data/catalog";
import { Button } from "@/components/ui/Button";

const POPULAR = SUBJECTS.filter((s) => s.popular).slice(0, 6);

/**
 * The hero's search box: type a subject, pick a suggestion, or press Find tutors.
 * A matching subject opens the directory filtered by it; anything else becomes a keyword search.
 */
export function HeroSearch({ className }: { className?: string }) {
  const router = useRouter();
  const id = React.useId();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);

  const q = query.trim().toLowerCase();
  const options = React.useMemo(() => {
    if (!q) return POPULAR;
    const starts = SUBJECTS.filter((s) => s.name.toLowerCase().startsWith(q));
    const contains = SUBJECTS.filter((s) => !s.name.toLowerCase().startsWith(q) && s.name.toLowerCase().includes(q));
    return [...starts, ...contains].slice(0, 6);
  }, [q]);
  const showList = open && options.length > 0;

  const go = (slug?: string) => {
    setOpen(false);
    if (slug) return router.push(`/tutors?subject=${slug}`);
    const exact = SUBJECTS.find((s) => s.name.toLowerCase() === q);
    if (exact) return router.push(`/tutors?subject=${exact.slug}`);
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
      aria-label="Find a tutor"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        go(showList && active >= 0 ? options[active]?.slug : undefined);
      }}
    >
      <div className="flex items-center gap-2 rounded-2xl border border-line-strong bg-surface p-2 shadow-lg transition-colors focus-within:border-brand">
        <Search className="ml-2.5 size-5 shrink-0 text-muted" aria-hidden />
        <label htmlFor={`${id}-input`} className="sr-only">
          What do you want to learn?
        </label>
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
          placeholder="What do you want to learn?"
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
          <span className="hidden sm:inline">Find tutors</span>
          <span className="sm:hidden">Search</span>
          <ArrowRight className="hidden sm:block" />
        </Button>
      </div>

      {showList && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={q ? "Matching subjects" : "Popular subjects"}
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 text-left shadow-xl"
        >
          {!q && <li className="px-3 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-wide text-muted" role="presentation">Popular subjects</li>}
          {options.map((s, i) => (
            <li
              key={s.slug}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              // Keep focus in the input so the list doesn't close before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(s.slug)}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-ink", i === active && "bg-brand-soft text-brand")}
            >
              <BookOpen className="size-4 shrink-0 opacity-60" aria-hidden />
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
