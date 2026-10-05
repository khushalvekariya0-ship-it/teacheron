import type { Metadata } from "next";
import Image from "next/image";
import { BookOpen, LayoutGrid, Monitor } from "lucide-react";
import { Reveal, Stagger, StaggerItem, WordReveal } from "@/components/motion";
import { CtaBand, Section } from "@/components/marketing/Section";
import { SubjectTile } from "@/components/content/SubjectTile";
import { AreaNav } from "@/components/content/AreaNav";
import { CategoryIcon } from "@/components/content/icons";
import { subjectsInCategory, tutorsInCategory } from "@/components/content/insights";
import { SubjectSearch } from "@/components/home/SubjectSearch";
import { SUBJECT_CATEGORIES, SUBJECTS } from "@/lib/data/catalog";

export const metadata: Metadata = {
  title: "Browse subjects",
  description: `Tutors for ${SUBJECTS.length} subjects across math, science, English, test prep, world languages, computer science, history, music and learning support — online and in person.`,
  alternates: { canonical: "/subjects" },
};

/** Areas that have a photo; the others get a gradient panel with their icon. */
const AREA_PHOTOS = new Set(["math", "science", "english", "test-prep", "languages", "computer-science", "arts", "learning-support"]);

const MOSAIC = ["math", "science", "test-prep", "languages"];

const FACTS = [
  { icon: BookOpen, label: `${SUBJECTS.length} subjects` },
  { icon: LayoutGrid, label: `${SUBJECT_CATEGORIES.length} areas` },
  { icon: Monitor, label: "Online & in person" },
];

export default function SubjectsPage() {
  return (
    <>
      <section className="relative isolate border-b border-line bg-page">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-line-grid [mask-image:radial-gradient(ellipse_80%_70%_at_50%_0%,black_20%,transparent_75%)]" aria-hidden />
        <div className="container-page grid grid-cols-1 items-center gap-12 pb-14 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:pb-20 lg:pt-20">
          <div>
            <Reveal>
              <p className="kicker">
                <span className="size-1.5 rounded-full bg-brand" aria-hidden />
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
              <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[14.5px] font-medium text-ink-2" aria-label="At a glance">
                {FACTS.map((f) => (
                  <li key={f.label} className="inline-flex items-center gap-2">
                    <f.icon className="size-4 text-brand" aria-hidden /> {f.label}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* Mosaic of the most popular areas — each jumps to its section */}
          <Reveal delay={0.2} className="hidden sm:block">
            <ul className="grid grid-cols-2 gap-3" aria-label="Popular areas">
              {MOSAIC.map((slug, i) => {
                const c = SUBJECT_CATEGORIES.find((x) => x.slug === slug)!;
                return (
                  <li key={slug} className={i % 2 ? "translate-y-6" : ""}>
                    <a href={`#${slug}`} className="group relative block aspect-[4/3.4] overflow-hidden rounded-2xl border border-line bg-canvas shadow-[0_18px_40px_-28px_rgb(15_23_42/0.5)]">
                      <Image src={`/images/subjects/${slug}.jpg`} alt="" fill preload={i < 2} sizes="(min-width: 1024px) 280px, 45vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night/80 to-transparent p-4 pt-12">
                        <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-white">
                          <CategoryIcon slug={slug} className="size-4" /> {c.name}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] text-white/75">{subjectsInCategory(slug).length} subjects</span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </Reveal>
        </div>
      </section>

      <AreaNav areas={SUBJECT_CATEGORIES.map((c) => ({ slug: c.slug, name: c.name }))} />

      <Section>
        <div className="space-y-16 lg:space-y-20">
          {SUBJECT_CATEGORIES.map((c, i) => {
            const subjects = subjectsInCategory(c.slug);
            const tutors = tutorsInCategory(c.slug).length;
            return (
              <section key={c.slug} id={c.slug} aria-labelledby={`${c.slug}-title`} className="grid scroll-mt-40 gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-10">
                {/* Area card */}
                <Reveal className="self-start lg:sticky lg:top-40">
                  <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                    <div className="relative aspect-[16/9] bg-canvas">
                      {AREA_PHOTOS.has(c.slug) ? (
                        <Image src={`/images/subjects/${c.slug}.jpg`} alt="" fill sizes="(min-width: 1024px) 340px, 100vw" className="object-cover" />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(140deg,var(--color-grad-from),var(--color-grad-to))]">
                          <CategoryIcon slug={c.slug} className="size-14 text-white/90" />
                        </div>
                      )}
                      <span className="absolute left-3 top-3 rounded-md bg-white/95 px-2 py-1 font-heading text-[12px] font-bold tabular-nums text-ink shadow-sm">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="p-6">
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white">
                          <CategoryIcon slug={c.slug} className="size-5" />
                        </span>
                        <h2 id={`${c.slug}-title`} className="font-heading text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink">
                          {c.name}
                        </h2>
                      </div>
                      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{c.description}</p>
                      <p className="mt-4 border-t border-line pt-4 text-[13.5px] tabular-nums text-muted">
                        <span className="font-semibold text-ink">{subjects.length}</span> subjects
                        {tutors > 0 && (
                          <>
                            {" · "}
                            <span className="font-semibold text-ink">{tutors}</span> {tutors === 1 ? "tutor" : "tutors"}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </Reveal>

                {/* Subjects in this area */}
                <Stagger className="grid content-start gap-3 sm:grid-cols-2" stagger={0.04}>
                  {subjects.map((s) => (
                    <StaggerItem key={s.slug} className="h-full">
                      <SubjectTile subject={s} />
                    </StaggerItem>
                  ))}
                </Stagger>
              </section>
            );
          })}
        </div>
      </Section>

      <CtaBand
        title="Don't see your subject?"
        description="Post a requirement describing what you need and tutors who teach it can apply — or tell us about the learner and we'll suggest a shortlist."
        primary={{ href: "/post-requirement", label: "Post a requirement" }}
        secondary={{ href: "/concierge", label: "Help me find a tutor" }}
      />
    </>
  );
}
