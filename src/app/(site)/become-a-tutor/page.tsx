import type { Metadata } from "next";
import type * as React from "react";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Briefcase, CalendarDays, Check, Handshake, Landmark, Laptop, Lock, MessageSquare, NotebookPen, Scale, ShieldCheck, UserRound, Wallet,
  type LucideIcon,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ArrowLink, CtaBand, PageHero, Section, SectionHeading } from "@/components/marketing/Section";
import { EarningsSplit } from "@/components/marketing/EarningsSplit";
import { VerificationFlow } from "@/components/marketing/Verification";
import { ReadyChecklist } from "@/components/marketing/ReadyChecklist";
import { TUTOR_SIGNUP_HREF } from "@/components/marketing/Pricing";
import { medianRate } from "@/components/content/insights";
import { Button } from "@/components/ui/Button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/Disclosure";
import { FAQS } from "@/lib/data/content";
import { CREDITS_PER_APPLICATION } from "@/lib/data/platform";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Become a tutor",
  description:
    "Teach online or in person on TutorLink. Set your own rates and schedule, get verified, apply to student jobs, and get paid through Stripe Connect. See plans, commission and requirements.",
  alternates: { canonical: "/become-a-tutor" },
};

const ONBOARDING_PHASES: { title: string; steps: { icon: LucideIcon; title: string; body: string }[] }[] = [
  {
    title: "Set up",
    steps: [
      { icon: UserRound, title: "Create your account", body: "Sign up as a tutor. It takes a minute and you can save progress at any point." },
      { icon: NotebookPen, title: "Build your profile", body: "Subjects and levels, teaching experience, education and your approach — in your own words." },
    ],
  },
  {
    title: "Get ready",
    steps: [
      { icon: Wallet, title: "Set pricing and a trial", body: "Your hourly rate, lesson lengths, and whether you offer a free or reduced-price trial." },
      { icon: CalendarDays, title: "Publish availability", body: "Weekly hours, buffers between lessons, minimum notice, and manual approval or instant booking." },
    ],
  },
  {
    title: "Go live",
    steps: [
      { icon: BadgeCheck, title: "Submit verification", body: "Upload documents for identity, education and certifications, and complete background screening where applicable." },
      { icon: Landmark, title: "Connect payouts", body: "Link a bank account through Stripe Connect so earnings from completed lessons can be paid out." },
    ],
  },
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
                  <span key={m} className={cn("rounded-md px-2 py-0.5 text-[12.5px] font-semibold", i === 2 ? "bg-brand-gradient text-on-brand" : "border border-line text-ink-2")}>
                    {m}m
                  </span>
                ))}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-page p-4">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted">Trial lesson</p>
              <p className="mt-2.5 flex gap-1.5 text-[12.5px] font-semibold">
                <span className="rounded-full border border-line px-2 py-0.5 text-ink-2">Free</span>
                <span className="rounded-full border border-line px-2 py-0.5 text-ink-2">Reduced</span>
                <span className="rounded-full border border-line px-2 py-0.5 text-ink-2">Off</span>
              </p>
            </div>
          </div>
        </ToolTile>

        {/* Families come to you */}
        <ToolTile icon={<MessageSquare />} title="Families come to you" body="Families find you in search and message you directly. Being contacted never costs credits.">
          <div className="space-y-2">
            <div className="w-[85%] rounded-2xl rounded-bl-md bg-canvas px-3.5 py-2.5 text-[13px] text-ink-2">Hi! Are you available for weekly lessons?</div>
            <div className="ml-auto w-[70%] rounded-2xl rounded-br-md bg-brand-gradient px-3.5 py-2.5 text-[13px] text-on-brand">Yes — let&rsquo;s book a trial.</div>
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
            <span className="shrink-0 rounded-lg bg-brand-gradient px-3 py-1.5 text-[12px] font-semibold text-on-brand">
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
            <span className="rounded-md bg-brand-gradient px-2 py-0.5 font-semibold text-on-brand">Paid out</span>
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
        image={{ src: "/images/tutor-at-laptop.jpg", alt: "A tutor smiling while working on a laptop" }}
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
        <div className="mb-12 flex flex-col gap-6 lg:mb-14 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            className="mb-0 lg:mb-0"
            eyebrow="Onboarding"
            title="Six steps to your first lesson."
            accent={3}
            description="Guided, saved as you go, and clear about what's still missing — so you always know what's left before families can book you."
          />
          <Reveal delay={0.1} className="shrink-0">
            <Button asChild variant="brand" size="lg">
              <Link href={TUTOR_SIGNUP_HREF}>
                Start step one <ArrowRight />
              </Link>
            </Button>
          </Reveal>
        </div>

        {/* Three phases, two steps each */}
        <Stagger className="grid gap-5 lg:grid-cols-3" stagger={0.1}>
          {ONBOARDING_PHASES.map((phase, p) => (
            <StaggerItem key={phase.title} className="h-full">
              <div className="relative flex h-full flex-col rounded-2xl border border-line bg-surface">
                <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
                  <span>
                    <span className="block text-[12px] font-semibold uppercase tracking-[0.14em] text-brand">Phase {p + 1}</span>
                    <span className="mt-0.5 block font-heading text-[18px] font-bold tracking-[-0.01em] text-ink">{phase.title}</span>
                  </span>
                  <span className="flex gap-1" aria-hidden>
                    {ONBOARDING_PHASES.map((_, i) => (
                      <span key={i} className={cn("h-1.5 rounded-full", i <= p ? "w-5 bg-brand-gradient" : "w-1.5 bg-line-strong")} />
                    ))}
                  </span>
                </div>
                <ol className="flex flex-1 flex-col gap-5 p-6" start={p * 2 + 1}>
                  {phase.steps.map((s, i) => (
                    <li key={s.title} className="flex gap-4">
                      <span className="relative flex flex-col items-center">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-on-brand shadow-sm">
                          <s.icon className="size-5" aria-hidden />
                        </span>
                        {i === 0 && <span className="mt-2 w-px flex-1 bg-line" aria-hidden />}
                      </span>
                      <span className="min-w-0 pb-1">
                        <span className="block text-[12px] font-semibold tabular-nums text-muted">Step {p * 2 + i + 1}</span>
                        <span className="mt-0.5 block text-[16px] font-bold text-ink">{s.title}</span>
                        <span className="mt-1 block text-[14.5px] leading-relaxed text-ink-2">{s.body}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {/* Finish line */}
        <Reveal className="mt-5">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 sm:p-7">
            <div className="absolute inset-y-0 left-0 w-1 bg-brand-gradient" aria-hidden />
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-gradient text-on-brand">
                  <Check className="size-6" strokeWidth={2.6} aria-hidden />
                </span>
                <div>
                  <p className="font-heading text-[20px] font-bold tracking-[-0.015em] text-ink">You&rsquo;re live</p>
                  <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-ink-2">
                    Families can find and book you. Each lesson gets its own page with the meeting link, notes and homework — and your dashboard shows what&rsquo;s next.
                  </p>
                </div>
              </div>
              <ul className="flex shrink-0 flex-wrap gap-2 text-[13px] font-medium text-ink-2">
                {["Saved as you go", "Change anything later"].map((x) => (
                  <li key={x} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5">
                    <Check className="size-3.5 text-success" strokeWidth={2.6} aria-hidden /> {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Requirements"
          title="What you'll need."
          accent={2}
          description="We keep the bar clear and the same for everyone — most tutors already have everything on this list."
        />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-8">
          <Reveal>
            <ReadyChecklist signupHref={TUTOR_SIGNUP_HREF} />
          </Reveal>

          <Reveal delay={0.1} className="space-y-4 lg:sticky lg:top-28">
            <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 sm:p-7">
              <div className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" aria-hidden />
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-brand-gradient text-on-brand">
                  <Handshake className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-heading text-[19px] font-bold tracking-[-0.015em] text-ink">Community standards</p>
                  <p className="text-[13.5px] text-muted">Every tutor agrees to these before teaching.</p>
                </div>
              </div>
              <ol className="mt-6 space-y-3.5">
                {[
                  "Keep communication and payment on TutorLink",
                  "Never share or ask for personal contact details before a booking",
                  "Show up on time, and cancel early if you must",
                  "Follow the safeguards for lessons with minors",
                  "List only qualifications you can verify",
                ].map((t, i) => (
                  <li key={t} className="flex items-start gap-3 text-[14.5px] leading-snug text-ink-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-soft text-[12px] font-bold tabular-nums text-brand">{i + 1}</span>
                    <span className="pt-0.5">{t}</span>
                  </li>
                ))}
              </ol>
              <ArrowLink href="/safety" className="mt-6">
                Read the safety guidelines
              </ArrowLink>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-line bg-canvas p-5">
              <Lock className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
              <p className="text-[14px] leading-relaxed text-ink-2">
                <span className="font-semibold text-ink">Your documents stay private.</span> IDs and certificates are used only to verify you — families see a badge, never the document.
              </p>
            </div>
          </Reveal>
        </div>
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
        <div className="mb-10 flex flex-col gap-6 lg:mb-12 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            className="mb-0 lg:mb-0"
            eyebrow="Earnings"
            title="You set the rate. The commission is on the page."
            accent={3}
            description="Families pay your listed rate. TutorLink's commission comes out of each paid lesson — and it's lower on paid plans. Try your own numbers."
          />
          <Reveal delay={0.1} className="shrink-0">
            <ArrowLink href="/pricing#calculator">Estimate your monthly earnings</ArrowLink>
          </Reveal>
        </div>
        <Reveal>
          <EarningsSplit initialRateCents={rate} isMedian={!!median} />
        </Reveal>
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
