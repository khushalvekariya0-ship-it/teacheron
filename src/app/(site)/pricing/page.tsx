import type { Metadata } from "next";
import { Check, Scale } from "lucide-react";
import { Reveal } from "@/components/motion";
import { ArrowLink, CtaBand, PageHero, Section, SectionHeading } from "@/components/marketing/Section";
import { CheckoutVignette } from "@/components/marketing/Vignettes";
import { PolicyCards } from "@/components/marketing/Policies";
import { CreditPacks, PlanCards } from "@/components/marketing/Pricing";
import { EarningsCalculator } from "@/components/marketing/EarningsCalculator";
import { medianRate, rateRange } from "@/components/content/insights";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/Disclosure";
import { FAQS } from "@/lib/data/content";
import { TUTORS } from "@/lib/data/tutors";
import { CREDITS_PER_APPLICATION, DEFAULT_POLICY, TUTOR_PLANS } from "@/lib/data/platform";
import { formatCents } from "@/lib/format";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Families pay per lesson with no subscription and no booking fee. Tutors choose Starter, Professional or Premium — see monthly prices, commission, job credits and credit packs.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  const range = rateRange(TUTORS);
  const median = medianRate();
  const starter = TUTOR_PLANS[0];
  const pricingFaqs: { q: string; a: string }[] = [
    { q: "Do families pay a subscription or membership fee?", a: "No. Searching, messaging tutors and posting a requirement are free. You pay only for the lessons you book, at the price shown before you confirm." },
    { q: "Is there a booking fee on top of the tutor's rate?", a: "No. The lesson price is the tutor's hourly rate for the length you choose. TutorLink's commission is deducted from the tutor's earnings, not added to your bill." },
    { q: "Who sets tutor rates?", a: `Each tutor sets their own rate. Rates listed today range from ${range ? `${formatCents(range.min)} to ${formatCents(range.max)}` : "tutor to tutor"} per hour.` },
    { q: "When is commission charged to tutors?", a: "Commission is calculated on each paid lesson. There's nothing to pay on a free trial, because nothing is charged." },
    { q: "Does a paid plan improve my ranking?", a: "No. Search order and match scores use the same factors for every tutor. Premium tutors are eligible for featured placement in highlighted spots, which is labelled and does not change ranking." },
    { q: `What if I don't need job credits?`, a: `You don't have to use them. Families can always contact you directly for free. Credits are only used when you apply to a student job (${CREDITS_PER_APPLICATION} credit per application). The ${starter.name} plan includes ${starter.monthlyLeadCredits} a month.` },
    ...FAQS.filter((f) => f.audience === "payments"),
  ];

  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Simple pricing. No surprises."
        description="Families pay per lesson — no subscription, no booking fee. Tutors choose the plan that fits their practice, with the commission printed right on it."
        align="center"
      >
        <Reveal delay={0.4}>
          <nav aria-label="Pricing sections" className="mt-10 flex justify-center gap-2">
            <a href="#families" className="rounded-lg border-2 border-ink px-4 py-2 text-[15px] font-semibold text-ink transition-colors hover:bg-ink hover:text-on-ink">For families</a>
            <a href="#tutors" className="rounded-lg border-2 border-ink px-4 py-2 text-[15px] font-semibold text-ink transition-colors hover:bg-ink hover:text-on-ink">For tutors</a>
          </nav>
        </Reveal>
      </PageHero>

      <Section id="families" className="scroll-mt-16">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading className="mb-8" eyebrow="For families" title="Free to search. Pay per lesson." />
            <Reveal>
              <div className="rounded-2xl border-2 border-ink bg-surface p-6 sm:p-8">
                <p className="flex items-baseline gap-2">
                  <span className="font-heading text-6xl font-bold tracking-[-0.03em] text-ink">$0</span>
                  <span className="text-sm text-muted">to join, search and message</span>
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    "Search, compare and message tutors for free",
                    "Post a requirement and let tutors apply",
                    "Pay per lesson at the tutor's listed rate",
                    "No subscription, no membership, no booking fee",
                    "Promo codes can be applied at checkout",
                    "Payments processed securely by Stripe",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-[15px] text-ink-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-ink" strokeWidth={2.6} aria-hidden /> {t}
                    </li>
                  ))}
                </ul>
                {range && (
                  <p className="mt-6 rounded-xl bg-canvas px-4 py-3 text-sm text-ink-2">
                    Tutor rates listed today run from <span className="font-semibold tabular-nums text-ink">{formatCents(range.min)}</span> to{" "}
                    <span className="font-semibold tabular-nums text-ink">{formatCents(range.max)}</span> an hour, with a median of{" "}
                    <span className="font-semibold tabular-nums text-ink">{formatCents(median)}</span>.
                  </p>
                )}
                <ArrowLink href="/tutors" className="mt-6">
                  Browse tutors and rates
                </ArrowLink>
              </div>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <div className="mx-auto max-w-md">
              <CheckoutVignette />
            </div>
          </Reveal>
        </div>
        <div className="mt-16">
          <h3 className="mb-6 font-heading text-2xl font-bold tracking-[-0.025em] text-ink">Cancellation and refunds</h3>
          <PolicyCards />
          <p className="mt-4 text-[13px] text-muted">
            Our current defaults. The exact policy for your booking is shown before you pay. A confirmed tutor no-show is always refunded in full; problems can be reported within {DEFAULT_POLICY.disputeWindowDays} days.
          </p>
        </div>
      </Section>

      <Section id="tutors" tone="canvas" className="scroll-mt-16">
        <SectionHeading
          eyebrow="For tutors"
          title="Plans for every stage of your practice."
          description="Start free. Move to a paid plan when a lower commission and more job credits pay for themselves — the calculator below shows exactly when."
          align="center"
        />
        <PlanCards />
        <Reveal>
          <p className="mx-auto mt-8 flex max-w-2xl items-start justify-center gap-2 text-center text-sm leading-relaxed text-muted">
            <Scale className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
            Plans never change your position in search or your match score. Every tutor is ranked by the same transparent factors.
          </p>
        </Reveal>
        <div className="mt-14">
          <Reveal>
            <CreditPacks />
          </Reveal>
        </div>
        <div id="calculator" className="mt-14 scroll-mt-24">
          <Reveal>
            <EarningsCalculator defaultRateCents={median || 5000} />
          </Reveal>
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
          <SectionHeading className="mb-0 self-start sm:items-start lg:sticky lg:top-28" eyebrow="Pricing FAQ" title="Questions about money." description="Straight answers. If yours isn't here, ask us." />
          <Reveal delay={0.1}>
            <Accordion type="single" collapsible className="border-t border-line">
              {pricingFaqs.map((f, i) => (
                <AccordionItem key={f.q} value={`p${i}`}>
                  <AccordionTrigger>{f.q}</AccordionTrigger>
                  <AccordionContent>{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </Section>

      <CtaBand
        title="See who's teaching what you need."
        description="Browse tutors, compare rates and book a trial. Or join as a tutor for free."
        primary={{ href: "/tutors", label: "Find a tutor" }}
        secondary={{ href: "/become-a-tutor", label: "Become a tutor" }}
      />
    </>
  );
}
