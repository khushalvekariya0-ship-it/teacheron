"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Briefcase,
  Calculator,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronRight,
  Code,
  CreditCard,
  FlaskConical,
  Gift,
  GraduationCap,
  Info,
  Languages,
  Music,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  UserRound,
  Video,
  Zap,
  Lock,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Reveal,
  Stagger,
  StaggerItem,
  WordReveal,
  gsap,
  useGSAP,
} from "@/components/motion";
import { prefersReducedMotion } from "@/components/motion/gsap";
import {
  Section,
  SectionHeading,
  ArrowLink,
  CtaBand,
  Eyebrow,
} from "@/components/marketing/Section";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/Logo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/Disclosure";
import { TutorCard } from "@/components/domain/TutorCard";
import { Avatar } from "@/components/ui/Avatar";
import {
  SelectMenu,
  type SelectGroup,
  type SelectOption,
} from "@/components/ui/SelectMenu";
import { CategoryIcon } from "@/components/content/icons";
import { QuickMatch } from "./QuickMatch";
import { QUIZ_SUBJECTS, SmartMatchQuiz } from "./SmartMatchQuiz";
import { GRADES, SUBJECTS, SUBJECT_BY_SLUG, SUBJECT_CATEGORIES } from "@/lib/data/catalog";
import { FAQS, SAMPLE_TESTIMONIALS } from "@/lib/data/content";
import { DEFAULT_POLICY } from "@/lib/data/platform";
import { DEFAULT_WEIGHTS } from "@/lib/matching";
import { useTutors } from "@/lib/store/hooks";

/* ═══ 1 · Hero — what TutorLink is and the first Smart Match question, on a blackboard ═══ */

/** Film grain, as a tiny tiled SVG. */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='180' height='180' filter='url(%23n)'/></svg>\")";

/** Search → Book → Learn: what a visitor does on TutorLink, in order. Each step gets its own soft colour. */
const HERO_STEPS = [
  {
    icon: Search,
    title: "Search",
    body: "Answer two questions and Smart Match shows your three best-fit tutors. Or browse everyone — searching is free.",
  },
  {
    icon: CalendarDays,
    title: "Book",
    body: "Pick a day and time on the tutor's calendar and see the total straight away. Pay by card, UPI or Study Credits.",
  },
  {
    icon: Video,
    title: "Learn",
    body: "Meet in the built-in classroom: video, a shared whiteboard and chat on one screen. Nothing to install.",
  },
];

/*
 * The first screen: one photograph — two people working through formulas on a blackboard — across the
 * whole width, slowly drifting, with the page colour fading in over its left half so the words
 * sit on something calm. Film grain ties the two together.
 */
