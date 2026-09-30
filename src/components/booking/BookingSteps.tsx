"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Clock3, CreditCard, Info, MapPin, Monitor, Tag, UserRound, Users, X } from "lucide-react";
import type { Booking, BookingType, Child, TeachingMode, Tutor, User } from "@/lib/types";
import { GRADE_LABEL, subjectName } from "@/lib/data/catalog";
import { formatCents, formatDuration, formatTime, formatWeekdayDate, sessionPrice, tzAbbrev } from "@/lib/format";
import { cn } from "@/lib/utils";
import { motion } from "@/components/motion";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Checkbox, RadioCards, Segmented } from "@/components/ui/Controls";
import { InlineAlert } from "@/components/ui/States";
import { SlotPicker } from "@/components/domain/SlotPicker";

export const NOTES_MAX = 500;

export interface Draft {
  type: BookingType;
  subject: string;
  duration: number;
  mode: TeachingMode;
  childId: string;
  notes: string;
  startUtc: string | null;
}

export function lessonMinutes(tutor: Tutor, d: Pick<Draft, "type" | "duration">): number {
  return d.type === "trial" ? tutor.trial.durationMin : d.duration;
}

export function lessonPrice(tutor: Tutor, d: Pick<Draft, "type" | "duration">): number {
  return d.type === "trial" ? tutor.trial.priceCents : sessionPrice(tutor.hourlyRateCents, d.duration);
}

/* ─── Step 1 · Details ──────────────────────────────────────────────────────── */

