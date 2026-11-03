-- Chat safety: messages, homework notes, files and profile photos that were stopped because they
-- contained contact details (phone numbers, emails, other-app handles), and Trust & Safety actions.
--
-- Only a masked excerpt is kept (e.g. "call me at [phone number hidden]"); the contact details
-- themselves are never stored, and blocked files are deleted from storage. Like every table here,
-- it is reachable only through the server (Row Level Security on, no grants to anon/authenticated).

create table if not exists public.contact_flags (
  id           text primary key,
  user_id      text not null references public.users (id) on delete cascade,
  channel      text not null check (channel in ('chat', 'homework', 'profile')),
  source       text not null check (source in ('text', 'file')),
  context_id   text,                                   -- conversation, homework or tutor profile
  recipient_id text,                                   -- who would have received it
  kinds        text[] not null default '{}' check (kinds <@ array['phone', 'email', 'social']::text[]),
  excerpt      text not null default '' check (length(excerpt) <= 600),
  file_name    text check (length(file_name) <= 200),
  status       text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  reviewed_by  text,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists contact_flags_user on public.contact_flags (user_id, created_at desc);
create index if not exists contact_flags_open on public.contact_flags (created_at desc) where status = 'open';

alter table public.contact_flags enable row level security;
revoke all on table public.contact_flags from anon, authenticated;

-- { warnings, lastWarnedAt, restrictedUntil, restrictionReason, restrictedBy }
alter table public.users add column if not exists chat_moderation jsonb;
