"use client";

import * as React from "react";
import { Controller, useFieldArray, useForm, useWatch, type FieldValues, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck, BookOpenCheck, BriefcaseBusiness, FlaskConical, GraduationCap, HeartHandshake, ImageUp, MapPin, Monitor, Pencil,
  Plus, ScrollText, ShieldCheck, Target, Trash2, Users, Clock3,
} from "lucide-react";
import type { User, WeeklyWindow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Checkbox, ChipGroup, RadioCards, Segmented, Switch } from "@/components/ui/Controls";
import { InlineAlert } from "@/components/ui/States";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EASE } from "@/components/motion";
import { useFlag } from "@/lib/store/hooks";
import { LANGUAGES, LEARNING_SUPPORT, LEVELS, LEVEL_LABEL, MODE_LABEL, TUTOR_CATEGORIES, TUTOR_CATEGORY_LABEL, US_STATES, US_TIMEZONES, subjectName } from "@/lib/data/catalog";
import { TUTOR_PLANS } from "@/lib/data/platform";
import { applyBps, formatCents, formatUsPhone, sessionPrice, tzAbbrev } from "@/lib/format";
import { FileList, FilePicker, GroupField, SubjectPicker, TagInput, formatKb, toPicked, validateDocs } from "@/components/dashboard/tutor/shared";
import { DAY_NAMES, DAY_ORDER, WeeklyAvailabilityEditor, formatHours, timeLabel, weeklyMinutes } from "@/components/dashboard/tutor/AvailabilityEditor";
import {
  TRIAL_LENGTHS, availabilitySchema, credentialsSchema, experienceSchema, modesSchema, personalSchema, pricingSchema, profileSchema, reviewSchema,
  subjectsSchema, verificationSchema, type AvailabilityValues, type CredentialsValues, type ExperienceValues, type ModesValues, type OnboardingData,
  type PersonalValues, type PricingValues, type ProfileValues, type SubjectsValues, type VerificationValues,
} from "./schema";

export interface StepProps<T> {
  formId: string;
  defaults: T;
  onValid: (values: T) => void;
  /** Gives the wizard a way to read the current (possibly unvalidated) values for Back and Save & exit. */
  bindValues: (getter: () => Record<string, unknown>) => void;
}

function useBind<T extends FieldValues>(form: UseFormReturn<T>, bind: (getter: () => Record<string, unknown>) => void) {
  const { getValues } = form;
  React.useEffect(() => {
    bind(() => getValues() as Record<string, unknown>);
  }, [bind, getValues]);
}

/* ─── 1 · Personal info ─────────────────────────────────────────────────────── */

export function PersonalStep({ me, formId, defaults, onValid, bindValues }: StepProps<PersonalValues> & { me: User }) {
  const form = useForm<PersonalValues>({ resolver: zodResolver(personalSchema), defaultValues: defaults, mode: "onTouched" });
  useBind(form, bindValues);
  const { register, control, handleSubmit, formState: { errors } } = form;
  return (
    <form id={formId} noValidate onSubmit={handleSubmit(onValid)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name">
          <Input value={me.firstName} readOnly disabled />
        </Field>
        <Field label="Last name">
          <Input value={me.lastName} readOnly disabled />
        </Field>
      </div>
      <p className="-mt-2 text-[13px] text-muted">Your name comes from your account ({me.email}). Contact support if it needs to change.</p>
      <Controller
        name="phone"
        control={control}
        render={({ field }) => (
          <Field label="Mobile phone" required hint="Never shown publicly. Used for booking alerts and account security." error={errors.phone?.message}>
            <Input
              ref={field.ref}
              name={field.name}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(555) 010-1234"
              value={field.value}
              onBlur={field.onBlur}
              onChange={(e) => field.onChange(formatUsPhone(e.target.value))}
            />
          </Field>
        )}
      />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem_8rem]">
        <Field label="City" required error={errors.city?.message}>
          <Input autoComplete="address-level2" {...register("city")} />
        </Field>
        <Controller
          name="state"
          control={control}
          render={({ field }) => (
            <Field label="State" required error={errors.state?.message}>
              <Select ref={field.ref} name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} options={US_STATES} placeholder="Select" autoComplete="address-level1" />
            </Field>
          )}
        />
        <Field label="ZIP code" required error={errors.zip?.message}>
          <Input inputMode="numeric" maxLength={5} autoComplete="postal-code" {...register("zip")} />
        </Field>
      </div>
      <InlineAlert tone="info" title="Your location stays private">
        Families see your city and an approximate distance for in-person lessons — never your street address or ZIP code.
      </InlineAlert>
    </form>
  );
}

