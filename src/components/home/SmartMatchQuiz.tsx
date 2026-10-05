"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeCheck, Check, SearchX, Star } from "lucide-react";
import type { Grade, Level } from "@/lib/types";
import { LEVELS, SUBJECTS, SUBJECT_BY_SLUG, SUBJECT_CATEGORIES, subjectName } from "@/lib/data/catalog";
import { DEFAULT_WEIGHTS, rankTutors, type MatchResult } from "@/lib/matching";
import { useTutors } from "@/lib/store/hooks";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AnimatePresence, EASE, motion } from "@/components/motion";
import { CategoryIcon } from "@/components/content/icons";
import { OnlineNow, useOnlineNow } from "@/components/domain/TutorIntro";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Overlay";
import { SelectMenu, type SelectGroup } from "@/components/ui/SelectMenu";

/** The eight most-asked-for subjects; every other subject is one tap away in the list below them. */
export const QUIZ_SUBJECTS = SUBJECTS.filter((s) => s.popular).slice(0, 8);

const SUBJECT_GROUPS: SelectGroup[] = SUBJECT_CATEGORIES.map((c) => ({
  label: c.name,
  options: SUBJECTS.filter((s) => s.category === c.slug).map((s) => ({ value: s.slug, label: s.name })),
}));

/** The matcher scores a grade, so each level is represented by a grade in the middle of it. */
const LEVEL_GRADE: Record<Level, Grade> = { elementary: "3", middle: "7", high: "10", college: "college", adult: "adult" };
const LEVEL_HINT: Record<Level, string> = { elementary: "Ages 5–11", middle: "Ages 11–14", high: "Ages 14–18", college: "Undergraduate and graduate", adult: "Learning at any age" };

const RANK_LABEL = ["Best match", "Great fit", "Strong option"];
const STEPS = ["Subject", "Level", "Your matches"];

const slide = {
  enter: (d: number) => ({ x: d * 28, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d * -28, opacity: 0 }),
};

/**
 * Smart Match: two questions, then the three tutors who fit best.
 * The ranking is the same open, rules-based score used across the site (`@/lib/matching`) —
 * every reason shown on a card is a factor that tutor actually matched. Paid placement plays no part.
 */
