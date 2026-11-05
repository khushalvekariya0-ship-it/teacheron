"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle, BadgeCheck, Clock, Download, Globe2, KeyRound, LogOut, Mail, Monitor, Phone, ShieldCheck, Trash2, UserRound, XCircle, CheckCircle2,
} from "lucide-react";
import type { SignInMethod, SignInMethods, User } from "@/lib/types";
import { PageHeader } from "@/components/dashboard/Shell";
import { AnimatePresence, motion } from "@/components/motion";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/Overlay";
import { InlineAlert } from "@/components/ui/States";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Disclosure";
import { toast } from "@/components/ui/Toast";
import { DEFAULT_NOTIFICATION_PREFS, useApp } from "@/lib/store";
import { useNow, useSession } from "@/lib/store/hooks";
import { resolveTutor } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/data/users";
import { allTimeZones, currentZoneName } from "@/lib/timezones";
import { formatDate, formatDateTime, formatRelative, tzAbbrev } from "@/lib/format";
import { formatPhone, phonePlaceholder, phoneProblem, typePhone } from "@/lib/phone";
import { PasswordInput, PasswordStrengthMeter } from "@/components/auth/PasswordField";
import { AppleIcon, FacebookIcon, GoogleIcon } from "@/components/auth/SocialIcons";
import { TwoStepLogin } from "@/components/auth/TwoStepLogin";
import { downloadJson } from "./hooks";
import { LocationFields } from "@/components/domain/LocationFields";
import { isCountryCode, startCountry } from "@/lib/location";
import { isPostalCode, postalError } from "@/lib/postal";

type TabKey = "profile" | "timezone" | "security" | "privacy";
const TABS: TabKey[] = ["profile", "timezone", "security", "privacy"];

const PROVIDER_NAME: Record<string, string> = { google: "Google", facebook: "Facebook", apple: "Apple" };
/** Why connecting Google / Facebook / Apple from Security didn't work (?linkError=…). */
const LINK_ERROR: Record<string, string> = {
  cancelled: "Connecting was cancelled. Nothing changed.",
  taken: "That account is already used to sign in to another TutorLink account, so it can't be connected here.",
  disabled: "Connecting another sign-in isn't switched on for the site yet. Please try again later.",
  provider: "That sign-in option isn't available right now.",
  busy: "Too many tries. Please wait a few minutes and try again.",
  failed: "We couldn't connect that account. Please try again.",
};

/** This account's ways to sign in (GET /api/auth/methods), reloaded after a change. */
function useSignInMethods() {
  const [data, setData] = React.useState<SignInMethods | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/methods", { cache: "no-store", credentials: "same-origin" })
      .then((r) => r.json())
      .then((body: (SignInMethods & { ok?: boolean }) | null) => {
        if (cancelled) return;
        if (body?.ok) setData(body);
        setFailed(!body?.ok);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [version]);
  const reload = React.useCallback(() => setVersion((v) => v + 1), []);
  return { data, failed, reload, replace: setData };
}
type MethodsState = ReturnType<typeof useSignInMethods>;

export function SettingsView() {
  const me = useSession();
  // ?tab=security opens that tab (links in security emails and the "Connect Google" return).
  const [tab, setTab] = React.useState<TabKey>(() => {
    if (typeof window === "undefined") return "profile";
    const t = new URLSearchParams(window.location.search).get("tab") as TabKey | null;
    return t && TABS.includes(t) ? t : "profile";
  });
  const methods = useSignInMethods();
  const router = useRouter();
  const told = React.useRef(false);
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const linked = q.get("linked");
    const linkError = q.get("linkError");
    if (!linked && !linkError) return;
    if (!told.current) {
      told.current = true;
      if (linked) toast.success(`${PROVIDER_NAME[linked] ?? "That account"} is connected`, { description: "You can now sign in with it too." });
      if (linkError) toast.error(LINK_ERROR[linkError] ?? LINK_ERROR.failed);
    }
    // A reload shouldn't repeat the message (once the page has settled).
    const t = setTimeout(() => router.replace(`${window.location.pathname}?tab=security`, { scroll: false }), 300);
    return () => clearTimeout(t);
  }, [router]);
  if (!me) return null;
  return (
    <div>
      <PageHeader title="Settings" description="Manage your profile, time zone, security and personal data." />
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList aria-label="Settings sections">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="timezone">Time zone</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="privacy">Privacy &amp; data</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileTab me={me} methods={methods} />
        </TabsContent>
        <TabsContent value="timezone">
          <TimezoneTab me={me} />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab me={me} methods={methods} />
        </TabsContent>
        <TabsContent value="privacy">
          <PrivacyTab me={me} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Profile ───────────────────────────────────────────────────────────────── */

const profileSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name").max(50, "Keep it under 50 characters"),
    lastName: z.string().trim().min(1, "Enter your last name").max(50, "Keep it under 50 characters"),
    phone: z.string().trim(),
    country: z.string().refine((v) => isCountryCode(v), "Choose your country"),
    city: z.string().trim().max(60, "Keep it under 60 characters"),
    state: z.string().max(60),
    zip: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (v.zip && !isPostalCode(v.zip, v.country)) ctx.addIssue({ code: "custom", path: ["zip"], message: postalError(v.country) });
    const phone = v.phone ? phoneProblem(v.phone, v.country) : null;
    if (phone) ctx.addIssue({ code: "custom", path: ["phone"], message: phone });
  });
