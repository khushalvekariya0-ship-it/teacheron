"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BookOpen, CornerDownLeft, FileText, LayoutDashboard, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUBJECTS, subjectName } from "@/lib/data/catalog";
import { useSession, useTutors } from "@/lib/store/hooks";
import { ADMIN_NAV, NAV_BY_ROLE } from "@/components/dashboard/nav";
import { hasPermission } from "@/lib/permissions";
import { Avatar } from "@/components/ui/Avatar";
import { formatCents } from "@/lib/format";

/* ─── Open state shared across the app (navbar button, dashboard bar, hotkey) ─── */

let isOpen = false;
const listeners = new Set<() => void>();
function setOpen(v: boolean) {
  isOpen = v;
  listeners.forEach((l) => l());
}
export function openCommandPalette() {
  setOpen(true);
}
function useOpen(): [boolean, (v: boolean) => void] {
  const open = React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => isOpen,
    () => false,
  );
  return [open, setOpen];
}

const PAGES: { label: string; href: string; hint: string }[] = [
  { label: "Find a tutor", href: "/tutors", hint: "Search with filters" },
  { label: "Help me find a tutor", href: "/concierge", hint: "Matching with reasons" },
  { label: "Post a requirement", href: "/post-requirement", hint: "Let tutors apply" },
  { label: "Compare tutors", href: "/compare", hint: "Side by side, up to three" },
  { label: "Student jobs", href: "/tutor-jobs", hint: "For tutors" },
  { label: "Browse subjects", href: "/subjects", hint: "All subjects" },
  { label: "Tutors by city", href: "/locations", hint: "In-person tutoring" },
  { label: "How it works", href: "/how-it-works", hint: "Families and tutors" },
  { label: "Pricing", href: "/pricing", hint: "Plans, fees and credits" },
  { label: "Become a tutor", href: "/become-a-tutor", hint: "Start teaching" },
  { label: "For parents", href: "/for-parents", hint: "Child profiles and oversight" },
  { label: "For students", href: "/for-students", hint: "Learn at your pace" },
  { label: "Trust & safety", href: "/trust-safety", hint: "Verification and safeguards" },
  { label: "FAQ", href: "/faq", hint: "Common questions" },
  { label: "Blog & resources", href: "/blog", hint: "Guides" },
  { label: "About", href: "/about", hint: "Our principles" },
  { label: "Contact support", href: "/contact", hint: "Get help" },
  { label: "Sign in", href: "/login", hint: "Demo accounts available" },
  { label: "Create an account", href: "/register", hint: "Students, parents and tutors" },
];

type Item = { id: string; group: string; label: string; hint?: string; href: string; icon: React.ReactNode };

