"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Plus, Search } from "lucide-react";
import type { Requirement } from "@/lib/types";
import { rankTutors } from "@/lib/matching";
import { formatCents } from "@/lib/format";
import { useTutors } from "@/lib/store/hooks";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { motion, EASE, EASE_EXPO } from "@/components/motion";
import { MatchBar } from "@/components/concierge/MatchVisuals";
import { criteriaFromRequirement } from "@/components/jobs/jobUtils";

function AnimatedCheck() {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.7, ease: EASE_EXPO }}
      className="relative mx-auto grid size-20 place-items-center"
      aria-hidden
    >
      <motion.span
        className="absolute inset-0 rounded-full bg-brand-soft"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: [0.8, 1.25, 1], opacity: [0, 0.9, 1] }}
        transition={{ duration: 0.9, ease: EASE }}
      />
      <svg viewBox="0 0 52 52" className="relative size-12">
        <motion.circle cx="26" cy="26" r="23" fill="none" strokeWidth="2.5" className="stroke-ink" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease: EASE }} />
        <motion.path
          d="M15 27 l7.5 7.5 L37 19"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-ink"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.45 }}
        />
      </svg>
    </motion.div>
  );
}

export function PublishSuccess({ req, outcome, onPostAnother }: { req: Requirement; outcome: "published" | "updated" | "saved"; onPostAnother: () => void }) {
  const tutors = useTutors();
  const top = React.useMemo(() => rankTutors(tutors, criteriaFromRequirement(req)).filter((r) => !r.disqualified).slice(0, 3), [tutors, req]);
  const tutorsHref = `/tutors?${new URLSearchParams({ subject: req.subject, grade: req.grade, sort: "match" }).toString()}`;
  const heading = outcome === "published" ? "Your requirement is live" : outcome === "updated" ? "Your changes are live" : "Your changes are saved";
  const body =
    outcome === "saved"
      ? "This requirement is still paused. Resume it from your dashboard when you're ready for applications."
      : `Tutors can now find “${req.title}” on the jobs board. We'll notify you as soon as someone applies.`;

  const fade = (delay: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, ease: EASE, delay } });

  return (
    <div className="container-page py-14 sm:py-20">
      <div className="mx-auto max-w-3xl text-center" role="status" aria-live="polite">
        <AnimatedCheck />
        <motion.h1 {...fade(0.35)} className="mt-7 font-heading text-[2.25rem] font-bold leading-[1.02] tracking-[-0.025em] text-ink sm:text-5xl">
          {heading}
        </motion.h1>
        <motion.p {...fade(0.45)} className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-ink-2 sm:text-[17px]">
          {body}
        </motion.p>
        <motion.div {...fade(0.55)} className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={`/dashboard/requirements/${req.id}`}>
              View requirement <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={tutorsHref}>
              <Search /> Browse matching tutors
            </Link>
          </Button>
        </motion.div>
        {outcome !== "saved" && (
          <motion.p {...fade(0.6)} className="mt-4">
            <Link href={`/tutor-jobs/${req.id}`} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
              See it on the jobs board <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          </motion.p>
        )}
      </div>

      {top.length > 0 && (
        <motion.section {...fade(0.7)} className="mx-auto mt-16 max-w-4xl" aria-labelledby="top-matches">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="top-matches" className="font-heading text-2xl font-bold tracking-[-0.025em] text-ink">Don&apos;t want to wait? Top matches right now</h2>
              <p className="mt-0.5 text-sm text-muted">Ranked on the same transparent factors tutors see on your requirement.</p>
            </div>
            <Link href={tutorsHref} className="text-[13.5px] font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">See all</Link>
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {top.map((r, i) => (
              <motion.li key={r.tutor.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: EASE, delay: 0.8 + i * 0.08 }}>
                <Link
                  href={`/tutors/${r.tutor.slug}`}
                  className="group block h-full rounded-2xl border border-line bg-surface p-4 transition-colors duration-200 hover:border-ink"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={`${r.tutor.firstName} ${r.tutor.lastName}`} src={r.tutor.photoUrl} tone={r.tutor.tone} size="md" verified={r.tutor.verification.identity === "verified"} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink group-hover:underline group-hover:underline-offset-4">
                        {r.tutor.firstName} {r.tutor.lastName}
                      </p>
                      <p className="truncate text-[12.5px] text-muted">{r.tutor.headline}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[13px]">
                    <span className="font-bold tabular-nums text-ink">{formatCents(r.tutor.hourlyRateCents)}/hr</span>
                    <span className="tabular-nums text-muted">{r.percent}% match</span>
                  </div>
                  <MatchBar value={r.percent} className="mt-2" />
                </Link>
              </motion.li>
            ))}
          </ul>
        </motion.section>
      )}

      <div className="mt-12 text-center">
        <Button variant="ghost" onClick={onPostAnother}>
          <Plus /> Post another requirement
        </Button>
      </div>
    </div>
  );
}
