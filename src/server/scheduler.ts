import "server-only";
import { closeFinishedClassrooms } from "./classroom";
import { placeTutor } from "./geocode";
import { db } from "./db";
import { runAction } from "./engine";
import { emailNotifications } from "./notify-email";

/*
 * Lifecycle jobs (expire unanswered booking requests, auto-complete finished lessons). They run from
 * the cron endpoint (/api/cron, e.g. a Vercel Cron every 10 minutes) and, as a fallback, at most once
 * every 5 minutes after a page load — whichever server instance claims the slot first runs them.
 */

export async function runScheduler(): Promise<number> {
  let emails: Promise<number> = Promise.resolve(0);
  const r = await runAction("runScheduledJobs", [], { userId: null }, (created) => (emails = emailNotifications(created)));
  await emails;
  // Live classrooms of finished lessons are closed, so a room can't be kept open after the lesson.
  const closed = await closeFinishedClassrooms().catch((e) => (console.error("[scheduler] classrooms", e), 0));
  // Tutors outside the US whose city couldn't be placed on the map when they saved it (a few per run).
  const unplaced = await db()`select id from public.tutors where country is not null and country <> 'US' and lat = 0 and lng = 0 and city <> '' limit 5`.catch(() => []);
  for (const t of unplaced) await placeTutor(t.id as string);
  return (r.ok ? (r.data as number) : 0) + closed;
}

export async function maybeRunScheduler(): Promise<void> {
  try {
    const sql = db();
    await sql`insert into public.platform_settings (key, value) values ('scheduler', '{"lastRunAt": "1970-01-01T00:00:00Z"}') on conflict (key) do nothing`;
    const claimed = await sql`
      update public.platform_settings set value = jsonb_build_object('lastRunAt', now()), updated_at = now()
      where key = 'scheduler' and (value ->> 'lastRunAt')::timestamptz < now() - interval '5 minutes'
      returning key`;
    if (claimed.length) await runScheduler();
  } catch (e) {
    console.error("[scheduler]", e);
  }
}
