"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import {
  ArrowRight, BadgeCheck, BookOpen, Brain, Briefcase, Calculator, CalendarDays, ChartNoAxesColumnIncreasing, Check, ChevronDown, ChevronRight, Code, CreditCard, FlaskConical, Gift, GraduationCap, Info, Languages, LineChart,
  Music, Route, Search, ShieldCheck, Star, Target, UserRound, Users, Wallet, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, Stagger, StaggerItem, WordReveal, gsap, useGSAP } from "@/components/motion";
import { prefersReducedMotion } from "@/components/motion/gsap";
import { Section, SectionHeading, ArrowLink, CtaBand } from "@/components/marketing/Section";
import { Button } from "@/components/ui/Button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/Disclosure";
import { TutorCard } from "@/components/domain/TutorCard";
import { Avatar } from "@/components/ui/Avatar";
import { SubjectSearch } from "./SubjectSearch";
import { GRADES, SUBJECTS, SUBJECT_BY_SLUG, SUBJECT_CATEGORIES } from "@/lib/data/catalog";
import { FAQS, SAMPLE_TESTIMONIALS } from "@/lib/data/content";
import { DEFAULT_POLICY } from "@/lib/data/platform";
import { DEFAULT_WEIGHTS, FACTOR_LABEL } from "@/lib/matching";
import { useTutors } from "@/lib/store/hooks";

/* ═══ 1 · Hero — the promise, two actions, and a real tutoring moment ═══════════════════ */

const HERO_FEATURES = [
  { icon: BadgeCheck, title: "Identity Checks", body: "Badge shown once verified" },
  { icon: CalendarDays, title: "Flexible Learning", body: "Book times that suit you" },
  { icon: Gift, title: "Free Trials", body: "Offered by many tutors" },
  { icon: Wallet, title: "Pay Per Lesson", body: "No subscription for families" },
];

