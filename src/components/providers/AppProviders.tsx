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

/**
 * Loads the viewer's data from the server after mount (so server and first client render match) and
 * keeps it current: again when the tab regains focus, and every 30 seconds while signed in.
 */
function StoreHydrator() {
  React.useEffect(() => {
    void useApp.persist.rehydrate(); // the compare tray
    let last = Date.now();
    const refresh = () => {
      last = Date.now();
      return useApp.getState().refresh();
    };
    void refresh().then(async () => {
      // "Remember me" was unticked and the browser was closed since: end that session.
      if (sessionShouldEnd() && useApp.getState().sessionUserId) {
        await useApp.getState().logout();
        clearRememberMe();
      }
    });
    const onReturn = () => {
      if (document.visibilityState === "visible" && Date.now() - last > 10_000) void refresh();
    };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && useApp.getState().sessionUserId && Date.now() - last > 25_000) void refresh();
    }, 30_000);
    // The compare tray is shared between this browser's tabs.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORE_KEY) void useApp.persist.rehydrate();
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
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
