"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

/*
 * GSAP runs the scroll-driven layer of the site (reveals, split text, parallax, scrubbed color,
 * pinned sequences); Motion (framer-motion) handles component state animations; Lenis smooths
 * the scroll and feeds ScrollTrigger. Plugins are registered once, client-side.
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);
  gsap.defaults({ ease: "expo.out", duration: 0.9 });
}

export { gsap, ScrollTrigger, SplitText, useGSAP };

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Light aurora palette shared by GSAP backgrounds and the 3D hero. */
export const AURORA = {
  sky: "#38bdf8",
  indigo: "#818cf8",
  violet: "#a78bfa",
  teal: "#5eead4",
  pink: "#f9a8d4",
  peach: "#fdba74",
} as const;
