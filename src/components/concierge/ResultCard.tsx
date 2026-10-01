"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronDown, GitCompareArrows, MapPin, MessageSquare, Sparkles } from "lucide-react";
import type { MatchCriteria, MatchResult } from "@/lib/matching";
import { formatCents } from "@/lib/format";
import { useFlag } from "@/lib/store/hooks";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StarRating } from "@/components/ui/StarRating";
import { VerifiedBadge } from "@/components/domain/Badges";
import { useTutorActions } from "@/components/domain/useTutorActions";
import { AnimatePresence, motion } from "@/components/motion";
import { cn } from "@/lib/utils";
import { FactorList, MatchRing, whyThisTutor } from "./MatchVisuals";

export function ResultCard({ result, rank, criteria }: { result: MatchResult; rank: number; criteria: MatchCriteria }) {
  const t = result.tutor;
  const actions = useTutorActions(t);
  const trialsOn = useFlag("trial_lessons");
  const [open, setOpen] = React.useState(rank === 1);
  const name = `${t.firstName} ${t.lastName}`;
  const breakdownId = `breakdown-${t.id}`;
  const modes = t.modes.includes("online") && t.modes.includes("in_person") ? "Online & in person" : t.modes.includes("online") ? "Online" : "In person";
  const offersTrial = trialsOn && t.trial.enabled;

  return (
    <article className={cn("overflow-hidden rounded-2xl border bg-surface transition-colors duration-200 hover:border-ink", rank === 1 ? "border-ink" : "border-line")} aria-label={`Match ${rank}: ${name}, ${result.percent}% match`}>
      <div className="flex gap-4 p-5 sm:gap-5 sm:p-6">
        <div className="flex flex-col items-center gap-2">
          <span className={cn("grid size-7 place-items-center rounded-md text-[12.5px] font-bold tabular-nums", rank === 1 ? "bg-brand text-white" : "bg-canvas text-ink-2")} aria-hidden>
            {rank}
          </span>
          <Avatar name={name} tone={t.tone} size="lg" verified={t.verification.identity === "verified"} className="hidden sm:inline-flex" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-[19px] font-bold tracking-[-0.02em] text-ink">
              <Link href={`/tutors/${t.slug}`} className="rounded-sm hover:underline hover:decoration-2 hover:underline-offset-4">
                {name}
              </Link>
            </h3>
            {rank === 1 && (
              <Badge tone="solid" size="sm">
                <Sparkles aria-hidden /> Best match
              </Badge>
            )}
            <VerifiedBadge tutor={t} size="sm" />
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm text-ink-2">{t.headline}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-muted">
            <StarRating rating={t.rating} count={t.reviewCount} showStars={false} />
            <span className="font-bold tabular-nums text-ink">{formatCents(t.hourlyRateCents)}/hr</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5 text-subtle" aria-hidden />
              {t.city}, {t.state}
              {result.distanceMiles != null && t.modes.includes("in_person") && <span className="text-subtle">· {Math.max(1, Math.round(result.distanceMiles))} mi</span>}
            </span>
            <span>{modes}</span>
          </div>
        </div>
        <MatchRing value={result.percent} size={68} className="hidden sm:block" />
        <div className="shrink-0 text-right sm:hidden">
          <p className="font-heading text-xl font-bold tabular-nums tracking-[-0.03em] text-ink">{result.percent}%</p>
          <p className="text-[11px] text-muted">match</p>
        </div>
      </div>

      <div className="px-5 sm:px-6">
        <p className="rounded-xl bg-canvas px-4 py-3 text-sm leading-relaxed text-ink-2">
          <span className="font-semibold text-ink">Why this tutor matches: </span>
          {whyThisTutor(result, criteria)}
        </p>
      </div>

      <div className="px-5 pt-3 sm:px-6">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={breakdownId}
          className="group inline-flex h-10 items-center gap-1.5 text-[13.5px] font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2"
        >
          {open ? "Hide score breakdown" : "Show score breakdown"}
          <ChevronDown className={cn("size-4 transition-transform duration-300", open && "rotate-180")} aria-hidden />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={breakdownId}
              key="breakdown"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="overflow-hidden"
            >
              <FactorList factors={result.factors} className="pb-2 sm:grid sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0 [&>li]:border-line sm:[&>li]:border-b" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line bg-canvas px-5 py-4 sm:px-6">
        <Button asChild size="sm" variant="secondary">
          <Link href={`/tutors/${t.slug}`}>View profile</Link>
        </Button>
        <Button
          size="sm"
          variant={actions.comparing ? "subtle" : "ghost"}
          onClick={actions.toggleCompare}
          aria-pressed={actions.comparing}
          disabled={actions.compareFull}
          title={actions.compareFull ? "You can compare up to 3 tutors" : undefined}
        >
          {actions.comparing ? <Check /> : <GitCompareArrows />} {actions.comparing ? "Comparing" : "Compare"}
        </Button>
        <Button size="sm" variant="ghost" onClick={actions.contact}>
          <MessageSquare /> Message
        </Button>
        <Button size="sm" variant="brand" className="ml-auto" onClick={offersTrial ? actions.bookTrial : actions.book}>
          {offersTrial ? (t.trial.priceCents === 0 ? "Book free trial" : `Book trial · ${formatCents(t.trial.priceCents)}`) : "Book a lesson"}
        </Button>
      </div>
    </article>
  );
}
