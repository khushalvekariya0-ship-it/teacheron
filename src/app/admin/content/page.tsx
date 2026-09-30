import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { ContentView } from "@/components/admin/ContentView";
import { scanSeo } from "@/components/admin/seo-scan";

export const metadata: Metadata = { title: "Content & SEO" };

export default async function AdminContentPage() {
  // Route metadata is read from the source files at request time, never hard-coded.
  await connection();
  const scan = await scanSeo();
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ContentView scan={scan} />
    </Suspense>
  );
}
