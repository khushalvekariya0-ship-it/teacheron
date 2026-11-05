"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AppleIcon, FacebookIcon, GoogleIcon } from "./SocialIcons";

/*
 * "Continue with Google / Facebook / Apple" — real OAuth / OpenID Connect sign-in through Supabase Auth
 * (/api/auth/oauth → the provider → /auth/callback). Styled after each provider's button guidelines:
 * Google's neutral button, Facebook blue (#1877F2) with the white "f", Apple black (white in dark mode).
 * Only providers switched on in Supabase (Authentication → Sign In / Providers) are shown, so no button
 * appears that can't work. A first-time social sign-in then chooses Student, Parent or Tutor (/welcome).
 */

const PROVIDERS: { id: "google" | "facebook" | "apple"; name: string; className: string; icon: React.ReactNode }[] = [
  { id: "google", name: "Google", className: "border border-line-strong bg-surface text-ink hover:bg-canvas", icon: <GoogleIcon className="size-5" /> },
  { id: "facebook", name: "Facebook", className: "border border-[#1877F2] bg-[#1877F2] text-white hover:border-[#166FE5] hover:bg-[#166FE5]", icon: <FacebookIcon className="size-5" onBrand /> },
  { id: "apple", name: "Apple", className: "border border-ink bg-ink text-on-ink hover:opacity-90", icon: <AppleIcon className="size-5" /> },
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
 * The social sign-in buttons. `role` (from the sign-up page) only pre-selects the choice on /welcome;
 * the role itself is chosen there and saved by the server.
 */
export function SocialSignIn({ next, providers, divider, role }: { next: string | null; providers: string[]; divider?: React.ReactNode; role?: "student" | "parent" | "tutor" }) {
  const shown = PROVIDERS.filter((p) => providers.includes(p.id));
  const sso = providers.includes("azure");
  if (!shown.length && !sso) return null;
  const href = (id: string) => `/api/auth/oauth?provider=${id}${next ? `&next=${encodeURIComponent(next)}` : ""}${role ? `&role=${role}` : ""}`;
  return (
    <>
      <div className="mt-7 space-y-3" data-social-signin="">
        {shown.map((p) => (
          <a
            key={p.id}
            href={href(p.id)}
            data-provider={p.id}
            className={cn("flex h-12 w-full items-center justify-center gap-3 rounded-full text-[15px] font-medium shadow-xs transition-colors active:translate-y-px", p.className)}
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
