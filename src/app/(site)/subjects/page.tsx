import type { Metadata } from "next";
import { Reveal, WordReveal } from "@/components/motion";
import { CtaBand } from "@/components/marketing/Section";
import { AreaMosaic, CatalogFacts, SubjectAreas } from "@/components/content/SubjectCatalog";
import { SubjectSearch } from "@/components/home/SubjectSearch";
import { DEFAULT_SUBJECTS } from "@/lib/data/catalog";

export const metadata: Metadata = {
  title: "Browse subjects",
  description: `Tutors for ${DEFAULT_SUBJECTS.length} subjects across math, science, English, test prep, world languages, computer science, history, music and learning support — online and in person.`,
  alternates: { canonical: "/subjects" },
};

export default function SubjectsPage() {
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
                Subjects
              </p>
            </Reveal>
            <WordReveal
              text="Every subject, from first words to final exams."
              accent={2}
              className="mt-5 font-heading text-[2.5rem] font-bold leading-[1.04] tracking-[-0.03em] text-ink sm:text-[3.2rem] lg:text-[3.5rem]"
            />
            <Reveal delay={0.2}>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
                Search for what you want to learn, or browse by area — then open a subject to see the tutors who teach it, their rates and whether they offer a trial.
              </p>
            </Reveal>
            <Reveal delay={0.3} className="relative z-[35] mt-8 max-w-xl">
              <SubjectSearch />
            </Reveal>
            <Reveal delay={0.4}>
              <CatalogFacts />
            </Reveal>
          </div>

          {/* Mosaic of the most popular areas — each jumps to its section */}
          <Reveal delay={0.2} className="hidden sm:block">
            <AreaMosaic />
          </Reveal>
        </div>
      </section>

      <SubjectAreas />

      <CtaBand
        title="Don't see your subject?"
        description="Post a requirement describing what you need and tutors who teach it can apply — or tell us about the learner and we'll suggest a shortlist."
        primary={{ href: "/post-requirement", label: "Post a requirement" }}
        secondary={{ href: "/concierge", label: "Help me find a tutor" }}
      />
    </>
  );
}
