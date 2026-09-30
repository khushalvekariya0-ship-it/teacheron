"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, BookOpen, GraduationCap, Mail, MailCheck, MapPin, ShieldCheck, UserRound, Users } from "lucide-react";
import { AnimatePresence, motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Checkbox, RadioCards } from "@/components/ui/Controls";
import { InlineAlert } from "@/components/ui/States";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/lib/store";
import { useHydrated, useSession } from "@/lib/store/hooks";
import { ROLE_LABEL } from "@/lib/data/users";
import type { User } from "@/lib/types";
import { destinationFor, safeNext } from "./authUtils";
import { PasswordInput, PasswordStrengthMeter } from "./PasswordField";

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
    zip: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit ZIP code"),
    ageBand: z.enum(["18+", "13-17", "under13"]).optional(),
    parentEmail: z.string().trim().optional(),
    terms: z.boolean().refine((v) => v, "Please accept the Terms of Service and Privacy Policy"),
  })
  .superRefine((v, ctx) => {
    if (v.role !== "student") return;
    if (!v.ageBand) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ageBand"], message: "Tell us your age range" });
      return;
    }
    if (v.ageBand === "under13") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ageBand"], message: "Students under 13 need a parent to create a Parent account" });
    }
    if (v.ageBand === "13-17") {
      const parsed = emailSchema.safeParse(v.parentEmail ?? "");
      if (!parsed.success) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["parentEmail"], message: "Enter your parent or guardian's email" });
      else if (parsed.data.toLowerCase() === v.email.trim().toLowerCase()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["parentEmail"], message: "Use your parent or guardian's own email, not yours" });
      }
    }
  });

type Values = z.input<typeof schema>;

const ROLE_OPTIONS: { value: RoleChoice; label: string; icon: React.ReactNode }[] = [
  { value: "student", label: "Student", icon: <GraduationCap /> },
  { value: "parent", label: "Parent", icon: <Users /> },
  { value: "tutor", label: "Tutor", icon: <BookOpen /> },
];

const ROLE_HELP: Record<RoleChoice, string> = {
  student: "Find tutors and book lessons for yourself.",
  parent: "Add your children, book lessons for them and follow their progress.",
  tutor: "Create a profile, set your rates and apply to student jobs.",
};