export function DetailsStep({
  tutor,
  me,
  draft,
  set,
  trialOffered,
  trialUsed,
  onlineAllowed,
  learners,
}: {
  tutor: Tutor;
  me: User;
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  trialOffered: boolean;
  trialUsed: boolean;
  onlineAllowed: boolean;
  learners: Child[];
}) {
  const [childTouched, setChildTouched] = React.useState(false);
  const selectedChild = learners.find((c) => c.id === draft.childId);
  const trialLabel = tutor.trial.priceCents === 0 ? "Free" : formatCents(tutor.trial.priceCents);

  return (
    <div className="space-y-6">
      {trialOffered ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Lesson type</legend>
          <RadioCards<BookingType>
            name="lesson-type"
            value={draft.type}
            onValueChange={(type) => set({ type })}
            options={[
              { value: "trial", label: `Trial lesson · ${trialLabel}`, description: `${tutor.trial.durationMin} minutes to meet ${tutor.firstName} and agree on a plan.` },
              { value: "regular", label: `Regular lesson · ${formatCents(tutor.hourlyRateCents)}/hr`, description: `${tutor.rules.sessionLengths.map((m) => `${m}`).join(" or ")} minutes, priced by length.` },
            ]}
          />
          {draft.type === "trial" && trialUsed && (
            <p role="alert" className="mt-2 text-[13px] text-danger">
              {selectedChild ? `${selectedChild.firstName} has` : "You've"} already had a trial with {tutor.firstName}. Choose a regular lesson instead.
            </p>
          )}
          {draft.type === "trial" && tutor.trial.notes && !trialUsed && (
            <p className="mt-2 flex items-start gap-2 text-[13px] leading-snug text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden /> {tutor.trial.notes}
            </p>
          )}
        </fieldset>
      ) : (
        <div className="rounded-lg border border-line bg-canvas px-4 py-3 text-sm">
          <p className="font-medium text-ink">Regular lesson · {formatCents(tutor.hourlyRateCents)}/hr</p>
          <p className="mt-0.5 text-[13px] text-muted">{tutor.firstName} isn&rsquo;t offering trial lessons right now.</p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Subject" required>
          <Select value={draft.subject} onChange={(e) => set({ subject: e.target.value })} options={tutor.subjects.map((s) => ({ value: s, label: subjectName(s) }))} />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Length</p>
          {draft.type === "trial" ? (
            <p className="flex h-10 items-center gap-2 rounded-md border border-line bg-canvas px-3 text-[15px] text-ink-2">
              <Clock3 className="size-4 text-subtle" aria-hidden /> {formatDuration(tutor.trial.durationMin)} (fixed for trials)
            </p>
          ) : tutor.rules.sessionLengths.length > 1 ? (
            <Segmented
              label="Lesson length"
              className="flex h-10 w-full items-center [&>button]:flex-1 [&>button]:justify-center"
              value={String(draft.duration)}
              onChange={(v) => set({ duration: Number(v) })}
              options={tutor.rules.sessionLengths.map((m) => ({ value: String(m), label: `${m} min` }))}
            />
          ) : (
            <p className="flex h-10 items-center gap-2 rounded-md border border-line bg-canvas px-3 text-[15px] text-ink-2">
              <Clock3 className="size-4 text-subtle" aria-hidden /> {formatDuration(tutor.rules.sessionLengths[0])}
            </p>
          )}
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Format</legend>
        {tutor.modes.length > 1 ? (
          <RadioCards<TeachingMode>
            name="lesson-mode"
            value={draft.mode}
            onValueChange={(mode) => set({ mode })}
            options={tutor.modes.map((m) =>
              m === "online"
                ? { value: m, label: "Online", icon: <Monitor />, description: onlineAllowed ? "Lesson page with a private meeting link." : "Temporarily unavailable.", disabled: !onlineAllowed }
                : { value: m, label: "In person", icon: <Users />, description: `Within ~${tutor.serviceRadiusMiles} mi of ${tutor.city}, ${tutor.state}.` },
            )}
          />
        ) : (
          <p className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-4 py-3 text-sm text-ink-2">
            {tutor.modes[0] === "online" ? <Monitor className="size-4 text-subtle" aria-hidden /> : <Users className="size-4 text-subtle" aria-hidden />}
            {tutor.modes[0] === "online" ? "Online lesson" : `In person, within ~${tutor.serviceRadiusMiles} mi of ${tutor.city}, ${tutor.state}`}
          </p>
        )}
        {draft.mode === "in_person" && (
          <p className="mt-2 text-[13px] leading-snug text-muted">You&rsquo;ll agree on a meeting place with {tutor.firstName} in messages. Addresses are never shown publicly.</p>
        )}
        {draft.mode === "online" && !onlineAllowed && (
          <p role="alert" className="mt-2 text-[13px] text-danger">
            Online lessons are temporarily unavailable. Choose in person or try again later.
          </p>
        )}
      </fieldset>

      {me.role === "parent" ? (
        learners.length === 0 ? (
          <InlineAlert
            tone="warning"
            title="Add your child first"
            action={
              <Button asChild size="sm" variant="secondary">
                <Link href="/dashboard/children">Add a child</Link>
              </Button>
            }
          >
            Lessons booked from a parent account are for a child profile. It takes a minute and keeps their lessons and progress together.
          </InlineAlert>
        ) : (
          <Field
            label="Who is this lesson for?"
            required
            error={childTouched && !draft.childId ? "Choose which child this lesson is for." : undefined}
            hint={
              <>
                Not listed?{" "}
                <Link href="/dashboard/children" className="font-medium text-navy underline-offset-4 hover:underline">
                  Add a child
                </Link>
              </>
            }
          >
            <Select
              value={draft.childId}
              onChange={(e) => set({ childId: e.target.value })}
              onBlur={() => setChildTouched(true)}
              placeholder="Choose a child"
              options={learners.map((c) => ({ value: c.id, label: `${c.firstName} · ${GRADE_LABEL[c.grade]}` }))}
            />
          </Field>
        )
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-line px-4 py-3 text-sm">
          <UserRound className="size-4 text-subtle" aria-hidden />
          <span className="text-muted">Learner</span>
          <span className="ml-auto font-medium text-ink">
            You ({me.firstName} {me.lastName.charAt(0)}.)
          </span>
        </div>
      )}

      <Field label="What would you like to focus on?" optional hint="Share goals, upcoming tests or recent assignments. Contact details are hidden automatically.">
        <Textarea value={draft.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={NOTES_MAX} showCount rows={3} placeholder={`e.g. Unit test on derivatives next Friday — I get stuck on related rates.`} />
      </Field>
    </div>
  );
}

/* ─── Step 2 · Time ─────────────────────────────────────────────────────────── */

export function TimeStep({ tutor, draft, set, tz }: { tutor: Tutor; draft: Draft; set: (patch: Partial<Draft>) => void; tz: string }) {
  const minutes = lessonMinutes(tutor, draft);
  const onChange = React.useCallback((startUtc: string | null) => set({ startUtc }), [set]);
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Open {formatDuration(minutes)} times over the next three weeks. {tutor.firstName} needs at least {tutor.rules.minNoticeHours} hours&rsquo; notice.
      </p>
      <SlotPicker tutor={tutor} durationMin={minutes} value={draft.startUtc} onChange={onChange} />
      {draft.startUtc && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-lg border border-navy/20 bg-navy-50/60 px-4 py-3 text-sm">
          <CalendarDays className="size-4 shrink-0 text-navy" aria-hidden />
          <p className="text-ink">
            <span className="font-medium">{formatWeekdayDate(draft.startUtc, tz)}</span>
            <span className="text-ink-2">
              {" "}
              · {formatTime(draft.startUtc, tz)} – {formatTime(new Date(new Date(draft.startUtc).getTime() + minutes * 60_000).toISOString(), tz)} {tzAbbrev(tz, new Date(draft.startUtc))}
            </span>
          </p>
        </motion.div>
      )}
    </div>
  );
}

