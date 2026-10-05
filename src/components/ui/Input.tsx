"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SelectMenu, type SelectGroup, type SelectOption } from "./SelectMenu";

export type { SelectGroup, SelectOption };

const control =
  "w-full rounded-lg border border-line-strong bg-surface text-[15px] text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-subtle hover:border-subtle focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger";

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

/* ─── Select: the site's dropdown, backed by a hidden native <select> ──────────
   The visible part is SelectMenu. A visually hidden native select stays in the DOM so forms keep
   working unchanged: react-hook-form's register()/Controller read and write its value and receive
   real change events, browser autofill can fill it, and it submits with the form. */

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  options?: SelectOption[];
  groups?: SelectGroup[];
  placeholder?: string;
  size?: "md" | "sm";
}

const watched = new WeakSet<HTMLSelectElement>();

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

/** Mirror programmatic value changes (reset, setValue, defaults) and autofill into the visible trigger. */
function watchNative(el: HTMLSelectElement, onValue: (v: string) => void, focusTrigger: () => void) {
  // Read lazily: this module is also evaluated on the server, where HTMLSelectElement doesn't exist.
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  if (watched.has(el) || !nativeValue?.get || !nativeValue.set) return;
  watched.add(el);
  const { get, set } = nativeValue;
  Object.defineProperty(el, "value", {
    configurable: true,
    get() {
      return get.call(this);
    },
    set(v: string) {
      set.call(this, v);
      onValue(get.call(this));
    },
  });
  el.addEventListener("change", () => onValue(get.call(el)));
  // Form libraries focus the first invalid field; send that focus to the visible trigger.
  el.focus = focusTrigger;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, options = [], groups, placeholder, size = "md", value, defaultValue, onChange, onBlur, disabled, ...props },
  ref,
) {
  const field = useFieldProps(props);
  const { id: _id, "aria-describedby": _d, "aria-invalid": _i, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledby, ...nativeProps } = props;
  void _id;
  void _d;
  void _i;

  const nativeRef = React.useRef<HTMLSelectElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const openRef = React.useRef(false);
  const controlled = value !== undefined;
  const [inner, setInner] = React.useState(defaultValue !== undefined ? String(defaultValue) : "");
  const current = controlled ? String(value ?? "") : inner;
  const all = groups ? groups.flatMap((g) => g.options) : options;

  const setNative = React.useCallback(
    (el: HTMLSelectElement | null) => {
      nativeRef.current = el;
      if (el) watchNative(el, setInner, () => triggerRef.current?.focus());
      assignRef(ref, el);
    },
    [ref],
  );

  const pick = (v: string) => {
    const el = nativeRef.current;
    if (!el || el.value === v) return;
    el.value = v;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  return (
    <div className={cn("relative", className)}>
      <select
        ref={setNative}
        {...nativeProps}
        {...(controlled ? { value: current } : { defaultValue })}
        onChange={onChange ?? (() => {})}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
      >
        <option value="">{placeholder ?? ""}</option>
        {all.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <SelectMenu
        ref={triggerRef}
        id={field.id}
        aria-describedby={field["aria-describedby"]}
        aria-invalid={field["aria-invalid"]}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        value={current}
        onValueChange={pick}
        options={options}
        groups={groups}
        placeholder={placeholder}
        size={size}
        disabled={disabled}
        onOpenChange={(open) => {
          openRef.current = open;
        }}
        onBlur={() => {
          // Opening the list moves focus into it; only a real blur counts as leaving the field.
          if (openRef.current || !nativeRef.current || !onBlur) return;
          onBlur({ target: nativeRef.current, currentTarget: nativeRef.current, type: "blur" } as unknown as React.FocusEvent<HTMLSelectElement>);
        }}
      />
    </div>
  );
});
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-ink", className)} {...props} />;
}
