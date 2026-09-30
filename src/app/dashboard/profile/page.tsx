import type { Metadata } from "next";
import { RoleGate } from "@/components/dashboard/Shell";
import { ProfileView } from "@/components/dashboard/tutor/ProfileView";

export const metadata: Metadata = { title: "My profile" };

export default function TutorProfilePage() {
  return (
    <RoleGate roles={["tutor"]}>
      <ProfileView />
    </RoleGate>
  );
}
