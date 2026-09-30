import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/Shell";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Dashboard · TutorLink" },
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell area="app">{children}</DashboardShell>;
}
