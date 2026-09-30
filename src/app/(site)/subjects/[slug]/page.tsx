import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Compass, FileText, Search, Users } from "lucide-react";
import { Reveal, Stagger, StaggerItem, WordReveal } from "@/components/motion";
import { ArrowLink, CtaBand, Section, SectionHeading } from "@/components/marketing/Section";
import { SubjectTile } from "@/components/content/SubjectTile";
import { CategoryIcon } from "@/components/content/icons";
import { categoryName, neutralOrder, rateRange, subjectsInCategory, tutorsForSubject } from "@/components/content/insights";
import { TutorCard } from "@/components/domain/TutorCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { LEVELS, SUBJECTS, SUBJECT_BY_SLUG } from "@/lib/data/catalog";
import { formatCents } from "@/lib/format";
import { SITE } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

const SHOW = 8;

export function generateStaticParams() {
  return SUBJECTS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const subject = SUBJECT_BY_SLUG[slug];
  if (!subject) return { title: "Subject not found", robots: { index: false } };
  const count = tutorsForSubject(slug).length;
  return {
    title: `${subject.name} tutors`,
    description:
      count > 0
        ? `Compare ${count} ${subject.name} ${count === 1 ? "tutor" : "tutors"} for online and in-person lessons. ${subject.summary} See rates, trials and verified credentials.`
        : `${subject.name} tutoring on ${SITE.name}: ${subject.summary} Post a requirement and tutors who teach it can apply.`,
    alternates: { canonical: `/subjects/${slug}` },
    // Thin-content guard: subjects nobody teaches yet stay out of search indexes.
    robots: count === 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function SubjectPage({ params }: Props) {
  const { slug } = await params;
  const subject = SUBJECT_BY_SLUG[slug];
  if (!subject) notFound();

  const tutors = neutralOrder(tutorsForSubject(slug));
  const range = rateRange(tutors);
  const freeTrials = tutors.filter((t) => t.trial.enabled && t.trial.priceCents === 0).length;
  const online = tutors.filter((t) => t.modes.includes("online")).length;
  const inPerson = tutors.filter((t) => t.modes.includes("in_person")).length;
  const levels = LEVELS.filter((l) => tutors.some((t) => t.levels.includes(l.value)));
  const related = subjectsInCategory(subject.category).filter((s) => s.slug !== slug);
  const searchHref = `/tutors?subject=${slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Subjects", item: `${SITE.url}/subjects` },
      { "@type": "ListItem", position: 2, name: categoryName(subject.category), item: `${SITE.url}/subjects#${subject.category}` },
      { "@type": "ListItem", position: 3, name: subject.name, item: `${SITE.url}/subjects/${slug}` },
    ],
  };

  const stats = [
    { k: "Tutors", v: String(tutors.length) },
    { k: "Hourly rates", v: range ? (range.min === range.max ? formatCents(range.min) : `${formatCents(range.min)}–${formatCents(range.max)}`) : "—" },
    { k: "Free trials", v: String(freeTrials) },
    { k: "Online · In person", v: `${online} · ${inPerson}` },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="bg-brand-soft">
        <div className="container-page pb-16 pt-10 sm:pb-20 sm:pt-12 lg:pb-24 lg:pt-14">
          <Reveal>
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-2 text-[13.5px] text-ink/70">
                <li><Link href="/subjects" className="underline-offset-4 hover:text-ink hover:underline">Subjects</Link></li>
                <li aria-hidden>/</li>
                <li><Link href={`/subjects#${subject.category}`} className="underline-offset-4 hover:text-ink hover:underline">{categoryName(subject.category)}</Link></li>
                <li aria-hidden>/</li>
                <li aria-current="page" className="font-semibold text-ink">{subject.name}</li>
              </ol>
            </nav>
          </Reveal>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end lg:gap-14">
            <div>
              <Reveal>
                <span className="grid size-12 place-items-center rounded-xl bg-surface text-ink">
                  <CategoryIcon slug={subject.category} className="size-6" />
                </span>
              </Reveal>
              <WordReveal
                text={`${subject.name} tutors`}
                className="mt-6 font-heading text-[2.75rem] font-extrabold leading-[0.98] tracking-[-0.04em] text-ink sm:text-6xl lg:text-[4.4rem]"
              />
              <Reveal delay={0.2}>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/80 sm:text-xl">{subject.summary}</p>
              </Reveal>
              <Reveal delay={0.3} className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href={searchHref}>
                    <Search /> Search {subject.name} tutors
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/concierge">
                    <Compass /> Help me find a tutor
                  </Link>
                </Button>
              </Reveal>
            </div>
            <Reveal delay={0.25}>
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line">
                {stats.map((s) => (
                  <div key={s.k} className="bg-surface p-5 sm:p-6">
                    <dt className="text-[13px] text-muted">{s.k}</dt>
                    <dd className="mt-1.5 font-heading text-2xl font-extrabold tracking-[-0.03em] tabular-nums text-ink">{s.v}</dd>
                  </div>
                ))}
              </dl>
              {levels.length > 0 && (
                <p className="mt-3 text-[13.5px] text-ink/70">
                  Levels taught: <span className="font-medium text-ink">{levels.map((l) => l.short).join(", ")}</span>
                </p>
              )}
            </Reveal>
          </div>
        </div>
      </section>

      <Section>
        {tutors.length > 0 ? (
          <>
            <SectionHeading
              eyebrow={`${tutors.length} ${tutors.length === 1 ? "tutor" : "tutors"}`}
              title={`Tutors who teach ${subject.name}`}
              description="Ordered by lessons completed. Featured placement and plans don't affect this order."
              action={
                tutors.length > SHOW ? <ArrowLink href={searchHref}>See all {tutors.length} in search</ArrowLink> : undefined
              }
            />
            <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.07}>
              {tutors.slice(0, SHOW).map((t) => (
                <StaggerItem key={t.id} className="h-full">
                  <TutorCard tutor={t} />
                </StaggerItem>
              ))}
            </Stagger>
            <Reveal className="mt-10 flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link href={searchHref}>
                  Filter {subject.name} tutors by grade, schedule and budget <ArrowRight />
                </Link>
              </Button>
            </Reveal>
          </>
        ) : (
          <div data-spotlight className="rounded-2xl border border-line bg-canvas">
            <EmptyState
              icon={<Users />}
              title={`No ${subject.name} tutors listed yet`}
              description="Post a requirement and tutors who teach this subject can apply — or describe what you need and we'll suggest tutors in related subjects."
              action={
                <>
                  <Button asChild>
                    <Link href="/post-requirement">
                      <FileText /> Post a requirement
                    </Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/concierge">Help me find a tutor</Link>
                  </Button>
                </>
              }
            />
          </div>
        )}
      </Section>

      {related.length > 0 && (
        <Section tone="canvas">
          <SectionHeading
            eyebrow={categoryName(subject.category)}
            title="Related subjects"
            action={<ArrowLink href={`/subjects#${subject.category}`}>All {categoryName(subject.category)}</ArrowLink>}
          />
          <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" stagger={0.05}>
            {related.map((s) => (
              <StaggerItem key={s.slug} className="h-full">
                <SubjectTile subject={s} />
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}

      <CtaBand
        title={`Find your ${subject.name} tutor.`}
        description="Describe the learner, the goal and your schedule. We'll show a shortlist and explain why each tutor matches."
        primary={{ href: "/concierge", label: "Help me find a tutor" }}
        secondary={{ href: searchHref, label: `Search ${subject.name} tutors` }}
      />
    </>
  );
}
