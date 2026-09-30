"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Accordion ─────────────────────────────────────────────────────────────── */

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({ className, ...props }: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item className={cn("border-b border-line", className)} {...props} />;
}

export function AccordionTrigger({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "group flex flex-1 items-center justify-between gap-6 py-5 text-left text-[15px] font-semibold text-ink",
          className,
        )}
        {...props}
      >
        {children}
        <span className="grid size-8 shrink-0 place-items-center rounded-lg text-ink transition-[transform,background-color] duration-300 group-hover:bg-canvas group-data-[state=open]:rotate-45">
          <Plus className="size-5" strokeWidth={2.4} />
        </span>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up" {...props}>
      <div className={cn("pb-5 pr-12 text-[15px] leading-relaxed text-ink-2", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

/* ─── Tabs (underline style) ────────────────────────────────────────────────── */

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("scrollbar-none -mb-px flex gap-6 overflow-x-auto border-b border-line", className)} {...props} />;
}

export function TabsTrigger({ className, children, count, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { count?: number }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative flex h-11 shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold text-muted transition-colors hover:text-ink data-[state=active]:text-ink",
        "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-ink after:transition-transform after:duration-300 data-[state=active]:after:scale-x-100",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && <span className="rounded-full bg-sunken px-1.5 py-px text-[11px] tabular-nums text-muted">{count}</span>}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("pt-6 outline-none data-[state=active]:animate-[overlay-in_240ms_ease-out]", className)} {...props} />;
}
