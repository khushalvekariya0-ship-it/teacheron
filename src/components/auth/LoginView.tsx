"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Check, Copy, Loader2, Mail } from "lucide-react";
import { AnimatePresence, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { DEMO_ACCOUNTS, useDemoLogin } from "@/components/layout/DemoSwitcher";
import { DEMO_PASSWORD, useApp } from "@/lib/store";
import { useHydrated, useSession } from "@/lib/store/hooks";
import { ROLE_LABEL } from "@/lib/data/users";
import { cn } from "@/lib/utils";
import { destinationFor, safeNext } from "./authUtils";
import { PasswordInput } from "./PasswordField";

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email address").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

const EASE = [0.22, 1, 0.36, 1] as const;

export function LoginView() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const router = useRouter();
  const hydrated = useHydrated();
  const me = useSession();
  const loginWithPassword = useApp((s) => s.loginWithPassword);
  const logout = useApp((s) => s.logout);
  const demoLogin = useDemoLogin();
  const [error, setError] = React.useState<string | null>(null);
  const [redirecting, setRedirecting] = React.useState(false);
  const [pendingDemo, setPendingDemo] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const form = useForm({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const res = await loginWithPassword(values.email, values.password);
    if (!res.ok) {
      setError("Email or password is incorrect.");
      form.resetField("password");
      form.setFocus("password");
      return;
    }
    setRedirecting(true);
    toast.success(`Welcome back, ${res.data.firstName}`);
    router.push(destinationFor(res.data.role, next));
  });

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(DEMO_PASSWORD);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy — select the password and copy it manually.");
    }
  };

  const busy = isSubmitting || redirecting;
  const registerHref = `/register${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <h1 className="font-heading text-[2rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-ink">Sign in to TutorLink</h1>
        <p className="mt-2 text-[15px] text-muted">
          New here?{" "}
          <Link href={registerHref} className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
            Create a free account
          </Link>
        </p>
      </motion.div>

      <AnimatePresence initial={false}>
        {hydrated && me && !redirecting && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
            <InlineAlert
              className="mt-6"
              title={`You're signed in as ${me.firstName} ${me.lastName}`}
              action={
                <Button asChild size="sm">
                  <Link href={destinationFor(me.role, next)}>Continue</Link>
                </Button>
              }
            >
              {ROLE_LABEL[me.role]} account.{" "}
              <button type="button" onClick={logout} className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
                Sign out
              </button>{" "}
              to use a different account.
            </InlineAlert>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.06 }}
        onSubmit={onSubmit}
        noValidate
        className="mt-8 space-y-5"
        aria-describedby={error ? "login-error" : undefined}
      >
        <AnimatePresence initial={false}>
          {error && (
            <motion.div key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <InlineAlert tone="danger" title={error}>
                <span id="login-error">Check for typos, or reset your password if you&apos;ve forgotten it.</span>
              </InlineAlert>
            </motion.div>
          )}
        </AnimatePresence>

        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" icon={<Mail />} placeholder="you@example.com" {...form.register("email")} />
        </Field>

        <div className="space-y-1.5">
          <Field label="Password" error={errors.password?.message}>
            <PasswordInput autoComplete="current-password" placeholder="Your password" {...form.register("password")} />
          </Field>
          <div className="flex justify-end">
            <Link href="/forgot-password" className="rounded text-[13px] font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!hydrated}>
          {redirecting ? "Signing you in…" : "Sign in"}
        </Button>
      </motion.form>

      {/* Demo accounts */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.14 }}
        aria-labelledby="demo-heading"
        className="mt-10"
      >
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-line" aria-hidden />
          <h2 id="demo-heading" className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">
            Or explore a demo account
          </h2>
          <span className="h-px flex-1 bg-line" aria-hidden />
        </div>

        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((a) => {
            const pending = pendingDemo === a.id;
            return (
              <li key={a.id} className={cn(a.id === DEMO_ACCOUNTS[DEMO_ACCOUNTS.length - 1].id && DEMO_ACCOUNTS.length % 2 === 1 && "sm:col-span-2")}>
                <button
                  type="button"
                  disabled={!hydrated || !!pendingDemo}
                  onClick={() => {
                    setPendingDemo(a.id);
                    setRedirecting(true);
                    demoLogin(a.id, destinationFor(a.role, next));
                    // demoLogin reports failures with a toast; re-enable the cards if no session was created.
                    if (useApp.getState().sessionUserId !== a.id) {
                      setPendingDemo(null);
                      setRedirecting(false);
                    }
                  }}
                  className="group flex min-h-14 w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-canvas text-ink transition-colors group-hover:bg-brand-soft">
                    {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <a.icon className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold text-ink">{a.label}</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-muted">{a.description}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 -translate-x-1 text-ink opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
                  <span className="sr-only">Sign in as the demo {a.label.toLowerCase()}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-canvas px-3.5 py-2.5 text-[13px] text-muted">
          <p>
            Demo password <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[12.5px] text-ink ring-1 ring-line">{DEMO_PASSWORD}</code>
          </p>
          <button type="button" onClick={copyPassword} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-semibold text-ink hover:bg-sunken" aria-live="polite">
            {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </motion.section>
    </div>
  );
}
