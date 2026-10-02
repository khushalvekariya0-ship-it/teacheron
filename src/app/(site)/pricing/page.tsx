import type { Metadata } from "next";
import { ArrowRight, Check, GraduationCap, Receipt, Scale, ShieldCheck, Users } from "lucide-react";
import { Reveal, WordReveal } from "@/components/motion";
import { AreaNav } from "@/components/content/AreaNav";
import { ArrowLink, CtaBand, Section, SectionHeading } from "@/components/marketing/Section";
import { CheckoutVignette } from "@/components/marketing/Vignettes";
import { PolicyCards } from "@/components/marketing/Policies";
import { CreditPacks, PlanCards } from "@/components/marketing/Pricing";
import { EarningsCalculator } from "@/components/marketing/EarningsCalculator";
import { medianRate, rateRange } from "@/components/content/insights";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/Disclosure";
import { FAQS } from "@/lib/data/content";
import { TUTORS } from "@/lib/data/tutors";
import { CREDITS_PER_APPLICATION, DEFAULT_POLICY, TUTOR_PLANS } from "@/lib/data/platform";
import { applyBps, formatCents } from "@/lib/format";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Families pay per lesson with no subscription and no booking fee. Tutors choose Starter, Professional or Premium — see monthly prices, commission, job credits and credit packs.",
  alternates: { canonical: "/pricing" },
};

const PRICING_SECTIONS = [
  { slug: "families", name: "For families" },
  { slug: "tutors", name: "For tutors" },
  { slug: "calculator", name: "Earnings calculator" },
  { slug: "faq", name: "Questions" },
];

export default function PricingPage() {
  const range = rateRange(TUTORS);
  const median = medianRate();
  const starter = TUTOR_PLANS[0];
  // Example bill: the median listed rate when tutors exist, otherwise a round example rate.
  const exampleRate = median || 5000;
  const commissions = TUTOR_PLANS.map((p) => p.commissionBps / 100);
  const lowestCommission = Math.min(...commissions);
  const highestCommission = Math.max(...commissions);
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
      <section className="relative bg-gradient-to-b from-brand-50 to-page">
        <div className="container-page grid grid-cols-1 items-center gap-12 pb-14 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:pb-20 lg:pt-20">
          <div>
            <Reveal>
              <p className="inline-flex items-center gap-2.5 text-[12.5px] font-semibold uppercase tracking-[0.16em] text-brand">
                <span className="h-px w-6 bg-brand-gradient" aria-hidden />
                Pricing
              </p>
            </Reveal>
            <WordReveal
              text="Simple pricing. No surprises."
              accent={2}
              className="mt-5 font-heading text-[2.6rem] font-bold leading-[1.04] tracking-[-0.03em] text-ink sm:text-[3.3rem] lg:text-[3.7rem]"
            />
            <Reveal delay={0.2}>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
                Families pay per lesson — no subscription, no booking fee. Tutors choose the plan that fits their practice, with the commission printed right on it.
              </p>
            </Reveal>

            <Reveal delay={0.3} className="mt-8 grid gap-3 sm:grid-cols-2">
              <a href="#families" className="group rounded-2xl border border-line bg-surface p-5 transition-[border-color,box-shadow] hover:border-brand/40 hover:shadow-[0_16px_36px_-24px_rgb(15_23_42/0.45)]">
                <span className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
                  <Users className="size-4 text-brand" aria-hidden /> For families
                </span>
                <span className="mt-2 block font-heading text-[30px] font-extrabold leading-none tracking-[-0.03em] text-ink">$0</span>
                <span className="mt-1 block text-[14px] text-ink-2">to join, search and message</span>
                <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-brand">
                  See family pricing <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </a>
              <a href="#tutors" className="group rounded-2xl border border-line bg-surface p-5 transition-[border-color,box-shadow] hover:border-brand/40 hover:shadow-[0_16px_36px_-24px_rgb(15_23_42/0.45)]">
                <span className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
                  <GraduationCap className="size-4 text-brand" aria-hidden /> For tutors
                </span>
                <span className="mt-2 block font-heading text-[30px] font-extrabold leading-none tracking-[-0.03em] text-ink">
                  {lowestCommission}–{highestCommission}%
                </span>
                <span className="mt-1 block text-[14px] text-ink-2">commission · plans from $0 a month</span>
                <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-brand">
                  See tutor plans <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </a>
            </Reveal>
          </div>

          {/* An example bill: what a family pays, and where the commission comes from */}
          <Reveal delay={0.15} className="mx-auto w-full max-w-[480px] lg:mr-0">
            <div className="relative">
              <div className="absolute -right-3 -top-3 h-[60%] w-[65%] rounded-2xl bg-[linear-gradient(140deg,var(--color-grad-from),var(--color-grad-to))] sm:-right-5 sm:-top-5" aria-hidden />
              <div className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-30px_rgb(15_23_42/0.5)]">
                <div className="flex items-center justify-between border-b border-line px-6 py-4">
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                    <Receipt className="size-4 text-brand" aria-hidden /> Example lesson
                  </span>
                  <span className="text-[12.5px] text-muted">1 hour · {formatCents(exampleRate)}/hr tutor</span>
                </div>
                <dl className="space-y-3 px-6 py-5 text-[15px]">
                  {[
                    { label: "Lesson (tutor's rate)", value: formatCents(exampleRate, { exact: true }) },
                    { label: "Booking fee", value: "$0.00" },
                    { label: "Subscription", value: "$0.00" },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between gap-4">
                      <dt className="text-ink-2">{r.label}</dt>
                      <dd className="font-medium tabular-nums text-ink">{r.value}</dd>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-4 border-t border-dashed border-line-strong pt-3">
                    <dt className="font-semibold text-ink">Family pays</dt>
                    <dd className="font-heading text-[24px] font-bold tabular-nums text-ink">{formatCents(exampleRate, { exact: true })}</dd>
                  </div>
                </dl>
                <div className="border-t border-line bg-canvas px-6 py-4">
                  <div className="flex items-center justify-between gap-4 text-[14px]">
                    <span className="text-ink-2">Tutor keeps</span>
                    <span className="font-semibold tabular-nums text-ink">
                      {formatCents(exampleRate - applyBps(exampleRate, highestCommission * 100), { exact: true })}–{formatCents(exampleRate - applyBps(exampleRate, lowestCommission * 100), { exact: true })}
                    </span>
                  </div>
                  <p className="mt-2 flex items-start gap-2 text-[12.5px] leading-snug text-muted">
                    <ShieldCheck className="mt-px size-3.5 shrink-0 text-brand" aria-hidden />
                    TutorLink&rsquo;s {lowestCommission}–{highestCommission}% commission comes out of the tutor&rsquo;s earnings — it&rsquo;s never added to your bill.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <AreaNav areas={PRICING_SECTIONS} icons={false} label="On this page" />

      <Section id="families" className="scroll-mt-36">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading className="mb-8" eyebrow="For families" title="Free to search. Pay per lesson." />
            <Reveal>
              <div className="rounded-2xl border border-line-strong bg-surface p-6 sm:p-8">
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

      <Section id="tutors" tone="canvas" className="scroll-mt-36">
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
        <div id="calculator" className="mt-14 scroll-mt-40">
          <Reveal>
            <EarningsCalculator defaultRateCents={median || 5000} />
          </Reveal>
        </div>
      </Section>

      <Section id="faq" className="scroll-mt-36">
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
