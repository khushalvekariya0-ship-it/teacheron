"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { scrollToTop } from "@/components/motion/Scroll";

const SHOW_AFTER = 480; // px scrolled before the button appears
const GAP = 16; // px between the button and the screen edge / a bottom bar

/**
 * How far a bar pinned to the bottom of the screen (booking bar, compare tray, form actions…)
 * reaches up from the bottom edge. Bars opt in with `data-fixed-bottom`.
 */
function bottomBarClearance() {
  let clearance = 0;
  document.querySelectorAll<HTMLElement>("[data-fixed-bottom]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height === 0 || r.top >= window.innerHeight) return;
    clearance = Math.max(clearance, window.innerHeight - r.top);
  });
  return clearance;
}

/**
 * Floating "back to top" arrow on every page. Appears once you have scrolled down, shows reading
 * progress as a ring, and glides back to the top when pressed. Moves up to clear any bar pinned
 * to the bottom of the screen.
 */
export function BackToTop() {
  const pathname = usePathname();
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.3 });
  const [visible, setVisible] = React.useState(false);
  const [lift, setLift] = React.useState(0);

  const measure = React.useCallback((y: number) => {
    setVisible(y > SHOW_AFTER);
    setLift(bottomBarClearance());
  }, []);

  useMotionValueEvent(scrollY, "change", measure);

  // Bars can mount/unmount without a scroll (new page, compare tray filling up, resizing).
  // Only element additions/removals are watched, and re-measuring is throttled.
  React.useEffect(() => {
    let timer: number | undefined;
    const run = () => measure(window.scrollY);
    const schedule = () => {
      if (timer === undefined) timer = window.setTimeout(() => ((timer = undefined), run()), 200);
    };
    schedule();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.clearTimeout(timer);
      mo.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [measure, pathname]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          key="back-to-top"
          onClick={(e) => {
            scrollToTop();
            e.currentTarget.blur();
          }}
          aria-label="Back to top"
          title="Back to top"
          initial={{ opacity: 0, scale: 0.7, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: 12 }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", bounce: 0.3, duration: 0.45 }}
          style={{ bottom: lift + GAP }}
          className="group fixed right-4 z-40 grid size-12 place-items-center rounded-full border border-line bg-surface text-ink shadow-lg transition-[bottom,background-color,color,border-color] duration-300 hover:border-ink hover:bg-ink hover:text-on-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:right-6 sm:size-[52px]"
        >
          {/* Reading progress ring */}
          <svg viewBox="0 0 48 48" className="pointer-events-none absolute inset-0 size-full -rotate-90" aria-hidden>
            <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="2" />
            <motion.circle
              cx="24"
              cy="24"
              r="22"
              fill="none"
              className="stroke-brand group-hover:stroke-white"
              strokeWidth="2"
              strokeLinecap="round"
              style={{ pathLength: progress }}
            />
          </svg>
          <ArrowUp className="relative size-5 transition-transform duration-300 group-hover:-translate-y-0.5" strokeWidth={2.25} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
