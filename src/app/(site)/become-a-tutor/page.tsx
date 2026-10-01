import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Briefcase, CalendarDays, Check, IdCard, Laptop, MessageSquare, NotebookPen, Scale, ShieldCheck, UserRound, Wallet,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ArrowLink, CtaBand, PageHero, Section, SectionHeading } from "@/components/marketing/Section";
import { CardGrid, Split } from "@/components/marketing/Split";
import { GetPaidVignette, ProfileBuilderVignette } from "@/components/marketing/Vignettes";
import { VerificationFlow } from "@/components/marketing/Verification";
import { TUTOR_SIGNUP_HREF } from "@/components/marketing/Pricing";
import { medianRate } from "@/components/content/insights";
import { Button } from "@/components/ui/Button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/Disclosure";
import { FAQS } from "@/lib/data/content";
import { CREDITS_PER_APPLICATION, DEFAULT_POLICY, TUTOR_PLANS } from "@/lib/data/platform";
import { applyBps, formatCents } from "@/lib/format";

export const metadata: Metadata = {
  title: "Become a tutor",
  description:
    "Teach online or in person on TutorLink. Set your own rates and schedule, get verified, apply to student jobs, and get paid through Stripe Connect. See plans, commission and requirements.",
  alternates: { canonical: "/become-a-tutor" },
};

const ONBOARDING = [
  { title: "Create your account", body: "Sign up as a tutor. It takes a minute and you can save progress at any point." },
  { title: "Build your profile", body: "Subjects and levels, teaching experience, education and your approach — in your own words." },
  { title: "Set pricing and a trial", body: "Your hourly rate, lesson lengths, and whether you offer a free or reduced-price trial." },
  { title: "Publish availability", body: "Weekly hours, buffers between lessons, minimum notice, and manual approval or instant booking." },
  { title: "Submit verification", body: "Upload documents for identity, education and certifications, and complete background screening where applicable." },
  { title: "Connect payouts", body: "Link a bank account through Stripe Connect so earnings from completed lessons can be paid out." },
];

