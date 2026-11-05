"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, KeyRound, Link2 } from "lucide-react";
import { motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { useApp } from "@/lib/store";
import { destinationFor } from "./authUtils";

const EASE = [0.22, 1, 0.36, 1] as const;
const NAMES: Record<string, string> = { google: "Google", facebook: "Facebook", apple: "Apple", azure: "Microsoft" };

const schema = z.object({
  code: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "Enter the 6 digits from the email")),
});

/**
 * A Google / Facebook / Apple sign-in landed on an account that already exists (same email). It only works
 * once the account's owner enters the code emailed to that account; "This wasn't me" removes it again.
 */
export function LinkStep({ next }: { next: string | null }) {
  const router = useRouter();
  const link = useApp((s) => s.linkRequired);
  const confirm = useApp((s) => s.confirmLink);
  const resend = useApp((s) => s.resendLinkCode);
  const cancel = useApp((s) => s.cancelLink);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"resend" | "cancel" | null>(null);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { code: "" } });
  const { errors, isSubmitting } = form.formState;
  if (!link) return null;
  const name = NAMES[link.provider] ?? "This sign-in";

  const onSubmit = form.handleSubmit(async ({ code }) => {
    setError(null);
    const r = await confirm(code);
    if (!r.ok) return setError(r.error);
    toast.success(`${name} is connected`, { description: "Next time, it signs you straight in." });
    if (r.data.mfaRequired) return; // the authenticator step takes over
    if (r.data.needsRole) return router.push("/welcome");
    router.push(r.data.role ? destinationFor(r.data.role, next) : "/dashboard");
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
      <span className="grid size-12 place-items-center bg-brand-soft text-brand">
        <Link2 className="size-5" aria-hidden />
      </span>
      <h1 className="mt-6 font-heading text-[2rem] leading-[1.05] text-ink">Confirm it&apos;s you</h1>
      <p role="status" className="mt-2 text-[15px] leading-relaxed text-muted">
        You signed in with {name}, and <span className="font-medium text-ink">{link.email}</span> already has a TutorLink account. To connect {name} to it, enter the 6-digit code we just emailed to that address.
      </p>
      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {error && <InlineAlert tone="danger" title={error} />}
        <Field label="Code from the email" hint="It works for 15 minutes." error={errors.code?.message}>
          <Input inputMode="numeric" autoComplete="one-time-code" maxLength={9} icon={<KeyRound />} placeholder="6 digits" autoFocus className="font-mono tracking-[0.3em]" {...form.register("code")} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          {isSubmitting ? "Checking…" : (
            <>
              Connect {name} <ArrowRight />
            </>
          )}
        </Button>
      </form>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          variant="secondary"
          size="lg"
          className="flex-1"
          loading={busy === "resend"}
          onClick={async () => {
            setBusy("resend");
            const r = await resend();
            setBusy(null);
            if (r.ok) toast.success("We sent a new code", { description: "Only the newest code works." });
            else toast.error(r.error);
          }}
        >
          Send a new code
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className="flex-1"
          loading={busy === "cancel"}
          onClick={async () => {
            setBusy("cancel");
            const r = await cancel();
            setBusy(null);
            if (!r.ok) return void toast.error(r.error);
            toast.success(`${name} wasn't connected`, { description: "You're signed out. Your account is unchanged." });
            router.replace("/login");
          }}
        >
          This wasn&apos;t me
        </Button>
      </div>
    </motion.div>
  );
}
