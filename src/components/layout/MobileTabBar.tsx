"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, House, Search, Sparkles, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/store/hooks";
import { homeFor } from "@/lib/permissions";
import { SmartMatchQuiz } from "@/components/home/SmartMatchQuiz";

/** Pages that pin their own action bar to the bottom of the screen keep that edge to themselves. */
const OWN_BOTTOM_BAR = [/^\/tutors\/[^/]+$/, /^\/tutor-jobs\/[^/]+$/, /^\/post-requirement/];

function Tab({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; active: boolean }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn("flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors", active ? "text-brand" : "text-muted hover:text-ink")}
      >
        <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
        {label}
      </Link>
    </li>
  );
}

/**
 * Phone-only bottom navigation, like a native app: the four places a learner goes most, with
 * Smart Match as the raised coral button in the middle. Hidden from 768px, where the navbar has room.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const me = useSession();
  const [quizOpen, setQuizOpen] = React.useState(false);
  if (OWN_BOTTOM_BAR.some((r) => r.test(pathname))) return null;

  const staff = me?.role === "admin" || me?.role === "support";
  const lessons = !me ? "/login?next=%2Fdashboard%2Fbookings" : staff ? "/admin/bookings" : "/dashboard/bookings";

  return (
    <>
      {/* Keeps the end of the page clear of the bar. */}
      <div className="h-[4.5rem] md:hidden" aria-hidden />
      <nav aria-label="Quick navigation" data-fixed-bottom className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 md:hidden">
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
          <Tab href="/" label="Home" icon={House} active={pathname === "/"} />
          <Tab href="/tutors" label="Tutors" icon={Search} active={pathname.startsWith("/tutors")} />
          <li className="flex justify-center">
            <button
              type="button"
              onClick={() => setQuizOpen(true)}
              aria-label="Smart Match: find my tutor"
              className="-mt-7 grid size-14 place-items-center rounded-full bg-cta text-on-cta shadow-[0_10px_24px_-8px_var(--color-cta-glow)] ring-4 ring-surface transition-transform active:scale-95"
            >
              <Sparkles className="size-6" />
            </button>
          </li>
          <Tab href={lessons} label="Lessons" icon={CalendarDays} active={false} />
          <Tab href={me ? homeFor(me.role) : "/login"} label={me ? "Account" : "Log in"} icon={UserRound} active={pathname === "/login"} />
        </ul>
      </nav>
      <SmartMatchQuiz open={quizOpen} onOpenChange={setQuizOpen} />
    </>
  );
}
