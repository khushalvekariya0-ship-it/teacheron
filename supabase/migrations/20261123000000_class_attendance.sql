-- Attendance in the live class: who was in the lesson's classroom, from when, until when, and for how many
-- minutes. Each person's class page says "still here" once a minute (POST /api/classroom/attend); the lesson
-- page shows the result to the tutor, the student / parent and staff (helps with refunds and disputes).
-- One row per person per lesson. Nothing else is stored (no audio, video or anything said).
-- New table only: nothing existing is changed.
--
-- Rollback:
--   drop table if exists public.class_attendance;

create table if not exists public.class_attendance (
  booking_id  text not null references public.bookings (id) on delete cascade,
  -- The person's class identity: 'u-<user id>' or 'guest-<12 hex>'.
  who         text not null check (char_length(who) between 3 and 90),
  user_id     text references public.users (id) on delete set null,
  name        text not null check (char_length(name) between 1 and 80),
  role        text not null check (role in ('Tutor', 'Student', 'Parent', 'Staff', 'Guest')),
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  -- Time in the class, counted from the once-a-minute signs (gaps longer than 2.5 minutes aren't counted).
  seconds     integer not null default 0 check (seconds >= 0),
  -- How many times they (re)joined.
  joins       integer not null default 1 check (joins >= 1),
  primary key (booking_id, who)
);
create index if not exists class_attendance_user on public.class_attendance (user_id);

alter table public.class_attendance enable row level security;
revoke all on table public.class_attendance from anon, authenticated;
