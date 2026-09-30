import type { Metadata } from "next";
import { TutorOnboarding } from "@/components/onboarding/TutorOnboarding";

export const metadata: Metadata = {
  title: "Set up your tutor profile",
  description: "Create your TutorLink tutor profile: subjects, experience, pricing, availability and verification.",
};

export default function TutorOnboardingPage() {
  return <TutorOnboarding />;
}
