"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/store/hooks";
import { toast } from "@/components/ui/Toast";
import type { Tutor } from "@/lib/types";

/**
 * Save / compare / contact behaviour shared by every tutor surface.
 * Signed-out visitors are sent to sign in and brought back afterwards.
 */
export function useTutorActions(tutor: Pick<Tutor, "id" | "firstName" | "slug">) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useSession();
  const favorites = useApp((s) => (me ? s.favorites[me.id] : undefined));
  const compare = useApp((s) => s.compare);
  const toggleFavorite = useApp((s) => s.toggleFavorite);
  const toggleCompare = useApp((s) => s.toggleCompare);
  const startConversation = useApp((s) => s.startConversation);

  const requireLearner = React.useCallback(
    (action: string) => {
      if (!me) {
        toast("Sign in to continue", { description: `Create a free account or sign in to ${action}.` });
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return false;
      }
      if (me.role !== "student" && me.role !== "parent") {
        toast.error(`Only student and parent accounts can ${action}.`);
        return false;
      }
      return true;
    },
    [me, router, pathname],
  );

  return {
    saved: !!favorites?.includes(tutor.id),
    comparing: compare.includes(tutor.id),
    compareFull: compare.length >= 3 && !compare.includes(tutor.id),
    toggleSave() {
      if (!requireLearner("save tutors")) return;
      const r = toggleFavorite(tutor.id);
      if (!r.ok) toast.error(r.error);
      else toast.success(r.data ? `${tutor.firstName} saved to favorites` : `Removed ${tutor.firstName} from favorites`);
    },
    toggleCompare() {
      const r = toggleCompare(tutor.id);
      if (!r.ok) toast.error(r.error);
    },
    contact() {
      if (!requireLearner("message tutors")) return;
      const r = startConversation(tutor.id);
      if (!r.ok) toast.error(r.error);
      else router.push(`/dashboard/messages?c=${r.data.id}`);
    },
    bookTrial() {
      router.push(`/tutors/${tutor.slug}?book=trial#book`);
    },
    book() {
      router.push(`/tutors/${tutor.slug}?book=regular#book`);
    },
  };
}
