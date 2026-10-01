"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BadgeCheck, Bell, CalendarClock, Check, CircleCheck, Circle, ClipboardCheck, Clock, CreditCard, Eye, FileText, Globe, Lock,
  MapPin, NotebookPen, Plus, Search, ShieldCheck, Sparkles, Star, Wallet,
} from "lucide-react";
import type { VerificationKind, VerificationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EASE } from "@/components/motion";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Controls";
import { VERIFICATION_LABEL, VerificationStatusBadge } from "@/components/domain/Badges";
import { TUTORS, TUTOR_BY_SLUG, tutorShortName } from "@/lib/data/tutors";
import { SEED_REQUIREMENTS } from "@/lib/data/requirements";
import { subjectName, GRADE_LABEL } from "@/lib/data/catalog";
import { DEFAULT_POLICY } from "@/lib/data/platform";
import { rankTutors } from "@/lib/matching";
import { policySummary } from "@/lib/booking";
import { applyBps, formatCents, sessionPrice } from "@/lib/format";

/*
 * Product-UI vignettes for marketing pages. They are built from the same components and sample
 * data as the product itself (no stock imagery), and every figure is derived from src/lib/data.
 */

const inView = { once: true, amount: 0.4 } as const;

const FRAME_TONE = {
  canvas: "bg-canvas",
  brand: "bg-brand-soft",
  sky: "bg-sky-soft",
  yellow: "bg-yellow-soft",
  teal: "bg-teal-soft",
  violet: "bg-violet-soft",
  peach: "bg-peach-soft",
} as const;

export function VignetteFrame({
  children,
  className,
  tone = "canvas",
  label,
}: {
  children: React.ReactNode;
  className?: string;
  /** Flat pastel fill behind the product UI. */
  tone?: keyof typeof FRAME_TONE;
  /** When set, the vignette is exposed to assistive tech as a single labelled illustration. */
  label?: string;
}) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl p-4 sm:p-6", FRAME_TONE[tone], className)}
      {...(label ? { role: "img", "aria-label": label } : {})}
    >
      <div className="relative">{children}</div>
    </div>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl bg-surface", className)}>{children}</div>;
}

function PanelHeader({ title, meta }: { title: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
      <p className="truncate text-[13px] font-bold text-ink">{title}</p>
      {meta && <div className="shrink-0 text-[11.5px] text-muted">{meta}</div>}
    </div>
  );
}

/* ─── Search & match ─────────────────────────────────────────────────────── */

export function SearchVignette() {
  const results = React.useMemo(() => rankTutors(TUTORS, { subject: "algebra", grade: "8", modes: ["online"], budgetMaxCents: 8000, days: ["Mon", "Tue", "Wed", "Thu", "Fri"], timesOfDay: ["evening"] }).filter((r) => !r.disqualified).slice(0, 3), []);
  return (
    <VignetteFrame tone="sky" label="Search results for algebra tutors for an 8th grader, online, with match scores">
      <Panel>
        <div className="border-b border-line p-3">
          <div className="flex items-center gap-2 rounded-md border border-line-strong px-3 py-2 text-[12.5px] text-ink-2">
            <Search className="size-3.5 text-muted" /> Algebra
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["8th grade", "Online", "Weekday evenings", "Up to $80/hr"].map((c) => (
              <span key={c} className="rounded-md bg-ink px-2 py-0.5 text-[11px] font-semibold text-on-ink">{c}</span>
            ))}
          </div>
        </div>
        <ul className="divide-y divide-line">
          {results.map((r, i) => (
            <motion.li
              key={r.tutor.id}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inView}
              transition={{ duration: 0.5, ease: EASE, delay: 0.15 + i * 0.1 }}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <Avatar name={`${r.tutor.firstName} ${r.tutor.lastName}`} tone={r.tutor.tone} size="sm" verified={r.tutor.verification.identity === "verified"} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-ink">{tutorShortName(r.tutor)}</p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-sunken">
                  <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} whileInView={{ width: `${r.percent}%` }} viewport={inView} transition={{ duration: 0.9, ease: EASE, delay: 0.3 + i * 0.1 }} />
                </div>
              </div>
              <span className="text-[12px] font-bold tabular-nums text-ink">{r.percent}%</span>
            </motion.li>
          ))}
        </ul>
      </Panel>
    </VignetteFrame>
  );
}