type ProfileValues = z.infer<typeof profileSchema>;

function profileDefaults(me: User): ProfileValues {
  return { firstName: me.firstName, lastName: me.lastName, phone: me.phone ?? "", country: startCountry(me), city: me.city ?? "", state: me.state ?? "", zip: me.zip ?? "" };
}

function ProfileTab({ me, methods }: { me: User; methods: MethodsState }) {
  const updateMe = useApp((s) => s.updateMe);
  const [changingEmail, setChangingEmail] = React.useState(false);
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), mode: "onTouched", defaultValues: profileDefaults(me) });
  const { errors, isDirty, isSubmitting } = form.formState;
  const loc = useWatch({ control: form.control, name: ["country", "zip", "city", "state"] });

  const onSubmit = form.handleSubmit(async (v) => {
    const res = await updateMe({
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      phone: v.phone ? formatPhone(v.phone, v.country) : undefined,
      country: v.country,
      city: v.city.trim() || undefined,
      state: v.state || undefined,
      zip: v.zip.trim() || undefined,
    });
    if (!res.ok) return void toast.error(res.error);
    toast.success("Profile updated");
    form.reset(v);
  });

  return (
    <Card className="max-w-3xl">
      <form onSubmit={onSubmit} noValidate>
        <div className="flex items-center gap-4 border-b border-line p-5">
          <Avatar name={`${me.firstName} ${me.lastName}`} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-ink">
              {me.firstName} {me.lastName}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
              {ROLE_LABEL[me.role]} · Member since {formatDate(me.createdAt, undefined, { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="First name" required error={errors.firstName?.message}>
              <Input autoComplete="given-name" icon={<UserRound />} {...form.register("firstName")} />
            </Field>
            <Field label="Last name" required error={errors.lastName?.message}>
              <Input autoComplete="family-name" {...form.register("lastName")} />
            </Field>
          </div>
          <Field
            label="Email"
            hint={
              <span className="inline-flex items-center gap-1.5">
                {me.emailVerified ? (
                  <>
                    <BadgeCheck className="size-3.5 text-ink" aria-hidden />
                    {/@privaterelay\.appleid\.com$/i.test(me.email)
                      ? " Apple's private relay address: emails reach you through Apple, and your real address stays hidden."
                      : " Verified. You sign in with this email, and account emails go here."}
                  </>
                ) : (
                  "Not verified yet — check your inbox for the verification link."
                )}
              </span>
            }
          >
            <div className="flex gap-2">
              <Input value={me.email} readOnly disabled className="min-w-0 flex-1" />
              {me.email && (
                <Button type="button" variant="secondary" onClick={() => setChangingEmail(true)}>
                  <Mail /> Change
                </Button>
              )}
            </div>
          </Field>
          <ChangeEmailDialog open={changingEmail} onOpenChange={setChangingEmail} hasPassword={methods.data?.hasPassword} onChanged={methods.reload} />
          <Controller
            control={form.control}
            name="phone"
            render={({ field }) => (
              <Field label="Mobile phone" optional error={errors.phone?.message} hint="Used for lesson reminders by text when SMS is available.">
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  icon={<Phone />}
                  placeholder={phonePlaceholder(loc[0])}
                  className="sm:max-w-64"
                  {...field}
                  onChange={(e) => field.onChange(typePhone(e.target.value, loc[0]))}
                />
              </Field>
            )}
          />
          <LocationFields
            idPrefix="settings-loc"
            value={{ country: loc[0] || "US", zip: loc[1] ?? "", city: loc[2] ?? "", state: loc[3] ?? "" }}
            onChange={(patch) => {
              for (const [k, v] of Object.entries(patch) as [keyof typeof patch, string][]) form.setValue(k, v, { shouldDirty: true, shouldValidate: !!errors[k] });
            }}
            errors={{ country: errors.country?.message, zip: errors.zip?.message, city: errors.city?.message, state: errors.state?.message }}
          />
        </CardContent>
        <CardFooter className="justify-end">
          <AnimatePresence>
            {isDirty && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mr-auto text-[12.5px] text-muted">
                You have unsaved changes
              </motion.span>
            )}
          </AnimatePresence>
          <Button type="button" variant="ghost" disabled={!isDirty} onClick={() => form.reset(profileDefaults(me))}>
            Discard
          </Button>
          <Button type="submit" disabled={!isDirty} loading={isSubmitting}>
            Save changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

/* ─── Time zone ─────────────────────────────────────────────────────────────── */

function TimezoneTab({ me }: { me: User }) {
  const updateMe = useApp((s) => s.updateMe);
  const now = useNow(15_000);
  const [tz, setTz] = React.useState(() => currentZoneName(me.timezone));
  const [browserTz] = React.useState(() => {
    try {
      return currentZoneName(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
    } catch {
      return "";
    }
  });
  // Every time zone in the world (searchable); a saved or device zone missing from the list is added.
  const options = React.useMemo(() => {
    const list = [...allTimeZones()];
    for (const extra of [currentZoneName(me.timezone), browserTz]) if (extra && !list.some((o) => o.value === extra)) list.push({ value: extra, label: extra.replace(/_/g, " ") });
    return list;
  }, [me.timezone, browserTz]);
  const at = new Date(now);
  const label = options.find((o) => o.value === tz)?.label ?? tz;
  const dirty = tz !== currentZoneName(me.timezone);

  const save = async () => {
    const res = await updateMe({ timezone: tz });
    if (!res.ok) return void toast.error(res.error);
    toast.success("Time zone updated", { description: `Times now show in ${label}.` });
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader title="Time zone" description="Lesson times, reminders, calendars and receipts are shown in this time zone." />
      <CardContent className="space-y-5">
        <Field label="Your time zone">
          <Select value={tz} onChange={(e) => setTz(e.target.value)} options={options} className="sm:max-w-md" searchable searchLabel="Search time zones (country, city or GMT+5:30)" />
        </Field>
        {browserTz && browserTz !== tz && (
          <button type="button" onClick={() => setTz(browserTz)} className="-mt-2 text-[13px] font-medium text-ink hover:underline">
            Use this device&apos;s time zone ({browserTz.replace(/_/g, " ")})
          </button>
        )}
        <div className="flex items-center gap-4 rounded-xl border border-line bg-canvas px-4 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink-2">
            <Clock className="size-[18px]" aria-hidden />
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tz} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
              <p className="text-[22px] font-semibold leading-tight tabular-nums tracking-tight text-ink">
                {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(at)}{" "}
                <span className="text-sm font-medium text-muted">{tzAbbrev(tz, at)}</span>
              </p>
              <p className="text-[13px] text-muted">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz }).format(at)} · preview of how times will look</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button variant="ghost" disabled={!dirty} onClick={() => setTz(currentZoneName(me.timezone))}>
          Reset
        </Button>
        <Button disabled={!dirty} onClick={save}>
          <Globe2 /> Save time zone
        </Button>
      </CardFooter>
    </Card>
  );
}

