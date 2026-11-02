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
  /** The counterpart's photo, when the viewer is talking to a tutor who has one. */
  photoUrl?: string;
  tutor?: Tutor;
  user?: User;
  childName?: string;
  subjectLabel?: string;
  messages: Message[];
  last?: Message;
  unread: number;
  /** The other side is a sample tutor with no live account — replies are simulated. */
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
          photoUrl: isTutor ? undefined : tutor?.photoUrl,
          tutor,
          user,
          childName: c.childId ? child?.firstName ?? "Student" : undefined,
          subjectLabel: c.subject ? subjectName(c.subject) : undefined,
          messages: list,
          last: list[list.length - 1],
          unread: list.filter((m) => m.senderId !== selfId && !m.readAt).length,
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

