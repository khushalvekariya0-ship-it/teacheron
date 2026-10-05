# TutorLink design system

> **Current direction (October 2026).** Off-white page with a soft pastel mesh behind heroes, midnight-navy ink, deep indigo (`brand`) for selected states, electric coral (`cta`) for the one action per screen, glass navbar and floating cards, a bento feature grid, and an OLED-black dark theme switched by `.dark` on `<html>`. The token values in `src/app/globals.css` are the source of truth; the palette table in section 2 predates this and lists the earlier neutral values. Principles 1 and 4 below are superseded by the rules in [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md#design-rules). Principle 3 changed too: the site uses real photography (Unsplash, credited in `public/images/CREDITS.md`), including stock portraits for the sample tutors; statistics, ratings, badges and testimonials are still never invented.

Clean, restrained, premium: less colour, more hierarchy. Tokens are defined once in `src/app/globals.css` (Tailwind CSS v4 `@theme`) and consumed as Tailwind utilities (`bg-surface`, `text-muted`, `border-line`, `rounded-xl` …). Components live in `src/components/ui`, `src/components/motion` and `src/components/charts`. How to use them day to day: [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md).

## 1. Principles

1. **Navy is the only accent** and it is rare: primary buttons, active navigation, links, selected states, focus rings, single-series charts.
2. **Hierarchy through type, weight and space**, not colour. Supporting copy is `text-muted`; structure comes from 1 px `line` borders and soft surfaces.
3. **Honest content.** No stock photography (initials avatars), no invented stats, ratings, badges or testimonials. Empty values render as "New · no reviews yet", not zero stars.
4. **No decoration for its own sake.** No gradients, bright colours, emoji or decorative blobs. The only background textures are the faint `bg-dot-grid` / `bg-line-grid` patterns behind heroes, always masked.
5. **Motion explains change** (entering, selecting, opening) and is always optional.
6. **Mobile is designed, not shrunk.**

## 2. Colour

### Palette

| Token | Hex | Utility | Use |
|---|---|---|---|
| `surface` | `#ffffff` | `bg-surface` | Page and card background (body default) |
| `canvas` | `#f8f9fa` | `bg-canvas` | Alternate sections, footer, table headers, hover rows |
| `sunken` | `#f1f3f5` | `bg-sunken` | Wells, skeleton base, ghost-button hover |
| `ink` | `#171717` | `text-ink` | Headings and primary text (17.9 : 1 on white) |
| `ink-2` | `#404040` | `text-ink-2` | Body copy, secondary buttons, nav links (10.4 : 1) |
| `muted` | `#737373` | `text-muted` | Supporting text, captions, metadata (4.7 : 1 — AA for body text) |
| `subtle` | `#a3a3a3` | `text-subtle` | **Decorative icons and section labels only** (2.5 : 1 — never for information-bearing text) |
| `line` | `#e5e7eb` | `border-line` | Default 1 px borders and dividers |
| `line-strong` | `#d4d4d8` | `border-line-strong` | Control borders, hovered cards |
| `navy` | `#172554` | `bg-navy`, `text-navy` | Primary actions, active/selected, links, focus (14.7 : 1) |
| `navy-hover` / `navy-press` | `#22346e` / `#0f1a3d` | — | Primary button hover / active |
| `navy-50` / `100` / `200` | `#eff3f9` / `#dfe6f1` / `#c3cfe3` | `bg-navy-50` … | Selected backgrounds, accent badges, active nav pill, text selection |
| `success` (+ `-50`, `-200`) | `#15803d` (`#f0fdf4`, `#bbf7d0`) | `text-success`, `bg-success-50` | Completed, verified, paid (5.0 : 1) |
| `warning` (+ `-50`, `-200`) | `#b45309` (`#fffbeb`, `#fde68a`) | `text-warning` | Pending, disputed, attention needed (5.0 : 1) |
| `danger` (+ `-50`, `-200`) | `#b91c1c` (`#fef2f2`, `#fecaca`) | `text-danger` | Errors, destructive actions, no-shows, failed payments (6.5 : 1) |
| `star` | `#d97706` | `text-star` | Star-rating glyphs only (3.2 : 1 — graphic, always paired with the numeric rating) |

Contrast ratios are against `#ffffff`.

### Usage rules

- Use tokens only; never hard-code hex in components. Known exceptions to clean up: `Section tone="dark"` (`#0f1115`), the tutor-promo panel in `home/Sections.tsx` (`#15181e`), chart grid lines (`#eef0f3`), avatar tone pairs, and the preview-banner status dot (`bg-emerald-400`). Promote them to tokens (`--color-night`, `--color-grid`, `--color-avatar-*`) when next touched.
- Status colours pair a tinted background with the solid text colour (`bg-success-50 text-success`) and always a text label — **colour never carries meaning alone**. Booking and payment states use `BookingStatusBadge` / `PaymentStatusBadge`, whose tones come from `STATUS_META`.
- Status tones: `neutral` (terminal/inactive), `accent` (active: confirmed, in progress), `success` (completed, verified), `warning` (pending, disputed), `danger` (no-show, failed).
- Dark sections (marketing only) use white text at 100 / 60 / 50 % opacity for title / body / eyebrow.
- The product ships in light mode. A dark theme would redefine the same token names; components need no changes.

## 3. Typography

Fonts: **Geist Sans** (`--font-sans`) for everything, **Geist Mono** (`--font-mono`) for codes and ids. Loaded with `next/font` (`display: swap`). Body enables stylistic sets `ss01`, `cv11`; line height 1.6. Headings are weight 600, line height 1.15, tracking −0.022em, `text-wrap: balance`; paragraphs use `text-wrap: pretty`.

| Role | Classes | Size |
|---|---|---|
| Marketing hero / page hero | `text-4xl sm:text-5xl lg:text-[3.5rem] lg:leading-[1.04] font-semibold tracking-[-0.035em]` | 36 → 56 px |
| Marketing section heading | `text-3xl sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08] tracking-[-0.03em]` | 30 → 44 px |
| Dashboard page title | `text-2xl font-semibold tracking-[-0.025em]` | 24 px |
| Card / section title | `text-base`–`text-lg font-semibold` | 16–18 px |
| Lead paragraph | `text-lg leading-relaxed text-muted` (hero) · `text-base sm:text-[17px]` (sections) | 16–18 px |
| Body | `text-sm` or `text-[15px]` | 14–15 px |
| UI dense text, nav | `text-[13px]`, `text-[13.5px]` | 13 px |
| Caption, meta, badges | `text-xs`, `text-[12.5px]`, `text-[11px]` | 11–12.5 px |
| Eyebrow | `.eyebrow` — 12 px, weight 500, `tracking-[0.08em]`, uppercase, `text-muted` | 12 px |
| Long-form (legal, blog, CMS) | `.prose-page` — max 68ch, line height 1.75, `h2` 22 px, `h3` 18 px, navy underlined links | — |

Numbers in tables, prices and stats use `tabular-nums` (or the `.tabular` utility).

## 4. Spacing and layout

- Tailwind's 4 px scale. Default gaps: 8/12/16 px inside components, 24–32 px between cards, generous whitespace everywhere.
- **Container:** `.container-page` — max width 1280 px, horizontal padding 16 px (mobile) / 24 px (≥ 640 px) / 32 px (≥ 1024 px).
- **Marketing sections:** `Section` → `py-20 sm:py-24 lg:py-28`; headings `mb-12 lg:mb-14`.
- **Cards:** `px-5 pt-5` headers, 20 px content padding.
- **Dashboard:** fixed sidebar on large screens, `Sheet` drawer below `lg`; content column with `PageHeader` (title, description, actions, optional back link and eyebrow).

## 5. Radii, borders, shadows

| Token | Value | Use |
|---|---|---|
| `rounded-xs` | 4 px | Tiny chips, inline code |
| `rounded-sm` | 6 px | `xs` buttons, skeleton blocks |
| `rounded-md` | 8 px | Controls: buttons, inputs, selects, nav items |
| `rounded-lg` | 10 px | Large buttons, menu items, icon tiles |
| `rounded-xl` | 14 px | Cards, dropdown panels, mega-menu |
| `rounded-2xl` | 18 px | Large panels, dialogs, hero visuals |
| `rounded-full` | — | Badges, avatars, count pills |

Borders are always 1 px (`border-line`, `border-line-strong` for controls and hover).

| Shadow | Use |
|---|---|
| `shadow-xs` | Resting cards, primary/secondary buttons |
| `shadow-sm` | Raised cards |
| `shadow-md` | Interactive card hover |
| `shadow-lg` | Popovers, dropdowns, toasts |
| `shadow-xl` | Dialogs, sheets, mega-menu |

## 6. Motion

One vocabulary, defined in `src/components/motion` and the `@theme` keyframes.

| Element | Duration | Easing |
|---|---|---|
| Scroll reveal (`Reveal`, `StaggerItem`) | 0.6–0.7 s, stagger 0.06 s, 14–16 px rise | `EASE` = `[0.22, 1, 0.36, 1]` (ease-out-quint) |
| Micro-interactions (buttons, hovers, colour) | 150–200 ms | ease-out |
| Button press | `active:scale-[0.985]` | — |
| Dropdown / popover in → out | 180 ms → 120 ms, 4 px drop | quint in, ease-in out |
| Dialog in → out | 260 ms → 150 ms, 12 px rise + 0.98 scale | `EASE_EXPO` = `[0.16, 1, 0.3, 1]` |
| Sheet in → out | 320 ms → 200 ms (from right, left or bottom) | expo in, ease-in out |
| Overlay fade | 200 ms → 150 ms | quint |
| Accordion | 260 ms open / 200 ms close | quint |
| Selection indicator | `layoutId` spring (bounce 0.15, 0.4 s) — dashboard nav, `Segmented`, tabs | spring |
| Numbers | `CountUp` 1.4 s | — |
| Logos / testimonials | `Marquee` 40 s linear, masked edges | linear |

Rules: travel distances stay within 8–16 px; nothing bounces except selection pills; entrance animations run once (`viewport.once`); headlines may use `WordReveal`. `MotionProvider` sets `reducedMotion="user"`, and `globals.css` collapses all CSS animations and transitions under `prefers-reduced-motion: reduce`. Never animate layout-critical content in a way that delays reading or interaction.

## 7. Component inventory

### Primitives — `src/components/ui`

| Component | Variants / API | Notes |
|---|---|---|
| `Button` | `primary`, `secondary`, `outline`, `ghost`, `subtle`, `danger`, `danger-outline`, `link` × `xs` (28 px), `sm` (32), `md` (40), `lg` (48), `icon` (40), `icon-sm` (32); `loading`, `asChild` | Focus ring navy 2 px offset 2; disabled at 50 % opacity |
| `Field`, `Input`, `Textarea`, `Select`, `Label` | Input `icon`, `suffix`, `prefixText`; Textarea `showCount`; native `Select` with `options` | `Field` wires label, hint, error, `aria-describedby`, `aria-invalid` |
| `Checkbox`, `Switch`, `RadioCards`, `ChipGroup`, `Segmented`, `Progress` | `Segmented` animates with `layoutId`; `Progress` tones navy/success | Radix-based |
| `Dialog*`, `ConfirmDialog`, `Sheet*`, `DropdownMenu*`, `Tooltip`, `Popover*` | `DialogContent` sizes; `SheetContent side="right\|left\|bottom"` with `footer` | Radix focus trapping and escape handling; destructive actions always use `ConfirmDialog` |
| `Accordion*`, `Tabs*` | `TabsTrigger count` | |
| `Card`, `CardHeader`, `CardContent`, `CardFooter`, `Separator`, `DetailRow` | `Card interactive` lifts 1 px with `shadow-md` | |
| `Badge` | tones `neutral`, `accent`, `solid`, `success`, `warning`, `danger`, `outline`; sizes `sm`, `md`; `dot` | |
| `Avatar` | sizes `xs`–`2xl`, `tone` (6 muted pairs), `verified`, `square` | Initials only in the preview |
| `StarRating`, `StarInput` | Null rating renders "New · no reviews yet" | |
| `EmptyState`, `ErrorState`, `UnauthorizedState`, `ForbiddenState`, `InlineAlert` | Alert tones info/warning/danger/success | Every important view uses these |
| `Skeleton`, `TutorCardSkeleton`, `PageSkeleton` | `.skeleton` shimmer 1.6 s | |
| `DataTable` | Sortable, paginated, selectable `Column<T>`; stacks into cards on mobile | |
| `Toast` / `Toaster` | `toast()`, `toast.success`, `toast.error` | Surface every `Result.error` |
| `Logo`, `LogoMark` | `compact` | |

### Motion and data display

| Module | Exports |
|---|---|
| `@/components/motion` | `MotionProvider`, `Reveal`, `Stagger`, `StaggerItem`, `WordReveal`, `CountUp`, `Marquee`, `PageTransition`, `EASE`, `EASE_EXPO` |
| `@/components/charts` | `ColumnChart`, `AreaChart`, `Sparkline`, `StatTile`, `BarList` — single series, navy, light grid, tabular numbers |

### Domain, layout and page composition

| Module | Exports |
|---|---|
| `domain/TutorCard` | Grid and row layouts, optional distance and footer |
| `domain/Badges` | `VerifiedBadge`, `VerificationChecks`, `VerificationStatusBadge`, `BookingStatusBadge`, `PaymentStatusBadge` |
| `domain/SlotPicker` | Day-grouped slots in the viewer's time zone |
| `domain/useTutorActions` | Save / compare / contact / book with sign-in redirects |
| `marketing/Section` | `Section` (`default`, `canvas`, `dark`), `SectionHeading`, `ArrowLink`, `PageHero`, `CtaBand`, `FeatureItem` |
| `home/*` | Homepage sections and `HeroSearch`, `HeroVisual` |
| `layout/*` | `Navbar` (mega-menus, mobile sheet), `Footer`, `PreviewBanner`, `DemoSwitcher`, `CompareTray` |
| `dashboard/*` | `DashboardShell`, `PageHeader`, `RoleGate`, `PermissionGate`, `ByRole`, `nav.ts` |
| Feature folders | `auth`, `booking`, `concierge`, `content`, `jobs`, `onboarding`, `requirements`, `search`, `tutor-profile`, `admin` compose the primitives above. They must not introduce new colours, radii, shadows or easing curves; anything reusable moves down into `ui` or `domain`. |

## 8. Accessibility (WCAG 2.2 AA)

- **Structure:** skip link to `#main`; one `h1` per page; landmark roles (`header`, `nav` with labels, `main`, `contentinfo`); `lang="en-US"`.
- **Labels:** every input has a visible label via `Field`; placeholders are examples, never the only label. Icon-only buttons have `aria-label`. Links say where they go.
- **Focus:** always visible (`:focus-visible` 2 px navy outline, 2 px offset); dialogs and sheets trap focus and restore it on close (Radix); menus close on Escape.
- **Colour and contrast:** body text ≥ 4.5 : 1 (`muted` is the lightest allowed text colour); non-text indicators ≥ 3 : 1. `subtle` and `line` are below 3 : 1, so they must not be the only cue for a control boundary or state — pair with a label, fill or `line-strong`.
- **Targets:** interactive targets ≥ 24 × 24 px (2.2 minimum); primary touch targets 40 px+ (`md` buttons, inputs). `sm`/`xs` buttons are for dense desktop tables.
- **State:** never colour alone — badges carry text, errors carry icons and messages, required fields are marked in text. Live regions announce toasts and async results.
- **Motion:** reduced motion respected globally; no auto-playing content without pause except the decorative logo marquee.
- **Time and money:** times show the time-zone abbreviation (`tzAbbrev`); prices are fully spelled currency (`$95`, `$95.50`).
- **Forms:** validate on blur and submit, keep input on error, disable submit while loading, and summarize errors for long forms.

## 9. Responsive patterns

Breakpoints are Tailwind defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280 px.

| Pattern | Mobile | Desktop |
|---|---|---|
| Main navigation | Menu button → `Sheet` with accordions | Mega-menus on hover/click |
| Dashboard navigation | Drawer (`Sheet side="left"`) | Fixed sidebar with section titles and badges |
| Search filters | Bottom sheet (`Sheet side="bottom"`) with apply bar | Left filter column |
| Tables | `DataTable` stacks rows into labelled cards | Sortable table |
| Booking | Sticky bottom action bar with price and CTA | Sticky side panel on the tutor profile (`#book`) |
| Compare | `CompareTray` collapses to a pill | Tray with up to three tutors |
| Grids | 1 column | 2–4 columns by content |
| Hero typography | 36 px | 56 px |
