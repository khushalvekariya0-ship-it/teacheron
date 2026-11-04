-- Zoom / Google Meet for online lessons: the tutor pastes the meeting's invite link (and passcode) on a
-- lesson, and later a recording link. Only the lesson's student/parent, its tutor and staff who manage
-- bookings can read them (bookings already have Row Level Security on and no client access).
alter table public.bookings add column if not exists video_link text;
alter table public.bookings add column if not exists video_passcode text;
alter table public.bookings add column if not exists recording_url text;

alter table public.bookings drop constraint if exists bookings_video_link;
alter table public.bookings add constraint bookings_video_link check (
  video_link is null or video_link ~ '^https://([a-z0-9-]+\.)*(zoom\.us|zoom\.com)/(j|my)/[A-Za-z0-9.]+(\?pwd=[A-Za-z0-9._-]+)?$' or video_link ~ '^https://meet\.google\.com/[a-z]{3}-[a-z]{4}-[a-z]{3}$'
);
alter table public.bookings drop constraint if exists bookings_video_passcode;
alter table public.bookings add constraint bookings_video_passcode check (video_passcode is null or video_passcode ~ '^[A-Za-z0-9@*_-]{1,10}$');
alter table public.bookings drop constraint if exists bookings_recording_url;
alter table public.bookings add constraint bookings_recording_url check (
  recording_url is null or recording_url ~ '^https://([a-z0-9-]+\.)*(zoom\.us|zoom\.com)/rec/(share|play)/' or recording_url ~ '^https://drive\.google\.com/file/d/'
);
