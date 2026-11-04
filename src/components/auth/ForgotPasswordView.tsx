"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, KeyRound, Mail, MailCheck } from "lucide-react";
import { AnimatePresence, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { InlineAlert } from "@/components/ui/States";
import { useApp } from "@/lib/store";

const EASE = [0.22, 1, 0.36, 1] as const;

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email address").email("Enter a valid email address"),
});

const codeSchema = z.object({
  code: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "Enter the 6 digits from the email")),
});

/**
 * Always shows the same confirmation, whether or not an account exists, so the form can't be used
 * to discover who has an account. Every address gets an email: for an account, a 6-digit code and a
 * link, both single-use for 15 minutes; otherwise a note that there's no account. The code is typed here (handy when the link can't be opened, e.g. Gmail won't open links to a
 * site on localhost) and leads to /reset-password, the same page the link opens.
 */
export function ForgotPasswordView() {
  const router = useRouter();
  const [sentTo, setSentTo] = React.useState<{ email: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const requestPasswordReset = useApp((s) => s.requestPasswordReset);
  const verifyResetCode = useApp((s) => s.verifyResetCode);
  const form = useForm({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: { email: "" } });
  const codeForm = useForm({ resolver: zodResolver(codeSchema), mode: "onSubmit", defaultValues: { code: "" } });
  const { errors, isSubmitting } = form.formState;
  const codeState = codeForm.formState;

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setError(null);
    const res = await requestPasswordReset(email);
    if (!res.ok) return setError(res.error);
    setCodeError(null);
    codeForm.reset({ code: "" });
    setSentTo({ email: email.trim() });
  });

  const onCode = codeForm.handleSubmit(async ({ code }) => {
    if (!sentTo) return;
    setCodeError(null);
    const res = await verifyResetCode(sentTo.email, code);
    if (!res.ok) return setCodeError(res.error);
    router.push(`/reset-password?token=${encodeURIComponent(res.data.token)}`);
  });

  return (
    <AnimatePresence mode="wait" initial={false}>
      {sentTo ? (
        <motion.div key="sent" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.4, ease: EASE }}>
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.4, duration: 0.6, delay: 0.1 }}
            className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand"
          >
            <MailCheck className="size-5" aria-hidden />
          </motion.span>
          <h1 className="mt-6 font-heading text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] text-ink">Check your email</h1>
          <p role="status" className="mt-2 text-[15px] leading-relaxed text-muted">
            We&apos;re sending an email to <span className="font-medium text-ink">{sentTo.email}</span>. If it has a TutorLink account, the email has a 6-digit code and a link to reset your password (they work once, for 15 minutes). If it doesn&apos;t, the email says so. It can take a minute or two to arrive; check your spam folder too.
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            No email? For safety we send at most 3 reset emails an hour for each address. If you&apos;ve asked several times, wait a while and send it again.
          </p>
          <form onSubmit={onCode} noValidate className="mt-8 space-y-5">
            {codeError && <InlineAlert tone="danger" title={codeError} />}
            <Field label="Code from the email" hint="Use the code in the newest email." error={codeState.errors.code?.message}>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={9}
                icon={<KeyRound />}
                placeholder="6 digits"
                autoFocus
                className="font-mono tracking-[0.3em]"
                {...codeForm.register("code")}
              />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={codeState.isSubmitting}>
              {codeState.isSubmitting ? "Checking…" : (
                <>
                  Continue <ArrowRight />
                </>
              )}
            </Button>
          </form>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <Button asChild size="lg" variant="secondary" className="flex-1">
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
        </motion.div>
      ) : (
        <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.4, ease: EASE }}>
          <Link href="/login" className="group mb-6 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-muted hover:text-ink">
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden /> Back to sign in
          </Link>
          <h1 className="font-heading text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] text-ink">Reset your password</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">Enter the email you signed up with and we&apos;ll send you a code and a link to choose a new password.</p>
          <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
            {error && <InlineAlert tone="danger" title={error} />}
            <Field label="Email" error={errors.email?.message}>
              <Input type="email" autoComplete="email" inputMode="email" icon={<Mail />} placeholder="you@example.com" autoFocus {...form.register("email")} />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send reset email"}
            </Button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
