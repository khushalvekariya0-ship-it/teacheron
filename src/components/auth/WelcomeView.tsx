"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, BookOpen, GraduationCap, KeyRound, Mail, MapPin, ShieldCheck, Users } from "lucide-react";
import { motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { Checkbox, RadioCards } from "@/components/ui/Controls";
import { Skeleton } from "@/components/ui/Skeleton";
import { InlineAlert, UnauthorizedState } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { useApp } from "@/lib/store";
import { useHydrated, useSession } from "@/lib/store/hooks";
import { COUNTRIES, DEFAULT_COUNTRY, guessCountry, isCountryCode } from "@/lib/location";
import { isPostalCode, POSTAL_MAX_LENGTH, postalError, postalLabel, postalNumeric, postalPlaceholder, postalRequired } from "@/lib/postal";
import { destinationFor, safeNext } from "./authUtils";

const EASE = [0.22, 1, 0.36, 1] as const;
const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));
const emailSchema = z.string().trim().min(1, "Enter your email address").email("Enter a valid email address");

const schema = z
  .object({
    role: z.enum(["student", "parent", "tutor"]),
    ageBand: z.enum(["18+", "13-17", "under13"]).optional(),
    parentEmail: z.string().trim().optional(),
    country: z.string().refine((v) => isCountryCode(v), "Choose your country"),
    zip: z.string().trim(),
    terms: z.boolean().refine((v) => v, "Please accept the Terms of Service and Privacy Policy"),
  })
  .superRefine((v, ctx) => {
    if (v.zip ? !isPostalCode(v.zip, v.country) : postalRequired(v.country)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["zip"], message: postalError(v.country) });
    if (v.role !== "student") return;
    if (!v.ageBand) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ageBand"], message: "Tell us your age range" });
    if (v.ageBand === "13-17" && !emailSchema.safeParse(v.parentEmail ?? "").success) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["parentEmail"], message: "Enter your parent or guardian's email" });
  });
type Values = z.input<typeof schema>;

const ROLE_OPTIONS = [
  { value: "student" as const, label: "Student", icon: <GraduationCap /> },
  { value: "parent" as const, label: "Parent", icon: <Users /> },
  { value: "tutor" as const, label: "Tutor", icon: <BookOpen /> },
];
// Same wording as the sign-up page.
const ROLE_HELP = {
  student: "Find tutors and book lessons for yourself.",
  parent: "Add your children, book lessons for them and follow their progress.",
  tutor: "Create a profile, set your rates and apply to student jobs.",
} as const;
const AGE_OPTIONS = [
  { value: "18+" as const, label: "18+" },
  { value: "13-17" as const, label: "13–17" },
  { value: "under13" as const, label: "Under 13" },
];

/**
 * After a first-time Google / Facebook / Apple sign-in: add an email if the provider gave none, then choose
 * Student, Parent or Tutor — once. The server checks and saves the choice; until then the account can't
 * be used (no data, no actions).
 */
export function WelcomeView() {
  const hydrated = useHydrated();
  const me = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  if (!hydrated) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (!me) return <UnauthorizedState next="/welcome" />;
  if (!me.needsRole) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
        <h1 className="font-heading text-[2rem] leading-[1.05] text-ink">Your account is ready</h1>
        <p className="mt-2 text-[15px] text-muted">You&apos;re signed in as {me.firstName}.</p>
        <Button size="lg" className="mt-8" onClick={() => router.push(destinationFor(me.role, next))}>
          Continue <ArrowRight />
        </Button>
      </motion.div>
    );
  }
  return me.email ? <ChooseRole email={me.email} firstName={me.firstName} /> : <AddEmail />;
}

/* ─── A provider gave no email: add one, confirmed with a code ─────────────── */

function AddEmail() {
  const start = useApp((s) => s.startAddEmail);
  const finish = useApp((s) => s.finishAddEmail);
  const refresh = useApp((s) => s.refresh);
  const [email, setEmail] = React.useState("");
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    const r = await start(parsed.data);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setSentTo(parsed.data.toLowerCase());
    setCode("");
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const c = code.replace(/[\s-]/g, "");
    if (!/^\d{6}$/.test(c)) return setError("Enter the 6 digits from the email.");
    setBusy(true);
    const r = await finish(c);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success("Email confirmed");
    await refresh();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
      <span className="grid size-12 place-items-center bg-brand-soft text-brand">
        <Mail className="size-5" aria-hidden />
      </span>
      <h1 className="mt-6 font-heading text-[2rem] leading-[1.05] text-ink">Add your email</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">Your sign-in didn&apos;t share an email address. TutorLink needs one for lesson updates and to keep your account safe.</p>
      {error && <InlineAlert className="mt-6" tone="danger" title={error} />}
      {!sentTo ? (
        <form onSubmit={send} noValidate className="mt-8 space-y-5">
          <Field label="Email">
            <Input type="email" inputMode="email" autoComplete="email" icon={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Send a code
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} noValidate className="mt-8 space-y-5">
          <p className="text-[14px] text-muted">
            We sent a 6-digit code to <span className="font-medium text-ink">{sentTo}</span>.
          </p>
          <Field label="Code from the email" hint="It works for 15 minutes.">
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={9} icon={<KeyRound />} value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 digits" className="font-mono tracking-[0.3em]" autoFocus />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Confirm email
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => void send()} disabled={busy}>
              Send a new code
            </Button>
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setSentTo(null)}>
              Use a different email
            </Button>
          </div>
        </form>
      )}
    </motion.div>
  );
}

/* ─── Choose Student, Parent or Tutor ─────────────────────────────────────── */

