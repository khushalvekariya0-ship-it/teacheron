import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { DisputesView } from "@/components/admin/DisputesView";

export const metadata: Metadata = { title: "Disputes" };

export default function AdminDisputesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DisputesView />
    </Suspense>
  );
}
