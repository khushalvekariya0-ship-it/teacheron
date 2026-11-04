-- One-time email codes (6 digits) for two separate purposes:
--   'verify_email'   the first-time check of a new account's email address, typed after sign-up;
--   'password_reset' typed on the Forgot password page; it unlocks one reset link (reset_id).
-- A code only works for its own purpose and account. Only a fingerprint is stored (the purpose is part of
-- it), a newer code cancels older ones of the same purpose, and five wrong tries cancel a code.
create table if not exists public.email_codes (
  id          text primary key,
  user_id     text not null references public.users (id) on delete cascade,
  purpose     text not null check (purpose in ('verify_email', 'password_reset')),
  code_hash   text not null,
  tries       integer not null default 0,
  reset_id    text references public.password_resets (id) on delete cascade,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now(),
  constraint email_codes_reset_link check ((purpose = 'password_reset') = (reset_id is not null))
);
create index if not exists email_codes_lookup on public.email_codes (user_id, purpose, created_at desc);

alter table public.email_codes enable row level security;
revoke all on table public.email_codes from anon, authenticated;

-- Password reset codes now live in email_codes (purpose 'password_reset').
alter table public.password_resets drop column if exists code_hash;
alter table public.password_resets drop column if exists code_tries;
