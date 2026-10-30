"use client";

import * as React from "react";
import { Select } from "@/components/ui/Input";
import { subjectGroups } from "@/lib/data/catalog";
import { useCatalog } from "@/lib/store/hooks";

/** aria-describedby value matching the ids `Field` renders for its hint and error. */
export function fieldDescribedBy(id: string, error?: string, hint?: React.ReactNode): string | undefined {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export interface SubjectSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value" | "size"> {
  value: string;
  onChange: (slug: string) => void;
  placeholder?: string;
  invalid?: boolean;
}

/** Subject picker grouped by area (from the live catalog), using the site's dropdown (form-compatible via its hidden native select). */
export const SubjectSelect = React.forwardRef<HTMLSelectElement, SubjectSelectProps>(function SubjectSelect(
  { value, onChange, placeholder = "Choose a subject", invalid, className, ...props },
  ref,
) {
  const groups = subjectGroups(useCatalog());
  return (
    <Select
      ref={ref}
      {...props}
      value={value}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      groups={groups}
      className={className}
    />
  );
});