const AGE_OPTIONS: { value: AgeBand; label: string }[] = [
  { value: "18+", label: "18+" },
  { value: "13-17", label: "13–17" },
  { value: "under13", label: "Under 13" },
];

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
  const register = useApp((s) => s.register);
  const logout = useApp((s) => s.logout);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<User | null>(null);
  const [continuing, setContinuing] = React.useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      role: isRole(roleParam) ? roleParam : "student",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      zip: "",
      ageBand: undefined,
      parentEmail: "",
      terms: false,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const role = useWatch({ control: form.control, name: "role" });
  const ageBand = useWatch({ control: form.control, name: "ageBand" });
  const password = useWatch({ control: form.control, name: "password" }) ?? "";
  const blocked = role === "student" && ageBand === "under13";

  const onSubmit = form.handleSubmit(async (v) => {
    setServerError(null);
    const res = await register({
      role: v.role,
      firstName: v.firstName,
      lastName: v.lastName,
      email: v.email,
      password: v.password,
      zip: v.zip,
      ...(v.role === "student" && v.ageBand && v.ageBand !== "under13" ? { ageBand: v.ageBand } : {}),
      ...(v.role === "student" && v.ageBand === "13-17" ? { parentEmail: v.parentEmail?.trim() } : {}),
    });
    if (!res.ok) {
      setServerError(res.error);
      if (/already exists/i.test(res.error)) form.setError("email", { message: "This email is already registered" });
      else if (/parent or guardian/i.test(res.error)) form.setError("parentEmail", { message: res.error });
      return;
    }
    setCreated(res.data);
  });

  const signInHref = `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  /* ─── Success: verify your email ─────────────────────────────── */
  if (created) {
    const dest = created.role === "tutor" ? "/onboarding/tutor" : destinationFor(created.role, next);
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
        <h1 className="mt-6 font-heading text-[2rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-ink">Verify your email</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Welcome to TutorLink, {created.firstName}. We sent a verification link to <span className="font-medium text-ink">{created.email}</span>. You can keep going in the meantime.
        </p>

        {created.parentalConsent && (
          <InlineAlert
            className="mt-6"
            tone="info"
            title="Waiting for a parent or guardian"
            action={
              <Button asChild size="sm" variant="secondary">
                <Link href={`/consent?user=${encodeURIComponent(created.id)}`}>Open approval link</Link>
              </Button>
            }
          >
            We emailed your parent or guardian at <span className="font-medium text-ink">{created.parentalConsent.parentEmail}</span>. Until they approve, you can browse tutors and save favorites, but messaging, booking and publishing requirements are paused. Preview: open the approval link to act as the parent.
          </InlineAlert>
        )}

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
            {created.role === "tutor" ? "Set up your tutor profile" : "Go to your dashboard"} <ArrowRight />
          </Button>
          <p className="text-center text-[12.5px] text-muted">Preview build — no email is actually sent.</p>
        </div>
      </motion.div>
    );
  }

  /* ─── Already signed in ───────────────────────────────────────── */
  if (hydrated && me && !isSubmitting) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <h1 className="font-heading text-[2rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-ink">You&apos;re already signed in</h1>
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
          <Button size="lg" variant="secondary" className="flex-1" onClick={logout}>
            Sign out to create a new account
          </Button>
        </div>
      </motion.div>
    );
  }

  /* ─── Form ────────────────────────────────────────────────────── */
  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <h1 className="font-heading text-[2rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-ink">Create your account</h1>
        <p className="mt-2 text-[15px] text-muted">
          Already have one?{" "}
          <Link href={signInHref} className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
            Sign in
          </Link>
        </p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.06 }}
        onSubmit={onSubmit}
        noValidate
        className="mt-8 space-y-5"
      >
        <AnimatePresence initial={false}>
          {serverError && (
            <motion.div key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <InlineAlert tone="danger" title="We couldn't create your account">
                {serverError}{" "}
                {/already exists/i.test(serverError) && (
                  <Link href={signInHref} className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
                    Sign in instead
                  </Link>
                )}
              </InlineAlert>
            </motion.div>
          )}
        </AnimatePresence>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">I&apos;m joining as</legend>
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => <RadioCards name="role" columns={3} value={field.value} onValueChange={field.onChange} options={ROLE_OPTIONS} />}
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={role} initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-2 text-[13px] text-muted">
              {ROLE_HELP[role]}
            </motion.p>
          </AnimatePresence>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
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

        <Field label="Password" error={errors.password?.message} id="reg-password">
          <PasswordInput autoComplete="new-password" placeholder="At least 10 characters" {...form.register("password")} />
        </Field>
        <div className="-mt-3">
          <PasswordStrengthMeter value={password} />
        </div>

        <Field
          label="ZIP code"
          error={errors.zip?.message}
          hint={role === "tutor" ? "Sets your in-person service area. Your exact address is never shown." : "Helps us show tutors near you. Online tutors are available everywhere."}
        >
          <Input inputMode="numeric" autoComplete="postal-code" maxLength={5} icon={<MapPin />} placeholder="e.g. 60614" className="sm:max-w-44" {...form.register("zip")} />
        </Field>

        <AnimatePresence initial={false}>
          {role === "student" && (
            <motion.div key="age" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: EASE }} className="overflow-hidden">
              <fieldset className="space-y-4 rounded-xl bg-canvas p-4">
                <legend className="sr-only">Your age</legend>
                <div>
                  <p className="text-sm font-medium text-ink" id="age-label">
                    How old are you?
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted">We ask so we can apply the right safeguards for younger students.</p>
                </div>
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
                  <p role="alert" className="text-[13px] text-danger">
                    {errors.ageBand.message}
                  </p>
                )}

                <AnimatePresence initial={false} mode="wait">
                  {ageBand === "13-17" && (
                    <motion.div key="teen" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="space-y-3">
                      <Field label="Parent or guardian's email" error={errors.parentEmail?.message} hint="We'll ask them to approve your account.">
                        <Input type="email" autoComplete="off" inputMode="email" icon={<ShieldCheck />} placeholder="parent@example.com" {...form.register("parentEmail")} />
                      </Field>
                      <p className="text-[13px] leading-relaxed text-muted">
                        Because you&apos;re under 18, a parent or guardian needs to give consent before you can message tutors or book lessons. They&apos;ll also be able to see your conversations and lessons.
                      </p>
                    </motion.div>
                  )}
                  {ageBand === "under13" && (
                    <motion.div key="child" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                      <InlineAlert
                        tone="warning"
                        title="A parent needs to sign up for you"
                        action={
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              form.setValue("role", "parent");
                              form.setValue("ageBand", undefined);
                              form.clearErrors(["ageBand", "parentEmail"]);
                            }}
                          >
                            Switch to Parent
                          </Button>
                        }
                      >
                        Under the Children&apos;s Online Privacy Protection Act (COPPA), children under 13 can&apos;t have their own account. Ask a parent or guardian to create a Parent account — they can add you as a child and book lessons for you.
                      </InlineAlert>
                    </motion.div>
                  )}
                </AnimatePresence>
              </fieldset>
            </motion.div>
          )}
        </AnimatePresence>

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
                    .
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
          {role === "tutor" ? "Create tutor account" : "Create account"}
        </Button>
        <p className="text-center text-[12.5px] text-muted">Free to join. You only pay when you book a lesson.</p>
      </motion.form>
    </div>
  );
}
