"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, KeyRound, LinkIcon } from "lucide-react";
import { useApp } from "@/lib/store";
import { useHydrated, useNow } from "@/lib/store/hooks";
import { homeFor } from "@/lib/permissions";
import { motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { PasswordInput } from "./PasswordField";

const EASE = [0.22, 1, 0.36, 1] as const;

const schema = z
  .object({
    password: z.string().min(10, "Use at least 10 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match" });

/** Set a new password from a reset link (`?token=`), then continue signed in. */
export function ResetPasswordView() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const router = useRouter();
  const hydrated = useHydrated();
  const now = useNow(60_000);
  const entry = useApp((s) => s.passwordResets[token]);
  const resetPassword = useApp((s) => s.resetPassword);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const form = useForm({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: { password: "", confirm: "" } });
  const { errors, isSubmitting } = form.formState;

  if (!hydrated) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const valid = !!entry && new Date(entry.expiresAt).getTime() > now;
  if (!valid && !done) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
        <span className="grid size-12 place-items-center bg-brand-soft text-brand">
          <LinkIcon className="size-5" aria-hidden />
        </span>
        <h1 className="mt-6 font-heading text-[2rem] leading-[1.05] text-ink">This reset link isn&rsquo;t valid</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">Reset links work once and expire after an hour. Request a new one and try again.</p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/forgot-password">
            Request a new link <ArrowRight />
          </Link>
        </Button>
      </motion.div>
    );
  }

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null);
    const res = await resetPassword(token, password);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDone(true);
    toast.success("Password changed", { description: `You're signed in as ${res.data.firstName}.` });
    router.push(homeFor(res.data.role));
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
      <span className="grid size-12 place-items-center bg-brand-soft text-brand">
        <KeyRound className="size-5" aria-hidden />
      </span>
      <h1 className="mt-6 font-heading text-[2rem] leading-[1.05] text-ink">Choose a new password</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">At least 10 characters. You&rsquo;ll be signed in straight after.</p>
      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        <Field label="New password" error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" autoFocus {...form.register("password")} />
        </Field>
        <Field label="Confirm new password" error={errors.confirm?.message}>
          <PasswordInput autoComplete="new-password" {...form.register("confirm")} />
        </Field>
        {error && (
          <p role="alert" className="text-[13.5px] text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting || done}>
          {isSubmitting ? "Saving…" : "Save password and sign in"}
        </Button>
      </form>
    </motion.div>
  );
}
