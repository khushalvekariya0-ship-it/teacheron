"use client";

import * as React from "react";
import { Controller, useWatch, type Control, type FieldErrors } from "react-hook-form";
import { MapPin, Monitor, Shuffle, Users } from "lucide-react";
import { GRADES, LANGUAGES, LEARNING_SUPPORT, TIMES_OF_DAY } from "@/lib/data/catalog";
import { resolveLocation } from "@/lib/data/geo";
import { Field, Input, Select } from "@/components/ui/Input";
import { ChipGroup, RadioCards } from "@/components/ui/Controls";
import { SubjectSelect, fieldDescribedBy } from "@/components/requirements/SubjectSelect";
import { DAY_ORDER, EXPERIENCE_OPTIONS, type TimeOfDay } from "@/components/jobs/jobUtils";
import { cn } from "@/lib/utils";
import type { AnswerKey, Answers, ModeChoice } from "./model";

export const ANSWER_LABEL: Record<AnswerKey, string> = {
  subject: "Subject",
  grade: "Grade",
  goal: "Main goal",
  budgetMax: "Budget",
  days: "Days",
  timesOfDay: "Time of day",
  mode: "Lesson format",
  zip: "ZIP code",
  minExperience: "Experience",
  language: "Language",
  support: "Learning needs",
};

