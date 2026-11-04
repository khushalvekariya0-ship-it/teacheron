"use client";

import * as React from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { ImageUp, Monitor, Users } from "lucide-react";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { imageFileToDataUrl } from "@/lib/image";
import { GRADES, LANGUAGES, LEARNING_SUPPORT, TIMES_OF_DAY, TUTOR_CATEGORIES } from "@/lib/data/catalog";
import { formatCents, tzAbbrev } from "@/lib/format";
import { DAY_ORDER } from "@/components/jobs/jobUtils";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { ChipGroup, RadioCards, Segmented } from "@/components/ui/Controls";
import { InlineAlert } from "@/components/ui/States";
import { GroupField, SubjectPicker } from "@/components/dashboard/tutor/shared";
import {
  BUDGET_PRESETS, EXPERIENCE_OPTIONS, GENDERS, GOALS, LESSON_LENGTHS, PAY_METHOD_OPTIONS, START_OPTIONS,
  type BasicValues, type BudgetValues, type LearningValues, type PreferencesValues, type ScheduleValues,
} from "./schema";
import { LocationFields } from "@/components/domain/LocationFields";
import { postalLabel, postalRequired } from "@/lib/postal";

/*
 * The fields of each part of a student's learning profile. Used by the setup wizard (/onboarding/student)
 * and by the editable sections of Dashboard → My profile, so both always ask the same questions.
 */

/* ─── Basic information ─────────────────────────────────────────────────────── */

