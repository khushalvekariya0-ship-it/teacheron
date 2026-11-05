import type { Metadata } from "next";
import { ClassroomView } from "@/components/classroom/ClassroomView";

export const metadata: Metadata = { title: "Classroom", robots: { index: false } };

export default async function ClassroomPage({ params, searchParams }: PageProps<"/classroom/[id]">) {
  const { id } = await params;
  const { g } = await searchParams;
  // ?g= is the tutor's guest link (someone without an account waits until the tutor admits them).
  const guestCode = typeof g === "string" && /^[a-f0-9]{10}$/.test(g) ? g : undefined;
  return <ClassroomView id={id} guestCode={guestCode} />;
}