/* ─── Step 3 · Review ───────────────────────────────────────────────────────── */

function SummaryRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 text-sm">
      <span className="mt-0.5 text-subtle [&_svg]:size-4" aria-hidden>
        {icon}
      </span>
      <dt className="w-24 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

export function ReviewStep({
  tutor,
  draft,
  tz,
  learnerName,
  subtotal,
  discount,
  couponCode,
  couponError,
  onApplyCoupon,
  onRemoveCoupon,
  couponsEnabled,
  instant,
  policy,
  agree,
  onAgree,
  agreeError,
}: {
  tutor: Tutor;
  draft: Draft;
  tz: string;
  learnerName: string;
  subtotal: number;
  discount: number;
  couponCode: string | null;
  couponError: string | null;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
  couponsEnabled: boolean;
  instant: boolean;
  policy: string[];
  agree: boolean;
  onAgree: (v: boolean) => void;
  agreeError: boolean;
}) {
  const [code, setCode] = React.useState("");
  const minutes = lessonMinutes(tutor, draft);
  const total = Math.max(0, subtotal - discount);
  const start = draft.startUtc!;
  const end = new Date(new Date(start).getTime() + minutes * 60_000).toISOString();

  return (
    <div className="space-y-6">
      <dl className="divide-y divide-line rounded-xl border border-line px-4">
        <SummaryRow icon={<UserRound />} label="Tutor">
          {tutor.firstName} {tutor.lastName}
        </SummaryRow>
        <SummaryRow icon={<Tag />} label="Lesson">
          {draft.type === "trial" ? "Trial" : "Lesson"} · {subjectName(draft.subject)}
        </SummaryRow>
        <SummaryRow icon={<CalendarDays />} label="When">
          {formatWeekdayDate(start, tz)}
          <span className="block font-normal text-muted">
            {formatTime(start, tz)} – {formatTime(end, tz)} {tzAbbrev(tz, new Date(start))} · {formatDuration(minutes)}
          </span>
        </SummaryRow>
        <SummaryRow icon={draft.mode === "online" ? <Monitor /> : <MapPin />} label="Format">
          {draft.mode === "online" ? "Online" : "In person"}
        </SummaryRow>
        <SummaryRow icon={<Users />} label="Learner">
          {learnerName}
        </SummaryRow>
      </dl>

      <section aria-labelledby="price-heading" className="rounded-xl border border-line">
        <h3 id="price-heading" className="sr-only">
          Price
        </h3>
        <div className="space-y-2 px-4 py-3.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">
              {draft.type === "trial" ? `Trial lesson (${formatDuration(minutes)})` : `${formatDuration(minutes)} at ${formatCents(tutor.hourlyRateCents)}/hr`}
            </span>
            <span className="tabular-nums text-ink">{subtotal === 0 ? "Free" : formatCents(subtotal, { exact: subtotal % 100 !== 0 })}</span>
          </div>
          {discount > 0 && couponCode && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-success">
                <Tag className="size-3.5" aria-hidden /> {couponCode}
                <button type="button" onClick={onRemoveCoupon} className="grid size-5 place-items-center rounded text-muted hover:bg-sunken hover:text-ink" aria-label={`Remove code ${couponCode}`}>
                  <X className="size-3" />
                </button>
              </span>
              <span className="tabular-nums text-success">−{formatCents(discount, { exact: true })}</span>
            </motion.div>
          )}
          <div className="flex justify-between border-t border-line pt-2.5 text-[15px] font-semibold">
            <span className="text-ink">Total</span>
            <span className="tabular-nums text-ink">{total === 0 ? "$0" : formatCents(total, { exact: total % 100 !== 0 })}</span>
          </div>
        </div>

        {subtotal > 0 && couponsEnabled && !couponCode && (
          <form
            className="border-t border-line px-4 py-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) onApplyCoupon(code.trim());
            }}
          >
            <Field label="Promo code" optional error={couponError ?? undefined}>
              <div className="flex gap-2">
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter code" autoComplete="off" className="flex-1 uppercase" />
                <Button type="submit" variant="secondary" disabled={!code.trim()}>
                  Apply
                </Button>
              </div>
            </Field>
          </form>
        )}

        {total > 0 && (
          <div className="space-y-2 border-t border-line bg-canvas/60 px-4 py-3.5 text-[13px]">
            <p className="flex items-center gap-2 text-ink-2">
              <CreditCard className="size-4 text-subtle" aria-hidden />
              <span className="font-medium text-ink">Test card •••• 4242</span>
              <span className="text-muted">· Stripe test mode — no real charge</span>
            </p>
            <p className="leading-relaxed text-muted">
              {instant
                ? "You're charged when you confirm, and the lesson is booked right away."
                : `Your card is authorized now and charged only when ${tutor.firstName} accepts. If the request isn't accepted, the authorization is released.`}
            </p>
          </div>
        )}
        {total === 0 && (
          <p className="border-t border-line bg-canvas/60 px-4 py-3.5 text-[13px] text-muted">
            No payment needed. {instant ? "Your lesson is confirmed right away." : `${tutor.firstName} confirms the request before it's booked.`}
          </p>
        )}
      </section>

      <section aria-labelledby="policy-heading">
        <h3 id="policy-heading" className="text-sm font-semibold text-ink">
          Cancellation policy
        </h3>
        <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-muted">
          {policy.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-subtle" aria-hidden />
              {p}
            </li>
          ))}
        </ul>
        <div className={cn("mt-4 rounded-lg border px-4 py-3 transition-colors", agreeError && !agree ? "border-danger-200 bg-danger-50/60" : "border-line")}>
          <Checkbox
            checked={agree}
            onCheckedChange={(c) => onAgree(c === true)}
            aria-invalid={agreeError && !agree ? true : undefined}
            aria-describedby={agreeError && !agree ? "agree-error" : undefined}
            label={
              <>
                I agree to the cancellation policy and the{" "}
                <Link href="/terms" target="_blank" className="font-medium text-navy underline-offset-4 hover:underline">
                  Terms of Service
                </Link>
                .
              </>
            }
          />
          {agreeError && !agree && (
            <p id="agree-error" role="alert" className="mt-1.5 pl-7 text-[13px] text-danger">
              Please agree to continue.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

/* ─── Step 4 · Success ──────────────────────────────────────────────────────── */

function AnimatedCheck() {
  return (
    <motion.svg viewBox="0 0 52 52" className="size-14" initial="hidden" animate="show" aria-hidden>
      <motion.circle
        cx="26"
        cy="26"
        r="24"
        fill="none"
        strokeWidth="2"
        className="stroke-navy"
        variants={{ hidden: { pathLength: 0, opacity: 0 }, show: { pathLength: 1, opacity: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } }}
      />
      <motion.path
        d="M15 27 l7.5 7.5 L37.5 19"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-navy"
        variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { duration: 0.4, delay: 0.45, ease: [0.22, 1, 0.36, 1] } } }}
      />
    </motion.svg>
  );
}

