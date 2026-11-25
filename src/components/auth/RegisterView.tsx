"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Mail, MailCheck, ShieldCheck, UserRound } from "lucide-react";
import { AnimatePresence, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { Checkbox, RadioCards } from "@/components/ui/Controls";
import { InlineAlert } from "@/components/ui/States";
import { Avatar } from "@/components/ui/Avatar";
import { useApp, type SignUpOutcome } from "@/lib/store";
import { useHydrated, useSession } from "@/lib/store/hooks";
import { ROLE_LABEL } from "@/lib/data/users";
import { toast } from "@/components/ui/Toast";
import { destinationFor, safeNext } from "./authUtils";
import { PasswordInput } from "./PasswordField";
import { EmailCodeForm } from "./EmailCodeForm";
import { SocialSignIn, useEnabledProviders } from "./ProviderSignIn";
import { DEFAULT_COUNTRY, guessCountry } from "@/lib/location";
import { GRADES } from "@/lib/data/catalog";

const EASE = [0.22, 1, 0.36, 1] as const;

type RoleChoice = "student" | "parent" | "tutor";
type AgeBand = "18+" | "13-17" | "under13";

const emailSchema = z.string().trim().min(1, "Enter your email address").email("Enter a valid email address");

const schema = z
  .object({
    role: z.enum(["student", "parent", "tutor"]),
    firstName: z.string().trim().min(1, "Enter your first name").max(50, "Keep it under 50 characters"),
    lastName: z.string().trim().min(1, "Enter your last name").max(50, "Keep it under 50 characters"),
    email: emailSchema,
    password: z.string().min(10, "Use at least 10 characters").max(128, "Use 128 characters or fewer"),
    // Filled in from the visitor's browser (not asked); it can be changed later in Settings.
    country: z.string(),
    ageBand: z.enum(["18+", "13-17", "under13"]).optional(),
    parentEmail: z.string().trim().optional(),
    grade: z.string().optional(),
    experienceYears: z.number().or(z.nan()).optional(),
    terms: z.boolean().refine((v) => v, "Please accept the Terms of Service and Privacy Policy"),
  })
  .superRefine((v, ctx) => {
    if (v.role === "tutor") {
      const y = v.experienceYears;
      if (typeof y !== "number" || !Number.isInteger(y) || y < 0 || y > 60) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["experienceYears"], message: "Enter your years of experience (0 if you're new)" });
      return;
    }
    if (v.role !== "student") return;
    if (!v.ageBand) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ageBand"], message: "Tell us your age range" });
      return;
    }
    if (v.ageBand === "under13") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ageBand"], message: "Students under 13 need a parent to create a Parent account" });
      return;
    }
    if (!v.grade) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["grade"], message: "Choose your class or level" });
    if (v.ageBand === "13-17") {
      const parsed = emailSchema.safeParse(v.parentEmail ?? "");
      if (!parsed.success) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["parentEmail"], message: "Enter your parent or guardian's email" });
      else if (parsed.data.toLowerCase() === v.email.trim().toLowerCase()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["parentEmail"], message: "Use your parent or guardian's own email, not yours" });
      }
    }
  });

type Values = z.input<typeof schema>;

const TITLE: Record<RoleChoice, string> = {
  student: "Sign up as a student",
  parent: "Sign up as a parent",
  tutor: "Sign up as a tutor",
};

const AGE_OPTIONS: { value: AgeBand; label: string }[] = [
  { value: "18+", label: "18+" },
  { value: "13-17", label: "13–17" },
  { value: "under13", label: "Under 13" },
];

/** A small link that switches the sign-up to another kind of account. */
function RoleLink({ to, onPick, children }: { to: RoleChoice; onPick: (r: RoleChoice) => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={() => onPick(to)} className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2" data-switch-role={to}>
      {children}
    </button>
  );
}

function isRole(v: string | null): v is RoleChoice {
  return v === "student" || v === "parent" || v === "tutor";
}

