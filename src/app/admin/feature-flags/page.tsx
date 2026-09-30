import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { FeatureFlagsView } from "@/components/admin/FeatureFlagsView";

export const metadata: Metadata = { title: "Feature flags" };

export default function AdminFeatureFlagsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <FeatureFlagsView />
    </Suspense>
  );
}