export function SuccessStep({
  tutor,
  booking,
  tz,
  learnerName,
  meetingLinkMinutes,
  onMessage,
  messaging,
}: {
  tutor: Tutor;
  booking: Booking;
  tz: string;
  learnerName: string;
  meetingLinkMinutes: number;
  onMessage: () => void;
  messaging: boolean;
}) {
  const confirmed = booking.status === "confirmed";
  const charge = booking.priceCents - booking.discountCents;
  const end = new Date(new Date(booking.startUtc).getTime() + booking.durationMin * 60_000).toISOString();
  return (
    <div className="flex flex-col items-center pt-2 text-center">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.35, duration: 0.6 }} className="grid size-20 place-items-center rounded-full bg-navy-50">
        <AnimatedCheck />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5 }}>
        <h3 className="mt-5 text-xl font-semibold tracking-tight text-ink" role="status">
          {confirmed ? "Lesson confirmed" : "Request sent"}
        </h3>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
          {confirmed
            ? `You're booked with ${tutor.firstName}. You'll find the details in your bookings and notifications.`
            : `${tutor.firstName} will review your request${tutor.responseTimeHours != null ? `, usually within ${tutor.responseTimeHours} ${tutor.responseTimeHours === 1 ? "hour" : "hours"}` : ""}. ${charge > 0 ? "You're charged only if it's accepted." : ""}`}
        </p>
      </motion.div>

      <motion.dl initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }} className="mt-6 w-full divide-y divide-line rounded-xl border border-line px-4 text-left">
        <SummaryRow icon={<CalendarDays />} label="When">
          {formatWeekdayDate(booking.startUtc, tz)}
          <span className="block font-normal text-muted">
            {formatTime(booking.startUtc, tz)} – {formatTime(end, tz)} {tzAbbrev(tz, new Date(booking.startUtc))}
          </span>
        </SummaryRow>
        <SummaryRow icon={<Tag />} label="Lesson">
          {booking.type === "trial" ? "Trial" : "Lesson"} · {subjectName(booking.subject)}
        </SummaryRow>
        <SummaryRow icon={<Users />} label="Learner">
          {learnerName}
        </SummaryRow>
        <SummaryRow icon={<CreditCard />} label={charge === 0 ? "Payment" : confirmed ? "Paid" : "Authorized"}>
          {charge === 0 ? "No charge" : formatCents(charge, { exact: charge % 100 !== 0 })}
        </SummaryRow>
      </motion.dl>

      <p className="mt-4 flex items-start gap-2 text-left text-[13px] leading-snug text-muted">
        {booking.mode === "online" ? <Monitor className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden /> : <MapPin className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden />}
        {booking.mode === "online"
          ? `Your meeting link appears on the booking page ${meetingLinkMinutes} minutes before the lesson.`
          : booking.locationNote ?? `Agree on a meeting place with ${tutor.firstName} in messages.`}
      </p>

      <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
        <Button asChild size="lg" className="flex-1">
          <Link href={`/dashboard/bookings/${booking.id}`}>View booking</Link>
        </Button>
        <Button size="lg" variant="secondary" className="flex-1" onClick={onMessage} loading={messaging}>
          Message {tutor.firstName}
        </Button>
      </div>
    </div>
  );
}
