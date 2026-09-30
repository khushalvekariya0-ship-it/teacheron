import type { Metadata } from "next";
import { RoleGate } from "@/components/dashboard/Shell";
import { AvailabilityView } from "@/components/dashboard/tutor/AvailabilityView";

export const metadata: Metadata = { title: "Availability" };

export default function TutorAvailabilityPage() {
  return (
    <RoleGate roles={["tutor"]}>
      <AvailabilityView />
    </RoleGate>
  );
}
