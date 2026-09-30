"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import {
  ArrowRight, Bell, BookOpen, Briefcase, ChevronDown, ChevronRight, CircleHelp, ClipboardList, Compass, GitCompareArrows, Info, LayoutDashboard,
  LogOut, Mail, MapPin, Menu, MessagesSquare, Moon, Newspaper, Route, Search, ShieldCheck, Sparkles, Sun, Tag, UserRound, Users, Wallet, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/Overlay";
import { useSession, useUnreadNotifications, useUnreadMessages } from "@/lib/store/hooks";
import { useApp } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/data/users";
import { homeFor } from "@/lib/permissions";
import { SearchTrigger, openCommandPalette } from "./CommandPalette";
import { ThemeToggle } from "./ThemeToggle";
import { setTheme, useTheme } from "@/lib/theme";

type NavLink = { label: string; href: string; description: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; href?: string; links?: NavLink[]; feature?: { title: string; body: string; href: string; cta: string } };

const NAV: NavGroup[] = [
  {
    label: "Find tutors",
    links: [
      { label: "Search tutors", href: "/tutors", description: "Filter by subject, grade, schedule and budget", icon: Search },
      { label: "Browse subjects", href: "/subjects", description: "Math, science, test prep, languages and more", icon: BookOpen },
      { label: "Tutors near you", href: "/locations", description: "In-person tutoring by city and ZIP code", icon: MapPin },
      { label: "Compare tutors", href: "/compare", description: "Side-by-side, up to three at a time", icon: GitCompareArrows },
    ],
    feature: { title: "Help me find a tutor", body: "Tell us what you need. We'll show a shortlist and explain exactly why each tutor matches.", href: "/concierge", cta: "Start matching" },
  },
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
  { label: "Post a requirement", href: "/post-requirement" },
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
  return <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg bg-brand-soft ring-1 ring-brand/15" transition={{ type: "spring", bounce: 0.18, duration: 0.45 }} aria-hidden />;
}

/**
 * Full-width top bar. At the top of a page it shows every section; once you scroll it condenses
 * into a slim bar (logo · search · theme · ☰ menu) that stays put in both scroll directions.
 * On the homepage it sits on the tinted hero until you scroll.
 */
