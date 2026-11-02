"use client";

import * as React from "react";
import { AppleIcon, FacebookIcon, GoogleIcon } from "./SocialIcons";

const PROVIDERS: { id: string; name: string; icon: React.ReactNode }[] = [
  { id: "google", name: "Google", icon: <GoogleIcon className="size-5" /> },
  { id: "facebook", name: "Facebook", icon: <FacebookIcon className="size-5" /> },
  { id: "apple", name: "Apple", icon: <AppleIcon className="size-5 text-ink" /> },
];

/** Social sign-ins switched on in Supabase (Authentication → Providers). Empty until one is configured. */
export function useEnabledProviders(): string[] | null {
  const [list, setList] = React.useState<string[] | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/providers", { cache: "no-store" })
      .then((r) => r.json())
      .then((b: { providers?: string[] }) => !cancelled && setList(b.providers ?? []))
      .catch(() => !cancelled && setList([]));
    return () => {
      cancelled = true;
    };
  }, []);
  return list;
}

/**
 * "Continue with Google / Facebook / Apple" (and corporate SSO through Microsoft) — real OAuth sign-in
 * through Supabase. Only providers the owner switched on are shown; with none, nothing renders.
 * A first-time social sign-in creates a student account.
 */
export function SocialSignIn({ next, providers, divider }: { next: string | null; providers: string[]; divider?: React.ReactNode }) {
  const shown = PROVIDERS.filter((p) => providers.includes(p.id));
  const sso = providers.includes("azure");
  if (!shown.length && !sso) return null;
  const href = (id: string) => `/api/auth/oauth?provider=${id}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  return (
    <>
      <div className="mt-7 space-y-3">
        {shown.map((p) => (
          <a
            key={p.id}
            href={href(p.id)}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-line-strong bg-surface text-[15px] font-medium text-ink shadow-xs transition-colors hover:border-subtle hover:bg-canvas active:translate-y-px"
          >
            {p.icon}
            Continue with {p.name}
          </a>
        ))}
        {sso && (
          <p className="pt-1 text-center">
            <a href={href("azure")} className="text-[14px] font-medium text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
              Continue with corporate login (SSO)
            </a>
          </p>
        )}
      </div>
      {divider}
    </>
  );
}
