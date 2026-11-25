"use client";

import * as React from "react";
import { THEME_KEY } from "@/lib/theme";

/**
 * The admin panel is always white (`.admin-ui` in globals.css). The head script sets it when a page loads on
 * /admin; this keeps it right when moving into or out of /admin without a reload: the visitor's own theme
 * (white by default) comes back when they leave.
 */
export function AdminTheme() {
  React.useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add("admin-ui");
    root.classList.remove("dark");
    return () => {
      root.classList.remove("admin-ui");
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(THEME_KEY);
      } catch {
        // storage blocked: the default theme
      }
      root.classList.toggle("dark", saved === "dark");
    };
  }, []);
  return null;
}
