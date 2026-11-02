-- ─────────────────────────────────────────────────────────────────────────────
-- TutorLink — initial schema for Supabase (PostgreSQL 15+).
--
-- Access model
--   • Every table has Row Level Security ENABLED and NO policies, and the anon/authenticated roles
--     have no privileges on them. The public (anon) key that ships to the browser therefore can't read
--     or write any of this data through the Supabase API.
--   • All reads and writes go through the Next.js API (src/app/api), which connects with the database
--     connection string (SUPABASE_DB_URL, server-only) and enforces roles, ownership and business rules
--     inside a transaction.
--   • Accounts live in Supabase Auth (auth.users). The triggers at the bottom keep public.users in step:
--     a sign-up creates the profile row (role whitelisted to student / parent / tutor), email
--     confirmation marks it verified, and deleting the auth user removes the profile.
--
-- Conventions: ids are text; money is integer cents; timestamps are timestamptz (UTC);
-- calendar-only values (YYYY-MM-DD) are text with a format check.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists btree_gist;

-- ── Accounts ────────────────────────────────────────────────────────────────

create table public.users (
  id               text primary key,                       -- = auth.users.id
  role             text not null check (role in ('student', 'parent', 'tutor', 'admin', 'support')),
  first_name       text not null default '',
  last_name        text not null default '',
  email            text not null,
  phone            text,
  city             text,
  state            text,
  zip              text,
  timezone         text not null default 'America/New_York',
  created_at       timestamptz not null default now(),
  email_verified   boolean not null default false,
  mfa_enabled      boolean not null default false,
  tutor_id         text,
  permissions      text[] not null default '{}',
  status           text not null default 'active' check (status in ('active', 'suspended', 'pending_verification')),
  parental_consent jsonb,                                   -- { parentEmail, status: pending | granted }
  last_login_at    timestamptz
);
create unique index users_email_key on public.users (lower(email));
create unique index users_tutor_id_key on public.users (tutor_id) where tutor_id is not null;

create table public.login_events (
  id         text primary key,
  user_id    text not null references public.users (id) on delete cascade,
  at         timestamptz not null default now(),
  device     text not null default '',
  success    boolean not null
);
create index login_events_user_at on public.login_events (user_id, at desc);

-- Links in the parental-consent email. Only a SHA-256 of the token is stored.
create table public.parental_consent_tokens (
  token_hash   text primary key,
  user_id      text not null references public.users (id) on delete cascade,
  parent_email text not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  used_at      timestamptz
);
create index parental_consent_tokens_user on public.parental_consent_tokens (user_id);

create table public.children (
  id             text primary key,
  parent_id      text not null references public.users (id) on delete cascade,
  first_name     text not null check (length(first_name) between 1 and 60),
  grade          text not null,
  birth_year     int check (birth_year is null or birth_year between 1990 and 2100),
  learning_goals text[] not null default '{}',
  notes          text,
  subjects       text[] not null default '{}',
  created_at     timestamptz not null default now()
);
create index children_parent on public.children (parent_id);

