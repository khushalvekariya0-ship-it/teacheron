"use client";

import * as React from "react";
import { MotionConfig, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { gsap, SplitText, useGSAP, prefersReducedMotion } from "./gsap";

/*
 * Motion system
 *  - GSAP + ScrollTrigger: everything that happens as you scroll (reveals, split headings, parallax,
 *    scrubbed color, counters, aurora fields). Same component API as before, so every page gets it.
 *  - Motion (framer-motion): component state (dialogs, menus, tabs, layout, presence).
 *  - Lenis: smooth scroll, driven by GSAP's ticker (see Scroll.tsx).
 * One easing family (expo.out) and short distances keep it sharp. Reduced motion is always honored.
 */

export const EASE = [0.22, 1, 0.36, 1] as const;
export const EASE_EXPO = [0.16, 1, 0.3, 1] as const;

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.5, ease: EASE }}>
      {children}
    </MotionConfig>
  );
}

type RevealTag = "div" | "section" | "li" | "span" | "ul" | "ol" | "article" | "header" | "figure";

/** Fades and lifts content into view when it scrolls into the viewport (GSAP ScrollTrigger). */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
  as = "div",
  amount = 0.25,
  ...rest
}: { children: React.ReactNode; delay?: number; y?: number; className?: string; as?: RevealTag; amount?: number } & Omit<React.HTMLAttributes<HTMLElement>, "children">) {
  const ref = React.useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (prefersReducedMotion()) {
        gsap.set(el, { autoAlpha: 1 });
        return;
      }
      gsap.fromTo(
        el,
        { y, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 1.05, delay, ease: "expo.out", scrollTrigger: { trigger: el, start: `top ${100 - amount * 40}%`, once: true } },
      );
    },
    { scope: ref },
  );
  return React.createElement(as, { ref, "data-reveal": "", className, ...rest }, children);
}

/** Staggers its <StaggerItem> children into view. */
export function Stagger({
  children,
  className,
  stagger = 0.07,
  amount = 0.15,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  amount?: number;
  as?: "div" | "ul" | "ol";
}) {
  const ref = React.useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>("[data-stagger-item]")).filter((i) => i.closest("[data-stagger]") === el);
      if (!items.length) return;
      if (prefersReducedMotion()) {
        gsap.set(items, { autoAlpha: 1 });
        return;
      }
      gsap.fromTo(
        items,
        { y: 22, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.95, ease: "expo.out", stagger, scrollTrigger: { trigger: el, start: `top ${100 - amount * 40}%`, once: true } },
      );
    },
    { scope: ref },
  );
  return React.createElement(as, { ref, "data-stagger": "", className }, children);
}

export function StaggerItem({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "li" }) {
  return React.createElement(as, { "data-stagger-item": "", className }, children);
}

/**
 * Split-text headline reveal (GSAP SplitText, line-masked words). Plays on mount, or on scroll with
 * `inView`. `gradient` paints each word with the animated aurora gradient. Screen readers get the
 * plain text (SplitText aria: "auto").
 */
export function WordReveal({
  text,
  className,
  delay = 0,
  as = "h1",
  inView = false,
  gradient = false,
  accent = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  inView?: boolean;
  gradient?: boolean;
  /** Render the last N words in the italic display serif with the aurora gradient. */
  accent?: number;
}) {
  const ref = React.useRef<HTMLElement>(null);
  const words = text.split(" ");
  const n = Math.min(accent, words.length);
  const main = words.slice(0, words.length - n).join(" ");
  const tail = words.slice(words.length - n).join(" ");
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (prefersReducedMotion()) {
        gsap.set(el, { autoAlpha: 1 });
        return;
      }
      SplitText.create(el, {
        type: "words,lines",
        mask: "lines",
        linesClass: "split-line",
        ...(gradient ? { wordsClass: "text-aurora" } : {}),
        aria: "auto",
        autoSplit: true,
        onSplit(self) {
          self.words.forEach((w) => {
            if (w.closest("em")) w.classList.add("text-aurora");
          });
          gsap.set(el, { autoAlpha: 1 });
          return gsap.from(self.words, {
            yPercent: 115,
            rotate: 2,
            duration: 1.1,
            ease: "expo.out",
            stagger: 0.045,
            delay,
            scrollTrigger: inView ? { trigger: el, start: "top 88%", once: true } : undefined,
          });
        },
      });
    },
    { scope: ref, dependencies: [text, accent] },
  );
  // Keyed by text: SplitText rewrites the DOM, so new text gets a fresh element rather than a React diff.
  const content = n ? (
    <>
      {main}
      {main && " "}
      <em className="accent pr-[0.06em]">{tail}</em>
    </>
  ) : (
    text
  );
  return React.createElement(as, { key: `${text}|${n}`, ref, "data-split": "", className }, content);
}

