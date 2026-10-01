"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, BadgeCheck, Briefcase, CalendarCheck2, CalendarDays, Check, ChevronDown, CreditCard, Gift, LineChart, Lock,
  Search, ShieldCheck, Target, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, Stagger, StaggerItem, WordReveal, Magnetic, Marquee, gsap, useGSAP } from "@/components/motion";
import { prefersReducedMotion } from "@/components/motion/gsap";
import { Section, SectionHeading, ArrowLink, Eyebrow } from "@/components/marketing/Section";
import { Button } from "@/components/ui/Button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/Disclosure";
import { TutorCard } from "@/components/domain/TutorCard";
import { GRADES, SUBJECTS, SUBJECT_BY_SLUG, SUBJECT_CATEGORIES } from "@/lib/data/catalog";
import { HeroSearch } from "./HeroSearch";
import { FAQS, SAMPLE_TESTIMONIALS } from "@/lib/data/content";
import { TUTORS } from "@/lib/data/tutors";
import { DEFAULT_POLICY } from "@/lib/data/platform";
import { useTutors } from "@/lib/store/hooks";
import { formatCents } from "@/lib/format";

/* ═══ 1 · Hero — big promise and a subject search, beside two slowly drifting photo columns ═══ */

const HERO_COLUMNS = [
  ["/images/online-lesson.jpg", "/images/family-reading.jpg", "/images/in-person.jpg", "/images/adult-learner.jpg"],
  ["/images/hero-tutoring-close.jpg", "/images/online-class.jpg", "/images/become-a-tutor.jpg", "/images/family.jpg"],
];
const HERO_POPULAR = ["algebra", "sat", "reading", "spanish", "chemistry", "python"];

