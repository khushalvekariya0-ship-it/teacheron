import type { Metadata } from "next";
import { CalendarView } from "@/components/dashboard/calendar/CalendarView";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return <CalendarView />;
}
