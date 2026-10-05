"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Dialog ────────────────────────────────────────────────────────────────── */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const overlayCls = "fixed inset-0 z-50 bg-night/50 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out";

export function DialogContent({
  className,
  children,
  title,
  description,
  size = "md",
  hideClose,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: React.ReactNode; description?: React.ReactNode; size?: "sm" | "md" | "lg" | "xl"; hideClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayCls} />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl outline-none data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out",
          { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size],
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-base font-semibold tracking-tight text-ink">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-muted">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</DialogPrimitive.Description>
            )}
          </div>
          {!hideClose && (
            <DialogPrimitive.Close className="-mr-1.5 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </DialogPrimitive.Close>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-5 sm:px-6", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col-reverse gap-2 border-t border-line bg-canvas/60 px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6", className)} {...props} />;
}

/** Confirmation dialog for destructive or important actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "default",
  onConfirm,
  children,
  loading,
  disabled,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  children?: React.ReactNode;
  loading?: boolean;
  /** Disable the confirm button (e.g. until a required reason is entered). */
  disabled?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description} size="sm">
        {children && <DialogBody>{children}</DialogBody>}
        <DialogFooter>
          <DialogClose className="inline-flex h-10 items-center justify-center rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink shadow-xs hover:bg-canvas">Cancel</DialogClose>
          <button
            type="button"
            disabled={loading || disabled}
            onClick={onConfirm}
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium text-white transition-colors disabled:opacity-60",
              tone === "danger" ? "bg-danger text-white hover:bg-danger/90" : "bg-navy text-on-ink hover:bg-navy-hover",
            )}
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sheet (drawer) ────────────────────────────────────────────────────────── */

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  side = "right",
  title,
  description,
  className,
  children,
  footer,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: "right" | "left" | "bottom"; title: React.ReactNode; description?: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayCls} />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col bg-surface shadow-xl outline-none",
          side === "right" && "inset-y-0 right-0 w-[min(100vw,26rem)] border-l border-line data-[state=open]:animate-sheet-in-right data-[state=closed]:animate-sheet-out-right",
          side === "left" && "inset-y-0 left-0 w-[min(88vw,20rem)] border-r border-line data-[state=open]:animate-sheet-in-left data-[state=closed]:animate-sheet-out-left",
          side === "bottom" && "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl border-t border-line data-[state=open]:animate-sheet-in-bottom data-[state=closed]:animate-sheet-out-bottom",
          className,
        )}
        {...props}
      >
        {side === "bottom" && <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong" aria-hidden />}
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-base font-semibold tracking-tight">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-sm text-muted">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{typeof title === "string" ? title : "Panel"}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="grid size-9 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3.5">{footer}</div>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/* ─── Dropdown menu ─────────────────────────────────────────────────────────── */

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;

export function DropdownMenuContent({ className, align = "end", sideOffset = 6, ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn("z-50 min-w-48 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-xl data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out", className)}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuItem({ className, tone, ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & { tone?: "danger" }) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        "flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted",
        tone === "danger" ? "text-danger data-[highlighted]:bg-danger-50 [&_svg]:text-danger" : "text-ink data-[highlighted]:bg-sunken",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>) {
  return <DropdownPrimitive.Label className={cn("px-2.5 py-2 text-xs font-medium text-muted", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>) {
  return <DropdownPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-line", className)} {...props} />;
}

/* ─── Tooltip ───────────────────────────────────────────────────────────────── */

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <TooltipPrimitive.Root delayDuration={200}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-64 rounded-lg bg-ink px-2.5 py-1.5 text-xs leading-snug text-on-ink shadow-md data-[state=delayed-open]:animate-pop-in data-[state=closed]:animate-pop-out"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/* ─── Popover ───────────────────────────────────────────────────────────────── */

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({ className, align = "start", sideOffset = 6, ...props }: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn("z-50 rounded-xl border border-line bg-surface p-3 shadow-xl outline-none data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out", className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
