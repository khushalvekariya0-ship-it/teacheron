-- Hourly rates are in each tutor's own currency since 20261106000000_payments_currencies.sql, and the site
-- checks the range per currency (₹100–₹20,000, $15–$500 …: rateLimits in src/lib/money.ts). The original
-- limits were in US cents (1,500–50,000), which refused anything above ₹500 an hour. The database now only
-- keeps the numbers sane.
alter table public.tutors drop constraint if exists tutors_hourly_rate_cents_check;
alter table public.tutors add constraint tutors_hourly_rate_cents_check check (hourly_rate_cents between 100 and 10000000);

alter table public.applications drop constraint if exists applications_proposed_rate_cents_check;
alter table public.applications add constraint applications_proposed_rate_cents_check check (proposed_rate_cents between 100 and 10000000);
