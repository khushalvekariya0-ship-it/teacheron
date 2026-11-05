-- Live classroom: video, audio, screen share, chat pings and a shared whiteboard for online lessons,
-- through a LiveKit media server. One room per lesson ("lesson-<booking id>"). The tutor hosts;
-- the person who booked joins; staff with bookings.manage may join as host (audited); guests without
-- an account only through the tutor's guest link and only once the tutor admits them.
-- Everything here is written by the server only (RLS on, no policies, browser roles revoked).

-- The lesson's live state and what was kept from it.
create table if not exists public.class_sessions (
  booking_id   text primary key references public.bookings (id) on delete cascade,
  started_at   timestamptz,
  started_by   text,
  ended_at     timestamptz,                       -- the host pressed "End class": nobody can join again
  ended_by     text,
  guest_code   text check (guest_code is null or guest_code ~ '^[a-f0-9]{10}$'),  -- null = guest link off
  transcript   text,                              -- live captions, contact details masked
  summary      text,                              -- optional AI recap (only with GEMINI_API_KEY)
  summary_at   timestamptz,
  snapshots    jsonb not null default '[]',       -- [{ path, title, at }] in private-files/classroom/<booking>/
  updated_at   timestamptz not null default now()
);

-- Waiting-room knocks from the guest link. A guest gets a media token only after the host admits them.
create table if not exists public.class_guests (
  id          uuid primary key default gen_random_uuid(),
  booking_id  text not null references public.bookings (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  claim_hash  text not null unique,               -- SHA-256 of the secret only the guest's browser holds
  status      text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  decided_by  text,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists class_guests_booking on public.class_guests (booking_id, status, created_at);

-- Whiteboards the host saved and shared out of the lesson.
create table if not exists public.class_boards (
  id              uuid primary key default gen_random_uuid(),
  booking_id      text not null references public.bookings (id) on delete cascade,
  title           text not null default 'Class whiteboard' check (char_length(title) between 1 and 120),
  image_path      text not null,                  -- private-files/classroom/<booking>/…
  shared_by       text not null,
  shared_by_name  text not null default '',
  recipients      text[] not null default '{}',   -- participant identities; empty = the lesson's student
  created_at      timestamptz not null default now()
);
create index if not exists class_boards_booking on public.class_boards (booking_id, created_at desc);

-- The desktop snipping helper: a short-lived code (only the host can make one) lets it post images
-- to one lesson's board. Reading them back needs the host's own signed-in session.
create table if not exists public.board_push_codes (
  code        text primary key check (code ~ '^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$'),
  booking_id  text not null references public.bookings (id) on delete cascade,
  owner_id    text not null,
  used        integer not null default 0,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists board_push_codes_owner on public.board_push_codes (booking_id, owner_id, expires_at desc);

create table if not exists public.board_pushes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null references public.board_push_codes (code) on delete cascade,
  image_path  text not null,
  consumed    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists board_pushes_code on public.board_pushes (code, consumed, created_at);

alter table public.class_sessions enable row level security;
alter table public.class_guests enable row level security;
alter table public.class_boards enable row level security;
alter table public.board_push_codes enable row level security;
alter table public.board_pushes enable row level security;
revoke all on table public.class_sessions, public.class_guests, public.class_boards, public.board_push_codes, public.board_pushes from anon, authenticated;