export function BasicFields({ form, me }: { form: UseFormReturn<BasicValues>; me: User }) {
  const { register, control, setValue, formState: { errors } } = form;
  const loc = useWatch({ control, name: ["country", "zip", "city", "state"] });
  const [photoUrl, firstName, lastName] = useWatch({ control, name: ["photoUrl", "firstName", "lastName"] });
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const inputId = React.useId();
  const teen = !!me.parentalConsent;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) return setPhotoError("Choose a PNG, JPG or WebP image.");
    if (file.size > 5 * 1024 * 1024) return setPhotoError("Choose an image under 5 MB.");
    setPhotoError(null);
    try {
      setValue("photoUrl", await imageFileToDataUrl(file), { shouldDirty: true });
    } catch {
      setPhotoError("That image couldn't be read. Try a different file.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-center">
        <Avatar name={`${firstName || me.firstName} ${lastName || me.lastName}`} src={photoUrl} size="xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            Profile photo <span className="font-normal text-muted">(optional)</span>
          </p>
          <p className="mt-0.5 text-[13px] text-muted">A clear photo of your face helps tutors recognise you in lessons. PNG, JPG or WebP up to 5 MB.</p>
          {photoError && (
            <p role="alert" className="mt-1 text-[13px] text-danger">
              {photoError}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor={inputId}
            className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink shadow-xs transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-navy hover:bg-canvas"
          >
            <ImageUp className="size-3.5" aria-hidden /> {photoUrl ? "Replace" : "Upload photo"}
            <input
              id={inputId}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void pick(file);
              }}
            />
          </label>
          {photoUrl && (
            <Button variant="ghost" size="sm" onClick={() => setValue("photoUrl", undefined, { shouldDirty: true })}>
              Remove
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required error={errors.firstName?.message}>
          <Input autoComplete="given-name" {...register("firstName")} />
        </Field>
        <Field label="Last name" required error={errors.lastName?.message}>
          <Input autoComplete="family-name" {...register("lastName")} />
        </Field>
      </div>

      <Field label="Age" required hint={teen ? "You signed up as 13–17." : "Only you can see your age."} error={errors.age?.message} className="max-w-44">
        <Input type="number" inputMode="numeric" min={teen ? 13 : 18} max={teen ? 17 : 99} suffix={<span className="pr-1 text-sm">years</span>} {...register("age", { valueAsNumber: true })} />
      </Field>

      <Controller
        name="gender"
        control={control}
        render={({ field }) => (
          <GroupField legend="Gender" optional hint="Only you can see this.">
            <RadioCards name={field.name} columns={4} value={field.value} onValueChange={field.onChange} options={GENDERS} />
          </GroupField>
        )}
      />

      <LocationFields
        idPrefix="student-loc"
        value={{ country: loc[0] || "US", zip: loc[1] ?? "", city: loc[2] ?? "", state: loc[3] ?? "" }}
        onChange={(patch) => {
          for (const [k, v] of Object.entries(patch) as [keyof typeof patch, string][]) setValue(k, v, { shouldDirty: true, shouldValidate: !!errors[k] });
        }}
        errors={{ country: errors.country?.message, zip: errors.zip?.message, city: errors.city?.message, state: errors.state?.message }}
        required={{ country: true, zip: postalRequired(loc[0]), city: true, state: true }}
      />
      <p className="-mt-2 text-[13px] text-muted">Your location finds tutors near you for in-person lessons. Tutors never see your street address or {postalLabel(loc[0])}.</p>
    </div>
  );
}

/* ─── Learning requirements ─────────────────────────────────────────────────── */

export function LearningFields({ form }: { form: UseFormReturn<LearningValues> }) {
  const { register, control, formState: { errors } } = form;
  return (
    <div className="space-y-7">
      <Controller
        name="grade"
        control={control}
        render={({ field }) => (
          <Field label="Your grade or level" required error={errors.grade?.message} className="max-w-xs">
            <Select ref={field.ref} name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} options={GRADES.map((g) => ({ value: g.value, label: g.label }))} placeholder="Select" />
          </Field>
        )}
      />
      <Controller
        name="subjects"
        control={control}
        render={({ field }) => (
          <GroupField legend="Subjects you want to learn" required hint={`${field.value.length} selected · up to 5`} error={errors.subjects?.message}>
            <SubjectPicker value={field.value} onChange={field.onChange} max={5} />
          </GroupField>
        )}
      />
      <Controller
        name="goals"
        control={control}
        render={({ field }) => (
          <GroupField legend="What do you want to achieve?" required error={errors.goals?.message}>
            <ChipGroup label="Learning goals" options={GOALS.map((g) => ({ value: g, label: g }))} value={field.value} onChange={field.onChange} />
          </GroupField>
        )}
      />
      <Field label="Tell tutors more" optional hint="Topics you find hard, an exam date, or how you learn best. Contact details are hidden automatically." error={errors.details?.message}>
        <Textarea rows={4} maxLength={600} showCount placeholder="I have the AP Calculus exam in May and I struggle with related rates…" {...register("details")} />
      </Field>
      <Controller
        name="learningSupport"
        control={control}
        render={({ field }) => (
          <GroupField legend="Learning support" optional hint="Only if you'd like tutors with experience in these.">
            <ChipGroup size="sm" label="Learning support" options={LEARNING_SUPPORT.map((s) => ({ value: s, label: s }))} value={field.value} onChange={field.onChange} />
          </GroupField>
        )}
      />
    </div>
  );
}

/* ─── Tutor preferences ─────────────────────────────────────────────────────── */

const MILES = [5, 10, 15, 25, 50];

export function PreferencesFields({ form }: { form: UseFormReturn<PreferencesValues> }) {
  const { control, formState: { errors } } = form;
  const modes = useWatch({ control, name: "modes" });
  return (
    <div className="space-y-7">
      <Controller
        name="modes"
        control={control}
        render={({ field }) => (
          <GroupField legend="How do you want lessons?" required hint="Choose both if either works for you." error={errors.modes?.message}>
            <ChipGroup
              label="Lesson format"
              options={[
                { value: "online", label: <span className="inline-flex items-center gap-1.5"><Monitor className="size-3.5" aria-hidden /> Online</span> },
                { value: "in_person", label: <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" aria-hidden /> In person</span> },
              ]}
              value={field.value}
              onChange={field.onChange}
            />
          </GroupField>
        )}
      />
      {modes?.includes("in_person") && (
        <Controller
          name="travelMiles"
          control={control}
          render={({ field }) => (
            <Field label="How far can in-person lessons be?" className="max-w-xs">
              <Select ref={field.ref} value={String(field.value)} onChange={(e) => field.onChange(Number(e.target.value))} options={MILES.map((m) => ({ value: String(m), label: `Within ${m} miles` }))} />
            </Field>
          )}
        />
      )}
      <Controller
        name="tutorGender"
        control={control}
        render={({ field }) => (
          <GroupField legend="Tutor gender">
            <Segmented
              label="Tutor gender"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: "any", label: "No preference" },
                { value: "female", label: "Female" },
                { value: "male", label: "Male" },
              ]}
            />
          </GroupField>
        )}
      />
      <Controller
        name="tutorLanguages"
        control={control}
        render={({ field }) => (
          <GroupField legend="Languages the tutor speaks" required error={errors.tutorLanguages?.message}>
            <ChipGroup size="sm" label="Tutor languages" options={LANGUAGES.map((l) => ({ value: l, label: l }))} value={field.value} onChange={field.onChange} />
          </GroupField>
        )}
      />
      <Controller
        name="tutorCategories"
        control={control}
        render={({ field }) => (
          <GroupField legend="Type of tutor" optional hint="Leave empty if any type is fine.">
            <ChipGroup size="sm" label="Type of tutor" options={TUTOR_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} value={field.value} onChange={field.onChange} />
          </GroupField>
        )}
      />
      <Controller
        name="minExperienceYears"
        control={control}
        render={({ field }) => (
          <Field label="Teaching experience" className="max-w-xs">
            <Select ref={field.ref} value={String(field.value)} onChange={(e) => field.onChange(Number(e.target.value))} options={EXPERIENCE_OPTIONS} />
          </Field>
        )}
      />
    </div>
  );
}

/* ─── Schedule & availability ───────────────────────────────────────────────── */

