"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, BookOpenText, Brain, Calculator, Check, Clock, Code, GraduationCap, Languages, MapPin, Monitor, PenLine, Target, Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Marquee, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Section, SectionHeading, ArrowLink } from "@/components/marketing/Section";
import { Button } from "@/components/ui/Button";
import { SUBJECTS, SUBJECT_BY_SLUG } from "@/lib/data/catalog";
import { BLOG_POSTS } from "@/lib/data/content";
import { DEFAULT_POLICY } from "@/lib/data/platform";

/* ═══ Subject strip — a moving band of every subject (Superprof / Chegg) ═════════ */

export function SubjectMarquee() {
  const half = Math.ceil(SUBJECTS.length / 2);
  const rows = [SUBJECTS.slice(0, half), SUBJECTS.slice(half)];
  return (
    <section aria-label="Subjects taught on TutorLink" className="border-b border-line bg-surface py-6">
      <div className="space-y-3">
        {rows.map((row, r) => (
          <Marquee key={r} duration={r === 0 ? 70 : 80} reverse={r === 1}>
            {row.map((s) => (
              <Link
                key={s.slug}
                href={`/subjects/${s.slug}`}
                className="whitespace-nowrap rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-medium text-ink-2 transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand"
              >
                {s.name}
              </Link>
            ))}
          </Marquee>
        ))}
      </div>
    </section>
  );
}

/* ═══ Tutoring for every goal (Varsity Tutors / Chegg / Brainfuse) ════════════════ */

const PROGRAMS: { icon: LucideIcon; title: string; body: string; subjects: string[]; href: string }[] = [
  { icon: Calculator, title: "Homework help", body: "Get unstuck on tonight's assignment — and understand the why, not just the answer.", subjects: ["algebra", "biology", "chemistry"], href: "/tutors" },
  { icon: Target, title: "Test prep", body: "Structured plans for the SAT, ACT, AP exams, GRE and LSAT, with practice tests reviewed together.", subjects: ["sat", "act", "ap-exams"], href: "/subjects#test-prep" },
  { icon: PenLine, title: "Reading & writing", body: "Build fluent readers and confident writers — from early reading to college essays.", subjects: ["reading", "writing", "college-essays"], href: "/subjects#english" },
  { icon: Brain, title: "Learning support", body: "Patient, specialized help with dyslexia, executive function and study skills.", subjects: ["dyslexia-support", "executive-function", "study-skills"], href: "/subjects#learning-support" },
  { icon: Languages, title: "World languages", body: "Conversation-first lessons in Spanish, French, Mandarin and English as a second language.", subjects: ["spanish", "french", "esl"], href: "/subjects#languages" },
  { icon: Code, title: "Coding & computer science", body: "Python, Java and web development — from first lines of code to AP Computer Science.", subjects: ["python", "java", "web-development"], href: "/subjects#computer-science" },
];

