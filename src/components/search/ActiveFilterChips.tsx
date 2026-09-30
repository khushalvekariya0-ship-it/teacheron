"use client";

import * as React from "react";
import { X } from "lucide-react";
import type { TutorSearch } from "@/lib/search";
import { AnimatePresence, motion } from "@/components/motion";
import { clearedSearch, filterChips } from "./filters";

/** Removable chips for every active filter. Chips animate in and out as filters change. */
export function ActiveFilterChips({ value, onChange }: { value: TutorSearch; onChange: (next: TutorSearch) => void }) {
  const chips = filterChips(value);
  return (
    <AnimatePresence initial={false}>
      {chips.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <ul className="flex flex-wrap items-center gap-2 pt-4" aria-label="Active filters">
            <AnimatePresence initial={false} mode="popLayout">
              {chips.map((c) => (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                >
                  <button
                    type="button"
                    onClick={() => onChange(c.remove(value))}
                    className="group inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface pl-3 pr-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-navy/40 hover:text-ink"
                    aria-label={`Remove filter: ${c.label}`}
                  >
                    {c.label}
                    <span className="grid size-4 place-items-center rounded-full text-muted transition-colors group-hover:bg-navy group-hover:text-on-ink">
                      <X className="size-3" aria-hidden />
                    </span>
                  </button>
                </motion.li>
              ))}
              {chips.length > 1 && (
                <motion.li key="__clear" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <button type="button" onClick={() => onChange(clearedSearch(value))} className="h-8 px-2 text-[13px] font-medium text-navy underline-offset-4 hover:underline">
                    Clear all
                  </button>
                </motion.li>
              )}
            </AnimatePresence>
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
