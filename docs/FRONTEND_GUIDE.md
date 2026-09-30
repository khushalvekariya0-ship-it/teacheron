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

Clean, restrained, premium. Less color, more hierarchy.

- **Tokens only.** Use the Tailwind tokens from `src/app/globals.css`: `bg-surface`, `bg-canvas`, `bg-sunken`, `text-ink`, `text-ink-2`, `text-muted`, `text-subtle` (icons and placeholders only, too low-contrast for text), `border-line`, `border-line-strong`, `bg-navy`/`text-navy`, `bg-navy-50`, and the status tokens `success`, `warning` and `danger` (each with `-50` and `-200` variants). Don't hard-code hex values in components.
- **Navy is the only accent**, used sparingly: primary buttons, active nav, links and selected states. Never use gradients, bright colors, emoji or decorative blobs.
- Typography is Geist. Page titles use `text-2xl font-semibold tracking-[-0.025em]` (dashboard) or larger marketing sizes with tight tracking. Body text is `text-sm` / `text-[15px]` with `text-muted` for supporting copy. Use `tabular-nums` for numbers in columns.
- Radii: controls `rounded-md` (8px), cards `rounded-xl`, big panels `rounded-2xl`. Borders are 1px `border-line`. Shadows are only `shadow-xs` / `shadow-sm` for cards, and `shadow-lg`/`xl` for overlays.
- Spacing is generous. The marketing container is `container-page` (max 1280px). Sections use `py-20 sm:py-24 lg:py-28`.
- **Motion** comes from `@/components/motion`: `Reveal`, `Stagger`/`StaggerItem`, `WordReveal`, `CountUp`, `Marquee`, plus `motion`/`AnimatePresence` re-exports. Use one easing curve (`EASE`) with subtle distances (8–16px). Use `layoutId` for animated selection indicators. Everything respects reduced motion automatically.
- **Mobile is designed, not shrunk.** Use filter drawers (`Sheet side="bottom"` or `"right"`), stacked tables (`DataTable` does this), sticky bottom action bars for booking, and touch targets of at least 40px.
- **Accessibility (WCAG 2.2 AA).** Every input has a label (`Field` wires label, hint, error and aria attributes). Buttons have discernible names. Focus stays visible. Dialogs come from Radix. Never use color alone to carry meaning.

## Components (use these, don't re-invent)

| Import | What |
|---|---|
| `@/components/ui/Button` | `Button` (variants: primary, secondary, outline, ghost, subtle, danger, danger-outline, link; sizes xs–lg, icon, icon-sm; `loading`; `asChild` for links) |
| `@/components/ui/Input` | `Field`, `Input` (icon, suffix, prefixText), `Textarea` (showCount), `Select` (native, `options`), `Label` |
| `@/components/ui/Controls` | `Checkbox` (label/description), `Switch`, `RadioCards`, `ChipGroup` (multi-select chips), `Segmented` (animated single select), `Progress` |
| `@/components/ui/Overlay` | `Dialog` + `DialogContent`(title, description, size) + `DialogBody` + `DialogFooter` + `DialogClose`; `ConfirmDialog`; `Sheet` + `SheetContent`(side, title, footer); `DropdownMenu*`; `Tooltip`; `Popover*` |
| `@/components/ui/Disclosure` | `Accordion*`, `Tabs`, `TabsList`, `TabsTrigger`(count), `TabsContent` |
| `@/components/ui/Card` | `Card`(interactive), `CardHeader`(title, description, action), `CardContent`, `CardFooter`, `Separator`, `DetailRow` |
| `@/components/ui/Badge` | `Badge` tone: neutral, accent, solid, success, warning, danger, outline; size sm/md; `dot` |
| `@/components/ui/Avatar` | Initials avatar (`name`, `tone`, `size`, `verified`) |
| `@/components/ui/StarRating` | `StarRating` (shows "New · no reviews yet" when null), `StarInput` |
| `@/components/ui/States` | `EmptyState`, `ErrorState`, `UnauthorizedState`, `ForbiddenState`, `InlineAlert` |
| `@/components/ui/Skeleton` | `Skeleton`, `TutorCardSkeleton`, `PageSkeleton` |
| `@/components/ui/DataTable` | Responsive sortable/paginated/selectable table (`Column<T>`) |
| `@/components/ui/Toast` | `toast(...)`, `toast.success`, `toast.error` |
| `@/components/charts` | `ColumnChart`, `AreaChart`, `Sparkline`, `StatTile`, `BarList` (single series, navy) |
| `@/components/domain/TutorCard` | `TutorCard` (layout "grid" or "row", optional `distance`, `footer`) |
| `@/components/domain/Badges` | `VerifiedBadge`, `VerificationChecks`, `VerificationStatusBadge`, `BookingStatusBadge`, `PaymentStatusBadge`, label maps |
| `@/components/domain/useTutorActions` | save / compare / contact / book behaviour with auth redirects |
| `@/components/marketing/Section` | `Section`(tone), `SectionHeading`, `ArrowLink`, `PageHero`, `CtaBand`, `FeatureItem` |
| `@/components/dashboard/Shell` | `PageHeader`(title, description, actions, back, eyebrow), `RoleGate`(roles), `PermissionGate`(permission) |