/* ─── Security ──────────────────────────────────────────────────────────────── */

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    next: z.string().min(10, "Use at least 10 characters").max(128, "Use 128 characters or fewer"),
    confirm: z.string().min(1, "Re-enter your new password"),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
  .refine((v) => v.next !== v.current, { path: ["next"], message: "Choose a different password from your current one" });
type PasswordValues = z.infer<typeof passwordSchema>;

const newPasswordSchema = z
  .object({
    next: z.string().min(10, "Use at least 10 characters").max(128, "Use 128 characters or fewer"),
    confirm: z.string().min(1, "Re-enter your new password"),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
type NewPasswordValues = z.infer<typeof newPasswordSchema>;

function ChangePasswordCard() {
  const changePassword = useApp((s) => s.changePassword);
  const form = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), mode: "onTouched", defaultValues: { current: "", next: "", confirm: "" } });
  const { errors, isSubmitting } = form.formState;
  const next = useWatch({ control: form.control, name: "next" }) ?? "";

  const onSubmit = form.handleSubmit(async (v) => {
    const res = await changePassword(v.current, v.next);
    if (!res.ok) {
      if (/current/i.test(res.error)) form.setError("current", { message: res.error });
      else toast.error(res.error);
      return;
    }
    toast.success("Password changed", { description: "Other browsers and devices were signed out. Use your new password next time you sign in." });
    form.reset();
  });

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <CardHeader title="Change password" description="Use at least 10 characters. A short phrase is easy to remember and hard to guess." />
        <CardContent className="space-y-4">
          <Field label="Current password" error={errors.current?.message}>
            <PasswordInput autoComplete="current-password" {...form.register("current")} />
          </Field>
          <Field label="New password" error={errors.next?.message}>
            <PasswordInput autoComplete="new-password" {...form.register("next")} />
          </Field>
          <PasswordStrengthMeter value={next} />
          <Field label="Confirm new password" error={errors.confirm?.message}>
            <PasswordInput autoComplete="new-password" {...form.register("confirm")} />
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={isSubmitting}>
            <KeyRound /> Update password
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

