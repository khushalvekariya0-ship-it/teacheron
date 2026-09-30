"use client";

import * as React from "react";
import Link from "next/link";
import { Hourglass, Lock, ShieldAlert } from "lucide-react";
import type { BookingType, Tutor, User } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/data/users";
import { homeFor } from "@/lib/permissions";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

function GateShell({ icon, title, children, actions }: { icon: React.ReactNode; title: string; children: React.ReactNode; actions: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-2 py-8 text-center sm:py-10">
      <div className="relative mb-5">
        <div className="absolute inset-0 -m-4 rounded-full bg-dot-grid opacity-60 mask-radial" aria-hidden />
        <div className="relative grid size-12 place-items-center rounded-xl border border-line bg-surface text-navy shadow-xs [&_svg]:size-5">{icon}</div>
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-ink">{title}</h3>
      <div className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{children}</div>
      <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-center">{actions}</div>
    </div>
  );
}

export function FlowLoading() {
  return (
    <div className="space-y-5 py-2" role="status" aria-label="Loading booking">
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-20 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function SignInGate({ tutor, type }: { tutor: Pick<Tutor, "firstName" | "slug">; type: BookingType }) {
  const next = encodeURIComponent(`/tutors/${tutor.slug}?book=${type}`);
  return (
    <GateShell
      icon={<Lock />}
      title={`Sign in to book ${tutor.firstName}`}
      actions={
        <>
          <Button asChild size="lg">
            <Link href={`/login?next=${next}`}>Sign in</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={`/register?next=${next}`}>Create a free account</Link>
          </Button>
        </>
      }
    >
      Booking needs a student or parent account so we can send confirmations and keep payments secure. You&rsquo;ll come right back here after signing in.
    </GateShell>
  );
}

export function RoleGate({ me, onClose }: { me: User; onClose: () => void }) {
  return (
    <GateShell
      icon={<ShieldAlert />}
      title="Only students and parents can book lessons"
      actions={
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Close
          </Button>
          <Button asChild size="lg">
            <Link href={homeFor(me.role)}>Go to your dashboard</Link>
          </Button>
        </>
      }
    >
      You&rsquo;re signed in with a {ROLE_LABEL[me.role].toLowerCase()} account. To book, sign in with a student or parent account.
    </GateShell>
  );
}

export function ConsentGate({ me, onClose }: { me: User; onClose: () => void }) {
  return (
    <GateShell
      icon={<Hourglass />}
      title="Waiting for a parent or guardian"
      actions={
        <Button variant="secondary" size="lg" onClick={onClose}>
          Close
        </Button>
      }
    >
      Students under 18 need approval before booking. We&rsquo;ve asked {me.parentalConsent?.parentEmail ?? "your parent or guardian"} to approve your account. You can keep browsing tutors in the meantime.
    </GateShell>
  );
}