export function Programs() {
  return (
    <Section tone="canvas">
      <SectionHeading align="center" eyebrow="Tutoring for every goal" title="Whatever you're working toward, there's a tutor for it" />
      <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" stagger={0.06}>
        {PROGRAMS.map((p) => (
          <StaggerItem key={p.title}>
            <article className="group relative flex h-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-sm transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg">
              <span className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand transition-colors duration-300 group-hover:bg-brand group-hover:text-white">
                <p.icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-5 text-[19px] font-semibold text-ink">
                <Link href={p.href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                  {p.title}
                </Link>
              </h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-2">{p.body}</p>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {p.subjects.map((s) => (
                  <span key={s} className="rounded-md bg-canvas px-2.5 py-1 text-[12.5px] font-medium text-ink-2">
                    {SUBJECT_BY_SLUG[s]?.name}
                  </span>
                ))}
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-brand">
                Explore <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </article>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}

/* ═══ Online or in person (Skooli / Tutor.com / Wyzant) ═════════════════════════ */

const MODES = [
  {
    icon: Monitor,
    title: "Online lessons",
    image: "/images/online-class.jpg",
    alt: "A student following a tutor on a video call",
    points: [
      "Join from a laptop or tablet with a secure video link",
      `The link appears ${DEFAULT_POLICY.meetingLinkVisibleMinutesBefore} minutes before each lesson`,
      "Notes, homework and files kept in one place",
      "Learn with a tutor anywhere in the U.S.",
    ],
    cta: { href: "/tutors?mode=online", label: "Find online tutors" },
  },
  {
    icon: MapPin,
    title: "In-person lessons",
    image: "/images/in-person.jpg",
    alt: "A tutor and a student working together at a table",
    points: [
      "Search by ZIP code and distance",
      "Tutors share an approximate area — never a home address",
      "Meet at home, a library or another place you agree on",
      "Same booking, payment and cancellation rules as online",
    ],
    cta: { href: "/tutors?mode=in_person", label: "Find tutors near you" },
  },
];

export function LessonModes() {
  return (
    <Section>
      <SectionHeading eyebrow="Online or in person" title="Learn the way that works for you" description="Every tutor sets where they teach. Filter for online, in person, or both — the booking experience is the same." />
      <div className="grid gap-6 lg:grid-cols-2">
        {MODES.map((m, i) => (
          <Reveal key={m.title} delay={i * 0.1}>
            <article className="group h-full overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-shadow duration-300 hover:shadow-lg">
              <div className="relative aspect-[16/7] overflow-hidden">
                <Image src={m.image} alt={m.alt} fill sizes="(min-width: 1024px) 600px, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <div className="p-6 sm:p-7">
                <h3 className="flex items-center gap-3 text-[21px] font-semibold text-ink">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                    <m.icon className="size-5" aria-hidden />
                  </span>
                  {m.title}
                </h3>
                <ul className="mt-5 space-y-2.5">
                  {m.points.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-[15px] leading-snug text-ink-2">
                      <Check className="mt-0.5 size-4.5 shrink-0 text-brand" strokeWidth={2.6} aria-hidden /> {p}
                    </li>
                  ))}
                </ul>
                <ArrowLink href={m.cta.href} className="mt-6">
                  {m.cta.label}
                </ArrowLink>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ═══ Built for every learner — audience tabs (Varsity Tutors / Chegg) ═══════════ */

const AUDIENCES = [
  {
    id: "parents",
    tab: "Parents",
    icon: Users,
    title: "Stay involved without hovering",
    body: "One parent account covers every child. You choose the tutor, book and pay — and you can see how each lesson went.",
    points: ["A profile for each child with grade and goals", "See every message about your child", "Notes, homework and attendance after each lesson", "Parental consent built in for younger learners"],
    image: "/images/family-reading.jpg",
    alt: "A father and his son reading and writing together",
    cta: { href: "/for-parents", label: "Tutoring for your kids" },
  },
  {
    id: "students",
    tab: "Students",
    icon: GraduationCap,
    title: "Help that fits your classes and your week",
    body: "Find a tutor for your exact course or exam, book around practice and work, and keep track of what you've mastered.",
    points: ["Tutors for your specific class or test", "Lessons that fit around school and activities", "Free or low-cost trials with many tutors", "Topics mastered, tracked over time"],
    image: "/images/hero-tutoring-close.jpg",
    alt: "A tutor and a student working through a lesson together",
    cta: { href: "/for-students", label: "Tutoring for students" },
  },
  {
    id: "adults",
    tab: "Adult learners",
    icon: Clock,
    title: "Learn something new, on your schedule",
    body: "Pick up a language, learn to code or prepare for a professional exam — with evening and weekend lessons online or nearby.",
    points: ["Languages for travel, work or family", "Coding and career skills", "GRE, LSAT and other graduate exams", "Evening and weekend availability"],
    image: "/images/adult-learner.jpg",
    alt: "An adult learner in an online lesson",
    cta: { href: "/tutors", label: "Browse tutors" },
  },
];

export function Audiences() {
  const [tab, setTab] = React.useState(AUDIENCES[0].id);
  const current = AUDIENCES.find((a) => a.id === tab) ?? AUDIENCES[0];
  return (
    <Section tone="brand">
      <SectionHeading align="center" eyebrow="Built for every learner" title="Tutoring for families, students and adults" />
      <TabsPrimitive.Root value={tab} onValueChange={setTab}>
        <TabsPrimitive.List aria-label="Who is learning?" className="mx-auto mb-10 flex w-fit flex-wrap justify-center gap-1 rounded-xl border border-line bg-surface p-1.5 shadow-sm">
          {AUDIENCES.map((a) => (
            <TabsPrimitive.Trigger
              key={a.id}
              value={a.id}
              className={cn("relative inline-flex h-11 items-center gap-2 rounded-lg px-4 text-[15px] font-semibold transition-colors sm:px-5", tab === a.id ? "text-white" : "text-ink-2 hover:text-ink")}
            >
              {tab === a.id && <motion.span layoutId="audience-pill" className="absolute inset-0 rounded-lg bg-brand-gradient" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
              <a.icon className="relative size-4.5" aria-hidden />
              <span className="relative">{a.tab}</span>
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
        <TabsPrimitive.Content value={current.id} forceMount className="outline-none">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="grid items-center gap-10 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:p-10"
            >
              <div>
                <h3 className="font-heading text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[2rem]">{current.title}</h3>
                <p className="mt-4 text-[16.5px] leading-relaxed text-ink-2">{current.body}</p>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {current.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-[15px] leading-snug text-ink">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                        <Check className="size-3.5" strokeWidth={3} aria-hidden />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
                <Button asChild variant="brand" size="lg" className="mt-8">
                  <Link href={current.cta.href}>
                    {current.cta.label} <ArrowRight />
                  </Link>
                </Button>
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                <Image src={current.image} alt={current.alt} fill sizes="(min-width: 1024px) 520px, 100vw" className="object-cover" />
              </div>
            </motion.div>
          </AnimatePresence>
        </TabsPrimitive.Content>
      </TabsPrimitive.Root>
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
    <Section>
      <SectionHeading eyebrow="Learning resources" title="Guides for parents and students" description="Practical advice on choosing a tutor, preparing for exams and building good study habits." action={<ArrowLink href="/blog">All articles</ArrowLink>} />
      <Stagger className="grid gap-5 md:grid-cols-3" stagger={0.08}>
        {posts.map((p) => (
          <StaggerItem key={p.slug}>
            <article className="group relative flex h-full flex-col rounded-2xl border border-line bg-surface p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <span className={cn("rounded-md px-2.5 py-1 text-[12.5px] font-semibold", CATEGORY_TINT[p.category] ?? "bg-canvas text-ink-2")}>{p.category}</span>
                <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
                  <BookOpenText className="size-4" aria-hidden /> {p.readMinutes} min read
                </span>
              </div>
              <h3 className="mt-5 text-[19px] font-semibold leading-snug text-ink">
                <Link href={`/blog/${p.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                  {p.title}
                </Link>
              </h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-2">{p.excerpt}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-brand">
                Read the guide <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </article>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}
