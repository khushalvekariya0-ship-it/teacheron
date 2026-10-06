"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Mail, MailCheck } from "lucide-react";
import { AnimatePresence, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useApp } from "@/lib/store";
import { PreviewInbox } from "./PreviewInbox";

const EASE = [0.22, 1, 0.36, 1] as const;

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email address").email("Enter a valid email address"),
});

/**
 * Always shows the same confirmation, whether or not an account exists, so the form can't be used
 * to discover who has an account. Latency is simulated to match a real request.
 */
export function ForgotPasswordView() {
  const [sentTo, setSentTo] = React.useState<{ email: string; token: string } | null>(null);
  const requestPasswordReset = useApp((s) => s.requestPasswordReset);
  const form = useForm({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: { email: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ email }) => {
    await new Promise((r) => setTimeout(r, 900 + Math.round(Math.random() * 400)));
    const res = requestPasswordReset(email);
    setSentTo({ email: email.trim(), token: res.ok ? res.data.token : "" });
  });

  return (
    <AnimatePresence mode="wait" initial={false}>
      {sentTo ? (
        <motion.div key="sent" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.4, ease: EASE }} role="status">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.4, duration: 0.6, delay: 0.1 }}
            className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand"
          >
            <MailCheck className="size-5" aria-hidden />
          </motion.span>
          <h1 className="mt-6 font-heading text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] text-ink">Check your email</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            If an account exists for <span className="font-medium text-ink">{sentTo.email}</span>, you&apos;ll get an email with a link to reset your password. It can take a few minutes — check your spam folder too.
          </p>
          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
            <Button asChild size="lg" className="flex-1">
              <Link href="/login">Back to sign in</Link>
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                form.reset({ email: "" });
                setSentTo(null);
              }}
            >
              Use a different email
            </Button>
          </div>
          <PreviewInbox className="mt-6" to={sentTo.email} subject="Reset your TutorLink password" href={`/reset-password?token=${encodeURIComponent(sentTo.token)}`} cta="Open the reset link" />
        </motion.div>
      ) : (
        <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.4, ease: EASE }}>
          <Link href="/login" className="group mb-6 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-muted hover:text-ink">
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden /> Back to sign in
          </Link>
          <h1 className="font-heading text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] text-ink">Reset your password</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">Enter the email you signed up with and we&apos;ll send you a link to choose a new password.</p>
          <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
            <Field label="Email" error={errors.email?.message}>
              <Input type="email" autoComplete="email" inputMode="email" icon={<Mail />} placeholder="you@example.com" autoFocus {...form.register("email")} />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
