-- Locations in any country: accounts, tutor profiles and job posts get an ISO country code ("US", "IN").
-- Empty means the US (every row before this change). `state` is the 2-letter code in the US and the
-- state/province name elsewhere; postal codes follow each country's format (src/lib/postal.ts).
alter table public.users add column if not exists country text;
alter table public.tutors add column if not exists country text;
alter table public.requirements add column if not exists country text;

alter table public.users drop constraint if exists users_country;
alter table public.users add constraint users_country check (country is null or country ~ '^[A-Z]{2}$');
alter table public.tutors drop constraint if exists tutors_country;
alter table public.tutors add constraint tutors_country check (country is null or country ~ '^[A-Z]{2}$');
alter table public.requirements drop constraint if exists requirements_country;
alter table public.requirements add constraint requirements_country check (country is null or country ~ '^[A-Z]{2}$');

-- Sign-up: keep the country and any country's postal code (same function as before otherwise).
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

  insert into public.users (id, role, first_name, last_name, email, country, zip, timezone, email_verified, parental_consent)
  values (
    new.id::text, r, left(first, 60), left(last, 60), lower(new.email),
    cc,
    case when (meta ->> 'zip') ~ '^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$' then upper(meta ->> 'zip') end,
    tz,
    new.email_confirmed_at is not null,
    case when r = 'student' and band = '13-17' then jsonb_build_object('parentEmail', parent_email, 'status', 'pending') end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
