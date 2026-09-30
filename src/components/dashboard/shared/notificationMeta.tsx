"use client";

import * as React from "react";
import {
  BadgeCheck, Bell, BookOpen, Briefcase, CalendarCheck2, CalendarClock, CalendarX2, CreditCard, Inbox, LineChart, MessageSquare,
  NotebookPen, ReceiptText, RefreshCcw, ShieldAlert, Star, Wallet, type LucideIcon,
} from "lucide-react";
import type { AppNotification, NotificationType } from "@/lib/types";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const NOTIFICATION_ICON: Record<NotificationType, LucideIcon> = {
  message: MessageSquare,
  application: Inbox,
  application_status: Inbox,
  job_match: Briefcase,
  booking_request: CalendarClock,
  booking_confirmed: CalendarCheck2,
  booking_cancelled: CalendarX2,
  booking_rescheduled: RefreshCcw,
  reminder: Bell,
  payment: CreditCard,
  refund: ReceiptText,
  payout: Wallet,
  verification: BadgeCheck,
  review_request: Star,
  homework: NotebookPen,
  progress: LineChart,
  security: ShieldAlert,
};

export const NOTIFICATION_CATEGORIES: { value: string; label: string; types: NotificationType[] }[] = [
  { value: "messages", label: "Messages", types: ["message"] },
  { value: "bookings", label: "Bookings & reminders", types: ["booking_request", "booking_confirmed", "booking_cancelled", "booking_rescheduled", "reminder"] },
  { value: "jobs", label: "Applications & jobs", types: ["application", "application_status", "job_match"] },
  { value: "learning", label: "Homework, progress & reviews", types: ["homework", "progress", "review_request"] },
  { value: "payments", label: "Payments", types: ["payment", "refund", "payout"] },
  { value: "account", label: "Account & security", types: ["verification", "security"] },
];

export function NotificationRow({
  n,
  onOpen,
  compact,
  now,
}: {
  n: AppNotification;
  onOpen: (n: AppNotification) => void;
  compact?: boolean;
  now: number;
}) {
  const Icon = NOTIFICATION_ICON[n.type] ?? BookOpen;
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={cn(
        "group flex w-full items-start gap-3 text-left transition-colors hover:bg-canvas focus-visible:bg-canvas",
        compact ? "px-5 py-3" : "px-4 py-3.5 sm:px-5",
      )}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-lg border transition-colors",
          compact ? "size-8" : "size-9",
          n.read ? "border-line bg-surface text-muted" : "border-brand-soft bg-brand-soft text-ink",
        )}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className={cn("text-[13.5px] leading-snug", n.read ? "text-ink-2" : "font-medium text-ink")}>{n.title}</span>
          <span className="shrink-0 pt-px text-[11.5px] tabular-nums text-muted">{formatRelative(n.createdAt, now)}</span>
        </span>
        {n.body && <span className={cn("mt-0.5 block text-[13px] text-muted", compact && "truncate")}>{n.body}</span>}
      </span>
      <span className="mt-2 flex w-2 shrink-0 justify-center">
        {!n.read && <span className="size-2 rounded-full bg-ink" aria-hidden />}
        <span className="sr-only">{n.read ? "Read" : "Unread"}</span>
      </span>
    </button>
  );
}
