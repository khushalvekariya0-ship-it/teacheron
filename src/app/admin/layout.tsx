import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/Shell";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · TutorLink" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell area="admin">{children}</DashboardShell>;
}
