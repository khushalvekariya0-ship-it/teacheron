"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

let items: ToastItem[] = [];
let counter = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function push(tone: Tone, title: string, opts: { description?: string; action?: ToastItem["action"]; duration?: number } = {}) {
  const id = ++counter;
  items = [...items.slice(-3), { id, tone, title, description: opts.description, action: opts.action }];
  emit();
  setTimeout(() => dismiss(id), opts.duration ?? (tone === "error" ? 6000 : 4000));
  return id;
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const toast = Object.assign((title: string, opts?: Parameters<typeof push>[2]) => push("info", title, opts), {
  success: (title: string, opts?: Parameters<typeof push>[2]) => push("success", title, opts),
  error: (title: string, opts?: Parameters<typeof push>[2]) => push("error", title, opts),
  dismiss,
});

const EMPTY: ToastItem[] = [];

export function Toaster() {
  const list = React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
    () => EMPTY,
  );
  return (
    <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:bottom-4 sm:right-4 sm:left-auto sm:items-end">
      <AnimatePresence initial={false}>
        {list.map((t) => {
          const Icon = t.tone === "success" ? CircleCheck : t.tone === "error" ? CircleAlert : Info;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15 } }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
              role={t.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-lg"
            >
              <Icon className={cn("mt-0.5 size-[18px] shrink-0", t.tone === "success" ? "text-success" : t.tone === "error" ? "text-danger" : "text-navy")} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[13px] text-muted">{t.description}</p>}
                {t.action && (
                  <button
                    type="button"
                    onClick={() => {
                      t.action!.onClick();
                      dismiss(t.id);
                    }}
                    className="mt-1.5 text-[13px] font-medium text-navy hover:underline"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="-m-1 grid size-7 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink" aria-label="Dismiss">
                <X className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
