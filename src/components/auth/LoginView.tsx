"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MailCheck } from "lucide-react";
import { AnimatePresence, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Controls";
import { InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { useApp } from "@/lib/store";
import { useHydrated, useSession } from "@/lib/store/hooks";
import { ROLE_LABEL } from "@/lib/data/users";
import { destinationFor, safeNext } from "./authUtils";
import { PasswordInput } from "./PasswordField";
import { EmailCodeForm } from "./EmailCodeForm";
import { LinkStep } from "./LinkStep";
import { SocialSignIn, useEnabledProviders } from "./ProviderSignIn";
import { setRememberMe } from "@/lib/remember";

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email address").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

const EASE = [0.22, 1, 0.36, 1] as const;

/** Messages for ?error= when a link from an email or a provider sign-in didn't work. */
const LINK_ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was already used. Sign in below, or request a new link.",
  reset: "That password reset link has expired or was already used. Request a new one from “Forgot your password?”.",
  provider: "That sign-in option didn't work just now. Try again, or use your email and password instead.",
  cancelled: "Sign-in was cancelled. Choose a way to continue below.",
  expired: "That sign-in took too long or was opened in a different browser. Please try again.",
  no_email: "Your account with that provider has no email address, so it can't be used here. Add an email there, or sign up with your email below.",
  account_exists: "This email already has a TutorLink account. Sign in with your email and password below.",
  busy: "Too many sign-in attempts. Please wait a few minutes and try again.",
  suspended: "This account is suspended. Contact support for help.",
};

export function LoginView() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const router = useRouter();
  const hydrated = useHydrated();
  const me = useSession();
  const signIn = useApp((s) => s.signIn);
  const resend = useApp((s) => s.resendConfirmation);
  const logout = useApp((s) => s.logout);
  const providers = useEnabledProviders();
  const linkError = LINK_ERRORS[params.get("error") ?? ""] ?? null;
  const [error, setError] = React.useState<{ title: string; detail: string; unconfirmed?: string } | null>(null);
  const [redirecting, setRedirecting] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const mfaRequired = useApp((s) => s.mfaRequired);
  const linkRequired = useApp((s) => s.linkRequired);
  const siteEmail = useApp((s) => s.config.email);
  /** The email of an account that still has to enter its sign-up code. */
  const [confirming, setConfirming] = React.useState<string | null>(null);

  const form = useForm({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const res = await signIn(values.email, values.password);
    if (!res.ok) {
      if (res.code === "email_not_confirmed") {
        // The site's own email sends a 6-digit code: enter it here, then this sign-in carries on.
        if (siteEmail) return setConfirming(values.email.trim().toLowerCase());
        setError({ title: "Confirm your email first", detail: "Open the link we emailed you when you signed up.", unconfirmed: values.email });
        return;
      }
      setError({ title: res.error, detail: /incorrect/i.test(res.error) ? "Check for typos, or reset your password if you've forgotten it." : "" });
      form.resetField("password");
      form.setFocus("password");
      return;
    }
    setRememberMe(remember);
    if (res.data.mfaRequired || useApp.getState().linkRequired) return; // a code step takes over
    setRedirecting(true);
    toast.success(`Welcome back, ${res.data.firstName}`);
    router.push(destinationFor(res.data.role, next));
  });

  const resendLink = async (email: string) => {
    const r = await resend(email);
    if (r.ok) toast.success("We sent the link again", { description: "Check your spam folder if it doesn't arrive in a few minutes." });
    else toast.error(r.error);
  };

  const busy = isSubmitting || redirecting;
  const signupHref = (role: "student" | "tutor") => `/register?role=${role}${next ? `&next=${encodeURIComponent(next)}` : ""}`;

  if (linkRequired) return <LinkStep next={next} />;
  if (mfaRequired) return <MfaStep next={next} />;

  if (confirming) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
        <span className="grid size-12 place-items-center bg-brand-soft text-brand">
          <MailCheck className="size-5" aria-hidden />
        </span>
        <h1 className="mt-6 font-heading text-[2rem] leading-[1.05] text-ink">Confirm your email first</h1>
        <p role="status" className="mt-2 text-[15px] leading-relaxed text-muted">
          Enter the 6-digit code we emailed to <span className="font-medium text-ink">{confirming}</span> when you signed up. Codes work for 15 minutes; if yours has expired, send a new one.
        </p>
        <div className="mt-8">
          <EmailCodeForm
            email={confirming}
            submitLabel="Confirm and log in"
            onVerified={async () => {
              // Confirmed: finish this sign-in with the password already typed (two-step login still applies).
              const r = await signIn(confirming, form.getValues("password"));
              setConfirming(null);
              if (!r.ok) {
                setError({ title: r.error, detail: "" });
                return;
              }
              setRememberMe(remember);
              if (r.data.mfaRequired) return;
              setRedirecting(true);
              toast.success(`Email confirmed. Welcome, ${r.data.firstName}`);
              router.push(destinationFor(r.data.role, next));
            }}
          />
        </div>
        <p className="mt-5 text-center text-[14px] text-muted">
          <button type="button" onClick={() => setConfirming(null)} className="font-medium text-ink underline underline-offset-4">
            Back to log in
          </button>
        </p>
      </motion.div>
    );
  }

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
              <button type="button" onClick={() => void logout()} className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
                Sign out
              </button>{" "}
              to use a different account.
            </InlineAlert>
          </motion.div>
        )}
      </AnimatePresence>

      {linkError && !error && (
        <InlineAlert className="mt-6" tone="warning" title={linkError} />
      )}
      {params.get("reset") === "done" && !error && (
        <InlineAlert className="mt-6" tone="success" title="Your password was changed. Sign in with your new password." />
      )}
      {params.get("verified") === "1" && !error && (
        <InlineAlert className="mt-6" tone="success" title="Your email is confirmed. Sign in to continue." />
      )}

      <SocialSignIn
        next={next}
        providers={providers ?? []}
        divider={
          <div className="my-6 flex items-center gap-4" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            <span className="text-[14px] text-muted">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        }
      />
      {providers !== null && providers.length === 0 && <div className="mt-7" />}

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
              <InlineAlert
                tone="danger"
                title={error.title}
                action={
                  error.unconfirmed ? (
                    <Button size="sm" variant="secondary" onClick={() => void resendLink(error.unconfirmed!)}>
                      Send it again
                    </Button>
                  ) : undefined
                }
              >
                <span id="login-error">{error.detail}</span>
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

    </div>
  );
}

