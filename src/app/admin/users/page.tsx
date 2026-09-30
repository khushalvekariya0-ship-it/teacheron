import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { UsersView } from "@/components/admin/UsersView";

export const metadata: Metadata = { title: "Users" };

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UsersView />
    </Suspense>
  );
}
