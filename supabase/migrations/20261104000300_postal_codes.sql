-- ZIP codes typed at sign-up may now be a 5-digit US ZIP code or a 6-digit Indian PIN code
-- (src/lib/postal.ts). Same function as in the first migration; only the ZIP check changed.
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
    case when (meta ->> 'zip') ~ '^\d{5,6}$' then meta ->> 'zip' end,
    tz,
    new.email_confirmed_at is not null,
    case when r = 'student' and band = '13-17' then jsonb_build_object('parentEmail', parent_email, 'status', 'pending') end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
