"use client";

import * as React from "react";
import Link from "next/link";
import { Clock, Loader2, LogIn, ShieldAlert, User as UserIcon, Video } from "lucide-react";
import type { JoinTicket } from "@/lib/classroom";
import { Button } from "@/components/ui/Button";
import { LiveClassroom } from "./LiveClassroom";

/**
 * The guest link (/classroom/<lesson>?g=<code>) for someone without an account. They knock with their
 * name and wait: a media token is only handed out once the host admits them, so a forwarded link can't
 * put a stranger in the lesson.
 */
export function GuestJoin({ bookingId, code }: { bookingId: string; code: string }) {
  const storageKey = `class-guest:${bookingId}`;
  const [name, setName] = React.useState("");
  const [phase, setPhase] = React.useState<"form" | "waiting" | "denied" | "admitted" | "left">(() => {
    try {
      return typeof window !== "undefined" && window.sessionStorage.getItem(storageKey) ? "waiting" : "form";
    } catch {
      return "form";
    }
  });
  const [ticket, setTicket] = React.useState<JoinTicket | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError("Please enter your name.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/classroom/knock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: bookingId, code, name: n }) });
      const data = (await res.json().catch(() => ({}))) as { claim?: string; error?: string };
      if (!res.ok || !data.claim) throw new Error(data.error ?? "We couldn't ask to join. Please try again.");
      try {
        window.sessionStorage.setItem(storageKey, data.claim);
      } catch {
        // private mode: the wait still works while this page stays open
      }
      setPhase("waiting");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Poll until the host admits (or turns us away).
  React.useEffect(() => {
    if (phase !== "waiting") return;
    let claim: string | null = null;
    try {
      claim = window.sessionStorage.getItem(storageKey);
    } catch {
      claim = null;
    }
    if (!claim) return;
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/classroom/guest?claim=${encodeURIComponent(claim!)}`);
        const data = (await res.json().catch(() => ({}))) as { status?: string; ticket?: JoinTicket };
        if (!alive) return;
        if (data.status === "approved" && data.ticket) {
          setTicket(data.ticket);
          setPhase("admitted");
        } else if (data.status === "denied") {
          setPhase("denied");
        } else if (data.status === "expired") {
          try {
            window.sessionStorage.removeItem(storageKey);
          } catch {
            // nothing to clear
          }
          setError("Your request expired. Please ask again.");
          setPhase("form");
        }
      } catch {
        // keep polling
      }
    };
    void poll();
    const t = window.setInterval(poll, 3000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [phase, storageKey]);

  if (phase === "admitted" && ticket) {
    return <LiveClassroom bookingId={bookingId} title="TutorLink lesson" ticket={ticket} onLeave={() => setPhase("left")} />;
  }

  return (
    <div className="mesh-gradient grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-md border border-line bg-surface p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-11 place-items-center bg-brand text-on-brand">
            <Video className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-heading text-[1.35rem] leading-tight text-ink">TutorLink lesson</p>
            <p className="text-[13px] text-muted">You&apos;ve been invited to join as a guest</p>
          </div>
        </div>

        {phase === "waiting" && (
          <div className="flex items-start gap-3 border border-warning/40 bg-warning-50 p-4" role="status">
            <Clock className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-ink">Waiting for the tutor to let you in</p>
              <p className="mt-1 text-xs text-muted">Keep this page open: you&apos;ll join automatically.</p>
            </div>
            <Loader2 className="ml-auto size-4 shrink-0 animate-spin text-warning" aria-hidden />
          </div>
        )}

        {phase === "denied" && (
          <div className="flex items-start gap-3 border border-danger/40 bg-danger/10 p-4" role="alert">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-ink">The tutor didn&apos;t let you in</p>
              <p className="mt-1 text-xs text-muted">If you think this is a mistake, ask the tutor or the family that invited you.</p>
            </div>
          </div>
        )}

        {phase === "left" && (
          <div className="text-sm text-muted" role="status">
            You left the lesson.{" "}
            <button type="button" className="font-semibold text-ink underline underline-offset-4" onClick={() => setPhase("waiting")}>
              Rejoin
            </button>
          </div>
        )}

        {phase === "form" && (
          <form onSubmit={ask} noValidate>
            <label htmlFor="guest-name" className="mb-1.5 block text-sm font-medium text-ink">
              Your name
            </label>
            <div className="relative mb-4">
              <UserIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                id="guest-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Riya Shah"
                maxLength={60}
                autoComplete="name"
                className="h-11 w-full border border-line-strong bg-canvas pl-9 pr-3 text-sm text-ink focus:border-brand focus:outline-none"
              />
            </div>
            {error && (
              <p className="mb-3 text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              Ask to join
            </Button>
            <p className="mt-4 text-center text-[13px] text-muted">
              The tutor will let you in. Have an account?{" "}
              <Link href={`/login?next=${encodeURIComponent(`/classroom/${bookingId}`)}`} className="inline-flex items-center gap-1 font-semibold text-ink underline underline-offset-4">
                <LogIn className="size-3.5" aria-hidden /> Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
