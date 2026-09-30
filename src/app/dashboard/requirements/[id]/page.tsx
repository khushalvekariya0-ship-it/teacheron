import type { Metadata } from "next";
import { RequirementDetailView } from "@/components/dashboard/learner/RequirementDetailView";

export const metadata: Metadata = { title: "Requirement" };

export default async function RequirementDetailPage(props: PageProps<"/dashboard/requirements/[id]">) {
  const { id } = await props.params;
  return <RequirementDetailView id={id} />;
}
