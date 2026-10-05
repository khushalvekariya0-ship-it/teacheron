"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./icons";

/**
 * Sticky bar of page sections under the navbar (subject areas by default). The section you're reading
 * is highlighted (an IntersectionObserver watches each section by its id).
 */
export function AreaNav({ areas, icons = true, label = "Subject areas" }: { areas: { slug: string; name: string }[]; icons?: boolean; label?: string }) {
  const [active, setActive] = React.useState(areas[0]?.slug);

  React.useEffect(() => {
    const sections = areas.map((a) => document.getElementById(a.slug)).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-35% 0px -60% 0px" },
    );
    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [areas]);

  return (
    <nav aria-label={label} className="sticky top-16 z-30 border-b border-line bg-white/85 backdrop-blur-xl backdrop-saturate-150">
      <div className="container-page">
        <ul className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1 py-2.5">
          {areas.map((a) => {
            const on = a.slug === active;
            return (
              <li key={a.slug} className="shrink-0">
                <a
                  href={`#${a.slug}`}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[14px] font-medium transition-colors",
                    on ? "bg-ink text-white" : "text-ink-2 hover:bg-sunken hover:text-ink",
                  )}
                >
                  {/* Icon only on the current area, so all nine areas fit on one line */}
                  {on && icons && <CategoryIcon slug={a.slug} className="size-4" />}
                  {a.name}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
