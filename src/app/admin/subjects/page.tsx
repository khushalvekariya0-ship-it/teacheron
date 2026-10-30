import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { CatalogView } from "@/components/admin/CatalogView";
import { publicRoutePatterns, scanSeo } from "@/components/admin/seo-scan";

export const metadata: Metadata = { title: "Subjects" };

/** Admin → Subjects: main subjects and their sub-categories, as shown across the website. */
export default async function AdminSubjectsPage() {
  // Public page links are only shown for routes that exist, so read the route table per request.
  await connection();
  const publicRoutes = publicRoutePatterns(await scanSeo());
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CatalogView publicRoutes={publicRoutes} section="subjects" />
    </Suspense>
  );
}
