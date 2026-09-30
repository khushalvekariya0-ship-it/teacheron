import type { Metadata } from "next";
import { Suspense } from "react";
import { TutorDirectory } from "@/components/search/TutorDirectory";
import { DirectorySkeleton } from "@/components/search/DirectorySkeleton";
import { SITE } from "@/lib/site";
import { PageHero, Panel } from "@/components/marketing/Section";

export const metadata: Metadata = {
  title: "Find a tutor",
  description: `Search tutors by subject, grade, schedule, budget and location. Online and in-person tutoring across the U.S. on ${SITE.name}.`,
  alternates: { canonical: "/tutors" },
};

export default function TutorsPage() {
  return (
    <>
      <PageHero
        size="compact"
        eyebrow="Tutor directory"
        title="Find a tutor"
        description={<>Filter by subject, grade, schedule, budget and location. Results are ordered by how well each tutor fits your filters &mdash; never by paid placement.</>}
      />
      <Panel aria-label="Tutor results">
        <Suspense fallback={<DirectorySkeleton />}>
          <TutorDirectory />
        </Suspense>
      </Panel>
    </>
  );
}
