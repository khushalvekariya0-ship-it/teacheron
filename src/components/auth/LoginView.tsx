"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, ChevronDown, Copy, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Controls";
import { InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { DEMO_ACCOUNTS, useDemoLogin } from "@/components/layout/DemoSwitcher";
import { DEMO_PASSWORD, useApp } from "@/lib/store";
import { useHydrated, useSession } from "@/lib/store/hooks";
import { ROLE_LABEL } from "@/lib/data/users";
import { cn } from "@/lib/utils";
import { destinationFor, safeNext } from "./authUtils";
import { PasswordInput } from "./PasswordField";
import { AppleIcon, FacebookIcon, GoogleIcon } from "./SocialIcons";
import { setRememberMe } from "@/lib/remember";

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
  const [remember, setRemember] = React.useState(true);

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
    setRememberMe(remember);
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
  const signupHref = (role: "student" | "tutor") => `/register?role=${role}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  const notConnected = (provider: string) =>
    toast(`${provider} sign-in isn't connected yet`, { description: "It will work once the login server is set up. Use your email and password for now." });

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <h1 className="font-heading text-[2.25rem] font-bold leading-[1.05] tracking-[-0.03em] text-ink">Log in</h1>
        <p className="mt-3 text-[15px] text-ink-2">
          <Link href={signupHref("student")} className="font-medium text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
            Sign up as a student
          </Link>{" "}
          or{" "}
          <Link href={signupHref("tutor")} className="font-medium text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
            Sign up as a tutor
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

      {/* Social sign-in */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE, delay: 0.05 }} className="mt-7 space-y-3">
        {[
          { name: "Google", icon: <GoogleIcon className="size-5" /> },
          { name: "Facebook", icon: <FacebookIcon className="size-5" /> },
          { name: "Apple", icon: <AppleIcon className="size-5 text-ink" /> },
        ].map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => notConnected(p.name)}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border-2 border-line-strong bg-surface text-[15.5px] font-semibold text-ink transition-colors hover:border-ink active:translate-y-px"
          >
            {p.icon}
            Continue with {p.name}
          </button>
        ))}
        <p className="pt-1 text-center">
          <button type="button" onClick={() => notConnected("Corporate (SSO)")} className="text-[14px] font-medium text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
            Continue with corporate login (SSO)
          </button>
        </p>
      </motion.div>

      <div className="my-6 flex items-center gap-4" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        <span className="text-[14px] text-muted">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
        onSubmit={onSubmit}
        noValidate
        className="space-y-5"
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
          <Input type="email" autoComplete="email" inputMode="email" placeholder="Your email" {...form.register("email")} />
        </Field>

        <Field label="Password" error={errors.password?.message}>
          <PasswordInput autoComplete="current-password" placeholder="Your password" {...form.register("password")} />
        </Field>

        <div className="space-y-4">
          <Link href="/forgot-password" className="inline-block rounded text-[14px] font-medium text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
            Forgot your password?
          </Link>
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} label="Remember me" />
        </div>

        <Button type="submit" variant="brand" size="lg" className="w-full" loading={busy} disabled={!hydrated}>
          {redirecting ? "Logging you in…" : "Log in"}
        </Button>
      </motion.form>

      <p className="mt-5 text-center text-[13px] leading-relaxed text-muted">
        By clicking Log in or Continue with, you agree to TutorLink{" "}
        <Link href="/terms" className="font-medium text-ink underline underline-offset-2 hover:decoration-2">
          Terms of Use
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-medium text-ink underline underline-offset-2 hover:decoration-2">
          Privacy Policy
        </Link>
      </p>

      {/* Preview build only: demo accounts, tucked away below the real form */}
      {DEMO_ACCOUNTS.length > 0 && (
        <details className="group mt-8 rounded-xl border border-line bg-canvas">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[13.5px] font-semibold text-ink-2 [&::-webkit-details-marker]:hidden">
            Preview: sign in with a demo account
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="border-t border-line px-4 pb-4 pt-3">
            <ul className="grid gap-2 sm:grid-cols-2">
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
                        setRememberMe(true);
                        demoLogin(a.id, destinationFor(a.role, next));
                        // demoLogin reports failures with a toast; re-enable the cards if no session was created.
                        if (useApp.getState().sessionUserId !== a.id) {
                          setPendingDemo(null);
                          setRedirecting(false);
                        }
                      }}
                      className="group/demo flex min-h-12 w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-canvas text-ink">
                        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <a.icon className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-ink">{a.label}</span>
                        <span className="block text-[11.5px] leading-snug text-muted">{a.description}</span>
                      </span>
                      <span className="sr-only">Sign in as the demo {a.label.toLowerCase()}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-muted">
              <p>
                Demo password <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[12px] text-ink ring-1 ring-line">{DEMO_PASSWORD}</code>
              </p>
              <button type="button" onClick={copyPassword} className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-semibold text-ink hover:bg-sunken" aria-live="polite">
                {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
