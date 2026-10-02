import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarCheck, Check, Eye, Gift, GitCompareArrows, Handshake, LineChart, MessageSquareLock, Search, Star, Video, type LucideIcon } from "lucide-react";
import { Reveal, Stagger, StaggerItem, WordReveal } from "@/components/motion";
import { AreaNav } from "@/components/content/AreaNav";
import { cn } from "@/lib/utils";
import { ArrowLink, CtaBand, Section, SectionHeading } from "@/components/marketing/Section";
import { Button } from "@/components/ui/Button";
import { HowItWorksView } from "@/components/marketing/HowItWorksView";
import { MatchingWeights } from "@/components/marketing/MatchingWeights";
import { PolicyDetails } from "@/components/marketing/Policies";
import { RefundTimeline } from "@/components/marketing/RefundTimeline";
import { trialStats } from "@/components/content/insights";
import { TUTORS } from "@/lib/data/tutors";
import { DEFAULT_POLICY } from "@/lib/data/platform";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How TutorLink works for families and tutors: search and compare, message safely, book a trial, pay securely, and see exactly how tutor matching is scored.",
  alternates: { canonical: "/how-it-works" },
};

const JUMP_LINKS = [
  { slug: "steps", name: "Step by step" },
  { slug: "matching", name: "How matching works" },
  { slug: "trials", name: "Trial lessons" },
  { slug: "policies", name: "Booking & policies" },
  { slug: "safety", name: "Safety" },
];

const TRIAL_STORY: { stage: string; icon: LucideIcon; title: string; points: string[] }[] = [
  {
    stage: "Before",
    icon: CalendarCheck,
    title: "Book and share your goals",
    points: ["Pick a real opening in your time zone", "See the trial's length and price up front", "Tell the tutor what you'd like help with"],
  },
  {
    stage: "During",
    icon: Video,
    title: "Get to know each other",
    points: ["Talk through goals and current level", "Try a short piece of real work together", "Ask how lessons and homework would run"],
  },
  {
    stage: "After",
    icon: Handshake,
    title: "Decide — no strings attached",
    points: ["Book regular lessons if it's a fit", "Or try another tutor — there's no obligation", "Leave a review once the lesson is complete"],
  },
];

const TRIAL_VS_REGULAR = [
  { label: "Price", trial: "Free or reduced — set by each tutor", regular: "The tutor's hourly rate" },
  { label: "Free cancellation", trial: `Up to ${DEFAULT_POLICY.trialFreeCancellationHours} hours before`, regular: `Up to ${DEFAULT_POLICY.freeCancellationHours} hours before` },
  { label: "How many", trial: "One with each tutor", regular: "As many as you like" },
  { label: "Commitment", trial: "None", regular: "Pay per lesson — no subscription" },
];

const JOURNEY: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Search, title: "Search", body: "Filter by subject, grade, schedule and budget" },
  { icon: GitCompareArrows, title: "Compare", body: "Profiles, completed checks and real reviews" },
  { icon: MessageSquareLock, title: "Message", body: "Ask questions — contact details stay private" },
  { icon: CalendarCheck, title: "Book a trial", body: "A real opening, shown in your time zone" },
  { icon: LineChart, title: "Learn and grow", body: "Notes, homework and goals after every lesson" },
];

