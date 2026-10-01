"use client";

import * as React from "react";
import { CircleCheck, CircleX, CircleMinus, CircleDashed } from "lucide-react";
import { motion, CountUp, EASE } from "@/components/motion";
import type { FactorKey, FactorResult, MatchResult } from "@/lib/matching";
import { subjectName, LEVEL_LABEL, gradeToLevel } from "@/lib/data/catalog";
import { formatCents } from "@/lib/format";
import type { MatchCriteria } from "@/lib/matching";
import { cn } from "@/lib/utils";

/* ─── Status vocabulary (icon shape + word, never color alone) ─────────────── */

export const FACTOR_STATUS_META: Record<FactorResult["status"], { label: string; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>; cls: string }> = {
  match: { label: "Match", icon: CircleCheck, cls: "text-success" },
  partial: { label: "Partial", icon: CircleDashed, cls: "text-warning" },
  miss: { label: "Miss", icon: CircleX, cls: "text-danger" },
  neutral: { label: "Not scored", icon: CircleMinus, cls: "text-subtle" },
};

/** Canonical order in which factors are listed everywhere. */
export const FACTOR_ORDER: FactorKey[] = ["subject", "grade", "schedule", "budget", "location", "experience", "language", "support"];

const pct = (n: number) => `${Math.round(n)}%`;

/** Animated circular match score. */
export function MatchRing({ value, size = 64, stroke = 5, className, label }: { value: number; size?: number; stroke?: number; className?: string; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v)}% match`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-sunken" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="stroke-brand"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - v / 100) }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: EASE }}
        />
      </svg>
      <span className={cn("absolute inset-0 grid place-items-center font-heading font-bold tracking-[-0.03em] text-ink", size >= 72 ? "text-lg" : "text-[13.5px]")} aria-hidden>
        <CountUp value={v} format={pct} duration={1.1} />
      </span>
    </div>
  );
}

/** Thin horizontal score bar used in compact lists. */
export function MatchBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-sunken", className)} aria-hidden>
      <motion.div
        className="h-full rounded-full bg-brand"
        initial={{ width: 0 }}
        whileInView={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: EASE }}
      />
    </div>
  );
}

/** Transparent factor-by-factor breakdown with status icons, points and the matcher's own detail text. */
export function FactorList({ factors, className, dense }: { factors: FactorResult[]; className?: string; dense?: boolean }) {
  const ordered = FACTOR_ORDER.map((k) => factors.find((f) => f.key === k)).filter(Boolean) as FactorResult[];
  return (
    <ul className={cn("divide-y divide-line", className)}>
      {ordered.map((f, i) => {
        const meta = FACTOR_STATUS_META[f.status];
        const Icon = meta.icon;
        return (
          <motion.li
            key={f.key}
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, ease: EASE, delay: i * 0.035 }}
            className={cn("flex items-start gap-3", dense ? "py-2" : "py-2.5")}
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", meta.cls)} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13.5px] font-semibold text-ink">{f.label}</p>
                <p className="shrink-0 text-xs tabular-nums text-muted">
                  <span className="sr-only">{meta.label}. </span>
                  {f.status === "neutral" ? "Not scored" : `${meta.label} · ${Math.round(f.score * f.weight)}/${f.weight}`}
                </p>
              </div>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">{f.detail}</p>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}

/* ─── Plain-English explanation built only from matched factors ────────────── */

function joinClauses(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function clauseFor(f: FactorResult, r: MatchResult, c: MatchCriteria): string | null {
  const t = r.tutor;
  switch (f.key) {
    case "subject":
      return c.subject ? `teaches ${subjectName(c.subject)}` : null;
    case "grade":
      return c.grade ? `works with ${LEVEL_LABEL[gradeToLevel(c.grade)].toLowerCase()} students` : null;
    case "schedule":
      return "is available on all of your preferred days";
    case "budget":
      return `charges ${formatCents(t.hourlyRateCents)}/hr, within your budget`;
    case "location":
      if (r.distanceMiles != null && c.modes?.includes("in_person") && t.modes.includes("in_person")) {
        return `can meet in person (about ${Math.max(1, Math.round(r.distanceMiles))} mi away)`;
      }
      return "teaches online";
    case "experience":
      return `has ${t.experienceYears} years of teaching experience`;
    case "language":
      return c.language ? `speaks ${c.language}` : null;
    case "support": {
      const hits = (c.learningSupport ?? []).filter((s) => t.learningSupport.includes(s));
      return hits.length ? `lists experience with ${joinClauses(hits)}` : null;
    }
  }
}

export function whyThisTutor(r: MatchResult, c: MatchCriteria): string {
  const clauses = FACTOR_ORDER.map((k) => r.factors.find((f) => f.key === k))
    .filter((f): f is FactorResult => !!f && f.status === "match")
    .map((f) => clauseFor(f, r, c))
    .filter((x): x is string => !!x);
  if (!clauses.length) return `None of your preferences are a full match for ${r.tutor.firstName} — check the breakdown to see what's close.`;
  return `${r.tutor.firstName} ${joinClauses(clauses)}.`;
}
