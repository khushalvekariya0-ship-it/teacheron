# Roadmap

Four phases from the product brief. For each phase, **[x] Preview** items are demonstrated in the preview build with working UI and business logic (sample data, local-only state, no real money). **[ ] Backend** items need the production system described in [ARCHITECTURE.md](ARCHITECTURE.md). Page-level status is tracked in [ROUTES.md](ROUTES.md); where logic exists but its page is still being built, the item says "(page in progress)".

Cross-cutting prerequisites for every phase: approve [DECISIONS.md](DECISIONS.md), extract `src/lib` rules into a shared `@tutorlink/domain` package, and keep the store's `Result` contract as the API seam.

---

## Phase 1 — MVP marketplace

**Demonstrated in the preview**

- [x] Public site: home, how it works, for students / parents, become a tutor, pricing, about, contact form (`POST /api/contact` with validation and rate limit), FAQ, blog, subject index and subject pages, locations
- [x] SEO foundations: per-page metadata, canonical URLs, JSON-LD (Organization, WebSite search action, Person, FAQ, articles), `noindex` on private areas
- [x] Accounts and roles: register as student / parent / tutor with age bands (under-13 blocked, 13–17 parental-consent gate), password sign-in, one-click demo accounts, role-aware dashboards, staff console with permission-filtered navigation
- [x] Parent accounts with child profiles; bookings, requirements and conversations per child
- [x] Tutor onboarding wizard with autosave and duplicate-profile protection
- [x] Tutor profiles: bio, approach, subjects, levels, education, certifications, verification checks, reviews with responses, rates, trial terms
- [x] Tutor search with the full URL contract (subject, grade, location + radius, mode, schedule, price, experience, language, rating, category, learning support, verified, trial, instant, certified) and five sort orders; distance from ZIP
- [x] Transparent matching: concierge flow, natural-language parsing with confirmation, every factor and weight explained; featured status never affects order
- [x] Requirements (tutor jobs): drafts, publish validation, pause / close / delete rules; job board; instant job alerts for matching saved searches
- [x] Applications with lead-credit spending, owner status changes, tutor withdrawal
- [x] Messaging: one thread per tutor + account + child, contact-detail masking, attachment rules, block, report, unread counts
- [x] Favorites, compare (tray + side-by-side page, up to three tutors), saved searches (management page in progress)
- [x] Post-a-requirement flow, metro landing pages, legal and trust pages (privacy, terms, trust & safety)
- [x] Reviews: completed-lesson eligibility, one per booking, tutor response, rating computed from published reviews only
- [x] Trust & safety console: verification queue with required rejection notes, user suspension with reason, report and review moderation, audit log

**Requires the production backend**

- [ ] PostgreSQL + Prisma migrations from `prisma/schema.prisma`, including the raw-SQL exclusion constraint, partial unique indexes and CHECKs
- [ ] NestJS `auth`: argon2id, server sessions, email verification, password reset, TOTP MFA for staff, login rate limiting, session management
- [ ] Parental consent emails and the `/consent/[token]` grant flow
- [ ] Real catalog, metros and tutor data behind the admin catalog and CMS screens (UI exists on sample data); legal review of privacy, terms and trust & safety copy; safety-guidelines page
- [ ] Search service + Algolia index sync; Google geocoding and Places autocomplete
- [ ] S3 uploads with malware scanning for verification documents, requirement attachments and message files
- [ ] Socket.IO messaging with persistence, Redis adapter, server-side moderation detectors and the T&S flag queue
- [ ] Transactional email (Resend): verification, password reset, messages, applications
- [ ] `sitemap.xml`, `robots.txt`, OG images, branded 404/500 pages
- [ ] Sentry, PostHog, CI/CD, staging environment, backups and restore drills

## Phase 2 — Transactions and scheduling

**Demonstrated in the preview**

