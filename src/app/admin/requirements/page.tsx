import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { RequirementsView } from "@/components/admin/RequirementsView";

export const metadata: Metadata = { title: "Requirements" };

export default function AdminRequirementsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RequirementsView />
    </Suspense>
  );
}
