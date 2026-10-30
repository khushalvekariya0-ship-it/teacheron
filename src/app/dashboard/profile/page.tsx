import type { Metadata } from "next";
import { RoleGate } from "@/components/dashboard/Shell";
import { ByRole } from "@/components/dashboard/ByRole";
import { ProfileView } from "@/components/dashboard/tutor/ProfileView";
import { StudentProfileView } from "@/components/student/StudentProfileView";

export const metadata: Metadata = { title: "My profile" };

/** Tutors edit their public profile; students edit their private learning profile. */
export default function ProfilePage() {
  return (
    <RoleGate roles={["tutor", "student"]}>
      <ByRole tutor={<ProfileView />} learner={<StudentProfileView />} />
    </RoleGate>
  );
}
