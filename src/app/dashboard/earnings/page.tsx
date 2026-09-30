import type { Metadata } from "next";
import { RoleGate } from "@/components/dashboard/Shell";
import { EarningsView } from "@/components/dashboard/tutor/EarningsView";

export const metadata: Metadata = { title: "Earnings" };

export default function TutorEarningsPage() {
  return (
    <RoleGate roles={["tutor"]}>
      <EarningsView />
    </RoleGate>
  );
}
