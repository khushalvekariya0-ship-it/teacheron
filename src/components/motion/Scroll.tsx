"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { gsap, ScrollTrigger } from "./gsap";

/**
 * Lenis smooth scrolling for the whole app, driven by GSAP's ticker so ScrollTrigger animations
 * stay perfectly in sync. Touch keeps native scrolling. Pauses while a dialog/drawer locks the page,
 * never hijacks scroll inside menus, dialogs or scrollable panels, and is off for reduced motion.
 */
/** The live Lenis instance (null with reduced motion, before mount, or after unmount). */
let activeLenis: Lenis | null = null;

/** Smoothly scroll the page back to the top — through Lenis when it is running, natively otherwise. */
export function scrollToTop() {
  if (activeLenis) {
    activeLenis.scrollTo(0, { duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 4) });
    return;
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}

export function SmoothScroll() {
  const reduce = useReducedMotion();
  const pathname = usePathname();
  const lenisRef = React.useRef<Lenis | null>(null);

  React.useEffect(() => {
    if (reduce) return;
    const lenis = new Lenis({
      autoRaf: false,
      lerp: 0.1,
      anchors: { offset: -80 },
      allowNestedScroll: true,
      stopInertiaOnNavigate: true,
      prevent: (node) => !!node.closest?.('[role="dialog"], [role="listbox"], [role="menu"], [data-radix-popper-content-wrapper], [data-lenis-prevent]'),
    });
    lenisRef.current = lenis;
    activeLenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    // Radix marks <body data-scroll-locked> while a dialog/sheet is open — stop smoothing then.
    const sync = () => (document.body.hasAttribute("data-scroll-locked") ? lenis.stop() : lenis.start());
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { attributes: true, attributeFilter: ["data-scroll-locked"] });
    return () => {
      mo.disconnect();
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
      if (activeLenis === lenis) activeLenis = null;
    };
  }, [reduce]);

  // New page: let ScrollTrigger re-measure once the new layout has settled.
  // (Next restores/resets native scroll itself; Lenis re-syncs from the native scroll event.)
  React.useEffect(() => {
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 120);
    return () => window.clearTimeout(id);
  }, [pathname]);

  React.useEffect(() => {
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
  }, []);

  return null;
}

/** Reading-progress line pinned to the top of the viewport, in the aurora gradient. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 220, damping: 32, mass: 0.3 });
  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-brand-gradient"
      style={{ scaleX }}
    />
  );
}
