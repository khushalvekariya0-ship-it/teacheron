import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { ChatSafetyView } from "@/components/admin/ChatSafetyView";

export const metadata: Metadata = { title: "Chat safety" };

export default function AdminChatSafetyPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ChatSafetyView />
    </Suspense>
  );
}
