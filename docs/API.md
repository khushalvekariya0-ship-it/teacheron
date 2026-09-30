# TutorLink REST API (v1)

Production API served by NestJS at `https://api.tutorlink.example/v1` (`API_BASE_URL`). It enforces exactly the rules the preview store enforces today (`src/lib/store/index.ts`); where the two differ, this document states the production behaviour and [DECISIONS.md](DECISIONS.md) records the open question.

## 1. Conventions

| Topic | Rule |
|---|---|
| Versioning | URI prefix `/v1`. Additive changes only within a version; breaking changes ship as `/v2` with a deprecation window and `Deprecation`/`Sunset` headers. |
| Format | JSON, `camelCase` keys, UTF-8. Enum values are the lower-snake strings from `src/lib/types.ts` (`cancelled_by_student`, `in_person`). Staff permissions are dotted (`payments.refund`). |
| Money | Integer cents plus `currency` (`"usd"`), e.g. `{ "priceCents": 9500, "currency": "usd" }`. Never floats. |
| Time | ISO-8601 UTC (`2026-10-04T21:00:00.000Z`). Availability windows use `"HH:mm"` in the tutor's IANA zone, which is returned alongside (`timezone`). Clients pass `tz` when they want slots grouped by their local day. |
| IDs | cuid strings. Public tutor URLs use `slug`. |
| Auth | Session cookie `__Host-tl_session` set by `/v1/auth/login` (web). Requests must include `credentials: "include"` and the header `X-Requested-With: tutorlink`. Staff endpoints additionally require an MFA-verified session. |
| Pagination | Cursor-based: `?limit=20&cursor=<opaque>` → `{ "data": [...], "nextCursor": "…" \| null }`. `limit` max 100. Admin tables may also return `total` when cheap. |
| Filtering | Named query params. Tutor search uses the URL contract of `src/lib/search.ts` verbatim (`subject`, `grade`, `level`, `location`, `radius`, `mode`, `schedule`, `days`, `times`, `minRate`, `maxRate` (dollars), `exp`, `lang`, `rating`, `category`, `support`, `verified`, `trial`, `instant`, `certified`, `sort`, `q`) so every web URL maps 1:1 to an API call. Lists accept `status=a,b` and `from`/`to` (UTC). |
| Sorting | `sort=field` or `sort=-field` (descending) where offered; tutor search uses `sort=match\|rating\|price_asc\|price_desc\|experience`. |
| Idempotency | `Idempotency-Key: <uuid v4>` is **required** on every endpoint marked "Idem" below. Same key + same body → the stored response is replayed (with `Idempotent-Replayed: true`). Same key + different body → `422 idempotency_key_reused`. Concurrent duplicate → `409 request_in_progress`. Keys are scoped per user and endpoint and kept 24 h (bookings: 7 days). |
| Rate limits | `429` with `Retry-After`; limits listed in [ARCHITECTURE.md §7](ARCHITECTURE.md#7-security). |
| Caching | Public GETs return `ETag` and `Cache-Control`; private responses are `Cache-Control: private, no-store`. |

### Error format

Errors use [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) `application/problem+json`. `detail` is safe to show to the user — it carries the same messages the preview store returns today, so `Result.error` maps directly.

```json
{
  "type": "https://docs.tutorlink.example/errors/slot_unavailable",
  "title": "Slot unavailable",
  "status": 409,
  "code": "slot_unavailable",
  "detail": "That time was just booked. Please choose another slot.",
  "errors": [{ "path": "startUtc", "message": "Choose one of the available start times." }],
  "requestId": "req_01J…"
}
```

| Status | Typical `code`s |
|---|---|
| 400 | `validation_failed` (with `errors[]`) |
| 401 | `unauthenticated`, `mfa_required` |
| 403 | `forbidden`, `permission_required`, `account_suspended`, `parental_consent_required`, `role_not_allowed` |
| 404 | `not_found` (also used instead of 403 when revealing existence would leak data) |
| 409 | `slot_unavailable`, `invalid_transition`, `already_applied`, `already_reviewed`, `dispute_open`, `request_in_progress` |
| 422 | `business_rule` (policy guard failed — e.g. reschedule window), `idempotency_key_reused`, `insufficient_credits`, `coupon_invalid` |
| 429 | `rate_limited` |
| 5xx | `internal`, `upstream_unavailable` (payment/meeting provider) |

---

## 2. Endpoints

**Auth column:** `Public` = no session; `Session` = any signed-in user; roles/permissions as listed. **Own** = the resource must belong to the caller (derived from the session, never from the body).

### 2.1 Auth & account

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | Public | `{ role: student\|parent\|tutor, firstName, lastName, email, password (≥10), zip, ageBand?: "18+"\|"13-17", parentEmail? }`. Under-13 cannot register. `13-17` requires `parentEmail` and creates a pending `ParentalConsent`. Sends verification email. |
| POST | `/auth/login` | Public | `{ email, password }` → sets cookie; returns `{ user, mfaRequired }`. Identical error for unknown email and wrong password. |
| POST | `/auth/mfa/verify` | Session (pre-MFA) | `{ code }` TOTP or recovery code. |
| POST | `/auth/mfa/setup` · `/auth/mfa/enable` · `/auth/mfa/disable` | Session | Staff cannot disable MFA. |
| POST | `/auth/logout` | Session | Revokes current session. |
| GET | `/auth/session` | Public | `{ user \| null, permissions[] }` — used by the web app on load. |
| GET · DELETE | `/auth/sessions` · `/auth/sessions/:id` | Session | List / revoke own sessions. |
| POST | `/auth/password/forgot` · `/auth/password/reset` | Public | Always `202` on forgot. Reset revokes all sessions. |
| POST | `/auth/password/change` | Session | `{ current, next }`; step-up for staff. |
| POST | `/auth/email/verify` · `/auth/email/resend` | Public · Session | Token from email link. |
| GET · POST | `/consents/:token` · `/consents/:token/grant` | Public (token) | Parent reviews and grants consent for a 13–17 student. `POST /consents/:token/decline` also available. |
| POST | `/me/consent/resend` | Student | Resend the consent email (rate limited). |
| GET · PATCH · DELETE | `/me` | Session | Profile (`firstName`, `lastName`, `phone`, `city`, `state`, `zip`, `timezone`). DELETE = deletion request; blocked while the caller has pending/confirmed bookings (as booker **or** tutor); anonymizes rather than hard-deletes. |
| GET | `/me/login-events` | Session | Recent sign-ins (hashed IP, device). |
| GET · PUT | `/me/notification-preferences` | Session | Matrix of `category × channel`. SMS requires a verified phone and the `sms_notifications` flag. |
| GET | `/me/export` | Session | Async data export (emailed link). |
| GET · POST · PATCH · DELETE | `/me/children[/:id]` | Parent | `{ firstName, grade, birthYear?, learningGoals[], subjects[], notes? }`. Delete blocked while the child has upcoming lessons. |

### 2.2 Catalog, search & matching

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/subjects` · `/subject-categories` · `/metros` | Public | Cached. |
| GET | `/geo/resolve?q=` | Public | ZIP or "City, ST" → `{ zip, city, state, lat, lng }`. Rate limited. |
| GET | `/tutors` | Public | Search (URL contract above). Returns `{ data: [{ tutor: TutorCard, distance, matchPercent }], nextCursor, facets }`. Only `active` profiles. Featured status never affects order. |
| GET | `/tutors/:slug` | Public | Public profile: bio, subjects, levels, modes, rate, trial, rules (notice/length), education/certifications with verified flags, verification checks, rating (null when no reviews), service area as city + radius (never an address). |
| GET | `/tutors/:id/availability?from&to&durationMin&tz` | Public | Generated slots (`generateSlots`): honours windows, exceptions, notice, advance window, buffer and existing blocking bookings. |
| GET | `/tutors/:id/reviews` | Public | Published reviews with tutor responses; `ratingBreakdown`. |
| GET | `/tutors/compare?ids=a,b,c` | Public | Up to 3. |
| POST | `/matching/parse` | Public | `{ text }` → `MatchCriteria` (rules-based parser; nothing is stored). |
| POST | `/matching/concierge` | Public | `{ criteria }` → ranked `MatchResult[]` with every factor, weight, score, status and explanation. Signed-in results are stored as `Match` snapshots. |
| GET | `/requirements/:id/matches` | Owner | Stored snapshots for a requirement. |
| GET · PUT · DELETE | `/me/favorites` · `/me/favorites/:tutorId` | Student, Parent | |
| GET · POST · PATCH · DELETE | `/me/saved-searches[/:id]` | Session | `{ kind: tutors\|jobs, label, query, frequency: instant\|daily\|weekly\|off }`. |

### 2.3 Tutor workspace

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET · PUT | `/me/tutor-onboarding` | Tutor | Autosaved multi-step draft `{ step, data }`. |
| POST | `/me/tutor-onboarding/submit` | Tutor | Requires headline, bio, subjects, hourlyRate, modes, ZIP. Never creates a duplicate profile. Grants Starter credits. |
| GET · PATCH | `/me/tutor-profile` | Tutor | Rate `$15–$500` (integer cents); bio ≥ 80 chars; bio/approach masked. |
| PUT | `/me/tutor-profile/availability` | Tutor | `WeeklyWindow[]`; windows must end after they start and not overlap per day. |
| PUT | `/me/tutor-profile/exceptions` | Tutor | `AvailabilityException[]` (`blocked` or `custom` windows). |
| PATCH | `/me/tutor-profile/booking-rules` | Tutor | Notice 1–168 h, advance 7–180 days, buffer 0–60 min, ≥ 1 session length; instant booking only when the platform flag is on. |
| PATCH | `/me/tutor-profile/trial` | Tutor | Price $0–$200, length 15/20/25/30/45/60 min. |
| POST · PATCH · DELETE | `/me/tutor-profile/education[/:id]` · `/certifications[/:id]` | Tutor | Editing a verified item resets `verified`. |
| GET · POST | `/me/verification-requests` | Tutor | `{ kind, fileIds[] }`; PDF/image ≤ 15 MB; rejected if the check is already submitted/under review/verified. |
| GET | `/me/earnings` · `/me/payouts` | Tutor | Available vs pending earnings (dispute window), payout history. |
| GET · POST | `/me/stripe-account` · `/me/stripe-account/onboarding-link` · `/me/stripe-account/dashboard-link` | Tutor | Stripe Connect Express. |
| GET · POST | `/me/lead-credits` · `/me/lead-credits/purchases` | Tutor | Balance + ledger · Idem, `{ packId }`; requires `lead_credits` flag. |
| GET | `/plans` | Public | Tutor plans with commission and monthly credits. |
| GET · POST · DELETE | `/me/subscription` | Tutor | Idem on POST `{ planCode }` → Stripe Checkout/Billing; DELETE = cancel at period end. |

### 2.4 Requirements (tutor jobs) & applications

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/requirements` | Tutor (Public: teaser fields only) | Job board: published only; filters `subject`, `grade`, `mode`, `location`, `radius`, `budgetMin`, `days`, `times`. Owner surname and exact ZIP hidden. |
| GET | `/requirements/:id` | Public teaser / Tutor / Owner | Owner sees applications count and drafts. |
| POST | `/requirements` | Student, Parent | Creates a **draft** (any subset of fields; `draftStep`). `childId` must be the caller's child. |
| PATCH | `/requirements/:id` | Owner | Draft save; owner and status cannot be changed here. |
| POST | `/requirements/:id/publish` | Owner | Validates subject, title ≥ 8, objectives ≥ 20, ≥ 1 mode, ZIP when in-person, `budgetMax ≥ budgetMin`. Triggers instant job alerts. |
| POST | `/requirements/:id/status` | Owner | `{ status: paused\|published\|closed }` per the requirement state machine; closing closes open applications. |
| DELETE | `/requirements/:id` | Owner | Blocked if a tutor was hired (close instead). |
| POST | `/requirements/:id/attachments` | Owner | `{ fileId }` from `/uploads`. |
| GET · PUT · DELETE | `/me/saved-requirements[/:id]` | Tutor | Saved jobs. |
| POST | `/requirements/:id/applications` | Tutor | Idem. `{ message ≥ 40 chars (masked), proposedRateCents 1000–50000 }`. Must be published; one active application per tutor; spends 1 lead credit when `lead_credits` is on (`422 insufficient_credits`). |
| GET | `/requirements/:id/applications` | Owner | Applications with tutor cards and match factors. |
| GET | `/me/applications` | Tutor | Own applications. |
| PATCH | `/applications/:id` | Owner / Tutor | Owner: `viewed\|shortlisted\|contacted\|trial_requested\|hired\|rejected`; tutor: `withdrawn` only. |

### 2.5 Messaging (REST mirror of the socket)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/conversations` | Session | Own threads with unread counts. |
| POST | `/conversations` | Student, Parent | `{ tutorId, childId?, subject? }` — returns the existing thread if one exists. Blocked while parental consent is pending. |
| GET | `/conversations/:id/messages?cursor` | Participant | Newest first. |
| POST | `/conversations/:id/messages` | Participant | `{ body ≤ 4000, fileIds? }`; contact details masked; blocked threads reject. |
| POST | `/conversations/:id/read` | Participant | Sets `lastReadAt`. |
| POST · DELETE | `/conversations/:id/block` | Participant | Only the blocker can unblock. |
| POST | `/reports` | Session | `{ targetType: user\|tutor\|message\|review\|requirement, targetId, reason, details }`. |

### 2.6 Bookings, lessons & reviews

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/coupons/validate` | Student, Parent | `{ code, subtotalCents }` → `{ discountCents }`; requires `coupons` flag. |
| POST | `/bookings` | Student, Parent | **Idem.** `{ tutorId, startUtc, durationMin, type: trial\|regular, mode, subject, childId?, notes?, couponCode? }` → `201 { booking, payment: { clientSecret } }`. Server computes price, discount, fee. See [ARCHITECTURE §5.1](ARCHITECTURE.md#51-booking-with-stripe-manual-capture). |
| GET | `/bookings?status=&from=&to=&role=booker\|tutor` | Session | Own bookings (as booker or tutor). |
| GET | `/bookings/:id` | Booker, Tutor, `bookings.manage` | Includes `history`, `availableTransitions` for the caller, `policySummary`. |
| POST | `/bookings/:id/transitions` | Booker, Tutor, `bookings.manage` | **Idem.** `{ to, note? }`. Validated by the state machine (actors + guards). `rescheduled` and `disputed` are rejected here — use the dedicated endpoints. Staff transitions are audit-logged. |
| GET | `/bookings/:id/cancellation-quote` | Booker, Tutor | `{ refundCents, rule }` from `cancellationRefund()` — shown before confirming. |
| POST | `/bookings/:id/reschedule` | Booker, Tutor | **Idem.** `{ startUtc }` → new booking (old one → `rescheduled`). ≥ 12 h before start; max 2 per booking chain. |
| GET | `/bookings/:id/meeting-link` | Booker, Tutor | Only for confirmed/in-progress online lessons from 15 min before start until the end; otherwise `403`. |
| POST | `/bookings/:id/attendance` | Booker, Tutor | Manual check-in (meeting-provider webhooks record attendance automatically). |
| POST | `/bookings/:id/review` | Booker | Completed bookings only; one per booking; rating 1–5; body ≥ 20 chars (masked). |
| POST | `/reviews/:id/response` | Tutor (own review) | One response, ≥ 10 chars (masked). |
| POST | `/bookings/:id/disputes` | Booker, Tutor | `{ reason, details ≥ 30, fileIds? }` within the dispute window; one open dispute per booking. |
| GET · POST | `/disputes/:id` · `/disputes/:id/evidence` | Opener, counterparty | Parties see status and non-internal notes. |

### 2.7 Learning

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET · POST | `/goals` | Tutor (learners they teach), Student, Parent (own learners) | `{ learnerId, tutorId?, subject, title, topics[], targetDate? }`. |
| PATCH | `/goals/:id/topics/:topicId` | Tutor (own goal) | `{ status: not_started\|in_progress\|completed }`. |
| GET · POST | `/progress-notes` | Tutor posts; learner/parent reads | Tutor must teach the learner (confirmed, in-progress or completed booking). Rating 1–5 optional. |
| GET · POST | `/homework` | Tutor assigns; learner/parent reads | `{ learnerId, subject, title, instructions, dueDate }`. |
| POST | `/homework/:id/submissions` | Student, Parent (own learner) | `{ body, fileId? }`; not after review. |
| POST | `/homework/:id/review` | Tutor (own) | Only when `submitted`. `{ body, grade? }`. |

### 2.8 Payments, files, notifications, content, flags

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/payments/setup-intent` | Student, Parent | Save a card for later off-session charges. |
| GET · DELETE | `/me/payment-methods[/:id]` | Session | Brand + last4 only. |
| GET | `/me/payments` | Session | Receipts, refunds (negative lines). |
| GET | `/me/credit-balance` | Student, Parent | Platform credit (dispute credits, referrals). |
| GET · POST | `/me/referral` · `/referrals/claim` | Session | Requires `referrals` flag. |
| POST | `/uploads` | Session | `{ purpose, fileName, contentType, sizeBytes }` → `{ fileId, url, fields, expiresAt }` presigned POST. |
| POST | `/uploads/:fileId/complete` | Owner | Triggers malware scan; the file becomes attachable when `scanStatus = clean`. |
| GET | `/files/:fileId` | Authorized by purpose | `302` to a short-lived signed URL. |
| GET | `/notifications?unread=true` | Session | Feed. |
| POST | `/notifications/:id/read` · `/notifications/read-all` | Owner | |
| GET | `/content/pages/:slug` · `/content/blog[/:slug]` · `/content/faqs` · `/content/testimonials` · `/content/seo?path=` | Public | Published only; testimonials only with recorded consent. |
| GET | `/flags` | Public | Flags evaluated for the caller (`enabled` + rollout bucket). |

### 2.9 Admin & support (`/v1/admin/*`, MFA-verified staff session)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/admin/overview` | any staff | KPIs scoped to the caller's permissions. |
| GET | `/admin/users[/:id]` | `users.read` | Search, detail, login events, sessions. |
| PATCH | `/admin/users/:id/status` | `users.write` | `{ status: active\|suspended, reason ≥ 5 }`; not on self; audited; suspension revokes sessions. |
| GET · PUT | `/admin/staff[/:id]/permissions` | `staff.manage` (super admin) | Grant/revoke permissions; audited; step-up MFA. |
| GET | `/admin/tutors` | `users.read` | Profiles, plan, credits, verification summary. |
| GET | `/admin/verification-requests?status=` | `tutors.verify` | Queue with signed document links. |
| POST | `/admin/verification-requests/:id/decision` | `tutors.verify` | `{ decision: under_review\|verified\|rejected, note }`; rejection needs a note ≥ 10; verified sets `expiresAt` (+730 days); audited. |
| GET | `/admin/requirements` | `users.read` | Moderation list. |
| GET | `/admin/bookings` | `bookings.manage` | All bookings with filters. |
| POST | `/admin/bookings/:id/transitions` | `bookings.manage` | Same state machine as `/bookings/:id/transitions` with actor `admin`. Transitions that move money (`cancelled_*` after capture, `refunded`) also require `payments.refund` in production. |
| GET | `/admin/payments` · `/admin/payouts` | `payments.read` | |
| POST | `/admin/payments/:id/refunds` | `payments.refund` | **Idem.** `{ amountCents, reason, note }`; ≤ captured − refunded; audited. |
| POST | `/admin/payouts/:id/retry` · `/admin/tutors/:id/payout-hold` | `payouts.manage` | Production addition. |
| GET · PATCH | `/admin/disputes[/:id]` | `disputes.manage` | Status changes (`under_review`, `awaiting_information`, `escalated`, `rejected`); closed disputes cannot be reopened. |
| POST | `/admin/disputes/:id/notes` | `disputes.manage` | Internal notes; audited. |
| POST | `/admin/disputes/:id/resolve` | `disputes.manage` (+ `payments.refund` for refund outcomes) | **Idem.** `{ outcome: full_refund\|partial_refund\|credit\|no_refund, amountCents, note ≥ 10 }` → booking `refunded` or `completed`, refund or credit entry, notifications, audit. |
| GET · PATCH | `/admin/reports[/:id]` | `reports.moderate` | `{ status: reviewing\|actioned\|dismissed, resolutionNote }`. |
| GET · PATCH | `/admin/reviews[/:id]` | `reports.moderate` | `{ status: published\|flagged\|removed, note }`. |
| GET · PATCH | `/admin/message-flags[/:id]` | `reports.moderate` | Automated and user flags. |
| POST | `/admin/conversations/:id/access` | `conversations.read_flagged` | `{ reason ≥ 5 }` → messages; only for reported/flagged threads; audited. |
| GET · POST · PATCH | `/admin/catalog/subjects` · `/categories` · `/metros` | `content.manage` | |
| GET · POST · PATCH · DELETE | `/admin/content/pages` · `/blog` · `/faqs` · `/testimonials` · `/seo` | `content.manage` | Publishing a testimonial requires consent evidence. Publishing revalidates web cache tags. |
| GET · PATCH | `/admin/flags[/:key]` | `flags.manage` | `{ enabled, rolloutPercent 0–100, rules }`; audited. |
| GET · PATCH | `/admin/settings/booking-policy` | `settings.manage` | Non-negative numbers; refund % ≤ 100; audited; applies to new bookings only (snapshot). |
| PATCH | `/admin/settings/platform-fee` | `settings.manage` | `{ bps: 0–3000 }`; audited. |
| PATCH | `/admin/settings/match-weights` | `settings.manage` | Factor weights; audited; bumps `algorithmVersion`. |
| GET · POST · PATCH | `/admin/coupons[/:id]` · `/admin/promotions[/:id]` · `/admin/plans[/:id]` | `settings.manage` | Codes 4–16 A–Z/0–9, unique; percent 1–100; fixed in cents. |
| GET | `/admin/audit-logs?actorId=&action=&targetType=&targetId=` | `audit.read` | Read-only. |
| GET | `/admin/security` | any staff | Own MFA status, sessions, recent staff sign-ins (all staff sign-ins require `users.read`). |

---

## 3. Webhooks (inbound)

All webhook routes read the raw body, verify the provider signature, insert into `webhook_events` (`@@unique([provider, eventId])`), return `200` within 2 s and process asynchronously. Duplicates are no-ops.

| Route | Verification | Events handled |
|---|---|---|
| `POST /v1/webhooks/stripe` | `Stripe-Signature`, `STRIPE_WEBHOOK_SECRET` | `payment_intent.amount_capturable_updated`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`, `charge.dispute.created` (card chargeback → freezes tutor earnings, opens internal dispute), `setup_intent.succeeded`, `checkout.session.completed`, `customer.subscription.created\|updated\|deleted`, `invoice.paid`, `invoice.payment_failed` |
| `POST /v1/webhooks/stripe-connect` | `STRIPE_CONNECT_WEBHOOK_SECRET` | `account.updated`, `transfer.created\|reversed`, `payout.paid`, `payout.failed` |
| `POST /v1/webhooks/zoom` | `x-zm-signature` HMAC, `ZOOM_WEBHOOK_SECRET_TOKEN` (+ URL validation challenge) | `meeting.participant_joined`, `meeting.participant_left`, `meeting.ended` → `session_attendance` |
| `POST /v1/webhooks/twilio` | `X-Twilio-Signature` | Message status callbacks → `notification_deliveries`; `STOP` opt-outs → preferences |
| `POST /v1/webhooks/resend` | Svix signature, `RESEND_WEBHOOK_SECRET` | `email.delivered`, `email.bounced`, `email.complained` → suppress channel |
| `POST /v1/webhooks/background-check` | Vendor HMAC | Report completed → `verification_requests` (`background`) |
| `POST /v1/webhooks/file-scan` | Internal (SNS/EventBridge, IAM) | Scan result → `files.scanStatus`, promote or delete |

Outbound: the CMS module calls the web app's revalidation route handler (`POST /api/revalidate`, `REVALIDATE_SECRET`) with cache tags.

---

## 4. WebSocket (Socket.IO)

Endpoint `wss://api.tutorlink.example/realtime` (`NEXT_PUBLIC_WS_URL`), namespace `/`. The handshake authenticates with the session cookie; unauthenticated sockets are rejected. Each socket joins `user:{userId}`; clients join conversation rooms explicitly. All client→server events use acknowledgements returning `{ ok: true, data } | { ok: false, error: { code, detail } }` — the same `Result` shape as the store.

| Direction | Event | Payload | Notes |
|---|---|---|---|
| C → S | `conversation:join` / `conversation:leave` | `{ conversationId }` | Participant check. |
| C → S | `message:send` | `{ conversationId, body, fileIds?, clientMessageId }` | Persist → ack with stored message → broadcast. Rate limited. |
| C → S | `message:read` | `{ conversationId, at }` | Updates `lastReadAt`. |
| C → S | `typing` | `{ conversationId, typing: boolean }` | Ephemeral, throttled, not persisted. |
| S → C | `message:new` | `{ message }` | To `conversation:{id}`; includes `moderation` when masked. |
| S → C | `conversation:read` | `{ conversationId, userId, at }` | Read receipts. |
| S → C | `conversation:updated` | `{ conversationId, blocked?, flagged? }` | Block/unblock, safeguarding. |
| S → C | `typing` | `{ conversationId, userId, typing }` | |
| S → C | `notification:new` | `{ notification }` | To `user:{id}`; drives the unread badge. |
| S → C | `booking:updated` | `{ bookingId, status, paymentStatus }` | To booker and tutor. |
| S → C | `session:revoked` | `{}` | Forces sign-out (suspension, password change). |

Reconnection: clients resume with `GET /conversations/:id/messages?after=<lastMessageId>` to backfill anything missed.

---

## 5. Permission matrix

Roles: **Student**, **Parent** and **Tutor** are account types. Staff are `admin` or `support` users with granular permissions. Defaults: **Support** = `users.read`, `bookings.manage`, `reports.moderate`, `disputes.manage`, `payments.read` (`SUPPORT_PERMISSIONS`); **Administrator** = all 13 preview permissions; **Super admin** = Administrator + `staff.manage` + `payouts.manage` (production additions). Staff permissions can be adjusted per person.

Legend: **Yes** = allowed · **Own** = only on own records (or own children) · **—** = not allowed · (perm) = permission that grants it.

| Capability | Student | Parent | Tutor | Support | Administrator | Super admin |
|---|---|---|---|---|---|---|
| Search, view tutor profiles, compare, concierge | Yes | Yes | Yes | Yes | Yes | Yes |
| Favorite tutors | Yes | Yes | — | — | — | — |
| Saved searches & alerts | Yes | Yes | Yes (jobs) | — | — | — |
| Manage child profiles | — | Own | — | — | — | — |
| Post / edit / publish / close requirements | Own | Own (for self or child) | — | — | — | — |
| View job board, save jobs | — | — | Yes | Yes (users.read) | Yes | Yes |
| Apply to requirements (spends credits) | — | — | Yes | — | — | — |
| Change application status | Own requirement | Own requirement | Withdraw own | — | — | — |
| Start a conversation | Yes (after consent if 13–17) | Yes | — (replies only) | — | — | — |
| Send messages, block, report | Own threads | Own threads | Own threads | — | — | — |
| Read flagged/reported private conversations (with reason, audited) | — | Guardian of minor | — | — (conversations.read_flagged not default) | Yes | Yes |
| Book lessons & pay | Yes (after consent if 13–17) | Own children | — | — | — | — |
| Accept (confirm) a pending booking | — | — | Own | Yes (bookings.manage) | Yes | Yes |
| Cancel a booking | Own (policy refund) | Own (policy refund) | Own (full refund) | Yes (bookings.manage) | Yes | Yes |
| Reschedule | Own | Own | Own | — | — | — |
| Mark started / completed | — | — | Own | Complete (bookings.manage) | Yes | Yes |
| Report no-show | Tutor no-show | Tutor no-show | Student no-show | Yes (bookings.manage) | Yes | Yes |
| Open a dispute (within window) | Own | Own | Own | — | — | — |
| Manage disputes (notes, status) | — | — | — | Yes (disputes.manage) | Yes | Yes |
| Resolve disputes with refund | — | — | — | — (needs payments.refund) | Yes | Yes |
| Issue manual refunds | — | — | — | — | Yes (payments.refund) | Yes |
| Leave a review | Own completed | Own completed | — | — | — | — |
| Respond to a review | — | — | Own | — | — | — |
| Moderate reviews & reports | — | — | — | Yes (reports.moderate) | Yes | Yes |
| Goals, progress notes, homework (write) | Goals for own learning; submit homework | Goals for own children; submit homework | For learners they teach | — | — | — |
| View progress & homework | Own | Own children | Learners they teach | — | — | — |
| Edit tutor profile, availability, rules, trial | — | — | Own | — | — | — |
| Submit verification documents | — | — | Own | — | — | — |
| Review verification | — | — | — | — (tutors.verify not default) | Yes | Yes |
| Buy lead credits, change plan, Connect payouts | — | — | Own | — | — | — |
| View users & tutors | — | — | — | Yes (users.read) | Yes | Yes |
| Suspend / reactivate users | — | — | — | — (users.write) | Yes | Yes |
| View payments & payouts | Own | Own | Own | Yes (payments.read) | Yes | Yes |
| Retry / hold payouts | — | — | — | — | — (payouts.manage) | Yes |
| Catalog, CMS, blog, FAQs, testimonials, SEO | — | — | — | — | Yes (content.manage) | Yes |
| Feature flags | — | — | — | — | Yes (flags.manage) | Yes |
| Booking policy, platform fee, match weights, coupons, plans | — | — | — | — | Yes (settings.manage) | Yes |
| Read audit log | — | — | — | — | Yes (audit.read) | Yes |
| Manage staff accounts & permissions | — | — | — | — | — | Yes (staff.manage) |

Notes on current preview behaviour that production tightens:

- In the preview, any staff member with `bookings.manage` (including Support) acts as the state-machine `admin` actor and can cancel or refund bookings through transitions without `payments.refund`. Production requires `payments.refund` for any transition that moves money.
- Feature flags, policy, fee and coupon changes additionally require the `admin` role in the preview store (`requireUser(["admin"])`), regardless of permissions. Production keeps permissions as the single source of truth.