/** Counts up to a number when it first enters the viewport. Use only for real, verifiable values. */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString("en-US"), className, duration = 1.4 }: { value: number; format?: (n: number) => string; className?: string; duration?: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  // Server render shows the real value; the count starts from zero when it scrolls into view.
  const [display, setDisplay] = React.useState(() => format(value));
  const show = React.useEffectEvent((n: number) => setDisplay(format(n)));
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      const proxy = { v: 0 };
      gsap.to(proxy, {
        v: value,
        duration,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 95%", once: true },
        onStart: () => show(0),
        onUpdate: () => show(proxy.v),
      });
    },
    { scope: ref, dependencies: [value, duration] },
  );
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {display}
    </span>
  );
}

/** Moves an element at a different speed than the scroll (GSAP scrub). speed > 0 floats up. */
export function Parallax({ children, speed = 0.15, className }: { children: React.ReactNode; speed?: number; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      gsap.fromTo(el, { yPercent: speed * 50 }, { yPercent: -speed * 50, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * Big statement text whose words fill with ink as you scroll (GSAP scrub). Words listed in
 * `highlight` finish in the aurora gradient.
 */
export function ScrubText({ text, highlight = [], className }: { text: string; highlight?: string[]; className?: string }) {
  const ref = React.useRef<HTMLParagraphElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const split = SplitText.create(el, { type: "words", aria: "auto" });
      const marked = new Set(highlight.map((w) => w.toLowerCase().replace(/[^a-z]/g, "")));
      split.words.forEach((w) => {
        if (marked.has((w.textContent ?? "").toLowerCase().replace(/[^a-z]/g, ""))) w.classList.add("text-aurora");
      });
      if (prefersReducedMotion()) return;
      gsap.fromTo(
        split.words,
        { opacity: 0.14 },
        { opacity: 1, ease: "none", stagger: 0.12, scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 42%", scrub: 0.6 } },
      );
    },
    { scope: ref, dependencies: [text] },
  );
  return (
    <p ref={ref} className={className}>
      {text}
    </p>
  );
}

/**
 * Former drifting color fields. The flat design has no gradient backdrops, so this renders
 * nothing; it stays exported so existing call sites keep compiling.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Aurora(_props: { className?: string; intensity?: number; colors?: string[] }) {
  return null;
}

/** Gently pulls its child toward the pointer (GSAP quickTo). For primary calls to action. */
export function Magnetic({ children, strength = 0.25, className }: { children: React.ReactNode; strength?: number; className?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  useGSAP(
    (_, contextSafe) => {
      const el = ref.current;
      if (!el || prefersReducedMotion() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
      const move = contextSafe!((e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      });
      const leave = contextSafe!(() => {
        xTo(0);
        yTo(0);
      });
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
      return () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerleave", leave);
      };
    },
    { scope: ref },
  );
  return (
    <span ref={ref} className={cn("inline-flex", className)}>
      {children}
    </span>
  );
}

/** Infinite horizontal marquee. Pauses on hover; static when reduced motion is requested. */
export function Marquee({ children, className, duration = 40, reverse }: { children: React.ReactNode; className?: string; duration?: number; reverse?: boolean }) {
  return (
    <div className={cn("group relative flex overflow-hidden mask-fade-x", className)}>
      <div
        className="flex w-max shrink-0 animate-marquee group-hover:[animation-play-state:paused]"
        style={{ "--marquee-duration": `${duration}s`, animationDirection: reverse ? "reverse" : undefined } as React.CSSProperties}
      >
        <div className="flex gap-3 pr-3">{children}</div>
        <div className="flex gap-3 pr-3" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Subtle page-enter transition used by route templates. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }}>
      {children}
    </motion.div>
  );
}

export { motion, AnimatePresence, LayoutGroup } from "framer-motion";
export { gsap, ScrollTrigger, useGSAP, AURORA } from "./gsap";
