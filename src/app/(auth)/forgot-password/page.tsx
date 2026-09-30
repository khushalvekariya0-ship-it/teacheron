import type { Metadata } from "next";
import { ForgotPasswordView } from "@/components/auth/ForgotPasswordView";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Get a link to reset your TutorLink password.",
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordView />;
}
