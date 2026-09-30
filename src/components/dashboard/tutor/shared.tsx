"use client";

import * as React from "react";
import Link from "next/link";
import { animate, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, FileUp, Plus, UserRoundPlus, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ChipGroup, Progress } from "@/components/ui/Controls";
import { EmptyState } from "@/components/ui/States";
import { SUBJECTS, SUBJECT_CATEGORIES } from "@/lib/data/catalog";
import { EASE } from "@/components/motion";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/store/hooks";

/* ─── Missing profile ───────────────────────────────────────────────────────── */

/** Shown on tutor pages when the signed-in tutor hasn't finished onboarding yet. Resumes a saved draft if there is one. */
export function NeedsTutorProfile({ what = "this page" }: { what?: string }) {
  const me = useSession();
  const drafts = useApp((s) => s.onboarding);
  const draft = me ? drafts[me.id] : undefined;
  const step = draft ? Math.min(10, Math.max(1, draft.step)) : 0;
  return (
    <div data-spotlight className="rounded-xl border border-line bg-surface">
      <EmptyState
        icon={<UserRoundPlus />}
        title={draft ? "Finish setting up your profile" : "Create your tutor profile"}
        description={
          draft
            ? `You're on step ${step} of 10 — your answers are saved. Publish your profile to use ${what}.`
            : `Set up your public profile in about 10 minutes. You'll be able to use ${what} as soon as it's live.`
        }
        action={
          <div className="flex w-full flex-col items-center gap-3">
            {draft && <Progress value={(step - 1) * 10} label="Onboarding progress" className="w-48" />}
            <Button asChild>
              <Link href="/onboarding/tutor">
                {draft ? "Continue onboarding" : "Start onboarding"} <ArrowRight />
              </Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}

/* ─── Tag input ─────────────────────────────────────────────────────────────── */

/**
 * Free-text tags (specialties, topics). Enter or comma adds a tag; each chip has its own remove
 * button. Must sit inside a `Field` so the label and errors are wired to the text input.
 */
export function TagInput({
  value,
  onChange,
  placeholder = "Type and press Enter",
  max = 8,
  maxLength = 40,
  onBlur,
  name,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  maxLength?: number;
  onBlur?: () => void;
  name?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const full = value.length >= max;

  const add = () => {
    const tag = draft.trim().replace(/,+$/, "").trim();
    if (!tag) return;
    if (!value.some((v) => v.toLowerCase() === tag.toLowerCase()) && !full) onChange([...value, tag.slice(0, maxLength)]);
    setDraft("");
  };

  return (
    <div className="space-y-2.5">
      <Input
        name={name}
        value={draft}
        disabled={full}
        maxLength={maxLength}
        placeholder={full ? `Up to ${max} added` : placeholder}
        onChange={(e) => {
          const v = e.target.value;
          if (!v.includes(",")) {
            setDraft(v);
            return;
          }
          // Comma-separated entry: every complete part becomes a tag, the remainder stays in the box.
          const parts = v.split(",");
          const rest = parts.pop() ?? "";
          let next = value;
          for (const p of parts) {
            const tag = p.trim().slice(0, maxLength);
            if (tag && next.length < max && !next.some((x) => x.toLowerCase() === tag.toLowerCase())) next = [...next, tag];
          }
          if (next !== value) onChange(next);
          setDraft(rest);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => {
          add();
          onBlur?.();
        }}
        suffix={
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim() || full}
            className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-40"
            aria-label="Add tag"
          >
            <Plus className="size-4" />
          </button>
        }
      />
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Added">
          {value.map((tag) => (
            <motion.li key={tag} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.18 }}>
              <span className="inline-flex h-8 items-center gap-1 rounded-full border border-line-strong bg-canvas pl-3 pr-1 text-[13px] font-medium text-ink-2">
                {tag}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v !== tag))}
                  className="grid size-6 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink"
                  aria-label={`Remove ${tag}`}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── Subjects grouped by category ──────────────────────────────────────────── */

export function SubjectPicker({ value, onChange, max = 10 }: { value: string[]; onChange: (next: string[]) => void; max?: number }) {
  return (
    <div className="space-y-5">
      {SUBJECT_CATEGORIES.map((cat) => {
        const options = SUBJECTS.filter((s) => s.category === cat.slug).map((s) => ({ value: s.slug, label: s.name }));
        const picked = value.filter((v) => options.some((o) => o.value === v)).length;
        return (
          <div key={cat.slug}>
            <p className="mb-2 flex items-center gap-2 text-[13px] font-medium text-ink">
              {cat.name}
              {picked > 0 && <span className="rounded-md bg-ink px-1.5 py-px text-[11px] font-semibold tabular-nums text-on-ink">{picked}</span>}
            </p>
            <ChipGroup
              size="sm"
              label={cat.name}
              options={options}
              value={value}
              onChange={(next) => {
                if (next.length > max && next.length > value.length) return;
                onChange(next);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ─── File picker (metadata only in the preview build) ──────────────────────── */

export interface PickedFile {
  name: string;
  sizeKb: number;
}

export const toPicked = (f: File): PickedFile => ({ name: f.name, sizeKb: Math.max(1, Math.ceil(f.size / 1024)) });

export function formatKb(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

const DOC_RE = /\.(pdf|png|jpe?g|heic)$/i;

/** Validates verification documents the same way the store does: PDF or image, 15 MB max each. */
export function validateDocs(files: PickedFile[]): string | null {
  if (!files.length) return "Choose at least one file.";
  const bad = files.find((f) => !DOC_RE.test(f.name));
  if (bad) return `${bad.name} isn't a PDF or image. Upload PDF, PNG, JPG or HEIC files.`;
  const big = files.find((f) => f.sizeKb > 15_360);
  if (big) return `${big.name} is larger than 15 MB.`;
  return null;
}

/**
 * Accessible file picker: a visually styled label wrapping a real (visually hidden) file input.
 * Supports drag and drop. Only file names and sizes are kept in this preview build.
 */
export function FilePicker({
  id,
  accept = ".pdf,.png,.jpg,.jpeg,.heic,application/pdf,image/*",
  multiple,
  onFiles,
  title = "Choose files",
  hint = "PDF or image, up to 15 MB each",
  disabled,
  invalid,
  describedBy,
}: {
  id: string;
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title?: string;
  hint?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [over, setOver] = React.useState(false);
  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (disabled) return;
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={cn(
        "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center transition-colors focus-within:border-ink focus-within:ring-[3px] focus-within:ring-ink/10",
        over ? "border-ink bg-brand-50" : invalid ? "border-danger bg-danger-50/40" : "border-line-strong bg-canvas hover:border-subtle",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <FileUp className="size-5 text-muted" aria-hidden />
      <span className="text-sm font-medium text-ink">
        {title} <span className="font-normal text-muted">or drag and drop</span>
      </span>
      <span className="text-[12.5px] text-muted">{hint}</span>
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </label>
  );
}

export function FileList({ files, onRemove }: { files: PickedFile[]; onRemove?: (name: string) => void }) {
  if (!files.length) return null;
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {files.map((f) => (
        <li key={f.name} className="flex items-center gap-3 px-3 py-2.5 text-sm">
          <FileText className="size-4 shrink-0 text-muted" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
          <span className="shrink-0 text-[12.5px] tabular-nums text-muted">{formatKb(f.sizeKb)}</span>
          {onRemove && (
            <button type="button" onClick={() => onRemove(f.name)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink" aria-label={`Remove ${f.name}`}>
              <X className="size-3.5" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ─── Match meter ───────────────────────────────────────────────────────────── */

/** Circular match percentage. The number is always rendered as text, not only as the ring. */
export function MatchRing({ percent, size = 44 }: { percent: number; size?: number }) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, percent));
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} aria-label={`${v}% match`} role="img">
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-sunken)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (v / 100) * c }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      </svg>
      <span className="absolute text-[11.5px] font-semibold tabular-nums text-ink">{v}%</span>
    </span>
  );
}

/* ─── Animated number ───────────────────────────────────────────────────────── */

/** Tweens from the previous value to the new one (no re-count from zero). Respects reduced motion. */
export function AnimatedNumber({ value, format = (n: number) => Math.round(n).toLocaleString("en-US"), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = React.useState(0);
  const latest = React.useRef(0);
  React.useEffect(() => {
    if (reduce) return;
    const controls = animate(latest.current, value, {
      duration: 0.9,
      ease: EASE,
      onUpdate: (v) => {
        latest.current = v;
        setDisplay(v);
      },
    });
    return () => controls.stop();
  }, [value, reduce]);
  return <span className={cn("tabular-nums", className)}>{format(reduce ? value : display)}</span>;
}

/* ─── Grouped controls (chips, radio cards, switches) ───────────────────────── */

/** Fieldset + legend for groups of controls, with hint and error wired for assistive tech. */
export function GroupField({
  legend,
  hint,
  error,
  required,
  optional,
  children,
  className,
}: {
  legend: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  return (
    <fieldset className={cn("min-w-0", className)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}>
      <legend className="mb-1 flex w-full items-baseline justify-between gap-2 text-sm font-medium text-ink">
        <span>
          {legend}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden>
              *
            </span>
          )}
        </span>
        {optional && <span className="text-xs font-normal text-muted">Optional</span>}
      </legend>
      {hint && (
        <p id={`${id}-hint`} className="mb-3 text-[13px] text-muted">
          {hint}
        </p>
      )}
      <div className={cn(!hint && "mt-2")}>{children}</div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/* ─── Small layout helpers ──────────────────────────────────────────────────── */

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-medium uppercase tracking-[0.08em] text-subtle", className)}>{children}</p>;
}

export function ValueList({ items, empty = "Not added yet" }: { items: React.ReactNode[]; empty?: string }) {
  if (!items.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <li key={i} className="inline-flex h-7 items-center rounded-lg bg-canvas px-2.5 text-[13px] text-ink-2">
          {it}
        </li>
      ))}
    </ul>
  );
}
