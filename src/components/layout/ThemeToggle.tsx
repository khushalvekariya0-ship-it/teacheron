"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { setTheme, useTheme } from "@/lib/theme";

/** Sun/moon button that switches between the light and dark theme. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={cn("relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg text-ink transition-colors hover:bg-ink/5", className)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: 14, rotate: -90, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          exit={{ y: -14, rotate: 90, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="grid place-items-center"
        >
          {dark ? <Sun className="size-5" strokeWidth={2.1} /> : <Moon className="size-5" strokeWidth={2.1} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
