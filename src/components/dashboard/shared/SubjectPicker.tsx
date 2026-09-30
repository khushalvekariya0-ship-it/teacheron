"use client";

import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "@/components/motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Overlay";
import { SUBJECT_CATEGORIES, SUBJECTS, subjectName } from "@/lib/data/catalog";
import { cn } from "@/lib/utils";

/** Searchable multi-select for catalog subjects, with removable chips for the current selection. */
export function SubjectPicker({
  id,
  value,
  onChange,
  max = 8,
  invalid,
  describedBy,
}: {
  id?: string;
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();
  const groups = SUBJECT_CATEGORIES.map((c) => ({
    ...c,
    subjects: SUBJECTS.filter((s) => s.category === c.slug && (!query || s.name.toLowerCase().includes(query) || c.name.toLowerCase().includes(query))),
  })).filter((g) => g.subjects.length);
  const full = value.length >= max;

  const toggle = (slug: string) => {
    if (value.includes(slug)) onChange(value.filter((v) => v !== slug));
    else if (!full) onChange([...value, slug]);
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-line-strong bg-surface px-3 text-left text-[15px] shadow-xs transition-[border-color,box-shadow] hover:border-subtle focus-visible:border-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ink/10",
            invalid && "border-danger",
          )}
        >
          <span className={value.length ? "text-ink" : "text-subtle"}>{value.length ? `${value.length} selected` : "Choose subjects"}</span>
          <ChevronDown className={cn("size-4 text-muted transition-transform", open && "rotate-180")} aria-hidden />
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
          <div className="border-b border-line p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search subjects"
                aria-label="Search subjects"
                className="h-9 w-full rounded-md bg-canvas pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-ink/15"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1" role="listbox" aria-multiselectable="true" aria-label="Subjects">
            {groups.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">No subjects match “{q}”.</p>}
            {groups.map((g) => (
              <div key={g.slug} className="py-1">
                <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">{g.name}</p>
                {g.subjects.map((s) => {
                  const selected = value.includes(s.slug);
                  const disabled = !selected && full;
                  return (
                    <button
                      key={s.slug}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={disabled}
                      onClick={() => toggle(s.slug)}
                      className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-ink transition-colors hover:bg-sunken disabled:opacity-40"
                    >
                      <span className={cn("grid size-4 shrink-0 place-items-center rounded-[4px] border", selected ? "border-ink bg-ink text-on-ink" : "border-line-strong bg-surface")}>
                        {selected && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      {s.name}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[12px] text-muted">
            <span>
              {value.length} of {max} selected
            </span>
            <button type="button" onClick={() => setOpen(false)} className="font-medium text-ink hover:underline">
              Done
            </button>
          </div>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {value.map((slug) => (
              <motion.span
                key={slug}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-0.5 pl-2.5 pr-0.5 text-[13px] text-ink-2"
              >
                {subjectName(slug)}
                <button type="button" onClick={() => toggle(slug)} className="grid size-5 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink" aria-label={`Remove ${subjectName(slug)}`}>
                  <X className="size-3" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
