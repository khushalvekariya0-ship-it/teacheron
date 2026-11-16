-- Paying tutors by hand: where each tutor wants to be paid (UPI ID, Indian bank account, or written
-- instructions for other countries), and what staff record after sending a payout themselves.

create table if not exists public.payout_accounts (
  tutor_id       text primary key references public.tutors (id) on delete cascade,
  method         text not null check (method in ('upi', 'bank', 'other')),
  account_holder text not null check (char_length(account_holder) between 2 and 100),
  upi_id         text check (upi_id is null or upi_id ~ '^[a-z0-9._-]{2,100}@[a-z][a-z0-9.-]{1,63}$'),
  account_number text check (account_number is null or account_number ~ '^[0-9]{9,18}$'),
  ifsc           text check (ifsc is null or ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  bank_name      text check (bank_name is null or char_length(bank_name) <= 100),
  details        text check (details is null or char_length(details) between 5 and 500),
  updated_at     timestamptz not null default now(),
  check (
    (method = 'upi' and upi_id is not null)
    or (method = 'bank' and account_number is not null and ifsc is not null)
    or (method = 'other' and details is not null)
  )
);

-- Only the server reads it (the tutor, and staff who handle payments, through the site).
alter table public.payout_accounts enable row level security;
revoke all on table public.payout_accounts from anon, authenticated;

alter table public.payouts add column if not exists method text check (method is null or method in ('upi', 'bank', 'other'));
alter table public.payouts add column if not exists reference text check (reference is null or char_length(reference) <= 100);
alter table public.payouts add column if not exists note text check (note is null or char_length(note) <= 500);
alter table public.payouts add column if not exists failure_reason text check (failure_reason is null or char_length(failure_reason) <= 500);
alter table public.payouts add column if not exists recorded_by text references public.users (id) on delete set null;
