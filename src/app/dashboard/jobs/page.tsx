import type { Metadata } from "next";
import { Suspense } from "react";
import { RoleGate } from "@/components/dashboard/Shell";
import { JobsSkeleton, JobsView } from "@/components/dashboard/tutor/JobsView";

export const metadata: Metadata = { title: "Student jobs" };

export default function TutorJobsPage() {
  return (
    <RoleGate roles={["tutor"]}>
      <Suspense fallback={<JobsSkeleton />}>
        <JobsView />
      </Suspense>
    </RoleGate>
  );
}
