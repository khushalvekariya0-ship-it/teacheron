-- Automatic lesson reminders: one the day before (for lessons booked more than a day ahead) and one
-- an hour before. Each is sent once; these columns remember that it went out.
alter table public.bookings add column if not exists reminded_24h_at timestamptz;
alter table public.bookings add column if not exists reminded_1h_at timestamptz;

-- The scheduler looks for upcoming lessons that still need a reminder.
create index if not exists bookings_reminders_due on public.bookings (start_utc)
  where status in ('confirmed', 'in_progress') and (reminded_24h_at is null or reminded_1h_at is null);