export function CommandPalette() {
  const [open, setOpenState] = useOpen();
  const router = useRouter();
  const tutors = useTutors();
  const me = useSession();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Global hotkeys: ⌘K / Ctrl+K toggles, "/" opens when not typing.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!isOpen);
      } else if (e.key === "/" && !isOpen) {
        const t = e.target as HTMLElement | null;
        if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = React.useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (...fields: (string | undefined)[]) => !q || fields.some((f) => f?.toLowerCase().includes(q));
    const out: Item[] = [];
    if (me) {
      const sections = me.role === "admin" || me.role === "support" ? ADMIN_NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.permission || hasPermission(me, i.permission)) })) : NAV_BY_ROLE[me.role as "student" | "parent" | "tutor"] ?? [];
      sections
        .flatMap((s) => s.items)
        .filter((i) => match(i.label, "dashboard"))
        .slice(0, q ? 8 : 4)
        .forEach((i) => out.push({ id: `d:${i.href}`, group: "Your dashboard", label: i.label, href: i.href, icon: <i.icon className="size-4" /> }));
    }
    PAGES.filter((p) => match(p.label, p.hint))
      .slice(0, q ? 8 : 5)
      .forEach((p) => out.push({ id: `p:${p.href}`, group: "Pages", label: p.label, hint: p.hint, href: p.href, icon: <FileText className="size-4" /> }));
    tutors
      .filter((t) => match(`${t.firstName} ${t.lastName}`, t.headline, ...t.subjects.map(subjectName), t.city))
      .slice(0, q ? 6 : 3)
      .forEach((t) =>
        out.push({
          id: `t:${t.id}`,
          group: "Tutors",
          label: `${t.firstName} ${t.lastName}`,
          hint: `${t.headline} · ${formatCents(t.hourlyRateCents)}/hr`,
          href: `/tutors/${t.slug}`,
          icon: <Avatar name={`${t.firstName} ${t.lastName}`} tone={t.tone} size="xs" />,
        }),
      );
    SUBJECTS.filter((s) => match(s.name, s.summary))
      .slice(0, q ? 6 : 4)
      .forEach((s) => out.push({ id: `s:${s.slug}`, group: "Subjects", label: s.name, hint: s.summary, href: `/tutors?subject=${s.slug}`, icon: <BookOpen className="size-4" /> }));
    return out;
  }, [query, tutors, me]);

  // Reset the highlighted row whenever the query changes (reset-on-change, no effect).
  const [lastQuery, setLastQuery] = React.useState(query);
  if (lastQuery !== query) {
    setLastQuery(query);
    setActive(0);
  }

  const go = (item: Item | undefined) => {
    if (!item) return;
    setOpenState(false);
    setQuery("");
    router.push(item.href);
  };

  const groups = items.reduce<Record<string, Item[]>>((acc, it) => {
    (acc[it.group] ??= []).push(it);
    return acc;
  }, {});

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(v) => {
        setOpenState(v);
        if (!v) setQuery("");
      }}
    >
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-[90] bg-night/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="fixed left-1/2 top-[12vh] z-[91] w-[calc(100vw-1.5rem)] max-w-[640px] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
                data-lenis-prevent
              >
                <DialogPrimitive.Title className="sr-only">Search TutorLink</DialogPrimitive.Title>
                <div className="flex items-center gap-3 border-b border-line px-5">
                  <Search className="size-[18px] shrink-0 text-ink" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActive((a) => Math.min(items.length - 1, a + 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActive((a) => Math.max(0, a - 1));
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        go(items[active]);
                      }
                    }}
                    placeholder="Search tutors, subjects, pages…"
                    aria-label="Search"
                    role="combobox"
                    aria-expanded
                    aria-controls="cmdk-list"
                    aria-activedescendant={items[active] ? `cmdk-${items[active].id}` : undefined}
                    className="h-14 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-subtle"
                  />
                  <kbd className="hidden rounded-md border border-line bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-muted sm:block">esc</kbd>
                </div>
                <div ref={listRef} id="cmdk-list" role="listbox" className="max-h-[min(60vh,460px)] overflow-y-auto p-2">
                  {items.length === 0 && (
                    <div className="px-4 py-12 text-center">
                      <p className="text-sm font-medium text-ink">No results for “{query}”</p>
                      <p className="mt-1 text-[13px] text-muted">Try a subject like “algebra”, a city, or a tutor&rsquo;s name.</p>
                    </div>
                  )}
                  {Object.entries(groups).map(([group, list]) => (
                    <div key={group} className="mb-1">
                      <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.08em] text-subtle">{group}</p>
                      {list.map((it) => {
                        const idx = items.indexOf(it);
                        const isActive = idx === active;
                        return (
                          <button
                            key={it.id}
                            id={`cmdk-${it.id}`}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onMouseMove={() => setActive(idx)}
                            onClick={() => go(it)}
                            className={cn("relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left", isActive ? "text-ink" : "text-ink-2")}
                          >
                            {isActive && <motion.span layoutId="cmdk-active" className="absolute inset-0 rounded-lg bg-canvas" transition={{ type: "spring", bounce: 0.15, duration: 0.3 }} />}
                            <span className={cn("relative grid size-8 shrink-0 place-items-center rounded-lg", isActive ? "bg-brand text-white" : "bg-canvas text-muted")}>{it.icon}</span>
                            <span className="relative min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{it.label}</span>
                              {it.hint && <span className="block truncate text-[12.5px] text-muted">{it.hint}</span>}
                            </span>
                            {isActive && <CornerDownLeft className="relative size-4 text-muted" />}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-line bg-canvas/60 px-5 py-2.5 text-[12px] text-muted">
                  <span className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><kbd className="rounded border border-line bg-surface px-1 font-mono">↑</kbd><kbd className="rounded border border-line bg-surface px-1 font-mono">↓</kbd> move</span>
                    <span className="flex items-center gap-1"><kbd className="rounded border border-line bg-surface px-1 font-mono">↵</kbd> open</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {me ? <LayoutDashboard className="size-3.5" /> : <UserRound className="size-3.5" />} {me ? `Signed in as ${me.firstName}` : "Browsing as guest"} <ArrowRight className="size-3" />
                  </span>
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

/** Pill-shaped search trigger with the ⌘K hint. */
export function SearchTrigger({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label="Search (Ctrl or Command + K)"
      className={cn(
        "group inline-flex h-10 items-center gap-2 rounded-lg text-[14px] font-medium text-ink transition-colors",
        compact ? "w-10 justify-center hover:bg-ink/5" : "border border-line-strong bg-surface pl-3 pr-1.5 hover:border-ink/40",
        className,
      )}
    >
      <Search className={compact ? "size-5" : "size-4"} strokeWidth={2.25} />
      {!compact && (
        <>
          <span className="pr-5 text-ink-2">Search</span>
          <kbd className="rounded-md border border-ink/15 bg-surface px-1.5 py-0.5 font-mono text-[10.5px] text-muted">⌘K</kbd>
        </>
      )}
    </button>
  );
}
