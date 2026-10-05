"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { GitCompareArrows, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { useTutors } from "@/lib/store/hooks";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

/** Floating tray that follows the visitor while they collect up to three tutors to compare. */
export function CompareTray() {
  const ids = useApp((s) => s.compare);
  const hydrated = useApp((s) => s.hydrated);
  const toggle = useApp((s) => s.toggleCompare);
  const clear = useApp((s) => s.clearCompare);
  const tutors = useTutors();
  const pathname = usePathname();
  const selected = ids.map((id) => tutors.find((t) => t.id === id)).filter(Boolean) as typeof tutors;
  const show = hydrated && selected.length > 0 && pathname !== "/compare";
  // Tutor profiles have their own sticky booking bar on small screens; the tray yields to it there.
  const onProfile = /^\/tutors\/[^/]+$/.test(pathname);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", bounce: 0.18, duration: 0.5 }}
          className={`fixed inset-x-0 bottom-20 z-30 md:bottom-4 justify-center px-4 ${onProfile ? "hidden lg:flex" : "flex"}`}
          role="region"
          aria-label="Tutors selected for comparison"
        >
          <div data-fixed-bottom className="flex w-full max-w-xl items-center gap-3 rounded-xl border border-line-strong bg-surface p-2.5 pl-4 shadow-lg">
            <GitCompareArrows className="hidden size-4 shrink-0 text-navy sm:block" />
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <AnimatePresence initial={false}>
                {selected.map((t) => (
                  <motion.div key={t.id} layout initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} className="group relative">
                    <Avatar name={`${t.firstName} ${t.lastName}`} src={t.photoUrl} tone={t.tone} size="sm" />
                    <button
                      type="button"
                      onClick={() => toggle(t.id)}
                      aria-label={`Remove ${t.firstName} from comparison`}
                      className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-ink text-on-ink opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                    >
                      <X className="size-2.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {Array.from({ length: 3 - selected.length }).map((_, i) => (
                <span key={i} className="size-8 rounded-full border border-dashed border-line-strong" aria-hidden />
              ))}
              <span className="ml-1 hidden text-[13px] text-muted sm:inline">{selected.length} of 3 selected</span>
            </div>
            <button type="button" onClick={clear} className="px-2 text-[13px] text-muted hover:text-ink">
              Clear
            </button>
            <Button asChild size="sm" disabled={selected.length < 2}>
              <Link href="/compare" aria-disabled={selected.length < 2} className={selected.length < 2 ? "pointer-events-none opacity-50" : undefined}>
                Compare
              </Link>
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