/** An account made with Google / Facebook / Apple adds a password, to also sign in with its email. */
function SetPasswordCard({ me, social, onDone }: { me: User; social: string[]; onDone: () => void }) {
  const setPassword = useApp((s) => s.setPassword);
  const form = useForm<NewPasswordValues>({ resolver: zodResolver(newPasswordSchema), mode: "onTouched", defaultValues: { next: "", confirm: "" } });
  const { errors, isSubmitting } = form.formState;
  const next = useWatch({ control: form.control, name: "next" }) ?? "";
  const via = social.length ? social.join(" or ") : "another account";

  const onSubmit = form.handleSubmit(async (v) => {
    const res = await setPassword(v.next);
    if (!res.ok) return void toast.error(res.error);
    toast.success("Password set", { description: `You can now also sign in with ${me.email} and this password.` });
    form.reset();
    onDone();
  });

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <CardHeader title="Set a password" description={`You sign in with ${via}. Add a password to also sign in with your email, for example if you lose access to ${via}.`} />
        <CardContent className="space-y-4">
          {!me.emailVerified ? (
            <InlineAlert tone="warning" title="Confirm your email first">You&apos;ll sign in with your email and this password.</InlineAlert>
          ) : (
            <>
              <Field label="New password" error={errors.next?.message}>
                <PasswordInput autoComplete="new-password" {...form.register("next")} />
              </Field>
              <PasswordStrengthMeter value={next} />
              <Field label="Confirm new password" error={errors.confirm?.message}>
                <PasswordInput autoComplete="new-password" {...form.register("confirm")} />
              </Field>
            </>
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!me.emailVerified}>
            <KeyRound /> Set password
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

const SOCIAL_OPTIONS = [
  { id: "google", label: "Google", Icon: GoogleIcon },
  { id: "facebook", label: "Facebook", Icon: FacebookIcon },
  { id: "apple", label: "Apple", Icon: AppleIcon },
] as const;

/** Password and Google / Facebook / Apple: see them, connect one, or disconnect one (while another way to sign in remains). */
function SignInMethodsCard({ me, methods }: { me: User; methods: MethodsState }) {
  const unlink = useApp((s) => s.unlinkSignIn);
  const [removing, setRemoving] = React.useState<SignInMethod | null>(null);
  const [busy, setBusy] = React.useState(false);
  const data = methods.data;
  const options = data ? SOCIAL_OPTIONS.filter((o) => data.providers.includes(o.id) || data.social.some((s) => s.provider === o.id)) : [];

  const disconnect = async () => {
    if (!removing) return;
    setBusy(true);
    const r = await unlink(removing.id);
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    methods.replace({ ...(data as SignInMethods), ...r.data });
    toast.success(`${removing.label} disconnected`, { description: `You can no longer sign in with ${removing.label}.` });
    setRemoving(null);
  };

  return (
    <Card>
      <CardHeader title="Ways to sign in" description="Your password, and the accounts connected to TutorLink." />
      {!data ? (
        <p className="px-5 pb-5 pt-3 text-[13px] text-muted">
          {methods.failed ? (
            <>
              We couldn&apos;t load this.{" "}
              <button type="button" className="font-medium text-ink underline underline-offset-4" onClick={methods.reload}>
                Try again
              </button>
            </>
          ) : (
            "Loading…"
          )}
        </p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-line border-t border-line" aria-label="Ways to sign in">
            <li className="flex items-center gap-3 px-5 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-canvas text-ink-2">
                <KeyRound className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium text-ink">Email and password</span>
                <span className="block truncate text-[12px] text-muted">{data.hasPassword ? me.email : "No password yet: set one above"}</span>
              </span>
              <Badge tone={data.hasPassword ? "success" : "neutral"} size="sm">
                {data.hasPassword ? "On" : "Not set"}
              </Badge>
            </li>
            {options.map(({ id, label, Icon }) => {
              const connected = data.social.filter((s) => s.provider === id);
              if (!connected.length) {
                return (
                  <li key={id} className="flex items-center gap-3 px-5 py-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-white text-[#000]">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-medium text-ink">{label}</span>
                      <span className="block text-[12px] text-muted">Not connected</span>
                    </span>
                    {/* A full page visit: the server sends the browser on to the provider. */}
                    <Button size="sm" variant="secondary" asChild>
                      <a href={`/api/auth/oauth?provider=${id}&link=1`} aria-label={`Connect ${label}`}>
                        Connect
                      </a>
                    </Button>
                  </li>
                );
              }
              return connected.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-white text-[#000]">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-ink">{label}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {m.email ?? "Connected"}
                      {m.connectedAt ? ` · since ${formatDate(m.connectedAt, me.timezone)}` : ""}
                    </span>
                    {m.locked && (
                      <span className="mt-0.5 block text-[12px] text-muted">
                        {m.locked === "only" ? "Your only way to sign in: set a password before disconnecting it." : `The last connected account stays connected; you can still sign in with your password.`}
                      </span>
                    )}
                  </span>
                  <Button size="sm" variant="ghost" disabled={!!m.locked} onClick={() => setRemoving(m)} aria-label={`Disconnect ${label}`}>
                    Disconnect
                  </Button>
                </li>
              ));
            })}
          </ul>
          {options.length === 0 && <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">Signing in with Google, Facebook or Apple isn&apos;t switched on for this site yet.</p>}
        </>
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Disconnect ${removing?.label ?? ""}?`}
        description={`You won't be able to sign in with ${removing?.label ?? "it"} any more. You can connect it again later.`}
        confirmLabel="Disconnect"
        tone="danger"
        loading={busy}
        onConfirm={() => void disconnect()}
      />
    </Card>
  );
}

/** A new sign-in email: the password (when the account has one), then the code sent to the new address. */
function ChangeEmailDialog({ open, onOpenChange, hasPassword, onChanged }: { open: boolean; onOpenChange: (o: boolean) => void; hasPassword: boolean | undefined; onChanged: () => void }) {
  const start = useApp((s) => s.startEmailChange);
  const confirm = useApp((s) => s.confirmEmailChange);
  const [step, setStep] = React.useState<"form" | "code">("form");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<{ field: "email" | "password" | "code"; message: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const askPassword = hasPassword !== false;

  const close = (o: boolean) => {
    if (o) return onOpenChange(true);
    onOpenChange(false);
    setStep("form");
    setEmail("");
    setPassword("");
    setCode("");
    setError(null);
  };
  const send = async () => {
    const v = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setError({ field: "email", message: "Enter a valid email address." });
    if (askPassword && !password) return setError({ field: "password", message: "Enter your password." });
    setBusy(true);
    const r = await start(v, askPassword ? password : undefined);
    setBusy(false);
    if (!r.ok) return setError({ field: r.code === "wrong_password" || r.code === "password_required" ? "password" : "email", message: r.error });
    setError(null);
    setCode("");
    setStep("code");
  };
  const finish = async () => {
    if (!/^\d{6}$/.test(code)) return setError({ field: "code", message: "Enter the 6-digit code from the email." });
    setBusy(true);
    const r = await confirm(code);
    setBusy(false);
    if (!r.ok) {
      setCode("");
      return setError({ field: "code", message: r.error });
    }
    toast.success("Email changed", { description: `You now sign in with ${r.data.email}. We let your old address know.` });
    onChanged();
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        size="sm"
        title={step === "form" ? "Change your sign-in email" : "Check your new inbox"}
        description={step === "form" ? "We'll send a code to the new address to make sure it's yours." : `We sent a 6-digit code to ${email.trim()}. It expires in 15 minutes.`}
      >
        <DialogBody className="space-y-4">
          {step === "form" ? (
            <>
              <Field label="New email" error={error?.field === "email" ? error.message : undefined}>
                <Input type="email" autoComplete="email" value={email} onChange={(e) => (setEmail(e.target.value), setError(null))} />
              </Field>
              {askPassword && (
                <Field label="Your password" error={error?.field === "password" ? error.message : undefined}>
                  <PasswordInput autoComplete="current-password" value={password} onChange={(e) => (setPassword(e.target.value), setError(null))} />
                </Field>
              )}
            </>
          ) : (
            <>
              <Field label="6-digit code" error={error?.field === "code" ? error.message : undefined}>
                <Input
                  value={code}
                  onChange={(e) => (setCode(e.target.value.replace(/\D/g, "").slice(0, 6)), setError(null))}
                  onKeyDown={(e) => e.key === "Enter" && void finish()}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="font-mono tracking-[0.3em]"
                />
              </Field>
              <button type="button" className="text-[13px] font-medium text-ink underline underline-offset-4" disabled={busy} onClick={() => void send()}>
                Send a new code
              </button>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => (step === "code" ? (setStep("form"), setError(null)) : close(false))}>
            {step === "code" ? "Back" : "Cancel"}
          </Button>
          <Button variant="brand" loading={busy} onClick={() => void (step === "form" ? send() : finish())}>
            {step === "form" ? "Send code" : "Change email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SecurityTab({ me, methods }: { me: User; methods: MethodsState }) {
  const router = useRouter();
  const logout = useApp((s) => s.logout);
  const history = useApp((s) => s.loginHistory);
  const now = useNow(60_000);
  const [confirmAll, setConfirmAll] = React.useState(false);
  const socialNames = (methods.data?.social ?? []).map((m) => m.label);

  const signIns = React.useMemo(() => history.filter((h) => h.userId === me.id).slice(0, 10), [history, me.id]);

  const signOut = async (all: boolean) => {
    await logout(all);
    toast.success(all ? "Signed out of all sessions" : "Signed out");
    router.push("/login");
  };

  return (
    <div className="grid max-w-5xl items-start gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        {!methods.data && !methods.failed ? (
          // Until we know whether the account has a password (Google / Facebook / Apple accounts may not).
          <Card>
            <CardHeader title="Password" />
            <p className="px-5 pb-5 pt-3 text-[13px] text-muted">Loading…</p>
          </Card>
        ) : methods.data && !methods.data.hasPassword ? (
          <SetPasswordCard me={me} social={socialNames} onDone={methods.reload} />
        ) : (
          <ChangePasswordCard />
        )}
        <Card>
          <CardHeader title="Two-step login" description="A code from your phone each time you sign in, on top of your password." />
          <div className="p-5 pt-4">
            <TwoStepLogin on={!!me.mfaEnabled} codesLeft={me.mfaEnabled && methods.data?.mfa ? methods.data.recoveryCodesLeft : undefined} onChange={methods.reload} />
          </div>
        </Card>
        <SignInMethodsCard me={me} methods={methods} />
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader title="Recent sign-ins" description="The latest sign-in attempts on this account." />
          {signIns.length === 0 ? (
            <p className="px-5 pb-5 pt-3 text-[13px] text-muted">No sign-ins recorded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {signIns.map((h, i) => (
                <li key={`${h.at}-${i}`} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-canvas text-ink-2">
                    <Monitor className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-ink">
                      {h.device}
                      {i === 0 && h.success && <span className="font-normal text-muted"> · current session</span>}
                    </span>
                    <span className="block text-[12px] text-muted">
                      {formatDateTime(h.at, me.timezone)} · {formatRelative(h.at, now)}
                    </span>
                  </span>
                  {h.success ? (
                    <Badge tone="success" size="sm">
                      <CheckCircle2 /> Signed in
                    </Badge>
                  ) : (
                    <Badge tone="danger" size="sm">
                      <XCircle /> Failed
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Sessions" description="Sign out here, or on every browser and device where you're signed in." />
          <CardContent className="flex flex-col gap-2.5 sm:flex-row">
            <Button variant="secondary" onClick={() => void signOut(false)}>
              <LogOut /> Sign out
            </Button>
            <Button variant="danger-outline" onClick={() => setConfirmAll(true)}>
              <ShieldCheck /> Sign out of all sessions
            </Button>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Sign out everywhere?"
        description="You'll be signed out of every browser and device where you're signed in to TutorLink, including this one."
        confirmLabel="Sign out everywhere"
        tone="danger"
        onConfirm={() => {
          setConfirmAll(false);
          void signOut(true);
        }}
      />
    </div>
  );
}

/* ─── Privacy & data ────────────────────────────────────────────────────────── */

/** Collects only records that belong to this account (never credentials or other people's data). */
function exportMyData(me: User) {
  const s = useApp.getState();
  const uid = me.id;
  const childIds = s.children.filter((c) => c.parentId === uid).map((c) => c.id);
  const learnerIds = new Set([uid, ...childIds]);
  const myConversations = s.conversations.filter((c) => c.userId === uid || (!!me.tutorId && c.tutorId === me.tutorId));
  const convIds = new Set(myConversations.map((c) => c.id));
  const selfIds = new Set([uid, me.tutorId].filter(Boolean) as string[]);
  const myBookings = s.bookings.filter((b) => b.bookerId === uid || (!!me.tutorId && b.tutorId === me.tutorId));
  const myBookingIds = new Set(s.bookings.filter((b) => b.bookerId === uid).map((b) => b.id));
  return {
    format: "TutorLink personal data export",
    exportedAt: new Date().toISOString(),
    profile: me,
    children: s.children.filter((c) => c.parentId === uid),
    favorites: s.favorites[uid] ?? [],
    savedSearches: s.savedSearches.filter((x) => x.userId === uid),
    requirements: s.requirements.filter((r) => r.ownerId === uid),
    bookings: myBookings,
    payments: s.payments.filter((p) => p.userId === uid),
    reviewsWritten: s.reviews.filter((r) => myBookingIds.has(r.bookingId)),
    conversations: myConversations,
    messagesSent: s.messages.filter((m) => convIds.has(m.conversationId) && selfIds.has(m.senderId)),
    notifications: s.notifications.filter((n) => n.userId === uid),
    notificationPreferences: s.notificationPrefs[uid] ?? DEFAULT_NOTIFICATION_PREFS,
    learningGoals: s.goals.filter((g) => learnerIds.has(g.learnerId)),
    progressNotes: s.progressNotes.filter((n) => learnerIds.has(n.learnerId)),
    homework: s.homework.filter((h) => learnerIds.has(h.learnerId)),
    signInHistory: s.loginHistory.filter((h) => h.userId === uid),
    ...(me.tutorId
      ? {
          tutorProfile: resolveTutor(s, me.tutorId) ?? null,
          applications: s.applications.filter((a) => a.tutorId === me.tutorId),
          payouts: s.payouts.filter((p) => p.tutorId === me.tutorId),
          leadCredits: s.leadTransactions.filter((t) => t.tutorId === me.tutorId),
          subscription: s.subscriptions[me.tutorId] ?? null,
          verificationRequests: s.verificationRequests
            .filter((v) => v.tutorId === me.tutorId)
            .map((v) => ({ id: v.id, kind: v.kind, status: v.status, documents: v.documents, submittedAt: v.submittedAt, reviewedAt: v.reviewedAt, note: v.note, expiresAt: v.expiresAt })),
        }
      : {}),
  };
}

function PrivacyTab({ me }: { me: User }) {
  const router = useRouter();
  const deleteMyAccount = useApp((s) => s.deleteMyAccount);
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const download = () => {
    try {
      const data = exportMyData(me);
      downloadJson(`tutorlink-data-${me.firstName.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`, data);
      toast.success("Your data export is downloading");
    } catch {
      toast.error("We couldn't prepare your export. Please try again.");
    }
  };

  const confirmDelete = async () => {
    const res = await deleteMyAccount();
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    toast.success("Your account was deleted");
    router.push("/");
  };

  return (
    <div className="max-w-3xl space-y-5">
      <Card>
        <CardHeader title="Download your data" description="A JSON file with your profile, lessons, messages you sent, payments, reviews and settings." />
        <CardContent className="pt-4">
          <p className="text-[13px] leading-relaxed text-muted">
            The export includes only records that belong to your account{me.role === "parent" ? " and your children's profiles" : ""}. Other people&apos;s messages and personal details aren&apos;t included.
          </p>
        </CardContent>
        <CardFooter className="justify-end">
          <Button variant="secondary" onClick={download}>
            <Download /> Download my data
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-danger-200">
        <CardHeader title={<span className="text-danger">Delete account</span>} description="Permanently delete your TutorLink account." />
        <CardContent className="pt-4">
          <ul className="space-y-1.5 text-[13px] leading-relaxed text-ink-2">
            <li className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-muted" aria-hidden />
              You&apos;ll be signed out and won&apos;t be able to sign in again with {me.email}.
            </li>
            <li className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-muted" aria-hidden />
              Upcoming lessons must be cancelled first.
            </li>
            <li className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-muted" aria-hidden />
              Payment records are kept for accounting, as required by law.
            </li>
          </ul>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            variant="danger"
            onClick={() => {
              setTyped("");
              setError(null);
              setOpen(true);
            }}
          >
            <Trash2 /> Delete my account
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm" title="Delete your account?" description="This can't be undone.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (typed === "DELETE") confirmDelete();
            }}
          >
            <DialogBody className="space-y-4">
              <AnimatePresence initial={false}>
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <InlineAlert tone="danger" title="We couldn't delete your account">
                      {error}
                    </InlineAlert>
                  </motion.div>
                )}
              </AnimatePresence>
              <p className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                You&apos;ll lose access to your lessons, messages, saved tutors and searches.
              </p>
              <Field label={<>Type <span className="font-mono">DELETE</span> to confirm</>}>
                <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={typed !== "DELETE"}>
                Delete account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
