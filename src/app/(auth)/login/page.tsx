import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginView } from "@/components/auth/LoginView";
import { AuthFormSkeleton } from "@/components/auth/AuthSkeleton";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to TutorLink to manage lessons, messages and learning progress.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <LoginView />
    </Suspense>
  );
}
