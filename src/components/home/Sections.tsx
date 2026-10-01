"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight, BadgeCheck, BookOpen, Brain, Briefcase, Calculator, CalendarDays, Check, Code, CreditCard, FlaskConical, Gift, GraduationCap, Languages, LineChart,
  Music, Route, ShieldCheck, Star, Target, UserRound, Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, Stagger, StaggerItem, WordReveal, Magnetic, gsap, useGSAP } from "@/components/motion";
import { prefersReducedMotion } from "@/components/motion/gsap";
import { Section, SectionHeading, ArrowLink, Eyebrow } from "@/components/marketing/Section";
import { Button } from "@/components/ui/Button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/Disclosure";
import { TutorCard } from "@/components/domain/TutorCard";
import { Avatar } from "@/components/ui/Avatar";
import { SubjectSearch } from "./SubjectSearch";
import { GRADES, SUBJECTS, SUBJECT_BY_SLUG, SUBJECT_CATEGORIES } from "@/lib/data/catalog";
import { FAQS, SAMPLE_TESTIMONIALS } from "@/lib/data/content";
import { DEFAULT_POLICY } from "@/lib/data/platform";
import { useTutors } from "@/lib/store/hooks";

/* ═══ 1 · Hero — bold: black stage, huge type, lime accent, a learner climbing the stairs ═══ */

const HERO_FEATURES = [
  { icon: BadgeCheck, title: "Identity Checks", body: "Badge shown once verified" },
  { icon: CalendarDays, title: "Flexible Learning", body: "Book times that suit you" },
  { icon: Gift, title: "Free Trials", body: "Offered by many tutors" },
  { icon: Wallet, title: "Pay Per Lesson", body: "No subscription for families" },
];

