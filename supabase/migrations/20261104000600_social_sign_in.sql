-- Google / Facebook / Apple sign-in (through Supabase Auth):
--   needs_role         a first-time social sign-in hasn't chosen Student / Parent / Tutor yet (it gets
--                      no data access until it does, and can choose only once);
--   trusted_identities the sign-in methods (Supabase identity ids) the owner has confirmed for the account;
--   pending_link       a social sign-in that Supabase attached to an existing account with the same email,
--                      waiting for the 6-digit code sent to that account's email (the account stays locked);
-- accounts whose provider gives no email start with '' and add one (confirmed by code);
-- two more email-code purposes: 'link_account' and 'add_email' (with the address it goes to).
alter table public.users add column if not exists needs_role boolean not null default false;
alter table public.users add column if not exists trusted_identities text[] not null default '{}';
alter table public.users add column if not exists pending_link jsonb;

drop index if exists public.users_email_key;
create unique index if not exists users_email_key on public.users (lower(email)) where email <> '';

alter table public.email_codes drop constraint if exists email_codes_purpose_check;
alter table public.email_codes add constraint email_codes_purpose_check check (purpose in ('verify_email', 'password_reset', 'link_account', 'add_email'));
alter table public.email_codes add column if not exists target_email text;

-- Sign-up: a social sign-in (no role in its metadata) has to choose a role; no email → ''.
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
  cc    text  := upper(nullif(meta ->> 'country', ''));
  choose boolean := (meta ->> 'role') is null;
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
  if cc is not null and cc !~ '^[A-Z]{2}$' then
    cc := null;
  end if;

  insert into public.users (id, role, first_name, last_name, email, country, zip, timezone, email_verified, parental_consent, needs_role)
  values (
    new.id::text, r, left(first, 60), left(last, 60), coalesce(lower(new.email), ''),
    cc,
    case when (meta ->> 'zip') ~ '^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$' then upper(meta ->> 'zip') end,
    tz,
    new.email_confirmed_at is not null,
    case when r = 'student' and band = '13-17' then jsonb_build_object('parentEmail', parent_email, 'status', 'pending') end,
    choose
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
         email = coalesce(lower(new.email), '')
   where id = new.id::text
     and (email_verified is distinct from (new.email_confirmed_at is not null) or email is distinct from coalesce(lower(new.email), ''));
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.handle_auth_user_updated() from public, anon, authenticated;
