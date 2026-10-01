import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Ban, Eye, FlaskConical, Lock, Scale, Sparkles, Star, UsersRound } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ArrowLink, CtaBand, Eyebrow, PageHero, Section, SectionHeading } from "@/components/marketing/Section";
import { CardGrid } from "@/components/marketing/Split";
import { indexableMetros } from "@/components/content/insights";
import { SUBJECTS, SUBJECT_CATEGORIES } from "@/lib/data/catalog";
import { TUTOR_PLANS } from "@/lib/data/platform";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why we're building TutorLink: a tutoring marketplace for the United States built on transparency, verification before badges, and privacy by default.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  const commissions = TUTOR_PLANS.map((p) => p.commissionBps / 100);
  const metros = indexableMetros().length;
  return (
    <>
      <PageHero
        image={{ src: "/images/hero-tutoring-close.jpg", alt: "A tutor and a student working through a lesson together" }}
        eyebrow="About TutorLink"
        title="Tutoring works best when everyone can see how it works."
        description="We're building a tutoring marketplace for families and tutors across the United States — one where rankings are explained, badges are earned, and personal information stays private."
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <Reveal>
            <Eyebrow className="mb-5 text-ink">Our mission</Eyebrow>
            <h2 className="font-heading text-[2rem] font-bold leading-[1.04] tracking-[-0.025em] text-ink sm:text-[2.6rem]">Help every learner find the right teacher — and trust the choice.</h2>
          </Reveal>
          <Reveal delay={0.1} className="space-y-5 text-[17px] leading-relaxed text-ink-2">
            <p>
              Finding a tutor is usually a mix of word of mouth, guesswork and hope. Families can&rsquo;t easily tell who is qualified, why one tutor appears above another, or what happens if a lesson goes wrong. Good tutors, meanwhile, spend too much time on scheduling, invoicing and chasing payments.
            </p>
            <p>
              TutorLink is our answer: a marketplace where search results come with reasons, credentials are checked before they&rsquo;re displayed, policies are shown before you pay, and tutors get the tools of a professional practice without the overhead.
            </p>
            <p className="text-muted">
              We&rsquo;re early. This site is a preview build — the tutors, reviews and figures you see are sample data while we prepare for launch. We&rsquo;d rather tell you that plainly than dress it up.
            </p>
          </Reveal>
        </div>
      </Section>

      <Section tone="canvas">
        <SectionHeading eyebrow="Principles" title="What we hold ourselves to." description="These shape product decisions, including the ones that would be easier to skip." />
        <CardGrid
          items={[
            { icon: <Eye />, title: "Transparency over mystery", body: "Every match score shows its factors and weights. Prices, fees and cancellation terms appear before checkout, not after." },
            { icon: <BadgeCheck />, title: "Verification before badges", body: "A badge means a check was completed by our team. We never imply a credential that hasn't been verified." },
            { icon: <Lock />, title: "Privacy by default", body: "Contact details are masked in messages, home addresses are never shown, and meeting links stay private. We don't sell personal information." },
            { icon: <Scale />, title: "Rankings can't be bought", body: "Subscription plans and featured placement never change search order or match scores." },
            { icon: <Star />, title: "Reviews from real lessons", body: "Only families with a completed booking can leave a review, and ratings are calculated from those reviews alone." },
            { icon: <UsersRound />, title: "Safeguards for minors", body: "Parent accounts, visibility into messages about children, and a clear path to report anything that feels wrong." },
          ]}
        />
      </Section>

      <Section>
        <div className="grid gap-5 lg:grid-cols-2">
          <Reveal className="h-full">
            <div className="h-full rounded-2xl border border-line bg-surface p-6 sm:p-8">
              <Eyebrow className="text-ink">How we make money</Eyebrow>
              <h2 className="mt-4 font-heading text-[1.75rem] font-bold leading-[1.08] tracking-[-0.03em] text-ink">Two sources, both on the pricing page.</h2>
              <ul className="mt-5 space-y-3 text-[15px] leading-relaxed text-ink-2">
                <li className="border-l-[3px] border-brand pl-3">
                  A commission on paid lessons, deducted from the tutor&rsquo;s earnings: {Math.max(...commissions)}% down to {Math.min(...commissions)}% depending on plan.
                </li>
                <li className="border-l-[3px] border-brand pl-3">Optional monthly plans and credit packs for tutors who want a lower commission and more job applications.</li>
              </ul>
              <p className="mt-5 flex items-start gap-2 text-sm text-muted">
                <Ban className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden /> No subscriptions for families, and no selling of personal data.
              </p>
              <ArrowLink href="/pricing" className="mt-6">
                See pricing
              </ArrowLink>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="h-full">
            <div className="relative h-full overflow-hidden rounded-2xl bg-yellow-soft p-6 sm:p-8">
              <div className="relative">
                <Eyebrow className="text-ink">What we cover</Eyebrow>
                <h2 className="mt-4 font-heading text-[1.75rem] font-bold leading-[1.08] tracking-[-0.03em] text-ink">K–12, college and adult learners.</h2>
                <Stagger className="mt-6 grid grid-cols-3 gap-3" stagger={0.08}>
                  {[
                    { v: SUBJECT_CATEGORIES.length, k: "subject areas" },
                    { v: SUBJECTS.length, k: "subjects" },
                    { v: metros, k: "city pages" },
                  ].map((s) => (
                    <StaggerItem key={s.k} className="rounded-xl bg-surface p-4">
                      <p className="font-heading text-3xl font-bold tracking-[-0.03em] tabular-nums text-ink">{s.v}</p>
                      <p className="mt-0.5 text-[13px] text-muted">{s.k}</p>
                    </StaggerItem>
                  ))}
                </Stagger>
                <p className="mt-5 text-sm leading-relaxed text-ink-2">Online lessons are available anywhere in the United States. City pages cover areas where tutors currently offer in-person lessons.</p>
                <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <Link href="/subjects" className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">Browse subjects</Link>
                  <Link href="/locations" className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">Browse cities</Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section tone="canvas">
        <div className="grid items-center gap-10 lg:grid-cols-[1.4fr_1fr]">
          <Reveal>
            <Eyebrow className="mb-5 text-ink">Get in touch</Eyebrow>
            <h2 className="font-heading text-[2rem] font-bold leading-[1.04] tracking-[-0.025em] text-ink sm:text-[2.4rem]">Questions, feedback or partnership ideas?</h2>
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-2">
              We read every message. Write to{" "}
              <a href={`mailto:${SITE.supportEmail}`} className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
                {SITE.supportEmail}
              </a>{" "}
              or use the contact form.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <ul className="space-y-3">
              {[
                { href: "/contact", icon: <Sparkles />, label: "Contact the team" },
                { href: "/trust-safety", icon: <BadgeCheck />, label: "How trust & safety works" },
                { href: "/how-it-works#matching", icon: <FlaskConical />, label: "How matching is scored" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} data-spotlight className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition-colors">
                    <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-ink [&_svg]:size-4">{l.icon}</span>
                    <span className="flex-1 text-[15px] font-bold text-ink">{l.label}</span>
                    <ArrowRight className="size-4 text-ink transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Section>

      <CtaBand title="Find the right tutor." description="Search is free. Every result explains why it matches." primary={{ href: "/tutors", label: "Find a tutor" }} secondary={{ href: "/become-a-tutor", label: "Become a tutor" }} />
    </>
  );
}
