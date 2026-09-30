import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagesSkeleton } from "@/components/dashboard/messages/MessagesSkeleton";
import { MessagesView } from "@/components/dashboard/messages/MessagesView";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <Suspense fallback={<MessagesSkeleton />}>
      <MessagesView />
    </Suspense>
  );
}
