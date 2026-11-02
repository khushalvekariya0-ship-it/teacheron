# Backend (Supabase + Next.js API)

How the live backend works. Setup steps for the site owner are in [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Pieces

| Piece | Where | Role |
|---|---|---|
| Postgres (Supabase) | `supabase/migrations/*.sql` | All data. Every table has RLS on with **no policies** and no grants to `anon`/`authenticated`, so the public API key can't read or write anything. |
| Supabase Auth | `src/app/api/auth/[op]`, `src/app/auth/{callback,confirm}` | Passwords, email confirmation, password reset, OAuth. Session lives in Supabase's cookies. Triggers on `auth.users` create/update/delete the `public.users` row (role whitelisted to student / parent / tutor). |
| Supabase Storage | `src/server/media.ts`, `POST /api/uploads`, `GET /api/files` | `public-media` (tutor photos, intro videos) and `private-files` (verification documents, message / homework / dispute / job attachments). Browsers upload with one-time signed URLs; private files open only through `/api/files`, which checks access. |
| Domain rules | `src/lib/domain/actions.ts` | Every business rule (bookings, refunds, messaging, moderation, catalog, content …) as pure functions over a `Data` object. |
| API | `src/app/api/{state,actions}` | `GET /api/state` returns what the viewer may see; `POST /api/actions` runs one action. |
| Browser store | `src/lib/store/index.ts` | Holds the viewer's state from `/api/state`; each action posts to `/api/actions` and applies the returned state. Only the compare tray is kept in `localStorage`. |

## A request, end to end

`POST /api/actions { action, args }` (`src/app/api/actions/route.ts`):

1. Same-origin check, rate limit (120/min per account), signed-in session (`src/server/session.ts` verifies the cookie with Supabase Auth on every call, and treats an account with two-step login as signed out until its session reaches `aal2`).
2. `parseArgs` — a zod schema per action (`src/server/schemas.ts`); unknown keys are dropped, so an object can't smuggle in `status`, `ownerId` and the like. Actions without a schema (the scheduler, consent) can't be called from the browser.
3. `prepareArgs` (`src/server/prepare.ts`) — stores a photo sent as a data URL in Storage, and checks that any file path belongs to the caller's own folder.
4. `runAction` (`src/server/engine.ts`) — a **unit of work** in a `SERIALIZABLE` transaction:
   - load the rows this action needs (`src/server/plan.ts`; usually the worlds of the people involved — their bookings, conversations, ledgers …),
   - run the domain action as the signed-in user,
   - diff every collection before/after and write only changed rows (parents first, deletes children first — `WRITE_ORDER` in `src/server/tables.ts`).
   A conflicting concurrent transaction (e.g. two people booking the last slot) makes Postgres abort one; it is retried against fresh rows. The `bookings_no_overlap` exclusion constraint and partial unique indexes back the rules up in the database itself.
5. The response carries the result and the viewer's refreshed state; public pages are revalidated when the action changes public content.
6. Notifications the action created are emailed after the response (`src/server/notify-email.ts`, via `after()`): only to active accounts with a confirmed email, only for groups switched on in their notification settings (account and security notices always), with one email per burst of chat messages.

## Who sees what (`src/server/snapshot.ts`)

- **Everyone:** tutors with an active account that staff haven't hidden, published reviews, published jobs, the catalog, flags, booking policy, published blog posts / FAQs / consented testimonials.
- **Signed in:** their own records; bookings, conversations (with messages) and learning records they take part in; other people only as `id, role, name, time zone` (no email, phone or address).
- **Staff:** queues their permissions cover (users, bookings, payments, disputes with internal notes, reports, all reviews, verification requests, audit log, coupons, drafts of content). Private messages are **not** included — `logConversationAccess` releases one conversation's messages after recording the reason in the audit log.
- Personal records (learning profile, drafts, preferences, favorites, saved items) are only ever sent to their owner — staff included.
- A tutor hidden by staff (`tutors.hidden`) stays visible only to staff, to the tutor, and to people who already have a booking or conversation with them; nobody new can book or message them.

## Adding an action

1. Write the rule in `src/lib/domain/actions.ts` (add it to `DomainActions`).
2. Add its loading plan in `src/server/plan.ts` — load every row the rule reads.
3. Add an argument schema in `src/server/schemas.ts` (without one, the browser can't call it).
4. Add its name to `ACTIONS` in `src/lib/store/index.ts` so the browser store gets a wrapper.
5. If it changes public pages, add it to `PUBLIC_CHANGES` in `src/app/api/actions/route.ts`.
6. New table? Add a migration in `supabase/migrations/`, a spec in `src/server/tables.ts` (and `WRITE_ORDER`), and decide its visibility in `snapshot.ts`.

## Accounts and roles

- Sign-up can only create student, parent or tutor accounts (database trigger). The first administrator is made with `npm run db:make-admin`; after that, administrators with `users.write` manage staff in Admin → Users (`setStaffAccess`; at least one administrator always keeps `users.write`).
- Two-step login (TOTP through Supabase Auth MFA) for staff: `POST /api/auth/mfa-enroll`, `mfa-verify`, `mfa-disable`, and `mfa-reset` (an administrator clears another staff member's factor). Sign-in returns `mfaRequired` when a verified factor exists; `/api/state`, `/api/actions` and `/api/files` treat that session as signed out until the code is entered. `db:make-admin -- email --reset-mfa` is the last-resort reset.
- Staff tools: edit account details, delete an account (removes the Supabase sign-in too), hide or feature a tutor, take down a job post, send an in-app announcement to a group. Each is an action with a permission check and an audit-log entry. Staff opening someone's private file is logged as `file.view`.
- Under-13s are refused; 13–17 students need a parent's approval through a one-time emailed link (`src/server/consent.ts`, `/consent?token=`; only a hash of the token is stored).
- Suspended accounts are signed out at sign-in and every action is refused.

## Email

`src/server/email.ts` sends through Resend's HTTP API (`RESEND_API_KEY`, `EMAIL_FROM`; `RESEND_API_URL` exists only for local testing). Supabase Auth sends its own sign-up and password emails (configure its SMTP).

## Scheduled work

`runScheduledJobs` (expire unanswered requests, auto-complete finished lessons) runs from `GET /api/cron` (with `Authorization: Bearer $CRON_SECRET`) and, as a fallback, at most every 5 minutes after a page load (`src/server/scheduler.ts`).

## Not connected yet

Payments (Stripe), tutor payouts, two-way classroom video and SMS. `env.paymentsEnabled` is `false`, so card / UPI charges, credit and plan purchases are refused with a clear message and free lessons still work.

## Testing

The backend was tested end to end against a real PostgreSQL 18 with the migrations applied, a stand-in for the Supabase Auth (including TOTP two-step login) and Storage HTTP APIs and for Resend, and a production build: sign-up and email confirmation (both link styles), onboarding with uploads, booking races, messaging with attachments and file access rules, admin moderation and content, staff management, two-step login, hiding tutors, job take-downs, announcements, no-show credit, notification emails and their settings, password reset and change, parental consent, the scheduler, account deletion, server-rendered pages, and that the `anon` role is denied on every table. Run `npm run db:status` / `GET /api/health` to check a real project.