## Data & state

- **Sample data** lives in `src/lib/data/*` (catalog, geo, tutors, reviews, users, requirements, platform, content). It is fictional and the UI discloses this through the preview banner. **Never invent** qualifications, reviews, ratings, availability, verification or statistics in UI copy. Show what's in the data, or nothing.
- **App state** lives in `useApp` (`src/lib/store/index.ts`), a persisted zustand store. Every mutation is an action that validates auth, ownership and business rules and returns `Result` (`{ ok: true, data } | { ok: false, error }`). Always handle `ok: false` with `toast.error(res.error)` or an inline error. **Never mutate state directly or set statuses yourself** — call the action.
- **zustand v5 rule:** a selector passed to `useApp` must return a stable reference (a state slice or a primitive). Never build arrays or objects inside the selector — that loops forever. Select raw slices, then derive with `useMemo`.
- Hooks (`src/lib/store/hooks.ts`): `useSession()` (current user or null), `useHydrated()`, `useTutors()`, `useTutor(idOrSlug)`, `useReviews()`, `useFlag(key)`, `useCreditBalance(tutorId)`, `useUnreadMessages()`, `useUnreadNotifications()`, `useNow(ms)`, `useViewerTimezone()`.
- The store rehydrates **after mount**. Anything that depends on persisted data or the current time must wait for `useHydrated()`. The dashboard shell already does this for everything under `/dashboard` and `/admin`.
- Money is **integer cents**. Format with `formatCents`. Compute with `sessionPrice`, `applyBps` and `percentOf` from `@/lib/format`. Never use float math for money.
- Time: store UTC ISO strings. Render with `formatDateTime(iso, tz)` and similar, using `useViewerTimezone()`. Slot generation lives in `@/lib/time` (`generateSlots`, `groupSlotsByDay`, `nextOpening`).
- Bookings follow the state machine in `@/lib/booking` (`availableTransitions`, `canTransition`, `ACTION_LABEL`, `STATUS_META`, `cancellationRefund`, `policySummary`, `meetingLinkVisible`). Use `actorFor(user, booking)` from `@/lib/permissions` to get the viewer's actor.
- Search uses the URL contract in `@/lib/search` (`parseTutorSearch`, `toQueryString`, `searchTutors`, `describeSearch`). Matching is `@/lib/matching` (`rankTutors`, `scoreTutor`, `parseNaturalLanguage`). These are transparent — show the factors.

## UX states

Every important view handles **loading** (skeleton), **empty** (`EmptyState` with a next action), **error**, **unauthorized** and **forbidden**, and **success** (toast or inline confirmation). Destructive actions go through `ConfirmDialog`. Forms validate on submit and on blur, show inline errors, and disable the submit button while loading. No button may look functional without doing something real.
