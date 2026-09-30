import type { Metadata } from "next";
import { MonetizationView } from "@/components/admin/MonetizationView";

export const metadata: Metadata = { title: "Plans & credits" };

export default function AdminMonetizationPage() {
  return <MonetizationView />;
}
