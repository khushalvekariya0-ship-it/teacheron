"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, KeyRound, LinkIcon } from "lucide-react";
import { useApp } from "@/lib/store";
import { motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { PasswordInput } from "./PasswordField";

const EASE = [0.22, 1, 0.36, 1] as const;

const schema = z
  .object({
    password: z.string().min(10, "Use at least 10 characters").max(200, "Use at most 200 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match" });

type LinkStatus = "checking" | "valid" | "expired" | "used" | "replaced" | "invalid";

const BAD_LINK: Record<Exclude<LinkStatus, "checking" | "valid">, { title: string; body: string }> = {
  expired: { title: "This reset link has expired", body: "Reset links work for 15 minutes. Request a new one and use it straight away." },
  used: { title: "This reset link was already used", body: "Each link works once. If you still need to change your password, request a new one." },
  replaced: { title: "This link is from an older email", body: "A newer reset email was sent, and only the newest one works. Open the newest email, or request a new one." },
  invalid: { title: "This reset link isn't valid", body: "It may be incomplete or replaced by a newer link. Request a new one and use the latest email." },
};

/**
 * Set a new password from the emailed link (/reset-password?token=…). The link is checked first, then
 * the token is taken out of the address bar so it isn't left in the browser history. Afterwards the
 * person signs in with the new password.
 */
export function ResetPasswordView() {
  const router = useRouter();
  const params = useSearchParams();
  const [token] = React.useState(() => params.get("token") ?? "");
  const checkResetLink = useApp((s) => s.checkResetLink);
  const resetPassword = useApp((s) => s.resetPassword);
  const [status, setStatus] = React.useState<LinkStatus>(token ? "checking" : "invalid");
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const form = useForm({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: { password: "", confirm: "" } });
  const { errors, isSubmitting } = form.formState;

  React.useEffect(() => {
    if (!token) return;
    window.history.replaceState(null, "", "/reset-password");
    let alive = true;
    void checkResetLink(token).then((r) => {
      if (alive) setStatus(r.ok ? r.data.status : "invalid");
    });
    return () => {
      alive = false;
    };
  }, [token, checkResetLink]);

  if (status === "checking") {
    return (
      <div className="space-y-4" role="status" aria-label="Checking your reset link">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (status !== "valid" && !done) {
    const copy = BAD_LINK[status];
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
        <span className="grid size-12 place-items-center bg-brand-soft text-brand">
          <LinkIcon className="size-5" aria-hidden />
        </span>
        <h1 className="mt-6 font-heading text-[2rem] leading-[1.05] text-ink">{copy.title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{copy.body}</p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/forgot-password">
            Request a new reset email <ArrowRight />
          </Link>
        </Button>
      </motion.div>
    );
  }

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null);
    const res = await resetPassword(token, password);
    if (!res.ok) {
      // The link stopped working in the meantime (expired or used in another tab).
      if ("code" in res && (res.code === "expired" || res.code === "used" || res.code === "replaced" || res.code === "invalid")) return setStatus(res.code);
      setError(res.error);
      return;
    }
    setDone(true);
    toast.success("Password changed", { description: "Sign in with your new password." });
    router.push("/login?reset=done");
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
      <span className="grid size-12 place-items-center bg-brand-soft text-brand">
        <KeyRound className="size-5" aria-hidden />
      </span>
      <h1 className="mt-6 font-heading text-[2rem] leading-[1.05] text-ink">Choose a new password</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">At least 10 characters. You&rsquo;ll sign in with it next, and other devices are signed out.</p>
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
          {isSubmitting ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </motion.div>
  );
}
