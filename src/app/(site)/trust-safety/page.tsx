import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, Baby, BadgeCheck, Ban, BookOpenCheck, CalendarCheck2, CirclePause, ClipboardList, Eye, FileSearch, Flag, Gavel, HeartHandshake, KeyRound,
  Link2, MapPin, MessageSquareLock, MessageSquareReply, MessageSquareWarning, Scale, ShieldAlert, Star, UserCheck, UserPlus, UserX, Wallet,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ArrowLink, CtaBand, PageHero, Section, SectionHeading } from "@/components/marketing/Section";
import { CardGrid, Split } from "@/components/marketing/Split";
import { MessageVignette, ReviewVignette, VerificationVignette } from "@/components/marketing/Vignettes";
import { VerificationChecksGrid, VerificationFlow } from "@/components/marketing/Verification";
import { DEFAULT_POLICY } from "@/lib/data/platform";
import { SafetyForm } from "@/components/content/SafetyForm";

export const metadata: Metadata = {
  title: "Trust & safety",
  description:
    "How TutorLink verifies tutors, keeps reviews honest, protects messaging, safeguards minors, sets community rules and handles reports, appeals and disputes.",
  alternates: { canonical: "/trust-safety" },
};

const JUMP = [
  { href: "#verification", label: "Verification" },
  { href: "#reviews", label: "Reviews" },
  { href: "#messaging", label: "Messaging" },
  { href: "#minors", label: "Minors" },
  { href: "#rules", label: "Community rules" },
  { href: "#disputes", label: "Disputes" },
  { href: "#report", label: "Report a concern" },
];

/** The rules everyone agrees to (they apply in chat, lessons, profiles, reviews and job posts). */
const RULES = [
  { icon: <HeartHandshake />, title: "Be respectful", body: "No harassment, threats, bullying, hate speech or sexual comments. Harassment means unwanted or repeated behaviour that upsets, scares or targets someone, in chat, in a lesson, in a review, on or off TutorLink." },
  { icon: <MessageSquareLock />, title: "Keep it on TutorLink", body: "No phone numbers, emails, social media or outside links, and no paying outside TutorLink. That is how we can protect both sides if something goes wrong." },
  { icon: <BadgeCheck />, title: "Be honest", body: "Use your real name and your real qualifications. No fake profiles, fake reviews or misleading claims." },
  { icon: <BookOpenCheck />, title: "Learning, not cheating", body: "Tutors explain, guide and check work. They don't do graded homework, assignments or exams for students, and students shouldn't ask them to." },
  { icon: <UserCheck />, title: "One account per person", body: "Don't share your login, use someone else's account, or open a new account after a suspension." },
  { icon: <Baby />, title: "Protect children", body: "Parents hold the accounts of children under 13, and a parent or another adult should be nearby at in-person lessons with under-18s. Any risk to a child is acted on at once." },
];

/** What happens when a rule is broken, from the lightest step to the heaviest. */
const STEPS_IF_BROKEN = [
  { icon: <MessageSquareWarning />, title: "A warning", body: "A message from our team, or the chat stopping a message and explaining why." },
  { icon: <CirclePause />, title: "A pause", body: "Sending messages is paused for a while: automatically after repeated attempts, or by our team." },
  { icon: <UserX />, title: "Suspension", body: "The account can't be used. It can be appealed once, with the form at the bottom of this page." },
  { icon: <Gavel />, title: "Removal", body: "Serious or repeated harm closes the account for good, and we report it to the authorities when the law requires." },
];

