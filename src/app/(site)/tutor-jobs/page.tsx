import type { Metadata } from "next";
import { Suspense } from "react";
import { JobsBoard } from "@/components/jobs/JobsBoard";
import { JobCardSkeleton } from "@/components/jobs/JobCard";
import { PageHero, Panel } from "@/components/marketing/Section";

export const metadata: Metadata = {
  title: "Tutor jobs",
  description: "Browse tutoring requirements posted by parents and students across the US. Filter by subject, grade, format, location and budget, then apply with a short note.",
  alternates: { canonical: "/tutor-jobs" },
};

function BoardFallback() {
  return (
    <div className="container-page pb-24 pt-8 sm:pt-10">
      <div className="lg:grid lg:grid-cols-[272px_minmax(0,1fr)] lg:gap-10 xl:gap-12">
        <div className="hidden lg:block">
          <div className="skeleton h-[520px] rounded-2xl" />
        </div>
        <div className="space-y-4" role="status" aria-label="Loading jobs">
          <div className="skeleton h-10 rounded-md" />
          {Array.from({ length: 3 }).map((_, i) => (
            <JobCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TutorJobsPage() {
  return (
    <>
      <PageHero
        size="compact"
        eyebrow="Tutor jobs"
        title="Families looking for a tutor"
        description="Requirements posted by parents and students, with goals, schedule and budget up front. Apply with a short note — phone numbers and emails in messages are hidden automatically."
      />
      <Panel aria-label="Open requirements">
        <Suspense fallback={<BoardFallback />}>
          <JobsBoard />
        </Suspense>
      </Panel>
    </>
  );
}
