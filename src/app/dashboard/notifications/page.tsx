import type { Metadata } from "next";
import { NotificationsView } from "@/components/dashboard/shared/NotificationsView";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return <NotificationsView />;
}
