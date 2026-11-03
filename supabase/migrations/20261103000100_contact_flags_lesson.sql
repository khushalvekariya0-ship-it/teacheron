-- Chat safety: lesson notes and learning goals (tutor → student) are checked for contact details too,
-- so the moderation log gets a "lesson" channel.
alter table public.contact_flags drop constraint if exists contact_flags_channel_check;
alter table public.contact_flags add constraint contact_flags_channel_check check (channel in ('chat', 'homework', 'lesson', 'profile'));
