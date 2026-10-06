# Routes

Complete page and route inventory for the web app (Next.js 16 App Router, `src/app`). The REST API is documented separately in [API.md](API.md).

- **Status:** *Built* = `page.tsx` / `route.ts` exists in the preview build. *Planned* = linked from navigation (`src/components/dashboard/nav.ts`, `Navbar`, `Footer`), notifications or the product brief, but not yet present. Snapshot taken with `find src/app -name page.tsx` on 2026-09-30 while routes were actively being added — re-run it to refresh.
- **Rendering:** *Static* = prerendered at build time. *SSG* = prerendered per param via `generateStaticParams`. *Client* = server component exports `metadata` and renders a `"use client"` view that reads the zustand store after hydration (all dashboard and admin pages; search pages read `useSearchParams` inside `<Suspense>`). *Dynamic* = rendered per request. The **Production** column is the target once the API replaces the local store.
- All `/dashboard/*`, `/admin/*` and `/onboarding/*` pages are `noindex` and gated by `DashboardShell` / `RoleGate` / `PermissionGate` (signed-out users see `UnauthorizedState`, wrong role or permission sees `ForbiddenState`).

## Public site — `src/app/(site)`

Layout: `PreviewBanner`, `Navbar`, `Footer`, `CompareTray`.

| Path | Audience | Purpose | Status | Rendering (preview → production) |
|---|---|---|---|---|
| `/` | Everyone | Home: hero search, trust band, popular subjects, how it works, featured tutors (labelled, never ranked), modes, for parents, for tutors, illustrative testimonials, FAQ, CTA; Organization + WebSite JSON-LD | Built | Static → Static + cached featured slice |
| `/tutors` | Everyone | Tutor search: `lib/search.ts` URL contract (subject, grade, location, radius, mode, schedule, rate, experience, language, rating, category, support, verified, trial, instant, certified, sort), filter drawer on mobile, save search, add to compare | Built | Static shell + Client → Dynamic SSR (API search) |
| `/tutors/[slug]` | Everyone | Tutor profile: bio, approach, subjects, levels, verification checks, education, reviews + responses, rates, trial, availability `SlotPicker`, booking panel (`?book=trial\|regular#book`); Person JSON-LD | Built | SSG over sample tutors (browser-registered tutors render client-side, `noindex`) → ISR / `use cache` with `tutor:{id}` tag |
| `/compare` | Everyone | Side-by-side comparison of up to 3 tutors (from the compare tray) | Built | Static shell + Client → Client (+ `GET /tutors/compare`) |
| `/concierge` | Everyone | "Help me find a tutor": natural-language parse (local, confirmed back to the user), criteria form, ranked shortlist with every factor explained | Built | Static + Client → Static + Client (API scoring) |
| `/subjects` | Everyone | Subject index grouped by category | Built | Static → Static |
| `/subjects/[slug]` | Everyone | Subject landing page (SEO): summary, tutors teaching it, FAQs | Built | SSG → ISR |
| `/locations` | Everyone | Metro index (only metros with real tutor supply) | Built | Static → Static |
| `/locations/[slug]` | Everyone | Metro landing page: in-person and online tutors near a city (metros in `METROS` only) | Built | SSG over metros → ISR |
| `/locations/[slug]/[subject]` | Everyone | Subject × metro landing page (only combinations with supply, to avoid thin pages) | Planned (Phase 4) | — → ISR |
| `/post-requirement` | Students, parents (sign-in to publish) | Multi-step requirement form with autosaved drafts (`saveRequirementDraft` → `publishRequirement`) | Built | Static shell + Client → Client |
| `/tutor-jobs` | Tutors (public teaser) | Job board of published requirements; filters; save job | Built | Static shell + Client → Dynamic SSR |
| `/tutor-jobs/[id]` | Tutors | Job detail and apply (message, proposed rate, credit cost) | Built | SSG over sample jobs → Dynamic SSR |
| `/how-it-works` | Everyone | Process for families and tutors | Built | Static |
| `/for-students` | Students | Audience landing page | Built | Static |
| `/for-parents` | Parents | Child profiles, safety, progress | Built | Static |
| `/become-a-tutor` | Prospective tutors | Value proposition, verification, earnings; CTA to register/onboarding | Built | Static |
| `/pricing` (`#tutors`) | Everyone | Family pricing and cancellation policy; tutor plans, commission, lead credits | Built | Static → Static (plans from API, revalidated) |
| `/about` | Everyone | Company | Built | Static |
| `/contact` | Everyone | Support form → `POST /api/contact` | Built | Static + Client |
| `/faq` | Everyone | FAQs by audience (families, tutors, payments, safety); FAQPage JSON-LD | Built | Static → Static (CMS) |
| `/blog` | Everyone | Blog and resources index | Built | Static → ISR (CMS) |
| `/blog/[slug]` | Everyone | Article | Built | SSG → ISR (CMS, `blog:{slug}` tag) |
| `/trust-safety` (`#verification`) | Everyone | Verification, moderation, safeguarding, dispute process | Built | Static → Static (CMS) |
| `/safety` | Everyone | Safety guidelines for families and tutors | Planned | Static (CMS) |
| `/privacy` | Everyone | Privacy policy (incl. children's privacy) | Built | Static → Static (CMS) |
| `/terms` | Everyone | Terms of service | Built | Static → Static (CMS) |

## Authentication — `src/app/(auth)`

Layout: split screen with logo, "Back to site", preview disclaimer and legal links.

| Path | Audience | Purpose | Status | Rendering |
|---|---|---|---|---|
| `/login` (`?next=`) | Signed-out | Email + password (demo password `tutorlink-demo`), one-click demo accounts, and Google / Apple / Facebook / SSO through an account-picker dialog that stands in for the provider's window | Built | Static + Client → Static + Client (`POST /v1/auth/login`) |
| `/register` | Signed-out | Role choice (student, parent, tutor), age band (18+ or 13–17 with parent email; under-13 blocked), password ≥ 10; the success screen shows the verification email in a "preview inbox" | Built | Static + Client |
| `/forgot-password` | Signed-out | Request a reset link; the email appears in a "preview inbox" on the page | Built | Static + Client |
| `/reset-password` (`?token=`) | Signed-out | Set a new password from the reset token (1-hour expiry, single use), then continue signed in | Built | Static + Client |
| `/verify-email` (`?user=&token=`) | New users | Confirm email address from the verification token | Built | Static + Client |
| `/consent/[token]` | Parent/guardian | Review and grant/decline consent for a 13–17 student | Planned | Dynamic |
| `/mfa` | Staff (and opted-in users) | TOTP challenge and first-time enrolment | Planned | Dynamic |

## Onboarding — `src/app/onboarding`

Focused layout (logo + save-and-exit), `noindex`.

| Path | Audience | Purpose | Status | Rendering |
|---|---|---|---|---|
| `/onboarding/tutor` | Tutor | Multi-step profile setup with autosave: subjects, levels, experience, education, certifications, rate, trial, modes, service area, availability, ID document → `submitOnboarding` | Built | Client |

## Dashboard — `src/app/dashboard` (students, parents, tutors)

Layout: `DashboardShell area="app"`. Sidebar comes from `NAV_BY_ROLE`; shared paths render role-specific views through `<ByRole tutor learner />`.

| Path | Student | Parent | Tutor | Purpose | Status |
|---|---|---|---|---|---|
| `/dashboard` | Yes | Yes | Yes | Overview: next lessons, actions needed, messages, progress (learner) / requests, earnings, jobs (tutor) | Built |
| `/dashboard/requirements` | Yes | Yes | — | My requirements with status actions (pause, publish, close, delete) | Built |
| `/dashboard/requirements/[id]` | Owner | Owner | — | Requirement detail: applications with match factors, status changes, contact/hire | Built |
| `/dashboard/messages` (`?c=`) | Yes | Yes | Yes | Inbox and thread: masking notice, attachments, block, report | Built |
| `/dashboard/bookings` | Yes | Yes | Yes | Upcoming / past / cancelled lessons | Built |
| `/dashboard/bookings/[id]` | Booker | Booker | Tutor | Booking detail: history, state-machine actions, cancellation quote, reschedule, meeting link window, review, dispute | Built |
| `/dashboard/calendar` | Yes | Yes | Yes | Week/month calendar in the viewer's time zone | Built |
| `/dashboard/progress` | Yes | Yes | Yes | Learning goals, topic status, progress notes (tutor: "Students & progress") | Built |
| `/dashboard/homework` | Yes | Yes | Yes | Assign / submit / review homework | Built |
| `/dashboard/favorites` | Yes | Yes | — | Saved tutors | Built |
| `/dashboard/children` | — | Yes | — | Child profiles (first name, grade, goals, subjects, notes) | Built |
| `/dashboard/reviews` | Yes | Yes | Yes | Reviews written (learner) / received with responses (tutor) | Built |
| `/dashboard/saved-searches` | Yes | Yes | Yes | Saved tutor searches (learner) or job alerts (tutor), frequency | Planned |
| `/dashboard/payments` | Yes | Yes | — | Receipts, refunds, payment methods, platform credit | Built |
| `/dashboard/notifications` | Yes | Yes | Yes | Notification feed | Planned |
| `/dashboard/settings` | Yes | Yes | Yes | Profile, time zone, password, sessions/login history, notification preferences, delete account | Planned |
| `/dashboard/profile` | — | — | Yes | Edit public tutor profile, rate, modes, subjects, service radius | Planned |
| `/dashboard/jobs` | — | — | Yes | Student jobs matched to the tutor, saved jobs | Built |
| `/dashboard/applications` | — | — | Yes | My applications and statuses, withdraw | Built |
| `/dashboard/availability` | — | — | Yes | Weekly windows, exceptions, booking rules, trial settings | Planned |
| `/dashboard/earnings` | — | — | Yes | Earnings (pending vs available), payouts, Stripe Connect status | Planned |
| `/dashboard/subscription` | — | — | Yes | Plan (Starter / Professional / Premium), change plan | Planned |
| `/dashboard/credits` | — | — | Yes | Lead-credit balance, ledger, buy packs | Planned |
| `/dashboard/verification` | — | — | Yes | Verification checks and document uploads | Planned |

Rendering for every dashboard page: Client (preview) → dynamic shell + TanStack Query (production).

## Classroom — `src/app/classroom`

Full-screen, outside the site and dashboard layouts; `noindex` and disallowed in `robots.ts`.

| Path | Audience | Purpose | Status | Rendering (preview → production) |
|---|---|---|---|---|
| `/classroom/[id]` | The booker and tutor of that booking (staff can view) | In-app lesson room: video stage on the left, infinite whiteboard and chat on the right (tabs below 1280px, stacked on phones). Opens for confirmed online lessons until they end; before the start it is a waiting room. Chat is the booking's existing conversation. | Built (own camera, mic, screen share, whiteboard and chat work; two-way media and cross-device board sync need the realtime service) | Client → Client + WebRTC SFU token from the API + realtime channel |
| `/classroom/demo` | Everyone | Open demo room for trying the whiteboard, camera and chat without a booking | Built | Client |

## Admin console — `src/app/admin` (staff)

Layout: `DashboardShell area="admin"`; items hidden unless the user holds the permission. Production requires an MFA-verified staff session.

| Path | Permission | Purpose | Status |
|---|---|---|---|
| `/admin` | any staff | Overview KPIs and queues | Built |
| `/admin/users` | `users.read` (`users.write` to suspend) | User search, detail, suspend/reactivate with reason | Built |
| `/admin/tutors` | `users.read` | Tutor profiles, plans, credits, verification summary | Built |
| `/admin/verification` | `tutors.verify` | Verification queue: start review, approve, reject with note | Built |
| `/admin/requirements` | `users.read` | Requirement moderation | Built |
| `/admin/bookings` | `bookings.manage` | All bookings; staff transitions (audited) | Built |
| `/admin/catalog` | `content.manage` | Subjects, categories, metros | Built |
| `/admin/payments` | `payments.read` | Payments, refunds, payouts | Built |
| `/admin/monetization` | `settings.manage` | Plans, commission, credit packs | Built |
| `/admin/promotions` | `settings.manage` | Coupons and promotions | Built |
| `/admin/disputes` | `disputes.manage` | Dispute queue | Built |
| `/admin/disputes/[id]` | `disputes.manage` (+ `payments.refund` for refunds) | Evidence, notes, status, resolution | Built |
| `/admin/reports` | `reports.moderate` (+ `conversations.read_flagged` to open threads) | User reports; audited conversation access | Built |
| `/admin/reviews` | `reports.moderate` | Review moderation (publish, flag, remove) | Built |
| `/admin/content` | `content.manage` | Pages, blog, FAQs, testimonials (consent), SEO metadata | Built |
| `/admin/feature-flags` | `flags.manage` | Toggle flags and rollout percentage | Built |
| `/admin/settings` | `settings.manage` | Booking policy, platform fee, match weights | Built |
| `/admin/security` | any staff | Own MFA and sessions; staff sign-in activity | Built |
| `/admin/audit-log` | `audit.read` | Append-only audit trail | Built |
| `/admin/staff` | `staff.manage` (super admin) | Staff accounts and permission grants | Planned (production) |

Rendering: Client (preview) → dynamic + TanStack Query (production).

## Route handlers, metadata routes and special files

| Path | Purpose | Status |
|---|---|---|
| `POST /api/contact` | Support form: Zod validation (shared with the form), honeypot, 5 requests / 10 min per IP (in-memory), `EmailService` that logs to the console in the preview | Built (Dynamic) |
| `POST /api/revalidate` | CMS/tutor cache-tag revalidation, `REVALIDATE_SECRET` | Planned (production) |
| `/sitemap.xml` (`app/sitemap.ts`) | Static pages, subjects, metros with supply, active tutors, blog posts | Planned |
| `/robots.txt` (`app/robots.ts`) | Disallow `/dashboard`, `/admin`, `/onboarding`, `/api` | Planned |
| `opengraph-image` | Default and per-tutor/subject OG images | Planned |
| `not-found.tsx`, `error.tsx`, `global-error.tsx`, `loading.tsx` | Branded 404/500 and route-level loading states | Planned |
| `/lesson/[bookingId]` | Optional integrated lesson room (flag `online_lessons`); today the meeting link is revealed on `/dashboard/bookings/[id]` | Planned (optional) |

## Deep links used by notifications

These hrefs are generated by store actions and must remain stable: `/dashboard/bookings/{id}`, `/dashboard/messages?c={conversationId}`, `/dashboard/requirements/{id}`, `/dashboard/applications`, `/dashboard/reviews`, `/dashboard/progress`, `/dashboard/homework`, `/dashboard/verification`, `/dashboard/notifications`, `/tutor-jobs/{id}`, `/tutors/{slug}?book=trial#book`, `/login?next={path}`.
