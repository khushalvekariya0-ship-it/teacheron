"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";
import { Ban, ListOrdered, ShieldAlert, SlidersHorizontal } from "lucide-react";
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

/** One blue → violet step per factor, heaviest first; slices are separated by a gap and always labelled in the list. */
const COLORS = ["#1d4ed8", "#2f7bff", "#4b66f5", "#6366f1", "#7552f0", "#8b5cf6", "#a78bfa", "#c4b5fd"];
const COLOR: Record<FactorKey, string> = Object.fromEntries(FACTORS.map((f, i) => [f.key, COLORS[i]])) as Record<FactorKey, string>;

const R = 92;
const C = 2 * Math.PI * R;
const GAP = 3;

/**
 * Visualizes DEFAULT_WEIGHTS as a score ring. Criteria you don't specify are excluded and the remaining
 * weights are re-normalized — exactly what scoreTutor() does — so the ring shows the real effective share.
 */
export function MatchingWeights() {
  const [active, setActive] = React.useState<FactorKey[]>(FACTORS.map((f) => f.key));
  const [focus, setFocus] = React.useState<FactorKey>("subject");
  const ringRef = React.useRef<HTMLDivElement>(null);
  const seen = useInView(ringRef, { once: true, amount: 0.3 });

  const total = active.reduce((s, k) => s + DEFAULT_WEIGHTS[k], 0);
  const share = (k: FactorKey) => (active.includes(k) && total ? (DEFAULT_WEIGHTS[k] / total) * 100 : 0);
  const toggle = (k: FactorKey) => {
    const next = active.includes(k) ? (active.length > 1 ? active.filter((x) => x !== k) : active) : [...active, k];
    setActive(next);
    if (!next.includes(focus)) setFocus(next[0]);
  };

  // Slices in factor order, each starting where the previous one ended.
  const lengths = FACTORS.filter((f) => active.includes(f.key)).map((f) => ({ key: f.key, len: (share(f.key) / 100) * C }));
  const slices = lengths.map((l, i) => ({
    key: l.key,
    len: Math.max(0, l.len - GAP),
    offset: lengths.slice(0, i).reduce((sum, x) => sum + x.len, 0),
  }));
  const focused = FACTORS.find((f) => f.key === focus)!;

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          {/* Ring + criteria toggles */}
          <div className="flex flex-col items-center border-b border-line p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <div ref={ringRef} className="relative size-[240px] sm:size-[260px]">
              <svg viewBox="0 0 220 220" className="size-full -rotate-90" role="img" aria-label={`Match score weights: ${FACTORS.filter((f) => active.includes(f.key)).map((f) => `${f.label} ${Math.round(share(f.key))}%`).join(", ")}`}>
                <circle cx="110" cy="110" r={R} fill="none" stroke="var(--color-line)" strokeWidth="22" />
                {slices.map((s) => (
                  <circle
                    key={s.key}
                    cx="110"
                    cy="110"
                    r={R}
                    fill="none"
                    stroke={COLOR[s.key]}
                    strokeWidth={s.key === focus ? 28 : 22}
                    strokeDasharray={`${seen ? s.len : 0} ${C}`}
                    strokeDashoffset={-s.offset}
                    className="cursor-pointer transition-[stroke-dasharray,stroke-dashoffset,stroke-width,opacity] duration-700 ease-out"
                    style={{ opacity: s.key === focus ? 1 : 0.85 }}
                    onMouseEnter={() => setFocus(s.key)}
                  />
                ))}
              </svg>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <motion.div key={focus + total} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: EASE }}>
                  <p className="font-heading text-[44px] font-extrabold leading-none tracking-[-0.03em] text-ink tabular-nums">{Math.round(share(focus))}%</p>
                  <p className="mt-1.5 text-[13.5px] font-semibold text-ink-2">{focused.label}</p>
                  <p className="text-[12px] text-muted">of the match score</p>
                </motion.div>
              </div>
            </div>

            <fieldset className="mt-7 w-full">
              <legend className="mb-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
                <SlidersHorizontal className="size-3.5 text-brand" aria-hidden /> Criteria you&rsquo;ve set — switch one off to see the rest re-balance
              </legend>
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
                        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-semibold transition-colors",
                        on ? "border-brand/30 bg-brand-50 text-ink" : "border-line bg-surface text-muted line-through decoration-muted/50 hover:text-ink",
                      )}
                    >
                      <span className="size-2 rounded-full" style={{ background: on ? COLOR[f.key] : "var(--color-line-strong)" }} aria-hidden />
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          {/* Factor list: hover or focus a row to read how it's scored */}
          <ul className="divide-y divide-line">
            {FACTORS.map((f) => {
              const on = active.includes(f.key);
              const pct = Math.round(share(f.key));
              const isFocus = f.key === focus && on;
              return (
                <li key={f.key}>
                  <button
                    type="button"
                    onMouseEnter={() => on && setFocus(f.key)}
                    onFocus={() => on && setFocus(f.key)}
                    onClick={() => on && setFocus(f.key)}
                    aria-expanded={isFocus}
                    className={cn("w-full px-5 py-3.5 text-left transition-colors sm:px-6", isFocus ? "bg-brand-50" : on ? "hover:bg-canvas" : "")}
                  >
                    <span className="flex items-center gap-3">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: on ? COLOR[f.key] : "var(--color-line-strong)" }} aria-hidden />
                      <span className={cn("flex-1 text-[15px] font-semibold", on ? "text-ink" : "text-muted")}>{f.label}</span>
                      <span className="shrink-0 text-[13px] tabular-nums text-muted">
                        {on ? (
                          <>
                            <span className="font-bold text-ink">{pct}%</span>
                            {pct !== DEFAULT_WEIGHTS[f.key] && <span className="ml-1.5 text-subtle">(default {DEFAULT_WEIGHTS[f.key]})</span>}
                          </>
                        ) : (
                          "Not set — excluded"
                        )}
                      </span>
                    </span>
                    <span className="ml-[22px] mt-2 block h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
                      <motion.span className="block h-full rounded-full" style={{ background: COLOR[f.key] }} initial={false} animate={{ width: `${on ? pct : 0}%` }} transition={{ duration: 0.6, ease: EASE }} />
                    </span>
                    {isFocus && (
                      <motion.span initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="ml-[22px] mt-2 block overflow-hidden text-[13.5px] leading-relaxed text-ink-2">
                        {f.detail}
                      </motion.span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="border-t border-line bg-canvas px-5 py-3 text-[12.5px] text-muted sm:px-6">Default weights out of 100. Administrators can adjust them; the factors and their weights always stay visible.</p>
      </div>

      {/* The rules around the score */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <span className="grid size-10 place-items-center rounded-lg bg-brand-gradient text-white">
            <Ban className="size-5" aria-hidden />
          </span>
          <p className="mt-4 font-heading text-[18px] font-bold tracking-[-0.01em] text-ink">Never affects ranking</p>
          <ul className="mt-3 space-y-2.5 text-[14px] leading-relaxed text-ink-2">
            <li className="border-l-2 border-brand pl-3"><span className="font-semibold text-ink">Featured placement.</span> Featured tutors may appear in highlighted spots, but their score and position are calculated like everyone else&rsquo;s.</li>
            <li className="border-l-2 border-brand pl-3"><span className="font-semibold text-ink">A tutor&rsquo;s plan.</span> Starter, Professional and Premium tutors are ranked by the same factors.</li>
            <li className="border-l-2 border-brand pl-3"><span className="font-semibold text-ink">Anything hidden.</span> Every factor and its weight is shown next to each result.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6">
          <span className="grid size-10 place-items-center rounded-lg bg-brand-gradient text-white">
            <ShieldAlert className="size-5" aria-hidden />
          </span>
          <p className="mt-4 font-heading text-[18px] font-bold tracking-[-0.01em] text-ink">Hard requirements</p>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
            A tutor who doesn&rsquo;t teach your subject, or who teaches only in person when you want online (or the reverse), is left out of shortlists rather than ranked low.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6">
          <span className="grid size-10 place-items-center rounded-lg bg-brand-gradient text-white">
            <ListOrdered className="size-5" aria-hidden />
          </span>
          <p className="mt-4 font-heading text-[18px] font-bold tracking-[-0.01em] text-ink">How ties are broken</p>
          <ol className="mt-3 space-y-2 text-[14px] leading-relaxed text-ink-2">
            <li className="flex gap-2.5"><span className="grid size-5 shrink-0 place-items-center rounded bg-brand-soft text-[11px] font-bold text-brand">1</span> More completed lessons comes first</li>
            <li className="flex gap-2.5"><span className="grid size-5 shrink-0 place-items-center rounded bg-brand-soft text-[11px] font-bold text-brand">2</span> Then alphabetical order by last name</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
