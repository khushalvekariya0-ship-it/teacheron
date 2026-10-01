"use client";

import * as React from "react";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, CircleCheck, Coins, Inbox, Send, ShieldCheck } from "lucide-react";
import type { Application, Requirement, Tutor } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useCreditBalance, useFlag } from "@/lib/store/hooks";
import { CREDITS_PER_APPLICATION } from "@/lib/data/platform";
import { formatCents, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { motion, AnimatePresence, EASE } from "@/components/motion";
import { cn } from "@/lib/utils";
import { APPLICATION_STATUS_META, budgetRange, postedAgo } from "./jobUtils";

const MIN_MESSAGE = 40;
const MAX_MESSAGE = 2000;

const applySchema = z.object({
  message: z
    .string()
    .trim()
    .min(MIN_MESSAGE, `Write at least ${MIN_MESSAGE} characters so the family knows why you're a good fit.`)
    .max(MAX_MESSAGE, `Keep your message under ${MAX_MESSAGE.toLocaleString("en-US")} characters.`),
  rate: z
    .number({ invalid_type_error: "Enter your hourly rate in dollars.", required_error: "Enter your hourly rate in dollars." })
    .int("Use a whole-dollar rate.")
    .min(10, "Rates start at $10/hr.")
    .max(500, "Rates can't be more than $500/hr."),
});
type ApplyValues = z.infer<typeof applySchema>;

export function PanelShell({ title, description, children, icon, className }: { title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-surface p-5 sm:p-6", className)}>
      <div className="flex items-start gap-3">
        {icon && <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-canvas text-ink [&_svg]:size-[18px]">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold text-ink">{title}</h2>
          {description && <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{description}</p>}
        </div>
      </div>
      {children && <div className="mt-5">{children}</div>}
    </section>
  );
}

function ExistingApplication({ app, now, justSent, creditsLeft }: { app: Application; now: number; justSent: boolean; creditsLeft: number | null }) {
  const meta = APPLICATION_STATUS_META[app.status];
  return (
    <motion.section
      initial={justSent ? { opacity: 0, y: 10, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="rounded-2xl border border-line bg-surface p-5 sm:p-6"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <motion.span
          initial={justSent ? { scale: 0.4, rotate: -20 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", bounce: 0.5, duration: 0.6, delay: 0.1 }}
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-success-50 text-success"
        >
          <CircleCheck className="size-5" aria-hidden />
        </motion.span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold text-ink">{justSent ? "Application sent" : "You've applied to this job"}</h2>
          <p className="mt-1 text-[13.5px] text-muted">
            {justSent ? "The family has been notified. You'll get a notification when they respond." : <>Sent <time dateTime={app.createdAt} title={formatDate(app.createdAt)}>{postedAgo(app.createdAt, now)}</time>.</>}
          </p>
        </div>
      </div>
      <dl className="mt-5 divide-y divide-line rounded-xl border border-line text-sm">
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
          <dt className="text-muted">Status</dt>
          <dd><Badge tone={meta.tone}>{meta.label}</Badge></dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
          <dt className="text-muted">Your proposed rate</dt>
          <dd className="font-medium tabular-nums text-ink">{formatCents(app.proposedRateCents)}/hr</dd>
        </div>
        {creditsLeft !== null && justSent && (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <dt className="text-muted">Lead credits left</dt>
            <dd className="font-medium tabular-nums text-ink">{creditsLeft}</dd>
          </div>
        )}
      </dl>
      <p className="mt-4 line-clamp-4 whitespace-pre-line rounded-lg bg-canvas px-3.5 py-3 text-[13.5px] leading-relaxed text-ink-2">{app.message}</p>
      <Button asChild variant="secondary" className="mt-5 w-full">
        <Link href="/dashboard/applications">
          <Inbox /> View my applications
        </Link>
      </Button>
    </motion.section>
  );
}

/** Apply form for signed-in tutors, plus the already-applied and out-of-credit states. */
export function ApplyPanel({ job, tutor, existing, now }: { job: Requirement; tutor: Tutor; existing?: Application; now: number }) {
  const applyToJob = useApp((s) => s.applyToJob);
  const leadCredits = useFlag("lead_credits");
  const balance = useCreditBalance(tutor.id);
  const [justSent, setJustSent] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ApplyValues>({
    resolver: zodResolver(applySchema),
    mode: "onTouched",
    defaultValues: { message: "", rate: Math.round(tutor.hourlyRateCents / 100) },
  });
  const message = useWatch({ control, name: "message" }) ?? "";
  const rate = useWatch({ control, name: "rate" });

  if (existing) return <ExistingApplication app={existing} now={now} justSent={justSent} creditsLeft={leadCredits ? balance : null} />;

  if (job.status !== "published") {
    return (
      <PanelShell icon={<Inbox />} title="Applications are closed" description={job.status === "paused" ? "The family has paused this requirement. Save it and check back later." : "The family is no longer accepting applications for this requirement."}>
        <Button asChild variant="secondary" className="w-full">
          <Link href="/tutor-jobs">Browse open jobs</Link>
        </Button>
      </PanelShell>
    );
  }

  const outOfCredits = leadCredits && balance < CREDITS_PER_APPLICATION;
  const len = message.trim().length;
  const overBudget = typeof rate === "number" && !Number.isNaN(rate) && rate * 100 > job.budgetMaxCents;

  const onSubmit = (v: ApplyValues) => {
    setServerError(null);
    const r = applyToJob(job.id, v.message, Math.round(v.rate * 100));
    if (!r.ok) {
      setServerError(r.error);
      toast.error(r.error);
      return;
    }
    setJustSent(true);
    toast.success("Application sent", { description: job.title });
  };

  return (
    <section id="apply-form" className="rounded-2xl border border-line bg-surface" aria-labelledby="apply-title">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <h2 id="apply-title" className="font-heading text-xl font-bold tracking-[-0.03em] text-ink">Apply to this job</h2>
        <p className="mt-0.5 text-[13.5px] text-muted">The family sees your profile, message and proposed rate.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5 px-5 py-5 sm:px-6">
        <Field
          label="Message to the family"
          id="apply-message"
          required
          error={errors.message?.message}
          hint={len < MIN_MESSAGE ? `${MIN_MESSAGE - len} more ${MIN_MESSAGE - len === 1 ? "character" : "characters"} needed` : "Mention relevant experience and how you'd approach their goals."}
        >
          <Controller
            control={control}
            name="message"
            render={({ field }) => (
              <Textarea
                id="apply-message"
                rows={6}
                maxLength={MAX_MESSAGE}
                showCount
                placeholder="Introduce yourself, mention relevant experience, and suggest how you'd structure the first few sessions."
                {...field}
              />
            )}
          />
        </Field>

        <Field
          label="Your proposed hourly rate"
          id="apply-rate"
          required
          error={errors.rate?.message}
          hint={overBudget ? `Above the family's budget of ${budgetRange(job)} — say why in your message.` : `Family's budget: ${budgetRange(job)}. Your profile rate is ${formatCents(tutor.hourlyRateCents)}/hr.`}
        >
          <Input id="apply-rate" type="number" inputMode="numeric" min={10} max={500} step={1} prefixText="$" suffix={<span className="pr-1 text-[13px]">/hr</span>} {...register("rate", { valueAsNumber: true })} />
        </Field>

        {leadCredits && (
          <div className={cn("flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-sm", outOfCredits ? "border-warning-200 bg-warning-50" : "border-transparent bg-canvas")}>
            <span className="flex items-center gap-2 text-ink-2">
              <Coins className="size-4 text-muted" aria-hidden />
              Applying uses <span className="font-semibold text-ink">{CREDITS_PER_APPLICATION} lead credit</span>
            </span>
            <span className="text-[13px] tabular-nums text-muted">
              Balance: <span className={cn("font-semibold", outOfCredits ? "text-warning" : "text-ink")}>{balance}</span>
            </span>
          </div>
        )}

        <AnimatePresence initial={false}>
          {outOfCredits && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <InlineAlert tone="warning" title="You're out of lead credits">
                Buy a credit pack or upgrade your plan to apply.{" "}
                <Link href="/dashboard/credits" className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
                  Get lead credits
                </Link>
              </InlineAlert>
            </motion.div>
          )}
          {serverError && !outOfCredits && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <InlineAlert tone="danger">{serverError}</InlineAlert>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-muted">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ink" aria-hidden />
          Phone numbers, emails and social handles in your message are hidden automatically. Share contact details only through TutorLink messages.
        </p>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} disabled={outOfCredits}>
          <Send /> Send application
        </Button>
      </form>
    </section>
  );
}

/** Sign-in / role explanations for everyone who can't apply. */
export function ApplyGate({ kind, jobId, applicants }: { kind: "guest" | "owner" | "family" | "staff" | "no-profile"; jobId: string; applicants: number }) {
  if (kind === "guest") {
    return (
      <PanelShell icon={<Send />} title="Interested in this job?" description="Sign in with your tutor account to apply, or create a free tutor profile — it takes a few minutes.">
        <div className="flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link href={`/login?next=${encodeURIComponent(`/tutor-jobs/${jobId}`)}`}>Sign in to apply</Link>
          </Button>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/become-a-tutor">Become a tutor <ArrowRight /></Link>
          </Button>
        </div>
      </PanelShell>
    );
  }
  if (kind === "owner") {
    return (
      <PanelShell icon={<Inbox />} title="This is your requirement" description={applicants === 0 ? "No tutors have applied yet. You'll be notified when someone does." : `${applicants} ${applicants === 1 ? "tutor has" : "tutors have"} applied. Review, shortlist and message them from your dashboard.`}>
        <div className="flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link href={`/dashboard/requirements/${jobId}`}>Manage requirement <ArrowRight /></Link>
          </Button>
          <Button asChild variant="secondary" className="w-full">
            <Link href={`/post-requirement?id=${jobId}`}>Edit details</Link>
          </Button>
        </div>
      </PanelShell>
    );
  }
  if (kind === "family") {
    return (
      <PanelShell icon={<Inbox />} title="Only tutors can apply" description="You're signed in with a family account. Post your own requirement and tutors will come to you — or browse tutor profiles directly.">
        <div className="flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link href="/post-requirement">Post a requirement</Link>
          </Button>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/tutors">Browse tutors</Link>
          </Button>
        </div>
      </PanelShell>
    );
  }
  if (kind === "no-profile") {
    return (
      <PanelShell icon={<Send />} title="Finish your tutor profile to apply" description="Families decide based on your profile, so it needs to be complete before you can send applications.">
        <Button asChild className="w-full">
          <Link href="/become-a-tutor">Complete your profile <ArrowRight /></Link>
        </Button>
      </PanelShell>
    );
  }
  return (
    <PanelShell icon={<ShieldCheck />} title="Staff view" description="Staff accounts can't apply to jobs. Moderate requirements from the admin console.">
      <Button asChild variant="secondary" className="w-full">
        <Link href="/admin/requirements">Open admin requirements</Link>
      </Button>
    </PanelShell>
  );
}
