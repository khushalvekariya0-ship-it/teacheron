-- Contact details held up to the camera in the live classroom (source 'camera'), recorded like the
-- other class checks (speech, whiteboard, shared screen) in Admin → Chat safety.
alter table public.contact_flags drop constraint if exists contact_flags_source_check;
alter table public.contact_flags add constraint contact_flags_source_check check (source in ('text', 'file', 'speech', 'board', 'screen', 'camera'));
