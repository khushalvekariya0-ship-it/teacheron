import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { PaymentsView } from "@/components/admin/PaymentsView";

export const metadata: Metadata = { title: "Payments & payouts" };

export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PaymentsView />
    </Suspense>
  );
}
