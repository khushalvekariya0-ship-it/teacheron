import type { Metadata } from "next";
import { RoleGate } from "@/components/dashboard/Shell";
import { ApplicationsView } from "@/components/dashboard/tutor/ApplicationsView";

export const metadata: Metadata = { title: "My applications" };

export default function TutorApplicationsPage() {
  return (
    <RoleGate roles={["tutor"]}>
      <ApplicationsView />
    </RoleGate>
  );
}
