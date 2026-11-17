import "server-only";
import type { Permission } from "@/lib/types";
import { db } from "./db";

/*
 * In-app alerts to staff for things that happen outside the action engine (sign-ups, the live class).
 * They count on the admin sidebar item their link opens (src/lib/nav-sections.ts) and are never emailed.
 * Actions use notifyStaff in src/lib/domain/actions.ts, with the same rules.
 */

const rid = () => `ntf_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

/**
 * Tells active staff with `perm`. One unread alert per link: a repeat (the same person again) refreshes
 * it instead of adding another. Never throws: an alert must not break what the person was doing.
 */
export async function alertStaff(perm: Permission, n: { title: string; body: string; href: string }, except?: string): Promise<void> {
  try {
    const staff = await db()`select id from public.users where status = 'active' and role in ('admin', 'support') and ${perm} = any(permissions) and id <> ${except ?? ""}`;
    for (const s of staff) {
      const [hit] = await db()`update public.notifications set title = ${n.title}, body = ${n.body}, created_at = now()
        where user_id = ${s.id} and type = 'staff' and not read and href = ${n.href} returning id`;
      if (!hit) {
        await db()`insert into public.notifications (id, user_id, type, title, body, href, created_at, read)
          values (${rid()}, ${s.id}, 'staff', ${n.title}, ${n.body}, ${n.href}, now(), false)`;
      }
    }
  } catch (e) {
    console.error("[staff-alert]", (e as Error)?.message);
  }
}

/** "Riley S." */
export const shortName = (first: unknown, last: unknown) => `${String(first ?? "").trim()} ${String(last ?? "").trim().charAt(0)}${String(last ?? "").trim() ? "." : ""}`.trim() || "Someone";
