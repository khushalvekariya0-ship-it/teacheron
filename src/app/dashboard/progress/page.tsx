import type { Metadata } from "next";
import { ByRole } from "@/components/dashboard/ByRole";
import { LearnerProgress } from "@/components/dashboard/learner/LearnerProgress";
import { TutorProgress } from "@/components/dashboard/tutor/TutorProgress";

export const metadata: Metadata = { title: "Learning progress" };

export default function ProgressPage() {
  return <ByRole tutor={<TutorProgress />} learner={<LearnerProgress />} />;
}
