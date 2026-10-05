"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Booking, Tutor } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useSession, useViewerTimezone } from "@/lib/store/hooks";
import { Sheet, SheetContent } from "@/components/ui/Overlay";
import { toast } from "@/components/ui/Toast";
import { useIsDesktop } from "./useMediaQuery";
import { SuccessStep } from "./BookingSteps";

/** Confirmation after a one-tap booking: the same "you're booked" screen the checkout ends on. */
export function BookingSuccessSheet({ tutor, booking, onClose }: { tutor: Tutor; booking: Booking | null; onClose: () => void }) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const me = useSession();
  const tz = useViewerTimezone();
  const children = useApp((s) => s.children);
  const policy = useApp((s) => s.policy);
  const startConversation = useApp((s) => s.startConversation);
  const [messaging, setMessaging] = React.useState(false);

  const child = booking?.childId ? children.find((c) => c.id === booking.childId) : undefined;
  const learnerName = child?.firstName ?? (me ? `You (${me.firstName})` : "—");

  const message = () => {
    if (!booking) return;
    setMessaging(true);
    const r = startConversation(tutor.id, { childId: booking.childId, subject: booking.subject });
    if (!r.ok) {
      setMessaging(false);
      toast.error(r.error);
      return;
    }
    onClose();
    router.push(`/dashboard/messages?c=${r.data.id}`);
  };

  return (
    <Sheet open={!!booking} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        title={booking?.status === "confirmed" ? "You're booked" : "Request sent"}
        description={`${tutor.firstName} ${tutor.lastName}`}
        className={isDesktop ? "w-[min(100vw,32rem)]" : "max-h-[92dvh]"}
        data-lenis-prevent
      >
        {booking && (
          <div className="px-5 py-5 sm:px-6">
            <SuccessStep tutor={tutor} booking={booking} tz={tz} learnerName={learnerName} meetingLinkMinutes={policy.meetingLinkVisibleMinutesBefore} onMessage={message} messaging={messaging} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
