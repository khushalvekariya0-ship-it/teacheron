import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Eye, MessageSquareLock, Star } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ArrowLink, CtaBand, PageHero, Section, SectionHeading } from "@/components/marketing/Section";
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
  { href: "#steps", label: "Step by step" },
  { href: "#matching", label: "How matching works" },
  { href: "#trials", label: "Trial lessons" },
  { href: "#policies", label: "Booking & policies" },
  { href: "#safety", label: "Safety" },
];

export default function HowItWorksPage() {
  const trials = trialStats();
  return (
    <>
      <PageHero
        image={{ src: "/images/hero-tutoring.jpg", alt: "A tutor helping a student with her notes" }}
        eyebrow="How it works"
        title="A clear path from first search to steady progress."
        description="No subscriptions for families, no hidden ranking, and no surprises at checkout. Here is exactly how TutorLink works — for families and for tutors."
        actions={
          <>
            <Button asChild size="lg">
              <Link href="/tutors">
                Find a tutor <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/become-a-tutor">Become a tutor</Link>
            </Button>
          </>
        }
      >
        <Reveal delay={0.4}>
          <nav aria-label="On this page" className="mt-12 flex flex-wrap gap-2">
            {JUMP_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="rounded-lg border-2 border-ink px-3.5 py-1.5 text-[14px] font-semibold text-ink transition-colors hover:bg-ink hover:text-on-ink">
                {l.label}
              </a>
            ))}
          </nav>
        </Reveal>
      </PageHero>

      <Section id="steps" className="scroll-mt-16">
        <HowItWorksView />
      </Section>

      <Section id="matching" tone="canvas" className="scroll-mt-16">
        <SectionHeading
          eyebrow="How matching works"
          title="A score you can read, not a black box."
          description="When you search or use Help Me Find a Tutor, each tutor gets a match score from eight weighted factors. You see every factor, how it was scored and why — next to every result."
        />
        <MatchingWeights />
      </Section>

      <Section id="trials" className="scroll-mt-16">
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

      <Section id="policies" tone="canvas" className="scroll-mt-16">
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

      <Section id="safety" className="scroll-mt-16">
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