/** One column of photos that loops vertically (the list is drawn twice so the loop is seamless). Photos only — no example data. */
function PhotoColumn({ photos, duration, reverse }: { photos: string[]; duration: number; reverse?: boolean }) {
  return (
    <div className="h-full overflow-hidden">
      <div
        className="flex animate-marquee-y flex-col group-hover:[animation-play-state:paused]"
        style={{ "--marquee-duration": `${duration}s`, animationDirection: reverse ? "reverse" : undefined } as React.CSSProperties}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="flex flex-col gap-4 pb-4">
            {photos.map((src, i) => (
              <div key={src} className={cn("relative overflow-hidden rounded-3xl bg-canvas", i % 2 ? "aspect-[5/4]" : "aspect-[4/5]")}>
                <Image src={src} alt="" fill loading={copy === 0 && i < 3 ? "eager" : "lazy"} sizes="(min-width: 1280px) 280px, 24vw" className="object-cover" />
              </div>
            ))}
          </div>
        ))}
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
      gsap.fromTo(items, { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: "expo.out", stagger: 0.08, delay: 0.55 });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative overflow-hidden border-b border-line bg-surface">
      {/* Soft blue glow and a faint grid behind the copy */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-40 -top-40 size-[640px] rounded-full bg-brand-soft blur-3xl" />
        <div className="absolute inset-0 bg-line-grid mask-radial opacity-70" />
      </div>

      <div className="container-page relative grid grid-cols-1 items-center gap-12 pb-12 pt-12 sm:pb-16 sm:pt-16 lg:min-h-[640px] lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:py-0 xl:gap-20">
        <div className="text-center lg:py-20 lg:text-left">
          <div data-hero-in data-reveal className="flex justify-center lg:justify-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3.5 py-1.5 text-[13.5px] font-semibold text-ink-2 shadow-xs backdrop-blur">
              <span className="size-2 animate-pulse-dot rounded-full bg-brand" aria-hidden />
              Private tutoring · online and in person
            </span>
          </div>

          <h1 className="mt-6 font-heading text-[2.6rem] font-bold leading-[1.04] tracking-[-0.035em] text-ink sm:text-[3.5rem] lg:text-[3.9rem] xl:text-[4.4rem]">
            <WordReveal as="span" className="block" text="Learn with the right tutor." delay={0.1} />
            <WordReveal as="span" className="block text-brand" text="Grow with every lesson." delay={0.35} />
          </h1>

          <p data-hero-in data-reveal className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2 sm:text-[18.5px] lg:mx-0">
            Find a tutor for any subject, at your level and on your schedule &mdash; then learn one-to-one, online or in person.
          </p>

          <div data-hero-in data-reveal className="relative z-20 mx-auto mt-8 max-w-xl lg:mx-0">
            <HeroSearch />
          </div>

          <div data-hero-in data-reveal className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <span className="mr-1 text-[13.5px] font-medium text-muted">Popular:</span>
            {HERO_POPULAR.map((slug) => (
              <Link
                key={slug}
                href={`/tutors?subject=${slug}`}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13.5px] font-medium text-ink-2 transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand"
              >
                {SUBJECT_BY_SLUG[slug]?.name ?? slug}
              </Link>
            ))}
          </div>

          <p data-hero-in data-reveal className="mt-8 text-[14.5px] text-muted">
            Want to teach?{" "}
            <Link href="/become-a-tutor" className="group inline-flex items-center gap-1 font-semibold text-ink underline-offset-4 hover:underline">
              Become a tutor <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </p>
        </div>

        {/* Wide screens: two photo columns drifting in opposite directions */}
        <div data-hero-in data-reveal className="group relative hidden h-[640px] grid-cols-2 gap-4 mask-fade-y lg:grid" aria-hidden>
          <PhotoColumn photos={HERO_COLUMNS[0]} duration={46} />
          <div className="-mt-24 h-[calc(100%+6rem)]">
            <PhotoColumn photos={HERO_COLUMNS[1]} duration={52} reverse />
          </div>
        </div>

        {/* Phones and tablets: one row of photos sliding sideways */}
        <div data-hero-in data-reveal className="-mx-4 min-w-0 sm:-mx-6 lg:hidden" aria-hidden>
          <Marquee duration={50}>
            {[...HERO_COLUMNS[0], ...HERO_COLUMNS[1]].map((src, i) => (
              <div key={src} className="relative aspect-[4/5] w-36 shrink-0 overflow-hidden rounded-2xl bg-canvas sm:w-44">
                <Image src={src} alt="" fill loading={i < 3 ? "eager" : "lazy"} sizes="176px" className="object-cover" />
              </div>
            ))}
          </Marquee>
        </div>
      </div>
    </section>
  );
}

/* ═══ 2 · Trust bar — only things that are true of the product ═════════════════ */

const TRUST = [
  { icon: BadgeCheck, title: "Identity-verified tutors", body: "Badges appear only after a check is complete" },
  { icon: Gift, title: "Free trials with many tutors", body: "Meet first, then decide" },
  { icon: Wallet, title: "Pay per lesson", body: "No subscription or booking fee for families" },
  { icon: Lock, title: "Secure payments", body: "Processed by Stripe — card details never touch our servers" },
];

