"use client";

import * as React from "react";
import { ArrowRight, UserRound } from "lucide-react";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Dialog, DialogContent } from "@/components/ui/Overlay";
import type { User } from "@/lib/types";

/**
 * Stands in for a provider's sign-in window (Google, Apple, Facebook, SSO) in the preview build:
 * pick an account used before in this browser, or enter a name and email. The provider vouches
 * for the address, so a new account starts verified and needs no password.
 */
export function ProviderSignIn({
  provider,
  icon,
  open,
  onOpenChange,
  onSignedIn,
}: {
  provider: string | null;
  icon?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignedIn: (user: User, isNew: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title={`Continue with ${provider ?? ""}`} description="Choose an account to continue to TutorLink." data-lenis-prevent>
        {provider && <Picker provider={provider} icon={icon} onSignedIn={onSignedIn} />}
      </DialogContent>
    </Dialog>
  );
}

function Picker({ provider, icon, onSignedIn }: { provider: string; icon?: React.ReactNode; onSignedIn: (user: User, isNew: boolean) => void }) {
  const accounts = useApp((s) => s.providerAccounts);
  const users = useApp((s) => s.users);
  const loginWithProvider = useApp((s) => s.loginWithProvider);
  const known = React.useMemo(() => accounts.filter((a) => a.provider === provider), [accounts, provider]);
  const [adding, setAdding] = React.useState(known.length === 0);
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const go = async (account: { email: string; firstName: string; lastName: string }) => {
    setBusy(true);
    setError(null);
    // The round trip to the provider.
    await new Promise((r) => setTimeout(r, 700));
    const existed = users.some((u) => u.email.toLowerCase() === account.email.trim().toLowerCase());
    const res = loginWithProvider(provider, account);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onSignedIn(res.data, !existed);
  };

  return (
    <div className="px-5 py-5">
      {known.length > 0 && !adding && (
        <ul className="divide-y divide-line border border-line">
          {known.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                disabled={busy}
                onClick={() => go(a)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sunken disabled:opacity-60"
              >
                <span className="grid size-9 shrink-0 place-items-center bg-canvas text-ink-2">{icon ?? <UserRound className="size-4" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium text-ink">
                    {a.firstName} {a.lastName}
                  </span>
                  <span className="block truncate text-[13px] text-muted">{a.email}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
              </button>
            </li>
          ))}
          <li>
            <button type="button" disabled={busy} onClick={() => setAdding(true)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[14.5px] font-medium text-ink transition-colors hover:bg-sunken">
              <span className="grid size-9 shrink-0 place-items-center border border-line-strong text-ink-2">
                <UserRound className="size-4" />
              </span>
              Use another account
            </button>
          </li>
        </ul>
      )}

      {adding && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void go({ email, firstName, lastName });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" required>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" autoFocus />
            </Field>
            <Field label="Last name" required>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
            </Field>
          </div>
          <Field label={`${provider} email`} required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder="you@example.com" />
          </Field>
          {error && (
            <p role="alert" className="text-[13.5px] text-danger">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className={cn("w-full")} loading={busy}>
            {busy ? "Signing in…" : `Continue with ${provider}`}
          </Button>
          {known.length > 0 && (
            <Button type="button" variant="ghost" className="w-full" onClick={() => setAdding(false)} disabled={busy}>
              Back to your accounts
            </Button>
          )}
        </form>
      )}

      <p className="mt-4 text-[12.5px] leading-relaxed text-muted">Preview build: this window stands in for {provider}&rsquo;s own sign-in. New accounts are created as students and start with a verified email.</p>
    </div>
  );
}