export function SmartMatchQuiz({ open, onOpenChange, initialSubject }: { open: boolean; onOpenChange: (open: boolean) => void; initialSubject?: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        title="Smart Match"
        description="Two questions. Your three best-matched tutors."
        data-lenis-prevent
      >
        {/* Mounted only while open, so every visit starts from the first question. */}
        <QuizBody initialSubject={initialSubject} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function QuizBody({ initialSubject, onClose }: { initialSubject?: string; onClose: () => void }) {
  const tutors = useTutors();
  const startSubject = initialSubject && SUBJECT_BY_SLUG[initialSubject] ? initialSubject : null;
  const [subject, setSubject] = React.useState<string | null>(startSubject);
  const [level, setLevel] = React.useState<Level | null>(null);
  const [step, setStep] = React.useState(startSubject ? 1 : 0);
  const [dir, setDir] = React.useState(1);

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const matches = React.useMemo<MatchResult[]>(() => {
    if (!subject || !level) return [];
    return rankTutors(tutors, { subject, grade: LEVEL_GRADE[level] })
      .filter((m) => !m.disqualified)
      .slice(0, 3);
  }, [tutors, subject, level]);

  const allMatchesHref = subject && level ? `/concierge?${new URLSearchParams({ view: "results", from: "guided", subject, grade: LEVEL_GRADE[level] }).toString()}` : "/concierge";

  return (
    <div className="px-5 pb-6 pt-5 sm:px-6">
      <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Smart Match steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}>
            <div className="h-1 overflow-hidden rounded-full bg-sunken">
              <motion.div className="h-full rounded-full bg-brand" initial={false} animate={{ width: i <= step ? "100%" : "0%" }} transition={{ duration: 0.45, ease: EASE }} />
            </div>
            <span className={cn("mt-1.5 block text-[12px] font-medium transition-colors", i <= step ? "text-ink" : "text-muted")}>
              {i + 1}. {s}
            </span>
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div key={step} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.26, ease: EASE }}>
          {step === 0 && (
            <section aria-labelledby="quiz-q1">
              <h3 id="quiz-q1" className="font-heading text-[1.45rem] font-bold leading-tight tracking-[-0.03em] text-ink">
                What subject do you need help with?
              </h3>
              <p className="mt-1.5 text-[14.5px] text-muted">Pick one. You can change it later.</p>
              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {QUIZ_SUBJECTS.map((s) => (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => {
                      setSubject(s.slug);
                      go(1);
                    }}
                    className={cn(
                      "group flex flex-col items-start gap-3 rounded-2xl border p-3.5 text-left transition-[border-color,background-color,transform] active:scale-[0.98]",
                      subject === s.slug ? "border-brand bg-brand-50" : "border-line bg-surface hover:border-brand/50 hover:bg-brand-50",
                    )}
                  >
                    <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                      <CategoryIcon slug={s.category} className="size-5" />
                    </span>
                    <span className="text-[14.5px] font-semibold leading-tight text-ink">{s.name}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <SelectMenu
                  aria-label="Another subject"
                  value={subject && !QUIZ_SUBJECTS.some((s) => s.slug === subject) ? subject : ""}
                  onValueChange={(v) => {
                    if (!v) return;
                    setSubject(v);
                    go(1);
                  }}
                  groups={SUBJECT_GROUPS}
                  placeholder={`Another subject (${SUBJECTS.length} in total)`}
                  className="w-full"
                />
              </div>
            </section>
          )}

          {step === 1 && subject && (
            <section aria-labelledby="quiz-q2">
              <h3 id="quiz-q2" className="font-heading text-[1.45rem] font-bold leading-tight tracking-[-0.03em] text-ink">
                What is your level?
              </h3>
              <p className="mt-1.5 text-[14.5px] text-muted">
                For <span className="font-medium text-ink">{subjectName(subject)}</span>. Tutors say which levels they teach.
              </p>
              <div className="mt-5 grid gap-2">
                {LEVELS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => {
                      setLevel(l.value);
                      go(2);
                    }}
                    className={cn(
                      "group flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 text-left transition-[border-color,background-color]",
                      level === l.value ? "border-brand bg-brand-50" : "border-line bg-surface hover:border-brand/50 hover:bg-brand-50",
                    )}
                  >
                    <span>
                      <span className="block text-[15.5px] font-semibold text-ink">{l.label}</span>
                      <span className="block text-[13px] text-muted">{LEVEL_HINT[l.value]}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-subtle transition-[transform,color] group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
                  </button>
                ))}
              </div>
              <Button variant="ghost" className="-ml-2 mt-4" onClick={() => go(0)}>
                <ArrowLeft /> Change subject
              </Button>
            </section>
          )}

          {step === 2 && subject && level && (
            <section aria-labelledby="quiz-results">
              <h3 id="quiz-results" className="font-heading text-[1.45rem] font-bold leading-tight tracking-[-0.03em] text-ink" role="status">
                {matches.length ? `Your ${matches.length === 1 ? "best match" : `top ${matches.length} matches`}` : "No match yet"}
              </h3>
              <p className="mt-1.5 text-[14.5px] text-muted">
                {subjectName(subject)} · {LEVELS.find((l) => l.value === level)?.short}.{" "}
                {matches.length > 0 && `Ranked on ${Object.keys(DEFAULT_WEIGHTS).length} open factors — no tutor can pay to rank higher.`}
              </p>

              {matches.length ? (
                <ul className="mt-5 grid gap-3">
                  {matches.map((m, i) => (
                    <MatchCard key={m.tutor.id} match={m} rank={i} onNavigate={onClose} />
                  ))}
                </ul>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-line-strong px-5 py-9 text-center">
                  <SearchX className="mx-auto size-7 text-subtle" aria-hidden />
                  <p className="mt-3 text-[15.5px] font-semibold text-ink">No tutor lists {subjectName(subject)} for this level yet</p>
                  <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-muted">Post what you need and tutors who can help will apply to you. It takes about two minutes.</p>
                  <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                    <Button asChild variant="cta">
                      <Link href="/post-requirement" onClick={onClose}>
                        Post a requirement
                      </Link>
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href="/tutors" onClick={onClose}>
                        Browse all tutors
                      </Link>
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                <Button variant="ghost" className="-ml-2" onClick={() => go(1)}>
                  <ArrowLeft /> Change level
                </Button>
                {matches.length > 0 && (
                  <Link href={allMatchesHref} onClick={onClose} className="group inline-flex items-center gap-1.5 text-[14.5px] font-medium text-brand">
                    See every match and how it scored <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                )}
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function MatchCard({ match, rank, onNavigate }: { match: MatchResult; rank: number; onNavigate: () => void }) {
  const t = match.tutor;
  const online = useOnlineNow(t);
  const name = `${t.firstName} ${t.lastName}`;
  const reasons = match.factors.filter((f) => f.status === "match").slice(0, 3);
  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + rank * 0.1, duration: 0.45, ease: EASE }}
      className={cn("relative rounded-2xl border bg-surface p-4", rank === 0 ? "border-brand shadow-[0_0_0_1px_var(--color-brand),0_18px_36px_-24px_var(--color-brand-glow)]" : "border-line")}
    >
      <div className="flex items-start gap-3.5">
        <Avatar name={name} src={t.photoUrl} tone={t.tone} size="xl" square />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-semibold", rank === 0 ? "bg-cta text-on-cta" : "bg-sunken text-ink-2")}>{RANK_LABEL[rank]}</span>
            <span className="text-[12.5px] font-semibold tabular-nums text-brand">{match.percent}% match</span>
            {online && <OnlineNow short />}
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-[16.5px] font-bold tracking-[-0.02em] text-ink">
            <span className="truncate">{name}</span>
            {t.verification.identity === "verified" && <BadgeCheck className="size-[18px] shrink-0 fill-brand text-surface" aria-label="Identity verified" />}
          </p>
          <p className="line-clamp-1 text-[13.5px] text-ink-2">{t.headline}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13.5px] text-ink-2">
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 fill-star text-star" aria-hidden />
              {t.rating !== null ? (
                <>
                  <span className="font-semibold text-ink">{t.rating.toFixed(1)}</span> ({t.reviewCount})
                </>
              ) : (
                "New"
              )}
            </span>
            <span>{t.experienceYears} yrs experience</span>
            <span>
              <span className="font-semibold text-ink">{formatCents(t.hourlyRateCents)}</span>/hr
            </span>
          </p>
        </div>
      </div>
      {reasons.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
          {reasons.map((f) => (
            <li key={f.key} className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-success" strokeWidth={3} aria-hidden /> {f.detail}
            </li>
          ))}
        </ul>
      )}
      <Button asChild variant={rank === 0 ? "cta" : "secondary"} className="mt-3.5 w-full">
        <Link href={`/tutors/${t.slug}#book`} onClick={onNavigate}>
          View profile and book <ArrowRight />
        </Link>
      </Button>
    </motion.li>
  );
}
