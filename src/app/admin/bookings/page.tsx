import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { BookingsView } from "@/components/admin/BookingsView";

export const metadata: Metadata = { title: "Bookings" };

export default function AdminBookingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BookingsView />
    </Suspense>
  );
}
