"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { useApp } from "@/lib/store";

const schema = z.object({
  code: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "Enter the 6 digits from the email")),
});

/**
 * The 6-digit code from the sign-up email ("Confirm your email for TutorLink"). The server checks it and
 * only then marks the email as confirmed; `onVerified` then carries on (usually signing in).
 */
export function EmailCodeForm({ email, onVerified, submitLabel = "Confirm email" }: { email: string; onVerified: () => Promise<void> | void; submitLabel?: string }) {
  const verifyEmail = useApp((s) => s.verifyEmail);
  const resend = useApp((s) => s.resendConfirmation);
  const [error, setError] = React.useState<string | null>(null);
  const [resending, setResending] = React.useState(false);
  const form = useForm({ resolver: zodResolver(schema), mode: "onSubmit", defaultValues: { code: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ code }) => {
    setError(null);
    const res = await verifyEmail(email, code);
    if (!res.ok) return setError(res.error);
    await onVerified();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error && <InlineAlert tone="danger" title={error} />}
      <Field label="Code from the email" hint="Use the code in the newest email. It works for 15 minutes." error={errors.code?.message}>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={9}
          icon={<KeyRound />}
          placeholder="6 digits"
          autoFocus
          className="font-mono tracking-[0.3em]"
          {...form.register("code")}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
        {isSubmitting ? (
          "Checking…"
        ) : (
          <>
            {submitLabel} <ArrowRight />
          </>
        )}
      </Button>
      <Button
        type="button"
        size="lg"
        variant="secondary"
        className="w-full"
        loading={resending}
        onClick={async () => {
          setResending(true);
          const r = await resend(email);
          setResending(false);
          if (r.ok) toast.success("We sent a new code", { description: "Only the newest code works. Check your spam folder if it doesn't arrive in a minute or two." });
          else toast.error(r.error);
        }}
      >
        Send a new code
      </Button>
    </form>
  );
}
