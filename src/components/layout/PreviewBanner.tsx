"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { IS_PREVIEW } from "@/lib/site";
import { SAMPLE_DATA } from "@/lib/sample-data";

const KEY = "tl-preview-banner-dismissed";

/** Discloses that everything shown is sample data. Required so sample content is never presented as genuine. */
const noopSubscribe = () => () => {};
function readDismissed(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function PreviewBanner() {
  const stored = React.useSyncExternalStore(noopSubscribe, readDismissed, () => "ssr");
  const [dismissed, setDismissed] = React.useState(false);
  const visible = stored !== "ssr" && stored !== "1" && !dismissed;
  const setVisible = (v: boolean) => setDismissed(!v);
  if (!IS_PREVIEW) return null;
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: "auto" }}
          exit={{ height: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden bg-night text-white"
        >
          <div className="container-page flex min-h-9 items-center justify-center gap-3 py-1.5 text-center text-[12.5px]">
            <span className="size-1.5 shrink-0 animate-pulse-dot rounded-full bg-brand" aria-hidden />
            <p className="text-white/80">
              <span className="font-medium text-white">Preview build.</span>{" "}
              {SAMPLE_DATA ? (
                <>
                  Tutors, reviews and figures are sample data.{" "}
                  <Link href="/login" className="font-medium text-white underline underline-offset-2">
                    Explore with a demo account
                  </Link>
                </>
              ) : (
                "No sample data — tutors, reviews and bookings appear as real people sign up."
              )}
            </p>
            <button
              type="button"
              aria-label="Dismiss"
              className="grid size-6 shrink-0 place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white"
              onClick={() => {
                setVisible(false);
                try {
                  sessionStorage.setItem(KEY, "1");
                } catch {
                  /* ignore */
                }
              }}
            >
              <X className="size-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
