"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, IdCard, Laptop, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";

const REQUIREMENTS: { icon: LucideIcon; title: string; body: string; tag?: string }[] = [
  { icon: UserRound, title: "Be 18 or older", body: "Tutors must be adults. You'll confirm your legal name during identity verification." },
  { icon: IdCard, title: "A government-issued photo ID", body: "Used only to verify your identity — never shown to families." },
  { icon: BadgeCheck, title: "Real expertise in what you teach", body: "A degree, a teaching certification or demonstrable experience in each subject you list. Only verified credentials earn badges." },
  { icon: ShieldCheck, title: "Consent to background screening", body: "For example when you work with minors, you'll be asked to complete a background screening.", tag: "Where applicable" },
  { icon: Laptop, title: "A reliable setup", body: "Online: a stable connection, camera and microphone. In person: a service area you can reliably cover." },
];

/**
 * "Are you ready to teach?" — a self-check the visitor can tick through. Nothing is saved or sent;
 * it only helps them see what they still need before signing up.
 */
export function ReadyChecklist({ signupHref }: { signupHref: string }) {
  const [done, setDone] = React.useState<boolean[]>(() => REQUIREMENTS.map(() => false));
  const count = done.filter(Boolean).length;
  const all = count === REQUIREMENTS.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <p className="font-heading text-[18px] font-bold tracking-[-0.01em] text-ink">Are you ready to teach?</p>
          <p className="text-[13.5px] font-semibold tabular-nums text-ink-2" aria-live="polite">
            {count} of {REQUIREMENTS.length} ready
          </p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
          <motion.div className="h-full rounded-full bg-brand-gradient" initial={false} animate={{ width: `${(count / REQUIREMENTS.length) * 100}%` }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} />
        </div>
        <p className="mt-2 text-[12.5px] text-muted">Tick what you already have — just a self-check, nothing is saved.</p>
      </div>

      <ul className="divide-y divide-line">
        {REQUIREMENTS.map((r, i) => {
          const on = done[i];
          return (
            <li key={r.title}>
              <label className={cn("flex cursor-pointer items-start gap-4 px-5 py-4 transition-colors sm:px-6", on ? "bg-brand-50" : "hover:bg-canvas")}>
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={on}
                  onChange={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
                />
                <span
                  className={cn(
                    "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40",
                    on ? "border-transparent bg-brand-gradient text-on-brand" : "border-line-strong bg-surface",
                  )}
                  aria-hidden
                >
                  {on && <Check className="size-4" strokeWidth={3} />}
                </span>
                <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-surface text-brand">
                  <r.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-[16px] font-semibold", on ? "text-ink" : "text-ink")}>{r.title}</span>
                    {r.tag && <span className="rounded-md bg-canvas px-1.5 py-0.5 text-[11px] font-semibold text-muted">{r.tag}</span>}
                  </span>
                  <span className="mt-1 block text-[14.5px] leading-relaxed text-ink-2">{r.body}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <AnimatePresence initial={false}>
        {all && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-col gap-3 border-t border-line bg-canvas px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-[15px] font-semibold text-ink">You&rsquo;re ready to start.</p>
              <Button asChild variant="brand" size="sm">
                <Link href={signupHref}>
                  Create your tutor profile <ArrowRight />
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
