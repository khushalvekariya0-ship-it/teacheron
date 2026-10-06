# TutorLink

**Find the right tutor. Learn with confidence.** TutorLink is a US tutoring marketplace that connects students and parents with qualified tutors for online and in-person lessons — search and transparent matching, tutor jobs, messaging, scheduling and payments, learning progress, and a full trust & safety console for staff.

> **Preview build.** This repository is a complete frontend running on **fictional sample data**. All state (accounts, bookings, messages, payments) lives **only in your browser's localStorage** — nothing is sent to a server, **no real payments are taken**, and no emails or SMS are sent. Tutors, reviews, ratings and figures are illustrative and disclosed by the banner at the top of every public page. The production architecture (NestJS API, PostgreSQL, Stripe, …) is specified in [`docs/`](docs/ARCHITECTURE.md).

## Quick start

Requires **Node.js 20.9 or later**.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. If port 3000 is already in use, Next.js picks the next free port (for example 3001) — use the URL printed in the terminal.

No environment variables are needed for the preview. [`.env.example`](.env.example) lists everything the production system will need.

## Demo accounts

The demo accounts, sample tutors and sample bookings are only included when `NEXT_PUBLIC_SAMPLE_DATA=true` is set at build time (`.env.local` locally, or the project's environment variables on Vercel). Without it the site builds empty, as it would on launch day. Password-reset and verification emails are not sent; each one appears on the page as a "preview inbox" card with the link, and the Google / Apple / Facebook / SSO buttons open an account picker that stands in for the provider's window.

Sign in with one click from **`/login`** (demo account picker), or with the email below and the password **`tutorlink-demo`**.

| Role | Name | Email | What they have |
|---|---|---|---|
| Student | Jordan Lee | `jordan.lee@example.com` | 12th grader in Chicago; chemistry lessons (one starts about 10 minutes after the demo is first opened), a pending trial, favorites, learning goals |
| Parent | Dana Whitaker | `dana.whitaker@example.com` | Brooklyn; two children — Noah (7th grade, pre-algebra) and Ava (4th grade, reading and Spanish); completed lessons, homework, progress notes |
| Tutor | Sarah Chen | `sarah.chen@example.com` | Math and SAT tutor in New York on the Professional plan; pending booking requests, a lesson ready to be marked complete, job board, credits, reviews |
| Administrator | Morgan Hayes | `morgan.hayes@tutorlink.example` | Every staff permission; MFA shown as enabled |
| Support staff | Sam Ortiz | `sam.ortiz@tutorlink.example` | Limited permissions: users (read), bookings, reports, disputes, payments (read) |

Sample bookings are generated relative to the moment you first open the demo, so dashboards always show a realistic mix of past, live and upcoming lessons. **Reset demo data** in the dashboard sidebar (or clearing the `tutorlink-preview` localStorage key) restores the original state. You can also register new student, parent or tutor accounts; they exist only in your browser.

## Feature tour

**Visitors** — Search tutors by subject, grade, ZIP and radius, online or in person, schedule, price, experience, language, learning support and verification; sort by best match, rating, price or experience. Open a profile to see verification checks, education, reviews, rates, trial terms and live availability in your time zone. Try **Help me find a tutor** (`/concierge`): describe what you need in plain English and see a shortlist where every match factor and weight is explained. Browse subjects, locations, the tutor job board, pricing, FAQ and blog.

**Students (Jordan)** — Book a trial or regular lesson from a tutor profile, apply a promo code (`WELCOME15`, `FALL10`), and see the cancellation policy before confirming. From the booking page: cancel (with the policy refund shown), reschedule, join the online lesson when the link unlocks 15 minutes before the start, report a tutor no-show, open a dispute, or leave a review once the lesson is completed. Message tutors (phone numbers and emails are masked automatically), post a requirement, track goals and homework, save favorites and compare up to three tutors.

**Parents (Dana)** — Everything students can do, on behalf of each child: manage child profiles, post requirements per child, book lessons for a specific child, and follow each child's lessons, homework and progress notes.

**Tutors (Sarah)** — Accept or decline requests, start and complete lessons, report student no-shows, reschedule. Browse student jobs and apply (each application spends a lead credit), track applications, manage the public profile, weekly availability, date exceptions, booking rules and trial settings, write progress notes, assign and review homework, respond to reviews, and view earnings, plan and credits. New tutors go through a guided onboarding wizard (`/onboarding/tutor`).

**Administrators (Morgan)** — Review verification documents (approve, or reject with a reason), suspend or reactivate users, moderate reports and reviews, open reported conversations (a reason is required and every access is audit-logged), resolve disputes with full or partial refunds or credit, manage bookings, payments, plans, coupons, feature flags, booking policy and the platform fee, and read the audit log.

**Support staff (Sam)** — The same console filtered to Sam's permissions. Sam can work disputes but cannot resolve them with a refund (requires `payments.refund`), cannot review verification, and cannot change settings — try it to see the permission model in action.

## Project structure

```text
src/
  app/
    (site)/          Public marketing, search, tutor profiles, jobs, content (Navbar + Footer)
    (auth)/          Login, register, forgot password
    onboarding/      Tutor onboarding wizard
    dashboard/       Student, parent and tutor workspace (role-aware)
    admin/           Staff console (permission-filtered)
    api/             Route handlers (support contact form)
  components/
    ui/              Design-system primitives (Radix + cva): Button, Field, Dialog, Sheet, DataTable …
    motion/          Motion primitives (Reveal, Stagger, WordReveal, CountUp …)
    charts/          Single-series charts and stat tiles
    domain/          TutorCard, SlotPicker, status badges, useTutorActions
    <feature>/       home, marketing, content, search, tutor-profile, booking, concierge,
                     requirements, jobs, auth, onboarding, dashboard, admin, layout
  lib/
    types.ts         Domain types (money in integer cents, UTC ISO timestamps)
    booking.ts       Booking state machine, refund rules, meeting-link window
    matching.ts      Transparent match scoring and natural-language parsing
    search.ts        Tutor search URL contract, filtering and sorting
    time.ts          DST-safe time-zone math and slot generation
    permissions.ts   Roles, staff permissions, booking actors
    format.ts        Money and date formatting helpers
    data/            Fictional sample data (tutors, reviews, users, catalog, metros, content, platform defaults)
    store/           zustand store: every business rule as an action returning Result<T>
docs/                Architecture, routes, API, state machines, design system, roadmap, decisions
prisma/              Production PostgreSQL schema (not used by the preview)
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (Next.js + React Compiler rules) |

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Radix UI primitives with class-variance-authority · Framer Motion · zustand · React Hook Form + Zod · Lucide icons · Geist fonts.

Production target: Next.js on Vercel; NestJS REST API + Socket.IO, PostgreSQL + Prisma, Redis, BullMQ, Algolia, S3 on AWS; Stripe + Stripe Connect, Google Maps/Places, Resend, Twilio, Zoom/Google Meet, Sentry, PostHog — each behind an interface.

## Ground rules

- Money is always integer cents; timestamps are stored in UTC and shown in the viewer's time zone.
- UI never sets statuses directly — it calls a store action, which validates the actor and business rules and returns `{ ok: true, data } | { ok: false, error }`. That contract is the seam for swapping in the real API.
- Search and matching are transparent; featured placement never changes ranking.
- Sample content must never be presented as real: no invented credentials, reviews or statistics.

## Documentation

| Document | Contents |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | Preview vs production, system diagram, backend modules, key journeys, integration interfaces, security, reliability, API swap plan |
| [Routes](docs/ROUTES.md) | Every page and route with audience, status and rendering |
| [API](docs/API.md) | REST `/v1` endpoints, errors, idempotency, webhooks, WebSocket events, permission matrix |
| [State machines](docs/STATE_MACHINES.md) | Booking, requirement, application, verification, dispute, payment, payout lifecycles |
| [Design system](docs/DESIGN_SYSTEM.md) | Tokens, typography, motion, components, accessibility, responsive patterns |
| [Roadmap](docs/ROADMAP.md) | Phase checklist: what the preview demonstrates vs what needs the backend |
| [Decisions](docs/DECISIONS.md) | Policy defaults and open questions for the product owner |
| [Frontend guide](docs/FRONTEND_GUIDE.md) | How to build pages in this repo |
| [Data model](prisma/schema.prisma) | Production PostgreSQL schema |
