import type { Metadata } from "next";
import type * as React from "react";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Briefcase, CalendarDays, Check, IdCard, Laptop, MessageSquare, NotebookPen, Scale, ShieldCheck, UserRound, Wallet,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ArrowLink, CtaBand, PageHero, Section, SectionHeading } from "@/components/marketing/Section";
import { Split } from "@/components/marketing/Split";
import { GetPaidVignette, ProfileBuilderVignette } from "@/components/marketing/Vignettes";
import { VerificationFlow } from "@/components/marketing/Verification";
import { TUTOR_SIGNUP_HREF } from "@/components/marketing/Pricing";
import { medianRate } from "@/components/content/insights";
import { Button } from "@/components/ui/Button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/Disclosure";
import { FAQS } from "@/lib/data/content";
import { CREDITS_PER_APPLICATION, DEFAULT_POLICY, TUTOR_PLANS } from "@/lib/data/platform";
import { applyBps, formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";

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

/* ─── Why TutorLink (for tutors): a bento of the tools, each with a small picture ─── */

function ToolTile({ icon, title, body, className, children }: { icon: React.ReactNode; title: string; body: string; className?: string; children?: React.ReactNode }) {
  return (
    <StaggerItem className={cn("h-full", className)}>
      <div data-spotlight className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6 sm:p-7">
        <span className="grid size-10 place-items-center rounded-lg border border-line text-brand [&_svg]:size-5">{icon}</span>
        <h3 className="mt-5 font-heading text-[20px] font-bold tracking-[-0.015em] text-ink">{title}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{body}</p>
        {children && (
          <div className="mt-auto pt-6" aria-hidden>
            {children}
          </div>
        )}
      </div>
    </StaggerItem>
  );
}

const WEEK_BLOCKS = [
  [1, 1, 0, 1, 1],
  [0, 1, 1, 0, 1],
  [1, 0, 1, 1, 0],
];

function TutorWhy() {
  return (
    <Section>
      <div className="mb-12 flex flex-col gap-6 lg:mb-14 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          className="mb-0 lg:mb-0"
          eyebrow="Why TutorLink"
          title="The tools of a practice, without the overhead."
          accent={3}
          description="Profile, calendar, bookings, lesson notes and payouts — everything you need to teach and get paid, in one place."
        />
        <Reveal delay={0.1} className="shrink-0">
          <ArrowLink href="/pricing#tutors">See plans &amp; commission</ArrowLink>
        </Reveal>
      </div>

      <Stagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5" stagger={0.06}>
        {/* Rates */}
        <ToolTile className="md:col-span-2" icon={<Wallet />} title="Your rates, your rules" body="Choose your hourly rate, lesson lengths and trial terms — and change them whenever you like.">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-page p-4">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted">Hourly rate</p>
              <p className="mt-2 font-heading text-[22px] font-bold text-ink">You decide</p>
            </div>
            <div className="rounded-xl border border-line bg-page p-4">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted">Lesson lengths</p>
              <p className="mt-2.5 flex flex-wrap gap-1.5">
                {[30, 45, 60, 90].map((m, i) => (
                  <span key={m} className={cn("rounded-md px-2 py-0.5 text-[12.5px] font-semibold", i === 2 ? "bg-brand-gradient text-white" : "border border-line text-ink-2")}>
                    {m}m
                  </span>
                ))}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-page p-4">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted">Trial lesson</p>
              <p className="mt-2.5 flex gap-1.5 text-[12.5px] font-semibold">
                <span className="rounded-md border border-line px-2 py-0.5 text-ink-2">Free</span>
                <span className="rounded-md border border-line px-2 py-0.5 text-ink-2">Reduced</span>
                <span className="rounded-md border border-line px-2 py-0.5 text-ink-2">Off</span>
              </p>
            </div>
          </div>
        </ToolTile>

        {/* Families come to you */}
        <ToolTile icon={<MessageSquare />} title="Families come to you" body="Families find you in search and message you directly. Being contacted never costs credits.">
          <div className="space-y-2">
            <div className="w-[85%] rounded-2xl rounded-bl-md bg-canvas px-3.5 py-2.5 text-[13px] text-ink-2">Hi! Are you available for weekly lessons?</div>
            <div className="ml-auto w-[70%] rounded-2xl rounded-br-md bg-brand-gradient px-3.5 py-2.5 text-[13px] text-white">Yes — let&rsquo;s book a trial.</div>
          </div>
        </ToolTile>

        {/* Calendar */}
        <ToolTile icon={<CalendarDays />} title="A calendar that protects you" body="Weekly hours, buffers and minimum notice. Families only see times you're actually free.">
          <div className="rounded-xl border border-line bg-page p-3">
            <div className="grid grid-cols-5 gap-1 text-center text-[10.5px] font-medium text-muted">
              {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-5 gap-1">
              {WEEK_BLOCKS.flatMap((row, r) =>
                row.map((on, c) => <span key={`${r}-${c}`} className={cn("h-5 rounded", on ? "bg-brand-gradient opacity-90" : "bg-canvas")} />),
              )}
            </div>
            <p className="mt-2.5 flex flex-wrap gap-1.5 text-[11.5px] font-medium text-ink-2">
              <span className="rounded border border-line px-1.5 py-0.5">Buffers</span>
              <span className="rounded border border-line px-1.5 py-0.5">Min. notice</span>
              <span className="rounded border border-line px-1.5 py-0.5">Instant or approve</span>
            </p>
          </div>
        </ToolTile>

        {/* Student jobs */}
        <ToolTile icon={<Briefcase />} title="Student jobs" body="Browse requirements posted by families and apply with a personal note.">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-page p-3.5">
            <span className="min-w-0">
              <span className="block h-2 w-24 rounded-full bg-line-strong" />
              <span className="mt-2 block h-2 w-32 rounded-full bg-line" />
            </span>
            <span className="shrink-0 rounded-lg bg-brand-gradient px-3 py-1.5 text-[12px] font-semibold text-white">
              Apply · {CREDITS_PER_APPLICATION} credit
            </span>
          </div>
        </ToolTile>

        {/* Fair ranking */}
        <ToolTile icon={<Scale />} title="Fair ranking" body="Search order and match scores use the same open factors for everyone. Plans and featured placement never change them.">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-page px-3.5 py-3 text-[13px] font-semibold text-ink">
            <BadgeCheck className="size-4 text-success" /> Same rules for every tutor
          </div>
        </ToolTile>

        {/* Lesson page */}
        <ToolTile className="md:col-span-2" icon={<NotebookPen />} title="Built-in teaching tools" body="Every lesson gets its own page with the meeting link, notes, homework and attendance — so families see progress without extra admin.">
          <div className="grid gap-2 sm:grid-cols-4">
            {[
              { icon: <Laptop className="size-4" />, label: "Meeting link" },
              { icon: <NotebookPen className="size-4" />, label: "Lesson notes" },
              { icon: <Check className="size-4" />, label: "Homework" },
              { icon: <CalendarDays className="size-4" />, label: "Attendance" },
            ].map((x) => (
              <span key={x.label} className="flex items-center gap-2 rounded-lg border border-line bg-page px-3 py-2.5 text-[13px] font-medium text-ink-2">
                <span className="text-brand">{x.icon}</span> {x.label}
              </span>
            ))}
          </div>
        </ToolTile>

        {/* Payouts */}
        <ToolTile icon={<ShieldCheck />} title="Get paid securely" body="Families pay through Stripe when they book. Earnings from completed lessons are paid out to your bank through Stripe Connect.">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-page px-3.5 py-3 text-[13px] text-ink-2">
            <span className="font-semibold text-ink">Booked</span>
            <ArrowRight className="size-3.5 text-muted" />
            <span className="font-semibold text-ink">Taught</span>
            <ArrowRight className="size-3.5 text-muted" />
            <span className="rounded-md bg-brand-gradient px-2 py-0.5 font-semibold text-white">Paid out</span>
          </div>
        </ToolTile>
      </Stagger>
    </Section>
  );
}

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

      <TutorWhy />

      <Section tone="canvas">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading className="mb-8 lg:mb-10" eyebrow="Onboarding" title="Six steps to your first lesson." description="Guided, saved as you go, and clear about what's still missing." />
            <Stagger as="ol" className="relative space-y-6 border-l border-line pl-8" stagger={0.07}>
              {ONBOARDING.map((s, i) => (
                <StaggerItem as="li" key={s.title} className="relative">
                  <span className="absolute -left-[45px] top-0 grid size-7 place-items-center rounded-md bg-brand-gradient text-[12.5px] font-bold tabular-nums text-white">
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
            <div className="rounded-2xl border border-line-strong bg-surface p-6">
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
