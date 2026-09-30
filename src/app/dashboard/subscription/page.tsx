import type { Metadata } from "next";
import { RoleGate } from "@/components/dashboard/Shell";
import { SubscriptionView } from "@/components/dashboard/tutor/SubscriptionView";

export const metadata: Metadata = { title: "Subscription" };

export default function TutorSubscriptionPage() {
  return (
    <RoleGate roles={["tutor"]}>
      <SubscriptionView />
    </RoleGate>
  );
}