export default function BecomeATutorPage() {
  // The median listed rate when tutors exist; otherwise a round example rate for the commission table.
  const median = medianRate();
  const rate = median || 5000;
  const tutorFaqs = FAQS.filter((f) => f.audience === "tutors");

  return (
    <>
      <PageHero
        image={{ src: "/images/become-a-tutor.jpg", alt: "A tutor smiling while working on a laptop" }}
        eyebrow="Become a tutor"
        title="Teach what you know. Build a practice on your terms."
        description="Set your own rates, hours and service area. Families find you through transparent search — and a paid plan never buys a better position."
        actions={
          <>
            <Button asChild size="lg">
              <Link href={TUTOR_SIGNUP_HREF}>
                Create your tutor profile <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/pricing#tutors">Plans & commission</Link>
            </Button>
          </>
        }
      />

      <Section>
        <SectionHeading eyebrow="Why TutorLink" title="The tools of a practice, without the overhead." description="Everything you need to run lessons and get paid, in one place." />
        <CardGrid
          items={[
            { icon: <Wallet />, title: "Your rates, your rules", body: "Choose your hourly rate, lesson lengths and trial terms. Change them whenever you like." },
            { icon: <CalendarDays />, title: "A calendar that protects you", body: "Weekly availability, buffers and minimum notice. Families only see times you're actually free." },
            { icon: <MessageSquare />, title: "Families come to you", body: "Families find you in search and message you directly. Being contacted never costs you credits." },
            { icon: <Briefcase />, title: "Student jobs", body: `Browse requirements posted by families and apply with a personal note. Each application uses ${CREDITS_PER_APPLICATION} credit.` },
            { icon: <Scale />, title: "Fair ranking", body: "Search order and match scores use the same transparent factors for everyone. Plans and featured placement never change them." },
            { icon: <NotebookPen />, title: "Built-in teaching tools", body: "A page for every lesson with the meeting link, notes, homework and attendance." },
          ]}
        />
      </Section>

      <Section tone="canvas">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading className="mb-8 lg:mb-10" eyebrow="Onboarding" title="Six steps to your first lesson." description="Guided, saved as you go, and clear about what's still missing." />
            <Stagger as="ol" className="relative space-y-6 border-l border-line pl-8" stagger={0.07}>
              {ONBOARDING.map((s, i) => (
                <StaggerItem as="li" key={s.title} className="relative">
                  <span className="absolute -left-[45px] top-0 grid size-7 place-items-center rounded-md bg-ink text-[12.5px] font-bold tabular-nums text-on-ink">
                    {i + 1}
                  </span>
                  <h3 className="text-[16px] font-bold text-ink">{s.title}</h3>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{s.body}</p>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
          <Reveal delay={0.1} className="lg:sticky lg:top-28">
            <div className="mx-auto max-w-md lg:max-w-none">
              <ProfileBuilderVignette />
            </div>
          </Reveal>
        </div>
      </Section>

      <Section>
        <Split
          eyebrow="Requirements"
          title="What you'll need."
          description="We keep the bar clear and the same for everyone."
          features={[
            { icon: <UserRound />, title: "Be 18 or older", body: "Tutors must be adults, and you'll confirm your legal name during identity verification." },
            { icon: <IdCard />, title: "A government-issued photo ID", body: "Used only to verify your identity. It is never shown to families." },
            { icon: <BadgeCheck />, title: "Real expertise in what you teach", body: "A degree, a teaching certification, or demonstrable experience in each subject you list. Only verified credentials earn badges." },
            { icon: <ShieldCheck />, title: "Consent to background screening", body: "Where applicable — for example if you work with minors — you'll be asked to complete a background screening." },
            { icon: <Laptop />, title: "A reliable setup", body: "For online lessons: a stable connection, camera and microphone. For in-person lessons: a service area you can reliably cover." },
          ]}
          visual={
            <div className="rounded-2xl border-2 border-ink bg-surface p-6">
              <p className="font-heading text-xl font-bold tracking-[-0.03em] text-ink">Community standards</p>
              <p className="mt-1 text-sm text-muted">Every tutor agrees to these before teaching.</p>
              <ul className="mt-5 space-y-3">
                {[
                  "Keep communication and payment on TutorLink",
                  "Never share or ask for personal contact details before a booking",
                  "Show up on time, and cancel early if you must",
                  "Follow the safeguards for lessons with minors",
                  "List only qualifications you can verify",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm text-ink-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-ink" strokeWidth={2.6} aria-hidden /> {t}
                  </li>
                ))}
              </ul>
              <ArrowLink href="/safety" className="mt-6">
                Read the safety guidelines
              </ArrowLink>
            </div>
          }
        />
      </Section>

      <Section id="verification" tone="canvas" className="scroll-mt-16">
        <SectionHeading
          eyebrow="Verification"
          title="Every check has a status you can see."
          description="Identity, education, certification and background screening are reviewed separately. A badge appears only when a check reaches Verified."
          action={
            <ArrowLink href="/trust-safety#verification">How we verify</ArrowLink>
          }
        />
        <VerificationFlow />
      </Section>

      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading
              className="mb-8"
              eyebrow="Earnings"
              title="You set the rate. The commission is on the page."
              description={`Families pay your listed rate. TutorLink's commission is deducted from each paid lesson, and it's lower on paid plans. Earnings become available after the ${DEFAULT_POLICY.disputeWindowDays}-day dispute window and are paid through Stripe Connect.`}
            />
            <Reveal>
              <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                <table className="w-full text-left text-sm">
                  <caption className="border-b border-line bg-canvas px-4 py-3 text-left text-[13px] text-muted">
                    You keep, on a {formatCents(rate)} one-hour lesson{median ? " (the median rate listed today)" : ""}
                  </caption>
                  <thead>
                    <tr className="border-b border-line text-[12.5px] text-muted">
                      <th scope="col" className="px-4 py-2.5 font-medium">Plan</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Monthly</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Commission</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">You keep</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {TUTOR_PLANS.map((p) => (
                      <tr key={p.id} className={p.highlighted ? "bg-brand-50" : undefined}>
                        <th scope="row" className="px-4 py-3 font-semibold text-ink">{p.name}</th>
                        <td className="px-4 py-3 tabular-nums text-ink-2">{formatCents(p.priceCents)}</td>
                        <td className="px-4 py-3 tabular-nums text-ink-2">{p.commissionBps / 100}%</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-ink">{formatCents(rate - applyBps(rate, p.commissionBps), { exact: true })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
            <Reveal delay={0.1} className="mt-6">
              <ArrowLink href="/pricing#calculator">Estimate your monthly earnings</ArrowLink>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <div className="mx-auto max-w-md lg:max-w-none">
              <GetPaidVignette />
            </div>
          </Reveal>
        </div>
      </Section>

      <Section tone="canvas">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
          <SectionHeading className="mb-0 self-start sm:items-start lg:sticky lg:top-28" eyebrow="Questions" title="Before you apply." description="More answers in the FAQ, or ask our team directly." />
          <Reveal delay={0.1}>
            <Accordion type="single" collapsible className="border-t border-line">
              {tutorFaqs.map((f, i) => (
                <AccordionItem key={f.q} value={`t${i}`}>
                  <AccordionTrigger>{f.q}</AccordionTrigger>
                  <AccordionContent>{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </Section>

      <CtaBand
        title="Start your profile today."
        description="It's free to join on the Starter plan. Upgrade only if a lower commission and more credits make sense for you."
        primary={{ href: TUTOR_SIGNUP_HREF, label: "Create your tutor profile" }}
        secondary={{ href: "/tutor-jobs", label: "Browse student jobs" }}
      />
    </>
  );
}
