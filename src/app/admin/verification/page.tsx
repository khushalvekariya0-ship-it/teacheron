import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { VerificationView } from "@/components/admin/VerificationView";

export const metadata: Metadata = { title: "Verification" };

export default function AdminVerificationPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <VerificationView />
    </Suspense>
  );
}
