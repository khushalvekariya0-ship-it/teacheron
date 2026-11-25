"use client";

import * as React from "react";
import { LANGUAGES } from "@/lib/data/catalog";
import { ChipGroup } from "@/components/ui/Controls";
import { Select } from "@/components/ui/Input";

/** How many of the most used languages show as chips; the rest are one search away. */
const SHOWN = 16;

/**
 * Choosing languages (the languages a tutor teaches in, the ones a learner wants): the most used ones as chips,
 * every other language in a searchable list. A language picked from the list joins the chips while chosen.
 */
export function LanguagePicker({ value, onChange, label, size = "sm" }: { value: string[]; onChange: (v: string[]) => void; label: string; size?: "sm" | "md" }) {
  const common = LANGUAGES.slice(0, SHOWN);
  const extra = value.filter((l) => !common.includes(l));
  const rest = LANGUAGES.filter((l) => !common.includes(l) && !value.includes(l));
  return (
    <div className="space-y-2.5">
      <ChipGroup size={size} label={label} options={[...common, ...extra].map((l) => ({ value: l, label: l }))} value={value} onChange={onChange} />
      {rest.length > 0 && (
        <Select
          size="sm"
          searchable
          searchLabel="Search languages"
          aria-label={`More languages: ${label}`}
          placeholder={`More languages (${rest.length})…`}
          value=""
          options={rest.map((l) => ({ value: l, label: l }))}
          onChange={(e) => {
            const v = e.target.value;
            if (v && !value.includes(v)) onChange([...value, v]);
          }}
          className="max-w-xs"
        />
      )}
    </div>
  );
}
