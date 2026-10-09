"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import {
  ArrowRight, Bell, BookOpen, Briefcase, ChevronDown, ChevronRight, CircleHelp, ClipboardList, Compass, GitCompareArrows, Info, LayoutDashboard,
  LogOut, Mail, MapPin, Menu, MessagesSquare, Newspaper, Route, Search, ShieldCheck, Sparkles, Tag, UserRound, Users, Wallet, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/content/icons";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { BorderBeam } from "@/components/ui/button-border";
import { Avatar } from "@/components/ui/Avatar";
import { DarkModeToggle } from "@/components/ui/DarkModeToggle";
import { WalletButton } from "@/components/wallet/WalletButton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/Overlay";
import { useSession, useUnreadNotifications, useUnreadMessages } from "@/lib/store/hooks";
import { useApp } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/data/users";
import { homeFor } from "@/lib/permissions";
import { SUBJECTS, SUBJECT_CATEGORIES } from "@/lib/data/catalog";
import { SearchTrigger, openCommandPalette } from "./CommandPalette";

type NavLink = { label: string; href: string; description: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; href?: string; links?: NavLink[]; feature?: { title: string; body: string; href: string; cta: string }; mega?: "subjects" };

const NAV: NavGroup[] = [
  {
    label: "Find tutors",
    links: [
      { label: "Search tutors", href: "/tutors", description: "Filter by subject, grade, schedule and budget", icon: Search },
      { label: "Browse subjects", href: "/subjects", description: "Math, science, test prep, languages and more", icon: BookOpen },
      { label: "Tutors near you", href: "/locations", description: "In-person tutoring by city and ZIP code", icon: MapPin },
      { label: "Compare tutors", href: "/compare", description: "Side-by-side, up to three at a time", icon: GitCompareArrows },
      { label: "Post a requirement", href: "/post-requirement", description: "Describe what you need and let tutors apply", icon: ClipboardList },
    ],
    feature: { title: "Help me find a tutor", body: "Tell us what you need. We'll show a shortlist and explain exactly why each tutor matches.", href: "/concierge", cta: "Start matching" },
  },
  { label: "Subjects", mega: "subjects" },
  {
    label: "For tutors",
    links: [
      { label: "Become a tutor", href: "/become-a-tutor", description: "Create a profile and start teaching", icon: Sparkles },
      { label: "Find student jobs", href: "/tutor-jobs", description: "Browse requirements posted by families", icon: Briefcase },
      { label: "Plans & pricing", href: "/pricing#tutors", description: "Commission, plans and lead credits", icon: Tag },
      { label: "Trust & safety", href: "/trust-safety", description: "Verification and community standards", icon: ShieldCheck },
    ],
    feature: { title: "Teach on your terms", body: "Set your own rates, availability and service area. Get paid through Stripe.", href: "/become-a-tutor", cta: "Learn more" },
  },
  { label: "How it works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
];

/** True when `href` is the page being viewed (or one of its sub-pages). Anchored links never are. */
function isCurrent(pathname: string, href: string) {
  if (href.includes("#") || href.includes("?")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Sliding highlight behind the current top-level item. */
function ActivePill() {
  return <motion.span layoutId="nav-active" className="absolute inset-0 rounded-full bg-sunken" transition={{ type: "spring", bounce: 0.18, duration: 0.45 }} aria-hidden />;
}

/**
 * Full-width bar: see-through at the top of a page (the hero's mesh runs underneath it) and frosted
 * glass once the page scrolls. Logo, the main sections in the middle, then search, theme, wallet and
 * account actions. Below 1280px the sections move into the ☰ menu.
 */
export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState<string | null>(null);
  const [menu, setMenu] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));

  // Close menus on navigation (reset-on-change pattern, no effect needed).
  const [lastPath, setLastPath] = React.useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(null);
    setMenu(false);
  }

  const openMenu = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(label);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpen(null), 140);
  };
  const isActive = (g: NavGroup) =>
    g.href
      ? isCurrent(pathname, g.href)
      : g.mega === "subjects"
        ? isCurrent(pathname, "/subjects")
        : !!g.links?.some((l) => !l.href.includes("#") && l.href !== "/subjects" && isCurrent(pathname, l.href));

  return (
    <header
      onKeyDown={(e) => e.key === "Escape" && setOpen(null)}
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-200",
        scrolled ? "glass border-line" : "border-line/60 bg-page",
      )}
    >
      <div className="container-page flex h-16 items-center gap-8">
        <Logo />

        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex items-center gap-0.5">
            {NAV.map((g) => (
              <li key={g.label} className="relative" onMouseEnter={() => (g.links || g.mega) && openMenu(g.label)} onMouseLeave={() => (g.links || g.mega) && scheduleClose()}>
                {g.href ? (
                  <Link
                    href={g.href}
                    aria-current={isActive(g) ? "page" : undefined}
                    className={cn(
                      "relative inline-flex h-9 items-center whitespace-nowrap rounded-full px-3.5 text-[14.5px] font-medium transition-colors",
                      isActive(g) ? "text-ink" : "text-ink-2 hover:text-ink",
                    )}
                  >
                    {isActive(g) && <ActivePill />}
                    <span className="relative">{g.label}</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    aria-expanded={open === g.label}
                    aria-haspopup="true"
                    onClick={() => setOpen((o) => (o === g.label ? null : g.label))}
                    className={cn(
                      "relative inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-full px-3.5 text-[14.5px] font-medium transition-colors",
                      isActive(g) || open === g.label ? "text-ink" : "text-ink-2 hover:text-ink",
                      open === g.label && !isActive(g) && "bg-sunken",
                    )}
                  >
                    {isActive(g) && <ActivePill />}
                    <span className="relative">{g.label}</span>
                    <ChevronDown className={cn("relative size-3.5 opacity-60 transition-transform duration-200", open === g.label && "rotate-180")} />
                  </button>
                )}
                <AnimatePresence>
                  {g.links && open === g.label && <MegaMenu group={g} pathname={pathname} />}
                  {g.mega === "subjects" && open === g.label && <SubjectsMenu pathname={pathname} />}
                </AnimatePresence>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SearchTrigger className="hidden md:inline-flex" />
          <SearchTrigger compact className="md:hidden" />
          <DarkModeToggle className="hidden sm:grid" />
          <WalletButton />
          <div className="hidden items-center gap-2 xl:flex">
            <AccountArea />
          </div>
          <Button asChild variant="cta" size="sm" className="hidden sm:inline-flex xl:hidden">
            <Link href="/tutors">Find a tutor</Link>
          </Button>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
            className="grid size-10 place-items-center rounded-full border border-line-strong text-ink transition-colors hover:bg-sunken xl:hidden"
          >
            <Menu className="size-[18px]" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <MenuSheet open={menu} onOpenChange={setMenu} />
    </header>
  );
}

/** Dropdown panel for a group in the full bar. */
function MegaMenu({ group: g, pathname }: { group: NavGroup; pathname: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="absolute left-0 top-full z-50 pt-[18px]"
    >
      <div className="grid w-[640px] grid-cols-[1fr_230px] gap-2 rounded-2xl border border-line bg-surface p-2 shadow-xl">
        <ul className="grid grid-cols-1 gap-0.5 p-1">
          {g.links!.map((l, i) => {
            const current = isCurrent(pathname, l.href);
            return (
              <motion.li key={l.href} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i, duration: 0.22 }}>
                <Link
                  href={l.href}
                  aria-current={current ? "page" : undefined}
                  className={cn("group flex items-start gap-3 rounded-xl p-3 transition-colors", current ? "bg-brand-50" : "hover:bg-canvas")}
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-xl border bg-surface shadow-xs transition-colors",
                      current ? "border-brand/30 text-brand" : "border-line text-ink-2 group-hover:text-ink",
                    )}
                  >
                    <l.icon className="size-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-[14.5px] font-semibold", current ? "text-brand" : "text-ink")}>{l.label}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted">{l.description}</span>
                  </span>
                </Link>
              </motion.li>
            );
          })}
        </ul>
        {g.feature && (
          <Link href={g.feature.href} className="group flex flex-col rounded-xl bg-night p-5 text-white">
            <span className="grid size-9 place-items-center rounded-lg bg-white/10">
              <Compass className="size-[18px]" />
            </span>
            <p className="mt-auto pt-10 font-heading text-[20px] font-semibold leading-tight tracking-[-0.03em]">{g.feature.title}</p>
            <p className="mt-1.5 text-[13px] leading-snug text-white/60">{g.feature.body}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-white">
              {g.feature.cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        )}
      </div>
    </motion.div>
  );
}

