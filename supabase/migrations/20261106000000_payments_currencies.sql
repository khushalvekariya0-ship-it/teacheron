-- Prices in each tutor's own currency (₹ in India, $ in the US, £ in the UK, € in the euro area…), and card /
-- UPI payments through Razorpay. Amounts stay integers in the currency's minor unit (paise, cents, pence).
-- Existing rows keep US dollars: the prices already saved were entered in $.

alter table public.tutors add column if not exists currency text not null default 'USD';
alter table public.bookings add column if not exists currency text not null default 'USD';
alter table public.payments add column if not exists currency text not null default 'USD';
alter table public.wallet_transactions add column if not exists currency text not null default 'USD';
alter table public.payouts add column if not exists currency text not null default 'USD';
alter table public.requirements add column if not exists currency text not null default 'USD';
alter table public.applications add column if not exists currency text not null default 'USD';
-- A fixed-amount promo code is in one currency; a percentage code works in any (null).
alter table public.coupons add column if not exists currency text;

do $$
declare t text;
begin
  foreach t in array array['tutors', 'bookings', 'payments', 'wallet_transactions', 'payouts', 'requirements', 'applications', 'coupons'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_currency_check');
    execute format('alter table public.%I add constraint %I check (currency is null or currency ~ ''^[A-Z]{3}$'')', t, t || '_currency_check');
  end loop;
end $$;

-- Which Razorpay payment (and refund) a payment row is.
alter table public.payments add column if not exists provider text;
alter table public.payments add column if not exists provider_payment_id text;
alter table public.payments add column if not exists provider_order_id text;
alter table public.payments add column if not exists provider_refund_id text;
alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider is null or provider in ('razorpay'));
-- One charge per Razorpay payment (refund rows carry the same payment id with a negative amount).
create unique index if not exists payments_provider_charge on public.payments (provider_payment_id) where provider_payment_id is not null and amount_cents > 0;
create unique index if not exists payments_provider_refund on public.payments (provider_refund_id) where provider_refund_id is not null;

-- A checkout started on the site: the Razorpay order, what it pays for, and what came of it. Payments are
-- only acted on once the server has checked Razorpay's signature and the payment itself, and each order
-- is used once (from the browser's confirmation or Razorpay's webhook, whichever comes first).
create table if not exists public.payment_orders (
  id          text primary key,
  user_id     text not null references public.users (id) on delete cascade,
  kind        text not null check (kind in ('booking', 'booking_retry', 'study_credits', 'lead_credits', 'plan')),
  amount      integer not null check (amount > 0),
  currency    text not null check (currency ~ '^[A-Z]{3}$'),
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'created' check (status in ('created', 'processing', 'done', 'failed')),
  payment_id  text,
  result_id   text,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists payment_orders_user on public.payment_orders (user_id, created_at desc);
create unique index if not exists payment_orders_payment on public.payment_orders (payment_id) where payment_id is not null;

alter table public.payment_orders enable row level security;
revoke all on table public.payment_orders from anon, authenticated;

-- The two starter FAQs that named Stripe now name Razorpay (only if an admin hasn't edited them).
update public.faqs set answer = 'Families pay through Razorpay when they book. Earnings from a completed lesson (after TutorLink''s fee) become available after the dispute window closes and are paid to your bank account.' where id = 'faq_08' and answer = 'Payouts are handled through Stripe Connect. Earnings from a completed lesson become available after the dispute window closes and are paid to your connected bank account on the payout schedule.';
update public.faqs set answer = 'Payments are processed by Razorpay (UPI, cards, netbanking). We never store full card numbers or UPI details. Families pay only the tutor''s lesson price, in the tutor''s currency — there are no booking fees. You''ll see the full price and the cancellation policy before you confirm.' where id = 'faq_10' and answer = 'Payments are processed by Stripe. We never store full card numbers. Families pay only the tutor''s lesson price — there are no booking fees. You''ll see the full price and the cancellation policy before you confirm.';