/* ─── Messaging ──────────────────────────────────────────────────────────── */

export function MessageVignette({ variant = "masked" }: { variant?: "masked" | "parent" }) {
  const tutor = TUTOR_BY_SLUG["hannah-weiss"] ?? TUTORS[0];
  return (
    <VignetteFrame tone="violet" label={variant === "parent" ? "A conversation about a child, visible in the parent's account" : "A message thread where a phone number has been automatically hidden"}>
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              <Avatar name={`${tutor.firstName} ${tutor.lastName}`} tone={tutor.tone} size="xs" /> {tutorShortName(tutor)}
            </span>
          }
          meta={<span className="inline-flex items-center gap-1"><Lock className="size-3" /> On-platform</span>}
        />
        {variant === "parent" && (
          <div className="flex items-center gap-2 border-b border-line bg-brand-soft px-4 py-2 text-[11.5px] font-medium text-ink">
            <Eye className="size-3.5" /> About Noah · 7th grade — visible in your parent account
          </div>
        )}
        <div className="space-y-2 p-4">
          <motion.div initial={{ opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }} viewport={inView} transition={{ delay: 0.15 }} className="w-[85%] rounded-lg rounded-bl-sm bg-sunken px-3 py-2 text-[12px] leading-snug text-ink-2">
            Happy to help with reading comprehension. Would a short trial on Thursday work?
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 6 }} whileInView={{ opacity: 1, x: 0 }} viewport={inView} transition={{ delay: 0.4 }} className="ml-auto w-[85%] rounded-lg rounded-br-sm bg-ink px-3 py-2 text-[12px] leading-snug text-on-ink">
            Thursday works. You can also text me at{" "}
            <span className="rounded bg-on-ink/15 px-1.5 py-0.5 font-medium">[phone hidden]</span>
          </motion.div>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={inView} transition={{ delay: 0.75 }} className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-muted">
            <ShieldCheck className="size-3 text-ink" /> Phone numbers and emails are hidden automatically
          </motion.p>
        </div>
      </Panel>
    </VignetteFrame>
  );
}

/* ─── Scheduling ─────────────────────────────────────────────────────────── */

