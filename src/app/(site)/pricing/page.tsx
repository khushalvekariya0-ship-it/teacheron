import type { Metadata } from "next";
import { ArrowRight, Ban, CalendarCheck, Check, GraduationCap, Receipt, Scale, Search, ShieldCheck, Users, X, type LucideIcon } from "lucide-react";
import { Reveal, Stagger, StaggerItem, WordReveal } from "@/components/motion";
import { RefundCalculator } from "@/components/marketing/RefundCalculator";
import { cn } from "@/lib/utils";
import { AreaNav } from "@/components/content/AreaNav";
import { ArrowLink, CtaBand, Section, SectionHeading } from "@/components/marketing/Section";
import { CreditPacks, PlanCards, PlanComparison } from "@/components/marketing/Pricing";
import { EarningsCalculator } from "@/components/marketing/EarningsCalculator";
import { medianRate, rateRange } from "@/components/content/insights";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/Disclosure";
import { FAQS } from "@/lib/data/content";
import { TUTORS } from "@/lib/data/tutors";
import { CREDITS_PER_APPLICATION, TUTOR_PLANS } from "@/lib/data/platform";
import { applyBps, formatCents } from "@/lib/format";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Families pay per lesson with no subscription and no booking fee. Tutors choose Starter, Professional or Premium — see monthly prices, commission, job credits and credit packs.",
  alternates: { canonical: "/pricing" },
};

const FAMILY_COLUMNS: { icon: LucideIcon; price: string; title: string; caption: string; items: string[]; featured?: boolean; never?: boolean }[] = [
  {
    icon: Search,
    price: "$0",
    title: "Always free",
    caption: "Everything before you book",
    items: ["Search and compare tutors", "Message tutors with your questions", "Post a requirement and let tutors apply", "Get a matched shortlist"],
  },
  {
    icon: CalendarCheck,
    price: "Per lesson",
    title: "You pay",
    caption: "Only for lessons you book",
    items: ["The tutor's listed hourly rate", "Trials free or reduced, set by each tutor", "Total shown before you confirm", "Promo codes applied at checkout"],
    featured: true,
  },
  {
    icon: Ban,
    price: "$0",
    title: "Never charged",
    caption: "No extras on your bill",
    items: ["No subscription", "No membership", "No booking fee", "No commission added to your price"],
    never: true,
  },
];

