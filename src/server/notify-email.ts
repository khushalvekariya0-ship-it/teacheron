import "server-only";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/domain/data";
import type { AppNotification, NotificationPrefs, NotificationType } from "@/lib/types";
import { SITE } from "@/lib/site";
import { db } from "./db";
import { emailReady, escapeHtml, sendEmails } from "./email";
import { env } from "./env";

/*
 * Email copies of in-app notifications. Sent after the change that created them is saved, only to
 * accounts with a confirmed email that are active, and only for the groups the person left switched on
 * in Notifications → Email (account and security notices always go out).
 */

const GROUP: Record<NotificationType, keyof NotificationPrefs | "account"> = {
  message: "messages",
  application: "jobs",
  application_status: "jobs",
  job_match: "jobs",
  booking_request: "bookings",
  booking_confirmed: "bookings",
  booking_cancelled: "bookings",
  booking_rescheduled: "bookings",
  reminder: "reminders",
  payment: "payments",
  refund: "payments",
  payout: "payments",
  homework: "progress",
  progress: "progress",
  review_request: "progress",
  announcement: "marketing",
  verification: "account",
  security: "account",
};

type Recipient = { id: string; email: string; firstName: string; prefs: NotificationPrefs };

async function recipients(userIds: string[]): Promise<Map<string, Recipient>> {
  const rows = await db()`
    select u.id, u.email, u.first_name, p.prefs
      from public.users u left join public.notification_prefs p on p.user_id = u.id
     where u.id = any(${userIds}) and u.email_verified and u.status = 'active' and u.email <> ''`;
  return new Map(
    rows.map((r) => [String(r.id), { id: String(r.id), email: String(r.email), firstName: String(r.first_name), prefs: { ...DEFAULT_NOTIFICATION_PREFS, ...((r.prefs as Partial<NotificationPrefs> | null) ?? {}) } }]),
  );
}

/** One email per chat thread burst: skip when an earlier message notice is still unread from the last 30 minutes. */
async function recentlyEmailedMessages(list: AppNotification[]): Promise<Set<string>> {
  const ids = list.filter((n) => n.type === "message").map((n) => n.id);
  if (!ids.length) return new Set();
  const rows = await db()`
    select n.id from public.notifications n
     where n.id = any(${ids}) and exists (
       select 1 from public.notifications o
        where o.user_id = n.user_id and o.type = 'message' and not o.read and o.id <> all(${ids})
          and o.created_at > now() - interval '30 minutes')`;
  return new Set(rows.map((r) => String(r.id)));
}

export async function emailNotifications(list: AppNotification[], origin = env.siteUrl): Promise<number> {
  if (!list.length || !emailReady()) return 0;
  try {
    const people = await recipients([...new Set(list.map((n) => n.userId))]);
    const skip = await recentlyEmailedMessages(list);
    const settings = origin ? `${origin}/dashboard/notifications` : "";
    const messages = list.flatMap((n) => {
      const to = people.get(n.userId);
      const group = GROUP[n.type] ?? "account";
      if (!to || skip.has(n.id) || (group !== "account" && !to.prefs[group]?.email)) return [];
      const link = n.href && origin ? `${origin}${n.href}` : "";
      const footer = group === "account" ? `You're getting this because it's about your ${SITE.name} account.` : `Change which emails you get: ${settings || "Notifications in your dashboard"}`;
      return [
        {
          to: to.email,
          subject: n.title,
          text: `Hi ${to.firstName},\n\n${n.body}${link ? `\n\nOpen in ${SITE.name}: ${link}` : ""}\n\n—\n${footer}`,
          html: `<p>Hi ${escapeHtml(to.firstName)},</p><p>${escapeHtml(n.body)}</p>${link ? `<p><a href="${escapeHtml(link)}">Open in ${SITE.name}</a></p>` : ""}<hr><p style="color:#666;font-size:12px">${
            group === "account" ? escapeHtml(footer) : settings ? `<a href="${escapeHtml(settings)}">Change which emails you get</a>` : "Change which emails you get under Notifications in your dashboard."
          }</p>`,
        },
      ];
    });
    return await sendEmails(messages);
  } catch (e) {
    console.error("[email] notifications", e);
    return 0;
  }
}
