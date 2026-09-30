"use client";

import * as React from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "@/components/motion";
import { cn } from "@/lib/utils";

/**
 * Free-text tags: type and press Enter (or comma) to add, Backspace on an empty field removes the last one.
 * Pass the same `id` as the surrounding <Field> so the label points at the text input.
 */
export function TagInput({
  id,
  value,
  onChange,
  placeholder = "Type and press Enter",
  max = 6,
  maxLength = 80,
  invalid,
  describedBy,
  onBlur,
}: {
  id?: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  max?: number;
  maxLength?: number;
  invalid?: boolean;
  describedBy?: string;
  onBlur?: () => void;
}) {
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const full = value.length >= max;

  const add = (raw: string) => {
    const tag = raw.trim().replace(/\s+/g, " ").slice(0, maxLength);
    if (!tag || full) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={cn(
        "flex min-h-10 w-full cursor-text flex-wrap items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2 py-1.5 shadow-xs transition-[border-color,box-shadow] focus-within:border-ink focus-within:ring-[3px] focus-within:ring-ink/10 hover:border-subtle",
        invalid && "border-danger focus-within:ring-danger/10",
      )}
    >
      <AnimatePresence initial={false}>
        {value.map((tag) => (
          <motion.span
            key={tag}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
            className="inline-flex max-w-full items-center gap-1 rounded-md border border-line bg-canvas py-0.5 pl-2 pr-0.5 text-[13px] text-ink-2"
          >
            <span className="truncate">{tag}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((v) => v !== tag));
              }}
              className="grid size-5 place-items-center rounded text-muted hover:bg-sunken hover:text-ink"
              aria-label={`Remove ${tag}`}
            >
              <X className="size-3" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <input
        ref={inputRef}
        id={id}
        value={draft}
        disabled={full}
        maxLength={maxLength}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(",")) add(v.slice(0, -1));
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => {
          if (draft.trim()) add(draft);
          onBlur?.();
        }}
        placeholder={full ? `Up to ${max}` : value.length ? "Add another…" : placeholder}
        className="h-7 min-w-32 flex-1 bg-transparent px-1 text-[15px] text-ink outline-none placeholder:text-subtle disabled:cursor-not-allowed"
      />
    </div>
  );
}
