-- Tutor plans are edited in Admin → Plans & credits (saved in platform_settings under 'pricing'), and new
-- plans can be added, so a subscription can be on any plan id, not only 'free', 'pro' or 'premium'.
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan ~ '^[a-z0-9][a-z0-9_-]{1,39}$');
