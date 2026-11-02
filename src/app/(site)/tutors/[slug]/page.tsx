import type { Metadata } from "next";
import { Panel } from "@/components/marketing/Section";
import { setLiveCatalog, subjectName } from "@/lib/data/catalog";
import { listedTutors, publicCatalog, tutorBySlug } from "@/server/public";
import { truncate } from "@/lib/utils";
import { SITE } from "@/lib/site";
import { TutorProfileView } from "@/components/tutor-profile/TutorProfileView";

/** Profiles come from the database and are refreshed at most once a minute; new tutors render on demand. */
export const revalidate = 60;

export async function generateStaticParams() {
  return (await listedTutors()).map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(props: PageProps<"/tutors/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const tutor = await tutorBySlug(slug);
  // Unknown, unlisted or suspended tutors stay out of search indexes.
  if (!tutor) return { title: "Tutor profile", alternates: { canonical: `/tutors/${slug}` }, robots: { index: false } };
  const title = `${tutor.firstName} ${tutor.lastName} — ${tutor.headline}`;
  const description = truncate(tutor.bio.replace(/\s+/g, " "), 158);
  return {
    title,
    description,
    alternates: { canonical: `/tutors/${tutor.slug}` },
    openGraph: { type: "profile", title, description, url: `/tutors/${tutor.slug}` },
  };
}

export default async function TutorProfilePage(props: PageProps<"/tutors/[slug]">) {
  const { slug } = await props.params;
  const tutor = await tutorBySlug(slug);
  setLiveCatalog(await publicCatalog());
  const jsonLd = tutor
    ? {
        "@context": "https://schema.org",
        "@type": "Person",
        name: `${tutor.firstName} ${tutor.lastName}`,
        jobTitle: tutor.headline,
        description: truncate(tutor.bio, 300),
        url: `${SITE.url}/tutors/${tutor.slug}`,
        knowsAbout: tutor.subjects.map(subjectName),
        knowsLanguage: tutor.languages,
        address: { "@type": "PostalAddress", addressLocality: tutor.city, addressRegion: tutor.state },
      }
    : null;

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <Panel as="div">
        <TutorProfileView slug={slug} />
      </Panel>
    </>
  );
}
