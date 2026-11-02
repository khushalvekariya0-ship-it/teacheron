"use client";

import { useApp } from "@/lib/store";

/**
 * Shown only while the site isn't connected to its database and sign-in service yet, so visitors
 * aren't told that sign-up or booking works when it can't. Disappears once Supabase is configured.
 */
export function PreviewBanner() {
  const configured = useApp((s) => s.config.configured);
  const hydrated = useApp((s) => s.hydrated);
  if (!hydrated || configured) return null;
  return (
    <div className="bg-night text-white">
      <div className="container-page flex min-h-9 items-center justify-center gap-3 py-1.5 text-center text-[12.5px]">
        <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
        <p className="text-white/80">
          <span className="font-medium text-white">Setup in progress.</span> The database isn&apos;t connected yet, so signing up, signing in and booking are switched off.
        </p>
      </div>
    </div>
  );
}
