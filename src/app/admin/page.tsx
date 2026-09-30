import type { Metadata } from "next";
import { OverviewView } from "@/components/admin/OverviewView";

export const metadata: Metadata = { title: "Overview" };

export default function AdminOverviewPage() {
  return <OverviewView />;
}