function ChooseRole({ email, firstName }: { email: string; firstName: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const completeSignup = useApp((s) => s.completeSignup);
  const logout = useApp((s) => s.logout);
  const hint = params.get("role");
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { role: hint === "parent" || hint === "tutor" ? hint : "student", ageBand: undefined, parentEmail: "", country: DEFAULT_COUNTRY, zip: "", terms: false },
  });
  const { errors, isSubmitting } = form.formState;
  const [role, ageBand, country] = useWatch({ control: form.control, name: ["role", "ageBand", "country"] });
  React.useEffect(() => {
    if (hydrated && !form.getFieldState("country").isDirty) form.setValue("country", guessCountry());
  }, [hydrated, form]);
  const relay = /@privaterelay\.appleid\.com$/i.test(email);

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    const r = await completeSignup({
      role: v.role,
      ageBand: v.role === "student" ? v.ageBand : undefined,
      parentEmail: v.role === "student" && v.ageBand === "13-17" ? v.parentEmail : undefined,
      country: v.country,
      zip: v.zip.trim() || undefined,
      terms: true,
      next: params.get("next") ?? undefined,
    });
    if (!r.ok) {
      if ("deleted" in r && r.deleted) {
        toast.error(r.error);
        await logout();
        return router.replace("/register?role=parent");
      }
      return setError(r.error);
    }
    toast.success(`Welcome to TutorLink, ${firstName || "there"}`);
    router.push(r.data.next);
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
      <h1 className="font-heading text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] text-ink">Welcome{firstName ? `, ${firstName}` : ""}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        One last step to create your account for <span className="font-medium text-ink">{email}</span>
        {relay ? " (Apple's private relay address: emails reach you through Apple)" : ""}. You choose this once.
      </p>
      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-6">
        {error && <InlineAlert tone="danger" title={error} />}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">I&apos;m joining as</legend>
          <Controller control={form.control} name="role" render={({ field }) => <RadioCards name="role" columns={3} value={field.value} onValueChange={field.onChange} options={ROLE_OPTIONS} />} />
          <p className="mt-2 text-[13px] text-muted">{ROLE_HELP[role]}</p>
        </fieldset>

        {role === "student" && (
          <fieldset className="space-y-4 rounded-xl bg-canvas p-4">
            <legend className="sr-only">Your age</legend>
            <div>
              <p className="text-sm font-medium text-ink" id="age-label">How old are you?</p>
              <p className="mt-0.5 text-[13px] text-muted">We ask so we can apply the right safeguards for younger students.</p>
            </div>
            <Controller
              control={form.control}
              name="ageBand"
              render={({ field }) => (
                <div aria-labelledby="age-label">
                  <RadioCards name="ageBand" columns={3} value={field.value} onValueChange={(v) => { field.onChange(v); field.onBlur(); }} options={AGE_OPTIONS} />
                </div>
              )}
            />
            {errors.ageBand && <p role="alert" className="text-[13px] text-danger">{errors.ageBand.message}</p>}
            {ageBand === "13-17" && (
              <Field label="Parent or guardian's email" error={errors.parentEmail?.message} hint="We'll ask them to approve your account before you can message tutors or book.">
                <Input type="email" inputMode="email" icon={<ShieldCheck />} placeholder="parent@example.com" {...form.register("parentEmail")} />
              </Field>
            )}
            {ageBand === "under13" && (
              <InlineAlert tone="warning" title="A parent needs to sign up for you">
                Children under 13 can&apos;t have their own account. Continuing removes this sign-in; ask a parent to create a Parent account and add you as a child.
              </InlineAlert>
            )}
          </fieldset>
        )}

        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)]">
          <Field label="Country" error={errors.country?.message} id="welcome-country">
            <Controller
              control={form.control}
              name="country"
              render={({ field }) => (
                <Select id="welcome-country" options={COUNTRY_OPTIONS} autoComplete="country" value={field.value} onBlur={field.onBlur} onChange={(e) => { field.onChange(e.target.value); form.setValue("zip", ""); }} />
              )}
            />
          </Field>
          <Field label={postalLabel(country)} optional={!postalRequired(country)} error={errors.zip?.message}>
            <Input inputMode={postalNumeric(country) ? "numeric" : "text"} autoComplete="postal-code" maxLength={POSTAL_MAX_LENGTH} icon={<MapPin />} placeholder={postalPlaceholder(country)} {...form.register("zip")} />
          </Field>
        </div>

        <div className="space-y-1.5">
          <Controller
            control={form.control}
            name="terms"
            render={({ field }) => (
              <Checkbox
                checked={field.value}
                onCheckedChange={(v) => { field.onChange(v === true); field.onBlur(); }}
                label={
                  <>
                    I agree to the{" "}
                    <Link href="/terms" target="_blank" className="font-semibold text-ink underline underline-offset-2">Terms of Service</Link> and{" "}
                    <Link href="/privacy" target="_blank" className="font-semibold text-ink underline underline-offset-2">Privacy Policy</Link>.
                  </>
                }
              />
            )}
          />
          {errors.terms && <p role="alert" className="pl-7 text-[13px] text-danger">{errors.terms.message}</p>}
        </div>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          {role === "tutor" ? "Create tutor account" : "Create account"} <ArrowRight />
        </Button>
        <p className="text-center text-[13px] text-muted">
          Not you?{" "}
          <button type="button" className="font-medium text-ink underline underline-offset-4" onClick={async () => { await logout(); router.replace("/login"); }}>
            Sign out
          </button>
        </p>
      </form>
    </motion.div>
  );
}
