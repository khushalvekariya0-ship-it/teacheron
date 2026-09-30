"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquareOff, MessagesSquare, ShieldCheck } from "lucide-react";
import { useNow, useSession, useViewerTimezone } from "@/lib/store/hooks";
import { cn } from "@/lib/utils";
import { AnimatePresence, EASE, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { ConversationList } from "./ConversationList";
import { Thread } from "./Thread";
import { useMyConversations } from "./shared";

/** Full-height frame: edge-to-edge on phones, a bordered two-pane panel from md up. */
export const FRAME = "-mx-4 -my-6 h-[calc(100dvh-4rem)] sm:-mx-6 md:mx-0 md:my-0 md:h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-8rem)]";
export const PANEL = "grid h-full overflow-hidden bg-surface md:grid-cols-[300px_minmax(0,1fr)] md:rounded-2xl md:border md:border-line xl:grid-cols-[340px_minmax(0,1fr)]";

export function MessagesView() {
  const me = useSession();
  const params = useSearchParams();
  const selectedId = params.get("c");
  const items = useMyConversations();
  const now = useNow(30_000);
  const tz = useViewerTimezone();
  const pushed = React.useRef(false);

  const select = (id: string) => {
    if (id === selectedId) return;
    // Native history integrates with Next's router, so useSearchParams updates without a server round trip.
    window.history.pushState(null, "", `${window.location.pathname}?c=${encodeURIComponent(id)}`);
    pushed.current = true;
  };
  const back = () => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else window.history.replaceState(null, "", window.location.pathname);
  };

  if (!me) return null;
  const selected = selectedId ? items.find((v) => v.c.id === selectedId) : undefined;
  const threadOpen = !!selectedId;

  return (
    <div className={FRAME}>
      <div className={PANEL}>
        <div className={cn("min-h-0 md:border-r md:border-line", threadOpen && "hidden md:block")}>
          <ConversationList items={items} selectedId={selectedId} onSelect={select} now={now} tz={tz} isTutor={me.role === "tutor"} />
        </div>
        <div className={cn("min-h-0", !threadOpen && "hidden md:block")}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={selected?.c.id ?? selectedId ?? "none"} className="h-full" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: EASE }}>
              {selected ? (
                <Thread view={selected} now={now} tz={tz} onBack={back} />
              ) : selectedId ? (
                <div className="grid h-full place-items-center">
                  <EmptyState
                    icon={<MessageSquareOff />}
                    title="Conversation not found"
                    description="It may have been removed, or it belongs to a different account."
                    action={<Button variant="secondary" onClick={back}>Back to messages</Button>}
                  />
                </div>
              ) : (
                <div className="grid h-full place-items-center bg-surface">
                  <EmptyState
                    icon={<MessagesSquare />}
                    title={items.length ? "Select a conversation" : "Your messages will appear here"}
                    description={
                      <span className="inline-flex flex-col items-center gap-3">
                        <span>{items.length ? "Choose a conversation to read and reply." : "Conversations with tutors and families live here, next to your bookings."}</span>
                        <span className="inline-flex items-center gap-1.5 text-[12.5px]">
                          <ShieldCheck className="size-3.5 text-ink" aria-hidden /> Contact details stay private until you&apos;re ready.
                        </span>
                      </span>
                    }
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
