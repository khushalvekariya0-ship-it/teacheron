"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle, BadgeCheck, Clock, Download, Globe2, KeyRound, LogOut, MapPin, Monitor, Phone, ShieldCheck, Trash2, UserRound, XCircle, CheckCircle2,
} from "lucide-react";
import type { User } from "@/lib/types";
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
import { DEFAULT_NOTIFICATION_PREFS, DEMO_PASSWORD, useApp } from "@/lib/store";
import { useNow, useSession } from "@/lib/store/hooks";
import { resolveTutor } from "@/lib/store";
import { DEMO_USERS, ROLE_LABEL } from "@/lib/data/users";
import { US_STATES, US_TIMEZONES } from "@/lib/data/catalog";
import { formatDate, formatDateTime, formatRelative, formatUsPhone, tzAbbrev } from "@/lib/format";
import { PasswordInput, PasswordStrengthMeter } from "@/components/auth/PasswordField";
import { downloadJson } from "./hooks";

type TabKey = "profile" | "timezone" | "security" | "privacy";

export function SettingsView() {
  const me = useSession();
  const [tab, setTab] = React.useState<TabKey>("profile");
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
          <ProfileTab me={me} />
        </TabsContent>
        <TabsContent value="timezone">
          <TimezoneTab me={me} />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab me={me} />
        </TabsContent>
        <TabsContent value="privacy">
          <PrivacyTab me={me} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Profile ───────────────────────────────────────────────────────────────── */

const phoneDigits = (v: string) => v.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name").max(50, "Keep it under 50 characters"),
  lastName: z.string().trim().min(1, "Enter your last name").max(50, "Keep it under 50 characters"),
  phone: z.string().trim().refine((v) => v === "" || phoneDigits(v).length === 10, "Enter a 10-digit US phone number"),
  city: z.string().trim().max(60, "Keep it under 60 characters"),
  state: z.string(),
  zip: z.string().trim().refine((v) => v === "" || /^\d{5}$/.test(v), "Enter a 5-digit ZIP code"),
});
type ProfileValues = z.infer<typeof profileSchema>;

function profileDefaults(me: User): ProfileValues {
  return { firstName: me.firstName, lastName: me.lastName, phone: me.phone ?? "", city: me.city ?? "", state: me.state ?? "", zip: me.zip ?? "" };
}

function ProfileTab({ me }: { me: User }) {
  const updateMe = useApp((s) => s.updateMe);
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), mode: "onTouched", defaultValues: profileDefaults(me) });
  const { errors, isDirty, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit((v) => {
    const res = updateMe({
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      phone: v.phone ? formatUsPhone(v.phone) : undefined,
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
                    <BadgeCheck className="size-3.5 text-ink" aria-hidden /> Verified. Contact support to change your sign-in email.
                  </>
                ) : (
                  "Not verified yet — check your inbox for the verification link."
                )}
              </span>
            }
          >
            <Input value={me.email} readOnly disabled />
          </Field>
          <Controller
            control={form.control}
            name="phone"
            render={({ field }) => (
              <Field label="Mobile phone" optional error={errors.phone?.message} hint="Used for lesson reminders by text when SMS is available.">
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  icon={<Phone />}
                  placeholder="(555) 555-0123"
                  className="sm:max-w-64"
                  {...field}
                  onChange={(e) => field.onChange(formatUsPhone(e.target.value))}
                />
              </Field>
            )}
          />
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
            <Field label="City" optional error={errors.city?.message}>
              <Input autoComplete="address-level2" icon={<MapPin />} {...form.register("city")} />
            </Field>
            <Field label="State" optional error={errors.state?.message}>
              <Select placeholder="Select" options={US_STATES} autoComplete="address-level1" {...form.register("state")} />
            </Field>
            <Field label="ZIP code" optional error={errors.zip?.message}>
              <Input inputMode="numeric" maxLength={5} autoComplete="postal-code" {...form.register("zip")} />
            </Field>
          </div>
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
  const [tz, setTz] = React.useState(me.timezone);
  const [browserTz] = React.useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return "";
    }
  });
  const options = React.useMemo(() => {
    const list = [...US_TIMEZONES];
    for (const extra of [me.timezone, browserTz]) if (extra && !list.some((o) => o.value === extra)) list.push({ value: extra, label: extra.replace(/_/g, " ") });
    return list;
  }, [me.timezone, browserTz]);
  const at = new Date(now);
  const label = options.find((o) => o.value === tz)?.label ?? tz;
  const dirty = tz !== me.timezone;

  const save = () => {
    const res = updateMe({ timezone: tz });
    if (!res.ok) return void toast.error(res.error);
    toast.success("Time zone updated", { description: `Times now show in ${label}.` });
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader title="Time zone" description="Lesson times, reminders, calendars and receipts are shown in this time zone." />
      <CardContent className="space-y-5">
        <Field label="Your time zone">
          <Select value={tz} onChange={(e) => setTz(e.target.value)} options={options} className="sm:max-w-sm" />
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
        <Button variant="ghost" disabled={!dirty} onClick={() => setTz(me.timezone)}>
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

function SecurityTab({ me }: { me: User }) {
  const router = useRouter();
  const changePassword = useApp((s) => s.changePassword);
  const logout = useApp((s) => s.logout);
  const history = useApp((s) => s.loginHistory);
  const hasCustomPassword = useApp((s) => !!s.credentials[me.email.toLowerCase()]);
  const now = useNow(60_000);
  const [confirmAll, setConfirmAll] = React.useState(false);
  const isDemo = DEMO_USERS.some((u) => u.id === me.id);

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
    toast.success("Password changed", { description: "Use your new password next time you sign in." });
    form.reset();
  });

  const signIns = React.useMemo(() => history.filter((h) => h.userId === me.id).slice(0, 10), [history, me.id]);

  const signOut = (all: boolean) => {
    logout();
    toast.success(all ? "Signed out of all sessions" : "Signed out");
    router.push("/login");
  };

  return (
    <div className="grid max-w-5xl items-start gap-5 lg:grid-cols-2">
      <Card>
        <form onSubmit={onSubmit} noValidate>
          <CardHeader title="Change password" description="Use at least 10 characters. A short phrase is easy to remember and hard to guess." />
          <CardContent className="space-y-4">
            {isDemo && !hasCustomPassword && (
              <InlineAlert tone="info">
                Demo account — the current password is <code className="font-mono text-[12.5px] text-ink">{DEMO_PASSWORD}</code>.
              </InlineAlert>
            )}
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

      <div className="space-y-5">
        <Card>
          <CardHeader title="Recent sign-ins" description="Sign-in attempts on this account from this browser." />
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
          <CardHeader title="Sessions" description="In this preview, your session exists only in this browser." />
          <CardContent className="flex flex-col gap-2.5 sm:flex-row">
            <Button variant="secondary" onClick={() => signOut(false)}>
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
          signOut(true);
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
    note: "Preview build — contains sample data stored in this browser.",
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

  const confirmDelete = () => {
    const res = deleteMyAccount();
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
