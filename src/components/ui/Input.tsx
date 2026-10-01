"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-lg border border-line-strong bg-surface text-[15px] text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-subtle hover:border-subtle focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger";

/* ─── Field: label + control + hint/error, wired for screen readers ─────────── */

interface FieldCtx {
  id: string;
  describedBy?: string;
  invalid: boolean;
}
const FieldContext = React.createContext<FieldCtx | null>(null);

export function Field({
  label,
  hint,
  error,
  required,
  optional,
  children,
  className,
  id: idProp,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const auto = React.useId();
  const id = idProp ?? auto;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: !!error }}>
      <div className={cn("space-y-1.5", className)}>
        {label && (
          <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-medium text-ink">
            <span>
              {label}
              {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
            </span>
            {optional && <span className="text-xs font-normal text-muted">Optional</span>}
          </label>
        )}
        {children}
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : hint ? (
          <p id={`${id}-hint`} className="text-[13px] text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

function useFieldProps(props: { id?: string; "aria-describedby"?: string; "aria-invalid"?: React.AriaAttributes["aria-invalid"] }) {
  const ctx = React.useContext(FieldContext);
  return {
    id: props.id ?? ctx?.id,
    "aria-describedby": props["aria-describedby"] ?? ctx?.describedBy,
    "aria-invalid": props["aria-invalid"] ?? (ctx?.invalid || undefined),
  };
}

/* ─── Input ─────────────────────────────────────────────────────────────────── */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
  prefixText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, icon, suffix, prefixText, ...props }, ref) => {
  const field = useFieldProps(props);
  const input = (
    <input
      ref={ref}
      {...props}
      {...field}
      className={cn(control, "h-11 px-3.5", (icon || prefixText) && "pl-9", suffix && "pr-10", !icon && !suffix && !prefixText && className)}
    />
  );
  if (!icon && !suffix && !prefixText) return input;
  return (
    <div className={cn("relative", className)}>
      {icon && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted [&_svg]:size-4">{icon}</span>}
      {prefixText && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[15px] text-muted">{prefixText}</span>}
      {input}
      {suffix && <span className="absolute inset-y-0 right-2 flex items-center text-muted">{suffix}</span>}
    </div>
  );
});
Input.displayName = "Input";

/* ─── Textarea ──────────────────────────────────────────────────────────────── */

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { showCount?: boolean }>(
  ({ className, showCount, maxLength, ...props }, ref) => {
    const field = useFieldProps(props);
    const len = typeof props.value === "string" ? props.value.length : 0;
    return (
      <div className="relative">
        <textarea ref={ref} maxLength={maxLength} {...props} {...field} className={cn(control, "min-h-24 resize-y px-3 py-2.5 leading-relaxed", className)} />
        {showCount && maxLength && (
          <span className="pointer-events-none absolute bottom-2 right-3 text-xs tabular-nums text-subtle">
            {len}/{maxLength}
          </span>
        )}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

/* ─── Select (native: accessible and mobile-friendly) ──────────────────────── */

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, options, placeholder, ...props }, ref) => {
  const field = useFieldProps(props);
  return (
    <div className={cn("relative", className)}>
      <select ref={ref} {...props} {...field} className={cn(control, "h-11 appearance-none pl-3.5 pr-9", !props.value && placeholder && "text-muted")}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
});
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-ink", className)} {...props} />;
}
