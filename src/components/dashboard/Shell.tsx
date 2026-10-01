"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { SearchTrigger } from "@/components/layout/CommandPalette";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Bell, ChevronsUpDown, LogOut, Menu, RotateCcw, Search, Globe, Check, ArrowLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Sheet, SheetContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Popover, PopoverContent, PopoverTrigger, ConfirmDialog } from "@/components/ui/Overlay";
import { ForbiddenState, UnauthorizedState, EmptyState } from "@/components/ui/States";
import { useApp } from "@/lib/store";
import { useSession, useUnreadMessages, useUnreadNotifications } from "@/lib/store/hooks";
import { ROLE_LABEL } from "@/lib/data/users";
import { hasPermission, isStaff } from "@/lib/permissions";
import { formatRelative } from "@/lib/format";
import { DEMO_ACCOUNTS, useDemoLogin } from "@/components/layout/DemoSwitcher";
import { ADMIN_NAV, NAV_BY_ROLE, type NavSection } from "./nav";
import type { Role, User } from "@/lib/types";
import { toast } from "@/components/ui/Toast";

function sectionsFor(user: User, area: "app" | "admin"): NavSection[] {
  if (area === "admin") {
    return ADMIN_NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.permission || hasPermission(user, i.permission)) })).filter((s) => s.items.length);
  }
  return NAV_BY_ROLE[user.role as "student" | "parent" | "tutor"] ?? [];
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* ─── Collapsible sidebar preference (per viewer, this browser) ─── */
const COLLAPSE_KEY = "tl-sidebar-collapsed";
const collapseListeners = new Set<() => void>();
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}
function useSidebarCollapsed(): [boolean, () => void] {
  const collapsed = React.useSyncExternalStore(
    (cb) => {
      collapseListeners.add(cb);
      return () => collapseListeners.delete(cb);
    },
    readCollapsed,
    () => false,
  );
  const toggle = React.useCallback(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, readCollapsed() ? "0" : "1");
    } catch {
      /* storage unavailable: keep the current layout */
    }
    collapseListeners.forEach((l) => l());
  }, []);
  return [collapsed, toggle];
}

