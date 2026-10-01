"use client";

import * as React from "react";
import { THEME_STORAGE_KEY } from "./theme-script";

/*
 * Light / dark theme. The `dark` class on <html> is the single source of truth: an inline script
 * in the root layout sets it before first paint (saved choice, else navy/dark by default), and
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
  return () => {
    listeners.delete(onChange);
  };
}

/** Current theme (renders "dark" — the default — on the server, then the real value on the client). */
export function useTheme(): Theme {
  return React.useSyncExternalStore(subscribe, current, () => "dark");
}
