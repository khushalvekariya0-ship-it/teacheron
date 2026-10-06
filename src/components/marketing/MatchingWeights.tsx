"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Ban, CircleSlash, ListOrdered, ShieldAlert, UserRound } from "lucide-react";
import { DEFAULT_WEIGHTS, type FactorKey } from "@/lib/matching";
import { cn } from "@/lib/utils";
import { EASE } from "@/components/motion";

/*
 * A worked example of scoreTutor(): a fixed sample request and a sample tutor whose details the
 * visitor can change. Each option mirrors a branch of the real scoring rules (same partial scores,
 * same hard requirements); criteria the request doesn't set are left out and the rest scaled to 100.
 */

const REQUEST = ["Algebra", "9th grade", "Mon, Wed & Thu evenings", "Up to $60/hr", "Online"];
const BUDGET = 6000;

type Option = { label: string; score: number; detail: string; hard?: boolean };
type Control = { key: FactorKey; label: string; options: Option[] };

const CONTROLS: Control[] = [
  {
    key: "subject",
    label: "Teaches",
    options: [
      { label: "Algebra", score: 1, detail: "Teaches Algebra" },
      { label: "Related math", score: 0.35, detail: "Teaches related math, not Algebra specifically" },
      { label: "Something else", score: 0, detail: "Does not list Algebra", hard: true },
    ],
  },
  {
    key: "grade",
    label: "Works with",
    options: [
      { label: "High school", score: 1, detail: "Works with high school students" },
      { label: "Younger students", score: 0.1, detail: "Usually teaches elementary students" },
    ],
  },
  {
    key: "schedule",
    label: "Free on your evenings",
    options: [3, 2, 1, 0].map((n) => ({
      label: `${n} of 3`,
      score: n / 3,
      detail: n === 3 ? "Available on all preferred days" : n === 0 ? "No regular availability at the preferred times" : `Available ${n} of 3 preferred evenings`,
    })),
  },
  {
    key: "budget",
    label: "Hourly rate",
    options: [5500, 6500, 7500].map((rate) => {
      const over = (rate - BUDGET) / BUDGET;
      return {
        label: `$${rate / 100}`,
        score: rate <= BUDGET ? 1 : over <= 0.15 ? 0.5 : 0,
        detail: rate <= BUDGET ? `$${rate / 100}/hr is within budget` : `$${rate / 100}/hr is $${(rate - BUDGET) / 100} above budget${over <= 0.15 ? " — up to 15% over scores half" : ""}`,
      };
    }),
  },
  {
    key: "location",
    label: "Lesson type",
    options: [
      { label: "Online", score: 1, detail: "Teaches online" },
      { label: "In person only", score: 0, detail: "In-person only — you asked for online", hard: true },
    ],
  },
];

