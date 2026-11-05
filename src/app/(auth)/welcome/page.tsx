import type { Metadata } from "next";
import { Suspense } from "react";
import { WelcomeView } from "@/components/auth/WelcomeView";

export const metadata: Metadata = {
  title: "Finish creating your account",
  robots: { index: false, follow: false },
};

export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <WelcomeView />
    </Suspense>
  );
}
