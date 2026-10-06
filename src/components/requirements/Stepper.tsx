"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { motion, EASE } from "@/components/motion";
import { Progress } from "@/components/ui/Controls";
import { cn } from "@/lib/utils";
import { STEPS } from "./model";

/** Desktop: vertical step list with an animated progress rail and active indicator. */
export function VerticalStepper({ step, maxReached, onSelect }: { step: number; maxReached: number; onSelect: (s: number) => void }) {
  const pct = (step / (STEPS.length - 1)) * 100;
  return (
    <nav aria-label="Requirement steps" className="relative">
      <div className="absolute bottom-5 left-[19px] top-5 w-px bg-line" aria-hidden>
        <motion.div className="w-px bg-brand-gradient" initial={false} animate={{ height: `${pct}%` }} transition={{ duration: 0.6, ease: EASE }} />
      </div>
      <ol className="relative space-y-1">
        {STEPS.map((s, i) => {
          const state = i === step ? "current" : i < step || i <= maxReached ? (i < step ? "done" : "reachable") : "locked";
          const clickable = i !== step && i <= maxReached;
          return (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => clickable && onSelect(i)}
                disabled={!clickable && i !== step}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "group relative flex w-full items-start gap-3 rounded-lg py-2 pl-1.5 pr-3 text-left transition-colors",
                  clickable && "hover:bg-canvas",
                  !clickable && i !== step && "cursor-not-allowed",
                )}
              >
                {i === step && <motion.span layoutId="req-step-active" className="absolute inset-0 rounded-lg bg-brand-soft" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
                <span
                  className={cn(
                    "relative mt-0.5 grid size-[26px] shrink-0 place-items-center rounded-md border text-[12px] font-bold tabular-nums transition-colors duration-300",
                    state === "current" && "border-transparent bg-brand-gradient text-on-brand shadow-sm",
                    state === "done" && "border-brand/40 bg-brand-50 text-brand",
                    state === "reachable" && "border-line-strong bg-surface text-ink-2",
                    state === "locked" && "border-line bg-surface text-subtle",
                  )}
                >
                  {state === "done" ? (
                    <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5, duration: 0.4 }}>
                      <Check className="size-3.5" strokeWidth={2.75} aria-hidden />
                    </motion.span>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="relative min-w-0">
                  <span className={cn("block text-sm", state === "current" ? "font-bold text-ink" : state === "locked" ? "font-medium text-muted" : "font-medium text-ink")}>{s.title}</span>
                  <span className={cn("block text-[12.5px] leading-snug", state === "current" ? "text-ink/75" : "text-muted")}>{s.description}</span>
                  <span className="sr-only">{state === "done" ? " (completed)" : state === "current" ? " (current step)" : state === "locked" ? " (not yet available)" : ""}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Mobile: compact progress with step count and title. */
export function CompactProgress({ step }: { step: number }) {
  const s = STEPS[step];
  return (
    <div className="lg:hidden">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium tabular-nums text-muted">
          Step {step + 1} of {STEPS.length}
        </p>
        {step < STEPS.length - 1 && <p className="truncate text-[12.5px] text-subtle">Next: {STEPS[step + 1].title}</p>}
      </div>
      <Progress value={((step + 1) / STEPS.length) * 100} className="mt-2" label={`Step ${step + 1} of ${STEPS.length}: ${s.title}`} />
    </div>
  );
}
