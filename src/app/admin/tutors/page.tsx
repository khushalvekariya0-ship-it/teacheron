import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { TutorsView } from "@/components/admin/TutorsView";

export const metadata: Metadata = { title: "Tutors" };

export default function AdminTutorsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TutorsView />
    </Suspense>
  );
}