/* ─── 2 · Subjects & levels ─────────────────────────────────────────────────── */

export function SubjectsStep({ formId, defaults, onValid, bindValues }: StepProps<SubjectsValues>) {
  const form = useForm<SubjectsValues>({ resolver: zodResolver(subjectsSchema), defaultValues: defaults, mode: "onTouched" });
  useBind(form, bindValues);
  const { control, handleSubmit, formState: { errors } } = form;
  return (
    <form id={formId} noValidate onSubmit={handleSubmit(onValid)} className="space-y-8">
      <Controller
        name="subjects"
        control={control}
        render={({ field }) => (
          <GroupField
            legend="Subjects you teach"
            required
            hint={field.value.length ? `${field.value.length} selected · up to 10. Choose subjects you can teach confidently.` : "Choose up to 10 subjects you can teach confidently."}
            error={errors.subjects?.message}
          >
            <SubjectPicker value={field.value} onChange={field.onChange} />
          </GroupField>
        )}
      />
      <Controller
        name="levels"
        control={control}
        render={({ field }) => (
          <GroupField legend="Grade levels" required hint="Who you work with most effectively." error={errors.levels?.message}>
            <ChipGroup label="Grade levels" options={LEVELS.map((l) => ({ value: l.value, label: l.label }))} value={field.value} onChange={field.onChange} />
          </GroupField>
        )}
      />
      <Controller
        name="specialties"
        control={control}
        render={({ field }) => (
          <Field label="Specialties" optional hint="Specific courses or exams, e.g. “AP Calculus BC” or “Digital SAT Math”. Press Enter to add up to 8." error={errors.specialties?.message}>
            <TagInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} placeholder="Add a specialty" />
          </Field>
        )}
      />
    </form>
  );
}

/* ─── 3 · Experience ────────────────────────────────────────────────────────── */

const CATEGORY_COPY: Record<string, { description: string; icon: React.ReactNode }> = {
  certified_teacher: { description: "State-certified K–12 teacher, current or former.", icon: <GraduationCap /> },
  subject_expert: { description: "Deep expertise from your degree or career.", icon: <BriefcaseBusiness /> },
  test_prep_specialist: { description: "You focus on SAT, ACT, AP or admissions tests.", icon: <Target /> },
  graduate_student: { description: "Currently in a master's or doctoral program.", icon: <FlaskConical /> },
  learning_specialist: { description: "Trained in learning differences or executive function.", icon: <HeartHandshake /> },
};

export function ExperienceStep({ formId, defaults, onValid, bindValues }: StepProps<ExperienceValues>) {
  const form = useForm<ExperienceValues>({ resolver: zodResolver(experienceSchema), defaultValues: defaults, mode: "onTouched" });
  useBind(form, bindValues);
  const { register, control, handleSubmit, formState: { errors } } = form;
  return (
    <form id={formId} noValidate onSubmit={handleSubmit(onValid)} className="space-y-8">
      <Field label="Years of teaching or tutoring experience" required error={errors.experienceYears?.message} className="max-w-xs">
        <Input type="number" inputMode="numeric" min={0} max={60} step={1} suffix={<span className="pr-1 text-sm">years</span>} {...register("experienceYears", { valueAsNumber: true })} />
      </Field>
      <Controller
        name="category"
        control={control}
        render={({ field }) => (
          <GroupField legend="Which best describes you?" required error={errors.category?.message}>
            <RadioCards
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              options={TUTOR_CATEGORIES.map((c) => ({ value: c.value, label: c.label, description: CATEGORY_COPY[c.value]?.description, icon: CATEGORY_COPY[c.value]?.icon }))}
            />
          </GroupField>
        )}
      />
      <Controller
        name="learningSupport"
        control={control}
        render={({ field }) => (
          <GroupField legend="Learning support experience" optional hint="Only select areas where you have training or direct experience — families rely on this.">
            <ChipGroup label="Learning support experience" options={LEARNING_SUPPORT.map((s) => ({ value: s, label: s }))} value={field.value} onChange={field.onChange} />
          </GroupField>
        )}
      />
    </form>
  );
}

/* ─── 4 · Education & certifications ───────────────────────────────────────── */

