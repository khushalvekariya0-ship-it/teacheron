"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Mail, MailCheck } from "lucide-react";
import { useApp } from "@/lib/store";
import { useHydrated, useSession } from "@/lib/store/hooks";
import { homeFor } from "@/lib/permissions";
import { motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Email confirmation. The link in the sign-up email goes through /auth/callback, which confirms the
 * address with Supabase Auth and signs the person in; this page confirms the outcome, or lets them
 * ask for a new link.
 */
export function VerifyEmailView() {
  const hydrated = useHydrated();
  const me = useSession();
  const resend = useApp((s) => s.resendConfirmation);
  const [email, setEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);

  if (!hydrated) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (me?.emailVerified) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} role="status">
        <span className="grid size-12 place-items-center bg-success-50 text-success">
          <MailCheck className="size-5" aria-hidden />
        </span>
        <h1 className="mt-6 font-heading text-[2rem] leading-[1.05] text-ink">Email verified</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Thanks, {me.firstName} — <span className="font-medium text-ink">{me.email}</span> is confirmed.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href={homeFor(me.role)}>
            Go to your dashboard <ArrowRight />
          </Link>
        </Button>
      </motion.div>
    );
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast.error("Enter a valid email address.");
    setSending(true);
    const r = await resend(email.trim());
    setSending(false);
    if (r.ok) toast.success("If that email has an account waiting for confirmation, we sent a new link.");
    else toast.error(r.error);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
      <span className="grid size-12 place-items-center bg-brand-soft text-brand">
        <MailCheck className="size-5" aria-hidden />
      </span>
      <h1 className="mt-6 font-heading text-[2rem] leading-[1.05] text-ink">Confirm your email</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Open the link we emailed you when you signed up. Links work once — if yours expired, we can send a new one.
      </p>
      <form onSubmit={send} noValidate className="mt-8 space-y-4">
        <Field label="Email">
          <Input type="email" autoComplete="email" inputMode="email" icon={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={sending}>
          Send a new link
        </Button>
      </form>
      <p className="mt-5 text-center text-[14px] text-muted">
        Already confirmed?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}
