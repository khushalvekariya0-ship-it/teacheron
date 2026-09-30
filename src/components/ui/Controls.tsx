"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Checkbox ──────────────────────────────────────────────────────────────── */

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & { label?: React.ReactNode; description?: React.ReactNode }
>(({ className, label, description, id, ...props }, ref) => {
  const auto = React.useId();
  const cid = id ?? auto;
  const box = (
    <CheckboxPrimitive.Root
      ref={ref}
      id={cid}
      className={cn(
        "peer grid size-[18px] shrink-0 place-items-center rounded-[5px] border border-line-strong bg-surface shadow-xs transition-colors hover:border-muted data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand disabled:opacity-50",
        !label && className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-white data-[state=checked]:animate-pop-in">
        {props.checked === "indeterminate" ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
  if (!label) return box;
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <span className="mt-[3px]">{box}</span>
      <label htmlFor={cid} className="cursor-pointer select-none text-sm leading-snug text-ink">
        {label}
        {description && <span className="mt-0.5 block text-[13px] text-muted">{description}</span>}
      </label>
    </div>
  );
});
Checkbox.displayName = "Checkbox";

/* ─── Switch ────────────────────────────────────────────────────────────────── */

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & { size?: "sm" | "md" }
>(({ className, size = "md", ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "relative inline-flex shrink-0 items-center rounded-full border border-transparent bg-line-strong transition-colors duration-200 data-[state=checked]:bg-brand disabled:opacity-50",
      size === "md" ? "h-6 w-10" : "h-5 w-8",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "block rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-out-quint)]",
        size === "md" ? "size-5 translate-x-0.5 data-[state=checked]:translate-x-[18px]" : "size-4 translate-x-0.5 data-[state=checked]:translate-x-[14px]",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";

/* ─── Radio cards ───────────────────────────────────────────────────────────── */

export function RadioCards<T extends string>({
  value,
  onValueChange,
  options,
  className,
  columns = 2,
  name,
}: {
  value: T | undefined;
  onValueChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; description?: React.ReactNode; icon?: React.ReactNode; disabled?: boolean }[];
  className?: string;
  columns?: 1 | 2 | 3 | 4;
  name?: string;
}) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      name={name}
      className={cn("grid gap-2.5", { 1: "grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[columns], className)}
    >
      {options.map((o) => (
        <RadioGroupPrimitive.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className="group relative flex items-start gap-3 rounded-lg border border-line bg-surface p-3.5 text-left transition-[border-color,background-color,box-shadow] hover:border-line-strong data-[state=checked]:border-brand data-[state=checked]:bg-brand-50/60 data-[state=checked]:shadow-[0_0_0_1px_var(--color-navy)] disabled:opacity-50"
        >
          {o.icon && <span className="mt-0.5 text-muted group-data-[state=checked]:text-navy [&_svg]:size-[18px]">{o.icon}</span>}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink">{o.label}</span>
            {o.description && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{o.description}</span>}
          </span>
          <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-line-strong bg-surface group-data-[state=checked]:border-navy">
            <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-brand data-[state=checked]:animate-pop-in" />
          </span>
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}

/* ─── Toggle chips (multi-select) ───────────────────────────────────────────── */

export function ChipGroup<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  label,
}: {
  value: T[];
  onChange: (v: T[]) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
  size?: "sm" | "md";
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border font-semibold transition-[background-color,border-color,color] duration-150",
              size === "md" ? "h-9 px-3.5 text-sm" : "h-7 px-2.5 text-[13px]",
              active ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-ink-2 hover:border-ink hover:text-ink",
            )}
          >
            {active && <Check className="size-3.5" strokeWidth={2.5} aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Segmented control (single select, animated) ──────────────────────────── */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; count?: number }[];
  className?: string;
  size?: "sm" | "md";
  label?: string;
}) {
  const layoutId = React.useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-lg border border-line bg-canvas p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-md font-medium transition-colors",
              size === "md" ? "h-8 px-3 text-sm" : "h-7 px-2.5 text-[13px]",
              active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-md border border-line bg-surface shadow-xs"
                transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
              />
            )}
            <span className="relative">{o.label}</span>
            {o.count !== undefined && <span className="relative text-xs tabular-nums text-muted">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Progress ──────────────────────────────────────────────────────────────── */

export function Progress({ value, className, label, tone = "navy" }: { value: number; className?: string; label?: string; tone?: "navy" | "success" }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label} className={cn("h-1.5 w-full overflow-hidden rounded-full bg-sunken", className)}>
      <motion.div
        className={cn("h-full rounded-full", tone === "navy" ? "bg-brand" : "bg-teal")}
        initial={{ width: 0 }}
        animate={{ width: `${v}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
