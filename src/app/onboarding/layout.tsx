import type { Metadata } from "next";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";

export const metadata: Metadata = {
  title: { default: "Onboarding", template: "%s · TutorLink" },
  robots: { index: false, follow: false },
};

/** Focused layout: no site navigation, just the logo and a way to save and leave. */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <OnboardingHeader />
      <main id="main">{children}</main>
    </div>
  );
}
