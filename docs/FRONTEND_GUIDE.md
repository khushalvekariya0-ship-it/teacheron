# Frontend guide

How pages in this repo are built. Read this before adding or changing a page.

## Stack & framework rules

- **Next.js 16 (App Router), React 19.2, Tailwind CSS v4, TypeScript strict.** Turbopack is the default bundler.
- `params` and `searchParams` are **Promises** in pages and layouts — `const { slug } = await props.params`. Use the global helpers `PageProps<"/tutors/[slug]">` and `LayoutProps<"/">`.
- `useSearchParams()` must sit inside a `<Suspense>` boundary (wrap the client component that calls it).
- Middleware is now `proxy.ts`. We don't use one yet.
- Pages that need `metadata` stay **server components** and render a client "view" component (`"use client"`) for interactivity. A file cannot both export `metadata` and be `"use client"`.
- ESLint runs the React Compiler rules. **Never call `setState` synchronously inside `useEffect`.** Derive values during render, use the "reset on prop change" pattern (`if (prev !== value) { setPrev(value); setX(...) }`), or `useSyncExternalStore` for browser-only values.
- Lucide v1 has **no brand icons** (Twitter, GitHub, etc.). Check an icon exists before using it.

## Design rules

Editorial, like a well-set magazine: a warm charcoal page with cream type (the default theme), or the same page in cream with charcoal type (the "light" theme). Serif headlines with one italic word, a sans for reading, a mono for labels and numbers. Square corners and hairlines; one burnt-orange accent for links, markers and selected states; the main button is a solid block of the text colour. The reference is mnhafinancials.com (the client's request on 2026-10-06).

- **Tokens only.** Use the Tailwind tokens from `src/app/globals.css`: `bg-page` (section background), `bg-surface` (cards), `bg-canvas`, `bg-sunken`, `text-ink`, `text-ink-2`, `text-muted`, `text-subtle` (icons and placeholders only, too low-contrast for text), `border-line`, `border-line-strong`, `bg-navy`/`text-navy`, `bg-navy-50`, `bg-brand`/`text-brand`, `bg-brand-soft`, and the status tokens `success`, `warning` and `danger` (each with `-50` and `-200` variants). Don't hard-code hex values in components.
- **Charcoal is the default; both themes are the same tokens.** `.dark` on `<html>` (applied by the head script unless the visitor chose "light"; toggle: `DarkModeToggle`, state: `useTheme`/`setTheme` in `@/lib/theme`) swaps every token, so pages need no theme styles of their own. That only works if you never write `bg-white`, `text-black` or a hex for a themed surface — use `bg-surface` / `text-ink`. On an always-dark block (`bg-night`, `bg-brand-deep`) use `text-white`; on an ink fill use `text-on-ink`; on an orange fill use `text-on-brand`.
- **Type.** `h1`, `h2` and anything with `font-heading` are the serif at its only weight — a global rule overrides `font-bold` and `tracking-*` on them, so don't fight it; `h3` and below stay in the sans. The italic word of a headline is `<em>` (or the `accent` prop of `SectionHeading` / `WordReveal`). Labels, numbers and small print use `mono-label` or `font-mono`. The section label (`Eyebrow` / `kicker`) numbers itself in page order ("01", "02" …) with a CSS counter — don't add numbers by hand.
- **Shapes.** Every radius token is 0 and `rounded-full` is squared globally, so there are no pills or circles anywhere — avatars, markers and buttons are all square. Shadows are off except on floating layers; hairlines (`border-line`) separate things.
- **Accent.** Burnt orange (`brand`) is for links, the kicker number, markers and selected states. The main action is the `cta` button variant (a solid block of ink); `secondary` is the hairline outline; `brand` is an orange fill. One `cta` per screen.
- **Illustration.** `WaveArt` (`@/components/marketing/WaveArt`) is the site's only decoration: layered colour bands with film grain, drawn in SVG. Use it full-bleed beside or behind a section (dim it under text). `glass` / `glass-card` are the frosted navbar and floating cards; `bento` is the six-column feature grid. No emoji, no gradients other than a faint wash.
- Typography is Geist. Page titles use `text-2xl font-semibold tracking-[-0.025em]` (dashboard) or larger marketing sizes with tight tracking. Body text is `text-sm` / `text-[15px]` with `text-muted` for supporting copy. Use `tabular-nums` for numbers in columns.
- Radii: controls `rounded-md` (8px), cards `rounded-xl`, big panels `rounded-2xl`. Borders are 1px `border-line`. Shadows are only `shadow-xs` / `shadow-sm` for cards, and `shadow-lg`/`xl` for overlays.
- Spacing is generous. The marketing container is `container-page` (max 1280px). Sections use `py-20 sm:py-24 lg:py-28`.
- **Motion** comes from `@/components/motion`: `Reveal`, `Stagger`/`StaggerItem`, `WordReveal`, `CountUp`, `Marquee`, plus `motion`/`AnimatePresence` re-exports. Use one easing curve (`EASE`) with subtle distances (8–16px). Use `layoutId` for animated selection indicators. Everything respects reduced motion automatically.
- **Mobile is designed, not shrunk.** Use filter drawers (`Sheet side="bottom"` or `"right"`), stacked tables (`DataTable` does this), sticky bottom action bars for booking, and touch targets of at least 40px.
- **Accessibility (WCAG 2.2 AA).** Every input has a label (`Field` wires label, hint, error and aria attributes). Buttons have discernible names. Focus stays visible. Dialogs come from Radix. Never use color alone to carry meaning.

## Components (use these, don't re-invent)

| Import | What |
|---|---|
| `@/components/ui/Button` | `Button` (variants: primary, brand (orange), **cta** (solid ink block, one per screen), secondary (hairline), outline, ghost, subtle, danger, danger-outline, link; sizes xs–lg, icon, icon-sm; `loading`; `asChild` for links) |
| `@/components/ui/Input` | `Field`, `Input` (icon, suffix, prefixText), `Textarea` (showCount), `Select` (native, `options`), `Label` |
| `@/components/ui/Controls` | `Checkbox` (label/description), `Switch`, `RadioCards`, `ChipGroup` (multi-select chips), `Segmented` (animated single select), `Progress` |
| `@/components/ui/Overlay` | `Dialog` + `DialogContent`(title, description, size) + `DialogBody` + `DialogFooter` + `DialogClose`; `ConfirmDialog`; `Sheet` + `SheetContent`(side, title, footer); `DropdownMenu*`; `Tooltip`; `Popover*` |
| `@/components/ui/Disclosure` | `Accordion*`, `Tabs`, `TabsList`, `TabsTrigger`(count), `TabsContent` |
| `@/components/ui/Card` | `Card`(interactive), `CardHeader`(title, description, action), `CardContent`, `CardFooter`, `Separator`, `DetailRow` |
| `@/components/ui/Badge` | `Badge` tone: neutral, accent, solid, success, warning, danger, outline; size sm/md; `dot` |
| `@/components/ui/Avatar` | Photo when `src` is given, otherwise an initials tile (`name`, `src`, `tone`, `size`, `verified`). For a tutor always pass `src={tutor.photoUrl}` with `tone={tutor.tone}` |
| `@/components/ui/StarRating` | `StarRating` (shows "New · no reviews yet" when null), `StarInput` |
| `@/components/ui/States` | `EmptyState`, `ErrorState`, `UnauthorizedState`, `ForbiddenState`, `InlineAlert` |
| `@/components/ui/Skeleton` | `Skeleton`, `TutorCardSkeleton`, `PageSkeleton` |
| `@/components/ui/DataTable` | Responsive sortable/paginated/selectable table (`Column<T>`) |
| `@/components/ui/Toast` | `toast(...)`, `toast.success`, `toast.error` |
| `@/components/charts` | `ColumnChart`, `AreaChart`, `Sparkline`, `StatTile`, `BarList` (single series, navy) |
| `@/components/domain/TutorCard` | `TutorCard` (layout "grid" or "row", optional `distance`, `footer`); the photo plays the tutor's 15-second intro on hover |
| `@/components/domain/TutorIntro` | `IntroReel` (uploaded clip, or a reel built from the profile), `OnlineNow` badge, `useOnlineNow(tutor)` |
| `@/components/domain/BookingCalendar` | Month calendar + start times from real availability (`tutor`, `durationMin`, `value`, `onChange`) |
| `@/components/home/SmartMatchQuiz` | Two-question popup → three best matches from `rankTutors` (`open`, `onOpenChange`, `initialSubject`) |
| `@/components/wallet/*` | `WalletDrawer` (balance, top-up, activity), `WalletButton` (navbar pill), `formatCredits` |
| `@/components/classroom/*` | `ClassroomView` (route `/classroom/[id]`), `VideoStage`, `Whiteboard`, `ChatPanel` |
| `@/components/domain/Badges` | `VerifiedBadge`, `VerificationChecks`, `VerificationStatusBadge`, `BookingStatusBadge`, `PaymentStatusBadge`, label maps |
| `@/components/domain/useTutorActions` | save / compare / contact / book behaviour with auth redirects |
| `@/components/marketing/Section` | `Section`(tone), `SectionHeading`, `Eyebrow`, `ArrowLink` (ink text on an orange underline), `PageHero`, `CtaBand` (cream card over the wave art), `FeatureItem` |
| `@/components/marketing/WaveArt` | The wave illustration (`drift` to animate) |
| `@/components/dashboard/Shell` | `PageHeader`(title, description, actions, back, eyebrow), `RoleGate`(roles), `PermissionGate`(permission) |

## Data & state

- **Photos** live in `public/images` (site imagery, `subject-areas/`, `tutors/` for the sample tutors' stock portraits). Every file is listed with its photographer in `public/images/CREDITS.md` — add a row when you add a photo, and give a replaced photo a new file name so caches don't serve the old one.
- **Sample data** lives in `src/lib/data/*` (catalog, geo, tutors, reviews, users, requirements, platform, content). It is fictional and the UI discloses this through the preview banner. **Never invent** qualifications, reviews, ratings, availability, verification or statistics in UI copy. Show what's in the data, or nothing.
- **App state** lives in `useApp` (`src/lib/store/index.ts`), a persisted zustand store. Every mutation is an action that validates auth, ownership and business rules and returns `Result` (`{ ok: true, data } | { ok: false, error }`). Always handle `ok: false` with `toast.error(res.error)` or an inline error. **Never mutate state directly or set statuses yourself** — call the action.
- **zustand v5 rule:** a selector passed to `useApp` must return a stable reference (a state slice or a primitive). Never build arrays or objects inside the selector — that loops forever. Select raw slices, then derive with `useMemo`.
- Hooks (`src/lib/store/hooks.ts`): `useSession()` (current user or null), `useHydrated()`, `useTutors()`, `useTutor(idOrSlug)`, `useReviews()`, `useFlag(key)`, `useCreditBalance(tutorId)`, `useUnreadMessages()`, `useUnreadNotifications()`, `useNow(ms)`, `useViewerTimezone()`.
- The store rehydrates **after mount**. Anything that depends on persisted data or the current time must wait for `useHydrated()`. The dashboard shell already does this for everything under `/dashboard` and `/admin`.
- **Study Credits** (learner wallet): balance with `useWalletBalance()`, top up with `topUpWallet(packId, "card" | "upi")`, pay with `createBooking({ …, payWith: "wallet" })`. The store debits the wallet and sends every refund for such a lesson back to it — never adjust `walletTransactions` yourself.
- Money is **integer cents**. Format with `formatCents`. Compute with `sessionPrice`, `applyBps` and `percentOf` from `@/lib/format`. Never use float math for money.
- Time: store UTC ISO strings. Render with `formatDateTime(iso, tz)` and similar, using `useViewerTimezone()`. Slot generation lives in `@/lib/time` (`generateSlots`, `groupSlotsByDay`, `nextOpening`).
- Bookings follow the state machine in `@/lib/booking` (`availableTransitions`, `canTransition`, `ACTION_LABEL`, `STATUS_META`, `cancellationRefund`, `policySummary`, `meetingLinkVisible`). Use `actorFor(user, booking)` from `@/lib/permissions` to get the viewer's actor.
- Search uses the URL contract in `@/lib/search` (`parseTutorSearch`, `toQueryString`, `searchTutors`, `describeSearch`). Matching is `@/lib/matching` (`rankTutors`, `scoreTutor`, `parseNaturalLanguage`). These are transparent — show the factors.

## UX states

Every important view handles **loading** (skeleton), **empty** (`EmptyState` with a next action), **error**, **unauthorized** and **forbidden**, and **success** (toast or inline confirmation). Destructive actions go through `ConfirmDialog`. Forms validate on submit and on blur, show inline errors, and disable the submit button while loading. No button may look functional without doing something real.