export function CredentialsStep({ formId, defaults, onValid, bindValues }: StepProps<CredentialsValues>) {
  const form = useForm<CredentialsValues>({ resolver: zodResolver(credentialsSchema), defaultValues: defaults, mode: "onTouched" });
  useBind(form, bindValues);
  const { register, control, handleSubmit, formState: { errors } } = form;
  const edu = useFieldArray({ control, name: "education" });
  const certs = useFieldArray({ control, name: "certifications" });

  return (
    <form id={formId} noValidate onSubmit={handleSubmit(onValid)} className="space-y-8">
      <InlineAlert tone="info" title="Verified separately">
        Entries you add here start as unverified. Once your profile is live, upload your diploma or certificate in Verification — a badge appears only after our team confirms it.
      </InlineAlert>

      <section aria-labelledby="edu-h" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 id="edu-h" className="text-[15px] font-semibold text-ink">Education</h3>
          <Button variant="secondary" size="sm" disabled={edu.fields.length >= 6} onClick={() => edu.append({ degree: "", field: "", institution: "", year: Number.NaN })}>
            <Plus /> Add education
          </Button>
        </div>
        {edu.fields.length === 0 && <p className="rounded-lg border border-dashed border-line-strong px-4 py-5 text-center text-sm text-muted">No education added. Add your highest degree or current program.</p>}
        <AnimatePresence initial={false}>
          {edu.fields.map((f, i) => (
            <motion.fieldset
              key={f.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="rounded-xl border border-line bg-canvas/50 p-4"
            >
              <legend className="sr-only">Education {i + 1}</legend>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13px] font-medium text-muted" aria-hidden>
                  Education {i + 1}
                </p>
                <Button variant="ghost" size="icon-sm" onClick={() => edu.remove(i)} aria-label={`Remove education ${i + 1}`}>
                  <Trash2 />
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Degree" required error={errors.education?.[i]?.degree?.message}>
                  <Input placeholder="e.g. B.S., M.A., Ph.D." {...register(`education.${i}.degree`)} />
                </Field>
                <Field label="Field of study" required error={errors.education?.[i]?.field?.message}>
                  <Input placeholder="e.g. Mathematics" {...register(`education.${i}.field`)} />
                </Field>
                <Field label="School or university" required error={errors.education?.[i]?.institution?.message}>
                  <Input {...register(`education.${i}.institution`)} />
                </Field>
                <Field label="Year completed (or expected)" required error={errors.education?.[i]?.year?.message}>
                  <Input type="number" inputMode="numeric" placeholder="YYYY" {...register(`education.${i}.year`, { valueAsNumber: true })} />
                </Field>
              </div>
            </motion.fieldset>
          ))}
        </AnimatePresence>
      </section>

      <section aria-labelledby="cert-h" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 id="cert-h" className="text-[15px] font-semibold text-ink">Certifications</h3>
          <Button variant="secondary" size="sm" disabled={certs.fields.length >= 6} onClick={() => certs.append({ name: "", issuer: "", year: Number.NaN })}>
            <Plus /> Add certification
          </Button>
        </div>
        {certs.fields.length === 0 && <p className="rounded-lg border border-dashed border-line-strong px-4 py-5 text-center text-sm text-muted">No certifications added. Teaching licenses and training programs belong here.</p>}
        <AnimatePresence initial={false}>
          {certs.fields.map((f, i) => (
            <motion.fieldset
              key={f.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="rounded-xl border border-line bg-canvas/50 p-4"
            >
              <legend className="sr-only">Certification {i + 1}</legend>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13px] font-medium text-muted" aria-hidden>
                  Certification {i + 1}
                </p>
                <Button variant="ghost" size="icon-sm" onClick={() => certs.remove(i)} aria-label={`Remove certification ${i + 1}`}>
                  <Trash2 />
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem]">
                <Field label="Certification" required error={errors.certifications?.[i]?.name?.message}>
                  <Input placeholder="e.g. Teaching Certificate — Math 7–12" {...register(`certifications.${i}.name`)} />
                </Field>
                <Field label="Issued by" required error={errors.certifications?.[i]?.issuer?.message}>
                  <Input placeholder="e.g. NYSED" {...register(`certifications.${i}.issuer`)} />
                </Field>
                <Field label="Year" required error={errors.certifications?.[i]?.year?.message}>
                  <Input type="number" inputMode="numeric" placeholder="YYYY" {...register(`certifications.${i}.year`, { valueAsNumber: true })} />
                </Field>
              </div>
            </motion.fieldset>
          ))}
        </AnimatePresence>
      </section>
    </form>
  );
}

/* ─── 5 · Teaching modes ────────────────────────────────────────────────────── */

