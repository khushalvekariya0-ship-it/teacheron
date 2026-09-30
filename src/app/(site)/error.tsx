"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CircleAlert, House, LifeBuoy, RotateCcw } from "lucide-react";
import { EASE } from "@/components/motion";
import { Button } from "@/components/ui/Button";

export default function SiteError({ error, retry, reset }: { error: Error & { digest?: string }; retry?: () => void; reset?: () => void }) {
  React.useEffect(() => {
    // Hook for an error-reporting service (e.g. Sentry) once one is configured.
    console.error(error);
  }, [error]);

  const tryAgain = retry ?? reset;

  return (
    <section className="relative overflow-hidden bg-surface">
      <div className="container-page relative flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="flex flex-col items-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-danger-50 text-danger">
            <CircleAlert className="size-6" aria-hidden />
          </span>
          <h1 className="mt-6 font-heading text-[2.2rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-ink sm:text-5xl">Something went wrong on this page.</h1>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-ink-2">
            It&rsquo;s not you — we hit an unexpected error. Try again, and if it keeps happening, let us know.
          </p>
          {error.digest && (
            <p className="mt-4 rounded-md border border-line bg-canvas px-3 py-1.5 font-mono text-[12.5px] text-muted">
              Error reference: <span className="text-ink-2">{error.digest}</span>
            </p>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {tryAgain && (
              <Button onClick={() => tryAgain()}>
                <RotateCcw /> Try again
              </Button>
            )}
            <Button asChild variant="secondary">
              <Link href="/">
                <House /> Go to the homepage
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/contact">
                <LifeBuoy /> Contact support
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
