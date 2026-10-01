import type { Metadata } from "next";
import { ArrowRight, Check, CircleAlert, GraduationCap, Monitor, Users, UsersRound } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ArrowLink, CtaBand, PageHero, Section, SectionHeading } from "@/components/marketing/Section";
import { DEFAULT_POLICY } from "@/lib/data/platform";

export const metadata: Metadata = {
  title: "Safety guidelines",
  description: "Practical safety guidelines for families and tutors on TutorLink — online and in-person lessons, protecting minors, avoiding scams, and how to report a concern.",
  alternates: { canonical: "/safety" },
};

function GuideCard({ icon, title, intro, items }: { icon: React.ReactNode; title: string; intro: string; items: { t: string; b: string }[] }) {
  return (
    <div className="h-full rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <span className="grid size-11 place-items-center rounded-lg bg-brand-soft text-ink [&_svg]:size-5">{icon}</span>
      <h2 className="mt-5 font-heading text-[1.75rem] font-bold leading-[1.08] tracking-[-0.03em] text-ink">{title}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{intro}</p>
      <ol className="mt-6 space-y-4">
        {items.map((it, i) => (
          <li key={it.t} className="flex gap-3.5">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-ink text-[12px] font-bold tabular-nums text-on-ink">{i + 1}</span>
            <div>
              <h3 className="text-[15.5px] font-bold text-ink">{it.t}</h3>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{it.b}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function SafetyPage() {
  return (
    <>
      <PageHero
        eyebrow="Safety guidelines"
        title="Simple habits for safer lessons."
        description="Practical guidance for families and tutors, online and in person. Our safeguards do a lot automatically — these steps do the rest."
        actions={
          <a href="#report" className="group inline-flex items-center gap-1.5 text-[16px] font-semibold text-ink underline decoration-2 underline-offset-[6px] transition-[text-underline-offset] hover:underline-offset-[4px]">
            How to report a concern <ArrowRight className="size-[18px] transition-transform duration-300 group-hover:translate-x-1" />
          </a>
        }
      />

      <Section>
        <div className="grid gap-5 lg:grid-cols-2">
          <Reveal className="h-full">
            <GuideCard
              icon={<UsersRound />}
              title="For families and students"
              intro="Before and during lessons with a new tutor."
              items={[
                { t: "Keep everything on TutorLink", b: "Message, book and pay through the platform. It keeps a record and protects you if something goes wrong." },
                { t: "Check what's verified", b: "Look for badges on the profile and read what each one means. A check that's in progress shows no badge." },
                { t: "Start with a trial", b: "Use a first lesson to judge fit and professionalism before committing to a series." },
                { t: "Stay close for younger learners", b: "For students under 18, a parent or guardian should be at home or nearby during in-person lessons." },
                { t: "Never share passwords or card details", b: "No tutor or TutorLink employee will ask for your password or full card number in a message." },
                { t: "Trust your instincts", b: "If something feels off, end the lesson, block the conversation and report it. You don't need to be certain." },
              ]}
            />
          </Reveal>
          <Reveal delay={0.1} className="h-full">
            <GuideCard
              icon={<GraduationCap />}
              title="For tutors"
              intro="Professional boundaries that protect you and your students."
              items={[
                { t: "Communicate with parents about minors", b: "For students under 18, plan lessons with the parent account. Messages about minors are visible to parents." },
                { t: "Don't ask for personal contact details", b: "Keep communication on TutorLink. Contact details are masked automatically, and requesting them violates our Terms." },
                { t: "Keep lessons visible", b: "Teach in common areas of the home or in public spaces, and keep online lessons on the lesson page." },
                { t: "No private social media with students", b: "Don't connect with or message students under 18 on personal social media or other apps." },
                { t: "Don't record without consent", b: "Only record a lesson with the written consent of the student — and the parent, for students under 18." },
                { t: "Report concerns about a student's welfare", b: "If a student discloses harm or you see signs of it, contact us, and follow any legal reporting duties that apply to you." },
              ]}
            />
          </Reveal>
        </div>
      </Section>

      <Section tone="canvas">
        <SectionHeading eyebrow="Where lessons happen" title="Online and in person." />
        <Stagger className="grid gap-5 lg:grid-cols-2" stagger={0.1}>
          {[
            {
              icon: <Monitor />,
              title: "Online lessons",
              points: [
                `Join from the lesson page. The meeting link appears ${DEFAULT_POLICY.meetingLinkVisibleMinutesBefore} minutes before the start time.`,
                "Don't share the link or post it anywhere public.",
                "Use a quiet, visible space — for younger students, a shared room rather than a bedroom.",
                "Use the lesson page for notes and files instead of email or personal drives.",
              ],
            },
            {
              icon: <Users />,
              title: "In-person lessons",
              points: [
                "Tutors show an approximate service area, never a home address.",
                "Agree on the meeting place in messages so there's a record.",
                "For a first meeting, consider a public place such as a library.",
                "Let someone know where the lesson is and when it should end.",
              ],
            },
          ].map((b) => (
            <StaggerItem key={b.title} className="h-full">
              <div className="h-full rounded-2xl border border-line bg-surface p-6 sm:p-8">
                <h3 className="flex items-center gap-3 font-heading text-xl font-bold tracking-[-0.03em] text-ink">
                  <span className="grid size-10 place-items-center rounded-lg bg-sky-soft text-ink [&_svg]:size-5">{b.icon}</span> {b.title}
                </h3>
                <ul className="mt-5 space-y-3">
                  {b.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-ink-2">
                      <Check className="mt-1 size-4 shrink-0 text-ink" strokeWidth={2.6} aria-hidden /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <SectionHeading className="mb-0 self-start sm:items-start lg:sticky lg:top-28" eyebrow="Scams" title="Red flags to watch for." description="Most scams start by moving the conversation or the money somewhere else." />
          <Stagger className="divide-y divide-line border-y border-line" stagger={0.06}>
            {[
              { t: "“Let's pay outside the app — it's cheaper.”", b: "Off-platform payments aren't covered by refunds or disputes. Decline and report it." },
              { t: "Overpayments and refund requests", b: "Someone “accidentally” pays too much and asks you to send the difference back. Don't." },
              { t: "Requests for ID or bank documents in messages", b: "Identity and payout details are only ever collected through verification and Stripe — never in a chat." },
              { t: "Links to unfamiliar sites or apps", b: "Be cautious of links asking you to sign in or download something. Use the lesson page for meetings." },
              { t: "Pressure and urgency", b: "Legitimate tutors and families don't need you to decide right now. Take your time." },
            ].map((r) => (
              <StaggerItem key={r.t} className="flex gap-4 py-5">
                <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
                <div>
                  <h3 className="text-[16px] font-bold text-ink">{r.t}</h3>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{r.b}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Section>

      <Section id="report" tone="canvas" className="scroll-mt-16">
        <SectionHeading eyebrow="How to report" title="If something isn't right, tell us." description="Every report is reviewed by a person on our trust & safety team. You don't need proof to report a concern." />
        <Stagger as="ol" className="grid gap-4 md:grid-cols-3" stagger={0.08}>
          {[
            { t: "In the moment", b: "End the lesson if you need to. If anyone is in immediate danger, call 911." },
            { t: "Report it on TutorLink", b: `Use Report on the conversation, profile or review, or open a dispute from the lesson page within ${DEFAULT_POLICY.disputeWindowDays} days.` },
            { t: "We follow up", b: "We may restrict the account while we investigate, and we'll let you know when the report is resolved." },
          ].map((s, i) => (
            <StaggerItem as="li" key={s.t} className="h-full">
              <div className="h-full rounded-2xl border border-line bg-surface p-6">
                <span className="inline-flex rounded-md bg-ink px-2 py-0.5 text-[12.5px] font-bold tabular-nums text-on-ink">Step {i + 1}</span>
                <h3 className="mt-3 font-heading text-xl font-bold tracking-[-0.03em] text-ink">{s.t}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{s.b}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal className="mt-8 flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="text-sm text-ink-2">
            Suspected exploitation of a child can also be reported to NCMEC&rsquo;s CyberTipline: <span className="font-semibold text-ink">1-800-843-5678</span> or report.cybertip.org.
          </p>
          <ArrowLink href="/contact" className="shrink-0">
            Contact trust &amp; safety
          </ArrowLink>
        </Reveal>
      </Section>

      <CtaBand title="See how our safeguards work." description="Verification, reviews, messaging protections and disputes — explained in detail." primary={{ href: "/trust-safety", label: "Trust & safety" }} secondary={{ href: "/contact", label: "Contact us" }} />
    </>
  );
}
