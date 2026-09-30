import type { Metadata } from "next";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ArrowLink, CtaBand, PageHero, Section } from "@/components/marketing/Section";
import { SubjectTile } from "@/components/content/SubjectTile";
import { CategoryIcon } from "@/components/content/icons";
import { subjectsInCategory, tutorsInCategory } from "@/components/content/insights";
import { SUBJECT_CATEGORIES, SUBJECTS } from "@/lib/data/catalog";

export const metadata: Metadata = {
  title: "Browse subjects",
  description: `Tutors for ${SUBJECTS.length} subjects across math, science, English, test prep, world languages, computer science, history, music and learning support — online and in person.`,
  alternates: { canonical: "/subjects" },
};

export default function SubjectsPage() {
  return (
    <>
      <PageHero
        eyebrow="Subjects"
        title="Every subject, from first words to final exams."
        description="Browse by area, then open a subject to see the tutors who teach it, their rates and whether they offer a trial."
      >
        <Reveal delay={0.4}>
          <nav aria-label="Subject areas" className="mt-10 flex flex-wrap gap-2">
            {SUBJECT_CATEGORIES.map((c) => {
              return (
                <a key={c.slug} href={`#${c.slug}`} className="inline-flex items-center gap-2 rounded-lg border-2 border-ink px-3.5 py-1.5 text-[14px] font-semibold text-ink transition-colors hover:bg-ink hover:text-on-ink">
                  <CategoryIcon slug={c.slug} className="size-3.5" /> {c.name}
                </a>
              );
            })}
          </nav>
        </Reveal>
      </PageHero>

      <Section>
        <div className="space-y-20 lg:space-y-24">
          {SUBJECT_CATEGORIES.map((c) => {
            const subjects = subjectsInCategory(c.slug);
            const tutors = tutorsInCategory(c.slug).length;
            return (
              <section key={c.slug} id={c.slug} aria-labelledby={`${c.slug}-title`} className="scroll-mt-24">
                <Reveal className="mb-6 flex flex-col gap-4 border-b-2 border-ink pb-6 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-brand-soft text-ink">
                      <CategoryIcon slug={c.slug} className="size-6" />
                    </span>
                    <div>
                      <h2 id={`${c.slug}-title`} className="font-heading text-[1.9rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-ink">
                        {c.name}
                      </h2>
                      <p className="mt-1.5 text-[15px] text-ink-2">{c.description}</p>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm tabular-nums text-muted">
                    <span className="font-semibold text-ink">{tutors}</span> {tutors === 1 ? "tutor" : "tutors"} · {subjects.length} subjects
                  </p>
                </Reveal>
                <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" stagger={0.04}>
                  {subjects.map((s) => (
                    <StaggerItem key={s.slug} className="h-full">
                      <SubjectTile subject={s} />
                    </StaggerItem>
                  ))}
                </Stagger>
              </section>
            );
          })}

          <Reveal>
            <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-yellow-soft p-6 sm:flex-row sm:items-center sm:p-8">
              <div>
                <h2 className="font-heading text-2xl font-extrabold tracking-[-0.035em] text-ink">Don&rsquo;t see your subject?</h2>
                <p className="mt-1.5 text-[15px] text-ink-2">Post a requirement describing what you need, and tutors who teach it can apply.</p>
              </div>
              <ArrowLink href="/post-requirement" className="shrink-0">
                Post a requirement
              </ArrowLink>
            </div>
          </Reveal>
        </div>
      </Section>

      <CtaBand title="Not sure where to start?" description="Describe what the learner needs and we'll show a shortlist — with the reasons each tutor matches." primary={{ href: "/concierge", label: "Help me find a tutor" }} secondary={{ href: "/tutors", label: "Search all tutors" }} />
    </>
  );
}