/** The photo, the lime beam and the handwritten note. Photo only — no example data. */
function StairsVisual({ className, card = true }: { className?: string; card?: boolean }) {
  return (
    <div className={cn("pointer-events-none", className)} aria-hidden>
      {/* Lime slab behind the photo */}
      <div data-hero-slab className="absolute inset-0 bg-volt [clip-path:polygon(26%_0,52%_0,14%_58%,0_66%,0_40%)]" />
      {/* Photo, cut on a diagonal, with the lime light multiplied into the sunlit wall */}
      <div data-hero-photo className="absolute inset-0 [clip-path:polygon(34%_0,100%_0,100%_100%,6%_100%,6%_64%)]">
        <Image src="/images/hero-stairs.jpg" alt="" fill preload sizes="(min-width: 1024px) 56vw, 100vw" className="object-cover object-[45%_62%] grayscale" />
        <div className="absolute inset-0 bg-volt mix-blend-multiply [clip-path:polygon(26%_0,52%_0,14%_58%,0_66%,0_40%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-night via-night/60 to-transparent" />
      </div>

      {/* Handwritten note with an arrow toward the climber */}
      <div data-hero-note className={cn(
          "absolute -rotate-[14deg] font-hand font-semibold text-white [text-shadow:0_2px_14px_rgb(0_0_0/0.7)]",
          // Line height goes after the font sizes: tailwind-merge drops a leading-* that comes before a text-* size.
          card ? "left-[13%] top-[60%] text-[30px] xl:text-[34px]" : "left-[9%] top-[56%] text-[22px] sm:left-[12%] sm:text-[28px]",
          "leading-[0.95]",
        )}>
        Better skills,
        <br />
        brighter future
        <svg viewBox="0 0 120 70" className="absolute -right-20 -top-14 h-16 w-28 text-white" fill="none">
          <motion.path
            d="M4 62 C 30 60, 70 50, 104 12"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, delay: 1.5, ease: [0.65, 0, 0.35, 1] }}
          />
          <motion.path
            d="M90 10 L105 11 L103 26"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, delay: 2.35 }}
          />
        </svg>
      </div>

      {/* Small white card, top right: what a lesson is — no figures */}
      {card && (
        <div data-hero-card className="absolute right-[6%] top-[9%] w-[168px] rounded-2xl bg-white p-4 text-night shadow-2xl">
          <p className="font-heading text-[26px] font-black leading-none tracking-[-0.02em]">1-on-1</p>
          <p className="mt-1 text-[12.5px] text-slate-500">Private lessons</p>
          <div className="my-3 h-px bg-slate-200" />
          <p className="font-heading text-[26px] font-black leading-none tracking-[-0.02em]">Online</p>
          <p className="mt-1 text-[12.5px] text-slate-500">or in person</p>
        </div>
      )}
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
      tl.fromTo("[data-hero-slab]", { clipPath: "polygon(26% 0,26% 0,0% 66%,0% 66%,0% 40%)" }, { clipPath: "polygon(26% 0,52% 0,14% 58%,0% 66%,0% 40%)", duration: 1.2 }, 0.15)
        .fromTo("[data-hero-photo] img", { scale: 1.12, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1.6 }, 0.1)
        .fromTo(items, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.08 }, 0.55)
        .fromTo("[data-hero-note]", { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 1.2)
        .fromTo("[data-hero-card]", { autoAlpha: 0, y: 18, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.9 }, 1.0);
      gsap.to("[data-hero-card]", { y: -8, duration: 3.2, ease: "sine.inOut", repeat: -1, yoyo: true, delay: 2 });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative isolate overflow-hidden bg-night">
      <div className="dark">
        {/* Wide screens: the visual fills the right half, edge to edge */}
        <StairsVisual className="absolute inset-y-0 right-0 hidden w-[56%] lg:block" />

        <div className="container-page relative z-10 pb-10 pt-12 sm:pt-16 lg:pb-16 lg:pt-20 xl:pt-24">
          <div className="max-w-[560px] lg:max-w-[46%]">
            <p data-hero-in data-reveal className="text-[13px] font-bold uppercase tracking-[0.28em] text-volt">
              Learn <span className="px-1.5 text-white/40">/</span> Practice <span className="px-1.5 text-white/40">/</span> Grow
            </p>

            <h1 className="mt-5 font-heading text-[4.1rem] font-black uppercase leading-[0.86] tracking-[-0.025em] text-white sm:text-[6rem] lg:text-[6rem] xl:text-[7.25rem]">
              <WordReveal as="span" className="block" text="Build" delay={0.2} />
              <WordReveal as="span" className="block" text="your" delay={0.3} />
              <WordReveal as="span" className="block text-volt" text="future" delay={0.4} />
            </h1>

            <p data-hero-in data-reveal className="mt-7 max-w-md text-[16.5px] leading-relaxed text-slate-300 sm:text-[17.5px]">
              Learn with the right tutor. Grow with every lesson. Everything you need to get there, in one place.
            </p>

            <div data-hero-in data-reveal className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Button asChild size="lg" className="h-14 rounded-xl border-volt bg-volt px-7 text-[16px] font-bold text-night hover:border-volt-hover hover:bg-volt-hover active:bg-volt">
                <Link href="/tutors">
                  Find a Tutor <ArrowRight />
                </Link>
              </Button>
              <Link href="/how-it-works" className="group inline-flex items-center gap-3 text-[15.5px] font-semibold text-white">
                <span className="grid size-12 place-items-center rounded-full border border-white/30 transition-colors group-hover:border-volt group-hover:text-volt">
                  <Route className="size-5" aria-hidden />
                </span>
                How It Works
              </Link>
            </div>
          </div>
        </div>

        {/* Phones and tablets: the visual sits under the copy */}
        <div data-hero-in data-reveal className="relative h-[380px] sm:h-[480px] lg:hidden">
          <StairsVisual className="absolute inset-0" card={false} />
        </div>
      </div>

      {/* Feature bar — follows the page theme (white in light mode) */}
      <div className="container-page relative z-10 -mt-8 pb-8 sm:-mt-12 lg:mt-0 lg:pb-10">
        <Stagger className="grid grid-cols-1 gap-5 rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:grid-cols-2 sm:p-6 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-line lg:px-2 lg:py-6" stagger={0.07}>
          {HERO_FEATURES.map((f) => (
            <StaggerItem key={f.title} className="flex items-start gap-3.5 lg:px-6">
              <f.icon className="mt-0.5 size-6 shrink-0 text-ink" strokeWidth={1.8} aria-hidden />
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

/* ═══ 3 · Subjects — search first, then the eight most-asked-for areas ══════════════ */

/** Most popular first (top row), then the rest. Labels are the short names people search for. */
const SUBJECT_TILES: { slug: string; label: string; body: string; icon: LucideIcon }[] = [
  { slug: "math", label: "Mathematics", body: "Arithmetic to calculus and statistics", icon: Calculator },
  { slug: "science", label: "Science", body: "Biology, chemistry and physics", icon: FlaskConical },
  { slug: "english", label: "English", body: "Reading, writing and literature", icon: BookOpen },
  { slug: "test-prep", label: "Test Prep", body: "SAT, ACT, AP and graduate exams", icon: Target },
  { slug: "languages", label: "Languages", body: "Spanish, French, Mandarin and ESL", icon: Languages },
  { slug: "computer-science", label: "Coding", body: "Python, Java and web development", icon: Code },
  { slug: "arts", label: "Music & Arts", body: "Instruments, voice and art", icon: Music },
  { slug: "learning-support", label: "Study Skills", body: "Study habits, focus and support", icon: Brain },
];

function SubjectCard({ tile, tutorCount }: { tile: (typeof SUBJECT_TILES)[number]; tutorCount: number }) {
  const subjectCount = SUBJECTS.filter((s) => s.category === tile.slug).length;
  return (
    <Link
      href={`/subjects#${tile.slug}`}
      className="group flex h-full overflow-hidden rounded-2xl border border-line bg-surface shadow-xs transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1.5 hover:border-line-strong hover:shadow-xl focus-visible:-translate-y-1.5 sm:flex-col"
    >
      {/* Same frame for every photo: one ratio, one radius, one soft overlay */}
      <div className="relative w-28 shrink-0 overflow-hidden bg-canvas sm:aspect-[4/3] sm:w-auto">
        <Image
          src={`/images/subjects/${tile.slug}.jpg`}
          alt=""
          fill
          sizes="(min-width: 1024px) 300px, (min-width: 640px) 50vw, 112px"
          className="object-cover saturate-[0.85] transition-[transform,filter] duration-700 ease-out group-hover:scale-[1.07] group-hover:saturate-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-night/45 via-night/5 to-transparent" aria-hidden />
        <span className="absolute left-3 top-3 hidden size-10 place-items-center rounded-xl bg-white/95 text-night shadow-sm sm:grid" aria-hidden>
          <tile.icon className="size-5" />
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <h3 className="font-heading text-[17px] font-bold tracking-[-0.01em] text-ink sm:text-[19px]">{tile.label}</h3>
        <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-muted sm:mb-5 sm:text-[14px]">{tile.body}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-3 sm:border-t sm:border-line sm:pt-4">
          <span className="text-[13px] font-semibold tabular-nums text-ink-2">
            {tutorCount > 0 ? `${tutorCount} ${tutorCount === 1 ? "tutor" : "tutors"}` : `${subjectCount} subjects`}
          </span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-[13.5px] font-semibold text-brand">
            Find a tutor <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function SubjectTiles() {
  const tutors = useTutors();
  const counts = React.useMemo(() => {
    const out: Record<string, number> = {};
    for (const tile of SUBJECT_TILES) {
      const subjects = new Set(SUBJECTS.filter((s) => s.category === tile.slug).map((s) => s.slug));
      out[tile.slug] = tutors.filter((t) => t.subjects.some((s) => subjects.has(s))).length;
    }
    return out;
  }, [tutors]);

  return (
    <Section>
      <SectionHeading
        align="center"
        className="mb-8 lg:mb-10"
        title="Find the right tutor for what you want to learn"
        description="Search for a subject, a skill or a tutor by name — or start with one of the most popular areas below."
      />
      <Reveal className="relative z-20 mx-auto max-w-2xl">
        <SubjectSearch />
      </Reveal>

      <Stagger className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:mt-14 lg:grid-cols-4" stagger={0.05}>
        {SUBJECT_TILES.map((tile) => (
          <StaggerItem key={tile.slug} className="h-full">
            <SubjectCard tile={tile} tutorCount={counts[tile.slug] ?? 0} />
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal className="mt-10 flex justify-center lg:mt-12">
        <Button asChild variant="secondary" size="lg" className="h-13 px-7 text-[16px]">
          <Link href="/subjects" className="group">
            View all {SUBJECTS.length} subjects <ArrowRight className="transition-transform group-hover:translate-x-1" />
          </Link>
        </Button>
      </Reveal>
    </Section>
  );
}

/* ═══ 4 · How it works — three bordered cards: number, promise, short text, picture ═══ */

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

/** One photo with earlier "weeks" layered behind it. */
function ProgressLayers() {
  return (
    <div className="relative h-full" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ x: (2 - i) * 22, opacity: i === 2 ? 0 : 0.6 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 + (2 - i) * 0.08 }}
          className="absolute bottom-6 top-0 right-0 overflow-hidden rounded-lg border-2 border-surface bg-canvas shadow-md"
          style={{ left: i * 22, zIndex: i }}
        >
          <Image src="/images/online-lesson.jpg" alt="" fill sizes="(min-width: 1024px) 320px, 90vw" className="object-cover object-[30%_45%]" />
        </motion.div>
      ))}
    </div>
  );
}

const STEPS: { title: string; body: string; badge: string; visual: React.ComponentType }[] = [
  {
    title: "Find your tutor.",
    body: "Search by subject, grade, schedule and budget. Every result shows why the tutor is a good fit — never paid placement.",
    badge: "bg-[#86d9c9]",
    visual: TutorStack,
  },
  {
    title: "Start learning.",
    body: "Book a trial at a real opening in your time zone. Your tutor shapes every lesson around your goals from day one.",
    badge: "bg-volt",
    visual: VideoCall,
  },
  {
    title: "Grow with every lesson.",
    body: "Choose how often you meet, keep notes and goals in one place, and watch your confidence build week by week.",
    badge: "bg-[#7cb2ff]",
    visual: ProgressLayers,
  },
];

export function HowItWorks() {
  return (
    <Section>
      <SectionHeading title="How TutorLink works:" className="mb-8 lg:mb-10" />
      <Stagger className="grid gap-5 lg:grid-cols-3" stagger={0.1}>
        {STEPS.map((s, i) => (
          <StaggerItem key={s.title} className="h-full">
            <article className="flex h-full flex-col overflow-hidden rounded-lg border border-ink/25 bg-surface">
              <div className="px-6 pt-7 sm:px-8 sm:pt-8">
                <span className={cn("grid size-10 place-items-center rounded-md font-heading text-[22px] font-bold text-night", s.badge)}>{i + 1}</span>
                <h3 className="mt-6 font-heading text-[30px] font-bold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[34px]">{s.title}</h3>
                <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-ink-2">{s.body}</p>
              </div>
              <div className="mt-auto h-[270px] px-6 pt-8 sm:px-8">
                <s.visual />
              </div>
            </article>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}

/* ═══ 5 · Get matched — a short guided start ════════════════════════════════════ */

const fieldCls = "h-12 w-full rounded-lg border border-line-strong bg-surface px-3.5 text-[15px] text-ink outline-none transition-colors hover:border-subtle focus:border-brand focus:ring-1 focus:ring-brand";

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
    <Section>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <Eyebrow>Personalized matching</Eyebrow>
          <WordReveal as="h2" inView text="Tell us what you need. We'll show your best matches." className="mt-5 font-heading text-[2.1rem] font-bold leading-[1.08] tracking-[-0.025em] text-ink sm:text-[2.6rem]" />
          <Reveal delay={0.1}>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-ink-2">
              Answer a couple of questions and get a shortlist ranked on eight transparent factors — subject, grade, schedule, budget and more — with every score explained.
            </p>
            <ul className="mt-6 space-y-2.5 text-[15.5px] text-ink">
              {["Takes about 2 minutes", "No account needed", "Paid placement never affects the ranking"].map((x) => (
                <li key={x} className="flex items-center gap-2.5">
                  <Check className="size-5 text-brand" strokeWidth={2.5} /> {x}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.2}>
            <form onSubmit={submit} noValidate className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-md sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[14px] font-semibold text-ink">Subject</span>
                  <select
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value);
                      setError(false);
                    }}
                    aria-invalid={error || undefined}
                    aria-describedby={error ? "gm-subject-error" : undefined}
                    className={cn(fieldCls, error && "border-danger")}
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
                  </select>
                  {error && (
                    <span id="gm-subject-error" className="mt-1.5 block text-[13px] text-danger">
                      Choose a subject to see matches.
                    </span>
                  )}
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[14px] font-semibold text-ink">
                    Grade <span className="font-normal text-muted">(optional)</span>
                  </span>
                  <select value={grade} onChange={(e) => setGrade(e.target.value)} className={fieldCls}>
                    <option value="">Any grade</option>
                    {GRADES.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <Button type="submit" variant="brand" size="lg" className="mt-5 w-full">
                See my matches <ArrowRight />
              </Button>
            </form>
          </Reveal>
        </div>
        <Reveal delay={0.1} className="relative">
          <div className="relative aspect-[4/3.4] overflow-hidden rounded-2xl shadow-xl">
            <Image src="/images/online-lesson.jpg" alt="A student taking notes during an online lesson" fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
          </div>
        </Reveal>
      </div>
    </Section>
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

/* ═══ 7 · Why families choose TutorLink ═════════════════════════════════════════ */

const WHY = [
  { icon: ShieldCheck, title: "Tutors you can trust", body: "Identity, education, certification and background checks are shown on every profile — a badge appears only once a check is complete." },
  { icon: Target, title: "A plan built around your goals", body: "Share the grade, goals and schedule. Tutors shape lessons around them and leave notes after every session." },
  { icon: CalendarDays, title: "Flexible, online or in person", body: `Book real openings in your time zone and reschedule up to ${DEFAULT_POLICY.rescheduleMinHours} hours before a lesson.` },
  { icon: LineChart, title: "Progress you can see", body: "Homework, attendance and goal progress in one dashboard — parents see everything about their child's lessons." },
];

export function WhyTutorLink() {
  return (
    <Section>
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <Reveal className="relative order-2 lg:order-1">
          <div className="relative aspect-[4/3.6] overflow-hidden rounded-2xl shadow-xl">
            <Image src="/images/family.jpg" alt="A parent and her daughter reviewing schoolwork together" fill sizes="(min-width: 1024px) 520px, 100vw" className="object-cover" />
          </div>
        </Reveal>
        <div className="order-1 lg:order-2">
          <SectionHeading className="mb-8 lg:mb-10" eyebrow="Why TutorLink" title="Why families choose TutorLink" />
          <Stagger className="grid gap-6 sm:grid-cols-2" stagger={0.07}>
            {WHY.map((w) => (
              <StaggerItem key={w.title}>
                <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                  <w.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-[17px] font-semibold text-ink">{w.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{w.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal delay={0.2} className="mt-9">
            <Button asChild size="lg" variant="brand">
              <Link href="/for-parents">
                How it works for parents <ArrowRight />
              </Link>
            </Button>
          </Reveal>
        </div>
      </div>
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
    <section className="bg-brand">
      <div className="container-page flex flex-col items-start gap-8 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="font-heading text-[2.1rem] font-bold leading-[1.08] tracking-[-0.025em] text-white sm:text-[2.6rem]">Start with a trial lesson.</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-white/85">
            Search is free. Many tutors offer a free or low-cost trial, so you can find the right fit before you commit.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Magnetic>
            <Link href="/tutors" className="inline-flex h-14 items-center gap-2 rounded-lg bg-white px-7 text-[16px] font-semibold text-[#1d4ed8] transition-colors hover:bg-white/90">
              Find a tutor <ArrowRight className="size-5" />
            </Link>
          </Magnetic>
          <Link href="/become-a-tutor" className="inline-flex h-14 items-center rounded-lg border-2 border-white/60 px-7 text-[16px] font-semibold text-white transition-colors hover:border-white hover:bg-white/10">
            Become a tutor
          </Link>
        </div>
      </div>
    </section>
  );
}