function NavList({ sections, onNavigate, collapsed = false }: { sections: NavSection[]; onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const unreadMsgs = useUnreadMessages();
  const unreadNotes = useUnreadNotifications();
  return (
    <nav aria-label="Dashboard" className={collapsed ? "space-y-3" : "space-y-5"}>
      {sections.map((s, i) => (
        <div key={s.title ?? i}>
          {s.title && (collapsed ? <div className="mx-auto mb-2 h-px w-6 bg-line" aria-hidden /> : <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{s.title}</p>)}
          <ul className="space-y-0.5">
            {s.items.map((item) => {
              const active = isActive(pathname, item.href);
              const count = item.badge === "messages" ? unreadMsgs : item.badge === "notifications" ? unreadNotes : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "relative flex h-10 items-center gap-3 rounded-lg text-[14px] transition-colors",
                      collapsed ? "mx-auto w-10 justify-center" : "px-3",
                      active ? "font-semibold text-ink" : "font-medium text-ink-2 hover:bg-canvas hover:text-ink",
                    )}
                  >
                    {active && (
                      <motion.span layoutId="dash-nav-active" className="absolute inset-0 rounded-lg bg-ink/[0.06] before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-brand-gradient" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />
                    )}
                    <item.icon className={cn("relative size-[18px] shrink-0", active ? "text-brand [stroke-width:2.25]" : "text-ink-2")} />
                    <span className={cn("relative flex-1 truncate", collapsed && "sr-only")}>{item.label}</span>
                    {count > 0 &&
                      (collapsed ? (
                        <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-ink ring-2 ring-surface" />
                      ) : (
                        <span className="relative rounded-md bg-brand-gradient px-1.5 py-px text-[11px] font-semibold tabular-nums text-white">{count}</span>
                      ))}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({ user }: { user: User }) {
  const [confirm, setConfirm] = React.useState(false);
  const reset = useApp((s) => s.resetDemo);
  const router = useRouter();
  return (
    <div className="space-y-2 border-t border-line p-3">
      <div className="rounded-xl bg-canvas px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
          <span className="size-1.5 animate-pulse-dot rounded-full bg-success" aria-hidden /> Preview environment
        </p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted">Sample data, stored only in this browser.</p>
        <button type="button" onClick={() => setConfirm(true)} className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink underline-offset-2 hover:underline">
          <RotateCcw className="size-3" /> Reset demo data
        </button>
      </div>
      <AccountMenu user={user} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Reset demo data?"
        description="All bookings, messages and changes you've made in this preview will be replaced with the original sample data."
        confirmLabel="Reset data"
        tone="danger"
        onConfirm={() => {
          reset();
          setConfirm(false);
          toast.success("Demo data reset");
          router.push("/login");
        }}
      />
    </div>
  );
}

function AccountMenu({ user, compact }: { user: User; compact?: boolean }) {
  const logout = useApp((s) => s.logout);
  const router = useRouter();
  const demoLogin = useDemoLogin();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn("flex w-full items-center gap-2.5 rounded-lg text-left transition-colors hover:bg-canvas", compact ? "p-1" : "px-2 py-2")} aria-label="Account menu">
        <Avatar name={`${user.firstName} ${user.lastName}`} size="sm" />
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">{user.firstName} {user.lastName}</span>
              <span className="block truncate text-[11.5px] text-muted">{ROLE_LABEL[user.role]}</span>
            </span>
            <ChevronsUpDown className="size-3.5 text-muted" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} side={compact ? "bottom" : "top"} className="w-64">
        <DropdownMenuLabel>
          <span className="block text-sm font-medium text-ink">{user.firstName} {user.lastName}</span>
          <span className="block truncate font-normal">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/")}><Globe /> View public site</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Switch demo account</DropdownMenuLabel>
        {DEMO_ACCOUNTS.map((a) => (
          <DropdownMenuItem key={a.id} onSelect={() => a.id !== user.id && demoLogin(a.id)}>
            <a.icon />
            <span className="flex-1">{a.label}</span>
            {a.id === user.id && <Check className="!text-ink" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            logout();
            router.push("/login");
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationsPopover({ user }: { user: User }) {
  const all = useApp((s) => s.notifications);
  const markRead = useApp((s) => s.markNotificationRead);
  const markAll = useApp((s) => s.markAllNotificationsRead);
  const router = useRouter();
  const list = React.useMemo(() => all.filter((n) => n.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [all, user.id]);
  const unread = list.filter((n) => !n.read).length;
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="relative grid size-10 place-items-center rounded-lg text-ink transition-colors hover:bg-canvas" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
        <Bell className="size-5" />
        {unread > 0 && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-surface">
            {unread}
          </motion.span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,22rem)] p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button type="button" onClick={markAll} className="text-[12.5px] font-semibold text-ink underline-offset-2 hover:underline">
              Mark all as read
            </button>
          )}
        </div>
        {list.length === 0 ? (
          <EmptyState compact icon={<Bell />} title="You're all caught up" description="New messages, bookings and updates will appear here." />
        ) : (
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {list.slice(0, 8).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    markRead(n.id);
                    setOpen(false);
                    if (n.href) router.push(n.href);
                  }}
                  className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas"
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[13px]", n.read ? "text-ink-2" : "font-medium text-ink")}>{n.title}</span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-muted">{n.body}</span>
                    <span className="mt-1 block text-[11.5px] text-subtle">{formatRelative(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {user.role !== "admin" && user.role !== "support" && (
          <Link href="/dashboard/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-[13px] font-semibold text-ink hover:bg-canvas">
            View all notifications
          </Link>
        )}
      </PopoverContent>
    </Popover>
  );
}

function TopSearch({ role }: { role: Role }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const target = role === "tutor" ? "/dashboard/jobs" : role === "admin" || role === "support" ? "/admin/users" : "/tutors";
  const placeholder = role === "tutor" ? "Search student jobs…" : role === "admin" || role === "support" ? "Search users by name or email…" : "Search tutors by subject or name…";
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`${target}?q=${encodeURIComponent(q.trim())}`);
      }}
      className="relative hidden w-full max-w-xs md:block"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/25"
      />
    </form>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh bg-page">
      <div className="hidden w-[248px] shrink-0 border-r border-line p-4 lg:block">
        <Skeleton className="h-7 w-32" />
        <div className="mt-8 space-y-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1">
        <div className="h-16 border-b border-line" />
        <div className="p-6 lg:p-8">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-3 h-4 w-80" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardShell({ area, children }: { area: "app" | "admin"; children: React.ReactNode }) {
  const hydrated = useApp((s) => s.hydrated);
  const user = useSession();
  const pathname = usePathname();
  const [mobileNav, setMobileNav] = React.useState(false);

  if (!hydrated) return <ShellSkeleton />;

  if (!user) {
    return (
      <div className="grid min-h-dvh place-items-center bg-page px-4">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface">
          <div className="border-b border-line px-6 py-4">
            <Logo />
          </div>
          <UnauthorizedState next={pathname} />
        </div>
      </div>
    );
  }

  const staff = isStaff(user);
  if ((area === "admin" && !staff) || (area === "app" && staff)) {
    return (
      <div className="grid min-h-dvh place-items-center bg-page px-4">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface">
          <div className="border-b border-line px-6 py-4">
            <Logo />
          </div>
          <ForbiddenState
            description={area === "admin" ? "The admin panel is only available to TutorLink staff." : "Staff accounts use the admin panel instead of the member dashboard."}
          />
          {area === "app" && staff && (
            <div className="-mt-10 pb-10 text-center">
              <Button asChild size="sm"><Link href="/admin">Open admin panel</Link></Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const sections = sectionsFor(user, area);

  return (
    <ShellLayout area={area} user={user} sections={sections} pathname={pathname} mobileNav={mobileNav} setMobileNav={setMobileNav}>
      {children}
    </ShellLayout>
  );
}

function ShellLayout({
  area,
  user,
  sections,
  pathname,
  mobileNav,
  setMobileNav,
  children,
}: {
  area: "app" | "admin";
  user: User;
  sections: NavSection[];
  pathname: string;
  mobileNav: boolean;
  setMobileNav: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  return (
    <div className="min-h-dvh bg-page">
      {/* Desktop sidebar: white with a hairline edge, collapsible to an icon rail */}
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-page transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex", collapsed ? "w-[76px]" : "w-[248px]")}>
        <div className={cn("flex h-16 shrink-0 items-center gap-2 border-b border-line", collapsed ? "justify-center px-2" : "justify-between pl-5 pr-3")}>
          <span className="flex items-center gap-2">
            <Logo compact={collapsed} href={area === "admin" ? "/admin" : "/dashboard"} />
            {area === "admin" && !collapsed && <span className="rounded-md bg-brand-gradient px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">Admin</span>}
          </span>
          {!collapsed && (
            <button type="button" onClick={toggleCollapsed} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink" aria-label="Collapse sidebar">
              <PanelLeftClose className="size-[18px]" />
            </button>
          )}
        </div>
        {collapsed && (
          <button type="button" onClick={toggleCollapsed} className="mx-auto mt-3 grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink" aria-label="Expand sidebar">
            <PanelLeftOpen className="size-[18px]" />
          </button>
        )}
        <div className={cn("scrollbar-none flex-1 overflow-y-auto pb-6 pt-4", collapsed ? "px-2" : "px-3")}>
          <NavList sections={sections} collapsed={collapsed} />
        </div>
        {collapsed ? (
          <div className="flex justify-center border-t border-line p-3">
            <AccountMenu user={user} compact />
          </div>
        ) : (
          <SidebarFooter user={user} />
        )}
      </aside>

      {/* Mobile nav */}
      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" title={area === "admin" ? "Admin" : "Dashboard"} footer={<AccountMenu user={user} />}>
          <div className="px-3 py-4">
            <NavList sections={sections} onNavigate={() => setMobileNav(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className={cn("relative min-h-dvh bg-page transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]", collapsed ? "lg:pl-[76px]" : "lg:pl-[248px]")}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-page/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button type="button" onClick={() => setMobileNav(true)} className="-ml-1 grid size-10 place-items-center rounded-lg text-ink hover:bg-canvas lg:hidden" aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <span className="lg:hidden">
            <Logo compact href={area === "admin" ? "/admin" : "/dashboard"} />
          </span>
          <TopSearch role={user.role} />
          <SearchTrigger compact className="md:hidden" />
          <div className="ml-auto flex items-center gap-2">
            <SearchTrigger className="hidden md:inline-flex" />
            {user.role !== "admin" && user.role !== "support" && (
              <Button asChild variant="secondary" size="sm" className="hidden sm:inline-flex">
                <Link href={user.role === "tutor" ? "/dashboard/jobs" : "/post-requirement"}>{user.role === "tutor" ? "Find jobs" : "Post a requirement"}</Link>
              </Button>
            )}
            <ThemeToggle />
            <NotificationsPopover user={user} />
            <div className="lg:hidden">
              <AccountMenu user={user} compact />
            </div>
          </div>
        </header>
        <main id="main" className="relative mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <motion.div key={pathname} className="stagger-children" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

/** Page title block for dashboard pages. */
export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="mb-6 lg:mb-8">
      {back && (
        <Link href={back.href} className="group mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" /> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
          <h1 className="font-heading text-[1.75rem] font-bold leading-[1.08] tracking-[-0.025em] text-ink sm:text-[2rem]">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-[15px] text-ink-2">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Restricts a dashboard page to specific roles; renders a Forbidden state otherwise. */
export function RoleGate({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const user = useSession();
  if (!user) return null; // Shell already handles signed-out
  if (!roles.includes(user.role)) {
    return (
      <div className="rounded-2xl border border-line bg-surface">
        <ForbiddenState description={`This page is for ${roles.map((r) => ROLE_LABEL[r].toLowerCase()).join(" and ")} accounts.`} />
      </div>
    );
  }
  return <>{children}</>;
}

/** Restricts an admin page to users holding a permission. */
export function PermissionGate({ permission, children }: { permission: Parameters<typeof hasPermission>[1]; children: React.ReactNode }) {
  const user = useSession();
  if (!user) return null;
  if (!hasPermission(user, permission)) {
    return (
      <div className="rounded-2xl border border-line bg-surface">
        <ForbiddenState description={`Your role doesn't include the "${permission}" permission. Ask a super admin for access.`} />
      </div>
    );
  }
  return <>{children}</>;
}