const FACTOR_NAME: Record<FactorKey, string> = {
  subject: "Subject",
  grade: "Grade level",
  schedule: "Schedule",
  budget: "Budget",
  location: "Location & mode",
  experience: "Experience",
  language: "Language",
  support: "Learning support",
};
const UNSET: FactorKey[] = ["experience", "language", "support"];
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function MatchingWeights() {
  const [picked, setPicked] = React.useState<Record<string, number>>({ subject: 0, grade: 0, schedule: 1, budget: 1, location: 0 });

  const rows = CONTROLS.map((c) => ({ key: c.key, option: c.options[picked[c.key] ?? 0], weight: DEFAULT_WEIGHTS[c.key] }));
  const total = rows.reduce((s, r) => s + r.weight, 0);
  const earned = rows.reduce((s, r) => s + r.weight * r.option.score, 0);
  const percent = Math.round((earned / total) * 100);
  const excluded = rows.find((r) => r.option.hard);

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* Request + tutor controls */}
          <div className="border-b border-line p-6 sm:p-7 lg:border-b-0 lg:border-r">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Example request</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {REQUEST.map((r) => (
                <li key={r} className="rounded-lg bg-brand-soft px-2.5 py-1 text-[13px] font-semibold text-brand">
                  {r}
                </li>
              ))}
            </ul>

            <p className="mt-7 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
              <UserRound className="size-3.5" aria-hidden /> Example tutor — change the details
            </p>
            <div className="mt-3 space-y-4">
              {CONTROLS.map((c) => (
                <fieldset key={c.key}>
                  <legend className="mb-1.5 text-[13.5px] font-semibold text-ink">{c.label}</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {c.options.map((o, i) => {
                      const on = (picked[c.key] ?? 0) === i;
                      return (
                        <button
                          key={o.label}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setPicked((p) => ({ ...p, [c.key]: i }))}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-[13.5px] font-medium transition-colors",
                            on ? "border-transparent bg-brand-gradient text-on-brand shadow-sm" : "border-line bg-surface text-ink-2 hover:border-brand/40 hover:text-ink",
                          )}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>

          {/* Score card */}
          <div className="flex flex-col p-6 sm:p-7">
            <div className="flex items-center gap-5">
              <ScoreRing percent={excluded ? null : percent} />
              <div aria-live="polite">
                {excluded ? (
                  <>
                    <p className="flex items-center gap-2 font-heading text-[22px] font-bold tracking-[-0.02em] text-ink">
                      <CircleSlash className="size-5 text-danger" aria-hidden /> Not shortlisted
                    </p>
                    <p className="mt-1 text-[14px] leading-snug text-ink-2">{FACTOR_NAME[excluded.key]} is a hard requirement — this tutor is left out rather than ranked low.</p>
                  </>
                ) : (
                  <>
                    <p className="font-heading text-[22px] font-bold tracking-[-0.02em] text-ink">{percent}% match</p>
                    <p className="mt-1 text-[14px] leading-snug text-ink-2">
                      {fmt(earned)} of {total} points from the criteria in the request, scaled to 100.
                    </p>
                  </>
                )}
              </div>
            </div>

            <ul className="mt-6 divide-y divide-line border-y border-line">
              {rows.map((r) => {
                const pts = r.weight * r.option.score;
                return (
                  <li key={r.key} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[14.5px] font-semibold text-ink">{FACTOR_NAME[r.key]}</span>
                      <span className="shrink-0 text-[13px] tabular-nums text-muted">
                        <span className="font-bold text-ink">{fmt(pts)}</span> / {r.weight}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
                      <motion.div
                        className={cn("h-full rounded-full", r.option.hard ? "bg-danger" : "bg-brand-gradient")}
                        initial={false}
                        animate={{ width: `${r.option.hard ? 100 : r.option.score * 100}%` }}
                        transition={{ duration: 0.5, ease: EASE }}
                      />
                    </div>
                    <p className={cn("mt-1.5 text-[13px]", r.option.hard ? "font-medium text-danger" : "text-muted")}>{r.option.detail}</p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
              Not set in this request, so not counted: {UNSET.map((k) => `${FACTOR_NAME[k]} (${DEFAULT_WEIGHTS[k]})`).join(", ")}.
            </p>
          </div>
        </div>
        <p className="border-t border-line bg-canvas px-6 py-3 text-[12.5px] leading-relaxed text-muted sm:px-7">
          Default weights out of 100: {(Object.keys(DEFAULT_WEIGHTS) as FactorKey[]).map((k) => `${FACTOR_NAME[k]} ${DEFAULT_WEIGHTS[k]}`).join(" · ")}. Administrators can adjust them; they always stay visible next to results.
        </p>
      </div>

      {/* The rules around the score */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <span className="grid size-10 place-items-center rounded-lg bg-brand-gradient text-on-brand">
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
          <span className="grid size-10 place-items-center rounded-lg bg-brand-gradient text-on-brand">
            <ShieldAlert className="size-5" aria-hidden />
          </span>
          <p className="mt-4 font-heading text-[18px] font-bold tracking-[-0.01em] text-ink">Hard requirements</p>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
            A tutor who doesn&rsquo;t teach your subject, or who teaches only in person when you want online (or the reverse), is left out of shortlists rather than ranked low.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6">
          <span className="grid size-10 place-items-center rounded-lg bg-brand-gradient text-on-brand">
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

/** Single-value ring for the total score. */
function ScoreRing({ percent }: { percent: number | null }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-[92px] shrink-0" aria-hidden>
      <svg viewBox="0 0 80 80" className="size-full -rotate-90">
        <defs>
          <linearGradient id="score-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-line)" strokeWidth="8" />
        <motion.circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="url(#score-grad)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - (percent ?? 0) / 100) }}
          transition={{ duration: 0.6, ease: EASE }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-heading text-[22px] font-extrabold tabular-nums text-ink">{percent ?? "—"}</span>
    </div>
  );
}