create table public.student_profiles (
  user_id    text primary key references public.users (id) on delete cascade,
  profile    jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.notification_prefs (
  user_id text primary key references public.users (id) on delete cascade,
  prefs   jsonb not null
);

-- ── Catalog ─────────────────────────────────────────────────────────────────

create table public.subject_categories (
  slug        text primary key,
  name        text not null check (length(name) between 2 and 60),
  description text not null default '' check (length(description) <= 200),
  hidden      boolean not null default false,
  position    int not null default 0
);
create unique index subject_categories_name_key on public.subject_categories (lower(name));

create table public.subjects (
  slug     text primary key,
  name     text not null check (length(name) between 2 and 60),
  category text not null references public.subject_categories (slug) on update cascade,
  summary  text not null default '' check (length(summary) <= 200),
  popular  boolean not null default false,
  hidden   boolean not null default false,
  position int not null default 0
);
create unique index subjects_name_key on public.subjects (lower(name));
create index subjects_category on public.subjects (category, position);

-- ── Tutors ──────────────────────────────────────────────────────────────────

create table public.tutors (
  id                   text primary key,
  slug                 text not null unique,
  first_name           text not null,
  last_name            text not null,
  headline             text not null default '',
  bio                  text not null default '',
  approach             text not null default '',
  subjects             text[] not null default '{}',
  specialties          text[] not null default '{}',
  levels               text[] not null default '{}',
  category             text not null,
  learning_support     text[] not null default '{}',
  city                 text not null default '',
  state                text not null default '',
  zip                  text not null default '',
  lat                  double precision not null,
  lng                  double precision not null,
  service_radius_miles int not null default 10 check (service_radius_miles between 0 and 100),
  timezone             text not null,
  modes                text[] not null default '{online}',
  hourly_rate_cents    int not null check (hourly_rate_cents between 1500 and 50000),
  trial                jsonb not null,
  rules                jsonb not null,
  experience_years     int not null default 0 check (experience_years between 0 and 60),
  education            jsonb not null default '[]',
  certifications       jsonb not null default '[]',
  languages            text[] not null default '{English}',
  verification         jsonb not null,
  rating               real,
  review_count         int not null default 0,
  lessons_completed    int not null default 0,
  response_time_hours  real,
  availability         jsonb not null default '[]',
  exceptions           jsonb not null default '[]',
  featured             boolean not null default false,
  joined_at            timestamptz not null default now(),
  tone                 int not null default 2,
  photo_url            text,
  intro_video_url      text,
  updated_at           timestamptz not null default now()
);
create index tutors_subjects on public.tutors using gin (subjects);

alter table public.users
  add constraint users_tutor_fk foreign key (tutor_id) references public.tutors (id) on delete set null;

create table public.onboarding_drafts (
  user_id      text primary key references public.users (id) on delete cascade,
  step         int not null default 0,
  data         jsonb not null default '{}',
  updated_at   timestamptz not null default now(),
  submitted_at timestamptz
);

create table public.subscriptions (
  tutor_id  text primary key references public.tutors (id) on delete cascade,
  plan      text not null check (plan in ('free', 'pro', 'premium')),
  status    text not null check (status in ('active', 'past_due', 'canceled')),
  renews_at timestamptz
);

create table public.lead_transactions (
  id         text primary key,
  tutor_id   text not null references public.tutors (id) on delete cascade,
  delta      int not null,
  reason     text not null,
  created_at timestamptz not null default now()
);
create index lead_transactions_tutor on public.lead_transactions (tutor_id, created_at desc);

create table public.verification_requests (
  id          text primary key,
  tutor_id    text not null references public.tutors (id) on delete cascade,
  kind        text not null check (kind in ('identity', 'education', 'certification', 'background')),
  status      text not null check (status in ('not_started', 'submitted', 'under_review', 'verified', 'rejected', 'expired')),
  documents   jsonb not null default '[]',
  submitted_at timestamptz not null,
  reviewed_by text,
  reviewed_at timestamptz,
  note        text,
  expires_at  timestamptz
);
create index verification_requests_tutor on public.verification_requests (tutor_id);
create index verification_requests_open on public.verification_requests (submitted_at) where status in ('submitted', 'under_review');

create table public.payouts (
  id           text primary key,
  tutor_id     text not null references public.tutors (id) on delete cascade,
  amount_cents int not null check (amount_cents >= 0),
  status       text not null check (status in ('scheduled', 'in_transit', 'paid', 'failed')),
  arrival_date text not null check (arrival_date ~ '^\d{4}-\d{2}-\d{2}$'),
  created_at   timestamptz not null default now()
);
create index payouts_tutor on public.payouts (tutor_id, created_at desc);

-- ── Discovery ───────────────────────────────────────────────────────────────

create table public.favorites (
  user_id    text not null references public.users (id) on delete cascade,
  tutor_id   text not null references public.tutors (id) on delete cascade,
  position   int not null default 0,
  primary key (user_id, tutor_id)
);

create table public.saved_searches (
  id         text primary key,
  user_id    text not null references public.users (id) on delete cascade,
  kind       text not null check (kind in ('tutors', 'jobs')),
  label      text not null,
  query      jsonb not null default '{}',
  frequency  text not null check (frequency in ('instant', 'daily', 'weekly', 'off')),
  created_at timestamptz not null default now()
);
create index saved_searches_user on public.saved_searches (user_id);
create index saved_searches_job_alerts on public.saved_searches (kind, frequency) where kind = 'jobs';

-- ── Requirements (tutor jobs) & applications ────────────────────────────────

create table public.requirements (
  id                   text primary key,
  owner_id             text not null references public.users (id) on delete cascade,
  child_id             text,
  title                text not null default '',
  subject              text not null default '',
  grade                text not null,
  objectives           text not null default '',
  modes                text[] not null default '{online}',
  city                 text not null default '',
  state                text not null default '',
  zip                  text not null default '',
  days                 text[] not null default '{}',
  times_of_day         text[] not null default '{}',
  sessions_per_week    int not null default 1 check (sessions_per_week between 1 and 14),
  budget_min_cents     int not null check (budget_min_cents >= 0),
  budget_max_cents     int not null check (budget_max_cents >= 0),
  min_experience_years int,
  languages            text[] not null default '{}',
  preferences          text not null default '',
  details              text not null default '',
  attachments          jsonb,
  learning_support     text[],
  status               text not null check (status in ('draft', 'published', 'paused', 'closed')),
  created_at           timestamptz not null,
  updated_at           timestamptz not null,
  published_at         timestamptz,
  draft_step           int
);
create index requirements_owner on public.requirements (owner_id);
create index requirements_published on public.requirements (published_at desc) where status = 'published';

create table public.saved_jobs (
  user_id        text not null references public.users (id) on delete cascade,
  requirement_id text not null references public.requirements (id) on delete cascade,
  position       int not null default 0,
  primary key (user_id, requirement_id)
);

create table public.applications (
  id                  text primary key,
  requirement_id      text not null references public.requirements (id) on delete cascade,
  tutor_id            text not null references public.tutors (id) on delete cascade,
  message             text not null,
  proposed_rate_cents int not null check (proposed_rate_cents between 1500 and 50000),
  status              text not null check (status in ('applied', 'viewed', 'shortlisted', 'contacted', 'trial_requested', 'hired', 'rejected', 'withdrawn', 'closed')),
  created_at          timestamptz not null,
  updated_at          timestamptz not null
);
create index applications_requirement on public.applications (requirement_id);
create index applications_tutor on public.applications (tutor_id);
create unique index applications_one_active_per_tutor on public.applications (requirement_id, tutor_id) where status <> 'withdrawn';

-- ── Bookings ────────────────────────────────────────────────────────────────

create table public.bookings (
  id                  text primary key,
  tutor_id            text not null references public.tutors (id),
  booker_id           text not null,                       -- kept after account deletion (tax & disputes)
  child_id            text,
  subject             text not null,
  type                text not null check (type in ('trial', 'regular')),
  status              text not null check (status in ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled_by_student', 'cancelled_by_tutor', 'rescheduled', 'no_show_student', 'no_show_tutor', 'payment_failed', 'disputed', 'refunded')),
  start_utc           timestamptz not null,
  end_utc             timestamptz not null,
  blocked_until       timestamptz not null,               -- end + the tutor's buffer at booking time
  duration_min        int not null check (duration_min between 15 and 240),
  mode                text not null check (mode in ('online', 'in_person')),
  price_cents         int not null check (price_cents >= 0),
  platform_fee_cents  int not null check (platform_fee_cents >= 0),
  discount_cents      int not null default 0 check (discount_cents >= 0),
  payment_status      text not null check (payment_status in ('unpaid', 'authorized', 'paid', 'refunded', 'partially_refunded', 'failed')),
  meeting_url         text,
  location_note       text,
  notes               text,
  rescheduled_from_id text,
  reschedule_count    int,
  review_id           text,
  idempotency_key     text not null unique,
  history             jsonb not null default '[]',
  created_at          timestamptz not null,
  constraint bookings_time check (end_utc > start_utc and blocked_until >= end_utc),
  constraint bookings_discount check (discount_cents <= price_cents),
  -- No two live bookings for the same tutor may overlap (buffer included). Violations raise 23P01.
  constraint bookings_no_overlap exclude using gist (tutor_id with =, tstzrange(start_utc, blocked_until, '[)') with &&)
    where (status in ('pending', 'confirmed', 'in_progress'))
);
create index bookings_tutor_start on public.bookings (tutor_id, start_utc);
create index bookings_booker on public.bookings (booker_id, start_utc desc);
create index bookings_due on public.bookings (start_utc) where status in ('pending', 'confirmed', 'in_progress');
create unique index bookings_one_trial_per_learner on public.bookings (tutor_id, coalesce(child_id, booker_id))
  where type = 'trial' and status not in ('cancelled_by_student', 'cancelled_by_tutor', 'rescheduled');

create table public.reviews (
  id             text primary key,
  tutor_id       text not null references public.tutors (id) on delete cascade,
  booking_id     text not null unique references public.bookings (id),
  author_name    text not null,
  author_role    text not null check (author_role in ('student', 'parent')),
  rating         smallint not null check (rating between 1 and 5),
  body           text not null,
  subject        text not null,
  created_at     timestamptz not null,
  tutor_response jsonb,
  status         text not null check (status in ('published', 'flagged', 'removed'))
);
create index reviews_tutor on public.reviews (tutor_id, created_at desc);

create table public.disputes (
  id          text primary key,
  booking_id  text not null references public.bookings (id),
  opened_by   text not null,
  reason      text not null check (reason in ('missed_session', 'tutor_no_show', 'student_no_show', 'service_issue', 'payment_issue', 'refund_issue', 'other')),
  details     text not null,
  evidence    jsonb not null default '[]',
  status      text not null check (status in ('open', 'under_review', 'awaiting_information', 'resolved', 'rejected', 'escalated')),
  resolution  jsonb,
  admin_notes jsonb not null default '[]',
  created_at  timestamptz not null,
  updated_at  timestamptz not null
);
create index disputes_booking on public.disputes (booking_id);
create unique index disputes_one_open_per_booking on public.disputes (booking_id) where status not in ('resolved', 'rejected');

-- ── Messaging ───────────────────────────────────────────────────────────────

create table public.conversations (
  id              text primary key,
  tutor_id        text not null references public.tutors (id),
  user_id         text not null,
  child_id        text,
  subject         text,
  created_at      timestamptz not null,
  last_message_at timestamptz not null,
  blocked_by      text,
  reported        boolean not null default false,
  involves_minor  boolean not null default false
);
create unique index conversations_one_per_pair on public.conversations (tutor_id, user_id, coalesce(child_id, ''));
create index conversations_user on public.conversations (user_id);

create table public.messages (
  id              text primary key,
  conversation_id text not null references public.conversations (id) on delete cascade,
  sender_id       text not null,
  body            text not null check (length(body) <= 4000),
  created_at      timestamptz not null,
  read_at         timestamptz,
  attachment      jsonb,
  moderation      text check (moderation in ('contact_info_masked', 'flagged'))
);
create index messages_conversation on public.messages (conversation_id, created_at);

create table public.notifications (
  id         text primary key,
  user_id    text not null references public.users (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text not null default '',
  href       text,
  created_at timestamptz not null,
  read       boolean not null default false
);
create index notifications_user on public.notifications (user_id, created_at desc);

-- ── Learning ────────────────────────────────────────────────────────────────

create table public.learning_goals (
  id          text primary key,
  learner_id  text not null,                               -- a student user id or a child id
  tutor_id    text not null references public.tutors (id) on delete cascade,
  subject     text not null,
  title       text not null,
  topics      jsonb not null default '[]',
  target_date text check (target_date is null or target_date ~ '^\d{4}-\d{2}-\d{2}$'),
  created_at  timestamptz not null
);
create index learning_goals_learner on public.learning_goals (learner_id);
create index learning_goals_tutor on public.learning_goals (tutor_id);

create table public.progress_notes (
  id         text primary key,
  learner_id text not null,
  tutor_id   text not null references public.tutors (id) on delete cascade,
  booking_id text,
  body       text not null,
  rating     smallint check (rating is null or rating between 1 and 5),
  created_at timestamptz not null
);
create index progress_notes_learner on public.progress_notes (learner_id);
create index progress_notes_tutor on public.progress_notes (tutor_id);

create table public.homework (
  id           text primary key,
  learner_id   text not null,
  tutor_id     text not null references public.tutors (id) on delete cascade,
  subject      text not null,
  title        text not null,
  instructions text not null default '',
  due_date     text not null check (due_date ~ '^\d{4}-\d{2}-\d{2}$'),
  status       text not null check (status in ('assigned', 'submitted', 'reviewed', 'overdue')),
  submission   jsonb,
  feedback     jsonb,
  created_at   timestamptz not null
);
create index homework_learner on public.homework (learner_id);
create index homework_tutor on public.homework (tutor_id);

-- ── Money ───────────────────────────────────────────────────────────────────

create table public.payments (
  id           text primary key,
  booking_id   text,
  user_id      text not null,
  kind         text not null check (kind in ('booking', 'subscription', 'lead_credits', 'study_credits')),
  amount_cents int not null,                               -- negative for refunds
  status       text not null check (status in ('succeeded', 'pending', 'failed', 'refunded', 'partially_refunded')),
  description  text not null,
  method       text not null,
  created_at   timestamptz not null
);
create index payments_user on public.payments (user_id, created_at desc);
create index payments_booking on public.payments (booking_id) where booking_id is not null;

create table public.wallet_transactions (
  id          text primary key,
  user_id     text not null,
  delta_cents int not null,
  kind        text not null check (kind in ('top_up', 'lesson', 'refund')),
  description text not null,
  booking_id  text,
  created_at  timestamptz not null
);
create index wallet_transactions_user on public.wallet_transactions (user_id, created_at desc);

create table public.coupons (
  id                 text primary key,
  code               text not null unique check (code ~ '^[A-Z0-9]{4,16}$'),
  kind               text not null check (kind in ('percent', 'fixed')),
  value              int not null check (value > 0),
  min_purchase_cents int not null default 0 check (min_purchase_cents >= 0),
  max_redemptions    int not null check (max_redemptions >= 0),
  redemptions        int not null default 0 check (redemptions >= 0),
  expires_at         timestamptz not null,
  first_booking_only boolean not null default false,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  constraint coupons_percent check (kind <> 'percent' or value <= 100)
);

-- ── Trust & safety ──────────────────────────────────────────────────────────

create table public.reports (
  id          text primary key,
  reporter_id text not null,
  target_type text not null check (target_type in ('user', 'tutor', 'message', 'review', 'requirement')),
  target_id   text not null,
  reason      text not null,
  details     text not null default '',
  status      text not null check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at  timestamptz not null
);
create index reports_open on public.reports (created_at desc) where status in ('open', 'reviewing');

create table public.audit_logs (
  id          text primary key,
  actor_id    text not null,
  action      text not null,
  target_type text not null,
  target_id   text not null,
  meta        jsonb,
  created_at  timestamptz not null
);
create index audit_logs_created on public.audit_logs (created_at desc);

-- ── Platform settings ───────────────────────────────────────────────────────

create table public.feature_flags (
  key             text primary key,
  label           text not null,
  description     text not null default '',
  enabled         boolean not null default false,
  rollout_percent int not null default 0 check (rollout_percent between 0 and 100),
  position        int not null default 0
);

create table public.platform_settings (
  key        text primary key,                             -- booking_policy, platform_fee_bps, scheduler
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ── Website content (Admin → Content) ───────────────────────────────────────

create table public.blog_posts (
  slug         text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title        text not null check (length(title) between 4 and 140),
  excerpt      text not null default '' check (length(excerpt) <= 400),
  category     text not null,
  author       text not null,
  published_on text not null check (published_on ~ '^\d{4}-\d{2}-\d{2}$'),
  read_minutes int not null default 3 check (read_minutes between 1 and 60),
  body         jsonb not null default '[]',                -- [{ h?, p }]
  status       text not null default 'published' check (status in ('draft', 'published')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.faqs (
  id        text primary key,
  audience  text not null check (audience in ('families', 'tutors', 'payments', 'safety')),
  question  text not null check (length(question) between 5 and 200),
  answer    text not null check (length(answer) between 5 and 2000),
  published boolean not null default true,
  position  int not null default 0
);

-- Customer stories shown on the home page. Only published with the customer's consent.
create table public.testimonials (
  id                text primary key,
  quote             text not null check (length(quote) between 20 and 400),
  name              text not null check (length(name) between 2 and 80),
  context           text not null default '',
  used_label        text not null default '',
  used_href         text not null default '',
  consent_confirmed boolean not null default false,
  published         boolean not null default false,
  position          int not null default 0,
  created_at        timestamptz not null default now(),
  constraint testimonials_consent check (not published or consent_confirmed)
);

-- ── Lock everything down for the Supabase API keys ──────────────────────────

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('revoke all on table public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- ── Supabase Auth → public.users ────────────────────────────────────────────

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  r     text  := meta ->> 'role';
  band  text  := meta ->> 'age_band';
  full_name text := trim(coalesce(meta ->> 'full_name', meta ->> 'name', ''));
  first text  := trim(coalesce(nullif(meta ->> 'first_name', ''), split_part(full_name, ' ', 1)));
  last  text  := trim(coalesce(nullif(meta ->> 'last_name', ''), nullif(substr(full_name, length(split_part(full_name, ' ', 1)) + 2), ''), ''));
  tz    text  := nullif(meta ->> 'timezone', '');
  parent_email text := lower(trim(coalesce(meta ->> 'parent_email', '')));
begin
  -- Only learner and tutor accounts can be created by signing up. Staff roles are granted by an admin.
  if r is null or r not in ('student', 'parent', 'tutor') then
    r := 'student';
  end if;
  if band = 'under13' then
    raise exception 'Students under 13 can''t create an account. A parent can sign up and add them as a child.';
  end if;
  if r = 'student' and band = '13-17' and parent_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Students under 18 need a parent or guardian''s email.';
  end if;
  if tz is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = tz) then
    tz := 'America/New_York';
  end if;

  insert into public.users (id, role, first_name, last_name, email, zip, timezone, email_verified, parental_consent)
  values (
    new.id::text, r, left(first, 60), left(last, 60), lower(new.email),
    case when (meta ->> 'zip') ~ '^\d{5}$' then meta ->> 'zip' end,
    tz,
    new.email_confirmed_at is not null,
    case when r = 'student' and band = '13-17' then jsonb_build_object('parentEmail', parent_email, 'status', 'pending') end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users
     set email_verified = new.email_confirmed_at is not null,
         email = lower(new.email)
   where id = new.id::text
     and (email_verified is distinct from (new.email_confirmed_at is not null) or email is distinct from lower(new.email));
  return new;
end;
$$;

create or replace function public.handle_auth_user_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.users where id = old.id::text;
  return old;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.handle_auth_user_updated() from public, anon, authenticated;
revoke all on function public.handle_auth_user_deleted() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();
create trigger on_auth_user_updated after update of email, email_confirmed_at on auth.users
  for each row execute function public.handle_auth_user_updated();
create trigger on_auth_user_deleted after delete on auth.users
  for each row execute function public.handle_auth_user_deleted();

-- ── Storage buckets ─────────────────────────────────────────────────────────
-- public-media:  tutor photos and intro videos (shown on public profiles).
-- private-files: verification documents and other private uploads; read through signed links only.
-- Uploads use signed upload URLs issued by the API, so no storage policies are needed for clients.

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values
      ('public-media', 'public-media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']),
      ('private-files', 'private-files', false, 15728640, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
    on conflict (id) do nothing;
  end if;
end $$;