/** Second step for accounts with two-step login: the 6-digit code from their authenticator app. */
function MfaStep({ next }: { next: string | null }) {
  const router = useRouter();
  const verify = useApp((s) => s.verifyMfa);
  const logout = useApp((s) => s.logout);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from your authenticator app.");
    setBusy(true);
    const r = await verify(code);
    if (!r.ok) {
      setBusy(false);
      setCode("");
      return setError(r.error);
    }
    toast.success(`Welcome back, ${r.data.firstName}`);
    router.push(destinationFor(r.data.role, next));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
      <h1 className="font-heading text-[2.25rem] font-bold leading-[1.05] tracking-[-0.03em] text-ink">Enter your code</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">Open your authenticator app (for example Google Authenticator) and enter the 6-digit code for TutorLink.</p>
      <form onSubmit={submit} noValidate className="mt-8 space-y-5">
        <Field label="6-digit code" error={error ?? undefined}>
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError(null);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="123456"
            className="text-center font-mono text-lg tracking-[0.4em]"
          />
        </Field>
        <Button type="submit" variant="brand" size="lg" className="w-full" loading={busy}>
          Verify and continue
        </Button>
      </form>
      <p className="mt-5 text-center text-[14px] text-muted">
        Lost your phone? Ask another administrator to reset your two-step login.{" "}
        <button type="button" onClick={() => void logout()} className="font-medium text-ink underline underline-offset-4">
          Use a different account
        </button>
      </p>
    </motion.div>
  );
}
