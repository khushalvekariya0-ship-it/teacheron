"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SceneProps {
  /** True while the canvas is on screen and motion is allowed — scenes pause their frame loop otherwise. */
  active: boolean;
  /** True on small screens — scenes lower their point counts. */
  compact: boolean;
}

const COMPACT_QUERY = "(max-width: 767px)";
function subscribeCompact(cb: () => void) {
  const mq = window.matchMedia(COMPACT_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function readCompact() {
  return window.matchMedia(COMPACT_QUERY).matches;
}

function supportsWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Mounts a three.js scene only when it scrolls near the viewport, pauses it when off screen,
 * renders a single static frame for reduced-motion users, and falls back to `fallback`
 * (a CSS texture) when WebGL is unavailable or while the 3D bundle loads.
 */
export function LazyScene({
  scene: Scene,
  className,
  fallback,
}: {
  scene: React.ComponentType<SceneProps>;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [near, setNear] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const compact = React.useSyncExternalStore(subscribeCompact, readCompact, () => false);
  const [webgl] = React.useState(() => (typeof window === "undefined" ? false : supportsWebGL()));

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setNear(true);
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("pointer-events-none", className)} aria-hidden>
      {(!near || !webgl) && fallback}
      {near && webgl && <Scene active={visible && !reduce} compact={compact} />}
    </div>
  );
}
