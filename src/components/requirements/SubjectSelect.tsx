"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUBJECTS, SUBJECT_CATEGORIES } from "@/lib/data/catalog";

/** Mirrors the UI kit's control styling (tokens only) for native selects that need <optgroup>. */
export const selectControl =
  "h-11 w-full appearance-none rounded-lg border border-line-strong bg-surface pl-3.5 pr-9 text-[15px] text-ink outline-none transition-[border-color,box-shadow] duration-150 hover:border-subtle focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger";

/** aria-describedby value matching the ids `Field` renders for its hint and error. */
export function fieldDescribedBy(id: string, error?: string, hint?: React.ReactNode): string | undefined {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export interface SubjectSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> {
  value: string;
  onChange: (slug: string) => void;
  placeholder?: string;
  invalid?: boolean;
}

/** Subject picker grouped by category (native select: accessible and mobile friendly). */
export const SubjectSelect = React.forwardRef<HTMLSelectElement, SubjectSelectProps>(function SubjectSelect(
  { value, onChange, placeholder = "Choose a subject", invalid, className, ...props },
  ref,
) {
  return (
    <div className={cn("relative", className)}>
      <select
        ref={ref}
        {...props}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(selectControl, !value && "text-muted")}
      >
        <option value="">{placeholder}</option>
        {SUBJECT_CATEGORIES.map((c) => (
          <optgroup key={c.slug} label={c.name}>
            {SUBJECTS.filter((s) => s.category === c.slug).map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
});
