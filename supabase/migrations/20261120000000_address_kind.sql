-- Home and postal addresses are a kind of catch too ("Flat 302, Shanti Society, Pune 411001", "my address is …",
-- "mera ghar ka address"), in messages, files and class pictures. Only the allowed list of kinds changes;
-- nothing existing is changed or removed.
--
-- Rollback (only while no catch has the kind 'address'):
--   alter table public.contact_flags drop constraint if exists contact_flags_kinds_check;
--   alter table public.contact_flags add constraint contact_flags_kinds_check check (kinds <@ array['phone', 'email', 'social', 'link', 'request']::text[]);

alter table public.contact_flags drop constraint if exists contact_flags_kinds_check;
alter table public.contact_flags add constraint contact_flags_kinds_check check (kinds <@ array['phone', 'email', 'social', 'link', 'request', 'address']::text[]);