export function Navbar() {
  const pathname = usePathname();
  const onBrand = pathname === "/";
  const [open, setOpen] = React.useState<string | null>(null);
  const [menu, setMenu] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [compact, setCompact] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled(y > 8);
    // Small hysteresis so the bar doesn't flicker around the threshold.
    setCompact((c) => (c ? y > 90 : y > 140));
  });

  // Close menus on navigation (reset-on-change pattern, no effect needed).
  const [lastPath, setLastPath] = React.useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(null);
    setMenu(false);
  }
  // Dropdowns belong to the full bar only.
  if (compact && open) setOpen(null);

  const openMenu = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(label);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpen(null), 140);
  };
  const isActive = (g: NavGroup) => (g.href ? isCurrent(pathname, g.href) : !!g.links?.some((l) => !l.href.includes("#") && isCurrent(pathname, l.href)));
  const tinted = onBrand && !scrolled && !open;

  return (
    <header
      onKeyDown={(e) => e.key === "Escape" && setOpen(null)}
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300",
        tinted ? "border-transparent bg-brand-soft" : "border-line bg-surface",
        compact && "shadow-sm",
      )}
    >
      <div className={cn("container-page flex items-center gap-6 transition-[height] duration-300", compact ? "h-14 lg:h-16" : "h-16 lg:h-[72px]")}>
        <Logo />

        <AnimatePresence initial={false}>
          {!compact && (
            <motion.nav
              key="links"
              aria-label="Main"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:block"
            >
              <ul className="flex items-center gap-1">
                {NAV.map((g) => (
                  <li key={g.label} className="relative" onMouseEnter={() => g.links && openMenu(g.label)} onMouseLeave={() => g.links && scheduleClose()}>
                    {g.href ? (
                      <Link
                        href={g.href}
                        aria-current={isActive(g) ? "page" : undefined}
                        className={cn(
                          "relative inline-flex h-10 items-center rounded-lg px-3.5 text-[15px] transition-colors",
                          isActive(g) ? "font-semibold text-brand" : "font-medium text-ink hover:bg-ink/5",
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
                          "relative inline-flex h-10 items-center gap-1 rounded-lg px-3.5 text-[15px] transition-colors",
                          isActive(g) ? "font-semibold text-brand" : cn("font-medium text-ink hover:bg-ink/5", open === g.label && "bg-ink/5"),
                        )}
                      >
                        {isActive(g) && <ActivePill />}
                        <span className="relative">{g.label}</span>
                        <ChevronDown className={cn("relative size-4 transition-transform duration-200", open === g.label && "rotate-180")} />
                      </button>
                    )}
                    <AnimatePresence>
                      {g.links && open === g.label && <MegaMenu group={g} pathname={pathname} />}
                    </AnimatePresence>
                  </li>
                ))}
              </ul>
            </motion.nav>
          )}
        </AnimatePresence>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <SearchTrigger className={cn("hidden", !compact && "md:inline-flex")} onBrand={tinted} />
          <SearchTrigger compact className={cn(!compact && "md:hidden")} onBrand={tinted} />
          <ThemeToggle />
          <AnimatePresence initial={false} mode="popLayout">
            {compact ? (
              <motion.div
                key="compact-actions"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="hidden items-center gap-2 sm:flex"
              >
                <Button asChild variant="brand" size="sm" className="h-10 px-4">
                  <Link href="/tutors">Find a tutor</Link>
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="account"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                className="hidden items-center gap-2 lg:flex"
              >
                <AccountArea />
              </motion.div>
            )}
          </AnimatePresence>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-lg text-[15px] font-semibold text-ink transition-colors",
              compact ? "border-2 border-ink px-2.5 hover:bg-ink hover:text-on-ink sm:px-3.5" : "px-2 hover:bg-ink/5 lg:hidden",
            )}
          >
            <Menu className="size-5" strokeWidth={2.4} />
            {compact && <span className="hidden sm:inline">Menu</span>}
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
      className="absolute left-0 top-full z-50 pt-3"
    >
      <div className="grid w-[640px] grid-cols-[1fr_230px] gap-2 rounded-xl border border-line bg-surface p-2 shadow-lg">
        <ul className="grid grid-cols-1 gap-0.5 p-1">
          {g.links!.map((l, i) => {
            const current = isCurrent(pathname, l.href);
            return (
              <motion.li key={l.href} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i, duration: 0.22 }}>
                <Link
                  href={l.href}
                  aria-current={current ? "page" : undefined}
                  className={cn("group flex items-start gap-3 rounded-lg p-3 transition-colors", current ? "bg-brand-soft" : "hover:bg-canvas")}
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-lg border bg-surface transition-colors",
                      current ? "border-brand/30 text-brand" : "border-line text-ink group-hover:border-ink",
                    )}
                  >
                    <l.icon className="size-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-[15px] font-semibold", current ? "text-brand" : "text-ink")}>{l.label}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted">{l.description}</span>
                  </span>
                </Link>
              </motion.li>
            );
          })}
        </ul>
        {g.feature && (
          <Link href={g.feature.href} className="group flex flex-col rounded-lg bg-brand-soft p-5 text-ink">
            <Compass className="size-6" />
            <p className="mt-auto pt-10 font-heading text-[22px] font-extrabold leading-tight tracking-[-0.03em]">{g.feature.title}</p>
            <p className="mt-1.5 text-[13px] leading-snug text-ink/80">{g.feature.body}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold underline decoration-2 underline-offset-4">
              {g.feature.cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        )}
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
      ...NAV[0].links!.map(({ label, href, icon }) => ({ label, href, icon })),
      { label: "Help me find a tutor", href: "/concierge", icon: Compass },
    ],
  },
  { title: "For tutors", links: NAV[1].links!.map(({ label, href, icon }) => ({ label, href, icon })) },
  {
    title: "More",
    links: [
      { label: "Post a requirement", href: "/post-requirement", icon: ClipboardList },
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
  const theme = useTheme();
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
                  <DialogPrimitive.Close className="grid size-10 place-items-center rounded-lg text-ink transition-colors hover:bg-ink/5" aria-label="Close menu">
                    <X className="size-6" strokeWidth={2.25} />
                  </DialogPrimitive.Close>
                </div>

                <nav aria-label="All pages" className="flex-1 overflow-y-auto px-5 pb-6 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      openCommandPalette();
                    }}
                    className="flex h-11 w-full items-center gap-2 rounded-lg border border-line-strong px-3.5 text-[15px] text-muted transition-colors hover:border-ink"
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
                                  "group flex items-center gap-3 rounded-lg px-2 py-2.5 text-[15.5px] transition-colors",
                                  current ? "bg-brand-soft font-semibold text-brand" : "font-medium text-ink hover:bg-canvas",
                                )}
                              >
                                <span
                                  className={cn(
                                    "grid size-9 shrink-0 place-items-center rounded-lg border transition-colors",
                                    current ? "border-brand/30 bg-surface text-brand" : "border-line text-ink group-hover:border-ink",
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

                  <div className="mt-7 flex items-center justify-between rounded-xl border border-line p-3">
                    <span className="px-1 text-[15px] font-semibold text-ink">Appearance</span>
                    <div role="radiogroup" aria-label="Theme" className="flex rounded-lg bg-canvas p-1">
                      {(["light", "dark"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          role="radio"
                          aria-checked={theme === t}
                          onClick={() => setTheme(t)}
                          className={cn(
                            "relative inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13.5px] font-semibold transition-colors",
                            theme === t ? "text-ink" : "text-muted hover:text-ink",
                          )}
                        >
                          {theme === t && <motion.span layoutId="theme-seg" className="absolute inset-0 rounded-md bg-surface shadow-sm ring-1 ring-line" transition={{ type: "spring", bounce: 0.15, duration: 0.35 }} />}
                          {t === "light" ? <Sun className="relative size-4" /> : <Moon className="relative size-4" />}
                          <span className="relative">{t === "light" ? "Light" : "Dark"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
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
        <Button asChild variant="secondary" size="sm" className="h-10 bg-transparent px-4 hover:bg-ink/5">
          <Link href="/login">Log in</Link>
        </Button>
        <Button asChild size="sm" className="h-10 px-4">
          <Link href="/register">Sign up</Link>
        </Button>
      </>
    );
  }

  const home = homeFor(me.role);
  return (
    <>
      <Link href={me.role === "admin" || me.role === "support" ? "/admin" : "/dashboard/notifications"} className="relative grid size-10 place-items-center rounded-lg text-ink hover:bg-ink/5" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
        <Bell className="size-5" />
        {unread > 0 && <span className="absolute right-2 top-2 size-2.5 rounded-full border-2 border-surface bg-danger" />}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-ink/5" aria-label="Account menu">
          <Avatar name={`${me.firstName} ${me.lastName}`} size="sm" square />
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
                <MessagesSquare /> Messages {unreadMsgs > 0 && <span className="ml-auto rounded-md bg-brand px-1.5 text-[11px] font-semibold text-white">{unreadMsgs}</span>}
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
      <Button asChild variant="secondary" size="sm" className="h-10 px-4">
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
