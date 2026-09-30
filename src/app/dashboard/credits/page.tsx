import type { Metadata } from "next";
import { RoleGate } from "@/components/dashboard/Shell";
import { CreditsView } from "@/components/dashboard/tutor/CreditsView";

export const metadata: Metadata = { title: "Lead credits" };

export default function TutorCreditsPage() {
  return (
    <RoleGate roles={["tutor"]}>
      <CreditsView />
    </RoleGate>
  );
}