export function ScheduleFields({ form, timezone }: { form: UseFormReturn<ScheduleValues>; timezone: string }) {
  const { control, formState: { errors } } = form;
  return (
    <div className="space-y-7">
      <Controller
        name="days"
        control={control}
        render={({ field }) => (
          <GroupField legend="Days you're free" required error={errors.days?.message}>
            <ChipGroup label="Days you're free" options={DAY_ORDER.map((d) => ({ value: d as string, label: d }))} value={field.value} onChange={field.onChange} />
          </GroupField>
        )}
      />
      <Controller
        name="timesOfDay"
        control={control}
        render={({ field }) => (
          <GroupField legend="Times of day" required hint={`In your time zone (${tzAbbrev(timezone)}).`} error={errors.timesOfDay?.message}>
            <ChipGroup
              label="Times of day"
              options={TIMES_OF_DAY.map((t) => ({ value: t.value as ScheduleValues["timesOfDay"][number], label: <span>{t.label} <span className="font-normal opacity-70">{t.range}</span></span> }))}
              value={field.value}
              onChange={field.onChange}
            />
          </GroupField>
        )}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <Controller
          name="sessionsPerWeek"
          control={control}
          render={({ field }) => (
            <GroupField legend="Lessons per week">
              <Segmented label="Lessons per week" value={String(field.value)} onChange={(v) => field.onChange(Number(v))} options={["1", "2", "3", "4", "5"].map((n) => ({ value: n, label: n }))} />
            </GroupField>
          )}
        />
        <Controller
          name="lessonMinutes"
          control={control}
          render={({ field }) => (
            <GroupField legend="Lesson length" error={errors.lessonMinutes?.message}>
              <Segmented label="Lesson length" value={String(field.value)} onChange={(v) => field.onChange(Number(v))} options={LESSON_LENGTHS.map((m) => ({ value: String(m), label: `${m} min` }))} />
            </GroupField>
          )}
        />
      </div>
      <Controller
        name="startWhen"
        control={control}
        render={({ field }) => (
          <GroupField legend="When do you want to start?">
            <RadioCards name={field.name} columns={3} value={field.value} onValueChange={field.onChange} options={START_OPTIONS} />
          </GroupField>
        )}
      />
    </div>
  );
}

/* ─── Budget & payment ──────────────────────────────────────────────────────── */

export function BudgetFields({ form, schedule }: { form: UseFormReturn<BudgetValues>; schedule: { sessionsPerWeek: number; lessonMinutes: number } }) {
  const { register, control, setValue, formState: { errors } } = form;
  const [min, max] = useWatch({ control, name: ["budgetMin", "budgetMax"] });
  const valid = Number.isInteger(min) && Number.isInteger(max) && min >= 10 && max <= 500 && min <= max;
  const perWeek = (rate: number) => Math.round(rate * 100 * (schedule.lessonMinutes / 60) * schedule.sessionsPerWeek);

  return (
    <div className="space-y-7">
      <GroupField legend="Budget per hour" required hint="Tutors on TutorLink charge $15–$500 an hour. Pick a range or type your own.">
        <div className="flex flex-wrap gap-2">
          {BUDGET_PRESETS.map((p) => {
            const on = min === p.min && max === p.max;
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setValue("budgetMin", p.min, { shouldValidate: true, shouldDirty: true });
                  setValue("budgetMax", p.max, { shouldValidate: true, shouldDirty: true });
                }}
                className={cn(
                  "h-9 border px-3.5 text-[13.5px] font-medium transition-colors",
                  on ? "border-ink bg-ink text-on-ink" : "border-line-strong bg-surface text-ink-2 hover:border-ink hover:text-ink",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <Field label="From" error={errors.budgetMin?.message} className="w-36">
            <Input type="number" inputMode="numeric" prefixText="$" suffix={<span className="pr-1 text-sm">/hr</span>} {...register("budgetMin", { valueAsNumber: true })} />
          </Field>
          <Field label="To" error={errors.budgetMax?.message} className="w-36">
            <Input type="number" inputMode="numeric" prefixText="$" suffix={<span className="pr-1 text-sm">/hr</span>} {...register("budgetMax", { valueAsNumber: true })} />
          </Field>
        </div>
        {valid && (
          <p className="mt-3 text-[13px] text-muted">
            With {schedule.sessionsPerWeek} × {schedule.lessonMinutes}-minute {schedule.sessionsPerWeek === 1 ? "lesson" : "lessons"} a week, that&apos;s about{" "}
            <span className="font-medium tabular-nums text-ink">
              {formatCents(perWeek(min))}–{formatCents(perWeek(max))}
            </span>{" "}
            a week.
          </p>
        )}
      </GroupField>

      <Controller
        name="payer"
        control={control}
        render={({ field }) => (
          <GroupField legend="Who pays for lessons?">
            <Segmented
              label="Who pays for lessons"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: "self", label: "I pay" },
                { value: "parent", label: "My parent or guardian" },
              ]}
            />
          </GroupField>
        )}
      />
      <Controller
        name="payMethod"
        control={control}
        render={({ field }) => (
          <GroupField legend="How would you like to pay?">
            <RadioCards name={field.name} columns={3} value={field.value} onValueChange={field.onChange} options={PAY_METHOD_OPTIONS} />
          </GroupField>
        )}
      />
      <InlineAlert tone="info" title="Nothing to pay now">
        You only pay when you book a lesson. Card or UPI details are entered at checkout, never on this page.
      </InlineAlert>
    </div>
  );
}
