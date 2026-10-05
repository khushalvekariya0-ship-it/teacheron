"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

/** Radix items can't use "" as a value, so the placeholder ("Any …") item uses this instead. */
const NONE = "__none__";

const FIELD = {
  md: "h-11 rounded-lg px-3.5 text-[15px]",
  sm: "h-9 rounded-lg px-3 text-sm",
} as const;

export interface SelectMenuProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "defaultValue" | "onChange" | "dir"> {
  value: string;
  onValueChange: (value: string) => void;
  options?: SelectOption[];
  groups?: SelectGroup[];
  /** Shown when nothing is chosen; also offered as the first item so a choice can be cleared. */
  placeholder?: string;
  /** "field" looks like a form input; "bare" leaves the trigger's look to `className`. */
  variant?: "field" | "bare";
  size?: keyof typeof FIELD;
  /** Icon or element before the value. */
  leading?: React.ReactNode;
  /** Custom trigger text (defaults to the chosen label or the placeholder). */
  renderValue?: (selected: SelectOption | undefined) => React.ReactNode;
  contentClassName?: string;
  onOpenChange?: (open: boolean) => void;
}

function Item({ option, muted }: { option: SelectOption; muted?: boolean }) {
  return (
    <SelectPrimitive.Item
      value={option.value}
      disabled={option.disabled}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-10 text-[14.5px] outline-none transition-colors",
        "data-[highlighted]:bg-brand-50 data-[highlighted]:text-brand data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        muted ? "text-muted" : "text-ink data-[state=checked]:font-semibold",
      )}
    >
      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
      {/* The "Any …" / "Choose …" line clears the choice, so it gets no check mark. */}
      {!muted && (
        <SelectPrimitive.ItemIndicator className="absolute right-2.5 grid size-5 place-items-center rounded-full bg-brand text-white">
          <Check className="size-3" strokeWidth={3.2} aria-hidden />
        </SelectPrimitive.ItemIndicator>
      )}
    </SelectPrimitive.Item>
  );
}

/**
 * The site's dropdown: a styled trigger and a floating, keyboard-friendly list (Radix Select) with
 * a gradient check on the chosen item, optional groups, and scroll buttons for long lists.
 */
export const SelectMenu = React.forwardRef<HTMLButtonElement, SelectMenuProps>(function SelectMenu(
  { value, onValueChange, options = [], groups, placeholder, variant = "field", size = "md", leading, renderValue, className, contentClassName, onOpenChange, disabled, ...triggerProps },
  ref,
) {
  const all = groups ? groups.flatMap((g) => g.options) : options;
  const selected = value === "" ? undefined : all.find((o) => o.value === value);
  const rootValue = value === "" ? (placeholder !== undefined ? NONE : "") : value;

  return (
    <SelectPrimitive.Root value={rootValue} onValueChange={(v) => onValueChange(v === NONE ? "" : v)} onOpenChange={onOpenChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        ref={ref}
        {...triggerProps}
        className={cn(
          "group inline-flex min-w-0 items-center gap-2 text-left outline-none",
          variant === "field" &&
            cn(
              "w-full border border-line-strong bg-surface text-ink transition-[border-color,box-shadow] duration-150 hover:border-subtle",
              "focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/10 data-[state=open]:border-brand data-[state=open]:ring-4 data-[state=open]:ring-brand/10",
              "disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted aria-[invalid=true]:border-danger",
              FIELD[size],
            ),
          className,
        )}
      >
        {leading}
        <span className={cn("min-w-0 flex-1 truncate", !selected && variant === "field" && "text-muted")}>
          {renderValue ? renderValue(selected) : (selected?.label ?? placeholder ?? "Select")}
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden />
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            "z-[120] max-h-[min(var(--radix-select-content-available-height),22rem)] min-w-[max(var(--radix-select-trigger-width),12rem)] overflow-hidden",
            "rounded-xl border border-line bg-surface shadow-xl animate-select-in",
            contentClassName,
          )}
        >
          <SelectPrimitive.ScrollUpButton className="flex h-7 cursor-default items-center justify-center bg-surface text-muted">
            <ChevronUp className="size-4" aria-hidden />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1.5">
            {placeholder !== undefined && <Item option={{ value: NONE, label: placeholder }} muted />}
            {groups
              ? groups.map((g, gi) => (
                  <SelectPrimitive.Group key={g.label}>
                    {(gi > 0 || placeholder !== undefined) && <SelectPrimitive.Separator className="mx-2 my-1.5 h-px bg-line" />}
                    <SelectPrimitive.Label className="px-3 pb-1 pt-1.5 text-[12px] font-medium text-muted">{g.label}</SelectPrimitive.Label>
                    {g.options.map((o) => (
                      <Item key={o.value} option={o} />
                    ))}
                  </SelectPrimitive.Group>
                ))
              : options.map((o) => <Item key={o.value} option={o} />)}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-7 cursor-default items-center justify-center bg-surface text-muted">
            <ChevronDown className="size-4" aria-hidden />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
});
