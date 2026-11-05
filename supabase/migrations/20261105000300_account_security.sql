-- Two-step login for every account: backup codes for when the phone with the authenticator app is lost.
-- Ten single-use codes are shown once when two-step login is turned on (or new ones are made); only
-- SHA-256 fingerprints are stored. Using one turns two-step login off so the person can set it up again.
create table if not exists public.mfa_recovery_codes (
  id          text primary key,
  user_id     text not null references public.users (id) on delete cascade,
  code_hash   text not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists mfa_recovery_codes_user on public.mfa_recovery_codes (user_id) where used_at is null;

alter table public.mfa_recovery_codes enable row level security;
revoke all on table public.mfa_recovery_codes from anon, authenticated;
