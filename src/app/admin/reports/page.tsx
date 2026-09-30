import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { ReportsView } from "@/components/admin/ReportsView";

export const metadata: Metadata = { title: "Reports" };

export default function AdminReportsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReportsView />
    </Suspense>
  );
}
