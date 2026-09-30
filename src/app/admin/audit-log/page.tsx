import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { AuditLogView } from "@/components/admin/AuditLogView";

export const metadata: Metadata = { title: "Audit log" };

export default function AdminAuditLogPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AuditLogView />
    </Suspense>
  );
}
