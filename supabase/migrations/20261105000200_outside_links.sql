-- Chat safety: links to outside documents, forms, file-sharing and paste sites and link shorteners are
-- stopped too (they can hide contact details out of sight). Blocked attempts are logged as kind 'link'.
alter table public.contact_flags drop constraint if exists contact_flags_kinds_check;
alter table public.contact_flags add constraint contact_flags_kinds_check check (kinds <@ array['phone', 'email', 'social', 'link']::text[]);
