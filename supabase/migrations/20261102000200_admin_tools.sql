-- Admin tools: staff can hide a tutor profile from the public site, and platform credit (tutor no-show
-- credit, dispute credit) is recorded in the learner's Study Credits wallet.

alter table public.tutors add column if not exists hidden boolean not null default false;

alter table public.wallet_transactions drop constraint if exists wallet_transactions_kind_check;
alter table public.wallet_transactions add constraint wallet_transactions_kind_check check (kind in ('top_up', 'lesson', 'refund', 'credit'));
