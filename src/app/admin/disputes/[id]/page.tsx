import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { DisputeDetailView } from "@/components/admin/DisputeDetailView";

export const metadata: Metadata = { title: "Dispute" };

export default async function AdminDisputePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DisputeDetailView id={id} />
    </Suspense>
  );
}
