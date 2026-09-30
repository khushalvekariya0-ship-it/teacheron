"use client";

import * as React from "react";
import type { Conversation, Message, Tutor, User } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useSession, useTutors } from "@/lib/store/hooks";
import { subjectName } from "@/lib/data/catalog";
import { formatDate } from "@/lib/format";

export interface ConversationView {
  c: Conversation;
  /** Sender id the viewer writes with (tutors write as their tutor id). */
  selfId: string;
  counterpart: string;
  counterpartFull: string;
  tone?: number;
  tutor?: Tutor;
  user?: User;
  childName?: string;
  subjectLabel?: string;
  messages: Message[];
  last?: Message;
  unread: number;
  /** The other side is a sample tutor with no live account — replies are simulated. */
  automated: boolean;
  isTutorView: boolean;
}

const short = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName.charAt(0)}.`;

/** Conversations the current user takes part in, newest activity first. */
export function useMyConversations(): ConversationView[] {
  const me = useSession();
  const conversations = useApp((s) => s.conversations);
  const messages = useApp((s) => s.messages);
  const users = useApp((s) => s.users);
  const children = useApp((s) => s.children);
  const tutors = useTutors();

  return React.useMemo(() => {
    if (!me) return [];
    const isTutor = me.role === "tutor";
    const mine = conversations.filter((c) => (isTutor ? !!me.tutorId && c.tutorId === me.tutorId : c.userId === me.id));
    const byConv = new Map<string, Message[]>();
    for (const m of messages) byConv.set(m.conversationId, [...(byConv.get(m.conversationId) ?? []), m]);
    const tutorById = new Map(tutors.map((t) => [t.id, t]));
    const userById = new Map(users.map((u) => [u.id, u]));
    const liveTutorIds = new Set(users.map((u) => u.tutorId).filter(Boolean));
    const selfId = isTutor ? me.tutorId! : me.id;

    return mine
      .map((c): ConversationView => {
        const list = (byConv.get(c.id) ?? []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const tutor = tutorById.get(c.tutorId);
        const user = userById.get(c.userId);
        const child = c.childId ? children.find((x) => x.id === c.childId) : undefined;
        const counterpartEntity = isTutor ? user : tutor;
        return {
          c,
          selfId,
          counterpart: counterpartEntity ? short(counterpartEntity) : isTutor ? "Student" : "Tutor",
          counterpartFull: counterpartEntity ? `${counterpartEntity.firstName} ${counterpartEntity.lastName}` : isTutor ? "Student" : "Tutor",
          tone: isTutor ? undefined : tutor?.tone,
          tutor,
          user,
          childName: c.childId ? child?.firstName ?? "Student" : undefined,
          subjectLabel: c.subject ? subjectName(c.subject) : undefined,
          messages: list,
          last: list[list.length - 1],
          unread: list.filter((m) => m.senderId !== selfId && !m.readAt).length,
          automated: !isTutor && !liveTutorIds.has(c.tutorId),
          isTutorView: isTutor,
        };
      })
      .sort((a, b) => b.c.lastMessageAt.localeCompare(a.c.lastMessageAt));
  }, [me, conversations, messages, users, children, tutors]);
}

export function shortAgo(iso: string, now: number, tz: string): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = 60_000;
  if (diff < min) return "now";
  if (diff < 60 * min) return `${Math.floor(diff / min)}m`;
  if (diff < 24 * 60 * min) return `${Math.floor(diff / (60 * min))}h`;
  if (diff < 7 * 24 * 60 * min) return `${Math.floor(diff / (24 * 60 * min))}d`;
  return formatDate(iso, tz, { month: "short", day: "numeric" });
}

export function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

/**
 * Short, context-aware automated reply for sample tutors (no live account in the preview).
 * Replies never promise specific availability, prices or outcomes — they point to real product flows.
 */
export function automatedReply(text: string, ctx: { subject?: string; hasAttachment: boolean; learnerFirstName: string }): string {
  const t = text.toLowerCase();
  const subject = ctx.subject ? ctx.subject.toLowerCase() : "our";
  const hi = `Thanks, ${ctx.learnerFirstName}!`;
  if (/\b(trial|first lesson|try out)\b/.test(t)) return `${hi} If you'd like a trial, pick any open time on my profile and I'll confirm it as soon as I can.`;
  if (/reschedul|move (the|our)|another time|different time|change the time/.test(t)) return "No problem — you can pick a new time from the lesson page under Reschedule, and I'll confirm it.";
  if (/\bcancel/.test(t)) return "Thanks for letting me know. You can cancel from the lesson page — the refund follows the policy shown there.";
  if (/\b(price|rate|cost|charge|discount)\b|\$/.test(t)) return "My rate and trial options are listed on my profile, and you'll see the full total before you confirm a booking.";
  if (/homework|worksheet|problem set|practice|assignment/.test(t)) return `${hi} Bring your attempt to our next ${subject === "our" ? "" : `${subject} `}lesson and we'll go through it together.`;
  if (ctx.hasAttachment && t.trim().length < 12) return "Got the file, thank you — I'll take a look before our next session.";
  if (/\b(thanks|thank you|thx|appreciate)\b/.test(t)) return "You're welcome! See you at our next lesson.";
  if (/\b(hi|hello|hey)\b/.test(t) && t.length < 40) return `Hi ${ctx.learnerFirstName}! How can I help?`;
  if (t.includes("?")) return `Good question — let's cover it at the start of our next ${subject === "our" ? "" : `${subject} `}lesson. Send over any details before then.`;
  return `${hi} I've read your message and will follow up here shortly.`;
}