/** Areas that have a photo; the rest get a gradient panel with their icon. */
const AREA_PHOTOS = new Set(["math", "science", "english", "test-prep", "languages", "computer-science", "social-studies", "arts", "learning-support"]);
const POPULAR_SUBJECTS = SUBJECTS.filter((s) => s.popular).slice(0, 6);

/** Subjects mega menu: hover an area on the left to see its subjects and a picture. */
function SubjectsMenu({ pathname }: { pathname: string }) {
  const [area, setArea] = React.useState(SUBJECT_CATEGORIES[0].slug);
  const cat = SUBJECT_CATEGORIES.find((c) => c.slug === area) ?? SUBJECT_CATEGORIES[0];
  const subjects = SUBJECTS.filter((s) => s.category === cat.slug);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="absolute left-0 top-full z-50 pt-[18px]"
    >
      <div className="w-[920px] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="grid grid-cols-[262px_minmax(0,1fr)_210px]">
          {/* Areas */}
          <ul className="space-y-0.5 border-r border-line bg-canvas p-2.5" aria-label="Subject areas">
            {SUBJECT_CATEGORIES.map((c) => {
              const on = c.slug === area;
              return (
                <li key={c.slug}>
                  <Link
                    href={`/subjects#${c.slug}`}
                    onMouseEnter={() => setArea(c.slug)}
                    onFocus={() => setArea(c.slug)}
                    className={cn("group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] transition-colors", on ? "bg-surface font-semibold text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:text-ink")}
                  >
                    <span className={cn("grid size-7 shrink-0 place-items-center rounded-md transition-colors", on ? "bg-brand-gradient text-on-brand" : "bg-surface text-ink-2 ring-1 ring-line")}>
                      <CategoryIcon slug={c.slug} className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <ChevronRight className={cn("size-4 shrink-0 transition-opacity", on ? "text-brand opacity-100" : "opacity-0")} aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Subjects in the hovered area */}
          <div className="p-6">
            <motion.div key={cat.slug} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand">{subjects.length} subjects</p>
              <p className="mt-1 font-heading text-[20px] font-bold tracking-[-0.02em] text-ink">{cat.name}</p>
              <p className="mt-1 text-[13.5px] leading-snug text-muted">{cat.description}</p>
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1">
                {subjects.map((s) => {
                  const current = isCurrent(pathname, `/subjects/${s.slug}`);
                  return (
                    <li key={s.slug}>
                      <Link
                        href={`/subjects/${s.slug}`}
                        aria-current={current ? "page" : undefined}
                        className={cn(
                          "group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[14.5px] transition-colors hover:bg-brand-50 hover:text-brand",
                          current ? "font-semibold text-brand" : "text-ink",
                        )}
                      >
                        <span className="truncate">{s.name}</span>
                        {s.popular && <span className="shrink-0 rounded bg-brand-soft px-1 text-[10.5px] font-semibold text-brand">Popular</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link href={`/subjects#${cat.slug}`} className="group mt-4 inline-flex items-center gap-1.5 px-2 text-[14px] font-semibold text-brand">
                All {cat.name} subjects <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          </div>

          {/* Picture + quick actions */}
          <div className="flex flex-col gap-3 border-l border-line p-4">
            <div className="relative aspect-[4/3.6] overflow-hidden rounded-xl bg-canvas">
              {AREA_PHOTOS.has(cat.slug) ? (
                <Image key={cat.slug} src={`/images/subject-areas/${cat.slug}.jpg`} alt="" fill sizes="200px" className="object-cover" />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-brand-soft">
                  <CategoryIcon slug={cat.slug} className="size-12 text-brand" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night/80 to-transparent p-3 pt-10">
                <span className="text-[13px] font-semibold text-white">{cat.name}</span>
              </div>
            </div>
            <Link href="/concierge" className="group rounded-xl border border-line p-3 transition-colors hover:border-brand/40 hover:bg-brand-50">
              <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                <Sparkles className="size-4 text-brand" aria-hidden /> Not sure what you need?
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">Get a shortlist of tutors in two minutes.</span>
            </Link>
          </div>
        </div>

        {/* Popular subjects + browse all */}
        <div className="flex items-center justify-between gap-4 border-t border-line px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-[12.5px] font-medium text-muted">Popular:</span>
            <ul className="flex min-w-0 gap-1.5 overflow-hidden">
              {POPULAR_SUBJECTS.map((s) => (
                <li key={s.slug} className="shrink-0">
                  <Link href={`/tutors?subject=${s.slug}`} className="inline-flex rounded-full border border-line px-2.5 py-1 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-brand/40 hover:text-brand">
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <Link href="/subjects" className="group inline-flex shrink-0 items-center gap-1.5 text-[14px] font-semibold text-brand">
            Browse all {SUBJECTS.length} subjects <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

type SheetLink = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };

/** Every menu in one place: the ☰ button opens this (full screen on phones, a side panel on larger screens). */
const SHEET_GROUPS: { title: string; links: SheetLink[] }[] = [
  {
    title: "Find tutors",
    links: [
      ...NAV.find((g) => g.label === "Find tutors")!.links!.map(({ label, href, icon }) => ({ label, href, icon })),
      { label: "Help me find a tutor", href: "/concierge", icon: Compass },
    ],
  },
  { title: "For tutors", links: NAV.find((g) => g.label === "For tutors")!.links!.map(({ label, href, icon }) => ({ label, href, icon })) },
  {
    title: "More",
    links: [
      { label: "How it works", href: "/how-it-works", icon: Route },
      { label: "Pricing", href: "/pricing", icon: Tag },
      { label: "For parents", href: "/for-parents", icon: Users },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "/about", icon: Info },
      { label: "Blog & resources", href: "/blog", icon: Newspaper },
      { label: "FAQ", href: "/faq", icon: CircleHelp },
      { label: "Contact", href: "/contact", icon: Mail },
    ],
  },
];

function MenuSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const pathname = usePathname();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[79] hidden bg-night/40 sm:block"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-y-0 right-0 z-[80] flex w-full flex-col bg-surface sm:w-[440px] sm:border-l sm:border-line sm:shadow-xl"
                data-lenis-prevent
              >
                <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
                <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
                  <Logo />
                  <div className="flex items-center gap-2">
                    <DarkModeToggle />
                    <DialogPrimitive.Close className="grid size-10 place-items-center rounded-full border border-line-strong text-ink transition-colors hover:bg-sunken" aria-label="Close menu">
                      <X className="size-[18px]" strokeWidth={2.2} />
                    </DialogPrimitive.Close>
                  </div>
                </div>

                <nav aria-label="All pages" className="flex-1 overflow-y-auto px-5 pb-6 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      openCommandPalette();
                    }}
                    className="flex h-11 w-full items-center gap-2 rounded-full border border-line-strong bg-canvas px-4 text-[15px] text-muted transition-colors hover:border-subtle"
                  >
                    <Search className="size-[18px] text-ink" /> Search tutors, subjects, pages…
                  </button>

                  {SHEET_GROUPS.map((group, gi) => (
                    <motion.section
                      key={group.title}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + gi * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="mt-6"
                      aria-labelledby={`menu-${gi}`}
                    >
                      <h2 id={`menu-${gi}`} className="px-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
                        {group.title}
                      </h2>
                      <ul className="mt-2 grid gap-0.5">
                        {group.links.map((l) => {
                          const current = isCurrent(pathname, l.href);
                          return (
                            <li key={l.href}>
                              <Link
                                href={l.href}
                                aria-current={current ? "page" : undefined}
                                className={cn(
                                  "group flex items-center gap-3 rounded-xl px-2 py-2 text-[15.5px] transition-colors",
                                  current ? "bg-brand-50 font-semibold text-brand" : "font-medium text-ink hover:bg-canvas",
                                )}
                              >
                                <span
                                  className={cn(
                                    "grid size-9 shrink-0 place-items-center rounded-xl border bg-surface shadow-xs transition-colors",
                                    current ? "border-brand/30 text-brand" : "border-line text-ink-2 group-hover:text-ink",
                                  )}
                                >
                                  <l.icon className="size-[18px]" />
                                </span>
                                <span className="flex-1">{l.label}</span>
                                <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </motion.section>
                  ))}

                </nav>

                <div className="shrink-0 border-t border-line px-5 py-4">
                  <MobileAccount />
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

function AccountArea() {
  const me = useSession();
  const hydrated = useApp((s) => s.hydrated);
  const unread = useUnreadNotifications();
  const unreadMsgs = useUnreadMessages();
  const logout = useApp((s) => s.logout);
  const router = useRouter();

  if (!hydrated) return <div className="h-10 w-40" aria-hidden />;

  if (!me) {
    return (
      <>
        <Button asChild variant="secondary" size="sm">
          <Link href="/login">Log in</Link>
        </Button>
        <Button asChild variant="cta" size="sm" className="relative">
          <Link href="/register">
            <BorderBeam />
            Get started
          </Link>
        </Button>
      </>
    );
  }

  const home = homeFor(me.role);
  return (
    <>
      <Link href={me.role === "admin" || me.role === "support" ? "/admin" : "/dashboard/notifications"} className="relative grid size-9 place-items-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
        <Bell className="size-5" />
        {unread > 0 && <span className="absolute right-2 top-2 size-2.5 rounded-full border-2 border-surface bg-danger" />}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-sunken" aria-label="Account menu">
          <Avatar name={`${me.firstName} ${me.lastName}`} size="sm" />
          <ChevronDown className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60">
          <DropdownMenuLabel>
            <span className="block text-sm font-semibold text-ink">{me.firstName} {me.lastName}</span>
            <span className="block font-normal">{ROLE_LABEL[me.role]} account</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push(home)}><LayoutDashboard /> Dashboard</DropdownMenuItem>
          {me.role !== "admin" && me.role !== "support" && (
            <>
              <DropdownMenuItem onSelect={() => router.push("/dashboard/messages")}>
                <MessagesSquare /> Messages {unreadMsgs > 0 && <span className="ml-auto rounded-md bg-brand px-1.5 text-[11px] font-semibold text-on-brand">{unreadMsgs}</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/dashboard/bookings")}><Wallet /> Bookings</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/dashboard/settings")}><UserRound /> Account settings</DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              logout();
              router.push("/");
            }}
          >
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button asChild size="sm">
        <Link href={home}>Dashboard</Link>
      </Button>
    </>
  );
}

function MobileAccount() {
  const me = useSession();
  const logout = useApp((s) => s.logout);
  if (!me) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="secondary" size="lg"><Link href="/login">Log in</Link></Button>
        <Button asChild size="lg"><Link href="/register">Sign up</Link></Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <Avatar name={`${me.firstName} ${me.lastName}`} size="md" square />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{me.firstName} {me.lastName}</p>
        <p className="text-xs text-muted">{ROLE_LABEL[me.role]}</p>
      </div>
      <Button asChild size="sm"><Link href={homeFor(me.role)}>Dashboard</Link></Button>
      <Button variant="ghost" size="icon-sm" aria-label="Sign out" onClick={logout}><LogOut /></Button>
    </div>
  );
}
