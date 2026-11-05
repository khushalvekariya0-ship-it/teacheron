"use client";

import * as React from "react";
import Link from "next/link";
import { House, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

/**
 * Branded "something went wrong" page for any page that fails while loading. The message stays
 * general (the details are in the server log, matched by the reference code).
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  React.useEffect(() => {
    console.error("[page error]", error.digest ?? "", error);
  }, [error]);

  return (
    <main id="main" className="relative flex min-h-dvh flex-col overflow-hidden bg-page">
      <div className="pointer-events-none absolute inset-0 bg-line-grid mask-radial opacity-80" aria-hidden />
      <header className="container-page relative flex h-16 items-center">
        <Logo />
      </header>
      <div className="container-page relative flex flex-1 flex-col items-center justify-center py-16 text-center">
        <p className="font-mono text-sm font-medium tracking-[0.2em] text-muted">500</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.025em] text-ink sm:text-5xl">Something went wrong on our side.</h1>
        <p className="mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-muted">
          This page didn&rsquo;t load. Your account and bookings are safe. Try again, and if it keeps happening, contact support.
        </p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Button size="lg" onClick={() => retry()}>
            <RefreshCw /> Try again
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/">
              <House /> Go to the home page
            </Link>
          </Button>
        </div>
        <p className="mt-6 text-[13px] text-muted">
          Still stuck?{" "}
          <Link href="/contact" className="font-medium text-ink underline underline-offset-4">
            Contact support
          </Link>
          {error.digest && (
            <>
              {" "}
              and mention reference <span className="font-mono">{error.digest}</span>
            </>
          )}
          .
        </p>
      </div>
    </main>
  );
}
