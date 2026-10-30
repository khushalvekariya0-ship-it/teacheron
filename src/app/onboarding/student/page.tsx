import type { Metadata } from "next";
import { Suspense } from "react";
import { StudentOnboarding } from "@/components/student/StudentOnboarding";

export const metadata: Metadata = {
  title: "Set up your learning profile",
  description: "Tell TutorLink about you, what you want to learn, the tutor you'd like, when you're free and your budget.",
};

export default function StudentOnboardingPage() {
  return (
    <Suspense fallback={null}>
      <StudentOnboarding />
    </Suspense>
  );
}
