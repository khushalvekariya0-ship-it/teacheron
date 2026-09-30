import type { Metadata } from "next";
import { ChildrenView } from "@/components/dashboard/learner/ChildrenView";

export const metadata: Metadata = { title: "Children" };

export default function ChildrenPage() {
  return <ChildrenView />;
}