export default function HowItWorksPage() {
  const trials = trialStats();
  return (
    <>
      <section className="relative bg-gradient-to-b from-brand-50 to-page">
        <div className="container-page grid grid-cols-1 items-center gap-14 pb-14 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16 lg:pb-20 lg:pt-20">
          <div>
            <Reveal>
              <p className="inline-flex items-center gap-2.5 text-[12.5px] font-semibold uppercase tracking-[0.16em] text-brand">
                <span className="h-px w-6 bg-brand-gradient" aria-hidden />
                How it works
              </p>
            </Reveal>
            <WordReveal
              text="A clear path from first search to steady progress."
              accent={2}
              className="mt-5 font-heading text-[2.5rem] font-bold leading-[1.04] tracking-[-0.03em] text-ink sm:text-[3.2rem] lg:text-[3.6rem]"
            />
            <Reveal delay={0.2}>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
                Here is exactly how TutorLink works — for families and for tutors. No subscriptions for families, no hidden ranking and no surprises at checkout.
              </p>
            </Reveal>
            <Reveal delay={0.3} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="brand" size="lg">
                <Link href="/tutors">
                  Find a tutor <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/become-a-tutor">Become a tutor</Link>
              </Button>
            </Reveal>
            <Reveal delay={0.4}>
              <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[14.5px] font-medium text-ink-2">
                {["No subscription for families", "No paid ranking", `Free cancellation up to ${DEFAULT_POLICY.freeCancellationHours}h before`].map((x) => (
                  <li key={x} className="inline-flex items-center gap-2">
                    <Check className="size-4 text-success" strokeWidth={2.6} aria-hidden /> {x}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* Your path: five milestones joined by a gradient line */}
          <Reveal delay={0.15} className="mx-auto w-full max-w-[520px] lg:mr-0">
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-[0_24px_60px_-34px_rgb(15_23_42/0.45)] sm:p-7">
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-muted">Your path</p>
                <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[12px] font-semibold text-brand">5 steps</span>
              </div>
              <Stagger as="ol" className="relative mt-6 space-y-4" stagger={0.1}>
                <span className="absolute bottom-6 left-5 top-6 w-px bg-[linear-gradient(to_bottom,var(--color-grad-from),var(--color-grad-to))]" aria-hidden />
                {JOURNEY.map((j, i) => (
                  <StaggerItem as="li" key={j.title} className="relative flex items-center gap-4">
                    <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-brand-gradient text-white shadow-md ring-4 ring-surface">
                      <j.icon className="size-[18px]" aria-hidden />
                    </span>
                    <span className={cn("flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-line px-4 py-3", i === JOURNEY.length - 1 ? "bg-brand-50" : "bg-page")}>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-semibold text-ink">{j.title}</span>
                        <span className="block truncate text-[13px] text-muted">{j.body}</span>
                      </span>
                      <span className="shrink-0 text-[12px] font-semibold tabular-nums text-subtle">0{i + 1}</span>
                    </span>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </Reveal>
        </div>
      </section>

      <AreaNav areas={JUMP_LINKS} icons={false} label="On this page" />

      <Section id="steps" className="scroll-mt-36">
        <HowItWorksView />
      </Section>

      <Section id="matching" tone="canvas" className="scroll-mt-36">
        <SectionHeading
          eyebrow="How matching works"
          title="A score you can read, not a black box."
          accent={4}
          description="Every tutor gets a match score from eight weighted factors. Change the example tutor below and watch the score add up — the same rules score every real result, with the reasons shown next to it."
        />
        <MatchingWeights />
      </Section>

      <Section id="trials" className="scroll-mt-36">
        <div className="mb-10 flex flex-col gap-6 lg:mb-12 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            className="mb-0 lg:mb-0"
            eyebrow="Trial lessons"
            title="Try the fit before you commit."
            accent={2}
            description="A trial is a short first lesson — free or at a reduced price — so the student and tutor can get to know each other and agree on a plan."
          />
          <Reveal delay={0.1} className="shrink-0">
            <Button asChild variant="brand">
              <Link href="/tutors?trial=1">
                Find tutors with trials <ArrowRight />
              </Link>
            </Button>
          </Reveal>
        </div>

        {/* Before / during / after */}
        <Stagger as="ol" className="grid gap-4 md:grid-cols-3" stagger={0.1}>
          {TRIAL_STORY.map((s, i) => (
            <StaggerItem as="li" key={s.stage} className="h-full">
              <div className="relative flex h-full flex-col rounded-2xl border border-line bg-surface p-6">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-gradient text-white">
                    <s.icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-heading text-[13px] font-bold uppercase tracking-[0.16em] text-brand">{s.stage}</span>
                </div>
                <h3 className="mt-5 font-heading text-[19px] font-bold tracking-[-0.015em] text-ink">{s.title}</h3>
                <ul className="mt-3 space-y-2">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-[14.5px] leading-snug text-ink-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.6} aria-hidden /> {p}
                    </li>
                  ))}
                </ul>
                {i < TRIAL_STORY.length - 1 && (
                  <span className="absolute -right-3 top-1/2 z-10 hidden size-6 -translate-y-1/2 place-items-center rounded-full border border-line bg-page text-muted md:grid" aria-hidden>
                    <ArrowRight className="size-3.5" />
                  </span>
                )}
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {/* Trial vs regular lesson */}
        <Reveal className="mt-6">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <table className="w-full text-left text-[13.5px] sm:text-[14.5px]">
              <caption className="sr-only">How a trial lesson differs from a regular lesson</caption>
              <thead>
                <tr className="border-b border-line bg-canvas text-[12.5px] uppercase tracking-[0.12em] text-muted">
                  <th scope="col" className="px-5 py-3 font-semibold sm:px-6">
                    <span className="sr-only">Detail</span>
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-brand">
                    <span className="inline-flex items-center gap-1.5">
                      <Gift className="size-4" aria-hidden /> Trial lesson
                    </span>
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold sm:px-6">Regular lesson</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {TRIAL_VS_REGULAR.map((r) => (
                  <tr key={r.label}>
                    <th scope="row" className="px-3.5 py-3.5 font-semibold text-ink sm:px-6">{r.label}</th>
                    <td className="bg-brand-50/60 px-3 py-3.5 text-ink sm:px-4">{r.trial}</td>
                    <td className="px-3 py-3.5 text-ink-2 sm:px-6">{r.regular}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        {TUTORS.length > 0 && (
          <Reveal delay={0.1}>
            <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-line bg-canvas px-5 py-3.5 text-[14.5px] text-ink-2">
              <span>
                <span className="font-semibold tabular-nums text-ink">{trials.offering}</span> of the <span className="tabular-nums">{TUTORS.length}</span> tutors listed today offer a trial —{" "}
                <span className="font-semibold tabular-nums text-ink">{trials.free}</span> of them for free.
              </span>
              <Link href="/tutors?trial=1" className="font-semibold text-brand underline-offset-4 hover:underline">
                See tutors with trials &rarr;
              </Link>
            </p>
          </Reveal>
        )}
      </Section>

      <Section id="policies" tone="canvas" className="scroll-mt-36">
        <SectionHeading
          eyebrow="Booking & policies"
          title="The rules, before you pay."
          accent={3}
          description="The same policy appears at checkout and on every lesson page. These are our current defaults — the exact terms for your booking are always shown before you confirm."
        />
        <Reveal>
          <RefundTimeline />
        </Reveal>
        <p className="mb-5 mt-12 flex items-center gap-2.5 text-[12.5px] font-semibold uppercase tracking-[0.16em] text-brand">
          <span className="h-px w-6 bg-brand-gradient" aria-hidden />
          If something doesn&rsquo;t go to plan
        </p>
        <PolicyDetails />
      </Section>

      <Section id="safety" className="scroll-mt-36">
        <SectionHeading
          eyebrow="Safety"
          title="Safeguards built into every step."
          action={<ArrowLink href="/trust-safety">Trust & safety in detail</ArrowLink>}
        />
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
          {[
            { icon: <BadgeCheck />, t: "Verified before badged", b: "Identity, education, certification and background checks each show a badge only once our team has completed them." },
            { icon: <Star />, t: "Reviews from real lessons", b: "Only a family with a completed booking can review that tutor, so every review is tied to a lesson that happened." },
            { icon: <MessageSquareLock />, t: "Protected messaging", b: "Phone numbers and emails are masked in messages. Conversations can be reported or blocked at any time." },
            { icon: <Eye />, t: "Oversight for minors", b: "Parents manage child profiles and can see messages, lessons and progress notes about their children." },
          ].map((it) => (
            <StaggerItem key={it.t} className="h-full">
              <div className="h-full rounded-2xl border border-line bg-surface p-5 sm:p-6">
                <span className="grid size-11 place-items-center rounded-lg bg-canvas text-ink [&_svg]:size-5">{it.icon}</span>
                <h3 className="mt-4 text-[17px] font-bold tracking-[-0.01em] text-ink">{it.t}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{it.b}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      <CtaBand
        title="Ready when you are."
        description="Search is free and so is messaging. Start with a trial and decide from there."
        primary={{ href: "/tutors", label: "Find a tutor" }}
        secondary={{ href: "/concierge", label: "Help me find a tutor" }}
      />
    </>
  );
}
