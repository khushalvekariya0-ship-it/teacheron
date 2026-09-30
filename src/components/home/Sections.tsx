"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, BadgeCheck, BookOpen, Brain, Briefcase, Calculator, CalendarDays, Check, ChevronRight, Code, FlaskConical, Landmark,
  Languages as LanguagesIcon, Music, PenLine, Signal, Star, Target, Users, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, Stagger, StaggerItem, WordReveal, CountUp, Magnetic, gsap, useGSAP } from "@/components/motion";
import { prefersReducedMotion } from "@/components/motion/gsap";
import { Section, SectionHeading, ArrowLink } from "@/components/marketing/Section";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/Disclosure";
import { SUBJECTS, SUBJECT_BY_SLUG } from "@/lib/data/catalog";
import { METROS } from "@/lib/data/geo";
import { FAQS } from "@/lib/data/content";
import { TUTORS } from "@/lib/data/tutors";
import { DEFAULT_POLICY } from "@/lib/data/platform";
import { FACTOR_LABEL } from "@/lib/matching";
import { formatCents } from "@/lib/format";

/* ═══ 1 · Hero — the light brand block ═══════════════════════════════════════════ */

/** A lesson in progress: learner + tutor video tiles with two live widgets. Illustrative, not real people. */
function LessonScene({ className }: { className?: string }) {
  const root = React.useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.utils.toArray<HTMLElement>("[data-float]").forEach((el, i) => {
        gsap.to(el, { y: i % 2 ? 7 : -7, duration: 3 + i * 0.5, ease: "sine.inOut", repeat: -1, yoyo: true, delay: 1.2 + i * 0.2 });
      });
      gsap.fromTo("[data-goal-seg]", { scaleX: 0 }, { scaleX: 1, transformOrigin: "left", stagger: 0.08, duration: 0.5, ease: "power2.out", delay: 1.3 });
      gsap.fromTo("[data-week-bar]", { scaleX: 0 }, { scaleX: 1, transformOrigin: "left", stagger: 0.15, duration: 0.9, ease: "expo.out", delay: 1.5 });
    },
    { scope: root },
  );
  const pop = (delay: number) => ({ initial: { opacity: 0, scale: 0.92, y: 16 }, animate: { opacity: 1, scale: 1, y: 0 }, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const, delay } });

  return (
    <div ref={root} className={cn("relative mx-auto aspect-[10/9] w-full max-w-[560px]", className)} aria-hidden>
      {/* Learner tile */}
      <motion.div {...pop(0.35)} className="absolute left-0 top-[9%] h-[72%] w-[76%] overflow-hidden rounded-xl bg-surface ring-1 ring-line">
        <span className="absolute left-3 top-3 z-10 text-[12px] font-medium text-ink/60 sm:text-[13px]">Learner</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/illustrations/people/learner.svg" alt="" className="absolute bottom-0 left-1/2 h-[96%] -translate-x-1/2" />
      </motion.div>
      {/* Tutor tile */}
      <motion.div {...pop(0.5)} className="absolute right-0 top-0 h-[40%] w-[34%] overflow-hidden rounded-xl bg-sky-soft ring-4 ring-surface">
        <span className="absolute left-2.5 top-2 z-10 text-[11px] font-medium text-ink/60 sm:text-[12px]">Tutor</span>
        <Signal className="absolute right-2.5 top-2 z-10 size-3.5 text-ink/60" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/illustrations/people/tutor.svg" alt="" className="absolute bottom-0 left-1/2 h-[92%] -translate-x-1/2" />
      </motion.div>

      {/* Widget: goal progress */}
      <motion.div {...pop(0.8)} className="absolute bottom-[4%] left-[-2%] w-[44%] sm:left-[-4%]">
        <div data-float className="rounded-xl bg-surface p-3 shadow-[0_2px_0_rgb(18_17_23/0.08)] sm:p-4">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-ink sm:text-[14px]">
            <BookOpen className="size-3.5 sm:size-4" strokeWidth={2.4} /> Algebra goal
          </p>
          <p className="mt-2 font-heading text-[26px] font-extrabold leading-none tracking-[-0.04em] text-ink sm:text-[38px]">
            6<span className="text-[0.55em] text-muted">/8</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted sm:text-[12px]">topics mastered</p>
          <div className="mt-2.5 grid grid-cols-8 gap-1">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="h-2 overflow-hidden rounded-sm bg-sunken">
                {i < 6 && <span data-goal-seg className="block size-full bg-brand" />}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Widget: this week */}
      <motion.div {...pop(1)} className="absolute bottom-0 right-0 w-[52%]">
        <div data-float className="rounded-xl bg-surface p-3 shadow-[0_2px_0_rgb(18_17_23/0.08)] sm:p-4">
          <p className="text-[12px] font-bold text-ink sm:text-[14px]">This week</p>
          <div className="mt-2.5 space-y-2">
            {[
              { k: "Lessons", v: "2 of 2", w: 100, c: "bg-brand/25" },
              { k: "Homework", v: "3 of 4", w: 75, c: "bg-sunken" },
            ].map((r) => (
              <div key={r.k} className="flex items-center gap-2">
                <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-canvas sm:h-7">
                  <span data-week-bar className={cn("absolute inset-y-0 left-0 rounded-md", r.c)} style={{ width: `${r.w}%` }} />
                  <span className="relative flex h-full items-center px-2 text-[11px] font-semibold text-ink sm:text-[12px]">{r.k}</span>
                </div>
                <span className="w-12 text-right text-[11px] tabular text-muted sm:text-[12px]">{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Chip: verified */}
      <motion.div {...pop(1.2)} className="absolute left-[18%] top-0 hidden sm:block">
        <span data-float className="inline-flex items-center gap-1.5 rounded-lg bg-night px-2.5 py-1.5 text-[12px] font-semibold text-white">
          <BadgeCheck className="size-4 text-blue-300" /> ID verified tutor
        </span>
      </motion.div>
    </div>
  );
}

export function Hero() {
  const root = React.useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const items = gsap.utils.toArray<HTMLElement>("[data-hero-in]");
      if (prefersReducedMotion()) {
        gsap.set(items, { autoAlpha: 1 });
        return;
      }
      gsap.fromTo(items, { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: "expo.out", stagger: 0.08, delay: 0.3 });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative overflow-hidden bg-brand-soft">
      <div className="container-page grid items-center gap-10 pb-12 pt-8 sm:pb-16 sm:pt-12 lg:grid-cols-[1.15fr_1fr] lg:gap-10 lg:pb-24 lg:pt-16">
        <div className="text-center lg:text-left">
          <div data-hero-in data-reveal className="flex justify-center lg:justify-start">
            <Link href="/how-it-works" className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-[14px] font-semibold text-ink-2 transition-colors hover:border-line-strong hover:text-ink">
              <span className="rounded-full bg-brand px-2 py-0.5 text-[12px] font-semibold text-white">New</span>
              Transparent tutor matching
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <h1 className="mx-auto mt-6 max-w-[15ch] font-heading text-[2.8rem] font-extrabold leading-[0.98] tracking-[-0.035em] text-ink sm:text-[4rem] lg:mx-0 lg:mt-7 lg:max-w-none lg:text-[4.6rem]">
            <WordReveal as="span" text="Find the right tutor." className="block" delay={0.1} />
            <WordReveal as="span" text="Learn with confidence." className="block" delay={0.28} />
          </h1>
          <p data-hero-in data-reveal className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink/80 sm:text-xl lg:mx-0">
            Connect with qualified tutors for personalized online and in-person learning.
          </p>
          <div data-hero-in data-reveal className="mt-8 hidden flex-wrap items-center gap-x-6 gap-y-4 lg:flex">
            <Magnetic>
              <Button asChild size="lg" variant="brand" className="h-16 px-9 text-[17px]">
                <Link href="/tutors">
                  Find your tutor <ArrowRight />
                </Link>
              </Button>
            </Magnetic>
            <ArrowLink href="/concierge" className="text-[16px]">Help me find a tutor</ArrowLink>
          </div>
        </div>

        <div data-hero-in data-reveal>
          <LessonScene />
        </div>

        {/* Phones: the call to action sits under the scene, full width */}
        <div data-hero-in data-reveal className="flex flex-col items-center gap-5 lg:hidden">
          <Button asChild size="lg" variant="brand" className="h-16 w-full max-w-xl text-[17px]">
            <Link href="/tutors">
              Find your tutor <ArrowRight />
            </Link>
          </Button>
          <ArrowLink href="/concierge" className="text-[16px]">Help me find a tutor</ArrowLink>
        </div>
      </div>
    </section>
  );
}

