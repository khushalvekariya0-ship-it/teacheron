import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/Shell";
import { AdminTheme } from "@/components/admin/AdminTheme";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · TutorLink" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminTheme />
      <DashboardShell area="admin">{children}</DashboardShell>
    </>
  );
}
