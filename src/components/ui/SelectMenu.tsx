"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp, Search } from "lucide-react";
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
        <SelectPrimitive.ItemIndicator className="absolute right-2.5 grid size-5 place-items-center rounded-full bg-brand text-on-brand">
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

/* ─── A dropdown with a search box, for long lists (countries, states) ─────── */

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Best matches first: the name starts with it, then a word starts with it, then it appears anywhere. */
function rank(options: SelectOption[], query: string): SelectOption[] {
  const q = fold(query.trim());
  if (!q) return options;
  const starts: SelectOption[] = [];
  const word: SelectOption[] = [];
  const inside: SelectOption[] = [];
  for (const o of options) {
    const label = fold(o.label);
    if (label.startsWith(q) || fold(o.value) === q) starts.push(o);
    else if (label.split(/[\s(,-]+/).some((w) => w.startsWith(q))) word.push(o);
    else if (label.includes(q)) inside.push(o);
  }
  return [...starts, ...word, ...inside];
}

/**
 * The same field as SelectMenu, but the list opens with a search box: type "ind" and India is at the
 * top. Arrow keys move, Enter picks, Escape closes.
 */
export const SearchSelectMenu = React.forwardRef<HTMLButtonElement, SelectMenuProps & { searchLabel?: string }>(function SearchSelectMenu(
  { value, onValueChange, options = [], groups, placeholder, size = "md", className, contentClassName, onOpenChange, disabled, searchLabel = "Search", ...triggerProps },
  ref,
) {
  const all = React.useMemo(() => (groups ? groups.flatMap((g) => g.options) : options), [groups, options]);
  const selected = value === "" ? undefined : all.find((o) => o.value === value);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listId = React.useId();
  const listRef = React.useRef<HTMLDivElement>(null);

  const list = React.useMemo(() => {
    const found = rank(all, query);
    return placeholder !== undefined && !query ? [{ value: "", label: placeholder }, ...found] : found;
  }, [all, query, placeholder]);

  const setOpenState = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
    if (next) {
      setQuery("");
      setActive(Math.max(0, (placeholder !== undefined ? 1 : 0) + all.findIndex((o) => o.value === value)));
    }
  };
  const choose = (o: SelectOption | undefined) => {
    if (!o || o.disabled) return;
    onValueChange(o.value);
    setOpenState(false);
  };
  const move = (by: number) => {
    const next = Math.min(Math.max(active + by, 0), list.length - 1);
    setActive(next);
    listRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpenState}>
      <PopoverPrimitive.Trigger
        ref={ref}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        {...triggerProps}
        className={cn(
          "group inline-flex w-full min-w-0 items-center gap-2 border border-line-strong bg-surface text-left text-ink outline-none transition-[border-color,box-shadow] duration-150 hover:border-subtle",
          "focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/10 data-[state=open]:border-brand data-[state=open]:ring-4 data-[state=open]:ring-brand/10",
          "disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted aria-[invalid=true]:border-danger",
          FIELD[size],
          className,
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted")}>{selected?.label ?? placeholder ?? "Select"}</span>
        <ChevronDown className="size-4 shrink-0 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).querySelector("input")?.focus();
          }}
          className={cn("z-[120] w-[var(--radix-popover-trigger-width)] min-w-[14rem] overflow-hidden rounded-xl border border-line bg-surface shadow-xl animate-select-in", contentClassName)}
        >
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search className="size-4 shrink-0 text-muted" aria-hidden />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  move(1);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  move(-1);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  choose(list[active]);
                }
              }}
              placeholder={`${searchLabel}…`}
              aria-label={searchLabel}
              aria-controls={listId}
              aria-activedescendant={list[active] ? `${listId}-${active}` : undefined}
              autoComplete="off"
              className="h-10 w-full bg-transparent text-[14.5px] text-ink outline-none placeholder:text-muted"
            />
          </div>
          <div ref={listRef} id={listId} role="listbox" className="max-h-[min(var(--radix-popover-content-available-height),18rem)] overflow-y-auto p-1.5">
            {list.length === 0 && <p className="px-3 py-2.5 text-sm text-muted">No matches</p>}
            {list.map((o, i) => {
              const isSelected = o.value === value;
              return (
                <div
                  key={o.value || "__none"}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={o.disabled || undefined}
                  ref={isSelected && !query ? (el) => el?.scrollIntoView({ block: "center" }) : undefined}
                  onMouseMove={() => active !== i && setActive(i)}
                  onClick={() => choose(o)}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-10 text-[14.5px]",
                    i === active && "bg-brand-50 text-brand",
                    o.value === "" ? "text-muted" : isSelected ? "font-semibold text-ink" : "text-ink",
                    o.disabled && "pointer-events-none opacity-40",
                  )}
                >
                  {o.label}
                  {isSelected && o.value !== "" && (
                    <span className="absolute right-2.5 grid size-5 place-items-center rounded-full bg-brand text-on-brand">
                      <Check className="size-3" strokeWidth={3.2} aria-hidden />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
});