export function SlotVignette() {
  const slots = ["3:30", "4:00", "4:30", "5:00", "5:30", "6:00", "6:30", "7:00"];
  return (
    <VignetteFrame tone="yellow" label="Choosing an open lesson time, shown in your own time zone">
      <Panel>
        <PanelHeader title="Thursday, Oct 8" meta={<span className="inline-flex items-center gap-1"><Globe className="size-3" /> Central Time</span>} />
        <div className="grid grid-cols-4 gap-1.5 p-4">
          {slots.map((t, i) => (
            <motion.span
              key={t}
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={inView}
              transition={{ delay: 0.08 + i * 0.04, duration: 0.4, ease: EASE }}
              className={cn(
                "rounded-md border py-1.5 text-center text-[11.5px] tabular-nums",
                i === 4 ? "border-ink bg-ink font-semibold text-on-ink" : i === 1 || i === 6 ? "border-dashed border-line text-subtle line-through" : "border-line text-ink-2",
              )}
            >
              {t} PM
            </motion.span>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[11.5px] text-muted">
          <span>60 min · Online</span>
          <span className="font-semibold text-ink">5:30 – 6:30 PM CT</span>
        </div>
      </Panel>
    </VignetteFrame>
  );
}

export function CalendarVignette() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const blocks: Record<string, [number, number][]> = { Mon: [[55, 30]], Tue: [[20, 22], [55, 30]], Wed: [[55, 30]], Thu: [[55, 30]], Fri: [] };
  return (
    <VignetteFrame tone="teal" label="A tutor's weekly availability with buffers and minimum notice">
      <Panel>
        <PanelHeader title="Weekly availability" meta="Your time zone" />
        <div className="grid grid-cols-5 gap-2 p-4">
          {days.map((d, di) => (
            <div key={d}>
              <p className="mb-1.5 text-center text-[11px] font-medium text-muted">{d}</p>
              <div className="relative h-28 rounded-md border border-line bg-canvas">
                {blocks[d].map(([top, h], bi) => (
                  <motion.span
                    key={bi}
                    className="absolute inset-x-1 origin-top rounded-sm bg-brand"
                    style={{ top: `${top}%`, height: `${h}%` }}
                    initial={{ scaleY: 0, opacity: 0 }}
                    whileInView={{ scaleY: 1, opacity: 1 }}
                    viewport={inView}
                    transition={{ duration: 0.5, ease: EASE, delay: 0.1 + di * 0.07 + bi * 0.05 }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-2.5 text-[11px] text-ink-2">
          <span className="rounded-md bg-canvas px-2 py-0.5 font-medium">15-min buffer</span>
          <span className="rounded-md bg-canvas px-2 py-0.5 font-medium">12 hrs notice</span>
          <span className="rounded-md bg-canvas px-2 py-0.5 font-medium">60 or 90 min</span>
        </div>
      </Panel>
    </VignetteFrame>
  );
}

/* ─── Booking & payment ──────────────────────────────────────────────────── */

export function CheckoutVignette() {
  const tutor = TUTOR_BY_SLUG["james-okafor"] ?? TUTORS[0];
  const price = sessionPrice(tutor.hourlyRateCents, 60);
  const lines = policySummary("regular").slice(0, 3);
  return (
    <VignetteFrame tone="brand" label={`Checkout summary for a 60-minute lesson at ${formatCents(price)}, with the cancellation policy shown before payment`}>
      <Panel>
        <PanelHeader title="Review and pay" meta={<span className="inline-flex items-center gap-1"><Lock className="size-3" /> Stripe</span>} />
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Avatar name={`${tutor.firstName} ${tutor.lastName}`} tone={tutor.tone} size="sm" verified={tutor.verification.identity === "verified"} />
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-ink">Writing · 60 min with {tutorShortName(tutor)}</p>
              <p className="text-[11.5px] text-muted">Online · Tue, Oct 6 · 4:00 PM CT</p>
            </div>
          </div>
          <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-[12px]">
            <div className="flex justify-between"><dt className="text-muted">{formatCents(tutor.hourlyRateCents)}/hr × 60 min</dt><dd className="tabular-nums text-ink">{formatCents(price, { exact: true })}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Booking fee</dt><dd className="tabular-nums text-ink">{formatCents(0, { exact: true })}</dd></div>
            <div className="flex justify-between border-t border-line pt-1.5 font-semibold"><dt className="text-ink">Total</dt><dd className="tabular-nums text-ink">{formatCents(price, { exact: true })}</dd></div>
          </dl>
          <ul className="mt-3 space-y-1 rounded-lg bg-canvas p-3">
            {lines.map((l, i) => (
              <motion.li key={l} initial={{ opacity: 0, x: -4 }} whileInView={{ opacity: 1, x: 0 }} viewport={inView} transition={{ delay: 0.2 + i * 0.1 }} className="flex gap-1.5 text-[11.5px] leading-snug text-ink-2">
                <Check className="mt-0.5 size-3 shrink-0 text-ink" strokeWidth={2.6} /> {l}
              </motion.li>
            ))}
          </ul>
          <div className="mt-3 flex h-8 items-center justify-center gap-1.5 rounded-md border-2 border-brand bg-brand text-[12px] font-semibold text-white">
            <CreditCard className="size-3.5" /> Request lesson
          </div>
          <p className="mt-2 text-center text-[10.5px] text-muted">Your card is charged when the tutor confirms.</p>
        </div>
      </Panel>
    </VignetteFrame>
  );
}

export function TrialVignette() {
  const tutor = TUTOR_BY_SLUG["sarah-chen"] ?? TUTORS[0];
  return (
    <VignetteFrame tone="yellow" label="A tutor's trial lesson terms, shown on their profile before booking">
      <Panel className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={`${tutor.firstName} ${tutor.lastName}`} tone={tutor.tone} size="md" verified={tutor.verification.identity === "verified"} />
            <div>
              <p className="text-[13px] font-bold text-ink">{tutorShortName(tutor)}</p>
              <p className="text-[11.5px] text-muted">{tutor.headline}</p>
            </div>
          </div>
          <Badge tone="accent" size="sm">
            <Sparkles /> {tutor.trial.priceCents === 0 ? "Free" : formatCents(tutor.trial.priceCents)} trial
          </Badge>
        </div>
        <div className="mt-4 rounded-lg bg-canvas p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink"><Clock className="size-3.5 text-ink" /> {tutor.trial.durationMin}-minute trial lesson</p>
          {tutor.trial.notes && <p className="mt-1 text-[11.5px] leading-snug text-muted">{tutor.trial.notes}</p>}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-ink-2">
          <Check className="size-3.5 text-ink" strokeWidth={2.6} /> Free cancellation up to {DEFAULT_POLICY.trialFreeCancellationHours} hours before
        </p>
        <div className="mt-3 flex h-8 items-center justify-center rounded-md border-2 border-brand bg-brand text-[12px] font-semibold text-white">Book trial</div>
      </Panel>
    </VignetteFrame>
  );
}

/* ─── Progress & family ─────────────────────────────────────────────────── */

export function ProgressVignette() {
  return (
    <VignetteFrame tone="sky" label="Lesson notes, homework status and progress toward a learning goal">
      <Panel>
        <PanelHeader title="Pre-algebra · Noah" meta="Updated after each lesson" />
        <div className="space-y-3 p-4">
          <div className="rounded-lg border border-line p-3">
            <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted"><NotebookPen className="size-3.5 text-ink" /> Lesson note · Oct 1</p>
            <p className="mt-1 text-[12px] leading-snug text-ink-2">Worked through ratios and unit rates. Confident with tables; next step is word problems.</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-line p-3">
            <p className="flex items-center gap-1.5 text-[12px] text-ink-2"><FileText className="size-3.5 text-ink" /> Integer practice set</p>
            <Badge tone="success" size="sm"><Check /> Submitted</Badge>
          </div>
          <div className="rounded-lg border border-line p-3">
            <div className="flex justify-between text-[11.5px] text-muted">
              <span>Goal: B or higher this semester</span>
              <span className="tabular-nums">3 of 5 topics</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken">
              <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} whileInView={{ width: "60%" }} viewport={inView} transition={{ duration: 1, ease: EASE, delay: 0.2 }} />
            </div>
          </div>
          <div className="flex items-center justify-between text-[11.5px] text-muted">
            <span className="inline-flex items-center gap-1.5"><ClipboardCheck className="size-3.5 text-ink" /> Attendance</span>
            <span className="tabular-nums text-ink-2">5 of 6 lessons attended</span>
          </div>
        </div>
      </Panel>
    </VignetteFrame>
  );
}

export function FamilyVignette() {
  const children = [
    { name: "Noah", grade: GRADE_LABEL["7"], subject: "Pre-algebra", tutor: "Aisha R.", next: "Thu · 4:30 PM", tone: 0 },
    { name: "Ava", grade: GRADE_LABEL["4"], subject: "Spanish", tutor: "Elena M.", next: "Sat · 10:00 AM", tone: 4 },
  ];
  return (
    <VignetteFrame tone="teal" label="A parent account with two child profiles and their upcoming lessons">
      <Panel>
        <PanelHeader title="Your family" meta="2 child profiles" />
        <ul className="divide-y divide-line">
          {children.map((c, i) => (
            <motion.li key={c.name} initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={inView} transition={{ delay: 0.1 + i * 0.12, duration: 0.5, ease: EASE }} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={`${c.name} W`} tone={c.tone} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-ink">{c.name} <span className="font-normal text-muted">· {c.grade}</span></p>
                <p className="truncate text-[11.5px] text-muted">{c.subject} with {c.tutor}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md bg-canvas px-2 py-0.5 text-[11px] font-medium text-ink-2">
                <CalendarClock className="size-3 text-ink" /> {c.next}
              </span>
            </motion.li>
          ))}
        </ul>
        <div className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-[12px] font-semibold text-ink underline decoration-[1.5px] underline-offset-4">
          <Plus className="size-3.5" /> Add a child profile
        </div>
      </Panel>
    </VignetteFrame>
  );
}

/** Interactive: real switches, so visitors can feel the controls. Nothing is saved. */
export function NotificationsVignette() {
  const [prefs, setPrefs] = React.useState({ reminders: true, messages: true, homework: true, notes: false });
  const rows: { key: keyof typeof prefs; label: string; hint: string }[] = [
    { key: "reminders", label: "Lesson reminders", hint: "Before each lesson" },
    { key: "messages", label: "Messages from tutors", hint: "Including messages about your children" },
    { key: "homework", label: "Homework updates", hint: "Assigned, submitted and reviewed" },
    { key: "notes", label: "Progress notes", hint: "When a tutor posts a lesson note" },
  ];
  return (
    <VignetteFrame tone="peach">
      <Panel>
        <PanelHeader title={<span className="inline-flex items-center gap-1.5"><Bell className="size-3.5 text-ink" /> Notification settings</span>} meta="Try it — preview only" />
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const id = `notif-demo-${r.key}`;
            return (
              <li key={r.key} className="flex items-center justify-between gap-4 px-4 py-3">
                <label htmlFor={id} className="min-w-0 cursor-pointer">
                  <span className="block text-[13px] font-medium text-ink">{r.label}</span>
                  <span className="block text-[11.5px] text-muted">{r.hint}</span>
                </label>
                <Switch id={id} size="sm" checked={prefs[r.key]} onCheckedChange={(v) => setPrefs((p) => ({ ...p, [r.key]: v }))} />
              </li>
            );
          })}
          <li className="flex items-center justify-between gap-4 px-4 py-3">
            <label htmlFor="notif-demo-sms" className="min-w-0">
              <span className="block text-[13px] font-medium text-ink">Text message reminders</span>
              <span className="block text-[11.5px] text-muted">Not available yet — email and in-app only</span>
            </label>
            <Switch id="notif-demo-sms" size="sm" checked={false} disabled />
          </li>
        </ul>
      </Panel>
    </VignetteFrame>
  );
}

/* ─── Tutor side ─────────────────────────────────────────────────────────── */

export function ProfileBuilderVignette() {
  const steps = ["Subjects & levels", "Experience", "Education", "Pricing & trial", "Availability", "Verification"];
  const done = 3;
  return (
    <VignetteFrame tone="violet" label="Guided tutor onboarding with progress saved between steps">
      <Panel>
        <PanelHeader title="Tutor profile" meta={`Step ${done + 1} of ${steps.length}`} />
        <div className="p-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
            <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} whileInView={{ width: `${(done / steps.length) * 100}%` }} viewport={inView} transition={{ duration: 1, ease: EASE, delay: 0.15 }} />
          </div>
          <ol className="mt-4 space-y-2">
            {steps.map((s, i) => (
              <motion.li key={s} initial={{ opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }} viewport={inView} transition={{ delay: 0.1 + i * 0.06 }} className="flex items-center gap-2.5 text-[12.5px]">
                {i < done ? <CircleCheck className="size-4 text-ink" /> : i === done ? <span className="grid size-4 place-items-center rounded-full border-2 border-ink"><span className="size-1.5 rounded-full bg-ink" /></span> : <Circle className="size-4 text-subtle" />}
                <span className={cn(i === done ? "font-semibold text-ink" : i < done ? "text-ink-2" : "text-muted")}>{s}</span>
                {i === done && <span className="ml-auto text-[11px] text-muted">In progress</span>}
              </motion.li>
            ))}
          </ol>
          <p className="mt-4 rounded-md bg-canvas px-3 py-2 text-[11.5px] text-muted">Progress is saved. Pick up where you left off at any time.</p>
        </div>
      </Panel>
    </VignetteFrame>
  );
}

export function JobVignette() {
  const job = SEED_REQUIREMENTS.find((r) => r.status === "published") ?? SEED_REQUIREMENTS[0];
  return (
    <VignetteFrame tone="brand" label={`A student job posted by a family: ${job.title}`}>
      <Panel className="p-4">
        <div className="flex items-center justify-between gap-2">
          <Badge tone="neutral" size="sm">{subjectName(job.subject)}</Badge>
          <span className="text-[11px] text-muted">Posted by a family</span>
        </div>
        <p className="mt-2.5 text-[13.5px] font-bold leading-snug text-ink">{job.title}</p>
        <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-muted">{job.objectives}</p>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-ink-2">
          <span className="inline-flex items-center gap-1"><MapPin className="size-3 text-subtle" /> {job.city}, {job.state}</span>
          <span className="inline-flex items-center gap-1"><CalendarClock className="size-3 text-subtle" /> {job.days.join(", ")}</span>
          <span className="inline-flex items-center gap-1 tabular-nums"><Wallet className="size-3 text-subtle" /> {formatCents(job.budgetMinCents)}–{formatCents(job.budgetMaxCents)}/hr</span>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <span className="text-[11.5px] text-muted">Applying uses 1 credit</span>
          <span className="inline-flex h-7 items-center rounded-md bg-ink px-2.5 text-[11.5px] font-semibold text-on-ink">Apply</span>
        </div>
      </Panel>
    </VignetteFrame>
  );
}

export function PayoutVignette({ rateCents, commissionBps, planName }: { rateCents: number; commissionBps: number; planName: string }) {
  const fee = applyBps(rateCents, commissionBps);
  const net = rateCents - fee;
  return (
    <VignetteFrame tone="teal" label={`Example payout: a ${formatCents(rateCents)} lesson on the ${planName} plan pays out ${formatCents(net, { exact: true })}`}>
      <Panel>
        <PanelHeader title="Completed lesson · 60 min" meta={`${planName} plan`} />
        <dl className="space-y-2 p-4 text-[12.5px]">
          <div className="flex justify-between"><dt className="text-muted">Lesson price</dt><dd className="tabular-nums text-ink">{formatCents(rateCents, { exact: true })}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Commission ({commissionBps / 100}%)</dt><dd className="tabular-nums text-ink">−{formatCents(fee, { exact: true })}</dd></div>
          <div className="flex items-baseline justify-between border-t border-line pt-2">
            <dt className="font-semibold text-ink">You earn</dt>
            <dd className="font-heading text-xl font-bold tabular-nums tracking-[-0.03em] text-ink">{formatCents(net, { exact: true })}</dd>
          </div>
        </dl>
        <div className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-[11.5px] text-muted">
          <Wallet className="size-3.5 text-ink" /> Available after the {DEFAULT_POLICY.disputeWindowDays}-day dispute window · Stripe Connect
        </div>
      </Panel>
    </VignetteFrame>
  );
}

/* ─── Trust ──────────────────────────────────────────────────────────────── */

const CYCLE: VerificationStatus[] = ["not_started", "submitted", "under_review", "verified"];

/** Cycles one check through the real verification states; static when reduced motion is on. */
export function VerificationVignette() {
  const reduce = useReducedMotion();
  const [step, setStep] = React.useState(3);
  React.useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setStep((s) => (s + 1) % CYCLE.length), 1800);
    return () => clearInterval(id);
  }, [reduce]);
  const certStatus = reduce ? "under_review" : CYCLE[step];
  const rows: { kind: VerificationKind; status: VerificationStatus }[] = [
    { kind: "identity", status: "verified" },
    { kind: "education", status: "verified" },
    { kind: "certification", status: certStatus },
    { kind: "background", status: "submitted" },
  ];
  return (
    <VignetteFrame tone="sky" label="Verification checks for a tutor, each with its own status. Badges appear only for completed checks.">
      <Panel>
        <PanelHeader title="Verification" meta="Reviewed by our team" />
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.kind} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-[12.5px] text-ink-2">{VERIFICATION_LABEL[r.kind]}</span>
              <motion.span key={r.status} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}>
                <VerificationStatusBadge status={r.status} />
              </motion.span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-3">
          <span className="mr-1 text-[11px] text-muted">Shown on profile:</span>
          {rows.filter((r) => r.status === "verified").map((r) => (
            <motion.span key={r.kind} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <Badge tone="accent" size="sm"><BadgeCheck /> {VERIFICATION_LABEL[r.kind]}</Badge>
            </motion.span>
          ))}
        </div>
      </Panel>
    </VignetteFrame>
  );
}

export function ReviewVignette() {
  return (
    <VignetteFrame tone="yellow" label="A review attached to a completed lesson">
      <Panel className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-0.5" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.span key={i} initial={{ opacity: 0, scale: 0.6 }} whileInView={{ opacity: 1, scale: 1 }} viewport={inView} transition={{ delay: 0.1 + i * 0.07 }}>
                <Star className="size-3.5 fill-star text-star" />
              </motion.span>
            ))}
          </div>
          <Badge tone="success" size="sm"><Check /> Completed lesson</Badge>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-2">Clear explanations and a written recap after every session. The diagnostic in the first lesson found exactly where the gaps were.</p>
        <p className="mt-3 border-t border-line pt-2.5 text-[11px] text-muted">Parent of a 10th grader · Tied to a booking on Sep 12 · Illustrative</p>
      </Panel>
    </VignetteFrame>
  );
}
