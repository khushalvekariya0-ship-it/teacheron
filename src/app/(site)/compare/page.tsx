import type { Metadata } from "next";
import { Suspense } from "react";
import { Award, CalendarCheck, GraduationCap, Scale, Star } from "lucide-react";
import { Reveal, WordReveal } from "@/components/motion";
import { CompareSkeleton, CompareView } from "@/components/search/CompareView";
import { Panel } from "@/components/marketing/Section";

export const metadata: Metadata = {
  title: "Compare tutors",
  description: "See up to three tutors side by side: subjects, experience, credentials, availability, rates and verification.",
  alternates: { canonical: "/compare" },
  robots: { index: false, follow: true },
};

/** What the comparison table covers — mirrors the row groups in CompareView. */
const COMPARED = [
  { icon: GraduationCap, title: "Teaching", items: "Subjects, grade levels, experience, languages" },
  { icon: Award, title: "Credentials", items: "Education, certifications, verification checks" },
  { icon: Star, title: "Reviews", items: "Rating and reviews from completed lessons" },
  { icon: CalendarCheck, title: "Price & booking", items: "Hourly rate, trial, availability, lesson type, area" },
];

export default function ComparePage() {
  return (
    <>
      <section className="relative isolate border-b border-line bg-page">
        <div className="page-glow pointer-events-none absolute inset-0 -z-10" aria-hidden />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-line-grid [mask-image:radial-gradient(ellipse_80%_70%_at_50%_0%,black_20%,transparent_75%)]" aria-hidden />
        <div className="container-page grid grid-cols-1 items-center gap-10 pb-10 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 lg:pb-14 lg:pt-20">
          <div>
            <Reveal>
              <p className="kicker">
                <span className="size-1.5 rounded-full bg-brand" aria-hidden />
                Compare
              </p>
            </Reveal>
            <WordReveal
              text="Compare tutors side by side"
              accent={3}
              className="mt-5 font-heading text-[2.5rem] font-bold leading-[1.04] tracking-[-0.03em] text-ink sm:text-[3.2rem] lg:text-[3.5rem]"
            />
            <Reveal delay={0.2}>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
                Put up to three tutors next to each other and see every fact from their profiles in one place — so the choice is yours, not ours.
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <p className="mt-6 inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px] font-medium text-ink-2">
                <Scale className="size-4 text-brand" aria-hidden /> No rankings, no winners — only facts
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.2}>
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-[0_24px_60px_-36px_rgb(15_23_42/0.45)] sm:p-7">
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-muted">What you can compare</p>
              <ul className="mt-5 grid gap-5 sm:grid-cols-2">
                {COMPARED.map((c) => (
                  <li key={c.title} className="flex gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white">
                      <c.icon className="size-5" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-[15.5px] font-semibold text-ink">{c.title}</span>
                      <span className="mt-0.5 block text-[13.5px] leading-snug text-muted">{c.items}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <Panel aria-label="Comparison">
        <div className="container-page pb-20 pt-8 sm:pt-10">
          <Suspense fallback={<CompareSkeleton />}>
            <CompareView />
          </Suspense>
        </div>
      </Panel>
    </>
  );
}