const PAY_STEPS = [
  { title: "See the total first", body: "The price and the cancellation policy are shown before you confirm." },
  { title: "Pay securely", body: "Payments are processed by Stripe — card details never touch our servers." },
  { title: "Charged when it's confirmed", body: "With a booking request, your card is held and charged once the tutor accepts." },
];

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
      <section className="relative isolate border-b border-line bg-page">
        <div className="page-glow pointer-events-none absolute inset-0 -z-10" aria-hidden />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-line-grid [mask-image:radial-gradient(ellipse_80%_70%_at_50%_0%,black_20%,transparent_75%)]" aria-hidden />
        <div className="container-page grid grid-cols-1 items-center gap-12 pb-14 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:pb-20 lg:pt-20">
          <div>
            <Reveal>
              <p className="kicker">
                <span className="kicker-dot" aria-hidden />
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
        <div className="mb-10 flex flex-col gap-6 lg:mb-12 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            className="mb-0 lg:mb-0"
            eyebrow="For families"
            title="Free to search. Pay per lesson."
            accent={3}
            description="Everything you need to find the right tutor costs nothing. You pay only for the lessons you book, at the price you see before you confirm."
          />
          <Reveal delay={0.1} className="shrink-0">
            <ArrowLink href="/tutors">Browse tutors and rates</ArrowLink>
          </Reveal>
        </div>

        {/* Free / pay / never */}
        <Stagger className="grid gap-4 lg:grid-cols-3" stagger={0.08}>
          {FAMILY_COLUMNS.map((col) => (
            <StaggerItem key={col.title} className="h-full">
              <div className={cn("flex h-full flex-col rounded-2xl border p-6 sm:p-7", col.featured ? "border-brand/30 bg-brand-50" : "border-line bg-surface")}>
                <div className="flex items-center justify-between gap-3">
                  <span className={cn("grid size-10 place-items-center rounded-lg", col.featured ? "bg-brand-gradient text-white" : "border border-line text-brand")}>
                    <col.icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-heading text-[30px] font-extrabold leading-none tracking-[-0.03em] text-ink">{col.price}</span>
                </div>
                <p className="mt-5 font-heading text-[19px] font-bold tracking-[-0.015em] text-ink">{col.title}</p>
                <p className="mt-1 text-[14px] text-muted">{col.caption}</p>
                <ul className="mt-5 space-y-2.5 border-t border-line pt-5">
                  {col.items.map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-[14.5px] leading-snug text-ink-2">
                      {col.never ? (
                        <X className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={2.6} aria-hidden />
                      ) : (
                        <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.6} aria-hidden />
                      )}
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {/* How paying works */}
        <Reveal className="mt-4">
          <ol className="grid overflow-hidden rounded-2xl border border-line bg-surface sm:grid-cols-3">
            {PAY_STEPS.map((s, i) => (
              <li key={s.title} className={cn("flex gap-4 p-5 sm:p-6", i > 0 && "border-t border-line sm:border-l sm:border-t-0")}>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-[14px] font-bold text-white">{i + 1}</span>
                <span>
                  <span className="block text-[15.5px] font-semibold text-ink">{s.title}</span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-ink-2">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </Reveal>

        {/* Rates listed today (only when tutors are listed) */}
        {range && (
          <Reveal className="mt-4">
            <div className="rounded-2xl border border-line bg-surface p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[15.5px] font-semibold text-ink">Hourly rates listed today</p>
                <p className="text-[13px] text-muted">Each tutor sets their own rate</p>
              </div>
              <div className="relative mt-8 h-2 rounded-full bg-brand-gradient" aria-hidden>
                <span
                  className="absolute -top-7 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-0.5 text-[12px] font-semibold text-on-ink"
                  style={{ left: `${((median - range.min) / Math.max(1, range.max - range.min)) * 100}%` }}
                >
                  Median {formatCents(median)}
                </span>
                <span
                  className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink"
                  style={{ left: `${((median - range.min) / Math.max(1, range.max - range.min)) * 100}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[13px] font-semibold tabular-nums text-ink-2">
                <span>{formatCents(range.min)}</span>
                <span>{formatCents(range.max)}</span>
              </div>
              <p className="sr-only">
                Rates range from {formatCents(range.min)} to {formatCents(range.max)} an hour, with a median of {formatCents(median)}.
              </p>
            </div>
          </Reveal>
        )}

        {/* Cancellation and refunds */}
        <p className="mb-5 mt-12 kicker">
          <span className="kicker-dot" aria-hidden />
          Cancellation and refunds
        </p>
        <h3 className="mb-6 max-w-2xl font-heading text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[30px]">
          Plans change. <span className="text-gradient">Here&rsquo;s what you get back.</span>
        </h3>
        <Reveal>
          <RefundCalculator exampleCents={exampleRate} />
        </Reveal>
        <p className="mt-4 text-[13px] text-muted">
          These are our current defaults. The exact policy for your booking is always shown before you pay.
        </p>
      </Section>

      <Section id="tutors" tone="canvas" className="scroll-mt-36">
        <div className="mb-10 flex flex-col gap-6 lg:mb-12 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            className="mb-0 lg:mb-0"
            eyebrow="For tutors"
            title="Plans for every stage of your practice."
            accent={4}
            description="Start free. Move to a paid plan when a lower commission and more job credits pay for themselves — the calculator below shows exactly when."
          />
          <Reveal delay={0.1} className="shrink-0">
            <ArrowLink href="#calculator">Estimate your earnings</ArrowLink>
          </Reveal>
        </div>
        <PlanCards exampleCents={exampleRate} />
        <Reveal>
          <p className="mt-6 flex items-start justify-center gap-2 text-center text-[14px] leading-relaxed text-ink-2">
            <Scale className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            Plans never change your position in search or your match score — every tutor is ranked by the same factors.
          </p>
        </Reveal>
        <Reveal className="mt-12">
          <PlanComparison exampleCents={exampleRate} />
        </Reveal>
        <Reveal className="mt-6">
          <CreditPacks />
        </Reveal>
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
