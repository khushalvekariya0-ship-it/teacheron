"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, Info, Mail, MessageSquareText, MonitorSmartphone } from "lucide-react";
import type { AppNotification, Channel, NotificationPrefs, User } from "@/lib/types";
import { PageHeader } from "@/components/dashboard/Shell";
import { AnimatePresence, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Segmented, Switch } from "@/components/ui/Controls";
import { Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { DEFAULT_NOTIFICATION_PREFS, useApp } from "@/lib/store";
import { useFlag, useNow, useSession } from "@/lib/store/hooks";
import { cn } from "@/lib/utils";
import { NOTIFICATION_CATEGORIES, NotificationRow } from "./notificationMeta";

type Group = keyof NotificationPrefs;

const CHANNELS: { key: Channel; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "in_app", label: "In-app", icon: MonitorSmartphone },
  { key: "email", label: "Email", icon: Mail },
  { key: "sms", label: "SMS", icon: MessageSquareText },
];

function groupsFor(role: User["role"]): { key: Group; label: string; description: string }[] {
  const tutor = role === "tutor";
  return [
    { key: "messages", label: "Messages", description: tutor ? "New messages from students and parents" : "New messages from tutors" },
    { key: "bookings", label: "Bookings", description: "Requests, confirmations, reschedules and cancellations" },
    { key: "reminders", label: "Lesson reminders", description: "Before each lesson starts" },
    { key: "payments", label: tutor ? "Payments & payouts" : "Payments & receipts", description: tutor ? "Payouts, plan charges and credit purchases" : "Charges, refunds and receipts" },
    { key: "jobs", label: tutor ? "Job alerts" : "Applications", description: tutor ? "New jobs that match your saved searches, and application updates" : "When tutors apply to your requirements" },
    { key: "progress", label: "Homework & progress", description: tutor ? "Homework submissions and review requests" : "Homework, progress notes and review requests" },
    { key: "marketing", label: "Tips & product news", description: "Occasional updates about new features" },
  ];
}

const PAGE = 20;

export function NotificationsView() {
  const me = useSession();
  if (!me) return null;
  return <Inner me={me} />;
}