const SUBJECT_ROWS = SUBJECTS.map((s) => ({ ...s, tutors: TUTORS.filter((t) => t.subjects.includes(s.slug)).length }))
  .filter((s) => s.tutors > 0)
  .sort((a, b) => b.tutors - a.tutors || a.name.localeCompare(b.name));

/* ═══ 2 · Facts row ════════════════════════════════════════════════════════════
   Only numbers that are true for the product itself — no invented volume stats. */

export function Facts() {
  const facts: { value: React.ReactNode; label: string }[] = [
    { value: <CountUp value={SUBJECT_ROWS.length} />, label: "Subjects taught" },
    { value: <CountUp value={Object.keys(FACTOR_LABEL).length} />, label: "Match factors, all shown" },
    { value: <CountUp value={4} />, label: "Verification checks" },
    { value: <CountUp value={METROS.length} />, label: "Metro areas in person" },
    { value: "$0", label: "To search and message" },
  ];
  return (
    <section className="border-b border-line bg-surface">
      <Stagger className="container-page grid grid-cols-2 gap-y-8 py-10 sm:grid-cols-3 lg:grid-cols-5 lg:py-12" stagger={0.06}>
        {facts.map((f, i) => (
          <StaggerItem key={f.label} className={cn("px-2 text-center lg:border-l lg:border-line", i === 0 && "lg:border-l-0", i === facts.length - 1 && "col-span-2 sm:col-span-1")}>
            <p className="font-heading text-[2rem] font-extrabold leading-none tracking-[-0.04em] text-ink sm:text-[2.4rem]">{f.value}</p>
            <p className="mt-2 text-[15px] text-muted">{f.label}</p>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

/* ═══ 3 · Subjects grid ═══════════════════════════════════════════════════════ */

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  math: Calculator, science: FlaskConical, english: PenLine, "test-prep": Target, languages: LanguagesIcon,
  "computer-science": Code, "social-studies": Landmark, arts: Music, "learning-support": Brain,
};
const CATEGORY_TINT: Record<string, string> = {
  math: "bg-brand-soft", science: "bg-teal-soft", english: "bg-violet-soft", "test-prep": "bg-yellow-soft", languages: "bg-sky-soft",
  "computer-science": "bg-peach-soft", "social-studies": "bg-brand-soft", arts: "bg-violet-soft", "learning-support": "bg-teal-soft",
};

export function SubjectGrid() {
  const [all, setAll] = React.useState(false);
  const shown = all ? SUBJECT_ROWS : SUBJECT_ROWS.slice(0, 9);
  return (
    <Section>
      <SectionHeading title="Find tutors by subject" description="From kindergarten reading to AP Calculus, SAT prep and Python." />
      <motion.ul layout className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence initial={false}>
          {shown.map((s, i) => {
            const Icon = CATEGORY_ICON[s.category] ?? BookOpen;
            return (
              <motion.li
                key={s.slug}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { delay: all ? Math.max(0, i - 9) * 0.025 : 0 } }}
                exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
              >
                <Link href={`/subjects/${s.slug}`} data-spotlight className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-4 transition-colors sm:p-5">
                  <span className={cn("grid size-12 shrink-0 place-items-center rounded-lg text-ink", CATEGORY_TINT[s.category] ?? "bg-canvas")}>
                    <Icon className="size-6" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-heading text-[18px] font-bold tracking-[-0.02em] text-ink">{s.name} tutors</span>
                    <span className="block text-[14px] text-muted">
                      {s.tutors} {s.tutors === 1 ? "tutor" : "tutors"}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-ink transition-transform group-hover:translate-x-1" />
                </Link>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>
      <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="text-[15px] font-semibold text-ink underline decoration-2 underline-offset-[6px] hover:underline-offset-4">
          {all ? "Show less" : `Show all ${SUBJECT_ROWS.length} subjects`}
        </button>
        <p className="text-[13px] text-muted">Counts are the sample tutors in this preview.</p>
      </div>
    </Section>
  );
}

/* ═══ 4 · How it works — three numbered cards ═════════════════════════════════ */

function StepFind() {
  const pair = TUTORS.filter((t) => t.featured && t.verification.identity === "verified").slice(0, 2);
  return (
    <div className="relative h-full">
      {pair.map((t, i) => (
        <div
          key={t.id}
          className={cn(
            "absolute inset-x-5 rounded-xl border border-line bg-surface p-3.5 transition-transform duration-500",
            i === 0 ? "top-5 -rotate-2 group-hover:-rotate-3" : "top-[4.9rem] rotate-1 shadow-md group-hover:rotate-2",
          )}
        >
          <div className="flex items-center gap-3">
            <Avatar name={`${t.firstName} ${t.lastName}`} tone={t.tone} size="lg" square />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-[14px] font-bold text-ink">
                {t.firstName} {t.lastName.charAt(0)}. <BadgeCheck className="size-4 shrink-0 fill-ink text-surface" />
              </p>
              <p className="truncate text-[12.5px] text-muted">{SUBJECT_BY_SLUG[t.subjects[0]]?.name} tutor</p>
            </div>
            <div className="text-right">
              <p className="text-[14px] font-bold text-ink">{formatCents(t.hourlyRateCents)}</p>
              {t.rating !== null && (
                <p className="flex items-center justify-end gap-0.5 text-[12px] text-ink">
                  <Star className="size-3 fill-ink" /> {t.rating.toFixed(1)}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StepBook() {
  const slots = ["4:00 PM", "4:30 PM", "5:00 PM", "6:00 PM", "6:30 PM", "7:00 PM"];
  return (
    <div className="absolute inset-x-5 top-5 rounded-xl border border-line bg-surface p-3.5">
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="font-bold text-ink">Thu, Oct 2</span>
        <span className="text-muted">Your time zone</span>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        {slots.map((s, i) => (
          <span key={s} className={cn("rounded-md border py-1.5 text-center text-[12px] font-semibold transition-colors", i === 4 ? "border-ink bg-ink text-on-ink" : "border-line text-ink group-hover:border-line-strong")}>
            {s}
          </span>
        ))}
      </div>
      <p className="mt-2.5 rounded-md bg-brand-soft px-2.5 py-1.5 text-[12px] font-medium text-ink">Trial lesson · 30 min</p>
    </div>
  );
}

function StepProgress() {
  const weeks = [30, 42, 38, 55, 61, 72, 80];
  return (
    <div className="absolute inset-x-5 top-5 rounded-xl border border-line bg-surface p-3.5">
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="font-bold text-ink">Goal progress</span>
        <span className="font-bold text-ink">80%</span>
      </div>
      <div className="mt-3 flex h-[5.5rem] items-end gap-1.5">
        {weeks.map((h, i) => (
          <span key={i} className={cn("flex-1 origin-bottom rounded-t-md transition-transform duration-500 group-hover:scale-y-105", i === weeks.length - 1 ? "bg-brand" : "bg-brand/15")} style={{ height: `${h}%` }} />
        ))}
      </div>
      <p className="mt-2 text-[12px] text-muted">Weekly notes, homework and topics mastered</p>
    </div>
  );
}

const STEPS = [
  { title: "Find your tutor", body: "Search by subject, grade, schedule, budget and ZIP. Every match shows why it fits — never paid placement.", tint: "bg-brand-soft", Visual: StepFind },
  { title: "Book a trial lesson", body: "Pick a real opening in your time zone. Many tutors offer a free or low-cost trial so you can check the fit.", tint: "bg-yellow-soft", Visual: StepBook },
  { title: "Make progress every week", body: "Lesson notes, homework and goals in one place — and parents see it all for their kids.", tint: "bg-sky-soft", Visual: StepProgress },
];

export function HowItWorks() {
  return (
    <Section tone="canvas">
      <SectionHeading title="How TutorLink works:" action={<ArrowLink href="/how-it-works">See the details</ArrowLink>} />
      <Stagger className="grid gap-4 lg:grid-cols-3" stagger={0.1}>
        {STEPS.map((s, i) => (
          <StaggerItem key={s.title}>
            <article className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-ink sm:p-6">
              <span className="grid size-10 place-items-center rounded-lg bg-ink font-heading text-lg font-extrabold text-on-ink">{i + 1}</span>
              <h3 className="mt-5 font-heading text-[26px] font-extrabold leading-tight tracking-[-0.035em] text-ink">{s.title}</h3>
              <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{s.body}</p>
              <div className={cn("relative mt-6 h-52 overflow-hidden rounded-xl", s.tint)} aria-hidden>
                <s.Visual />
              </div>
            </article>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}

/* ═══ 5 · Trial promise ═══════════════════════════════════════════════════════ */

export function TrialPromise() {
  return (
    <Section tone="brand">
      <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
        <div>
          <WordReveal as="h2" inView text="Try a lesson before you commit." className="font-heading text-[2.6rem] font-extrabold leading-[0.98] tracking-[-0.04em] text-ink sm:text-6xl lg:text-[4.2rem]" />
          <Reveal delay={0.15}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
              Many tutors offer a free or low-cost trial. The cancellation window is always shown before you pay — by default, trials can be cancelled free up to{" "}
              {DEFAULT_POLICY.trialFreeCancellationHours} hours before they start, and regular lessons up to {DEFAULT_POLICY.freeCancellationHours} hours before.
            </p>
          </Reveal>
          <Reveal delay={0.25} className="mt-8">
            <Button asChild size="lg">
              <Link href="/tutors?trial=1">
                Find tutors with a free trial <ArrowRight />
              </Link>
            </Button>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <div className="relative mx-auto max-w-md">
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-lg sm:p-6">
              <div className="flex items-center gap-3">
                <Avatar name="Hannah Weiss" size="xl" square />
                <div>
                  <p className="font-heading text-[19px] font-bold tracking-[-0.02em] text-ink">Trial lesson</p>
                  <p className="text-[14px] text-muted">30 min · Online</p>
                </div>
                <span className="ml-auto rounded-md bg-brand px-2.5 py-1 text-[13px] font-bold text-white">Free</span>
              </div>
              <ul className="mt-5 space-y-2.5 text-[15px] text-ink">
                {["Meet the tutor and share your goals", "Get a short diagnostic and a plan", "Decide with no obligation to continue"].map((x) => (
                  <li key={x} className="flex gap-2.5">
                    <Check className="mt-0.5 size-5 shrink-0" strokeWidth={2.6} /> {x}
                  </li>
                ))}
              </ul>
              <span className="mt-6 flex h-12 items-center justify-center rounded-lg border-2 border-brand bg-brand text-[15px] font-semibold text-white">Book trial lesson</span>
            </div>
            <span className="absolute -right-2 -top-3.5 rounded-full bg-ink px-3 py-1.5 text-[13px] font-semibold text-on-ink sm:-right-4">Free to message tutors</span>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

/* ═══ 6 · Become a tutor ══════════════════════════════════════════════════════ */

export function BecomeTutor() {
  const perks = [
    { icon: Briefcase, title: "Find new students", body: "Browse requirements families post and apply with a personal note." },
    { icon: CalendarDays, title: "Grow on your schedule", body: "Weekly availability, buffers, minimum notice and optional instant booking." },
    { icon: Wallet, title: "Get paid securely", body: "Payments through Stripe with payouts to your bank on a clear schedule." },
  ];
  return (
    <Section>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <Reveal className="order-2 lg:order-1">
          <div className="relative mx-auto aspect-[1/1] max-w-[520px] overflow-hidden rounded-2xl bg-brand-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/illustrations/people/tutor-wave.svg" alt="" aria-hidden className="absolute bottom-0 left-1/2 h-[80%] -translate-x-1/2" />
            <div className="absolute left-4 top-4 rounded-xl bg-surface p-3.5 sm:left-6 sm:top-6" aria-hidden>
              <p className="text-[12px] text-muted">New student request</p>
              <p className="mt-0.5 text-[14px] font-bold text-ink">Algebra · 8th grade</p>
            </div>
            <div className="absolute bottom-4 right-4 rounded-xl bg-surface p-3.5 sm:bottom-6 sm:right-6" aria-hidden>
              <p className="text-[12px] text-muted">Next payout</p>
              <p className="mt-0.5 text-[14px] font-bold text-ink">Friday · via Stripe</p>
            </div>
          </div>
        </Reveal>
        <div className="order-1 lg:order-2">
          <WordReveal as="h2" inView text="Become a tutor" className="font-heading text-[2.6rem] font-extrabold leading-[0.98] tracking-[-0.04em] text-ink sm:text-6xl" />
          <Reveal delay={0.1}>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-2">
              Earn money sharing what you know with students across the U.S. Teach online, in person, or both — at the rate you set.
            </p>
          </Reveal>
          <Stagger className="mt-8 space-y-5" stagger={0.08}>
            {perks.map((p) => (
              <StaggerItem key={p.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink text-on-ink">
                  <p.icon className="size-5" />
                </span>
                <span>
                  <span className="block text-[17px] font-bold text-ink">{p.title}</span>
                  <span className="mt-0.5 block text-[15px] leading-relaxed text-ink-2">{p.body}</span>
                </span>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal delay={0.2} className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button asChild size="lg">
              <Link href="/become-a-tutor">
                Become a tutor <ArrowRight />
              </Link>
            </Button>
            <ArrowLink href="/how-it-works">How our platform works</ArrowLink>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

/* ═══ 7 · Family banner ═══════════════════════════════════════════════════════ */

export function FamilyBanner() {
  const kids = [
    { name: "Noah", note: "Pre-algebra · 7th grade", tint: "bg-yellow-soft" },
    { name: "Ava", note: "Spanish · 4th grade", tint: "bg-teal-soft" },
  ];
  return (
    <section className="bg-surface">
      <div className="container-page pb-16 sm:pb-20 lg:pb-24">
        <div className="grid items-center gap-10 overflow-hidden rounded-2xl bg-sky-soft p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:gap-12 lg:p-14">
          <Reveal className="relative mx-auto w-full max-w-sm">
            <div className="relative mx-auto size-56 overflow-hidden rounded-full bg-surface sm:size-64">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/illustrations/people/parent.svg" alt="" aria-hidden className="absolute bottom-0 left-1/2 h-[92%] -translate-x-1/2" />
            </div>
            <div className="absolute -bottom-2 left-0 space-y-2 sm:-left-4" aria-hidden>
              {kids.map((k) => (
                <div key={k.name} className="flex items-center gap-2.5 rounded-xl bg-surface p-2.5 pr-4">
                  <span className={cn("grid size-9 place-items-center rounded-lg font-bold text-ink", k.tint)}>{k.name.charAt(0)}</span>
                  <span>
                    <span className="block text-[13.5px] font-bold text-ink">{k.name}</span>
                    <span className="block text-[12px] text-muted">{k.note}</span>
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
          <div>
            <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Users className="size-5" /> For parents
            </p>
            <WordReveal as="h2" inView text="One account for the whole family" className="mt-3 font-heading text-[2.2rem] font-extrabold leading-[1] tracking-[-0.035em] text-ink sm:text-5xl" />
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-ink-2">
                Add a profile for each child, book and pay for lessons, and see attendance, homework and progress notes in one place. Messages about your child are always visible to you.
              </p>
            </Reveal>
            <Reveal delay={0.2} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Button asChild size="lg">
                <Link href="/register">
                  Create a family account <ArrowRight />
                </Link>
              </Button>
              <ArrowLink href="/for-parents">Learn more</ArrowLink>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══ 8 · FAQ ═════════════════════════════════════════════════════════════════ */

export function HomeFaq() {
  const faqs = FAQS.filter((f) => f.audience !== "tutors").slice(0, 7);
  return (
    <Section tone="canvas">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading className="mb-6" title="Questions? We've got answers." />
          <Reveal delay={0.1} className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button asChild variant="secondary">
              <Link href="/faq">All FAQs</Link>
            </Button>
            <ArrowLink href="/contact">Contact support</ArrowLink>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <Accordion type="single" collapsible className="border-t-2 border-ink">
            {faqs.map((f, k) => (
              <AccordionItem key={f.q} value={`f${k}`} className="border-b border-line">
                <AccordionTrigger className="py-5 text-left font-heading text-[18px] font-bold tracking-[-0.02em] sm:text-[20px]">{f.q}</AccordionTrigger>
                <AccordionContent className="text-[16px] leading-relaxed text-ink-2">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </Section>
  );
}
