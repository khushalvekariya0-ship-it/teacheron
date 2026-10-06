"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, LinkIcon, MailCheck } from "lucide-react";
import { useApp } from "@/lib/store";
import { useHydrated, useSession } from "@/lib/store/hooks";
import { homeFor } from "@/lib/permissions";
import { motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Confirms an email address from its link (`?user=&token=`). */
export function VerifyEmailView() {
  const params = useSearchParams();
  const userId = params.get("user") ?? "";
  const token = params.get("token") ?? "";
  const hydrated = useHydrated();
  const me = useSession();
  const verifyEmail = useApp((s) => s.verifyEmail);
  const users = useApp((s) => s.users);
  const target = users.find((u) => u.id === userId);
  const [result, setResult] = React.useState<{ ok: true } | { ok: false; error: string } | null>(null);

  if (!hydrated) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const verified = target?.emailVerified ?? false;
  const confirm = () => {
    const r = verifyEmail(userId, token);
    setResult(r.ok ? { ok: true } : { ok: false, error: r.error });
  };
  const home = me ? homeFor(me.role) : "/login";

  if (verified || result?.ok) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} role="status">
        <span className="grid size-12 place-items-center bg-success-50 text-success">
          <MailCheck className="size-5" aria-hidden />
        </span>
        <h1 className="mt-6 font-heading text-[2rem] leading-[1.05] text-ink">Email verified</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Thanks{target ? `, ${target.firstName}` : ""} — <span className="font-medium text-ink">{target?.email}</span> is confirmed.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href={home}>
            {me ? "Go to your dashboard" : "Sign in"} <ArrowRight />
          </Link>
        </Button>
      </motion.div>
    );
  }

  if (!target || (result && !result.ok)) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
        <span className="grid size-12 place-items-center bg-brand-soft text-brand">
          <LinkIcon className="size-5" aria-hidden />
        </span>
        <h1 className="mt-6 font-heading text-[2rem] leading-[1.05] text-ink">This link isn&rsquo;t valid</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{result && !result.ok ? result.error : "Verification links work once. You can request a new one from Settings."}</p>
        <Button asChild size="lg" className="mt-8">
          <Link href={me ? "/dashboard/settings" : "/login"}>
            {me ? "Open Settings" : "Sign in"} <ArrowRight />
          </Link>
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
      <span className="grid size-12 place-items-center bg-brand-soft text-brand">
        <MailCheck className="size-5" aria-hidden />
      </span>
      <h1 className="mt-6 font-heading text-[2rem] leading-[1.05] text-ink">Confirm your email</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Confirm that <span className="font-medium text-ink">{target.email}</span> belongs to you, {target.firstName}.
      </p>
      <Button size="lg" className="mt-8 w-full" onClick={confirm}>
        Yes, this is my email <ArrowRight />
      </Button>
    </motion.div>
  );
}