export function TrustBar() {
  return (
    <section className="border-b border-line bg-surface">
      <Stagger className="container-page grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:py-10" stagger={0.06}>
        {TRUST.map((t) => (
          <StaggerItem key={t.title} className="flex items-start gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <t.icon className="size-5" />
            </span>
            <span>
              <span className="block text-[15.5px] font-semibold text-ink">{t.title}</span>
              <span className="mt-0.5 block text-[14px] leading-snug text-muted">{t.body}</span>
            </span>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

/* ═══ 3 · Subjects — photo tiles + full A–Z directory ════════════════════════════ */

const TILE_CATEGORIES = ["math", "science", "english", "test-prep", "languages", "computer-science", "arts", "learning-support"];

function categoryStats(slug: string) {
  const subjects = SUBJECTS.filter((s) => s.category === slug).map((s) => s.slug);
  const tutors = TUTORS.filter((t) => t.subjects.some((s) => subjects.includes(s)));
  const from = tutors.length ? Math.min(...tutors.map((t) => t.hourlyRateCents)) : null;
  return { count: tutors.length, from };
}

export function SubjectTiles() {
  const [all, setAll] = React.useState(false);
  return (
    <Section>
      <SectionHeading title="Explore popular subjects" description="From kindergarten reading to AP Calculus, SAT prep and Python — online or near you." action={<ArrowLink href="/subjects">All subjects</ArrowLink>} />
      <Stagger className="grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-4 lg:grid-cols-4" stagger={0.05}>
        {TILE_CATEGORIES.map((slug) => {
          const cat = SUBJECT_CATEGORIES.find((c) => c.slug === slug)!;
          const { count, from } = categoryStats(slug);
          return (
            <StaggerItem key={slug}>
              <Link href={`/subjects#${slug}`} className="group block">
                <div className="relative aspect-[3/2] overflow-hidden rounded-xl bg-canvas">
                  <Image src={`/images/subjects/${slug}.jpg`} alt="" fill sizes="(min-width: 1024px) 300px, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <p className="mt-2.5 flex items-center justify-between gap-2 text-[15px] font-semibold text-ink sm:mt-3 sm:text-[17px]">
                  {cat.name}
                  <ArrowRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-brand" />
                </p>
                <p className="mt-0.5 text-[13px] text-muted sm:text-[14px]">
                  {count === 0 ? (
                    "No tutors yet"
                  ) : (
                    <>
                      {count} {count === 1 ? "tutor" : "tutors"}
                      {from !== null && <> · from {formatCents(from)}/hr</>}
                    </>
                  )}
                </p>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>

      <div className="mt-10 rounded-2xl border border-line bg-canvas">
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6">
          <span>
            <span className="block text-[16px] font-semibold text-ink">Browse all {SUBJECTS.length} subjects A–Z</span>
            <span className="block text-[14px] text-muted">Every subject our tutors teach, grouped by area</span>
          </span>
          <ChevronDown className={cn("size-5 shrink-0 text-ink transition-transform duration-300", all && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {all && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
              <div className="grid gap-8 border-t border-line px-5 py-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 xl:grid-cols-5">
                {SUBJECT_CATEGORIES.map((c) => (
                  <div key={c.slug}>
                    <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">{c.name}</p>
                    <ul className="mt-2.5 space-y-1.5">
                      {SUBJECTS.filter((s) => s.category === c.slug).map((s) => (
                        <li key={s.slug}>
                          <Link href={`/subjects/${s.slug}`} className="text-[14.5px] text-ink hover:text-brand hover:underline">
                            {s.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Section>
  );
}

/* ═══ 4 · How it works — three numbered cards ═══════════════════════════════════ */

const STEPS = [
  { title: "Find your tutor", body: "Search by subject, grade, schedule, budget and ZIP. Every match shows why it fits — never paid placement.", icon: Search },
  { title: "Book a trial lesson", body: "Pick a real opening in your time zone. Many tutors offer a free or low-cost trial so you can check the fit.", icon: CalendarCheck2 },
  { title: "Make progress every week", body: "Lesson notes, homework and goals in one place — and parents see it all for their kids.", icon: LineChart },
];

export function HowItWorks() {
  return (
    <Section tone="canvas">
      <SectionHeading align="center" eyebrow="How it works" title="Start learning in three simple steps" />
      <Stagger className="grid gap-5 lg:grid-cols-3" stagger={0.1}>
        {STEPS.map((s, i) => (
          <StaggerItem key={s.title}>
            <article className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-sm transition-shadow hover:shadow-lg">
              <div className="flex items-center justify-between">
                <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand transition-colors duration-300 group-hover:bg-brand group-hover:text-white">
                  <s.icon className="size-7" aria-hidden />
                </span>
                <span className="font-heading text-[40px] font-bold leading-none text-line-strong">{i + 1}</span>
              </div>
              <h3 className="mt-6 font-heading text-[22px] font-bold tracking-[-0.02em] text-ink">{s.title}</h3>
              <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{s.body}</p>
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
