-- Contact details caught in the live classroom: said out loud (speech), drawn on the whiteboard (board) or
-- shown on a shared screen (screen). They are recorded like blocked messages and files, so they show in
-- Admin → Chat safety and count towards the automatic pause.
alter table public.contact_flags drop constraint if exists contact_flags_source_check;
alter table public.contact_flags add constraint contact_flags_source_check check (source in ('text', 'file', 'speech', 'board', 'screen'));
create index if not exists contact_flags_lesson on public.contact_flags (context_id, user_id) where channel = 'lesson';
