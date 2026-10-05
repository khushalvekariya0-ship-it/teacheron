import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, Compass, GitCompareArrows, Globe, GraduationCap, Link2, NotebookPen, RefreshCw, Search, ShieldCheck, Star, Target, UserRound } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ArrowLink, CtaBand, PageHero, Section, SectionHeading } from "@/components/marketing/Section";
import { Split } from "@/components/marketing/Split";
import { ProgressVignette, SearchVignette, SlotVignette } from "@/components/marketing/Vignettes";
import { SubjectTile } from "@/components/content/SubjectTile";
import { Button } from "@/components/ui/Button";
import { SUBJECT_BY_SLUG } from "@/lib/data/catalog";
import { TUTORS } from "@/lib/data/tutors";
import { DEFAULT_POLICY } from "@/lib/data/platform";

export const metadata: Metadata = {
  title: "Tutoring for students",
  description:
    "Find a tutor for your exact course — AP, SAT and ACT, college chemistry, coding and more. Compare tutors, book lessons in your time zone and keep notes and homework in one place.",
  alternates: { canonical: "/for-students" },
};

const STUDENT_SUBJECTS = ["sat", "act", "ap-exams", "calculus", "chemistry", "physics", "statistics", "college-essays", "python", "spanish", "gre", "lsat"];

