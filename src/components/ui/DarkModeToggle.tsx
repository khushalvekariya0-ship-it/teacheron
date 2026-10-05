"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { setTheme, useTheme } from "@/lib/theme";

/** Switches between the light theme and the OLED-black dark theme. The choice is remembered. */
export function DarkModeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={dark}
      className={cn("relative grid size-10 shrink-0 place-items-center rounded-full border border-line-strong text-ink transition-colors hover:bg-sunken", className)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: dark ? -90 : 90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: dark ? 90 : -90, scale: 0.6 }}
          transition={{ duration: 0.18 }}
          className="grid place-items-center"
        >
          {dark ? <Sun className="size-[18px]" strokeWidth={2.2} /> : <Moon className="size-[18px]" strokeWidth={2.2} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
