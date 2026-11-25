import "server-only";
import { db } from "./db";

/*
 * Tutor stats shown on profiles and cards, and used by the Top tutor badge (src/lib/tutor-badges.ts). Run by
 * the scheduler; both are counted from real data:
 * - lessons completed: lessons that ended as completed (or the student didn't show, which the tutor is paid for);
 * - response time: the median time, over the last 90 days, from a learner's message (the first of a run) to the
 *   tutor's next reply, in whole hours (at least 1). Messages still unanswered count up to now. Fewer than
 *   3 such messages: no figure.
 */
export async function refreshTutorStats(): Promise<number> {
  const sql = db();
  const lessons = await sql`
    update public.tutors t set lessons_completed = c.n
    from (
      select t2.id, count(b.id)::int as n
      from public.tutors t2
      left join public.bookings b on b.tutor_id = t2.id and b.status in ('completed', 'no_show_student')
      group by t2.id
    ) c
    where c.id = t.id and t.lessons_completed is distinct from c.n
    returning t.id`;
  const replies = await sql`
    with ordered as (
      select m.conversation_id, c.tutor_id, m.sender_id, m.created_at,
             lag(m.sender_id) over (partition by m.conversation_id order by m.created_at) as prev_sender
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.created_at > now() - interval '90 days'
    ),
    asks as (
      select o.tutor_id, o.created_at,
             (select min(r.created_at) from public.messages r
               where r.conversation_id = o.conversation_id and r.sender_id = o.tutor_id and r.created_at > o.created_at) as replied_at
      from ordered o
      where o.sender_id <> o.tutor_id and (o.prev_sender is null or o.prev_sender = o.tutor_id)
    ),
    per_tutor as (
      select tutor_id, count(*)::int as n,
             percentile_cont(0.5) within group (order by extract(epoch from coalesce(replied_at, now()) - created_at) / 3600.0) as median_hours
      from asks
      -- a message from the last hour that hasn't been answered yet doesn't count against the tutor
      where replied_at is not null or created_at < now() - interval '1 hour'
      group by tutor_id
    ),
    figures as (
      select t.id, case when p.n >= 3 then greatest(1, ceil(p.median_hours))::real end as hours
      from public.tutors t left join per_tutor p on p.tutor_id = t.id
    )
    update public.tutors t set response_time_hours = f.hours
    from figures f
    where f.id = t.id and t.response_time_hours is distinct from f.hours
    returning t.id`;
  return lessons.length + replies.length;
}