function ToggleCard({ pressed, onPress, icon, title, description }: { pressed: boolean; onPress: () => void; icon: React.ReactNode; title: string; description: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onPress}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border bg-surface p-4 text-left transition-[border-color,background-color,box-shadow]",
        pressed ? "border-navy bg-navy-50/60 shadow-[0_0_0_1px_var(--color-navy)]" : "border-line hover:border-line-strong",
      )}
    >
      <span className={cn("mt-0.5 [&_svg]:size-5", pressed ? "text-navy" : "text-muted")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted">{description}</span>
      </span>
      <span className={cn("mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[5px] border", pressed ? "border-navy bg-navy text-on-ink" : "border-line-strong bg-surface")} aria-hidden>
        {pressed && (
          <svg viewBox="0 0 12 12" className="size-3">
            <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );
}

export function ModesStep({ formId, defaults, onValid, bindValues }: StepProps<ModesValues>) {
  const form = useForm<ModesValues>({ resolver: zodResolver(modesSchema), defaultValues: defaults, mode: "onTouched" });
  useBind(form, bindValues);
  const { register, control, handleSubmit, formState: { errors } } = form;
  const modes = useWatch({ control, name: "modes" });
  const inPerson = modes.includes("in_person");
  return (
    <form id={formId} noValidate onSubmit={handleSubmit(onValid)} className="space-y-6">
      <Controller
        name="modes"
        control={control}
        render={({ field }) => {
          const toggle = (m: "online" | "in_person") => field.onChange(field.value.includes(m) ? field.value.filter((x) => x !== m) : [...field.value, m]);
          return (
            <GroupField legend="How do you teach?" required hint="Choose one or both." error={errors.modes?.message}>
              <div className="grid gap-3 sm:grid-cols-2">
                <ToggleCard pressed={field.value.includes("online")} onPress={() => toggle("online")} icon={<Monitor />} title="Online" description="Lessons in the TutorLink classroom with a meeting link." />
                <ToggleCard pressed={field.value.includes("in_person")} onPress={() => toggle("in_person")} icon={<Users />} title="In person" description="At a library, school or the student's home within your area." />
              </div>
            </GroupField>
          );
        }}
      />
      <AnimatePresence initial={false}>
        {inPerson && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
            <Field label="Service radius" required hint="How far you're willing to travel from your ZIP code for in-person lessons." error={errors.serviceRadiusMiles?.message} className="max-w-xs pt-1">
              <Input type="number" inputMode="numeric" min={1} max={50} suffix={<span className="pr-1 text-sm">miles</span>} {...register("serviceRadiusMiles", { valueAsNumber: true })} />
            </Field>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex gap-3 rounded-xl border border-line bg-canvas p-4">
        <MapPin className="mt-0.5 size-5 shrink-0 text-navy" aria-hidden />
        <div className="text-sm">
          <p className="font-medium text-ink">Location privacy</p>
          <p className="mt-1 leading-relaxed text-muted">
            Families see your city and an approximate distance, never your address. For in-person lessons, you agree on a meeting place in messages after a booking is confirmed — we recommend a public place for first sessions.
          </p>
        </div>
      </div>
    </form>
  );
}

/* ─── 6 · Pricing ───────────────────────────────────────────────────────────── */

export function PricingStep({ formId, defaults, onValid, bindValues }: StepProps<PricingValues>) {
  const form = useForm<PricingValues>({ resolver: zodResolver(pricingSchema), defaultValues: defaults, mode: "onTouched" });
  useBind(form, bindValues);
  const trialsOn = useFlag("trial_lessons");
  const { register, control, handleSubmit, formState: { errors } } = form;
  const [rate, trialEnabled, trialPrice, trialDuration] = useWatch({ control, name: ["hourlyRate", "trialEnabled", "trialPrice", "trialDuration"] });
  const starter = TUTOR_PLANS.find((p) => p.id === "free")!;
  const validRate = Number.isInteger(rate) && rate >= 15 && rate <= 500;
  const gross = validRate ? sessionPrice(rate * 100, 60) : 0;
  const fee = applyBps(gross, starter.commissionBps);
  const others = TUTOR_PLANS.filter((p) => p.id !== "free");
  const trialCents = Number.isInteger(trialPrice) && trialPrice >= 0 ? trialPrice * 100 : 0;

  return (
    <form id={formId} noValidate onSubmit={handleSubmit(onValid)} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="space-y-7">
        <Field label="Hourly rate" required hint="Between $15 and $500. Most families compare rates for similar subjects and experience." error={errors.hourlyRate?.message} className="max-w-xs">
          <Input type="number" inputMode="numeric" min={15} max={500} step={1} prefixText="$" suffix={<span className="pr-1 text-sm">/hr</span>} {...register("hourlyRate", { valueAsNumber: true })} />
        </Field>

        <div className="rounded-xl border border-line p-4 sm:p-5">
          <Controller
            name="trialEnabled"
            control={control}
            render={({ field }) => (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <label htmlFor="trial-switch" className="text-sm font-semibold text-ink">
                    Offer a trial lesson
                  </label>
                  <p className="mt-0.5 text-[13px] text-muted">A short first session helps families decide. One trial per student.</p>
                </div>
                <Switch id="trial-switch" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
          {!trialsOn && (
            <InlineAlert tone="warning" className="mt-4">
              Trial lessons are currently turned off across TutorLink. Your settings are saved and apply when trials return.
            </InlineAlert>
          )}
          <AnimatePresence initial={false}>
            {trialEnabled && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
                <div className="mt-5 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
                  <Controller
                    name="trialDuration"
                    control={control}
                    render={({ field }) => (
                      <GroupField legend="Trial length" error={errors.trialDuration?.message}>
                        <Segmented
                          label="Trial length"
                          value={String(field.value)}
                          onChange={(v) => field.onChange(Number(v))}
                          options={TRIAL_LENGTHS.map((m) => ({ value: String(m), label: `${m} min` }))}
                        />
                      </GroupField>
                    )}
                  />
                  <Field label="Trial price" hint="Enter 0 to offer it free." error={errors.trialPrice?.message}>
                    <Input type="number" inputMode="numeric" min={0} max={200} step={1} prefixText="$" {...register("trialPrice", { valueAsNumber: true })} />
                  </Field>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <aside aria-label="Earnings preview" className="h-fit rounded-xl border border-line bg-canvas p-5 lg:sticky lg:top-24">
        <p className="text-[13px] font-medium text-muted">Earnings preview · 60-minute lesson</p>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Family pays</dt>
            <dd className="font-medium tabular-nums text-ink">{validRate ? formatCents(gross) : "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Starter commission ({starter.commissionBps / 100}%)</dt>
            <dd className="tabular-nums text-ink-2">{validRate ? `−${formatCents(fee)}` : "—"}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-line pt-2">
            <dt className="font-medium text-ink">You earn</dt>
            <dd className="text-lg font-semibold tabular-nums text-ink">{validRate ? formatCents(gross - fee) : "—"}</dd>
          </div>
        </dl>
        {validRate && (
          <ul className="mt-4 space-y-1 border-t border-line pt-3 text-[12.5px] text-muted">
            {others.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>
                  On {p.name} ({p.commissionBps / 100}%)
                </span>
                <span className="tabular-nums text-ink-2">{formatCents(gross - applyBps(gross, p.commissionBps))}</span>
              </li>
            ))}
          </ul>
        )}
        {trialEnabled && (
          <p className="mt-4 border-t border-line pt-3 text-[12.5px] text-muted">
            Trial: {trialDuration} min · {trialCents === 0 ? "free" : formatCents(trialCents)}
          </p>
        )}
        <p className="mt-3 text-[12px] leading-snug text-muted">Payouts arrive by Stripe after each lesson&apos;s dispute window.</p>
      </aside>
    </form>
  );
}

/* ─── 7 · Availability ──────────────────────────────────────────────────────── */

export function AvailabilityStep({ formId, defaults, onValid, bindValues, timezone }: StepProps<AvailabilityValues> & { timezone: string }) {
  const form = useForm<AvailabilityValues>({ resolver: zodResolver(availabilitySchema), defaultValues: defaults, mode: "onTouched" });
  useBind(form, bindValues);
  const { control, handleSubmit, formState: { errors } } = form;
  const tzLabel = US_TIMEZONES.find((t) => t.value === timezone)?.label ?? `${timezone} (${tzAbbrev(timezone)})`;
  return (
    <form id={formId} noValidate onSubmit={handleSubmit(onValid)} className="space-y-4">
      <Controller
        name="availability"
        control={control}
        render={({ field }) => {
          const windows = field.value as WeeklyWindow[];
          const minutes = weeklyMinutes(windows);
          return (
            <GroupField legend="Weekly hours" required error={errors.availability?.message ?? errors.availability?.root?.message}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-3.5" aria-hidden /> Times are in your time zone: {tzLabel}
                </span>
                <span className="tabular-nums">{minutes ? `${formatHours(minutes)} per week` : "No hours added yet"}</span>
              </div>
              <WeeklyAvailabilityEditor value={windows} onChange={(v) => field.onChange(v)} />
            </GroupField>
          );
        }}
      />
      <p className="text-[13px] text-muted">You can block specific dates and set booking rules (notice, buffers, session lengths) from your dashboard.</p>
    </form>
  );
}

/* ─── 8 · Profile ───────────────────────────────────────────────────────────── */

export interface PhotoPreview {
  url: string;
  name: string;
}

export function ProfileStep({
  formId,
  defaults,
  onValid,
  bindValues,
  me,
  photo,
  onPhoto,
}: StepProps<ProfileValues> & { me: User; photo: PhotoPreview | null; onPhoto: (p: PhotoPreview | null) => void }) {
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: defaults, mode: "onTouched" });
  useBind(form, bindValues);
  const { register, control, handleSubmit, setValue, formState: { errors } } = form;
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const [bioRaw, headlineRaw, approachRaw, photoName] = useWatch({ control, name: ["bio", "headline", "approach", "photoName"] });
  const bio = bioRaw ?? "";
  const headline = headlineRaw ?? "";
  const approach = approachRaw ?? "";
  const bioLeft = Math.max(0, 80 - bio.trim().length);

  return (
    <form id={formId} noValidate onSubmit={handleSubmit(onValid)} className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-center">
        <Avatar name={`${me.firstName} ${me.lastName}`} src={photo?.url} size="xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Profile photo</p>
          <p className="mt-0.5 text-[13px] text-muted">
            {photoName ? (
              <>
                <span className="font-medium text-ink-2">{photoName}</span>
                {!photo && " · preview isn't kept after reloading in this preview build"}
              </>
            ) : (
              "A clear, friendly headshot. PNG, JPG or WebP up to 5 MB."
            )}
          </p>
          {photoError && (
            <p role="alert" className="mt-1 text-[13px] text-danger">
              {photoError}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="photo-input"
            className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink shadow-xs transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-navy hover:bg-canvas"
          >
            <ImageUp className="size-3.5" aria-hidden /> {photoName ? "Replace" : "Upload photo"}
            <input
              id="photo-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (!/\.(png|jpe?g|webp)$/i.test(file.name)) return setPhotoError("Choose a PNG, JPG or WebP image.");
                if (file.size > 5 * 1024 * 1024) return setPhotoError("Choose an image under 5 MB.");
                setPhotoError(null);
                onPhoto({ url: URL.createObjectURL(file), name: file.name });
                setValue("photoName", file.name, { shouldDirty: true });
              }}
            />
          </label>
          {photoName && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onPhoto(null);
                setValue("photoName", undefined, { shouldDirty: true });
              }}
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      <Field label="Headline" required hint={`${headline.length}/90 · e.g. “AP Calculus and SAT Math specialist”`} error={errors.headline?.message}>
        <Input maxLength={90} placeholder="What you teach, in one line" {...register("headline")} />
      </Field>
      <Field
        label="About you"
        required
        hint={bioLeft > 0 ? `${bioLeft} more characters needed. Share your background and who you help most.` : "Looks good. Families read this before messaging you."}
        error={errors.bio?.message}
      >
        <Textarea rows={6} maxLength={1500} showCount placeholder="I taught high school math for six years…" {...register("bio")} />
      </Field>
      <Field label="Teaching approach" required hint={`How a typical lesson works. ${approach.trim().length < 40 ? `${40 - approach.trim().length} more characters needed.` : ""}`} error={errors.approach?.message}>
        <Textarea rows={4} maxLength={1000} showCount placeholder="Every student starts with a short diagnostic…" {...register("approach")} />
      </Field>
      <Controller
        name="languages"
        control={control}
        render={({ field }) => (
          <GroupField legend="Languages you teach in" required error={errors.languages?.message}>
            <ChipGroup size="sm" label="Languages you teach in" options={LANGUAGES.map((l) => ({ value: l, label: l }))} value={field.value} onChange={field.onChange} />
          </GroupField>
        )}
      />
      <p className="text-[13px] text-muted">Phone numbers, emails and social handles are hidden automatically from public text.</p>
    </form>
  );
}

/* ─── 9 · Verification documents ────────────────────────────────────────────── */

const CHECKS = [
  { icon: BadgeCheck, title: "Identity", body: "A government-issued photo ID matched to your account. Required before your first payout." },
  { icon: GraduationCap, title: "Education", body: "Diplomas or transcripts for the degrees you listed." },
  { icon: ScrollText, title: "Certification", body: "Teaching licenses and certificates, checked with the issuer." },
  { icon: ShieldCheck, title: "Background", body: "A background screening with your consent, recommended for working with minors." },
];

export function VerificationStep({ formId, defaults, onValid, bindValues }: StepProps<VerificationValues>) {
  const form = useForm<VerificationValues>({ resolver: zodResolver(verificationSchema), defaultValues: defaults, mode: "onTouched" });
  useBind(form, bindValues);
  const { handleSubmit, control, setValue } = form;
  const [error, setError] = React.useState<string | null>(null);
  const [idDocument, sizeKb] = useWatch({ control, name: ["idDocument", "idDocumentSizeKb"] });
  return (
    <form id={formId} noValidate onSubmit={handleSubmit(onValid)} className="space-y-6">
      <ul className="grid gap-3 sm:grid-cols-2">
        {CHECKS.map((c) => (
          <li key={c.title} className="flex gap-3 rounded-xl border border-line p-4">
            <c.icon className="mt-0.5 size-5 shrink-0 text-navy" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-ink">{c.title}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <InlineAlert tone="info" title="Badges appear only after verification">
        Each check is reviewed by our trust team, usually within 2–3 business days. Nothing is shown on your public profile until a check is verified.
      </InlineAlert>

      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">
          Government-issued photo ID <span className="text-xs font-normal text-muted">· Optional now</span>
        </p>
        <p id="id-hint" className="text-[13px] text-muted">
          Driver&apos;s license, state ID or passport. You can also upload it later from Verification.
        </p>
        {idDocument ? (
          <FileList files={[{ name: idDocument, sizeKb: sizeKb ?? 0 }]} onRemove={() => {
            setValue("idDocument", undefined);
            setValue("idDocumentSizeKb", undefined);
          }} />
        ) : (
          <FilePicker
            id="id-document"
            title="Choose your ID"
            describedBy={error ? "id-error" : "id-hint"}
            invalid={!!error}
            onFiles={(files) => {
              const picked = toPicked(files[0]);
              const err = validateDocs([picked]);
              setError(err);
              if (err) return;
              setValue("idDocument", picked.name, { shouldDirty: true });
              setValue("idDocumentSizeKb", picked.sizeKb, { shouldDirty: true });
            }}
          />
        )}
        {error && (
          <p id="id-error" role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        )}
        {idDocument && <p className="text-[13px] text-muted">Submitted for review when you publish your profile ({formatKb(sizeKb ?? 0)}).</p>}
      </div>
    </form>
  );
}

/* ─── 10 · Review & submit ──────────────────────────────────────────────────── */

function ReviewBlock({ title, step, onEdit, children }: { title: string; step: number; onEdit: (n: number) => void; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line p-4 sm:p-5" aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <Button variant="ghost" size="xs" onClick={() => onEdit(step)} aria-label={`Edit ${title}`}>
          <Pencil /> Edit
        </Button>
      </div>
      <dl className="space-y-2 text-sm">{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

export function ReviewStep({
  formId,
  data,
  me,
  onEdit,
  onValid,
  bindValues,
  error,
}: {
  formId: string;
  data: OnboardingData;
  me: User;
  onEdit: (n: number) => void;
  onValid: () => void;
  bindValues: (getter: () => Record<string, unknown>) => void;
  error: string | null;
}) {
  const form = useForm<{ agree: boolean }>({ resolver: zodResolver(reviewSchema), defaultValues: { agree: false }, mode: "onTouched" });
  React.useEffect(() => {
    bindValues(() => ({}));
  }, [bindValues]);
  const { control, handleSubmit, formState: { errors } } = form;
  const none = <span className="text-muted">None added</span>;
  const byDay = DAY_ORDER.map((d) => ({ d, ws: (data.availability ?? []).filter((w) => w.day === d) })).filter((x) => x.ws.length);

  return (
    <form id={formId} noValidate onSubmit={handleSubmit(() => onValid())} className="space-y-4">
      {error && (
        <InlineAlert tone="danger" title="We couldn't publish your profile">
          {error}
        </InlineAlert>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <ReviewBlock title="Personal info" step={1} onEdit={onEdit}>
          <Row label="Name">{me.firstName} {me.lastName}</Row>
          <Row label="Phone">{data.phone || none}</Row>
          <Row label="Location">{[data.city, data.state].filter(Boolean).join(", ")} {data.zip}</Row>
        </ReviewBlock>
        <ReviewBlock title="Subjects & levels" step={2} onEdit={onEdit}>
          <Row label="Subjects">{data.subjects?.length ? data.subjects.map(subjectName).join(", ") : none}</Row>
          <Row label="Levels">{data.levels?.length ? data.levels.map((l) => LEVEL_LABEL[l]).join(", ") : none}</Row>
          <Row label="Specialties">{data.specialties?.length ? data.specialties.join(", ") : none}</Row>
        </ReviewBlock>
        <ReviewBlock title="Experience" step={3} onEdit={onEdit}>
          <Row label="Experience">{Number.isFinite(data.experienceYears) ? `${data.experienceYears} years` : none}</Row>
          <Row label="Background">{data.category ? TUTOR_CATEGORY_LABEL[data.category] : none}</Row>
          <Row label="Learning support">{data.learningSupport?.length ? data.learningSupport.join(", ") : none}</Row>
        </ReviewBlock>
        <ReviewBlock title="Education & certifications" step={4} onEdit={onEdit}>
          <Row label="Education">
            {data.education?.length ? (
              <ul className="space-y-0.5">
                {data.education.map((e, i) => (
                  <li key={i}>
                    {e.degree} {e.field}, {e.institution} ({e.year})
                  </li>
                ))}
              </ul>
            ) : (
              none
            )}
          </Row>
          <Row label="Certifications">
            {data.certifications?.length ? (
              <ul className="space-y-0.5">
                {data.certifications.map((c, i) => (
                  <li key={i}>
                    {c.name}, {c.issuer} ({c.year})
                  </li>
                ))}
              </ul>
            ) : (
              none
            )}
          </Row>
          <Row label="Status">
            <Badge tone="neutral" size="sm">
              Unverified until reviewed
            </Badge>
          </Row>
        </ReviewBlock>
        <ReviewBlock title="Teaching modes" step={5} onEdit={onEdit}>
          <Row label="Modes">{data.modes?.length ? data.modes.map((m) => MODE_LABEL[m]).join(" & ") : none}</Row>
          {data.modes?.includes("in_person") && <Row label="Service radius">{data.serviceRadiusMiles} miles</Row>}
        </ReviewBlock>
        <ReviewBlock title="Pricing" step={6} onEdit={onEdit}>
          <Row label="Hourly rate">{Number.isFinite(data.hourlyRate) ? `${formatCents((data.hourlyRate ?? 0) * 100)}/hr` : none}</Row>
          <Row label="Trial lesson">{data.trialEnabled ? `${data.trialDuration} min · ${data.trialPrice ? formatCents((data.trialPrice ?? 0) * 100) : "free"}` : "Not offered"}</Row>
        </ReviewBlock>
        <ReviewBlock title="Availability" step={7} onEdit={onEdit}>
          {byDay.length ? (
            byDay.map(({ d, ws }) => (
              <Row key={d} label={DAY_NAMES[d]}>
                <span className="tabular-nums">{ws.map((w) => `${timeLabel(w.start)} – ${timeLabel(w.end)}`).join(", ")}</span>
              </Row>
            ))
          ) : (
            <Row label="Weekly hours">{none}</Row>
          )}
        </ReviewBlock>
        <ReviewBlock title="Verification" step={9} onEdit={onEdit}>
          <Row label="Photo ID">{data.idDocument ? `${data.idDocument} · submitted with your profile` : "Not uploaded — you can add it later"}</Row>
        </ReviewBlock>
      </div>
      <ReviewBlock title="Profile" step={8} onEdit={onEdit}>
        <Row label="Headline">{data.headline || none}</Row>
        <Row label="About you">
          <span className="line-clamp-4 whitespace-pre-line text-ink-2">{data.bio || none}</span>
        </Row>
        <Row label="Approach">
          <span className="line-clamp-3 whitespace-pre-line text-ink-2">{data.approach || none}</span>
        </Row>
        <Row label="Languages">{data.languages?.length ? data.languages.join(", ") : none}</Row>
        <Row label="Photo">{data.photoName ?? "Initials avatar"}</Row>
      </ReviewBlock>

      <div className="rounded-xl border border-line bg-canvas p-4">
        <Controller
          name="agree"
          control={control}
          render={({ field }) => (
            <Checkbox
              checked={field.value}
              onCheckedChange={(v) => field.onChange(v === true)}
              onBlur={field.onBlur}
              label="I confirm this information is accurate"
              description="I understand that verification badges appear only after TutorLink reviews my documents, and that misrepresenting qualifications can lead to removal."
              aria-invalid={errors.agree ? true : undefined}
            />
          )}
        />
        {errors.agree && (
          <p role="alert" className="mt-2 pl-7 text-[13px] text-danger">
            {errors.agree.message}
          </p>
        )}
      </div>
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <BookOpenCheck className="size-4 text-navy" aria-hidden /> Your profile goes live as soon as you submit. You can edit everything later from your dashboard.
      </p>
    </form>
  );
}
