import type { Metadata } from "next";
import { ByRole } from "@/components/dashboard/ByRole";
import { LearnerHomework } from "@/components/dashboard/learner/LearnerHomework";
import { TutorHomework } from "@/components/dashboard/tutor/TutorHomework";

export const metadata: Metadata = { title: "Homework" };

export default function HomeworkPage() {
  return <ByRole tutor={<TutorHomework />} learner={<LearnerHomework />} />;
}
