import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareSkeleton, CompareView } from "@/components/search/CompareView";
import { PageHero, Panel } from "@/components/marketing/Section";

export const metadata: Metadata = {
  title: "Compare tutors",
  description: "See up to three tutors side by side: subjects, experience, credentials, availability, rates and verification.",
  alternates: { canonical: "/compare" },
  robots: { index: false, follow: true },
};

export default function ComparePage() {
  return (
    <>
      <PageHero
        size="compact"
        eyebrow="Compare"
        title="Compare tutors side by side"
        description={<>Subjects, experience, credentials, availability and price for up to three tutors &mdash; only facts from their profiles.</>}
      />
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