export function RegisterView() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const roleParam = params.get("role");
  const router = useRouter();
  const hydrated = useHydrated();
  const me = useSession();
  const signUp = useApp((s) => s.signUp);
  const signIn = useApp((s) => s.signIn);
  const providers = useEnabledProviders();
  const resend = useApp((s) => s.resendConfirmation);
  const logout = useApp((s) => s.logout);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<(SignUpOutcome & { role: RoleChoice; firstName: string; email: string; parentEmail?: string }) | null>(null);
  const [continuing, setContinuing] = React.useState(false);
  const [resending, setResending] = React.useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      role: isRole(roleParam) ? roleParam : "student",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      country: DEFAULT_COUNTRY,
      ageBand: undefined,
      parentEmail: "",
      grade: "",
      experienceYears: undefined,
      terms: false,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const role = useWatch({ control: form.control, name: "role" });
  const ageBand = useWatch({ control: form.control, name: "ageBand" });

  // After the page loads, start from the visitor's own country (their browser's language or time zone).
  React.useEffect(() => {
    if (hydrated && !form.getFieldState("country").isDirty) form.setValue("country", guessCountry());
  }, [hydrated, form]);
  const blocked = role === "student" && ageBand === "under13";

  /** Where the account continues after sign-up (and after the email confirmation link). */
  const setupFor = (r: RoleChoice) =>
    r === "tutor" ? "/onboarding/tutor" : r === "student" ? `/onboarding/student${next ? `?next=${encodeURIComponent(next)}` : ""}` : destinationFor(r, next);

  const onSubmit = form.handleSubmit(async (v) => {
    setServerError(null);
    const parentEmail = v.role === "student" && v.ageBand === "13-17" ? v.parentEmail?.trim() : undefined;
    const res = await signUp({
      role: v.role,
      firstName: v.firstName,
      lastName: v.lastName,
      email: v.email,
      password: v.password,
      country: v.country,
      ...(v.role === "student" && v.ageBand && v.ageBand !== "under13" ? { ageBand: v.ageBand } : {}),
      ...(parentEmail ? { parentEmail } : {}),
      ...(v.role === "student" && v.grade ? { grade: v.grade } : {}),
      ...(v.role === "tutor" && typeof v.experienceYears === "number" && Number.isInteger(v.experienceYears) ? { experienceYears: v.experienceYears } : {}),
      next: setupFor(v.role),
    });
    if (!res.ok) {
      setServerError(res.error);
      if (/already exists/i.test(res.error)) form.setError("email", { message: "This email is already registered" });
      else if (/parent or guardian/i.test(res.error)) form.setError("parentEmail", { message: res.error });
      return;
    }
    setCreated({ ...res.data, role: v.role, firstName: v.firstName.trim(), email: v.email.trim().toLowerCase(), parentEmail });
  });

  const signInHref = `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  /* ─── Success: confirm your email, or continue ───────────────── */
  if (created) {
    const dest = setupFor(created.role);
    const consent = created.parentEmail && (
      <InlineAlert className="mt-6" tone={created.consent?.sent ? "info" : "warning"} title="Waiting for a parent or guardian">
        {created.consent?.sent ? (
          <>
            We emailed your parent or guardian at <span className="font-medium text-ink">{created.parentEmail}</span>. Until they approve, you can browse tutors and save favorites, but messaging, booking and publishing requirements are paused.
          </>
        ) : (
          <>
            We couldn&apos;t email your parent or guardian yet{created.consent?.error ? ` (${created.consent.error.replace(/\.$/, "")})` : ""}. You can send the request again from your dashboard once you&apos;re signed in.
          </>
        )}
      </InlineAlert>
    );
    if (created.needsConfirmation && created.verifyBy === "code") {
      return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.4, duration: 0.6, delay: 0.1 }}
            className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand"
          >
            <MailCheck className="size-5" aria-hidden />
          </motion.span>
          <h1 className="mt-6 font-heading text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] text-ink">Confirm your email</h1>
          <p role="status" className="mt-2 text-[15px] leading-relaxed text-muted">
            Welcome to TutorLink, {created.firstName}. We sent a 6-digit code to <span className="font-medium text-ink">{created.email}</span>. Enter it to finish creating your account
            {created.role === "tutor" ? ". Next comes your tutor profile setup." : created.role === "student" ? ". Next comes your learning profile." : "."} It can take a minute or two to arrive; check your spam folder too.
          </p>
          {consent}
          <div className="mt-8">
            <EmailCodeForm
              email={created.email}
              submitLabel="Confirm and continue"
              onVerified={async () => {
                // The email is confirmed; sign in with the password just chosen (all the usual sign-in checks apply).
                const r = await signIn(created.email, form.getValues("password"));
                if (r.ok && !r.data.mfaRequired) {
                  toast.success("Email confirmed", { description: "Your account is ready." });
                  router.push(dest);
                  return;
                }
                toast.success("Email confirmed", { description: "Sign in to continue." });
                router.push(`${signInHref}${signInHref.includes("?") ? "&" : "?"}verified=1`);
              }}
            />
          </div>
          <p className="mt-5 text-center text-[14px] text-muted">
            Wrong email?{" "}
            <button type="button" onClick={() => setCreated(null)} className="font-medium text-ink underline underline-offset-4">
              Go back
            </button>
          </p>
        </motion.div>
      );
    }
    if (created.needsConfirmation) {
      return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.4, duration: 0.6, delay: 0.1 }}
            className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand"
          >
            <MailCheck className="size-5" aria-hidden />
          </motion.span>
          <h1 className="mt-6 font-heading text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] text-ink">Confirm your email</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Welcome to TutorLink, {created.firstName}. We sent a link to <span className="font-medium text-ink">{created.email}</span>. Open it to finish creating your account
            {created.role === "tutor" ? " — it takes you straight to your tutor profile setup." : created.role === "student" ? " — it takes you to your learning profile." : "."}
          </p>
          {consent}
          <div className="mt-8 space-y-3">
            <Button
              size="lg"
              variant="secondary"
              className="w-full"
              loading={resending}
              onClick={async () => {
                setResending(true);
                const r = await resend(created.email);
                setResending(false);
                if (r.ok) toast.success("Email sent again", { description: "Check your spam folder if it doesn't arrive in a few minutes." });
                else toast.error(r.error);
              }}
            >
              Send the link again
            </Button>
            <Button asChild size="lg" variant="ghost" className="w-full">
              <Link href={signInHref}>I&apos;ve confirmed — sign in</Link>
            </Button>
          </div>
        </motion.div>
      );
    }
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.4, duration: 0.6, delay: 0.1 }}
          className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand"
        >
          <MailCheck className="size-5" aria-hidden />
        </motion.span>
        <h1 className="mt-6 font-heading text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] text-ink">Welcome to TutorLink</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">Your account is ready, {created.firstName}.</p>
        {consent}

        <div className="mt-8 space-y-3">
          <Button
            size="lg"
            className="w-full"
            loading={continuing}
            onClick={() => {
              setContinuing(true);
              router.push(dest);
            }}
          >
            {created.role === "tutor" ? "Set up your tutor profile" : created.role === "student" ? "Set up your learning profile" : "Go to your dashboard"} <ArrowRight />
          </Button>
          {created.role === "student" && (
            <Button asChild size="lg" variant="ghost" className="w-full">
              <Link href={destinationFor(created.role, next)}>Skip for now</Link>
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  /* ─── Already signed in ───────────────────────────────────────── */
  if (hydrated && me && !isSubmitting) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <h1 className="font-heading text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] text-ink">You&apos;re already signed in</h1>
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-line bg-canvas p-4">
          <Avatar name={`${me.firstName} ${me.lastName}`} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {me.firstName} {me.lastName}
            </p>
            <p className="truncate text-[13px] text-muted">
              {ROLE_LABEL[me.role]} · {me.email}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <Button asChild size="lg" className="flex-1">
            <Link href={destinationFor(me.role, next)}>
              Go to dashboard <ArrowRight />
            </Link>
          </Button>
          <Button size="lg" variant="secondary" className="flex-1" onClick={() => void logout()}>
            Sign out to create a new account
          </Button>
        </div>
      </motion.div>
    );
  }

  /* ─── Form ────────────────────────────────────────────────────── */
  // One page per kind of account, like the big marketplaces: the title says who it's for, small links switch.
  const switchTo = (r: RoleChoice) => {
    form.setValue("role", r);
    form.clearErrors();
    setServerError(null);
    router.replace(`/register?role=${r}${next ? `&next=${encodeURIComponent(next)}` : ""}`, { scroll: false });
  };
  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <h1 className="font-heading text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] text-ink">{TITLE[role]}</h1>
        <p className="mt-2 text-[15px] text-muted">
          Already have an account?{" "}
          <Link href={signInHref} className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
            Log in
          </Link>
        </p>
        <p className="mt-1.5 text-[14px] text-muted">
          {role === "student" ? (
            <>
              Are you a parent? <RoleLink to="parent" onPick={switchTo}>Sign up as a parent</RoleLink> · Want to teach? <RoleLink to="tutor" onPick={switchTo}>Become a tutor</RoleLink>
            </>
          ) : role === "parent" ? (
            <>
              Signing up for yourself? <RoleLink to="student" onPick={switchTo}>Student</RoleLink> · <RoleLink to="tutor" onPick={switchTo}>Tutor</RoleLink>
            </>
          ) : (
            <>
              Want to learn instead? <RoleLink to="student" onPick={switchTo}>Sign up as a student</RoleLink>
            </>
          )}
        </p>
      </motion.div>

      {/* Sign up with Google / Facebook / Apple: the role is confirmed on the next page (this pre-selects it). */}
      <SocialSignIn
        next={next}
        providers={providers ?? []}
        role={role}
        divider={
          <div className="my-6 flex items-center gap-4" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            <span className="text-[14px] text-muted">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        }
      />

      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.06 }}
        onSubmit={onSubmit}
        noValidate
        className="mt-6 space-y-5"
      >
        <AnimatePresence initial={false}>
          {serverError && (
            <motion.div key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <InlineAlert tone="danger" title="We couldn't create your account">
                {serverError}{" "}
                {/already exists/i.test(serverError) && (
                  <Link href={signInHref} className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
                    Log in instead
                  </Link>
                )}
              </InlineAlert>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={errors.firstName?.message}>
            <Input autoComplete="given-name" icon={<UserRound />} {...form.register("firstName")} />
          </Field>
          <Field label="Last name" error={errors.lastName?.message}>
            <Input autoComplete="family-name" {...form.register("lastName")} />
          </Field>
        </div>

        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" icon={<Mail />} placeholder="you@example.com" {...form.register("email")} />
        </Field>

        <Field label="Password" error={errors.password?.message} id="reg-password" hint={errors.password ? undefined : "At least 10 characters."}>
          <PasswordInput autoComplete="new-password" placeholder="At least 10 characters" {...form.register("password")} />
        </Field>

        {role === "student" && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-ink" id="age-label">
                Your age
              </p>
              <Controller
                control={form.control}
                name="ageBand"
                render={({ field }) => (
                  <div aria-labelledby="age-label">
                    <RadioCards
                      name="ageBand"
                      columns={3}
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        field.onBlur();
                      }}
                      options={AGE_OPTIONS}
                    />
                  </div>
                )}
              />
              {errors.ageBand && ageBand !== "under13" && (
                <p role="alert" className="mt-1.5 text-[13px] text-danger">
                  {errors.ageBand.message}
                </p>
              )}
            </div>
            <AnimatePresence initial={false} mode="wait">
              {ageBand === "13-17" && (
                <motion.div key="teen" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  <Field label="Parent or guardian's email" error={errors.parentEmail?.message} hint="Students under 18 need their OK. We'll email them.">
                    <Input type="email" autoComplete="off" inputMode="email" icon={<ShieldCheck />} placeholder="parent@example.com" {...form.register("parentEmail")} />
                  </Field>
                </motion.div>
              )}
              {ageBand === "under13" && (
                <motion.div key="child" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  <InlineAlert
                    tone="warning"
                    title="A parent needs to sign up for you"
                    action={
                      <Button type="button" size="sm" variant="secondary" onClick={() => { switchTo("parent"); form.setValue("ageBand", undefined); }}>
                        Sign up as a parent
                      </Button>
                    }
                  >
                    Children under 13 can&apos;t have their own account. A parent or guardian can sign up, add you as a child and book lessons for you.
                  </InlineAlert>
                </motion.div>
              )}
            </AnimatePresence>
            {ageBand !== "under13" && (
              <Controller
                control={form.control}
                name="grade"
                render={({ field }) => (
                  <Field label="Your class or level" error={errors.grade?.message} id="reg-grade">
                    <Select id="reg-grade" ref={field.ref} name={field.name} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} placeholder="Choose your class" options={GRADES.map((g) => ({ value: g.value, label: g.label }))} />
                  </Field>
                )}
              />
            )}
          </div>
        )}

        {role === "tutor" && (
          <Field label="Years of teaching experience" error={errors.experienceYears?.message} hint="0 if you're new to tutoring. You'll add the details in your tutor profile next." className="max-w-xs">
            <Input type="number" inputMode="numeric" min={0} max={60} step={1} suffix={<span className="pr-1 text-sm">years</span>} {...form.register("experienceYears", { valueAsNumber: true })} />
          </Field>
        )}

        <div className="space-y-1.5">
          <Controller
            control={form.control}
            name="terms"
            render={({ field }) => (
              <Checkbox
                checked={field.value}
                onCheckedChange={(v) => {
                  field.onChange(v === true);
                  field.onBlur();
                }}
                aria-invalid={!!errors.terms || undefined}
                aria-describedby={errors.terms ? "terms-error" : undefined}
                label={
                  <>
                    I agree to the{" "}
                    <Link href="/terms" target="_blank" className="font-semibold text-ink underline underline-offset-2">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" target="_blank" className="font-semibold text-ink underline underline-offset-2">
                      Privacy Policy
                    </Link>
                    , and to keep contact and payments on TutorLink: no phone numbers, emails or social media in messages or lessons. Breaking this can get my account suspended.
                  </>
                }
              />
            )}
          />
          {errors.terms && (
            <p id="terms-error" role="alert" className="pl-7 text-[13px] text-danger">
              {errors.terms.message}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} disabled={!hydrated || blocked}>
          Sign up
        </Button>
        <p className="text-center text-[12.5px] text-muted">{role === "tutor" ? "Free to join. Next, you'll build your tutor profile." : "Free to join. You only pay when you book a lesson."}</p>
      </motion.form>
    </div>
  );
}