export function Hero() {
  const root = React.useRef<HTMLElement>(null);
  const [quiz, setQuiz] = React.useState<{ open: boolean; subject?: string }>({ open: false });
  useGSAP(
    () => {
      const items = gsap.utils.toArray<HTMLElement>("[data-hero-in]");
      if (prefersReducedMotion()) {
        gsap.set([...items, ...gsap.utils.toArray<HTMLElement>("[data-hero-photo]")], { autoAlpha: 1 });
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.fromTo("[data-hero-photo]", { autoAlpha: 0, scale: 1.06 }, { autoAlpha: 1, scale: 1, duration: 1.8 }, 0.1).fromTo(
        items,
        { y: 18, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.07 },
        0.5,
      );
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative isolate overflow-clip border-b border-line bg-night">
      {/* The photograph, with a very slow drift so it feels alive */}
      <div data-hero-photo data-reveal className="absolute inset-0 -z-20" aria-hidden>
        <Image src="/images/hero-blackboard-2.jpg" alt="" fill preload sizes="100vw" className="object-cover object-[64%_20%] [animation:hero-drift_40s_ease-in-out_infinite_alternate]" />
      </div>
      {/* Page colour over the words' half, a fade along the bottom, and grain over everything */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-page via-page/70 to-page/20 lg:bg-gradient-to-r lg:from-page lg:via-page/88 lg:to-page/10" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-page to-transparent" aria-hidden />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.12] mix-blend-overlay" style={{ backgroundImage: GRAIN }} aria-hidden />

      <div className="container-page grid min-h-[calc(100dvh-4rem)] items-center py-20 lg:min-h-[46rem] lg:grid-cols-12 lg:py-24">
        {/* On wide screens the words take the left half; the teachers stay in view on the right. */}
        <div className="lg:col-span-7">
          <p data-hero-in data-reveal className="kicker">
            Tutoring marketplace · online &amp; in person
          </p>

          <h1 data-hero-in data-reveal className="mt-7 max-w-[13ch] font-heading text-[3.3rem] leading-[0.98] text-ink sm:text-[4.4rem] lg:text-[4.6rem] xl:text-[5.4rem]">
            Learn with the right tutor. Grow with every <em>lesson.</em>
          </h1>

          <p data-hero-in data-reveal className="mt-7 max-w-xl text-[17px] leading-relaxed text-ink-2 sm:text-[18px]">
            Private tutors for school subjects, test prep, languages and more. Answer two questions, meet your three best matches and book a lesson in a few taps.
          </p>

          {/* Smart Match starts here: the first question sits in the hero, the second opens in a popup. */}
          <div data-hero-in data-reveal className="mt-9 max-w-2xl border border-line bg-surface/90 backdrop-blur">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
              <h3 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em] text-ink sm:text-[16px]">
                <Sparkles className="size-4 text-brand" aria-hidden />
                What subject do you need help with?
              </h3>
              <span className="mono-label hidden sm:block">Smart Match · 1 of 2</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4">
              {QUIZ_SUBJECTS.map((s) => (
                <button key={s.slug} type="button" onClick={() => setQuiz({ open: true, subject: s.slug })} className="group flex items-center gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-sunken">
                  <CategoryIcon slug={s.category} className="size-4 shrink-0 text-brand" />
                  <span className="min-w-0 truncate text-[14px] font-medium text-ink">{s.name}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-col items-stretch gap-3 border-t border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <Button variant="cta" size="lg" className="group" onClick={() => setQuiz({ open: true })}>
                Find my tutor <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Button>
              <ArrowLink href="/tutors" className="justify-center">
                Or browse every tutor
              </ArrowLink>
            </div>
          </div>
          <SmartMatchQuiz open={quiz.open} onOpenChange={(open) => setQuiz((q) => ({ ...q, open }))} initialSubject={quiz.subject} />
        </div>
      </div>
    </section>
  );
}

/* ═══ 1b · Statement — what the product is for, in one breath ═══════════════════════════ */

export function Statement() {
  return (
    <section className="border-b border-line bg-canvas">
      <div className="container-page flex flex-col items-center py-20 text-center sm:py-28">
        <Reveal>
          <LogoMark className="size-7" />
        </Reveal>
        <WordReveal
          as="h2"
          inView
          accent={1}
          text="Finding a tutor shouldn't take an evening. Two questions, three matches, one tap to book."
          className="mt-8 max-w-4xl font-heading text-[2.4rem] leading-[1.05] text-ink sm:text-[3.4rem] lg:text-[4rem]"
        />
        <Reveal delay={0.15}>
          <p className="mono-label mt-8 text-brand">
            No subscription · No booking fee · Free cancellation up to{" "}
            {DEFAULT_POLICY.freeCancellationHours}h before
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══ 1c · Three steps — search, book, learn, numbered like a contents page ═══════════════ */

export function ThreeSteps() {
  return (
    <section className="border-b border-line bg-page">
      <div className="container-page grid gap-10 py-16 sm:py-24 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Eyebrow>How TutorLink works</Eyebrow>
          <h2 className="mt-6 font-heading text-[2.4rem] leading-[1.02] text-ink sm:text-[3rem] lg:text-[3.4rem]">
            Search, book, learn. Three steps to your <em>first lesson.</em>
          </h2>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-ink-2">
            Everything happens here: the search, the calendar, the payment and
            the lesson itself. Nothing to install, no meeting links to chase.
          </p>
          <ArrowLink href="/how-it-works" className="mt-7">
            See every step
          </ArrowLink>
        </div>
        <ol className="border-t border-line">
          {HERO_STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.08}>
              <li className="grid grid-cols-[4.5rem_1fr] gap-x-5 border-b border-line py-8 sm:grid-cols-[6.5rem_1fr] sm:py-10">
                <span className="font-heading text-[3rem] leading-none text-ink sm:text-[4rem]">
                  0{i + 1}.
                </span>
                <div className="pt-1">
                  <h3 className="flex items-center gap-2.5 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-ink">
                    <step.icon className="size-4 text-brand" aria-hidden />{" "}
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-lg text-[16.5px] leading-relaxed text-ink-2">
                    {step.body}
                  </p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ═══ 3 · Subjects — search, then an explorer: pick an area, see its topics ══════════════ */

/** The eight most-asked-for areas, most popular first. Labels are the short names people search for. */
const SUBJECT_AREAS: {
  slug: string;
  label: string;
  icon: LucideIcon;
  body: string;
}[] = [
  {
    slug: "math",
    label: "Mathematics",
    icon: Calculator,
    body: "From number sense and fractions to algebra, calculus and statistics — help with homework, tests and getting ahead.",
  },
  {
    slug: "science",
    label: "Science",
    icon: FlaskConical,
    body: "Biology, chemistry, physics and earth science, with labs, problem sets and AP courses explained step by step.",
  },
  {
    slug: "english",
    label: "English",
    icon: BookOpen,
    body: "Reading, writing, grammar and literature — from early readers to confident essay writers.",
  },
  {
    slug: "test-prep",
    label: "Test Prep",
    icon: Target,
    body: "Structured plans for the SAT, ACT, AP exams and graduate admissions tests, with practice tests reviewed together.",
  },
  {
    slug: "languages",
    label: "Languages",
    icon: Languages,
    body: "Conversation-first lessons in Spanish, French, Mandarin and English as a second language.",
  },
  {
    slug: "computer-science",
    label: "Coding",
    icon: Code,
    body: "Python, Java and web development — from first lines of code to AP Computer Science.",
  },
  {
    slug: "arts",
    label: "Music & Arts",
    icon: Music,
    body: "Piano, guitar, voice and drawing for beginners and experienced learners alike.",
  },
  {
    slug: "learning-support",
    label: "Study Skills",
    icon: Brain,
    body: "Study habits, executive function and dyslexia support — patient, specialised help that builds independence.",
  },
];

function SubjectExplorer() {
  const tutors = useTutors();
  const [active, setActive] = React.useState(SUBJECT_AREAS[0].slug);

  // Real counts only: tutors per subject and per area.
  const counts = React.useMemo(() => {
    const bySubject: Record<string, number> = {};
    for (const t of tutors)
      for (const s of t.subjects) bySubject[s] = (bySubject[s] ?? 0) + 1;
    const byArea: Record<string, number> = {};
    for (const a of SUBJECT_AREAS) {
      const subs = new Set(
        SUBJECTS.filter((s) => s.category === a.slug).map((s) => s.slug),
      );
      byArea[a.slug] = tutors.filter((t) =>
        t.subjects.some((s) => subs.has(s)),
      ).length;
    }
    return { bySubject, byArea };
  }, [tutors]);

  const area = SUBJECT_AREAS.find((a) => a.slug === active) ?? SUBJECT_AREAS[0];
  const topics = SUBJECTS.filter((s) => s.category === area.slug);
  const areaTutors = counts.byArea[area.slug] ?? 0;
  const summary = (slug: string) => {
    const n = counts.byArea[slug] ?? 0;
    const k = SUBJECTS.filter((s) => s.category === slug).length;
    return n > 0 ? `${n} ${n === 1 ? "tutor" : "tutors"}` : `${k} subjects`;
  };

  return (
    <TabsPrimitive.Root
      value={active}
      onValueChange={setActive}
      orientation="vertical"
      className="grid overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-32px_rgb(15_23_42/0.35)] lg:grid-cols-[290px_minmax(0,1fr)]"
    >
      <TabsPrimitive.List
        aria-label="Subject areas"
        className="scrollbar-none flex gap-1 overflow-x-auto border-b border-line p-2 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:p-3"
      >
        {SUBJECT_AREAS.map((a) => {
          const on = a.slug === active;
          return (
            <TabsPrimitive.Trigger
              key={a.slug}
              value={a.slug}
              onMouseEnter={() => setActive(a.slug)}
              className={cn(
                "group relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 lg:py-3",
                on ? "bg-brand-soft" : "hover:bg-canvas",
              )}
            >
              {on && (
                <motion.span
                  layoutId="explorer-bar"
                  className="absolute inset-y-2 left-0 hidden w-[3px] rounded-full bg-brand-gradient lg:block"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-lg border transition-colors",
                  on
                    ? "border-transparent bg-brand-gradient text-on-brand"
                    : "border-line text-ink-2 group-hover:text-ink",
                )}
              >
                <a.icon className="size-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block whitespace-nowrap text-[15px] font-semibold",
                    on ? "text-ink" : "text-ink-2",
                  )}
                >
                  {a.label}
                </span>
                <span className="hidden text-[12.5px] tabular-nums text-muted lg:block">
                  {summary(a.slug)}
                </span>
              </span>
              <ChevronRight
                className={cn(
                  "hidden size-4 shrink-0 transition-[opacity,transform] lg:block",
                  on
                    ? "translate-x-0 text-brand opacity-100"
                    : "-translate-x-1 text-muted opacity-0",
                )}
                aria-hidden
              />
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>

      <TabsPrimitive.Content
        value={area.slug}
        forceMount
        className="outline-none"
      >
        {/* Keyed so each area fades in fresh; no exit animation, so the panel is never empty. */}
        <motion.div
          key={area.slug}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-8 p-5 sm:p-7 lg:min-h-[460px] lg:grid-cols-[minmax(0,1fr)_260px] lg:p-8 xl:grid-cols-[minmax(0,1fr)_300px]"
        >
          {/* Phones and tablets: a short photo strip */}
          <div className="relative aspect-[16/7] overflow-hidden rounded-xl bg-canvas lg:hidden">
            <Image
              src={`/images/subject-areas/${area.slug}.jpg`}
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
            />
          </div>

          <div className="flex flex-col">
            <p className="kicker">
              <span className="kicker-dot" aria-hidden />
              {topics.length} subjects
              {areaTutors > 0 &&
                ` · ${areaTutors} ${areaTutors === 1 ? "tutor" : "tutors"}`}
            </p>
            <h3 className="mt-3 font-heading text-[28px] font-bold leading-tight tracking-[-0.025em] text-ink sm:text-[34px]">
              {area.label}
            </h3>
            <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-ink-2">
              {area.body}
            </p>

            <p className="mt-7 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-muted">
              Choose a topic
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {topics.map((s) => {
                const n = counts.bySubject[s.slug] ?? 0;
                return (
                  <li key={s.slug}>
                    <Link
                      href={`/tutors?subject=${s.slug}`}
                      className="group inline-flex items-center gap-2 rounded-full border border-line bg-page px-3.5 py-1.5 text-[14.5px] font-medium text-ink transition-colors hover:border-brand/40 hover:bg-brand-50 hover:text-brand"
                    >
                      {s.name}
                      {n > 0 && (
                        <span className="rounded-full bg-sunken px-1.5 text-[12px] tabular-nums text-muted">
                          {n}
                        </span>
                      )}
                      <ArrowRight
                        className="size-3.5 -translate-x-1 opacity-0 transition-[opacity,transform] group-hover:translate-x-0 group-hover:opacity-100"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-auto flex flex-wrap items-center gap-3 pt-8">
              <Button asChild variant="brand">
                <Link href={`/subjects#${area.slug}`}>
                  Explore {area.label} <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/concierge">Help me choose</Link>
              </Button>
            </div>
          </div>

          {/* Wide screens: the area's photo on an offset gradient block */}
          <div className="relative hidden lg:block">
            <div
              className="absolute -right-2 -top-2 h-[70%] w-[70%] rounded-xl bg-[linear-gradient(140deg,var(--color-grad-from),var(--color-grad-to))]"
              aria-hidden
            />
            <div className="relative h-full min-h-[380px] overflow-hidden rounded-xl border border-line bg-canvas">
              {/* All eight photos load together, so switching areas never waits for an image. */}
              {SUBJECT_AREAS.map((a) => (
                <Image
                  key={a.slug}
                  src={`/images/subject-areas/${a.slug}.jpg`}
                  alt=""
                  fill
                  sizes="300px"
                  className={cn(
                    "object-cover transition-opacity duration-300",
                    a.slug === area.slug ? "opacity-100" : "opacity-0",
                  )}
                />
              ))}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night/80 to-transparent p-4 pt-16">
                <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-white">
                  <area.icon className="size-4" aria-hidden /> {area.label}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </TabsPrimitive.Content>
    </TabsPrimitive.Root>
  );
}

export function SubjectTiles() {
  return (
    <Section tone="canvas">
      <SectionHeading
        eyebrow="Explore subjects"
        title="What will you master next?"
        accent={2}
        description="Pick an area to see every topic our tutors teach, with real tutor counts for each."
        action={
          <ArrowLink href="/subjects">
            View all {SUBJECTS.length} subjects
          </ArrowLink>
        }
      />

      <Reveal>
        <SubjectExplorer />
      </Reveal>

      <Reveal className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-4 sm:flex-row sm:items-center">
        <p className="text-[15px] text-muted">
          <span className="font-semibold text-ink">
            Can&rsquo;t find your subject?
          </span>{" "}
          We cover {SUBJECTS.length} subjects in {SUBJECT_CATEGORIES.length}{" "}
          areas.
        </p>
        <ArrowLink href="/concierge">Help me find a tutor</ArrowLink>
      </Reveal>
    </Section>
  );
}

/* ═══ 4 · How it works — a scroll story: four steps, one pinned picture ════════════ */

/** Stacked tutor cards. Real tutors when there are any; otherwise neutral placeholders (no made-up names or ratings). */
function TutorStack() {
  const tutors = useTutors();
  const top = React.useMemo(
    () =>
      [...tutors]
        .sort(
          (a, b) =>
            (b.rating ?? 0) - (a.rating ?? 0) || b.reviewCount - a.reviewCount,
        )
        .slice(0, 3),
    [tutors],
  );
  return (
    <div className="relative h-full" aria-hidden>
      {[0, 1, 2].map((i) => {
        const t = top[i];
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{
              duration: 0.6,
              ease: [0.22, 1, 0.36, 1],
              delay: 0.15 + i * 0.12,
            }}
            className="absolute flex w-[calc(100%-2rem)] gap-3.5 rounded-lg border border-ink/20 bg-surface p-3 shadow-md"
            style={{ left: i * 16, top: i * 92, zIndex: 3 - i }}
          >
            {t ? (
              <Avatar
                name={`${t.firstName} ${t.lastName}`}
                src={t.photoUrl}
                tone={t.tone}
                size="xl"
                square
                className="shrink-0"
              />
            ) : (
              <span className="grid size-16 shrink-0 place-items-center rounded-lg bg-canvas text-subtle">
                <UserRound className="size-7" />
              </span>
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              {t ? (
                <>
                  <p className="flex items-center justify-between gap-2">
                    <span className="truncate text-[15.5px] font-bold text-ink">
                      {t.firstName} {t.lastName.charAt(0)}.
                    </span>
                    {t.rating !== null && (
                      <span className="flex shrink-0 items-center gap-1 text-[14px] font-semibold text-ink">
                        <Star className="size-3.5 fill-ink" />{" "}
                        {t.rating.toFixed(1)}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] text-ink-2">
                    <GraduationCap className="size-3.5 shrink-0" />{" "}
                    {SUBJECT_BY_SLUG[t.subjects[0]]?.name ?? "Subject"} tutor
                  </p>
                  <p className="mt-0.5 flex items-start gap-1.5 text-[13px] leading-snug text-ink-2">
                    <Languages className="mt-0.5 size-3.5 shrink-0" />
                    <span className="line-clamp-2">
                      Speaks {t.languages.slice(0, 2).join(", ")}
                      {t.languages.length > 2 && ` +${t.languages.length - 2}`}
                    </span>
                  </p>
                </>
              ) : (
                <div className="space-y-2.5 pt-1">
                  <span className="block h-3 w-2/5 rounded-full bg-line-strong" />
                  <span className="block h-2.5 w-3/5 rounded-full bg-line" />
                  <span className="block h-2.5 w-4/5 rounded-full bg-line" />
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/** A lesson on a video call: the tutor large, the learner in a smaller tile. Photos only. */
function VideoCall() {
  return (
    <div className="relative h-full" aria-hidden>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        className="absolute bottom-0 left-0 h-[94%] w-[78%] overflow-hidden rounded-t-lg border border-b-0 border-ink/20 bg-canvas"
      >
        <Image
          src="/images/tutor-at-laptop.jpg"
          alt=""
          fill
          sizes="(min-width: 1024px) 300px, 78vw"
          className="object-cover object-[40%_30%]"
        />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
        className="absolute right-0 top-[10%] aspect-[4/5] w-[40%] overflow-hidden rounded-lg border-2 border-surface bg-canvas shadow-xl"
      >
        <Image
          src="/images/adult-learner-online.jpg"
          alt=""
          fill
          sizes="(min-width: 1024px) 160px, 40vw"
          className="object-cover object-[74%_30%]"
        />
      </motion.div>
    </div>
  );
}

const SLOT_PATTERN = [
  [true, false, true],
  [false, true, true],
  [true, true, false],
  [false, true, true],
  [true, false, true],
];

/** Step 3 picture: open times in a week grid (no real times or prices) and the trial / cancellation facts. */
function BookingMock() {
  return (
    <div className="flex h-full flex-col gap-4" aria-hidden>
      <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] font-semibold text-ink">Pick a time</p>
          <span className="text-[12px] text-muted">
            Shown in your time zone
          </span>
        </div>
        <div className="mt-4 grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1.5 text-center">
          <span />
          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
            <span key={d} className="pb-1 text-[12px] font-medium text-muted">
              {d}
            </span>
          ))}
          {["Morning", "Afternoon", "Evening"].map((band, j) => (
            <React.Fragment key={band}>
              <span className="pr-2 text-left text-[11.5px] leading-8 text-muted">
                {band}
              </span>
              {SLOT_PATTERN.map((day, i) => {
                const picked = i === 3 && j === 1;
                return (
                  <span
                    key={i}
                    className={cn(
                      "h-8 rounded-md",
                      picked
                        ? "bg-brand-gradient shadow-sm"
                        : day[j]
                          ? "border border-brand/25 bg-brand-50"
                          : "bg-canvas",
                    )}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <Gift className="size-5 text-brand" />
          <p className="mt-3 text-[14.5px] font-semibold text-ink">
            Trial lesson
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
            Free or low-cost with many tutors
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <ShieldCheck className="size-5 text-brand" />
          <p className="mt-3 text-[14.5px] font-semibold text-ink">
            Free cancellation
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
            Up to {DEFAULT_POLICY.freeCancellationHours} hours before
          </p>
        </div>
      </div>
    </div>
  );
}

/** Step 4 picture: the lesson on a video call, and what's kept after it. */
function LearnMock() {
  return (
    <div className="relative h-full" aria-hidden>
      <VideoCall />
      <div className="absolute left-0 top-0 z-10 rounded-xl border border-line bg-surface/95 p-4 shadow-lg backdrop-blur">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-muted">
          After every lesson
        </p>
        <ul className="mt-2.5 space-y-1.5 text-[13.5px] font-medium text-ink">
          {["Lesson notes", "Homework", "Goal progress"].map((x) => (
            <li key={x} className="flex items-center gap-2">
              <Check className="size-4 text-success" /> {x}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const HOW_STEPS: {
  label: string;
  title: string;
  body: string;
  points: string[];
  visual: React.ComponentType;
  mobileHeight: string;
}[] = [
  {
    label: "Search",
    title: "Tell us what you need",
    body: "Search by subject, grade, schedule and budget — or answer two quick questions and get a ranked shortlist with the reasons each tutor fits.",
    points: [
      "Free to search, no account needed",
      "Ranked on 8 open factors — never paid placement",
    ],
    visual: QuickMatch,
    mobileHeight: "",
  },
  {
    label: "Compare",
    title: "Compare real profiles",
    body: "See each tutor's experience, rate, availability and reviews, and send a message with your questions before you book.",
    points: [
      "Badges appear only once a check is complete",
      "Reviews come only from completed lessons",
    ],
    visual: TutorStack,
    mobileHeight: "h-[330px]",
  },
  {
    label: "Book",
    title: "Book a trial lesson",
    body: "Pick a real opening in your time zone. Many tutors offer a free or low-cost first lesson, so you can check the fit before you commit.",
    points: [
      `Free cancellation up to ${DEFAULT_POLICY.freeCancellationHours} hours before`,
      "Pay per lesson — no subscription for families",
    ],
    visual: BookingMock,
    mobileHeight: "h-[460px]",
  },
  {
    label: "Learn",
    title: "Learn and see progress",
    body: "Meet online with a secure video link or in person. Notes, homework and goals stay in your dashboard after every lesson.",
    points: [
      `Reschedule up to ${DEFAULT_POLICY.rescheduleMinHours} hours before a lesson`,
      "Parents see their child's lessons and progress",
    ],
    visual: LearnMock,
    mobileHeight: "h-[340px]",
  },
];

export function HowItWorks() {
  const [active, setActive] = React.useState(0);
  const step = HOW_STEPS[active];
  return (
    <Section>
      <div className="mb-12 flex flex-col gap-6 lg:mb-16 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          className="mb-0 lg:mb-0"
          eyebrow="How it works"
          title="From first search to real progress"
          accent={2}
          description="Four simple steps — and you stay in control at every one of them."
        />
        <Reveal delay={0.1} className="shrink-0">
          <ArrowLink href="/how-it-works">Read the full guide</ArrowLink>
        </Reveal>
      </div>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
        {/* Steps — the rail fills as you scroll and the current step lights up */}
        <ol className="relative">
          <div
            className="absolute bottom-[24vh] left-5 top-[24vh] hidden w-px bg-line lg:block"
            aria-hidden
          >
            <motion.div
              className="w-full rounded-full bg-brand-gradient"
              animate={{
                height: `${(active / (HOW_STEPS.length - 1)) * 100}%`,
              }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          {HOW_STEPS.map((s, i) => {
            const on = i === active;
            return (
              <motion.li
                key={s.title}
                onViewportEnter={() => setActive(i)}
                viewport={{ margin: "-45% 0px -45% 0px" }}
                className="relative pb-16 last:pb-0 lg:flex lg:min-h-[48vh] lg:flex-col lg:justify-center lg:pb-0 lg:pl-16"
              >
                <span
                  className={cn(
                    "absolute left-0 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full border font-heading text-[15px] font-bold transition-colors duration-300 lg:grid",
                    i <= active
                      ? "border-transparent bg-brand-gradient text-on-brand shadow-md"
                      : "border-line-strong bg-surface text-muted",
                  )}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <p className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-brand">
                  Step {i + 1} · {s.label}
                </p>
                <h3
                  className={cn(
                    "mt-2 font-heading text-[26px] font-bold leading-tight tracking-[-0.025em] transition-colors duration-300 sm:text-[30px]",
                    on ? "text-ink" : "text-ink lg:text-ink/40",
                  )}
                >
                  {s.title}
                </h3>
                <p
                  className={cn(
                    "mt-3 max-w-lg text-[16px] leading-relaxed transition-colors duration-300",
                    on ? "text-ink-2" : "text-ink-2 lg:text-ink-2/50",
                  )}
                >
                  {s.body}
                </p>
                <ul className="mt-5 space-y-2">
                  {s.points.map((p) => (
                    <li
                      key={p}
                      className={cn(
                        "flex items-start gap-2.5 text-[14.5px] transition-opacity duration-300",
                        on ? "opacity-100" : "lg:opacity-50",
                      )}
                    >
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-success"
                        strokeWidth={2.5}
                        aria-hidden
                      />{" "}
                      <span className="text-ink">{p}</span>
                    </li>
                  ))}
                </ul>
                {/* Phones and tablets: the picture sits under each step */}
                <div
                  className={cn(
                    "mt-8 rounded-2xl border border-line bg-canvas p-5 lg:hidden",
                    s.mobileHeight,
                  )}
                >
                  <s.visual />
                </div>
              </motion.li>
            );
          })}
        </ol>

        {/* Wide screens: one pinned panel whose picture follows the step you're reading */}
        <div className="hidden lg:block">
          <div className="sticky top-28">
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-32px_rgb(15_23_42/0.35)]">
              <div className="flex items-center justify-between border-b border-line px-6 py-4">
                <p className="text-[13.5px] font-semibold text-ink">
                  Step {active + 1} of {HOW_STEPS.length}{" "}
                  <span className="font-normal text-muted">· {step.title}</span>
                </p>
                <span className="flex gap-1.5" aria-hidden>
                  {HOW_STEPS.map((s, i) => (
                    <span
                      key={s.title}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        i === active
                          ? "w-6 bg-brand-gradient"
                          : "w-1.5 bg-line-strong",
                      )}
                    />
                  ))}
                </span>
              </div>
              <div className="relative h-[500px] bg-canvas/60">
                {HOW_STEPS.map((s, i) => (
                  <div
                    key={s.title}
                    className={cn(
                      "absolute inset-7 transition-[opacity,transform] duration-500 ease-out",
                      i === active
                        ? "translate-y-0 opacity-100"
                        : "pointer-events-none translate-y-3 opacity-0",
                    )}
                    aria-hidden={i !== active}
                  >
                    <s.visual />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Reveal className="mt-14 flex flex-col items-center gap-3 text-center lg:mt-20">
        <Button asChild variant="brand" size="lg">
          <Link href="/tutors">
            Start with step one <ArrowRight />
          </Link>
        </Button>
        <p className="text-[13.5px] text-muted">
          Free to search · No account needed to browse
        </p>
      </Reveal>
    </Section>
  );
}

/* ═══ 5 · Smart tutor matching — a short guided start on a deep navy stage ═══════════ */

const MATCH_SUBJECT_GROUPS: SelectGroup[] = SUBJECT_CATEGORIES.map((c) => ({
  label: c.name,
  options: SUBJECTS.filter((s) => s.category === c.slug).map((s) => ({
    value: s.slug,
    label: s.name,
  })),
}));
const MATCH_GRADE_OPTIONS: SelectOption[] = GRADES.map((g) => ({
  value: g.value,
  label: g.label,
}));

function MatchSelect({
  icon: Icon,
  label,
  error,
  value,
  onChange,
  placeholder,
  options,
  groups,
}: {
  icon: LucideIcon;
  label: string;
  error?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options?: SelectOption[];
  groups?: SelectGroup[];
}) {
  const id = React.useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-[14px] font-medium text-ink"
      >
        {label}
      </label>
      <SelectMenu
        id={id}
        variant="bare"
        value={value}
        onValueChange={onChange}
        placeholder={placeholder}
        options={options}
        groups={groups}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        leading={<Icon className="size-5 shrink-0 text-muted" aria-hidden />}
        renderValue={(o) => (
          <span className={cn(!o && "text-muted")}>
            {o?.label ?? placeholder}
          </span>
        )}
        className={cn(
          "h-13 w-full gap-3 rounded-xl border bg-surface px-4 text-[15.5px] text-ink transition-[border-color,box-shadow] hover:border-subtle",
          "focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/10 data-[state=open]:border-brand data-[state=open]:ring-4 data-[state=open]:ring-brand/10",
          error ? "border-danger" : "border-line-strong",
        )}
      />
      {error && (
        <p id={`${id}-error`} className="mt-2 text-[13.5px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function GetMatched() {
  const router = useRouter();
  const [subject, setSubject] = React.useState("");
  const [grade, setGrade] = React.useState("");
  const [error, setError] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject) {
      setError(true);
      return;
    }
    const p = new URLSearchParams({ view: "results", from: "guided", subject });
    if (grade) p.set("grade", grade);
    router.push(`/concierge?${p.toString()}`);
  };

  return (
    <section
      aria-labelledby="match-title"
      className="relative isolate overflow-clip border-y border-line bg-night text-white"
    >
      {/* An old library behind: arched wooden shelves, kept dark and warm so the words stay readable */}
      <div className="absolute inset-0 -z-20" aria-hidden>
        <Image src="/images/old-library.jpg" alt="" fill sizes="100vw" className="object-cover object-[50%_45%] [animation:hero-drift_50s_ease-in-out_infinite_alternate]" />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-night via-night/72 to-night/20" aria-hidden />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-night/30 via-transparent to-night/60" aria-hidden />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.12] mix-blend-overlay" style={{ backgroundImage: GRAIN }} aria-hidden />
      <div className="container-page grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1fr_minmax(0,540px)] lg:gap-20 lg:py-28">
        <div>
          <Reveal>
            <p className="kicker text-white">Smart tutor matching</p>
          </Reveal>
          <h2
            id="match-title"
            className="mt-6 font-heading text-[2.6rem] leading-[1.02] text-white sm:text-[3.4rem] lg:text-[4rem]"
          >
            <WordReveal
              as="span"
              inView
              className="block"
              text="Find a tutor"
              delay={0.05}
            />
            <WordReveal
              as="span"
              inView
              gradient
              className="block"
              text="that fits you."
              delay={0.2}
            />
          </h2>
          <Reveal delay={0.1}>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-white/70 sm:text-[18px]">
              Answer two quick questions. We&rsquo;ll show a shortlist of tutors
              and explain exactly why each one matches.
            </p>
            <ul className="mt-8 grid max-w-lg gap-3.5 text-[15.5px] text-white/85">
              {[
                { icon: Zap, text: "Takes about 2 minutes" },
                { icon: Lock, text: "No account needed to see matches" },
                {
                  icon: ShieldCheck,
                  text: "Paid placement never affects the ranking",
                },
              ].map((x) => (
                <li key={x.text} className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/10 text-white">
                    <x.icon className="size-4" aria-hidden />
                  </span>
                  {x.text}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <form
            onSubmit={submit}
            noValidate
            className="rounded-3xl bg-surface p-6 text-ink shadow-[0_40px_80px_-30px_rgb(0_0_0/0.55)] ring-1 ring-white/10 sm:p-8"
          >
            <div className="flex items-center justify-between gap-4 border-b border-line pb-5">
              <p className="text-[15px] font-semibold text-ink">
                Get your shortlist
              </p>
              <span className="rounded-full bg-sunken px-2.5 py-1 text-[12.5px] font-medium text-muted">
                2 questions
              </span>
            </div>
            <div className="mt-6 space-y-5">
              <MatchSelect
                icon={BookOpen}
                label="What do you want to learn?"
                value={subject}
                onChange={(v) => {
                  setSubject(v);
                  setError(false);
                }}
                placeholder="Choose a subject"
                groups={MATCH_SUBJECT_GROUPS}
                error={
                  error ? "Choose a subject to see your matches." : undefined
                }
              />
              <MatchSelect
                icon={ChartNoAxesColumnIncreasing}
                label="What's your level?"
                value={grade}
                onChange={setGrade}
                placeholder="Select your level"
                options={MATCH_GRADE_OPTIONS}
              />
            </div>
            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="group mt-7 w-full"
            >
              Find my matches{" "}
              <ArrowRight
                className="transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Button>
            <p className="mt-5 flex items-start gap-2.5 text-[13.5px] leading-snug text-muted">
              <Info className="mt-px size-4 shrink-0" aria-hidden />
              Matches are ranked on {Object.keys(DEFAULT_WEIGHTS).length} clear
              factors across {SUBJECTS.length} subjects.
            </p>
          </form>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══ 6 · Featured tutors ═══════════════════════════════════════════════════════ */

export function FeaturedTutors() {
  const tutors = useTutors();
  const featured = tutors
    .filter((t) => t.featured && t.verification.identity === "verified")
    .slice(0, 4);
  return (
    <Section>
      <SectionHeading
        eyebrow="Our tutors"
        title="Meet some of our tutors"
        description="Experienced, identity-verified tutors. Featured placement never affects search ranking or match scores."
        action={<ArrowLink href="/tutors">Browse all tutors</ArrowLink>}
      />
      {featured.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <p className="text-[17px] font-semibold text-ink">
            No tutors to show yet
          </p>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-muted">
            Tutors appear here once they join and complete identity
            verification.
          </p>
          <Button asChild variant="brand" className="mt-6">
            <Link href="/become-a-tutor">
              Become a tutor <ArrowRight />
            </Link>
          </Button>
        </div>
      ) : (
        <Stagger
          className="swipe-row grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          stagger={0.07}
        >
          {featured.map((t) => (
            <StaggerItem key={t.id}>
              <TutorCard tutor={t} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </Section>
  );
}

/* ═══ 7 · Why families choose TutorLink — our promises, in numbers ══════════════════════ */

/** Each number is a rule of the platform (from the booking policy and matching settings), not a usage statistic. One line each. */
const PROMISES: { value: string; title: string; body: string }[] = [
  { value: "0", title: "Paid spots in your results", body: "No tutor can pay to rank higher." },
  { value: "$0", title: "Subscription or booking fee", body: "Pay per lesson, full price shown first." },
  { value: `${DEFAULT_POLICY.freeCancellationHours}h`, title: "Free cancellation", body: `Full refund up to ${DEFAULT_POLICY.freeCancellationHours} hours before a lesson.` },
  { value: `${DEFAULT_POLICY.tutorNoShowRefundPercent}%`, title: "Refund if a tutor doesn't show", body: "Your money back in full." },
  { value: "4", title: "Checks on every profile", body: "Identity, education, certification, background." },
  { value: "1", title: "Parent account for every child", body: "Bookings, messages, progress and consent." },
];

/** Two more rules that have no number. */
const ALSO_INCLUDED: { icon: LucideIcon; text: string }[] = [
  { icon: Lock, text: "Phone numbers and emails are hidden in messages" },
  { icon: Star, text: "Reviews come only from completed lessons" },
];

export function WhyTutorLink() {
  return (
    <Section tone="canvas">
      <div className="mb-12 flex flex-col gap-6 lg:mb-14 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading className="mb-0 lg:mb-0" eyebrow="Why TutorLink" title="Built on trust, not fine print" accent={3} description="Clear rules and checks you can see." />
        <Reveal delay={0.1} className="shrink-0">
          <ArrowLink href="/trust-safety">See our trust &amp; safety rules</ArrowLink>
        </Reveal>
      </div>

      {/* Photo on the left, the rules as one list on the right: a number and a single line each. */}
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
        <Reveal className="lg:col-span-5 lg:h-full">
          <div className="relative min-h-[280px] overflow-hidden border border-line bg-surface lg:h-full">
            <Image src="/images/parent-and-daughter.jpg" alt="A parent and her daughter reviewing schoolwork together" fill sizes="(min-width: 1024px) 520px, 100vw" className="object-cover" />
          </div>
        </Reveal>

        <div className="lg:col-span-7">
          <Stagger as="ol" className="border-t border-line" stagger={0.05}>
            {PROMISES.map((p) => (
              <StaggerItem as="li" key={p.title} className="grid grid-cols-[4.5rem_1fr] items-baseline gap-x-4 border-b border-line py-4 sm:grid-cols-[6rem_1fr] sm:gap-x-5">
                <span className="font-heading text-[2.1rem] leading-none text-ink sm:text-[2.5rem]">{p.value}</span>
                <p className="text-[15.5px] leading-snug">
                  <span className="font-semibold text-ink">{p.title}.</span> <span className="text-ink-2">{p.body}</span>
                </p>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal delay={0.1} className="mt-5 flex flex-col gap-2 text-[14px] text-ink-2 sm:flex-row sm:flex-wrap sm:gap-x-7">
            {ALSO_INCLUDED.map((x) => (
              <p key={x.text} className="flex items-center gap-2">
                <x.icon className="size-4 shrink-0 text-brand" aria-hidden /> {x.text}
              </p>
            ))}
          </Reveal>

          <Reveal delay={0.15} className="mt-8">
            <ArrowLink href="/for-parents">How it works for parents</ArrowLink>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

/* ═══ 8 · Stories (illustrative, clearly labelled) ═══════════════════════════════ */

/** One story: a numbered mono label, the quote in serif, who said it, and a link to the feature it is about. */
function Story({ t, index, featured }: { t: (typeof SAMPLE_TESTIMONIALS)[number]; index: number; featured?: boolean }) {
  return (
    <figure className={cn("relative flex h-full flex-col overflow-hidden bg-surface", featured ? "p-7 sm:p-10 lg:p-12" : "p-7 sm:p-8")}>
      {/* A large quote mark sits behind the words, like a pull quote on a magazine page. */}
      <span aria-hidden className={cn("pointer-events-none absolute -top-5 right-4 select-none font-heading leading-none text-brand/15", featured ? "text-[14rem]" : "text-[9rem]")}>
        &rdquo;
      </span>
      <p className="mono-label relative">
        0{index + 1} · {t.context}
      </p>
      <blockquote className={cn("relative mt-5 flex-1 font-heading text-ink", featured ? "max-w-[22ch] text-[1.9rem] leading-[1.15] sm:text-[2.4rem] lg:text-[2.8rem]" : "text-[1.35rem] leading-[1.25] sm:text-[1.5rem]")}>
        &ldquo;{t.quote}&rdquo;
      </blockquote>
      <figcaption className="relative mt-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-t border-line pt-5">
        <span className="block text-[15px] font-semibold text-ink">{t.name}</span>
        <ArrowLink href={t.used.href} className="text-[14px]">
          {t.used.label}
        </ArrowLink>
      </figcaption>
    </figure>
  );
}

export function Stories() {
  // Only real (or, in the demo, clearly labelled) stories — the section hides when there are none.
  if (SAMPLE_TESTIMONIALS.length === 0) return null;
  const [first, ...rest] = SAMPLE_TESTIMONIALS;
  return (
    <Section tone="canvas">
      <SectionHeading align="center" eyebrow="Stories" title="What families and students tell us" />

      {/* The first story runs large on the left; the others stack beside it. All share one border. */}
      <div className="grid border border-line lg:grid-cols-12">
        <Reveal className="lg:col-span-7 lg:border-r lg:border-line">
          <Story t={first} index={0} featured />
        </Reveal>
        <div className="grid border-t border-line lg:col-span-5 lg:border-t-0">
          {rest.map((t, i) => (
            <Reveal key={t.name} delay={0.08 * (i + 1)} className={cn(i > 0 && "border-t border-line")}>
              <Story t={t} index={i + 1} />
            </Reveal>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-[13px] text-muted">Illustrative stories for this preview. Published testimonials will come from verified, consenting customers.</p>
    </Section>
  );
}

/* ═══ 9 · Become a tutor ════════════════════════════════════════════════════════ */

export function BecomeTutor() {
  const perks = [
    {
      icon: Briefcase,
      title: "Find new students",
      body: "Browse requirements families post and apply with a personal note.",
    },
    {
      icon: CalendarDays,
      title: "Teach on your schedule",
      body: "Weekly availability, buffers, minimum notice and optional instant booking.",
    },
    {
      icon: CreditCard,
      title: "Get paid securely",
      body: "Payments through Stripe with payouts to your bank on a clear schedule.",
    },
  ];
  return (
    <Section tone="canvas">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading
            className="mb-8"
            eyebrow="For tutors"
            title="Become a tutor on TutorLink"
            description="Earn money sharing what you know with students across the U.S. Teach online, in person, or both — at the rate you set."
          />
          <Stagger className="space-y-5" stagger={0.08}>
            {perks.map((p) => (
              <StaggerItem key={p.title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <p.icon className="size-5" />
                </span>
                <span>
                  <span className="block text-[16.5px] font-semibold text-ink">
                    {p.title}
                  </span>
                  <span className="mt-0.5 block text-[15px] leading-relaxed text-ink-2">
                    {p.body}
                  </span>
                </span>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal
            delay={0.2}
            className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4"
          >
            <Button asChild size="lg" variant="brand">
              <Link href="/become-a-tutor">
                Become a tutor <ArrowRight />
              </Link>
            </Button>
            <ArrowLink href="/tutor-jobs">Browse student jobs</ArrowLink>
          </Reveal>
        </div>
        <Reveal delay={0.1} className="relative">
          <div className="relative aspect-[4/3.4] overflow-hidden rounded-2xl shadow-xl">
            <Image
              src="/images/tutor-at-laptop.jpg"
              alt="A tutor smiling while working on a laptop"
              fill
              sizes="(min-width: 1024px) 560px, 100vw"
              className="object-cover"
            />
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

/* ═══ 10 · FAQ ══════════════════════════════════════════════════════════════════ */

export function HomeFaq() {
  const faqs = FAQS.filter((f) => f.audience !== "tutors").slice(0, 7);
  return (
    <Section>
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            className="mb-6"
            eyebrow="FAQ"
            title="Questions? We've got answers."
          />
          <Reveal
            delay={0.1}
            className="flex flex-wrap items-center gap-x-6 gap-y-3"
          >
            <Button asChild variant="secondary">
              <Link href="/faq">All FAQs</Link>
            </Button>
            <ArrowLink href="/contact">Contact support</ArrowLink>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <Accordion type="single" collapsible className="border-t border-line">
            {faqs.map((f, k) => (
              <AccordionItem
                key={f.q}
                value={`f${k}`}
                className="border-b border-line"
              >
                <AccordionTrigger className="py-5 text-left text-[16.5px] font-medium sm:text-[17.5px]">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-[16px] leading-relaxed text-ink-2">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </Section>
  );
}

/* ═══ 11 · Closing call to action ═══════════════════════════════════════════════ */

export function ClosingCta() {
  return (
    <CtaBand
      title="Start with a trial lesson."
      description="Search is free. Many tutors offer a free or low-cost trial, so you can find the right fit before you commit."
      primary={{ href: "/tutors", label: "Find a tutor" }}
      secondary={{ href: "/become-a-tutor", label: "Become a tutor" }}
    />
  );
}
