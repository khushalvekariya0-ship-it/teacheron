"use client";

import * as React from "react";
import { MotionProvider } from "@/components/motion";
import { SmoothScroll } from "@/components/motion/Scroll";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { TooltipProvider } from "@/components/ui/Overlay";
import { Toaster } from "@/components/ui/Toast";
import { BackToTop } from "@/components/layout/BackToTop";
import { useApp, STORE_KEY } from "@/lib/store";
import { clearRememberMe, sessionShouldEnd } from "@/lib/remember";

/** Rehydrates the persisted store after mount so server and first client render always match. */
function StoreHydrator() {
  React.useEffect(() => {
    const done = () => {
      // "Remember me" was unticked and the browser was closed since: end that session.
      if (sessionShouldEnd() && useApp.getState().sessionUserId) {
        useApp.getState().logout();
        clearRememberMe();
      }
      useApp.getState().setHydrated();
      // Stand-in for the backend scheduler: expire stale requests, auto-complete finished lessons.
      useApp.getState().runScheduledJobs();
    };
    const res = useApp.persist.rehydrate();
    if (res && typeof (res as Promise<void>).then === "function") (res as Promise<void>).then(done, done);
    else done();
    const timer = setInterval(() => useApp.getState().runScheduledJobs(), 60_000);
    // Keep tabs in sync: another tab writing to the store updates this one.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORE_KEY) useApp.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}

/**
 * One passive pointer listener drives the hover spotlight on every `[data-spotlight]` card:
 * it writes the pointer position into CSS variables that globals.css turns into a soft glow + border light.
 */
function SpotlightTracker() {
  React.useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      frame = 0;
      const e = last;
      if (!e) return;
      const el = (e.target as Element | null)?.closest?.("[data-spotlight]") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
      el.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
    };
    const onMove = (e: PointerEvent) => {
      last = e;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <TooltipProvider delayDuration={200}>
        <StoreHydrator />
        <SpotlightTracker />
        <SmoothScroll />
        {children}
        <CommandPalette />
        <BackToTop />
        <Toaster />
      </TooltipProvider>
    </MotionProvider>
  );
}
