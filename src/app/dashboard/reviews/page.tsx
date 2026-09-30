import type { Metadata } from "next";
import { ByRole } from "@/components/dashboard/ByRole";
import { LearnerReviews } from "@/components/dashboard/learner/LearnerReviews";
import { TutorReviews } from "@/components/dashboard/tutor/TutorReviews";

export const metadata: Metadata = { title: "Reviews" };

export default function ReviewsPage() {
  return <ByRole tutor={<TutorReviews />} learner={<LearnerReviews />} />;
}
