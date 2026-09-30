import type { Metadata } from "next";
import { LessonView } from "@/components/dashboard/bookings/LessonView";

export const metadata: Metadata = { title: "Lesson" };

export default async function LessonPage({ params }: PageProps<"/dashboard/bookings/[id]">) {
  const { id } = await params;
  return <LessonView id={id} />;
}
