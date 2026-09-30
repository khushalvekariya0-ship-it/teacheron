"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "@/components/motion";

export const PROFILE_SECTIONS = [
  { id: "about", label: "About" },
  { id: "subjects", label: "Subjects" },
  { id: "experience", label: "Experience" },
  { id: "availability", label: "Availability" },
  { id: "reviews", label: "Reviews" },
  { id: "trust", label: "Trust" },
] as const;

type SectionId = (typeof PROFILE_SECTIONS)[number]["id"];

/** Sticky in-page navigation that highlights the section currently in view. */
export function SectionNav({ reviewCount }: { reviewCount: number }) {
  const [active, setActive] = React.useState<SectionId>("about");
  const listRef = React.useRef<HTMLUListElement>(null);
  const lockUntil = React.useRef(0);

  React.useEffect(() => {
    const els = PROFILE_SECTIONS.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const onScroll = () => {
      if (performance.now() < lockUntil.current) return;
      // The active section is the last one whose top has passed the reading line under the sticky bars.
      const line = 150;
      let current: SectionId = PROFILE_SECTIONS[0].id;
      for (const el of els) if (el.getBoundingClientRect().top - line <= 0) current = el.id as SectionId;
      // At the very bottom, the last section wins even if it's short.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = els[els.length - 1].id as SectionId;
      setActive(current);
    };
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Keep the active tab visible in the horizontal rail on small screens.
  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    const rail = listRef.current;
    if (!el || !rail || rail.scrollWidth <= rail.clientWidth) return;
    rail.scrollTo({ left: el.offsetLeft - rail.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  const jump = (e: React.MouseEvent<HTMLAnchorElement>, id: SectionId) => {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    lockUntil.current = e.timeStamp + 900; // event time shares the performance.now() clock
    setActive(id);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(window.history.state, "", `#${id}`);
  };

  return (
    <nav aria-label="Profile sections" className="sticky top-16 z-20 -mx-4 border-b border-line bg-surface sm:-mx-6 lg:mx-0">
      <ul ref={listRef} className="scrollbar-none flex gap-1 overflow-x-auto px-1 sm:px-3 lg:-ml-3 lg:px-0">
        {PROFILE_SECTIONS.map((s) => {
          const isActive = s.id === active;
          return (
            <li key={s.id} data-id={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                onClick={(e) => jump(e, s.id)}
                aria-current={isActive ? "location" : undefined}
                className={cn("relative flex h-12 items-center gap-1.5 px-3 text-sm font-medium transition-colors", isActive ? "text-ink" : "text-muted hover:text-ink")}
              >
                {s.label}
                {s.id === "reviews" && reviewCount > 0 && <span className="rounded-full bg-sunken px-1.5 py-px text-[11px] tabular-nums text-muted">{reviewCount}</span>}
                {isActive && <motion.span layoutId="profile-section-indicator" className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-navy" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
