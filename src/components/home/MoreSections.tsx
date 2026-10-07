"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, BookOpenText, Brain, Calculator, CalendarCheck, Clock, Code, CreditCard, GraduationCap, Languages, MapPin, Monitor, Music,
  NotebookPen, ShieldCheck, Sparkles, Target, Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Section, SectionHeading, ArrowLink } from "@/components/marketing/Section";
import { SUBJECT_BY_SLUG } from "@/lib/data/catalog";
import { BLOG_POSTS } from "@/lib/data/content";
import { DEFAULT_POLICY } from "@/lib/data/platform";

/* ═══ Tutoring for every goal — a bento grid of goals, each with a small picture ══════════ */

type Goal = { icon: LucideIcon; title: string; body: string; subjects: string[]; href: string; wide?: boolean; visual?: React.ReactNode };

/** Step 1 → 3 of a typical test-prep plan. Illustrative — each tutor shapes their own plan. */
function PlanTimeline() {
  const steps = ["Diagnostic test", "Weekly practice", "Full practice test"];
  return (
    <div className="rounded-xl border border-line bg-page p-4" aria-hidden>
      <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-muted">How a plan can look</p>
      <ol className="relative mt-4 grid grid-cols-3 gap-2">
        <span className="absolute left-[16%] right-[16%] top-3.5 h-px bg-brand-gradient" />
        {steps.map((s, i) => (
          <li key={s} className="relative flex flex-col items-center text-center">
            <span className="grid size-7 place-items-center rounded-full bg-brand-gradient text-[12px] font-bold text-on-brand ring-4 ring-page">{i + 1}</span>
            <span className="mt-2 text-[12.5px] font-medium leading-tight text-ink">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PacePath() {
  return (
    <div className="flex items-center gap-1.5 text-[12.5px] font-medium" aria-hidden>
      <span className="rounded-full border border-line bg-page px-2 py-1 text-ink-2">Fill gaps</span>
      <ArrowRight className="size-3.5 text-muted" />
      <span className="rounded-full border border-line bg-page px-2 py-1 text-ink-2">On track</span>
      <ArrowRight className="size-3.5 text-muted" />
      <span className="rounded-md bg-brand-gradient px-2 py-1 text-on-brand">Ahead</span>
    </div>
  );
}

function Greetings() {
  const hello = [
    { word: "Hola", lang: "Spanish" },
    { word: "Bonjour", lang: "French" },
    { word: "你好", lang: "Mandarin" },
    { word: "Hello", lang: "English" },
  ];
  return (
    <div className="flex flex-wrap gap-2" aria-hidden>
      {hello.map((h) => (
        <span key={h.word} className="rounded-lg border border-line bg-page px-2.5 py-1.5 leading-none">
          <span className="block font-heading text-[15px] font-bold text-ink">{h.word}</span>
          <span className="mt-1 block text-[11px] text-muted">{h.lang}</span>
        </span>
      ))}
    </div>
  );
}

function SkillSnippets() {
  return (
    <div className="grid gap-2 sm:grid-cols-2" aria-hidden>
      <div className="rounded-xl bg-night p-4 font-mono text-[12.5px] leading-relaxed text-white/90">
        <span className="text-peach">for</span> step <span className="text-peach">in</span> plan:
        <br />
        &nbsp;&nbsp;learn(step)
        <br />
        <span className="text-[#b9a6ff]">print</span>(<span className="text-[#7ee2b8]">&quot;Done!&quot;</span>)
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-line bg-page p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-on-brand">
          <Music className="size-5" />
        </span>
        <span className="text-[13px] leading-snug text-ink-2">
          <span className="block font-semibold text-ink">Piano &amp; guitar</span>
          From first chords to your first song
        </span>
      </div>
    </div>
  );
}

const GOALS: Goal[] = [
  {
    icon: Target,
    title: "Ace a big test",
    body: "A clear plan for the SAT, ACT, AP exams, GRE or LSAT — with practice tests reviewed together, question by question.",
    subjects: ["sat", "act", "ap-exams", "gre", "lsat"],
    href: "/subjects#test-prep",
    wide: true,
    visual: <PlanTimeline />,
  },
  {
    icon: BookOpenText,
    title: "Keep up with homework",
    body: "Get unstuck on tonight's assignment — and understand the why, not just the answer.",
    subjects: ["algebra", "biology", "chemistry", "writing"],
    href: "/tutors",
  },
  {
    icon: Calculator,
    title: "Catch up or get ahead",
    body: "Close gaps from last year, or move ahead of the class at your own pace.",
    subjects: ["pre-algebra", "geometry", "reading"],
    href: "/subjects#math",
    visual: <PacePath />,
  },
  {
    icon: Brain,
    title: "Learn in a way that works for you",
    body: "Patient, specialised help with dyslexia, focus and organisation.",
    subjects: ["dyslexia-support", "executive-function", "study-skills"],
    href: "/subjects#learning-support",
  },
  {
    icon: Languages,
    title: "Speak a new language",
    body: "Conversation-first lessons that get you talking from day one.",
    subjects: ["spanish", "french", "mandarin", "esl"],
    href: "/subjects#languages",
    visual: <Greetings />,
  },
  {
    icon: Code,
    title: "Build a new skill",
    body: "Write your first program, build a website, or learn the songs you love — for school, a career or just for fun.",
    subjects: ["python", "web-development", "piano", "guitar"],
    href: "/subjects#computer-science",
    wide: true,
    visual: <SkillSnippets />,
  },
];

function GoalCard({ goal }: { goal: Goal }) {
  return (
    <article data-spotlight className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6 sm:p-7">
      <div className={cn("flex flex-1 flex-col gap-6", goal.wide && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8")}>
        <div className="flex flex-col">
          <span className="grid size-11 place-items-center rounded-xl border border-line text-brand">
            <goal.icon className="size-5" aria-hidden />
          </span>
          <h3 className="mt-5 font-heading text-[21px] font-bold leading-tight tracking-[-0.02em] text-ink">{goal.title}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{goal.body}</p>
          <ul className="mt-5 flex flex-wrap gap-1.5">
            {goal.subjects.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/tutors?subject=${slug}`}
                  className="inline-flex rounded-full border border-line px-2.5 py-1 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-brand/40 hover:bg-brand-50 hover:text-brand"
                >
                  {SUBJECT_BY_SLUG[slug]?.name ?? slug}
                </Link>
              </li>
            ))}
          </ul>
          {/* Small cards: the picture sits under the topics. Wide cards show it in their own column. */}
          {goal.visual && <div className={cn("mt-5", goal.wide && "lg:hidden")}>{goal.visual}</div>}
          <Link href={goal.href} className="group mt-auto inline-flex items-center gap-1.5 pt-6 text-[14.5px] font-semibold text-brand">
            Explore <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
        {goal.visual && goal.wide && <div className="hidden self-center lg:block">{goal.visual}</div>}
      </div>
    </article>
  );
}

export function Programs() {
  return (
    <Section>
      <div className="mb-12 flex flex-col gap-6 lg:mb-14 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          className="mb-0 lg:mb-0"
          eyebrow="Tutoring for every goal"
          title="Start with your goal"
          accent={2}
          description="Homework help tonight, a big test next month or a brand-new skill — tell us what you're working toward and find a tutor who teaches it."
        />
        <Reveal delay={0.1} className="shrink-0">
          <ArrowLink href="/subjects">Browse all subjects</ArrowLink>
        </Reveal>
      </div>

      <Stagger className="swipe-row grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5" stagger={0.06}>
        {GOALS.map((g) => (
          <StaggerItem key={g.title} className={cn("h-full", g.wide && "md:col-span-2")}>
            <GoalCard goal={g} />
          </StaggerItem>
        ))}
        <StaggerItem className="h-full">
          <Link
            href="/concierge"
            className="group flex h-full flex-col justify-between gap-6 rounded-2xl border border-dashed border-line-strong p-6 transition-colors hover:border-brand/50 hover:bg-surface sm:p-7"
          >
            <span>
              <span className="grid size-11 place-items-center rounded-xl bg-brand-gradient text-on-brand">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <span className="mt-5 block font-heading text-[21px] font-bold leading-tight tracking-[-0.02em] text-ink">Not sure yet?</span>
              <span className="mt-2 block text-[15px] leading-relaxed text-ink-2">Answer two quick questions and get a shortlist of tutors, with the reasons each one fits.</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-brand">
              Help me find a tutor <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </Link>
        </StaggerItem>
      </Stagger>
    </Section>
  );
}

/* ═══ Online or in person — two mode cards, an "or" between them, and what stays the same ═══ */

type Mode = {
  key: "online" | "in_person";
  icon: LucideIcon;
  title: string;
  bestFor: string;
  image: string;
  alt: string;
  points: string[];
  cta: { href: string; label: string };
};

/* Short on purpose: one line on who it suits, the two or three facts that differ, and a link. What is the same either way sits in one row below. */
const MODES: Mode[] = [
  {
    key: "online",
    icon: Monitor,
    title: "Online lessons",
    bestFor: "Busy schedules, test prep, any tutor in the U.S.",
    image: "/images/video-call-lesson.jpg",
    alt: "A learner greeting her tutor on a video call",
    points: [`Secure video link, opens ${DEFAULT_POLICY.meetingLinkVisibleMinutesBefore} min before the lesson`, "No travel — lessons fit around school and work"],
    cta: { href: "/tutors?mode=online", label: "Find online tutors" },
  },
  {
    key: "in_person",
    icon: MapPin,
    title: "In-person lessons",
    bestFor: "Younger learners, hands-on subjects, the same table.",
    image: "/images/lesson-in-person.jpg",
    alt: "Two people working through notes together at a library table",
    points: ["Search by ZIP code and how far you'll travel", "Meet at home, a library or a place you agree on", "Tutors share an area, never a home address"],
    cta: { href: "/tutors?mode=in_person", label: "Find tutors near you" },
  },
];

const SAME_EITHER_WAY: { icon: LucideIcon; text: string }[] = [
  { icon: CalendarCheck, text: "Real openings in your time zone" },
  { icon: CreditCard, text: "Pay per lesson, no subscription" },
  { icon: ShieldCheck, text: `Free cancellation up to ${DEFAULT_POLICY.freeCancellationHours} h before` },
  { icon: NotebookPen, text: "Notes and homework saved" },
];

function ModeCard({ mode, index }: { mode: Mode; index: number }) {
  return (
    <article className="group flex h-full flex-col bg-surface">
      <div className="relative aspect-[16/9] overflow-hidden bg-canvas">
        <Image src={mode.image} alt={mode.alt} fill sizes="(min-width: 1024px) 600px, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
      </div>
      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <p className="mono-label flex items-center gap-2">
          <mode.icon className="size-4 text-brand" aria-hidden />
          0{index + 1} · {mode.key === "online" ? "Online" : "In person"}
        </p>
        <h3 className="mt-3 font-heading text-[1.9rem] leading-none text-ink sm:text-[2.2rem]">{mode.title}</h3>
        <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{mode.bestFor}</p>
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {mode.points.map((p) => (
            <li key={p} className="py-2.5 text-[14.5px] leading-snug text-ink">
              {p}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-6">
          <ArrowLink href={mode.cta.href}>{mode.cta.label}</ArrowLink>
        </div>
      </div>
    </article>
  );
}

export function LessonModes() {
  return (
    <Section tone="canvas">
      <SectionHeading align="center" eyebrow="Online or in person" title="Learn where you learn best" accent={2} description="Every tutor sets where they teach — many offer both." />

      <div className="grid border border-line lg:grid-cols-2 lg:divide-x lg:divide-line">
        {MODES.map((m, i) => (
          <Reveal key={m.key} delay={i * 0.1} className={cn("h-full", i > 0 && "border-t border-line lg:border-t-0")}>
            <ModeCard mode={m} index={i} />
          </Reveal>
        ))}
      </div>

      {/* What is the same whichever you pick — one row, no card */}
      <Reveal delay={0.1} className="mt-5 grid gap-x-6 gap-y-3 border border-line px-5 py-4 sm:grid-cols-2 lg:grid-cols-[auto_repeat(4,minmax(0,1fr))] lg:items-center">
        <p className="mono-label sm:col-span-2 lg:col-span-1 lg:pr-2">Either way</p>
        {SAME_EITHER_WAY.map((x) => (
          <p key={x.text} className="flex items-center gap-2 text-[13.5px] leading-snug text-ink-2">
            <x.icon className="size-4 shrink-0 text-brand" aria-hidden /> {x.text}
          </p>
        ))}
      </Reveal>
    </Section>
  );
}

/* ═══ Built for every learner — three persona cards, side by side ══════════════════════ */

type Learner = {
  id: string;
  label: string;
  icon: LucideIcon;
  title: string;
  body: string;
  points: string[];
  startWith: string[];
  image: string;
  alt: string;
  cta: { href: string; label: string };
};

/* Short on purpose: a title, one line, three facts and three subjects per learner. The audience pages have the detail. */
const LEARNERS: Learner[] = [
  {
    id: "parents",
    label: "For parents",
    icon: Users,
    title: "Stay involved without hovering",
    body: "One account for every child. You choose, book and pay, and see how each lesson went.",
    points: ["A profile per child, with grade and goals", "Every message about your child", "Notes and attendance after each lesson"],
    startWith: ["reading", "pre-algebra", "study-skills"],
    image: "/images/father-and-son.jpg",
    alt: "A father helping his son with schoolwork at a laptop",
    cta: { href: "/for-parents", label: "Tutoring for your kids" },
  },
  {
    id: "students",
    label: "For students",
    icon: GraduationCap,
    title: "Help that fits your week",
    body: "A tutor for your exact course or exam, booked around everything else.",
    points: ["Tutors for your specific class or test", "Lessons around school and activities", "Progress tracked topic by topic"],
    startWith: ["algebra", "chemistry", "sat"],
    image: "/images/lesson-together.jpg",
    alt: "A tutor and a student working through a lesson together",
    cta: { href: "/for-students", label: "Tutoring for students" },
  },
  {
    id: "adults",
    label: "For adult learners",
    icon: Clock,
    title: "Something new, on your schedule",
    body: "A language, coding or a graduate exam, with evening and weekend lessons.",
    points: ["Evening and weekend availability", "Online from anywhere in the U.S.", "Your own pace, lesson by lesson"],
    startWith: ["spanish", "python", "gre"],
    image: "/images/adult-learner-online.jpg",
    alt: "An adult learner in an online lesson",
    cta: { href: "/tutors", label: "Browse tutors" },
  },
];

function LearnerCard({ learner: l, index }: { learner: Learner; index: number }) {
  return (
    <article className="group flex h-full flex-col bg-surface">
      <div className="relative aspect-[4/3] overflow-hidden bg-canvas">
        <Image src={l.image} alt={l.alt} fill sizes="(min-width: 1024px) 400px, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="mono-label flex items-center gap-2">
          <l.icon className="size-4 text-brand" aria-hidden />
          0{index + 1} · {l.label}
        </p>
        <h3 className="mt-3 font-heading text-[1.7rem] leading-[1.05] text-ink">{l.title}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{l.body}</p>
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {l.points.map((p) => (
            <li key={p} className="py-2.5 text-[14.5px] leading-snug text-ink">
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
          <span className="mono-label mr-2">Start with</span>
          {l.startWith.map((slug, i) => (
            <React.Fragment key={slug}>
              {i > 0 && (
                <span aria-hidden className="mx-1.5">
                  ·
                </span>
              )}
              <Link href={`/tutors?subject=${slug}`} className="text-ink-2 underline-offset-4 transition-colors hover:text-brand hover:underline">
                {SUBJECT_BY_SLUG[slug]?.name ?? slug}
              </Link>
            </React.Fragment>
          ))}
        </p>
        <div className="mt-auto pt-6">
          <ArrowLink href={l.cta.href}>{l.cta.label}</ArrowLink>
        </div>
      </div>
    </article>
  );
}

export function Audiences() {
  return (
    <Section>
      <SectionHeading align="center" eyebrow="Built for every learner" title="Made for kids, teens and grown-ups" accent={1} />
      <Stagger className="grid border border-line md:grid-cols-3 md:divide-x md:divide-line" stagger={0.08}>
        {LEARNERS.map((l, i) => (
          <StaggerItem key={l.id} className={cn("h-full", i > 0 && "border-t border-line md:border-t-0")}>
            <LearnerCard learner={l} index={i} />
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}

/* ═══ Learning resources — guides from the blog (Chegg / Varsity Tutors) ══════════ */

const CATEGORY_TINT: Record<string, string> = {
  Parents: "bg-brand-soft text-brand",
  Students: "bg-teal-soft text-teal",
  Tutors: "bg-violet-soft text-violet",
  "Test prep": "bg-sky-soft text-sky",
};

export function Resources() {
  const posts = [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  if (posts.length === 0) return null;
  return (
    <Section tone="canvas">
      <SectionHeading eyebrow="Learning resources" title="Guides for parents and students" description="Practical advice on choosing a tutor, preparing for exams and building good study habits." action={<ArrowLink href="/blog">All articles</ArrowLink>} />
      <Stagger className="swipe-row grid gap-5 md:grid-cols-3" stagger={0.08}>
        {posts.map((p) => (
          <StaggerItem key={p.slug}>
            <article className="group relative flex h-full flex-col rounded-2xl border border-line bg-surface p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <span className={cn("rounded-full px-2.5 py-1 text-[12.5px] font-medium", CATEGORY_TINT[p.category] ?? "bg-canvas text-ink-2")}>{p.category}</span>
                <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
                  <BookOpenText className="size-4" aria-hidden /> {p.readMinutes} min read
                </span>
              </div>
              <h3 className="mt-5 text-[19px] font-semibold leading-snug text-ink">
                <Link href={`/blog/${p.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                  {p.title}
                </Link>
              </h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">{p.excerpt}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-[14.5px] font-medium text-brand">
                Read the guide <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </article>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}