export default function TrustSafetyPage() {
  const disputeSteps = [
    { icon: <Flag />, title: "Open a dispute", body: `From the lesson page, within ${DEFAULT_POLICY.disputeWindowDays} days of the lesson. Choose a reason and add details or files.` },
    { icon: <FileSearch />, title: "We review both sides", body: "Our team looks at the booking history, messages about the lesson and anything either side provides. We may ask for more information." },
    { icon: <Scale />, title: "A clear outcome", body: "A full or partial refund, a credit, or confirmation of the charge — with a note explaining the decision." },
    { icon: <Wallet />, title: "Payouts wait for the window", body: `Tutor earnings become available only after the ${DEFAULT_POLICY.disputeWindowDays}-day window closes, so refunds never depend on chasing a payment.` },
  ];

  return (
    <>
      <PageHero
        eyebrow="Trust & safety"
        title="Trust you can check, not just take on faith."
        description="Verification before badges, reviews only from real lessons, protected messaging and safeguards for minors. Here is exactly how each one works."
      >
        <Reveal delay={0.4}>
          <nav aria-label="On this page" className="mt-10 flex flex-wrap gap-2">
            {JUMP.map((l) => (
              <a key={l.href} href={l.href} className="rounded-full border border-line-strong bg-surface px-4 py-1.5 text-[14px] font-medium text-ink shadow-xs transition-colors hover:border-ink">
                {l.label}
              </a>
            ))}
          </nav>
        </Reveal>
      </PageHero>

      <Section id="verification" className="scroll-mt-16">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading
              className="mb-8"
              eyebrow="Verification"
              title="Four separate checks. A badge only when one is complete."
              description="Tutors submit documents for each check. Our team reviews them, and each check carries its own status. A badge appears on a profile only when that specific check is verified — nothing is implied while it's in progress."
            />
            <Reveal delay={0.1}>
              <p className="text-[15px] leading-relaxed text-ink-2">
                Verification confirms specific facts — who someone is, and the credentials they list. It isn&rsquo;t an endorsement, so we also encourage every family to read reviews, start with a trial and follow our{" "}
                <Link href="/safety" className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">safety guidelines</Link>.
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <div className="mx-auto max-w-md lg:max-w-none">
              <VerificationVignette />
            </div>
          </Reveal>
        </div>
        <div className="mt-14">
          <VerificationChecksGrid />
        </div>
        <div className="mt-14">
          <Reveal>
            <h3 className="mb-5 font-heading text-2xl font-bold tracking-[-0.025em] text-ink">Every state a check can be in</h3>
          </Reveal>
          <VerificationFlow />
        </div>
      </Section>

      <Section id="reviews" tone="canvas" className="scroll-mt-16">
        <Split
          eyebrow="Reviews"
          title="Only from lessons that actually happened."
          description="Every review is tied to a completed booking, and ratings are calculated from those reviews alone."
          features={[
            { icon: <CalendarCheck2 />, title: "Completed bookings only", body: "A family can review a tutor only after a lesson is marked completed — one review per booking." },
            { icon: <Star />, title: "No invented ratings", body: "A tutor without reviews shows “New · no reviews yet”, never a placeholder score." },
            { icon: <MessageSquareReply />, title: "Tutors can respond", body: "Tutors can reply publicly to a review. Reviews that break our guidelines can be reported and removed." },
          ]}
          visual={<ReviewVignette />}
        />
      </Section>

      <Section id="messaging" className="scroll-mt-16">
        <Split
          reverse
          eyebrow="Messaging protections"
          title="Conversations that stay safe and on the record."
          description="Messaging is free and happens on TutorLink, which gives both sides protection if something goes wrong."
          features={[
            { icon: <MessageSquareLock />, title: "Contact masking", body: "Phone numbers and email addresses are detected and hidden automatically in messages, booking notes and reviews." },
            { icon: <Ban />, title: "Blocking", body: "Block a conversation at any time. Only the person who blocked can unblock it." },
            { icon: <MessageSquareWarning />, title: "Respectful chat", body: "Messages with abusive or threatening words, in English, Hindi or Gujarati, aren't sent: the sender is asked to rephrase, and repeated tries reach our team." },
            { icon: <Flag />, title: "Reporting", body: "Report a member, message, review or job post in a couple of taps. Each report is tracked from open to resolved, and you're told when it's closed." },
            { icon: <KeyRound />, title: "Restricted staff access", body: "Only authorized trust & safety staff can view messages, only when investigating a report or dispute — and every access is recorded in an audit log." },
          ]}
          visual={<MessageVignette />}
        />
      </Section>

      <Section id="minors" tone="canvas" className="scroll-mt-16">
        <SectionHeading eyebrow="Safeguards for minors" title="Designed around young learners." description="These safeguards apply automatically to every account and booking that involves a student under 18." />
        <CardGrid
          items={[
            { icon: <UserPlus />, title: "Parents hold the account", body: "Children under 13 learn through a child profile on a parent account. Teens need a parent or guardian's consent." },
            { icon: <Eye />, title: "Parents see messages", body: "Conversations about a minor are visible to the parent account, labelled with the child's name." },
            { icon: <MapPin />, title: "No home addresses", body: "In-person tutors show an approximate service area. Families choose where lessons happen." },
            { icon: <Link2 />, title: "Private lesson links", body: `Online meeting links appear ${DEFAULT_POLICY.meetingLinkVisibleMinutesBefore} minutes before a lesson, on the lesson page only.` },
            { icon: <ClipboardList />, title: "A record of every lesson", body: "Attendance, notes and homework are kept on the platform, so parents always know what happened." },
            { icon: <ShieldAlert />, title: "Zero tolerance", body: "Any sign of grooming, exploitation or abuse leads to immediate suspension and a report to the appropriate authorities." },
          ]}
        />
      </Section>

      <Section id="rules" className="scroll-mt-16">
        <SectionHeading eyebrow="Community rules" title="Respect, honesty and safety, for everyone." description="Everyone on TutorLink agrees to these rules. They apply in chat, lessons, profiles, reviews and job posts." />
        <CardGrid items={RULES} />
        <div className="mt-14">
          <Reveal>
            <h3 className="font-heading text-2xl font-bold tracking-[-0.025em] text-ink">If a rule is broken</h3>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">
              Most problems end with a warning. Serious harm, like threats or anything that puts a child at risk, can go straight to suspension or removal.
            </p>
          </Reveal>
          <Stagger as="ol" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
            {STEPS_IF_BROKEN.map((s, i) => (
              <StaggerItem as="li" key={s.title} className="relative h-full">
                <div className="h-full rounded-2xl border border-line bg-surface p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <span className="grid size-11 place-items-center rounded-lg bg-canvas text-ink [&_svg]:size-5">{s.icon}</span>
                    <span className="font-heading text-[15px] font-bold tabular-nums text-ink">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h4 className="mt-4 text-[17px] font-bold tracking-[-0.01em] text-ink">{s.title}</h4>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{s.body}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Section>

      <Section id="disputes" tone="canvas" className="scroll-mt-16">
        <SectionHeading eyebrow="Disputes" title="When a lesson goes wrong." description={`A confirmed tutor no-show is refunded in full. For anything else, open a dispute within ${DEFAULT_POLICY.disputeWindowDays} days.`} />
        <Stagger as="ol" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
          {disputeSteps.map((s, i) => (
            <StaggerItem as="li" key={s.title} className="relative h-full">
              <div className="h-full rounded-2xl border border-line bg-surface p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-lg bg-canvas text-ink [&_svg]:size-5">{s.icon}</span>
                  <span className="font-heading text-[15px] font-bold tabular-nums text-ink">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-4 text-[17px] font-bold tracking-[-0.01em] text-ink">{s.title}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{s.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal className="mt-8">
          <ArrowLink href="/how-it-works#policies">Cancellation and refund policy</ArrowLink>
        </Reveal>
      </Section>

      <Section id="report" className="scroll-mt-16">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <SectionHeading className="mb-8" eyebrow="Report a concern" title="Tell us. We'll take it from there." />
            <Stagger className="space-y-4" stagger={0.07}>
              {[
                { t: "From a conversation", b: "Open the conversation menu and choose Report or Block." },
                { t: "From a lesson page", b: `Report a no-show after ${DEFAULT_POLICY.noShowGraceMinutes} minutes, or open a dispute within ${DEFAULT_POLICY.disputeWindowDays} days.` },
                { t: "From a profile, review or job post", b: "Use the Report link on the item itself." },
                { t: "Anything else, or without an account", b: "Use the form below. No login needed." },
              ].map((r) => (
                <StaggerItem key={r.t} className="rounded-xl border border-line bg-surface p-4">
                  <h3 className="text-[16px] font-bold text-ink">{r.t}</h3>
                  <p className="mt-1 text-sm text-ink-2">{r.b}</p>
                </StaggerItem>
              ))}
            </Stagger>
            <Reveal className="mt-8">
              <h3 className="text-[17px] font-bold text-ink">What happens next</h3>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink-2">
                <li>A person on our team reads every report.</li>
                <li>We look at the messages, lessons and history involved, and may ask you for more details.</li>
                <li>If you&rsquo;re logged in, you get an update in your notifications when it&rsquo;s closed. If you used the form, we reply by email when we need more details. For privacy, we don&rsquo;t share details about another person&rsquo;s account.</li>
              </ol>
            </Reveal>
            <Reveal className="mt-8">
              <h3 className="text-[17px] font-bold text-ink">Think we got it wrong? Appeal</h3>
              <ul className="mt-3 space-y-1.5 text-[15px] leading-relaxed text-ink-2">
                <li><span className="font-semibold text-ink">A message stopped as contact details:</span> tap &ldquo;Ask for a review&rdquo; under it.</li>
                <li><span className="font-semibold text-ink">Messaging paused:</span> choose &ldquo;Ask to unlock messaging&rdquo; in Messages.</li>
                <li><span className="font-semibold text-ink">Account suspended:</span> choose &ldquo;Appeal a suspension&rdquo; in the form below, with your account&rsquo;s email.</li>
              </ul>
            </Reveal>
          </div>
          <Reveal delay={0.1} className="space-y-4">
            <div className="rounded-2xl border border-danger-200 bg-danger-50 p-6">
              <h3 className="text-[16px] font-bold text-ink">If someone is in immediate danger</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">Call your local emergency number first: 112 in India, 911 in the US. Then report it to us so we can act on the account.</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-6">
              <h3 className="text-[16px] font-bold text-ink">Suspected exploitation of a child</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                You can also report it directly. In India: Childline 1098, or the National Cyber Crime Reporting Portal at cybercrime.gov.in (helpline 1930). In
                the US: the National Center for Missing &amp; Exploited Children&rsquo;s CyberTipline at 1-800-843-5678 or report.cybertip.org.
              </p>
            </div>
            <a href="#report-form" className="group flex items-center justify-between rounded-2xl bg-night p-6 transition-colors hover:bg-night/90">
              <span>
                <span className="block text-[16px] font-bold text-white">Report without logging in</span>
                <span className="text-sm text-white/70">Every report is read by a person.</span>
              </span>
              <ArrowRight className="size-5 text-white transition-transform group-hover:translate-x-1" aria-hidden />
            </a>
          </Reveal>
        </div>
        <div id="report-form" className="mt-14 scroll-mt-24">
          <Reveal>
            <h3 className="mb-4 font-heading text-2xl font-bold tracking-[-0.025em] text-ink">Send a report or an appeal</h3>
          </Reveal>
          <SafetyForm />
        </div>
      </Section>

      <CtaBand title="Read the practical guidelines." description="Simple habits for families and tutors that make every lesson safer — online and in person." primary={{ href: "/safety", label: "Safety guidelines" }} secondary={{ href: "/faq", label: "Safety FAQ" }} />
    </>
  );
}
