import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { PromotionsView } from "@/components/admin/PromotionsView";

export const metadata: Metadata = { title: "Coupons & promotions" };

export default function AdminPromotionsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PromotionsView />
    </Suspense>
  );
}
