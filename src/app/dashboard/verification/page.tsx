import type { Metadata } from "next";
import { RoleGate } from "@/components/dashboard/Shell";
import { VerificationView } from "@/components/dashboard/tutor/VerificationView";

export const metadata: Metadata = { title: "Verification" };

export default function TutorVerificationPage() {
  return (
    <RoleGate roles={["tutor"]}>
      <VerificationView />
    </RoleGate>
  );
}