- [x] Tutor availability: weekly windows in the tutor's zone, date exceptions, booking rules (notice, advance window, buffer, session lengths, approval), trial configuration (availability page in progress)
- [x] DST-safe slot generation rendered in the viewer's time zone; next-opening hints
- [x] Booking flow for trial and regular lessons, instant vs approval, per-child booking for parents, coupon validation, server-style price recomputation, idempotent create, double-booking prevention with buffers
- [x] Booking state machine with actors and guards: accept, cancel with policy refunds, reschedule (new booking linked to the old), start, complete, no-shows after grace, disputes within the window, full history
- [x] Meeting-link reveal window for online lessons
- [x] Bookings list, booking detail, calendar
- [x] Simulated payment ledger: authorized → paid on confirm, refunds and partial refunds as ledger lines, payment-failed state
- [x] Tutor plans, credit packs and the lead-credit ledger (subscription, credits and earnings pages in progress)
- [x] Disputes: open with evidence, staff notes and statuses, resolution with full / partial refund, credit or no refund (refunds require `payments.refund`)
- [x] Admin: bookings, payments, monetization, coupons and promotions, booking policy, platform fee, feature flags
- [x] In-app notifications for every lifecycle event; notification preferences (pages in progress)

**Requires the production backend**

- [ ] Stripe PaymentIntents with manual capture, SetupIntents for later off-session charges, capture on confirmation, cancel/refund, 3-D Secure, webhooks with idempotent processing (resolve [D12](DECISIONS.md#d12-stripe-authorization-window))
- [ ] Stripe Connect Express onboarding, earnings availability after the dispute window, weekly transfers and payouts, payout-failure handling, chargeback handling
- [ ] Stripe Billing subscriptions with proration and credit grants per paid invoice
- [ ] BullMQ lifecycle jobs: reminders (24 h, 1 h), auto start/complete, request expiry ([D13](DECISIONS.md#d13-unanswered-booking-requests)), authorization refresh, verification expiry
- [ ] Zoom / Google Meet meeting creation and attendance webhooks
- [ ] Email and SMS delivery (Resend, Twilio) honouring preferences, quiet hours and digests
- [ ] Learner platform-credit ledger (dispute credits, tutor no-show credit) applied at checkout
- [ ] Fix preview gaps listed in [STATE_MACHINES.md](STATE_MACHINES.md#gaps-to-close-before-production): reschedule-chain limit, staff refund shortcuts, retry-payment re-authorization, policy snapshots, availability re-validation
- [ ] Optional: calendar feeds (ICS) and Google Calendar sync

## Phase 3 — Intelligent learning

**Demonstrated in the preview**

- [x] Learning goals with topic status, progress notes with understanding ratings, homework assign / submit / review, parent visibility of children's progress
- [x] Tutors can only write notes, goals and homework for learners they actually teach
- [x] Explainable matching model (`FactorResult[]`) ready to be stored as snapshots
- [x] Dashboard charts for learners, tutors and staff (sample data)

**Requires the production backend**

- [ ] Stored match snapshots per requirement and per concierge session; admin-tunable, versioned weights
- [ ] Daily / weekly saved-search and job-alert digests
- [ ] Homework file uploads, overdue job, reminders
- [ ] Monthly progress summaries for parents (email)
- [ ] AI-assisted matching behind `ai_matching` with real percentage rollout; rules-based scoring stays the source of truth ([D14](DECISIONS.md#d14-matching-weights-and-rules))
- [ ] Tutor analytics: response time and rate, rebooking rate, lesson outcomes

## Phase 4 — Expansion

**Demonstrated in the preview**

- [x] Feature-flag framework with flags for referrals, SMS and featured tutors (off or labelled)
- [x] Metro model, location index and metro landing pages as the base for local SEO
- [x] Coupon engine (percent / fixed, minimum spend, caps, expiry, first-booking only)

**Requires the production backend**

- [ ] Referral program with fraud checks ([D22](DECISIONS.md#d22-sms-referrals-and-tax))
- [ ] Featured / sponsored placements with disclosure ([D9](DECISIONS.md#d9-featured-placement-never-affects-ranking))
- [ ] Metro and subject × metro landing pages at scale, only where supply exists
- [ ] Lesson packages and group lessons
- [ ] Mobile apps (bearer-token auth, push notifications)
- [ ] School and organization accounts
- [ ] Spanish localization
- [ ] Additional payment methods (ACH, wallets via the Payment Element)
- [ ] Data warehouse and BI reporting
