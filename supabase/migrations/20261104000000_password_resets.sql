-- Password reset links made and emailed by the site itself (not Supabase's built-in email, which only
-- reaches the project's own team). Only a SHA-256 fingerprint of each link is kept, never the link,
-- so a database copy can't be used to reset anyone's password. A link works once, for 15 minutes,
-- and asking for a new one cancels the old one.

create table if not exists public.password_resets (
  id          text primary key,
  user_id     text not null references public.users (id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,                 -- used, or cancelled by a newer link
  created_at  timestamptz not null default now()
);
create index if not exists password_resets_user on public.password_resets (user_id, created_at desc);

alter table public.password_resets enable row level security;
revoke all on table public.password_resets from anon, authenticated;