/** A tutor helping a student, on a crisp gradient block, with two small fact cards. Photo only — no example data. */
function TutoringVisual({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)} aria-hidden>
      {/* Gradient block offset behind the photo */}
      <div data-hero-slab className="absolute -right-3 -top-3 h-[78%] w-[72%] rounded-2xl bg-[linear-gradient(140deg,var(--color-grad-from),var(--color-grad-via)_55%,var(--color-grad-to))] sm:-right-5 sm:-top-5" />
      {/* Fine dot grid peeking out bottom-left */}
      <div className="absolute -bottom-6 -left-6 hidden size-32 bg-dot-grid opacity-70 sm:block" />

      <div data-hero-photo className="relative aspect-[5/5.4] overflow-hidden rounded-2xl border border-line bg-canvas shadow-2xl sm:aspect-[5/4.6]">
        <Image src="/images/hero-tutoring.jpg" alt="" fill preload sizes="(min-width: 1024px) 560px, 100vw" className="object-cover object-[64%_50%]" />
      </div>

      {/* Fact card, top left */}
      <div data-hero-card className="absolute -left-3 top-[8%] w-[176px] rounded-xl border border-line bg-white/95 p-4 text-ink shadow-xl backdrop-blur-md sm:-left-8">
        <p className="font-heading text-[24px] font-extrabold leading-none tracking-[-0.02em]">1-on-1</p>
        <p className="mt-1 text-[12.5px] text-muted">Private lessons, online or in person</p>
      </div>

      {/* Fact card, bottom right */}
      <div data-hero-card className="absolute -bottom-5 right-4 flex items-center gap-3 rounded-xl border border-line bg-white/95 p-3 pr-5 shadow-xl backdrop-blur-md sm:-right-6">
        <span className="grid size-10 place-items-center rounded-lg bg-brand-gradient text-white">
          <BookOpen className="size-5" />
        </span>
        <span>
          <span className="block text-[15px] font-bold text-ink">{SUBJECTS.length} subjects</span>
          <span className="block text-[12.5px] text-muted">From reading to AP Calculus</span>
        </span>
      </div>

      {/* Handwritten note with an arrow toward the lesson */}
      <div data-hero-note className="absolute bottom-[5%] hidden -rotate-[10deg] font-hand text-[30px] font-semibold leading-none text-ink xl:-left-48 xl:block">
        Help that clicks!
        <svg viewBox="0 0 120 70" className="absolute -right-14 -top-12 h-14 w-24 text-brand" fill="none">
          <motion.path
            d="M4 62 C 30 60, 70 50, 104 12"
            stroke="currentColor"
            strokeWidth={2.6}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, delay: 1.5, ease: [0.65, 0, 0.35, 1] }}
          />
          <motion.path
            d="M90 10 L105 11 L103 26"
            stroke="currentColor"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, delay: 2.35 }}
          />
        </svg>
      </div>
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
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.fromTo("[data-hero-slab]", { scale: 0.85, autoAlpha: 0, transformOrigin: "100% 0%" }, { scale: 1, autoAlpha: 1, duration: 1.2 }, 0.15)
        .fromTo("[data-hero-photo]", { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2 }, 0.25)
        .fromTo("[data-hero-photo] img", { scale: 1.1 }, { scale: 1, duration: 1.6 }, 0.25)
        .fromTo(items, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.08 }, 0.5)
        .fromTo("[data-hero-card]", { autoAlpha: 0, y: 18, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.9, stagger: 0.15 }, 0.9)
        .fromTo("[data-hero-note]", { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 1.2);
      gsap.to("[data-hero-card]", { y: -7, duration: 3.2, ease: "sine.inOut", repeat: -1, yoyo: true, delay: 2, stagger: 0.6 });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative isolate overflow-hidden bg-gradient-to-b from-brand-50 to-page">
      <div className="container-page grid items-center gap-14 pb-16 pt-12 sm:pt-16 lg:grid-cols-[1.08fr_1fr] lg:gap-16 lg:pb-20 lg:pt-20">
        <div>
          <p data-hero-in data-reveal className="inline-flex items-center gap-2.5 text-[12.5px] font-semibold uppercase tracking-[0.16em] text-brand">
            <span className="h-px w-6 bg-brand-gradient" aria-hidden />
            1-on-1 tutoring · online &amp; in person
          </p>

          <h1 className="mt-6 text-balance font-heading text-[2.75rem] font-extrabold leading-[1.03] tracking-[-0.035em] text-ink sm:text-[3.6rem] xl:text-[4.15rem]">
            <WordReveal as="span" className="block" text="Learn with the right tutor." delay={0.15} />
            <WordReveal as="span" className="block" gradient text="Grow with every lesson." delay={0.35} />
          </h1>

          <p data-hero-in data-reveal className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2 sm:text-[18px]">
            Private tutoring for school subjects, test prep, languages and more. Search for free, compare tutors and book your first lesson — online or near you.
          </p>

          <div data-hero-in data-reveal className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button asChild variant="brand" size="lg" className="h-14 rounded-xl px-7 text-[16px] font-bold">
              <Link href="/tutors">
                Find a tutor <ArrowRight />
              </Link>
            </Button>
            <Link href="/how-it-works" className="group inline-flex items-center gap-3 text-[15.5px] font-semibold text-ink">
              <span className="grid size-12 place-items-center rounded-full border border-line-strong transition-colors group-hover:border-brand group-hover:text-brand">
                <Route className="size-5" aria-hidden />
              </span>
              How it works
            </Link>
          </div>
        </div>

        <TutoringVisual className="mx-auto w-full max-w-[560px] lg:mr-0" />
      </div>

      {/* Feature bar */}
      <div className="container-page relative z-10 pb-8 lg:pb-10">
        <Stagger className="grid grid-cols-1 gap-5 rounded-2xl border border-line bg-surface p-5 shadow-xl sm:grid-cols-2 sm:p-6 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-line lg:px-2 lg:py-6" stagger={0.07}>
          {HERO_FEATURES.map((f) => (
            <StaggerItem key={f.title} className="flex items-start gap-3.5 lg:px-6">
              <f.icon className="mt-0.5 size-6 shrink-0 text-brand" strokeWidth={1.8} aria-hidden />
              <span>
                <span className="block text-[15px] font-bold text-ink">{f.title}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted">{f.body}</span>
              </span>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ═══ 3 · Subjects — search, then an explorer: pick an area, see its topics ══════════════ */

/** The eight most-asked-for areas, most popular first. Labels are the short names people search for. */
const SUBJECT_AREAS: { slug: string; label: string; icon: LucideIcon; body: string }[] = [
  { slug: "math", label: "Mathematics", icon: Calculator, body: "From number sense and fractions to algebra, calculus and statistics — help with homework, tests and getting ahead." },
  { slug: "science", label: "Science", icon: FlaskConical, body: "Biology, chemistry, physics and earth science, with labs, problem sets and AP courses explained step by step." },
  { slug: "english", label: "English", icon: BookOpen, body: "Reading, writing, grammar and literature — from early readers to confident essay writers." },
  { slug: "test-prep", label: "Test Prep", icon: Target, body: "Structured plans for the SAT, ACT, AP exams and graduate admissions tests, with practice tests reviewed together." },
  { slug: "languages", label: "Languages", icon: Languages, body: "Conversation-first lessons in Spanish, French, Mandarin and English as a second language." },
  { slug: "computer-science", label: "Coding", icon: Code, body: "Python, Java and web development — from first lines of code to AP Computer Science." },
  { slug: "arts", label: "Music & Arts", icon: Music, body: "Piano, guitar, voice and drawing for beginners and experienced learners alike." },
  { slug: "learning-support", label: "Study Skills", icon: Brain, body: "Study habits, executive function and dyslexia support — patient, specialised help that builds independence." },
];

function SubjectExplorer() {
  const tutors = useTutors();
  const [active, setActive] = React.useState(SUBJECT_AREAS[0].slug);

  // Real counts only: tutors per subject and per area.
  const counts = React.useMemo(() => {
    const bySubject: Record<string, number> = {};
    for (const t of tutors) for (const s of t.subjects) bySubject[s] = (bySubject[s] ?? 0) + 1;
    const byArea: Record<string, number> = {};
    for (const a of SUBJECT_AREAS) {
      const subs = new Set(SUBJECTS.filter((s) => s.category === a.slug).map((s) => s.slug));
      byArea[a.slug] = tutors.filter((t) => t.subjects.some((s) => subs.has(s))).length;
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
      <TabsPrimitive.List aria-label="Subject areas" className="scrollbar-none flex gap-1 overflow-x-auto border-b border-line p-2 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:p-3">
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
              {on && <motion.span layoutId="explorer-bar" className="absolute inset-y-2 left-0 hidden w-[3px] rounded-full bg-brand-gradient lg:block" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg border transition-colors", on ? "border-transparent bg-brand-gradient text-white" : "border-line text-ink-2 group-hover:text-ink")}>
                <a.icon className="size-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block whitespace-nowrap text-[15px] font-semibold", on ? "text-ink" : "text-ink-2")}>{a.label}</span>
                <span className="hidden text-[12.5px] tabular-nums text-muted lg:block">{summary(a.slug)}</span>
              </span>
              <ChevronRight className={cn("hidden size-4 shrink-0 transition-[opacity,transform] lg:block", on ? "translate-x-0 text-brand opacity-100" : "-translate-x-1 text-muted opacity-0")} aria-hidden />
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>

      <TabsPrimitive.Content value={area.slug} forceMount className="outline-none">
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
              <Image src={`/images/subjects/${area.slug}.jpg`} alt="" fill sizes="100vw" className="object-cover" />
            </div>

            <div className="flex flex-col">
              <p className="inline-flex items-center gap-2.5 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-brand">
                <span className="h-px w-6 bg-brand-gradient" aria-hidden />
                {topics.length} subjects{areaTutors > 0 && ` · ${areaTutors} ${areaTutors === 1 ? "tutor" : "tutors"}`}
              </p>
              <h3 className="mt-3 font-heading text-[28px] font-bold leading-tight tracking-[-0.025em] text-ink sm:text-[34px]">{area.label}</h3>
              <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-ink-2">{area.body}</p>

              <p className="mt-7 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Choose a topic</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {topics.map((s) => {
                  const n = counts.bySubject[s.slug] ?? 0;
                  return (
                    <li key={s.slug}>
                      <Link
                        href={`/tutors?subject=${s.slug}`}
                        className="group inline-flex items-center gap-2 rounded-lg border border-line bg-page px-3.5 py-2 text-[14.5px] font-medium text-ink transition-colors hover:border-brand/40 hover:bg-brand-50 hover:text-brand"
                      >
                        {s.name}
                        {n > 0 && <span className="rounded-md bg-canvas px-1.5 text-[12px] tabular-nums text-muted">{n}</span>}
                        <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-[opacity,transform] group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
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
              <div className="absolute -right-2 -top-2 h-[70%] w-[70%] rounded-xl bg-[linear-gradient(140deg,var(--color-grad-from),var(--color-grad-to))]" aria-hidden />
              <div className="relative h-full min-h-[380px] overflow-hidden rounded-xl border border-line bg-canvas">
                {/* All eight photos load together, so switching areas never waits for an image. */}
                {SUBJECT_AREAS.map((a) => (
                  <Image
                    key={a.slug}
                    src={`/images/subjects/${a.slug}.jpg`}
                    alt=""
                    fill
                    sizes="300px"
                    className={cn("object-cover transition-opacity duration-300", a.slug === area.slug ? "opacity-100" : "opacity-0")}
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
      <div className="mb-10 grid items-end gap-8 lg:mb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)] lg:gap-14">
        <SectionHeading
          className="mb-0 lg:mb-0"
          eyebrow="Explore subjects"
          title="What will you master next?"
          accent={2}
          description="Pick an area to see every topic our tutors teach — or search for a subject, a skill or a tutor by name."
        />
        <Reveal delay={0.1} className="relative z-20">
          <SubjectSearch />
        </Reveal>
      </div>

      <Reveal>
        <SubjectExplorer />
      </Reveal>

      <Reveal className="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl border border-dashed border-line-strong px-5 py-4 sm:flex-row sm:items-center">
        <p className="text-[15px] text-ink-2">
          <span className="font-semibold text-ink">Can&rsquo;t find your subject?</span> We cover {SUBJECTS.length} subjects in {SUBJECT_CATEGORIES.length} areas.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <ArrowLink href="/subjects">View all subjects</ArrowLink>
          <ArrowLink href="/concierge">Help me find a tutor</ArrowLink>
        </div>
      </Reveal>
    </Section>
  );
}

/* ═══ 4 · How it works — a scroll story: four steps, one pinned picture ════════════ */

/** Stacked tutor cards. Real tutors when there are any; otherwise neutral placeholders (no made-up names or ratings). */
function TutorStack() {
  const tutors = useTutors();
  const top = React.useMemo(() => [...tutors].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.reviewCount - a.reviewCount).slice(0, 3), [tutors]);
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
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 + i * 0.12 }}
            className="absolute flex w-[calc(100%-2rem)] gap-3.5 rounded-lg border border-ink/20 bg-surface p-3 shadow-md"
            style={{ left: i * 16, top: i * 92, zIndex: 3 - i }}
          >
            {t ? (
              <Avatar name={`${t.firstName} ${t.lastName}`} tone={t.tone} size="xl" square className="shrink-0" />
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
                        <Star className="size-3.5 fill-ink" /> {t.rating.toFixed(1)}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] text-ink-2">
                    <GraduationCap className="size-3.5 shrink-0" /> {SUBJECT_BY_SLUG[t.subjects[0]]?.name ?? "Subject"} tutor
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
        <Image src="/images/become-a-tutor.jpg" alt="" fill sizes="(min-width: 1024px) 300px, 78vw" className="object-cover object-[82%_30%]" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
        className="absolute right-0 top-[10%] aspect-[4/5] w-[40%] overflow-hidden rounded-lg border-2 border-surface bg-canvas shadow-xl"
      >
        <Image src="/images/hero-tutoring-close.jpg" alt="" fill sizes="(min-width: 1024px) 160px, 40vw" className="object-cover object-[28%_40%]" />
      </motion.div>
    </div>
  );
}

/** Step 1 picture: a search with filters, and the real weights used to rank matches. */
function SearchMock() {
  const factors = (Object.keys(DEFAULT_WEIGHTS) as (keyof typeof DEFAULT_WEIGHTS)[]).slice(0, 5);
  return (
    <div className="flex h-full flex-col gap-4" aria-hidden>
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5 pl-4 shadow-sm">
        <Search className="size-5 shrink-0 text-muted" />
        <span className="flex-1 text-[15px] font-medium text-ink">Algebra</span>
        <span className="rounded-lg bg-brand-gradient px-3.5 py-2 text-[13px] font-semibold text-white">Search</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {["9th grade", "Online", "Weekday evenings", "Budget set"].map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5 rounded-lg border border-brand/25 bg-brand-50 px-2.5 py-1.5 text-[13px] font-medium text-brand">
            <Check className="size-3.5" /> {c}
          </span>
        ))}
      </div>
      <div className="mt-auto rounded-xl border border-line bg-surface p-5 shadow-sm">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">How matches are ranked</p>
        <ul className="mt-4 space-y-2.5">
          {factors.map((k) => (
            <li key={k} className="flex items-center gap-3 text-[13px]">
              <span className="w-28 shrink-0 text-ink-2">{FACTOR_LABEL[k]}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <span className="block h-full rounded-full bg-brand-gradient" style={{ width: `${(DEFAULT_WEIGHTS[k] / 30) * 100}%` }} />
              </span>
              <span className="w-9 text-right tabular-nums text-muted">{DEFAULT_WEIGHTS[k]}%</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12.5px] text-muted">+ 3 more factors · paid placement is never one of them</p>
      </div>
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
          <span className="text-[12px] text-muted">Shown in your time zone</span>
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
              <span className="pr-2 text-left text-[11.5px] leading-8 text-muted">{band}</span>
              {SLOT_PATTERN.map((day, i) => {
                const picked = i === 3 && j === 1;
                return <span key={i} className={cn("h-8 rounded-md", picked ? "bg-brand-gradient shadow-sm" : day[j] ? "border border-brand/25 bg-brand-50" : "bg-canvas")} />;
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <Gift className="size-5 text-brand" />
          <p className="mt-3 text-[14.5px] font-semibold text-ink">Trial lesson</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">Free or low-cost with many tutors</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
          <ShieldCheck className="size-5 text-brand" />
          <p className="mt-3 text-[14.5px] font-semibold text-ink">Free cancellation</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted">Up to {DEFAULT_POLICY.freeCancellationHours} hours before</p>
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
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted">After every lesson</p>
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

const HOW_STEPS: { label: string; title: string; body: string; points: string[]; visual: React.ComponentType; mobileHeight: string }[] = [
  {
    label: "Search",
    title: "Tell us what you need",
    body: "Search by subject, grade, schedule and budget — or answer two quick questions and get a ranked shortlist with the reasons each tutor fits.",
    points: ["Free to search, no account needed", "Ranked on 8 open factors — never paid placement"],
    visual: SearchMock,
    mobileHeight: "h-[440px]",
  },
  {
    label: "Compare",
    title: "Compare real profiles",
    body: "See each tutor's experience, rate, availability and reviews, and send a message with your questions before you book.",
    points: ["Badges appear only once a check is complete", "Reviews come only from completed lessons"],
    visual: TutorStack,
    mobileHeight: "h-[330px]",
  },
  {
    label: "Book",
    title: "Book a trial lesson",
    body: "Pick a real opening in your time zone. Many tutors offer a free or low-cost first lesson, so you can check the fit before you commit.",
    points: [`Free cancellation up to ${DEFAULT_POLICY.freeCancellationHours} hours before`, "Pay per lesson — no subscription for families"],
    visual: BookingMock,
    mobileHeight: "h-[460px]",
  },
  {
    label: "Learn",
    title: "Learn and see progress",
    body: "Meet online with a secure video link or in person. Notes, homework and goals stay in your dashboard after every lesson.",
    points: [`Reschedule up to ${DEFAULT_POLICY.rescheduleMinHours} hours before a lesson`, "Parents see their child's lessons and progress"],
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
          <div className="absolute bottom-[24vh] left-5 top-[24vh] hidden w-px bg-line lg:block" aria-hidden>
            <motion.div
              className="w-full rounded-full bg-brand-gradient"
              animate={{ height: `${(active / (HOW_STEPS.length - 1)) * 100}%` }}
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
                    i <= active ? "border-transparent bg-brand-gradient text-white shadow-md" : "border-line-strong bg-surface text-muted",
                  )}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <p className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-brand">
                  Step {i + 1} · {s.label}
                </p>
                <h3 className={cn("mt-2 font-heading text-[26px] font-bold leading-tight tracking-[-0.025em] transition-colors duration-300 sm:text-[30px]", on ? "text-ink" : "text-ink lg:text-ink/40")}>
                  {s.title}
                </h3>
                <p className={cn("mt-3 max-w-lg text-[16px] leading-relaxed transition-colors duration-300", on ? "text-ink-2" : "text-ink-2 lg:text-ink-2/50")}>{s.body}</p>
                <ul className="mt-5 space-y-2">
                  {s.points.map((p) => (
                    <li key={p} className={cn("flex items-start gap-2.5 text-[14.5px] transition-opacity duration-300", on ? "opacity-100" : "lg:opacity-50")}>
                      <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.5} aria-hidden /> <span className="text-ink">{p}</span>
                    </li>
                  ))}
                </ul>
                {/* Phones and tablets: the picture sits under each step */}
                <div className={cn("mt-8 rounded-2xl border border-line bg-canvas p-5 lg:hidden", s.mobileHeight)}>
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
                  Step {active + 1} of {HOW_STEPS.length} <span className="font-normal text-muted">· {step.title}</span>
                </p>
                <span className="flex gap-1.5" aria-hidden>
                  {HOW_STEPS.map((s, i) => (
                    <span key={s.title} className={cn("h-1.5 rounded-full transition-all duration-300", i === active ? "w-6 bg-brand-gradient" : "w-1.5 bg-line-strong")} />
                  ))}
                </span>
              </div>
              <div className="relative h-[460px] bg-canvas/60">
                {HOW_STEPS.map((s, i) => (
                  <div
                    key={s.title}
                    className={cn("absolute inset-7 transition-[opacity,transform] duration-500 ease-out", i === active ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0")}
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
        <p className="text-[13.5px] text-muted">Free to search · No account needed to browse</p>
      </Reveal>
    </Section>
  );
}

/* ═══ 5 · Smart tutor matching — a short guided start on a deep navy stage ═══════════ */

const matchField =
  "h-14 w-full appearance-none rounded-xl border border-line-strong bg-surface pl-14 pr-12 text-[16px] text-ink outline-none transition-colors hover:border-ink/40 focus:border-[#5b8cff] focus:ring-2 focus:ring-[#5b8cff]/30";

function MatchSelect({
  icon: Icon,
  label,
  error,
  children,
  ...props
}: { icon: LucideIcon; label: string; error?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = React.useId();
  return (
    <div>
      <label htmlFor={id} className="mb-2.5 block text-[16px] font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(matchField, !props.value && "text-muted", error && "border-danger")}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-5 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-2 text-[13.5px] text-red-300">
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
    <section aria-labelledby="match-title" className="relative isolate overflow-hidden bg-canvas">
      {/* Soft light from the top left */}
      <div className="pointer-events-none absolute -left-40 -top-40 -z-10 size-[620px] rounded-full bg-[#dfe5ff]/60 blur-3xl" aria-hidden />

      <div className="container-page grid items-center gap-14 py-20 sm:py-24 lg:grid-cols-[1fr_1.02fr] lg:gap-16 lg:py-28">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-3.5 py-1.5 text-[14px] font-semibold text-brand">
              <Zap className="size-4 fill-current" aria-hidden /> Smart tutor matching
            </span>
          </Reveal>
          <h2 id="match-title" className="mt-6 font-heading text-[2.9rem] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink sm:text-[3.6rem] lg:text-[4.1rem]">
            <WordReveal as="span" inView className="block" text="Find a tutor that" delay={0.05} />
            <Reveal as="span" delay={0.25} className="block">
              <span className="bg-gradient-to-r from-[#3b82f6] via-[#4f6ef7] to-[#8b5cf6] bg-clip-text pb-1 text-transparent">fits you.</span>
            </Reveal>
          </h2>
          <Reveal delay={0.1}>
            <p className="mt-5 text-[18px] text-ink-2 sm:text-[20px]">Tell us a little about what you want to learn.</p>
            <ul className="mt-6 flex flex-wrap gap-x-7 gap-y-2 text-[15.5px] text-ink-2">
              {["Takes about 2 minutes", "No account needed"].map((x) => (
                <li key={x} className="flex items-center gap-2.5">
                  <Check className="size-5 text-success" strokeWidth={2.5} aria-hidden /> {x}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.2}>
            <form onSubmit={submit} noValidate className="mt-10 max-w-[624px] space-y-6">
              <MatchSelect
                icon={BookOpen}
                label="What do you want to learn?"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setError(false);
                }}
                error={error ? "Choose a subject to see your matches." : undefined}
              >
                <option value="">Choose a subject</option>
                {SUBJECT_CATEGORIES.map((c) => (
                  <optgroup key={c.slug} label={c.name}>
                    {SUBJECTS.filter((s) => s.category === c.slug).map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </MatchSelect>
              <MatchSelect icon={ChartNoAxesColumnIncreasing} label="What's your level?" value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">Select your level</option>
                {GRADES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </MatchSelect>
              <button
                type="submit"
                className="group flex h-16 w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#2f8cff] via-[#4b74fb] to-[#7b5cf5] text-[18px] font-semibold text-white shadow-[0_12px_32px_-12px_rgb(79_110_247/0.8)] transition-[filter,transform] hover:brightness-110 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Find my matches <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden />
              </button>
              <p className="flex items-start gap-3 text-[15px] leading-snug text-ink-2">
                <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
                <span>
                  Your answers help us find tutors
                  <br />
                  that match your goals.
                </span>
              </p>
            </form>
            <p className="mt-8 flex max-w-[624px] items-center gap-3 border-t border-line pt-6 text-[14.5px] text-muted">
              <ShieldCheck className="size-5 shrink-0" aria-hidden /> Paid placement never affects the ranking.
            </p>
          </Reveal>
        </div>

        {/* Photo on a blue shape, with a small card about how matches are made */}
        <Reveal delay={0.15} className="relative mx-auto w-full max-w-[600px] lg:mx-0">
          <svg className="absolute -right-6 -top-14 -z-10 h-[115%] w-[118%] text-[#dfe5ff] sm:-right-10" viewBox="0 0 600 560" fill="currentColor" aria-hidden>
            <path d="M462 18c58-14 112 10 124 60 14 58-8 118-2 182 7 72 16 148-26 202-46 59-138 70-222 72-86 2-176-12-236-64C40 418-6 330 30 268c26-45 74-42 112-86 36-42 44-112 96-140 60-32 156 0 224-24z" />
          </svg>
          <svg className="absolute -right-3 -top-8 size-12 text-[#7b6cf6] sm:-right-8 sm:-top-10" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" aria-hidden>
            <path d="M18 6l-3 12M38 12l-10 9M44 30l-12 1" />
          </svg>
          <div data-match-photo className="relative aspect-[1.08] overflow-hidden rounded-[28px] shadow-2xl">
            <Image src="/images/online-lesson.jpg" alt="A student with headphones taking notes during an online lesson" fill sizes="(min-width: 1024px) 600px, 100vw" className="object-cover object-[58%_40%]" />
          </div>
          <div className="absolute -bottom-6 -left-3 flex items-center gap-3.5 rounded-2xl border border-line bg-white/95 p-4 pr-6 shadow-xl backdrop-blur-md sm:-left-10 sm:bottom-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#2f5bff] text-white">
              <Users className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-[15px] font-semibold text-ink">Matches in {SUBJECTS.length} subjects</span>
              <span className="block text-[13.5px] text-muted">ranked on 8 clear factors</span>
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══ 6 · Featured tutors ═══════════════════════════════════════════════════════ */

export function FeaturedTutors() {
  const tutors = useTutors();
  const featured = tutors.filter((t) => t.featured && t.verification.identity === "verified").slice(0, 4);
  return (
    <Section tone="canvas">
      <SectionHeading
        title="Meet some of our tutors"
        description="Experienced, identity-verified tutors. Featured placement never affects search ranking or match scores."
        action={<ArrowLink href="/tutors">Browse all tutors</ArrowLink>}
      />
      {featured.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <p className="text-[17px] font-semibold text-ink">No tutors to show yet</p>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-muted">Tutors appear here once they join and complete identity verification.</p>
          <Button asChild variant="brand" className="mt-6">
            <Link href="/become-a-tutor">
              Become a tutor <ArrowRight />
            </Link>
          </Button>
        </div>
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.07}>
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

/* ═══ 7 · Why families choose TutorLink — a bento grid ═══════════════════════════════ */

const CHECK_TYPES = ["Identity", "Education", "Certification", "Background"];

function BentoTile({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <StaggerItem className={cn("h-full", className)}>
      <div data-spotlight className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface p-6 sm:p-7">
        {children}
      </div>
    </StaggerItem>
  );
}

function TileText({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <>
      <span className="grid size-10 place-items-center rounded-lg border border-line text-brand">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="mt-5 font-heading text-[20px] font-bold tracking-[-0.015em] text-ink">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{body}</p>
    </>
  );
}

export function WhyTutorLink() {
  return (
    <Section>
      <SectionHeading align="center" eyebrow="Why TutorLink" title="Why families choose TutorLink" accent={1} />
      <Stagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-[minmax(250px,auto)_minmax(250px,auto)]" stagger={0.07}>
        {/* Large photo tile */}
        <BentoTile className="md:col-span-2 lg:row-span-2">
          <div className="absolute inset-0" aria-hidden>
            <Image src="/images/family.jpg" alt="" fill sizes="(min-width: 1024px) 600px, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-night via-night/70 to-night/5" />
          </div>
          <div className="relative mt-auto pt-48 sm:pt-64 lg:pt-0">
            <span className="grid size-10 place-items-center rounded-lg border border-white/20 bg-white/10 text-white backdrop-blur">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            <h3 className="mt-5 font-heading text-[26px] font-bold leading-tight tracking-[-0.02em] text-white sm:text-[30px]">Tutors you can trust</h3>
            <p className="mt-2 max-w-md text-[15.5px] leading-relaxed text-white/75">
              Checks are shown on every profile — a badge appears only once a check is complete.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Checks a tutor can complete">
              {CHECK_TYPES.map((c) => (
                <li key={c} className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-[13px] font-medium text-white backdrop-blur">
                  <BadgeCheck className="size-3.5" aria-hidden /> {c}
                </li>
              ))}
            </ul>
          </div>
        </BentoTile>

        {/* Wide tile: goals → plan */}
        <BentoTile className="md:col-span-2">
          <TileText icon={Target} title="A plan built around your goals" body="Share the grade, goals and schedule. Tutors shape lessons around them and leave notes after every session." />
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-6 text-[13px] font-medium" aria-hidden>
            {["Grade", "Goals", "Schedule"].map((x) => (
              <span key={x} className="rounded-md border border-line px-2.5 py-1 text-ink-2">
                {x}
              </span>
            ))}
            <ArrowRight className="size-4 text-muted" />
            <span className="rounded-md bg-brand-gradient px-2.5 py-1 text-white">Your lesson plan</span>
          </div>
        </BentoTile>

        <BentoTile>
          <TileText icon={CalendarDays} title="Online or in person" body={`Book real openings in your time zone. Reschedule up to ${DEFAULT_POLICY.rescheduleMinHours} hours before.`} />
        </BentoTile>

        <BentoTile>
          <TileText icon={LineChart} title="Progress you can see" body="Homework, attendance and goals in one dashboard." />
          <div className="mt-auto flex h-20 items-end gap-1.5 pt-5" aria-hidden>
            {[30, 42, 38, 55, 64, 80].map((h, i) => (
              <span key={i} className="flex-1 rounded-sm bg-brand-gradient" style={{ height: `${h}%`, opacity: 0.35 + i * 0.12 }} />
            ))}
          </div>
        </BentoTile>
      </Stagger>
      <Reveal delay={0.2} className="mt-10 flex justify-center">
        <Button asChild size="lg" variant="brand">
          <Link href="/for-parents">
            How it works for parents <ArrowRight />
          </Link>
        </Button>
      </Reveal>
    </Section>
  );
}

/* ═══ 8 · Stories (illustrative, clearly labelled) ═══════════════════════════════ */

export function Stories() {
  // Only real (or, in the demo, clearly labelled) stories — the section hides when there are none.
  if (SAMPLE_TESTIMONIALS.length === 0) return null;
  return (
    <Section tone="brand">
      <SectionHeading align="center" eyebrow="Stories" title="What families and students tell us" />
      <Stagger className="grid gap-5 lg:grid-cols-3" stagger={0.08}>
        {SAMPLE_TESTIMONIALS.map((t) => (
          <StaggerItem key={t.name}>
            <figure className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-sm">
              <span className="font-heading text-[44px] leading-none text-brand" aria-hidden>
                “
              </span>
              <blockquote className="mt-2 flex-1 text-[16.5px] leading-relaxed text-ink">{t.quote}</blockquote>
              <figcaption className="mt-6 border-t border-line pt-4">
                <span className="block text-[15px] font-semibold text-ink">{t.name}</span>
                <span className="block text-[13.5px] text-muted">{t.context}</span>
              </figcaption>
            </figure>
          </StaggerItem>
        ))}
      </Stagger>
      <p className="mt-8 text-center text-[13px] text-muted">Illustrative stories for this preview. Published testimonials will come from verified, consenting customers.</p>
    </Section>
  );
}

/* ═══ 9 · Become a tutor ════════════════════════════════════════════════════════ */

export function BecomeTutor() {
  const perks = [
    { icon: Briefcase, title: "Find new students", body: "Browse requirements families post and apply with a personal note." },
    { icon: CalendarDays, title: "Teach on your schedule", body: "Weekly availability, buffers, minimum notice and optional instant booking." },
    { icon: CreditCard, title: "Get paid securely", body: "Payments through Stripe with payouts to your bank on a clear schedule." },
  ];
  return (
    <Section tone="canvas">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading className="mb-8" eyebrow="For tutors" title="Become a tutor on TutorLink" description="Earn money sharing what you know with students across the U.S. Teach online, in person, or both — at the rate you set." />
          <Stagger className="space-y-5" stagger={0.08}>
            {perks.map((p) => (
              <StaggerItem key={p.title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <p.icon className="size-5" />
                </span>
                <span>
                  <span className="block text-[16.5px] font-semibold text-ink">{p.title}</span>
                  <span className="mt-0.5 block text-[15px] leading-relaxed text-ink-2">{p.body}</span>
                </span>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal delay={0.2} className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
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
            <Image src="/images/become-a-tutor.jpg" alt="A tutor smiling while working on a laptop" fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
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
    <Section tone="canvas">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading className="mb-6" eyebrow="FAQ" title="Questions? We've got answers." />
          <Reveal delay={0.1} className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button asChild variant="secondary">
              <Link href="/faq">All FAQs</Link>
            </Button>
            <ArrowLink href="/contact">Contact support</ArrowLink>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <Accordion type="single" collapsible className="border-t border-line">
            {faqs.map((f, k) => (
              <AccordionItem key={f.q} value={`f${k}`} className="border-b border-line">
                <AccordionTrigger className="py-5 text-left text-[17px] font-semibold sm:text-[18px]">{f.q}</AccordionTrigger>
                <AccordionContent className="text-[16px] leading-relaxed text-ink-2">{f.a}</AccordionContent>
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
