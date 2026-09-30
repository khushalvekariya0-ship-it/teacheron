"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { SORT_OPTIONS, type SortKey } from "@/lib/search";
import { DEFAULT_WEIGHTS, type FactorKey } from "@/lib/matching";
import { Select } from "@/components/ui/Input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Overlay";
import { cn } from "@/lib/utils";

const FACTOR_LABEL: Record<FactorKey, string> = {
  subject: "Subject",
  grade: "Grade level",
  schedule: "Schedule",
  budget: "Budget",
  location: "Location & mode",
  experience: "Experience",
  language: "Language",
  support: "Learning support",
};

/** Explains "Best match" with the same weights the ranking uses. Popover so it works on touch too. */
export function RankingInfo({ className }: { className?: string }) {
  const total = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
  return (
    <Popover>
      <PopoverTrigger
        className={cn("grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink data-[state=open]:bg-sunken data-[state=open]:text-ink", className)}
        aria-label="How Best match ranking works"
      >
        <Info className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <p className="text-sm font-semibold text-ink">How &ldquo;Best match&rdquo; works</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Tutors are ranked only by how well they fit the filters you set, using these factors. Factors you leave blank don&rsquo;t count.
        </p>
        <ul className="mt-3 space-y-1.5">
          {(Object.keys(DEFAULT_WEIGHTS) as FactorKey[]).map((k) => (
            <li key={k} className="flex items-center gap-3 text-[13px]">
              <span className="w-28 shrink-0 text-ink-2">{FACTOR_LABEL[k]}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
                <span className="block h-full rounded-full bg-navy" style={{ width: `${(DEFAULT_WEIGHTS[k] / DEFAULT_WEIGHTS.subject) * 100}%` }} />
              </span>
              <span className="w-9 shrink-0 text-right tabular-nums text-muted">{Math.round((DEFAULT_WEIGHTS[k] / total) * 100)}%</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-line pt-3 text-[12.5px] leading-relaxed text-muted">
          Ties go to tutors with more completed lessons. Featured status and tutor subscription plans never affect the order.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function SortControl({ value, onChange, className, showLabel = true }: { value: SortKey | undefined; onChange: (v: SortKey | undefined) => void; className?: string; showLabel?: boolean }) {
  const id = React.useId();
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label htmlFor={id} className={cn("shrink-0 text-[13px] text-muted", !showLabel && "sr-only")}>
        Sort by
      </label>
      <Select
        id={id}
        value={value ?? "match"}
        onChange={(e) => onChange(e.target.value === "match" ? undefined : (e.target.value as SortKey))}
        options={SORT_OPTIONS}
        className="min-w-0 flex-1 sm:w-48 sm:flex-none [&_select]:h-9 [&_select]:text-sm"
      />
      <RankingInfo />
    </div>
  );
}
