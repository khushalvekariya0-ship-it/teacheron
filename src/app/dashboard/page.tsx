import type { Metadata } from "next";
import { ByRole } from "@/components/dashboard/ByRole";
import { LearnerOverview } from "@/components/dashboard/learner/LearnerOverview";
import { TutorOverview } from "@/components/dashboard/tutor/TutorOverview";

export const metadata: Metadata = { title: "Overview" };

export default function DashboardPage() {
  return <ByRole tutor={<TutorOverview />} learner={<LearnerOverview />} />;
}
