import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarCheck, Check, Eye, GitCompareArrows, LineChart, MessageSquareLock, Search, Star, type LucideIcon } from "lucide-react";
import { Reveal, Stagger, StaggerItem, WordReveal } from "@/components/motion";
import { AreaNav } from "@/components/content/AreaNav";
import { cn } from "@/lib/utils";
import { ArrowLink, CtaBand, Section, SectionHeading } from "@/components/marketing/Section";
import { Button } from "@/components/ui/Button";
import { HowItWorksView } from "@/components/marketing/HowItWorksView";
import { MatchingWeights } from "@/components/marketing/MatchingWeights";
import { PolicyCards, PolicyDetails } from "@/components/marketing/Policies";
import { TrialVignette } from "@/components/marketing/Vignettes";
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
          description="When you search or use Help Me Find a Tutor, each tutor gets a match score from eight weighted factors. You see every factor, how it was scored and why — next to every result."
        />
        <MatchingWeights />
      </Section>

      <Section id="trials" className="scroll-mt-36">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading
              className="mb-8 lg:mb-10"
              eyebrow="Trial lessons"
              title="Try the fit before you commit."
              description="A trial is a short first lesson — free or at a reduced price — so the student and tutor can get to know each other and agree on a plan."
            />
            <Stagger className="space-y-5" stagger={0.08}>
              {[
                { t: "Terms set by each tutor", b: "Length, price and anything to bring are shown on the tutor's profile before you book." },
                { t: "One trial per tutor", b: "Each student can book one trial with each tutor. After that, you book regular lessons." },
                { t: `Free cancellation up to ${DEFAULT_POLICY.trialFreeCancellationHours} hours before`, b: `Plans change. Trials have a shorter free-cancellation window than regular lessons (${DEFAULT_POLICY.freeCancellationHours} hours).` },
              ].map((it) => (
                <StaggerItem key={it.t} className="border-l-[3px] border-brand pl-4">
                  <h3 className="text-[16px] font-bold text-ink">{it.t}</h3>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{it.b}</p>
                </StaggerItem>
              ))}
            </Stagger>
            {TUTORS.length > 0 && (
            <Reveal delay={0.1}>
              <p className="mt-8 rounded-xl bg-canvas px-4 py-3 text-sm text-ink-2">
                <span className="font-semibold tabular-nums text-ink">{trials.offering}</span> of the <span className="tabular-nums">{TUTORS.length}</span> tutors listed today offer a trial —{" "}
                <span className="font-semibold tabular-nums text-ink">{trials.free}</span> of them for free.{" "}
                <Link href="/tutors?trial=1" className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
                  See tutors with trials
                </Link>
              </p>
            </Reveal>
            )}
          </div>
          <Reveal delay={0.1}>
            <div className="mx-auto max-w-md">
              <TrialVignette />
            </div>
          </Reveal>
        </div>
      </Section>

      <Section id="policies" tone="canvas" className="scroll-mt-36">
        <SectionHeading
          eyebrow="Booking & policies"
          title="The rules, before you pay."
          description="The same policy is shown at checkout and on every lesson page. These are our current defaults; the exact terms for your booking always appear before you confirm."
        />
        <PolicyCards />
        <div className="mt-14 border-t border-line pt-14">
          <PolicyDetails />
        </div>
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
