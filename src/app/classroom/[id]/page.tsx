import type { Metadata } from "next";
import { ClassroomView } from "@/components/classroom/ClassroomView";

export const metadata: Metadata = { title: "Classroom", robots: { index: false } };

export default async function ClassroomPage({ params }: PageProps<"/classroom/[id]">) {
  const { id } = await params;
  return <ClassroomView id={id} />;
}
