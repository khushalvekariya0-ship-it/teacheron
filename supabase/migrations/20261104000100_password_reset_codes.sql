-- Password reset codes: each reset email also carries a 6-digit code that is typed on the "Forgot
-- password" page, for when the emailed link can't be opened (Gmail won't open links to a site that still
-- runs on its own computer, http://localhost). Only a fingerprint of the code is stored; a few wrong tries
-- cancel it. replaced_at marks links cancelled by a newer reset email, so the page can say "use the newest email".
alter table public.password_resets add column if not exists code_hash text;
alter table public.password_resets add column if not exists code_tries integer not null default 0;
alter table public.password_resets add column if not exists replaced_at timestamptz;
