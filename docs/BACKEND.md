# Backend (Supabase + Next.js API)

How the live backend works. Setup steps for the site owner are in [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Pieces

| Piece | Where | Role |
|---|---|---|
| Postgres (Supabase) | `supabase/migrations/*.sql` | All data. Every table has RLS on with **no policies** and no grants to `anon`/`authenticated`, so the public API key can't read or write anything. |
| Supabase Auth | `src/app/api/auth/[op]`, `src/app/auth/{callback,confirm}` | Passwords, email confirmation, password reset, Google / Facebook / Apple sign-in. Session lives in Supabase's cookies. Triggers on `auth.users` create/update/delete the `public.users` row (role whitelisted to student / parent / tutor). |
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
- While `env.paymentsEnabled` is false, trial prices are sent as 0 to everyone except staff and the tutor themselves (who see the tutor's own price), so cards, profiles and the booking form all say "Free".

## Adding an action

1. Write the rule in `src/lib/domain/actions.ts` (add it to `DomainActions`).
2. Add its loading plan in `src/server/plan.ts` — load every row the rule reads.
3. Add an argument schema in `src/server/schemas.ts` (without one, the browser can't call it).
4. Add its name to `ACTIONS` in `src/lib/store/index.ts` so the browser store gets a wrapper.
5. If it changes public pages, add it to `PUBLIC_CHANGES` in `src/app/api/actions/route.ts`.
6. New table? Add a migration in `supabase/migrations/`, a spec in `src/server/tables.ts` (and `WRITE_ORDER`), and decide its visibility in `snapshot.ts`.

## Accounts and roles

- Sign-up can only create student, parent or tutor accounts (database trigger). The first administrator is made with `npm run db:make-admin`; after that, administrators with `users.write` manage staff in Admin → Users (`setStaffAccess`; at least one administrator always keeps `users.write`).
- Two-step login (TOTP through Supabase Auth MFA) for every account (Settings → Security; staff in Admin → Security): `POST /api/auth/mfa-enroll`, `mfa-verify`, `mfa-disable`, and `mfa-reset` (an administrator with `users.write` clears another account's factor). Sign-in, and Google / Facebook / Apple sign-in (the callback sends the browser to `/login` for the code), return `mfaRequired` when a verified factor exists; `/api/state`, `/api/actions` and `/api/files` treat that session as signed out until the code is entered. `db:make-admin -- email --reset-mfa` is the last-resort reset.
- **Backup codes** (migration `20261105000300_account_security.sql`, `src/server/account-security.ts`): finishing two-step setup answers with 10 single-use codes (`xxxxx-xxxxx`, ~50 bits each), shown once; only SHA-256 fingerprints are kept in `mfa_recovery_codes`. `mfa-new-codes { code }` replaces them (needs the app's code). On the code step after the password, `mfa-recover { code }` (5 tries per 15 minutes) uses one: it removes the account's factors, deletes the remaining codes, turns the flag off, audits `security.mfa_recovered` and notifies the owner, so they can set it up on a new phone.
- **Password**: `POST /api/auth/password { current?, next }`. With a password, `current` is checked with a separate, throw-away Supabase sign-in (the browser's session, which may be `aal2`, isn't replaced); an account made with Google / Facebook / Apple (no password in `auth.users.encrypted_password`) sets its first one without `current`. Afterwards the other sessions are signed out (`scope: "others"`), it's audited, and a "password was changed / added" email goes out.
- **Sign-in email**: `POST /api/auth/change-email { email, password? }` checks the password (when the account has one) and that no other account uses the address, then emails an `add_email` code to the new address; `change-email-verify { code }` sets it through `auth.admin.updateUserById` (confirmed), audits `security.email_changed` and emails the old address (with the new one masked).
- **Ways to sign in**: `GET /api/auth/methods` lists the password, the connected Google / Facebook / Apple identities, the switched-on providers, two-step login and backup codes left. `POST /api/auth/unlink { identityId }` disconnects one only while another way in remains (another provider, or a confirmed email with a password; Supabase also keeps at least one identity) and removes it from `trusted_identities`. `GET /api/auth/oauth?provider=&link=1` (signed in, not from another site) connects one with `linkIdentity` (Supabase: "Allow manual linking"); the `tl_oauth` cookie then carries `link:<provider>:<account id>`, and the callback trusts the new identity straight away only when it came back to that same account (no email code), audits and notifies. Errors return to `/dashboard/settings?tab=security&linkError=taken|cancelled|disabled|failed`. Security notices link to Settings → Security (staff: Admin → Security).
- Staff tools: edit account details, delete an account (removes the Supabase sign-in too), hide or feature a tutor, take down a job post, send an in-app announcement to a group. Each is an action with a permission check and an audit-log entry. Staff opening someone's private file is logged as `file.view`.
- Under-13s are refused; 13–17 students need a parent's approval through a one-time emailed link (`src/server/consent.ts`, `/consent?token=`; only a hash of the token is stored).
- Suspended accounts are signed out at sign-in and every action is refused.

## Locations in any country

Accounts, tutor profiles and job posts have a `country` (ISO code; empty = US; migration `20261104000500_countries.sql`). `state` is the 2-letter code in the US and the state/province name elsewhere. Countries and their states/provinces come from `country-region-data` 4.1.0 (MIT, `src/lib/data/countries.ts`, `regions.json`, `regions.LICENSE.txt`; the regions load only when a form needs them). Postal codes are checked per country (`src/lib/postal.ts`: 5-digit US ZIP, 6-digit Indian PIN, UK/Canada formats, any 3–10 letters/digits elsewhere; required only for the US and India). One component, `LocationFields`, is used by sign-up (country + code), tutor setup, the student profile, Settings and job posts; staff edit the same fields in Admin → Users. `GET /api/geo` (free services, no key): Photon/OpenStreetMap for city and address search worldwide, India Post for Indian PIN codes (city → PINs, PIN → city), Zippopotam.us for US ZIP codes and other countries' codes. Picking a city fills its state and, when known, its postal code (several → a list to choose from); typing a postal code first fills the city and state. Distance for in-person matching still uses US ZIP codes only (tutors outside the US are saved at 0,0, so distance isn't scored for them).

## Live classroom (LiveKit)

`/classroom/<booking>` is the live room for an online lesson (`src/components/classroom/live/*`;
server rules `src/server/classroom.ts`, media server calls `src/server/livekit.ts`, shared window
rules `src/lib/classroom.ts`; migration `20261105000000_live_classroom.sql`). Set up with
`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL` (optional `LIVEKIT_HOST_URL`,
`GEMINI_API_KEY`); without them the basic classroom is shown. Lessons with a Zoom / Meet link keep that
(only while the `outside_meeting_links` switch is on, see below).

| API (`/api/classroom/<op>`) | Who | What |
|---|---|---|
| `GET info?id=` | participants | room state, `ready`, window (open 15 min before → 30 min after the end, or until ended), guest link for the host |
| `GET join?id=` | tutor (host), booker, staff with `bookings.manage` (host, audited) | a LiveKit token for `lesson-<id>`, only inside the window; host-ness, role and name are in the signed metadata; marks the class started |
| `POST end` | host | `class_sessions.ended_at`, closes the room (everyone disconnected); nobody can join again |
| `POST guest-link`, `GET guests`, `POST decide` | host | guest link on / off / new code (10 hex); people waiting; admit / deny (audited) |
| `POST knock`, `GET guest?claim=` | guest (no account) | ask with a name (contact details refused) → a claim secret (only its SHA-256 is stored); polling returns a token only once admitted, only inside the window |
| `POST board-image` | host | a whiteboard picture (≤ 6 MB) is read for contact details (OCR, `checkImageBytes`), stored in `private-files/classroom/<booking>/`, and returned as a signed link that lasts until the room closes |
| `POST share-board`, `GET boards`, `POST delete-board` | host / participants | the flattened board saved for the lesson page (checked the same way); the student is notified |
| `POST push-code`, `GET helper?code=`, `POST push`, `GET push?code=` | host / the helper | the desktop snipping helper: a 12-hour room code (`XXXX-XXXX`, max 400 images) lets a PowerShell script post clipboard images; reading them back needs the host's own session |
| `POST transcript`, `GET recap`, `POST delete-recap` | host / participants | captions saved with contact details masked; snapshots (≤ 20) checked and stored after the answer; optional Gemini recap |
| `POST safety` | tutor, booker, admitted guests | `{ id, source: speech / board / screen / camera, kinds?, excerpt?, image?, guest? }`: contact details said out loud (found by the person's own device; only the masked words are sent) or a picture of their whiteboard drawing / shared screen / camera (read here with OCR, English + Gujarati + Hindi). A guest sends their claim as `guest` and gets the guest rules (below). Returns `{ found, kinds, strikes, removed }`. Rate-limited (speech 30, pictures 150 per 10 min) |
| `POST report` | tutor, booker | `{ id, reason: asked_contact / shared_contact / pay_outside / other, details? }` → a `reports` row about the other side of the lesson (details masked), moderators alerted. 5 per 10 min |

In the room, strokes, image moves, drawing rights and "new chat message" pings travel over LiveKit's
data channel; every receiver checks them (only the host may clear, undo, grant or post images; image
addresses must be this project's signed classroom files; text with contact details is dropped). Chat
messages themselves go through the normal moderated inbox. Blocked images are recorded in
`contact_flags` (channel `lesson`). The scheduler closes rooms whose window is over.

### Personal information protection (messages, files and the live class)

Phone numbers, emails, social media / messaging / payment handles, and **requests to talk, meet or pay
outside TutorLink** are kept out of messages, files and lessons. One set of rules (`src/lib/domain/contact.ts`)
runs on the server for every message and file, in the browser for the typing warning and speech, and is
configured in **Admin → Chat safety → Settings** (`platform_settings` key `contact_safety`,
`src/lib/safety-settings.ts`; the server applies them in `Loader.globals()` and, for the class and file
checks, through `src/server/safety-settings.ts`, at most 30 s old; saving clears it on that server).
Migrations: `20261117000000_live_class_safety.sql`, `20261117000100_class_camera_check.sql`,
`20261117000200_personal_info_protection.sql` (kind `request`, `contact_flags.detector` and `file_hash`,
tables `class_restrictions` and `safety_appeals`, RLS on with no policies).

**Rules** (`scanContact`, chat and file modes; tests in the harness `contact-cases.mjs`):
- Numbers in any format (spaces, hyphens, country codes, words, other scripts' digits), disguised emails,
  handles and app links; numbers or emails sent a piece at a time (`scanSplitMessages`).
- Requests (`findRequests`, kind `request`, chat mode only): English, Gujarati and Hindi script, and
  Gujarati / Hindi typed in English letters ("send me your number", "call me after class", "let's talk on
  WhatsApp", "મારો નંબર લઈ લો", "બહાર વાત કરીએ", "whatsapp karjo"), paying outside ("pay me on GPay"),
  plus the admin's own phrases. Phrases the admin marks as fine are never a request or an app mention.
- App names alone ("WhatsApp was bought by Facebook") count only with sensitivity **strict**; normally they
  need a handle or number next to them, or a request.
- Messages show the warning while typing (`ContactHint`, a hint only); the server blocks on Send and
  records the attempt (5 in an hour pause messaging for an hour, as before). The "Not sent" box has
  **Ask for a review** (`appealContactFlag`).

**Files** (`src/server/scan.ts`): images (OCR), **QR codes** (jsQR: phone, email, WhatsApp / Telegram /
social links, contact cards, UPI payment codes; `detector = 'qr'`), PDF (text, links, form fields, scanned
pages by OCR), Word (.docx, with pictures), text. A blocked file's SHA-256 is kept (never the file); when
staff accept its appeal (`decideAppeal`: the catch becomes `dismissed`), the same file can be sent again.
Switches: pictures, documents, QR.

**Live class** (`src/components/classroom/live/LessonSafety.tsx`, `caughtInClass` in `src/server/classroom.ts`):
- **Speech**: read on each person's own device by a free speech reader (`deviceSpeech.ts`, Vosk; the voice
  never leaves the device; phones too), or, where that's switched off or can't run, the browser's own
  recognition on computers (Chrome / Edge send the audio to Google / Microsoft). One sentence, or the
  last minute's sentences when one of them says it's a way to reach someone (`speechContact`,
  `speechSplitContact`, `speechEarlyContact` while it's still being said); digits and number words in any
  script, Hindi / Gujarati numbers 11–99 (numbers read in pairs) and English digits written in their letters.
  The host sets the **class language** (data topic `class-lang`, accepted only from the host's signed
  metadata): Hindi and Gujarati classes use the Hindi model (Gujarati numbers sound almost the same; Vosk's
  Gujarati model is 347 MB unpacked, too heavy), others English (India). Only masked words are sent.
- **First class on a device**: where nothing else can check while the reader downloads (phones, Safari,
  Firefox), the microphone stays off until it's ready and then turns on by itself (`holding`). Guests'
  devices download it while they wait to be let in.
- **Guests** (no account) are checked like everyone else: their page sends its claim with each check, and
  the tutor's device reads their voice too. One warning: the first catch turns their microphone (said) or
  camera (shown) off for the rest of the class (LiveKit; a rejoin gets a pass without it); the second
  removes them (`class_guests.status = 'denied'`). The step is kept on the guest row (`decided_by =
  'safety:<source>'`), each catch is in the audit log (`classroom.guest_caught` / `guest_removed`) and staff
  are alerted; nothing goes into `contact_flags` (catches belong to accounts). A guest's own device doesn't
  read the others.
- **Whiteboard** (own new strokes every 15 s; removed for everyone), **shared screen** (every 12 s when it
  changed; the share stops), **camera** (every 20 s when the picture changed by 4%; the camera is turned
  off). Pictures go through the same reader (OCR + QR, and Gemini when switched on and `GEMINI_API_KEY` is
  set: it only copies out the text; TutorLink's rules decide; either reader counts).
- A **"Protected"** status in the class top bar says what is checked for this person and why speech
  isn't (`data-safety-status`: device, starting, holding, on, mic-off, phone, unsupported, blocked, off, muted).
- **The ladder** (settings, per lesson; dismissed catches don't count): a warning; from `strongWarningAt`
  (2) a stronger one and moderators are told; from `muteAt` (3) the person's **audio is paused** for the
  others for `muteMinutes` (10): a `class_restrictions` row, LiveKit `updateParticipant` without the
  microphone (`setAudioAllowed`; the capture itself isn't touched), and a rejoin gets a pass without it
  (`audioPausedUntil` in the ticket). Speech isn't counted while paused. The person's page ends the pause
  when the time is up (`POST /api/classroom/unpause`, checked against the time), the scheduler as a
  fallback (`liftExpiredRestrictions`); staff **Restore audio now** (`POST /api/classroom/lift`,
  reports.moderate, audited). **Ask for a review** in the class (`POST /api/classroom/appeal`).
  Removal (`removeAt`) and pausing the account (`pauseAccountAfterRemovals`) are **off by default**.
- The person's own page shows the warning from the server's answer and tells the room about itself (a
  data packet receivers accept only from the person it names, using the identity from the join ticket);
  the server also tells the room through LiveKit after answering (`after()`, 20 s and one retry).

**Admin → Chat safety**: Overview (totals for students/parents and tutors, chat, voice, pictures, documents,
class pictures, QR codes, requests, audio pauses; day by day; lessons with the most catches; repeated
offenders; by period), People, All attempts, Class restrictions (restore audio now), Appeals (accept /
reject), Reported messages, Settings (switches, ladder, phrases, retention; settings.manage). Only
masked notes are shown or stored; never the number, the email, the audio or the file.

**Retention**: the scheduler deletes reviewed catches, ended restrictions and decided appeals older than
`retentionDays` (180) (`forgetOldSafetyRecords`).

**Not covered**: a number said without any "my number / WhatsApp / call me" word when the reader mishears a
digit; small or unclear writing; code words; anything when two people agree to swap details outside. Server-side
listening (every lesson's audio through our own speech service) would cover phones and stop words before
the other person hears them, but delays everyone's audio, needs an always-on server and a strong machine
for free speech models, and sends all lesson audio through TutorLink; it isn't built.

## Zoom / Google Meet on online lessons

Off by default: the feature flag `outside_meeting_links` (Admin → Feature flags, "Zoom / Google Meet links") is off, so every online lesson uses the TutorLink classroom, where contact details are checked. While it's off, `setLessonVideo` is refused, the lesson page has no link form, and `snapshot.ts` doesn't send saved `videoLink` / `videoPasscode` (they stay in the database and come back if the flag is turned on). With it on:

Online lessons open the TutorLink classroom by default. A tutor who teaches on Zoom (or Google Meet) creates the meeting in their own account and pastes its invite link on the lesson page ("Add Zoom or Google Meet link"); staff with `bookings.manage` can do the same from Admin → Bookings (audited). Actions: `setLessonVideo(bookingId, { link, passcode?, applyToUpcoming? })`, `removeLessonVideo(bookingId)`, `setLessonRecording(bookingId, link)` (Zoom cloud recording or Google Drive, once the lesson has started). `src/lib/video-link.ts` accepts only https Zoom (`/j/<id>`, `/my/<name>`) and Google Meet (`abc-defg-hij`) links, keeps only the `pwd` token, and refuses Zoom start links (`/s/…`, which carry host access); passcodes are up to 10 characters and refused if they look like a phone number. The database checks the same shapes (`bookings.video_link`, `video_passcode`, `recording_url`; migration `20261104000400_lesson_video_links.sql`). Links live on the booking, so only its student or parent, its tutor and booking staff receive them. The student or parent is notified when a link or recording is added. "Join Zoom" appears on the lesson page and in the classroom from confirmation until the lesson ends, and on lesson lists, the calendar and dashboards inside the usual join window. A rescheduled lesson keeps its link; "use this link for my other upcoming lessons" copies it to the tutor's upcoming online lessons that have none. Free Zoom accounts end meetings after 40 minutes.

## Email codes (OTP)

All one-time codes are 6 digits, live in `public.email_codes` (`src/server/email-codes.ts`) and are kept apart by `purpose`: `verify_email` (first-time email check after sign-up), `password_reset` (Forgot password; `reset_id` points at the reset link it unlocks), `link_account` (confirming a Google / Facebook / Apple sign-in on an existing account) and `add_email` (an account without an email adds one; `target_email` holds the address). The purpose is part of the stored SHA-256 fingerprint and of every lookup, so a code made for one purpose is refused for the other. A newer code cancels older ones of the same purpose; codes expire after 15 minutes, work once, and the 5th wrong try cancels a code. Migration: `20261104000200_email_codes.sql` (it also moved reset codes out of `password_resets`).

## First-time email verification

With the site's own email set up (`emailReady()`), sign-up doesn't use Supabase's confirmation email (`src/server/email-verification.ts`):

| Step | API | What happens |
|---|---|---|
| Sign up | `POST /api/auth/sign-up` | Creates the account unconfirmed with `auth.admin.createUser` (Supabase sends nothing) and emails a `verify_email` code; answers `{ needsConfirmation: true, verifyBy: "code" }`. Signing up again before confirming just sends a new code; a confirmed email gets 409 as before. |
| Type the code | `POST /api/auth/verify-email { email, code }` | Checks the code on the server and only then confirms the email (`auth.admin.updateUserById(id, { email_confirm: true })`; the trigger sets `users.email_verified`). It doesn't sign in. Every failure gives the same answer; 10 tries per 15 minutes per IP. |
| New code | `POST /api/auth/resend { email }` | A new code (at most 5 an hour per account); same answer for every address. |
| Sign in | `POST /api/auth/sign-in` | Refused with `code: "email_not_confirmed"` until the email is confirmed, even if Supabase's own "Confirm email" setting is off. After confirming, the usual sign-in runs, including two-step login for staff. |

Pages: the sign-up page shows the code box right after "Create account" and then signs in and continues to setup; the log-in page asks for the code when an unconfirmed account signs in, then finishes the sign-in; `/verify-email` takes an email and its code. Without the site's own email, sign-up still uses Supabase's confirmation link (`verifyBy: "link"`, `/auth/callback`, `/auth/confirm`).

## Password reset

The site runs password reset itself (`src/server/password-reset.ts`); Supabase's own reset email isn't used. The same flow serves students, parents, tutors and staff, from the one login page (`/login` → "Forgot your password?").

| Step | API | What happens |
|---|---|---|
| Ask for an email | `POST /api/auth/forgot { email }` | Always the same answer (`{ ok, minutes: 15 }`), so it can't reveal who has an account. For an active account it emails a 6-digit code and a link `https://<site>/reset-password?token=…` (32 random bytes). Only SHA-256 fingerprints of the token (`password_resets`) and code (`email_codes`, purpose `password_reset`) are stored, with a 15-minute expiry. A newer email cancels older ones. Sent after the answer (`after()`). |
| Type the code | `POST /api/auth/reset-code { email, code }` | Swaps a correct code for a fresh link token (the emailed link stops working). Every failure gives the same answer; the 5th wrong code cancels that email. |
| Open the link | `POST /api/auth/reset-check { token }` | `valid`, `expired`, `used`, `replaced` (a newer email was sent) or `invalid`. The page then removes the token from the address bar. |
| Save | `POST /api/auth/reset { token, password }` | Locks the row, sets the password through Supabase Auth (`auth.admin.updateUserById`, which hashes it with bcrypt), marks the link used, deletes every session of the account, and emails "your password was changed". It never signs anyone in: they sign in with the new password, and staff with two-step login still have to enter their authenticator code. |

Limits: 5 `forgot` requests per 15 minutes per IP, 3 reset emails per hour per address (and per account in the database), 10 code tries and 30 link checks per 15 minutes per IP, 10 saves per 15 minutes per IP. Links are built only from `NEXT_PUBLIC_SITE_URL`, never from the request's Host header, and must be `https://` (plain `http://` only for `localhost`); otherwise no reset email is sent. An address with no account gets a "no TutorLink account for this email" note and a suspended account a "can't be reset" note (no code; at most 50 such notes an hour site-wide). Server logs show each step with the account id only (no email address, link or code). Migrations: `20261104000000_password_resets.sql`, `20261104000100_password_reset_codes.sql`, `20261104000200_email_codes.sql`.

Pages: `/forgot-password` (`ForgotPasswordView`: email, then the code box), `/reset-password` (`ResetPasswordView`: new password + confirm), and `/login?reset=done` shows "Your password was changed".

## Google / Facebook / Apple sign-in

Supabase Auth runs the OAuth 2.0 / OpenID Connect flow (PKCE, `state`, the provider's token and
`id_token` checks); provider client IDs and secrets live only in the Supabase dashboard (setup:
`SUPABASE_SETUP.md` step 8). The site adds account rules on top (`src/server/social.ts`, migration
`20261104000600_social_sign_in.sql`):

| Step | Where | What happens |
|---|---|---|
| Start | `GET /api/auth/oauth?provider=&next=&role=` | Only providers switched on in Supabase (`GET /api/auth/providers`, which reads Supabase's `/auth/v1/settings`); 20 starts per 10 minutes per IP. `signInWithOAuth` stores the PKCE verifier in an HTTP-only cookie; a short-lived HTTP-only `tl_oauth` cookie (path `/auth/callback`, SameSite=Lax, 10 minutes) carries the sign-up role hint and `next`. |
| Return | `GET /auth/callback` | `exchangeCodeForSession` (a code works once, only with the verifier cookie from the same browser). Provider errors map to `/login?error=cancelled|expired|no_email|account_exists|provider`. Suspended accounts are signed out. |
| New person | `/welcome`, `POST /api/auth/complete-signup` | The database trigger creates `public.users` with `needs_role = true` (no role in the sign-up metadata). Until `complete-signup` runs, `/api/state` returns no data and `/api/actions` answers 403 `{ needsRole }`. It takes role (student / parent / tutor), age band, parent email, country, ZIP/PIN and `terms: true`; same rules as a password sign-up (under 13: the sign-in is deleted; 13–17: parent approval email). It works once: afterwards the role can't change. |
| Connect while signed in | Settings → Security, `GET /api/auth/oauth?provider=&link=1` | See "Ways to sign in" under Accounts and roles: trusted straight away because the signed-in owner started it. |
| Same email as an existing account | `/login?link=1`, `POST /api/auth/link-verify | link-resend | link-cancel` | Supabase attaches a provider identity with a *verified* email to the account with that email (an unverified one is refused, so no duplicate account is made). The site then sets `users.pending_link` and emails a `link_account` code to the account's address; meanwhile the session counts as signed out (`/api/state` returns `linkRequired: { provider, email (masked) }`, actions 401, password sign-in also returns `linkRequired`). The right code adds the identity id to `users.trusted_identities`, records the login, notifies the owner and continues (two-step login still applies to staff). `link-cancel` ("This wasn't me") unlinks that identity and signs out. Accounts whose email was never confirmed are cleaned by Supabase itself: it removes their unconfirmed password and identities before linking. |
| No email from the provider | `/welcome`, `POST /api/auth/add-email`, `add-email-verify` | The account has `email = ''` (the unique index ignores empty emails). It must add an email that no other account uses and confirm it with an `add_email` code (5 per hour) before choosing a role. Apple private-relay addresses are normal emails. |

Supabase's session cookies are always set HTTP-only, SameSite=Lax, and Secure on https
(`src/server/supabase.ts`). Logs show account ids and providers only, never tokens or codes.

## Email

`src/server/email.ts` sends through an SMTP mailbox (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, e.g. Gmail with an app password) when set, otherwise through Resend's HTTP API (`RESEND_API_KEY`; `RESEND_API_URL` exists only for local testing), from `EMAIL_FROM`. `npm run email:check` tests the login. With it set up, Supabase Auth sends no emails; without it, Supabase sends the sign-up confirmation links (configure its SMTP).

## Scheduled work

`runScheduledJobs` runs from `GET /api/cron` (with `Authorization: Bearer $CRON_SECRET`; in production the database calls it every 10 minutes through pg_cron + pg_net, set up by `scripts/setup-scheduler.mjs`, with the address and secret in Supabase Vault) and, as a fallback, at most every 5 minutes after a page load (`src/server/scheduler.ts`). It:
- expires unanswered requests and auto-completes finished lessons;
- sends **lesson reminders** to the family and the tutor (in-app, and by email per their "Reminders" setting): the day before, only for lessons booked more than a day ahead, and an hour before ("starts in N minutes" when closer). `bookings.reminded_24h_at` / `reminded_1h_at` make each go out once (migration `20261105000100_lesson_reminders.sql`);
- closes live classrooms whose window is over;
- gives tutors outside the US map coordinates if that failed when they saved their city (5 per run).

## Places outside the US

Distance ("tutors near me", in-person filters) needs coordinates. US ZIP codes and cities resolve offline (`src/lib/data/geo.ts`). Elsewhere, `src/server/geocode.ts` asks Photon (OpenStreetMap; only the place name is sent): a tutor outside the US gets their city's coordinates after `submitOnboarding` / `updateTutorProfile` (after the answer, so saves stay fast), and the search box turns a place it doesn't know ("Rajkot") into a point through `GET /api/geo?kind=point&q=`, kept in the search as `@lat,lng|label`. Phone numbers are checked and formatted for the chosen country with libphonenumber-js (`src/lib/phone.ts`); time zones come from the runtime's full IANA list (`src/lib/timezones.ts`).

## Security headers

`next.config.ts` sends on every response: `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`, a `Permissions-Policy` allowing camera, microphone, screen capture, location and clipboard for this site only, and no `X-Powered-By`. Scripts aren't restricted by CSP (Next.js, Supabase and LiveKit would need nonces).

## "Something new" counts on the sidebar

Every notification links to the page it's about, so it counts on the sidebar item that page belongs to (`src/lib/nav-sections.ts`: `notePath` drops the query and maps `/tutor-jobs/…` to Student jobs; `inSection` matches an item and its sub-pages, the overview pages only themselves). `Shell.tsx` shows the counts (Messages adds unread messages; Notifications keeps the total), a dot on the phone menu button, and a dot on the public phone bar's Lessons / Account tabs. Opening an item runs `markSectionRead(item)` for that section only; the links that were unread stay marked "New" on the page (`src/components/dashboard/fresh-links.ts`; booking rows, Admin → Bookings, Admin → Chat safety) until the person opens another item. Pages refresh every 30 s (and on focus), so a count appears within about half a minute.

Staff get notifications of type `staff` for their own sections, only with the matching permission, in-app only (`notify-email.ts` never emails them):

| Event | Permission | Link |
|---|---|---|
| new booking or request (`createBooking`) | `bookings.manage` | `/admin/bookings?id=<booking>` |
| contact details stopped (chat, homework, notes, files; in class: speech, whiteboard, screen, board pictures) | `reports.moderate` | `/admin/chat-safety?user=<person>`, one unread alert per person (a repeat refreshes it) |
| report (`report`; class reports also email) | `reports.moderate` | `/admin/reports?id=<report>` |
| dispute opened | `disputes.manage` | `/admin/disputes/<id>` |
| verification sent (and the ID at tutor sign-up) | `tutors.verify` | `/admin/verification?id=<request>` |
| tutor profile finished | `users.read` | `/admin/tutors?id=<tutor>` |
| job post published (first time) | `users.read` | `/admin/requirements?id=<requirement>` |
| review posted | `reports.moderate` | `/admin/reviews?id=<review>` |
| sign-up (email, or role chosen after Google / Facebook / Apple) | `users.read` | `/admin/users?id=<user>` |

Actions call `notifyStaff` (their plans load the staff with `staffFor` in `plan.ts`); the server-side events (sign-up, live class) use `alertStaff` in `src/server/staff-alerts.ts`. No database change: `notifications.type` has no fixed list.

## Chat safety: outside links

Besides phone numbers, emails and other apps (`src/lib/domain/contact.ts`), links to outside documents, forms, file-sharing and paste sites and link shorteners (Google Docs/Drive/Forms, Dropbox, OneDrive, Notion, Pastebin, bit.ly…) are stopped as kind `link`: they can hide contact details out of sight. Learning links (YouTube, Khan Academy, Wikipedia, Desmos) and meeting links stay allowed; documents can be attached instead (attachments are read). Blocked links are logged in `contact_flags` like other attempts (migration `20261105000200_outside_links.sql`).

## Money, currencies and Razorpay

- **Currencies** (`src/lib/money.ts`, migration `20261106000000_payments_currencies.sql`): amounts are integers in the currency's minor unit. `tutors.currency` is set from the tutor's country at onboarding (existing tutors stay `USD`; a tutor can switch in their pricing, re-entering the rate). A booking copies it (`bookings.currency`) and its payments, refunds, wallet movements and the tutor's earnings stay in it. Study Credits (`wallet_transactions.currency`) are per currency, normally the learner's own; they only pay lessons in the same currency. Job budgets (`requirements.currency`) are the poster's; applications (`applications.currency`) the tutor's. Fixed-amount promo codes have a `currency`. Amounts in different currencies are never added or compared: totals are per currency (`sumByCurrency`, `formatSums`), and a search price filter only matches tutors in the viewer's currency. Rate limits, suggested top-ups and the no-show credit per currency are TutorLink settings (`rateLimits`, `topUpAmounts`, `fromDollarSetting`), never exchange rates.
- **Razorpay** (`src/server/razorpay.ts`, `src/server/checkout.ts`, `src/server/payment-ops.ts`, `/api/pay/start|finish`, `/api/pay/webhook`): `env.paymentsEnabled` is true once `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set (and `PAYMENTS_DISABLED` isn't `1`). `start` computes the amount on the server (a lesson: the server-only `quoteBooking` action, i.e. every booking check and the price) and creates an Order (manual capture for requests, automatic for instant bookings, credits and plans), stored in `payment_orders`. Checkout's answer goes to `finish`, which checks the signature (HMAC-SHA256 of `order_id|payment_id`) and the payment itself (order, amount, currency, status), claims the order once (`created → processing → done/failed`, shared with the webhook), and runs the action with a `VerifiedPayment` in its context. Actions never accept a payment from the browser: `/api/actions` can't pass one, and paid actions without it answer `payment_required`. If the action fails after paying, a taken payment is refunded at once and a held one is left to expire.
- **Capture and refunds after saving:** actions record `ProviderOp`s (capture when a tutor accepts or an instant booking used a held payment; refund for cancellations, no-shows and dispute refunds of card / UPI payments); the engine runs them once after the transaction commits (never inside it, since a serializable transaction can be retried). A refund is sent tagged with its payments row (`notes.row`), after checking the payment's existing refunds, so it can't be sent twice; its Razorpay id is saved in `payments.provider_refund_id`. Refunds that couldn't be sent are retried by the scheduler. A capture that fails (the hold expired) runs the server-only `markPaymentFailed` action: the lesson becomes `payment_failed`, both sides are told, and the family pays again with `/api/pay/start { kind: "booking_retry" }`.

- **Tutor payouts, by hand** (migration `20261116000000_tutor_payouts.sql`): `payout_accounts` (one per tutor: `upi` with a UPI ID, `bank` with an Indian account number + IFSC, or `other` with written instructions) is saved by the tutor (`savePayoutAccount`; a change after the first is a `security` notice, always emailed). It reaches the browser only for the tutor and staff with `payments.read`; without `payments.refund` the account number is masked to its last 4 digits (`snapshot.ts`). What a tutor is owed comes from `src/lib/earnings.ts` (`payoutBalances`, shared by the tutor's Earnings page, Admin → Payments and the server): per currency, completed or student-no-show lessons whose payment was collected (`paid` / `partially_refunded`), minus the platform fee and refund rows, "available" once the dispute window has passed, less payouts that aren't `failed`. Staff with `payments.refund` record a payout they sent (`recordPayout`: at most the available amount in that currency, a reference, the day sent; status `paid`, audited `payout.record`, tutor notified with the reference) and can mark one `failed` with a reason (`markPayoutFailed`; it's owed again). Tutors see refunds on their own lessons as amounts only (no method or Razorpay ids) so their figures match.
- **Editable plans and credit packs** (migration `20261116000200_editable_plans.sql`): `Data.pricing` (`Pricing` in `src/lib/data/platform.ts`) is stored in `platform_settings` under `pricing` and read with `readPricing` (defaults `DEFAULT_PRICING` until saved; Starter, id `free`, always first and free, its commission = `platformFeeBps`). Admin actions with `settings.manage`: `savePlan` (new ids from the name; one plan recommended), `deletePlan` (refused while any subscription uses it; hide instead), `movePlan`, `saveCreditPack`, `deleteCreditPack`; `setPlatformFee` keeps Starter's commission in step. Hidden plans and packs aren't offered; a tutor already on a hidden plan can renew it. `changePlan`, `buyCredits`, checkout (`loadPricing` in `src/server/pricing.ts`) and the public pages (`sitePricing`) all price from the saved pricing. `subscriptions.plan` accepts any plan id.
- **Rates in local currencies** (migration `20261116000100_local_currency_rates.sql`): the original US-cent limits on `tutors.hourly_rate_cents` and `applications.proposed_rate_cents` (1,500–50,000) refused rates above ₹500; the database now only keeps them between 100 and 10,000,000 minor units and the per-currency range is checked by the actions (`rateProblem`).

## Not connected yet

Automatic tutor payouts (Razorpay Route / RazorpayX need Razorpay's approval; payouts are sent by hand and recorded meanwhile) and SMS. Without Razorpay keys `env.paymentsEnabled` is `false`, so card / UPI charges, credit and plan purchases are refused with a clear message and free lessons still work. Trial lessons are booked free in the meantime (`createBooking` uses price 0 for `type: "trial"`; the tutor's `trial.priceCents` is kept and applies again once payments are on).

**Booking approval:** every booking, trials included, follows the tutor's `rules.requiresApproval`: `pending` (the tutor is notified in-app and by email) until the tutor accepts it (`transitionBooking → confirmed`), or `confirmed` straight away when the tutor has instant booking on and the `instant_booking` flag is enabled.

## Testing

The backend was tested end to end against a real PostgreSQL 18 with the migrations applied, a stand-in for the Supabase Auth (including TOTP two-step login) and Storage HTTP APIs and for Resend, and a production build: sign-up and email confirmation (both link styles), onboarding with uploads, booking races, messaging with attachments and file access rules, admin moderation and content, staff management, two-step login, hiding tutors, job take-downs, announcements, no-show credit, notification emails and their settings, password reset and change, two-step login for every account with backup codes, setting a first password on a Google account, changing the sign-in email, connecting and disconnecting Google / Facebook / Apple from Settings, the live classroom's API (join tokens and windows, host rights, waiting room, whiteboard images and boards with contact checks, the snipping helper, transcripts, ending a class, closing finished rooms), Google / Facebook / Apple sign-in (through a stand-in provider page: new accounts and role choice, linking to an existing account with the emailed code, "This wasn't me", unverified emails, Apple private relay, no email, cancel, replayed codes, under-13 and 13–17), parental consent, the scheduler, account deletion, server-rendered pages, and that the `anon` role is denied on every table. Run `npm run db:status` / `GET /api/health` to check a real project.
