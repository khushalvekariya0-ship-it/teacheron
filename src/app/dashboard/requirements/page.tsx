import type { Metadata } from "next";
import { RequirementsView } from "@/components/dashboard/learner/RequirementsView";

export const metadata: Metadata = { title: "My requirements" };

export default function RequirementsPage() {
  return <RequirementsView />;
}
