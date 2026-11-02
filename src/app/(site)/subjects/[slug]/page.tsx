import type { Metadata } from "next";
import { SubjectPageView } from "@/components/content/SubjectPageView";
import { tutorsForSubject } from "@/components/content/insights";
import { DEFAULT_SUBJECTS } from "@/lib/data/catalog";
import { SITE } from "@/lib/site";
import { listedTutors, publicCatalog } from "@/server/public";

/** Figures and content come from the database; the page is rebuilt at most once a minute. */
export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

/*
 * Built-in subjects are prerendered; subjects added in Admin → Subjects render on demand
 * (dynamicParams stays at its default, true). Names and tutor counts come from the database.
 */
export function generateStaticParams() {
  return DEFAULT_SUBJECTS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const subject = (await publicCatalog()).bySlug[slug];
  if (!subject) return { title: "Subject", robots: { index: false, follow: true } };
  const count = tutorsForSubject(slug, await listedTutors()).length;
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
  const catalog = await publicCatalog();
  const subject = catalog.bySlug[slug];
  const jsonLd = subject && {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Subjects", item: `${SITE.url}/subjects` },
      { "@type": "ListItem", position: 2, name: catalog.categoryBySlug[subject.category]?.name ?? subject.category, item: `${SITE.url}/subjects#${subject.category}` },
      { "@type": "ListItem", position: 3, name: subject.name, item: `${SITE.url}/subjects/${slug}` },
    ],
  };

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <SubjectPageView slug={slug} />
    </>
  );
}
