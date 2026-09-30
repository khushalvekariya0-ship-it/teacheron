"use client";

import * as React from "react";
import { THEME_STORAGE_KEY } from "./theme-script";

/*
 * Light / dark theme. The `dark` class on <html> is the single source of truth: an inline script
 * in the root layout sets it before first paint (saved choice, else the OS preference), and
 * `setTheme` flips it and remembers the choice.
 */

export type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function current(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function apply(theme: Theme, animate: boolean) {
  const root = document.documentElement;
  if (animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.classList.add("theme-switching");
    window.setTimeout(() => root.classList.remove("theme-switching"), 400);
  }
  root.classList.toggle("dark", theme === "dark");
  listeners.forEach((l) => l());
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode: the choice just isn't remembered */
  }
  apply(theme, true);
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Until the visitor picks a theme, follow the OS setting live.
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onOs = () => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {}
    if (!saved) apply(mq.matches ? "dark" : "light", true);
  };
  mq.addEventListener("change", onOs);
  return () => {
    listeners.delete(onChange);
    mq.removeEventListener("change", onOs);
  };
}

/** Current theme (renders "light" on the server, then the real value on the client). */
export function useTheme(): Theme {
  return React.useSyncExternalStore(subscribe, current, () => "light");
}
