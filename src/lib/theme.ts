"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

/** localStorage key — the inline head script (theme-script.ts) reads the same one before first paint. */
export const THEME_KEY = "theme";
const EVENT = "tutorlink:theme";

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function read(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Switches the theme, remembers it, and cross-fades colours instead of snapping. */
export function setTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  apply(theme);
  window.setTimeout(() => root.classList.remove("theme-switching"), 320);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  // Another tab changed the theme: follow it.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_KEY) return;
    apply(e.newValue === "dark" ? "dark" : "light");
    onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The active theme. Reports "light" during SSR and hydration, then whatever the head script applied. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => "light");
}
