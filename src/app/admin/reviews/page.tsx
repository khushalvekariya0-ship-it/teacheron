import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { ReviewsView } from "@/components/admin/ReviewsView";

export const metadata: Metadata = { title: "Reviews" };

export default function AdminReviewsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReviewsView />
    </Suspense>
  );
}