function Inner({ me }: { me: User }) {
  const router = useRouter();
  const now = useNow(60_000);
  const all = useApp((s) => s.notifications);
  const markRead = useApp((s) => s.markNotificationRead);
  const markAll = useApp((s) => s.markAllNotificationsRead);
  const [show, setShow] = React.useState<"all" | "unread">("all");
  const [category, setCategory] = React.useState("all");
  const [limit, setLimit] = React.useState(PAGE);

  const mine = React.useMemo(() => all.filter((n) => n.userId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [all, me.id]);
  const unread = mine.filter((n) => !n.read).length;
  const types = NOTIFICATION_CATEGORIES.find((c) => c.value === category)?.types;
  const filtered = mine.filter((n) => (show === "all" || !n.read) && (!types || types.includes(n.type)));
  const visible = filtered.slice(0, limit);

  const open = (n: AppNotification) => {
    markRead(n.id);
    if (n.href) router.push(n.href);
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Updates about your lessons, messages and account, and how you'd like to receive them."
        actions={
          <Button
            variant="secondary"
            disabled={!unread}
            onClick={() => {
              markAll();
              toast.success("All notifications marked as read");
            }}
          >
            <CheckCheck /> Mark all as read
          </Button>
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <Segmented
              size="sm"
              label="Show"
              value={show}
              onChange={(v) => {
                setShow(v);
                setLimit(PAGE);
              }}
              options={[
                { value: "all", label: "All", count: mine.length },
                { value: "unread", label: "Unread", count: unread },
              ]}
            />
            <Select
              aria-label="Filter by type"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setLimit(PAGE);
              }}
              options={[{ value: "all", label: "All types" }, ...NOTIFICATION_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))]}
              className="sm:w-60 [&_select]:h-9 [&_select]:text-sm"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={show === "unread" ? <Check /> : <Bell />}
              title={show === "unread" ? "You're all caught up" : mine.length ? "Nothing of this type" : "No notifications yet"}
              description={
                show === "unread"
                  ? "There's nothing new since you last checked."
                  : mine.length
                    ? "Try another type, or show all notifications."
                    : "Messages, booking updates, homework and payments will show up here."
              }
              action={
                (show !== "all" || category !== "all") && mine.length ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setShow("all");
                      setCategory("all");
                    }}
                  >
                    Show everything
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <ul className="divide-y divide-line">
                <AnimatePresence initial={false}>
                  {visible.map((n) => (
                    <motion.li key={n.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                      <NotificationRow n={n} onOpen={open} now={now} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
              {filtered.length > limit && (
                <div className="border-t border-line p-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                    Show {Math.min(PAGE, filtered.length - limit)} more
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>

        <Preferences me={me} />
      </div>
    </div>
  );
}

function Preferences({ me }: { me: User }) {
  const stored = useApp((s) => s.notificationPrefs[me.id]);
  const setPref = useApp((s) => s.setNotificationPref);
  const smsEnabled = useFlag("sms_notifications");
  const prefs = stored ?? DEFAULT_NOTIFICATION_PREFS;
  const groups = groupsFor(me.role);
  const [saved, setSaved] = React.useState(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const smsBlockedReason = !smsEnabled ? "SMS isn't available yet" : !me.phone ? "Add a mobile number first" : null;

  const change = (group: Group, channel: Channel, value: boolean) => {
    setPref(group, channel, value);
    setSaved((n) => n + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(0), 1800);
  };

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <Card className="xl:sticky xl:top-20">
      <CardHeader
        title="Delivery preferences"
        description="Choose where each kind of update reaches you."
        action={
          <AnimatePresence>
            {saved > 0 && (
              <motion.span key="saved" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-success" role="status">
                <Check className="size-3.5" aria-hidden /> Saved
              </motion.span>
            )}
          </AnimatePresence>
        }
      />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Notification channels for each type of update</caption>
          <thead>
            <tr className="border-y border-line bg-canvas">
              <th scope="col" className="px-5 py-2.5 text-left text-xs font-medium text-muted">
                Notification
              </th>
              {CHANNELS.map((c) => (
                <th key={c.key} scope="col" className={cn("w-16 px-1 py-2.5 text-center text-xs font-medium", c.key === "sms" && smsBlockedReason ? "text-subtle" : "text-muted")}>
                  <span className="inline-flex flex-col items-center gap-1">
                    <c.icon className="size-3.5" aria-hidden />
                    {c.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key} className="border-b border-line last:border-0">
                <th scope="row" className="px-5 py-3 text-left font-normal">
                  <span className="block text-[13.5px] font-medium text-ink">{g.label}</span>
                  <span className="block text-[12px] leading-snug text-muted">{g.description}</span>
                </th>
                {CHANNELS.map((c) => {
                  const blocked = c.key === "sms" && !!smsBlockedReason;
                  const checked = blocked ? false : prefs[g.key][c.key];
                  return (
                    <td key={c.key} className="px-1 py-3 text-center">
                      <Switch
                        size="sm"
                        checked={checked}
                        disabled={blocked}
                        onCheckedChange={(v) => change(g.key, c.key, v)}
                        aria-label={`${g.label} by ${c.label}${blocked ? ` (${smsBlockedReason})` : ""}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 border-t border-line px-5 py-4 text-[12.5px] leading-relaxed text-muted">
        {smsBlockedReason && (
          <p className="flex items-start gap-2">
            <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden />
            {!smsEnabled ? (
              <span>Text message notifications aren&apos;t available on TutorLink yet. Your other channels keep working as normal.</span>
            ) : (
              <span>
                <Link href="/dashboard/settings" className="font-medium text-ink hover:underline">
                  Add a mobile number
                </Link>{" "}
                in Settings to get text messages.
              </span>
            )}
          </p>
        )}
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden />
          <span>Security alerts, such as password changes, are always sent by email.</span>
        </p>
      </div>
    </Card>
  );
}