/** Fieldset wrapper for chip groups and radio cards (a <label> can't point at a group). */
export function GroupField({ legend, hint, error, children, className, optional }: { legend: string; hint?: React.ReactNode; error?: string; children: React.ReactNode; className?: string; optional?: boolean }) {
  const id = React.useId();
  return (
    <fieldset className={cn("min-w-0 space-y-2", className)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}>
      <legend className="flex w-full items-baseline justify-between gap-2 text-sm font-medium text-ink">
        <span>{legend}</span>
        {optional && <span className="text-xs font-normal text-muted">Optional</span>}
      </legend>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}

const DAY_OPTIONS = DAY_ORDER.map((d) => ({ value: d as string, label: d }));
const TIME_OPTIONS = TIMES_OF_DAY.map((t) => ({ value: t.value as TimeOfDay, label: <span>{t.label} <span className="font-normal opacity-70">{t.range}</span></span> }));
const SUPPORT_OPTIONS = LEARNING_SUPPORT.map((s) => ({ value: s, label: s }));

/** Renders one concierge answer as an editable control. */
export function AnswerField({ name, control, errors, idPrefix = "cg", compact }: { name: AnswerKey; control: Control<Answers>; errors: FieldErrors<Answers>; idPrefix?: string; compact?: boolean }) {
  const id = `${idPrefix}-${name}`;
  const mode = useWatch({ control, name: "mode" });
  const zip = useWatch({ control, name: "zip" });
  const err = (errors[name] as { message?: string } | undefined)?.message;

  switch (name) {
    case "subject":
      return (
        <Field label={ANSWER_LABEL.subject} id={id} required error={err}>
          <Controller
            control={control}
            name="subject"
            render={({ field }) => <SubjectSelect id={id} ref={field.ref} name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!err} aria-describedby={fieldDescribedBy(id, err)} aria-required />}
          />
        </Field>
      );
    case "grade":
      return (
        <Field label={ANSWER_LABEL.grade} id={id} optional={!compact}>
          <Controller
            control={control}
            name="grade"
            render={({ field }) => <Select id={id} {...field} placeholder="Any grade" options={GRADES.map((g) => ({ value: g.value, label: g.label }))} />}
          />
        </Field>
      );
    case "goal":
      return (
        <Field label={ANSWER_LABEL.goal} id={id} optional hint="Not scored — carried over if you post a requirement." error={err}>
          <Controller control={control} name="goal" render={({ field }) => <Input id={id} {...field} maxLength={300} placeholder="e.g. Catch up on fractions before winter break" />} />
        </Field>
      );
    case "budgetMax": {
      const hint = "Your maximum hourly rate. Leave blank if you're flexible.";
      return (
        <Field label={ANSWER_LABEL.budgetMax} id={id} optional={!compact} error={err} hint={hint}>
          <Controller
            control={control}
            name="budgetMax"
            render={({ field }) => (
              <Input
                id={id}
                {...field}
                onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 3))}
                inputMode="numeric"
                prefixText="$"
                suffix={<span className="pr-1 text-[13px]">/hr</span>}
                placeholder="70"
                className="max-w-48"
              />
            )}
          />
        </Field>
      );
    }
    case "days":
      return (
        <GroupField legend={ANSWER_LABEL.days} optional={!compact} hint="Pick every day that could work.">
          <Controller control={control} name="days" render={({ field }) => <ChipGroup label="Preferred days" value={field.value} onChange={field.onChange} options={DAY_OPTIONS} size="sm" />} />
        </GroupField>
      );
    case "timesOfDay":
      return (
        <GroupField legend={ANSWER_LABEL.timesOfDay} optional={!compact}>
          <Controller control={control} name="timesOfDay" render={({ field }) => <ChipGroup label="Preferred times of day" value={field.value} onChange={field.onChange} options={TIME_OPTIONS} size="sm" />} />
        </GroupField>
      );
    case "mode":
      return (
        <GroupField legend={ANSWER_LABEL.mode} optional={!compact} hint={mode ? undefined : "No preference — we'll consider both."}>
          <Controller
            control={control}
            name="mode"
            render={({ field }) => (
              <RadioCards<Exclude<ModeChoice, "">>
                name="concierge-mode"
                value={field.value || undefined}
                onValueChange={field.onChange}
                columns={3}
                options={[
                  { value: "online", label: "Online", description: "Video lessons", icon: <Monitor /> },
                  { value: "in_person", label: "In person", description: "Meet locally", icon: <Users /> },
                  { value: "either", label: "Either", description: "Whatever fits best", icon: <Shuffle /> },
                ]}
              />
            )}
          />
        </GroupField>
      );
    case "zip": {
      const point = /^\d{5}$/.test(zip) ? resolveLocation(zip) : null;
      const hint = point ? `Near ${point.label.replace(/^\d{5} · near /, "")}` : mode === "in_person" ? "Required for in-person lessons." : "Used to check distance for in-person lessons.";
      return (
        <Field label={ANSWER_LABEL.zip} id={id} required={mode === "in_person"} optional={mode !== "in_person" && !compact} error={err} hint={/^\d{5}$/.test(zip) && !point ? "We can't place this ZIP yet — distance won't be scored." : hint}>
          <Controller
            control={control}
            name="zip"
            render={({ field }) => (
              <Input
                id={id}
                {...field}
                onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric"
                autoComplete="postal-code"
                icon={<MapPin />}
                placeholder="e.g. 11201"
                className="max-w-48"
              />
            )}
          />
        </Field>
      );
    }
    case "minExperience":
      return (
        <Field label="Minimum experience" id={id} optional={!compact}>
          <Controller control={control} name="minExperience" render={({ field }) => <Select id={id} {...field} options={EXPERIENCE_OPTIONS} />} />
        </Field>
      );
    case "language":
      return (
        <Field label="Tutor speaks" id={id} optional={!compact} hint="Only languages other than English are scored.">
          <Controller control={control} name="language" render={({ field }) => <Select id={id} {...field} placeholder="No preference" options={LANGUAGES.map((l) => ({ value: l, label: l }))} />} />
        </Field>
      );
    case "support":
      return (
        <GroupField legend="Learning needs" optional={!compact} hint="Tutors with listed experience score higher.">
          <Controller control={control} name="support" render={({ field }) => <ChipGroup label="Learning needs" value={field.value} onChange={field.onChange} options={SUPPORT_OPTIONS} size="sm" />} />
        </GroupField>
      );
  }
}
