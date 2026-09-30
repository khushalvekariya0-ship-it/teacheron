"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";
import { Ban, Scale, SlidersHorizontal } from "lucide-react";
import { DEFAULT_WEIGHTS, type FactorKey } from "@/lib/matching";
import { cn } from "@/lib/utils";
import { EASE } from "@/components/motion";

const FACTORS: { key: FactorKey; label: string; detail: string }[] = [
  { key: "subject", label: "Subject", detail: "Teaches the exact subject. Related subjects in the same area score partially; tutors who don't teach it are left out of shortlists." },
  { key: "grade", label: "Grade level", detail: "Works with students at the learner's level — elementary, middle, high school, college or adult." },
  { key: "schedule", label: "Schedule", detail: "The share of your preferred days on which the tutor has regular availability at your preferred times." },
  { key: "budget", label: "Budget", detail: "Hourly rate at or under your budget. Up to 15% over scores half; more than that scores zero." },
  { key: "location", label: "Location & mode", detail: "Teaches online, or in person within their own service radius of your ZIP code." },
  { key: "experience", label: "Experience", detail: "Meets the minimum years of teaching experience you asked for." },
  { key: "language", label: "Language", detail: "Speaks the language you prefer, when it isn't English." },
  { key: "support", label: "Learning support", detail: "Lists experience with the needs you share, such as ADHD, dyslexia or test anxiety." },
];

/**
 * Visualizes DEFAULT_WEIGHTS. Criteria you don't specify are excluded and the remaining weights are
 * re-normalized — exactly what scoreTutor() does — so the toggles show the real effective share.
 */
export function MatchingWeights() {
  const [active, setActive] = React.useState<FactorKey[]>(FACTORS.map((f) => f.key));
  const total = active.reduce((s, k) => s + DEFAULT_WEIGHTS[k], 0);
  const listRef = React.useRef<HTMLUListElement>(null);
  const seen = useInView(listRef, { once: true, amount: 0.25 });
  const toggle = (k: FactorKey) => setActive((a) => (a.includes(k) ? (a.length > 1 ? a.filter((x) => x !== k) : a) : [...a, k]));

  return (
    <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
      <div className="rounded-2xl border border-line bg-surface">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-heading text-lg font-extrabold tracking-[-0.02em] text-ink">
              <Scale className="size-[18px] text-ink" /> Match score weights
            </p>
            <p className="mt-0.5 text-[13px] text-muted">Default weights, out of 100. Administrators can adjust them; the factors stay visible.</p>
          </div>
        </div>
        <fieldset className="border-b border-line px-5 py-4">
          <legend className="sr-only">Criteria you have set</legend>
          <p className="mb-2.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
            <SlidersHorizontal className="size-3.5 text-ink" /> Criteria you&rsquo;ve set — toggle to see how the weights re-balance
          </p>
          <div className="flex flex-wrap gap-1.5">
            {FACTORS.map((f) => {
              const on = active.includes(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(f.key)}
                  className={cn(
                    "inline-flex h-8 items-center rounded-lg border-2 px-3 text-[12.5px] font-semibold transition-colors",
                    on ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-muted hover:border-ink hover:text-ink",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <ul ref={listRef} className="divide-y divide-line">
          {FACTORS.map((f, i) => {
            const on = active.includes(f.key);
            const weight = DEFAULT_WEIGHTS[f.key];
            const share = on && total ? Math.round((weight / total) * 100) : 0;
            return (
              <li key={f.key} className="px-5 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className={cn("text-sm font-semibold", on ? "text-ink" : "text-muted")}>{f.label}</p>
                  <p className="shrink-0 text-[13px] tabular-nums text-muted">
                    {on ? (
                      <>
                        <span className="font-bold text-ink">{share}%</span> of score
                        {share !== weight && <span className="ml-1.5 text-subtle">(default {weight})</span>}
                      </>
                    ) : (
                      "Not set — excluded"
                    )}
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken" aria-hidden>
                  <motion.div
                    className="h-full rounded-full bg-brand"
                    initial={{ width: 0 }}
                    animate={{ width: seen ? `${share}%` : 0 }}
                    transition={{ duration: 0.8, ease: EASE, delay: seen ? 0.05 * i : 0 }}
                  />
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{f.detail}</p>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border-2 border-ink bg-surface p-5">
          <p className="flex items-center gap-2 font-heading text-lg font-extrabold tracking-[-0.02em] text-ink">
            <Ban className="size-[18px] text-ink" /> What never affects ranking
          </p>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-2">
            <li className="border-l-[3px] border-brand pl-3">Featured placement. Featured tutors may appear in highlighted spots, but their match score and search position are calculated the same way as everyone else&rsquo;s.</li>
            <li className="border-l-[3px] border-brand pl-3">A tutor&rsquo;s subscription plan. Starter, Professional and Premium tutors are ranked by the same factors.</li>
            <li className="border-l-[3px] border-brand pl-3">Anything you can&rsquo;t see. Every factor and its weight is shown next to each result.</li>
          </ul>
        </div>
        <div className="rounded-2xl bg-yellow-soft p-5">
          <p className="text-[16px] font-bold text-ink">How ties are broken</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">When two tutors have the same score, the one with more completed lessons comes first, then alphabetical order by last name.</p>
          <p className="mt-4 text-[16px] font-bold text-ink">Hard requirements</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">A tutor who doesn&rsquo;t teach your subject, or who teaches only in person when you want online (or the reverse), is left out of shortlists rather than ranked low.</p>
        </div>
      </div>
    </div>
  );
}
