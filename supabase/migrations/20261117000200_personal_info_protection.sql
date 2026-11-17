-- Personal information protection in lessons and messages:
--   * a contact *request* ("send me your number", "બહાર વાત કરીએ") is a kind of catch;
--   * how a catch was found (built-in rules, OCR, a QR code, Gemini, speech) for the admin reports;
--   * a blocked file's fingerprint (SHA-256), so a file staff approve after an appeal can be sent again;
--   * temporary class restrictions (a person's audio not reaching the others for a few minutes);
--   * appeals against a catch or a restriction, decided by staff.
-- Nothing existing is changed or removed. New tables follow the project rule: RLS on, no policies, only the
-- server (service role) reads and writes them.

alter table public.contact_flags drop constraint if exists contact_flags_kinds_check;
alter table public.contact_flags add constraint contact_flags_kinds_check check (kinds <@ array['phone', 'email', 'social', 'link', 'request']::text[]);
alter table public.contact_flags add column if not exists detector text check (detector in ('rules', 'ocr', 'qr', 'ai', 'speech'));
alter table public.contact_flags add column if not exists file_hash text check (file_hash ~ '^[0-9a-f]{64}$');
create index if not exists contact_flags_file_hash on public.contact_flags (file_hash) where file_hash is not null;

create table if not exists public.class_restrictions (
  id         text primary key,
  booking_id text not null references public.bookings (id) on delete cascade,
  user_id    text not null references public.users (id) on delete cascade,
  kind       text not null default 'audio' check (kind in ('audio')),
  reason     text not null default '' check (length(reason) <= 300),
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz not null,
  lifted_at  timestamptz,
  lifted_by  text check (length(lifted_by) <= 80),       -- 'system' or the staff account that lifted it
  created_at timestamptz not null default now()
);
create index if not exists class_restrictions_active on public.class_restrictions (booking_id, user_id) where lifted_at is null;
create index if not exists class_restrictions_user on public.class_restrictions (user_id, created_at desc);
alter table public.class_restrictions enable row level security;
revoke all on table public.class_restrictions from anon, authenticated;

create table if not exists public.safety_appeals (
  id             text primary key,
  user_id        text not null references public.users (id) on delete cascade,
  flag_id        text references public.contact_flags (id) on delete set null,
  restriction_id text references public.class_restrictions (id) on delete set null,
  note           text not null default '' check (length(note) <= 1000),
  status         text not null default 'open' check (status in ('open', 'accepted', 'rejected')),
  decided_by     text,
  decided_at     timestamptz,
  decision_note  text check (length(decision_note) <= 500),
  created_at     timestamptz not null default now()
);
create index if not exists safety_appeals_open on public.safety_appeals (created_at desc) where status = 'open';
create index if not exists safety_appeals_user on public.safety_appeals (user_id, created_at desc);
alter table public.safety_appeals enable row level security;
revoke all on table public.safety_appeals from anon, authenticated;