export default function ForStudentsPage() {
  const subjects = STUDENT_SUBJECTS.map((s) => SUBJECT_BY_SLUG[s]).filter(Boolean);
  const college = TUTORS.filter((t) => t.levels.includes("college")).length;
  const adult = TUTORS.filter((t) => t.levels.includes("adult")).length;
  const high = TUTORS.filter((t) => t.levels.includes("high")).length;

  return (
    <>
      <PageHero
        image={{ src: "/images/lesson-online.jpg", alt: "A student in headphones following an online lesson on her laptop" }}
        eyebrow="For students"
        title="Help that fits your classes, your goals and your week."
        description="Whether it's a unit test on Friday, an AP exam in May or a career change into software, find a tutor who teaches exactly what you're working on."
        actions={
          <>
            <Button asChild size="lg">
              <Link href="/tutors">
                Find a tutor <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/concierge">
                <Compass /> Help me find a tutor
              </Link>
            </Button>
          </>
        }
      />

      <Section>
        <Split
          eyebrow="Find your tutor"
          title="Search by what you're actually studying."
          description="Not just “math” — AP Calculus BC, Digital SAT reading, organic chemistry or AP Computer Science A."
          features={[
            { icon: <Search />, title: "Filters that matter", body: "Subject, grade or level, schedule, budget, online or in person, and learning support." },
            { icon: <Target />, title: "Matches you can read", body: "Every recommendation shows which factors matched and which didn't — no mystery ranking." },
            { icon: <GitCompareArrows />, title: "Compare before you commit", body: "Put up to three tutors side by side: rates, experience, verification and availability." },
          ]}
          visual={<SearchVignette />}
          action={
            <ArrowLink href="/how-it-works#matching">How matching is scored</ArrowLink>
          }
        />
      </Section>

      <Section tone="canvas">
        <SectionHeading
          eyebrow="Popular with students"
          title="Test prep, AP and college courses."
          description="Tutor counts and starting rates below come straight from current listings."
          action={
            <ArrowLink href="/subjects">All subjects</ArrowLink>
          }
        />
        <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" stagger={0.04}>
          {subjects.map((s) => (
            <StaggerItem key={s.slug} className="h-full">
              <SubjectTile subject={s} />
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      <Section>
        <Split
          reverse
          eyebrow="Scheduling"
          title="Lessons that work around school."
          description="Open times come from each tutor's real calendar and are shown in your time zone — handy when your tutor lives three time zones away."
          features={[
            { icon: <Globe />, title: "Your time zone, automatically", body: "No mental math. Times convert for you on search, profiles and every lesson page." },
            { icon: <Link2 />, title: "One page per lesson", body: `The meeting link appears ${DEFAULT_POLICY.meetingLinkVisibleMinutesBefore} minutes before an online lesson, alongside notes and homework.` },
            { icon: <RefreshCw />, title: "Plans change", body: `Reschedule up to ${DEFAULT_POLICY.rescheduleMinHours} hours before a lesson, up to ${DEFAULT_POLICY.maxReschedulesPerBooking} times per booking.` },
          ]}
          visual={<SlotVignette />}
        />
      </Section>

      <Section tone="canvas">
        <Split
          eyebrow="Between lessons"
          title="Stay on track, not just caught up."
          description="Your tutor's notes, homework and goals live in one place, so each session builds on the last."
          features={[
            { icon: <NotebookPen />, title: "Lesson notes", body: "A short recap after each lesson: what you covered and what comes next." },
            { icon: <CalendarClock />, title: "Homework with due dates", body: "Submit work where your tutor can review it — no lost email attachments." },
            { icon: <Star />, title: "Your review counts", body: "After a completed lesson you can review your tutor. Reviews only come from completed lessons." },
          ]}
          visual={<ProgressVignette />}
        />
      </Section>

      <Section>
        <div className="grid gap-5 lg:grid-cols-2">
          <Reveal className="h-full">
            <div className="h-full rounded-2xl border border-line bg-surface p-6 sm:p-8">
              <span className="grid size-11 place-items-center rounded-lg bg-sky-soft text-ink">
                <GraduationCap className="size-5" />
              </span>
              <h2 className="mt-5 font-heading text-[1.75rem] font-bold leading-[1.08] tracking-[-0.03em] text-ink">College students and adult learners</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
                Book and pay on your own account. Filter for tutors who work with college students or adults — useful for gateway courses, graduate admissions tests or learning to code.
              </p>
              <dl className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { k: "High school", v: high },
                  { k: "College", v: college },
                  { k: "Adult learners", v: adult },
                ].map((s) => (
                  <div key={s.k} className="rounded-xl bg-canvas p-3">
                    <dt className="text-[12px] text-muted">{s.k}</dt>
                    <dd className="mt-0.5 font-heading text-xl font-bold tracking-[-0.03em] tabular-nums text-ink">
                      {s.v} <span className="text-[12px] font-normal text-muted">tutors</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild variant="secondary">
                  <Link href="/tutors?level=college">College-level tutors</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/tutors?level=adult">Tutors for adults</Link>
                </Button>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="h-full">
            <div className="h-full rounded-2xl bg-canvas p-6 sm:p-8">
              <span className="grid size-11 place-items-center rounded-lg bg-surface text-ink">
                <UserRound className="size-5" />
              </span>
              <h2 className="mt-5 font-heading text-[1.75rem] font-bold leading-[1.08] tracking-[-0.03em] text-ink">Under 18?</h2>
              <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-2">
                <li className="border-l-[3px] border-brand pl-3">
                  <span className="font-semibold text-ink">13 to 17:</span> you need a parent or guardian&rsquo;s permission to use TutorLink. Many families have a parent handle bookings and payments.
                </li>
                <li className="border-l-[3px] border-brand pl-3">
                  <span className="font-semibold text-ink">Under 13:</span> a parent creates the account and adds you as a child profile.
                </li>
                <li className="border-l-[3px] border-brand pl-3">
                  Messages about minors are visible to the parent account, and contact details are always masked.
                </li>
              </ul>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <Link href="/for-parents" className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
                  How parent accounts work
                </Link>
                <Link href="/safety" className="inline-flex items-center gap-1.5 font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
                  <ShieldCheck className="size-4" /> Safety guidelines
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      <CtaBand
        title="Start with one lesson."
        description="Search and messaging are free. Many tutors offer a free or low-cost trial so you can check the fit first."
        primary={{ href: "/tutors", label: "Find a tutor" }}
        secondary={{ href: "/blog/digital-sat-study-plan", label: "Read: a 10-week SAT plan" }}
      />
    </>
  );
}
