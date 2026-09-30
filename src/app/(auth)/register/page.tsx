import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterView } from "@/components/auth/RegisterView";
import { AuthFormSkeleton } from "@/components/auth/AuthSkeleton";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Join TutorLink as a student, parent or tutor. Free to join — you only pay when you book a lesson.",
  alternates: { canonical: "/register" },
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton fields={5} />}>
      <RegisterView />
    </Suspense>
  );
}
