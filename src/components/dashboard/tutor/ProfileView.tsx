"use client";

import * as React from "react";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BadgeCheck, Check, ExternalLink, ImageUp, Monitor, Pencil, Users, Zap } from "lucide-react";
import type { Tutor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { imageFileToDataUrl } from "@/lib/image";
import { useApp } from "@/lib/store";
import { useFlag } from "@/lib/store/hooks";
import { LANGUAGES, LEARNING_SUPPORT, LEVELS, LEVEL_LABEL, MODE_LABEL, TUTOR_CATEGORY_LABEL, subjectName } from "@/lib/data/catalog";
import { applyBps, formatCents, formatDuration, sessionPrice } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/Shell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardContent, CardHeader, DetailRow } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { ChipGroup, Progress, Switch } from "@/components/ui/Controls";
import { InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { StarRating } from "@/components/ui/StarRating";
import type { Result } from "@/lib/store";
import { GroupField, NeedsTutorProfile, SubjectPicker, TagInput, ValueList } from "./shared";
import { completionPercent, profileChecklist, useMyPlan, useMyTutor } from "./hooks";

/* ─── Section shell ─────────────────────────────────────────────────────────── */

function Section({
  id,
  title,
  description,
  editing,
  onEdit,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  editing: boolean;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className={cn("scroll-mt-24 transition-shadow", editing && "border-ink ring-1 ring-ink")}>
      <CardHeader
        title={title}
        description={description}
        action={
          !editing && onEdit ? (
            <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit ${title.toLowerCase()}`}>
              <Pencil /> Edit
            </Button>
          ) : undefined
        }
      />
      <CardContent className="pt-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={editing ? "edit" : "view"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

function FormActions({ onCancel, error, saving }: { onCancel: () => void; error: string | null; saving?: boolean }) {
  return (
    <div className="space-y-3 border-t border-line pt-4">
      {error && <InlineAlert tone="danger">{error}</InlineAlert>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

/** Shared behaviour for inline-edit sections: open, cancel, save with a store Result. */
function useEditor() {
  const [editing, setEditing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = (res: Result, success: string) => {
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setError(null);
    setEditing(false);
    toast.success(success);
    return true;
  };
  return {
    editing,
    error,
    open: () => {
      setError(null);
      setEditing(true);
    },
    close: () => {
      setError(null);
      setEditing(false);
    },
    run,
  };
}

/* ─── About ─────────────────────────────────────────────────────────────────── */

const aboutSchema = z.object({
  headline: z.string().trim().min(10, "Write at least 10 characters.").max(90, "Keep your headline under 90 characters."),
  bio: z.string().trim().min(80, "Your bio should be at least 80 characters.").max(1500, "Keep your bio under 1,500 characters."),
  approach: z.string().trim().min(40, "Write at least 40 characters.").max(1000, "Keep this under 1,000 characters."),
});
type AboutValues = z.infer<typeof aboutSchema>;

function AboutSection({ tutor }: { tutor: Tutor }) {
  const update = useApp((s) => s.updateTutorProfile);
  const ed = useEditor();
  const form = useForm<AboutValues>({ resolver: zodResolver(aboutSchema), mode: "onTouched", defaultValues: { headline: tutor.headline, bio: tutor.bio, approach: tutor.approach } });
  const { register, control, handleSubmit, reset, formState: { errors } } = form;
  const [bio, headline] = useWatch({ control, name: ["bio", "headline"] });
  const bioLeft = Math.max(0, 80 - (bio ?? "").trim().length);

  return (
    <Section
      id="about"
      title="About you"
      description="Your headline, bio and approach are the first things families read."
      editing={ed.editing}
      onEdit={() => {
        reset({ headline: tutor.headline, bio: tutor.bio, approach: tutor.approach });
        ed.open();
      }}
    >
      {ed.editing ? (
        <form noValidate onSubmit={handleSubmit((v) => ed.run(update(v), "About section saved"))} className="space-y-5">
          <Field label="Headline" required hint={`${(headline ?? "").length}/90`} error={errors.headline?.message}>
            <Input maxLength={90} {...register("headline")} />
          </Field>
          <Field label="Bio" required hint={bioLeft > 0 ? `${bioLeft} more characters needed` : "Contact details are hidden automatically."} error={errors.bio?.message}>
            <Textarea rows={6} maxLength={1500} showCount {...register("bio")} />
          </Field>
          <Field label="Teaching approach" required error={errors.approach?.message}>
            <Textarea rows={4} maxLength={1000} showCount {...register("approach")} />
          </Field>
          <FormActions onCancel={ed.close} error={ed.error} />
        </form>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-[12.5px] font-medium text-muted">Headline</p>
            <p className="mt-0.5 text-[15px] font-medium text-ink">{tutor.headline}</p>
          </div>
          <div>
            <p className="text-[12.5px] font-medium text-muted">Bio</p>
            <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-ink-2">{tutor.bio}</p>
          </div>
          <div>
            <p className="text-[12.5px] font-medium text-muted">Teaching approach</p>
            <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-ink-2">{tutor.approach || <span className="text-muted">Not added yet</span>}</p>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ─── Subjects, levels, specialties ─────────────────────────────────────────── */

const subjectsSchema = z.object({
  subjects: z.array(z.string()).min(1, "Choose at least one subject.").max(10, "Choose up to 10 subjects."),
  levels: z.array(z.enum(["elementary", "middle", "high", "college", "adult"])).min(1, "Choose at least one level."),
  specialties: z.array(z.string()).max(8, "Add up to 8 specialties."),
});
type SubjectsValues = z.infer<typeof subjectsSchema>;

function SubjectsSection({ tutor }: { tutor: Tutor }) {
  const update = useApp((s) => s.updateTutorProfile);
  const ed = useEditor();
  const values = (): SubjectsValues => ({ subjects: tutor.subjects, levels: tutor.levels, specialties: tutor.specialties });
  const form = useForm<SubjectsValues>({ resolver: zodResolver(subjectsSchema), mode: "onTouched", defaultValues: values() });
  const { control, handleSubmit, reset, formState: { errors } } = form;
  return (
    <Section
      id="subjects"
      title="Subjects & levels"
      description="Used for search and job matching."
      editing={ed.editing}
      onEdit={() => {
        reset(values());
        ed.open();
      }}
    >
      {ed.editing ? (
        <form noValidate onSubmit={handleSubmit((v) => ed.run(update(v), "Subjects saved"))} className="space-y-7">
          <Controller
            name="subjects"
            control={control}
            render={({ field }) => (
              <GroupField legend="Subjects" required hint={`${field.value.length} selected · up to 10`} error={errors.subjects?.message}>
                <SubjectPicker value={field.value} onChange={field.onChange} />
              </GroupField>
            )}
          />
          <Controller
            name="levels"
            control={control}
            render={({ field }) => (
              <GroupField legend="Grade levels" required error={errors.levels?.message}>
                <ChipGroup label="Grade levels" options={LEVELS.map((l) => ({ value: l.value, label: l.label }))} value={field.value} onChange={field.onChange} />
              </GroupField>
            )}
          />
          <Controller
            name="specialties"
            control={control}
            render={({ field }) => (
              <Field label="Specialties" optional hint="Press Enter to add, up to 8." error={errors.specialties?.message}>
                <TagInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} placeholder="e.g. AP Calculus BC" />
              </Field>
            )}
          />
          <FormActions onCancel={ed.close} error={ed.error} />
        </form>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-muted">Subjects</p>
            <ValueList items={tutor.subjects.map(subjectName)} />
          </div>
          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-muted">Grade levels</p>
            <ValueList items={tutor.levels.map((l) => LEVEL_LABEL[l])} />
          </div>
          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-muted">Specialties</p>
            <ValueList items={tutor.specialties} />
          </div>
        </div>
      )}
    </Section>
  );
}

/* ─── Languages & learning support ──────────────────────────────────────────── */

const langSchema = z.object({ languages: z.array(z.string()).min(1, "Choose at least one language."), learningSupport: z.array(z.string()) });
type LangValues = z.infer<typeof langSchema>;

function LanguagesSection({ tutor }: { tutor: Tutor }) {
  const update = useApp((s) => s.updateTutorProfile);
  const ed = useEditor();
  const values = (): LangValues => ({ languages: tutor.languages, learningSupport: tutor.learningSupport });
  const form = useForm<LangValues>({ resolver: zodResolver(langSchema), mode: "onTouched", defaultValues: values() });
  const { control, handleSubmit, reset, formState: { errors } } = form;
  return (
    <Section
      id="languages"
      title="Languages & learning support"
      editing={ed.editing}
      onEdit={() => {
        reset(values());
        ed.open();
      }}
    >
      {ed.editing ? (
        <form noValidate onSubmit={handleSubmit((v) => ed.run(update(v), "Languages and support saved"))} className="space-y-6">
          <Controller
            name="languages"
            control={control}
            render={({ field }) => (
              <GroupField legend="Languages you teach in" required error={errors.languages?.message}>
                <ChipGroup size="sm" label="Languages you teach in" options={LANGUAGES.map((l) => ({ value: l, label: l }))} value={field.value} onChange={field.onChange} />
              </GroupField>
            )}
          />
          <Controller
            name="learningSupport"
            control={control}
            render={({ field }) => (
              <GroupField legend="Learning support experience" optional hint="Only areas where you have training or direct experience.">
                <ChipGroup size="sm" label="Learning support experience" options={LEARNING_SUPPORT.map((l) => ({ value: l, label: l }))} value={field.value} onChange={field.onChange} />
              </GroupField>
            )}
          />
          <FormActions onCancel={ed.close} error={ed.error} />
        </form>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-muted">Languages</p>
            <ValueList items={tutor.languages} />
          </div>
          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-muted">Learning support</p>
            <ValueList items={tutor.learningSupport} empty="None listed" />
          </div>
        </div>
      )}
    </Section>
  );
}

/* ─── Rate, modes, radius ───────────────────────────────────────────────────── */

const ratesSchema = z.object({
  hourlyRate: z.number({ invalid_type_error: "Enter your hourly rate." }).int("Use whole dollars.").min(15, "The minimum rate is $15.").max(500, "The maximum rate is $500."),
  modes: z.array(z.enum(["online", "in_person"])).min(1, "Choose at least one way to teach."),
  serviceRadiusMiles: z.number({ invalid_type_error: "Enter a distance in miles." }).int("Use whole miles.").min(1, "At least 1 mile.").max(50, "Up to 50 miles."),
});
type RatesValues = z.infer<typeof ratesSchema>;

function RatesSection({ tutor }: { tutor: Tutor }) {
  const update = useApp((s) => s.updateTutorProfile);
  const { plan } = useMyPlan(tutor.id);
  const ed = useEditor();
  const values = (): RatesValues => ({ hourlyRate: Math.round(tutor.hourlyRateCents / 100), modes: tutor.modes, serviceRadiusMiles: tutor.serviceRadiusMiles });
  const form = useForm<RatesValues>({ resolver: zodResolver(ratesSchema), mode: "onTouched", defaultValues: values() });
  const { register, control, handleSubmit, reset, formState: { errors } } = form;
  const [rate, modes] = useWatch({ control, name: ["hourlyRate", "modes"] });
  const shownRate = ed.editing ? rate : Math.round(tutor.hourlyRateCents / 100);
  const valid = Number.isInteger(shownRate) && shownRate >= 15 && shownRate <= 500;
  const gross = valid ? sessionPrice(shownRate * 100, 60) : 0;
  const fee = applyBps(gross, plan.commissionBps);

  const preview = (
    <div className="rounded-lg border border-line bg-canvas p-3.5 text-[13px]">
      <p className="font-medium text-ink">Per 60-minute lesson</p>
      <dl className="mt-2 space-y-1">
        <div className="flex justify-between">
          <dt className="text-muted">Family pays</dt>
          <dd className="tabular-nums text-ink">{valid ? formatCents(gross) : "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">
            {plan.name} commission ({plan.commissionBps / 100}%)
          </dt>
          <dd className="tabular-nums text-ink-2">{valid ? `−${formatCents(fee)}` : "—"}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-1">
          <dt className="font-medium text-ink">You earn</dt>
          <dd className="font-semibold tabular-nums text-ink">{valid ? formatCents(gross - fee) : "—"}</dd>
        </div>
      </dl>
    </div>
  );

  return (
    <Section
      id="rates"
      title="Rate & teaching modes"
      editing={ed.editing}
      onEdit={() => {
        reset(values());
        ed.open();
      }}
    >
      {ed.editing ? (
        <form
          noValidate
          onSubmit={handleSubmit((v) => ed.run(update({ hourlyRateCents: v.hourlyRate * 100, modes: v.modes, serviceRadiusMiles: v.serviceRadiusMiles }), "Rate and modes saved"))}
          className="space-y-5"
        >
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="space-y-5">
              <Field label="Hourly rate" required hint="$15–$500. Applies to new bookings only." error={errors.hourlyRate?.message} className="max-w-56">
                <Input type="number" inputMode="numeric" prefixText="$" suffix={<span className="pr-1 text-sm">/hr</span>} {...register("hourlyRate", { valueAsNumber: true })} />
              </Field>
              <Controller
                name="modes"
                control={control}
                render={({ field }) => (
                  <GroupField legend="Teaching modes" required error={errors.modes?.message}>
                    <ChipGroup label="Teaching modes" options={[{ value: "online", label: "Online" }, { value: "in_person", label: "In person" }]} value={field.value} onChange={field.onChange} />
                  </GroupField>
                )}
              />
              {modes?.includes("in_person") && (
                <Field label="Service radius" required hint="How far you'll travel from your ZIP code." error={errors.serviceRadiusMiles?.message} className="max-w-56">
                  <Input type="number" inputMode="numeric" suffix={<span className="pr-1 text-sm">miles</span>} {...register("serviceRadiusMiles", { valueAsNumber: true })} />
                </Field>
              )}
            </div>
            {preview}
          </div>
          <FormActions onCancel={ed.close} error={ed.error} />
        </form>
      ) : (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_16rem]">
          <dl className="divide-y divide-line">
            <DetailRow label="Hourly rate">{formatCents(tutor.hourlyRateCents)}/hr</DetailRow>
            <DetailRow label="Teaching modes">
              <span className="inline-flex items-center gap-1.5">
                {tutor.modes.includes("online") && <Monitor className="size-3.5 text-muted" aria-hidden />}
                {tutor.modes.includes("in_person") && <Users className="size-3.5 text-muted" aria-hidden />}
                {tutor.modes.map((m) => MODE_LABEL[m]).join(" & ")}
              </span>
            </DetailRow>
            {tutor.modes.includes("in_person") && <DetailRow label="Service radius">{tutor.serviceRadiusMiles} miles from {tutor.city}</DetailRow>}
          </dl>
          {preview}
        </div>
      )}
    </Section>
  );
}

/* ─── Trial ─────────────────────────────────────────────────────────────────── */

const TRIAL_LENGTHS = [15, 20, 25, 30, 45, 60];
const trialSchema = z.object({
  enabled: z.boolean(),
  price: z.number({ invalid_type_error: "Enter a price (0 for free)." }).int("Use whole dollars.").min(0, "Enter 0 or more.").max(200, "Trial lessons can be up to $200."),
  durationMin: z.number().refine((v) => TRIAL_LENGTHS.includes(v), "Choose a trial length."),
});
type TrialValues = z.infer<typeof trialSchema>;

function TrialSection({ tutor }: { tutor: Tutor }) {
  const setTrial = useApp((s) => s.setTrial);
  const trialsOn = useFlag("trial_lessons");
  const ed = useEditor();
  const values = (): TrialValues => ({ enabled: tutor.trial.enabled, price: Math.round(tutor.trial.priceCents / 100), durationMin: tutor.trial.durationMin });
  const form = useForm<TrialValues>({ resolver: zodResolver(trialSchema), mode: "onTouched", defaultValues: values() });
  const { register, control, handleSubmit, reset, formState: { errors } } = form;
  const enabled = useWatch({ control, name: "enabled" });
  return (
    <Section
      id="trial"
      title="Trial lesson"
      description="A short first session so families can see if you're a good fit. One per student."
      editing={ed.editing}
      onEdit={() => {
        reset(values());
        ed.open();
      }}
    >
      {!trialsOn && (
        <InlineAlert tone="warning" className="mb-4">
          Trial lessons are turned off across TutorLink right now. Your settings are kept for when they return.
        </InlineAlert>
      )}
      {ed.editing ? (
        <form noValidate onSubmit={handleSubmit((v) => ed.run(setTrial({ enabled: v.enabled, priceCents: v.price * 100, durationMin: v.durationMin }), "Trial settings saved"))} className="space-y-5">
          <Controller
            name="enabled"
            control={control}
            render={({ field }) => (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-line px-4 py-3">
                <label htmlFor="trial-enabled" className="text-sm font-medium text-ink">
                  Offer a trial lesson
                </label>
                <Switch id="trial-enabled" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
          {enabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="durationMin"
                control={control}
                render={({ field }) => (
                  <Field label="Length" error={errors.durationMin?.message}>
                    <Select ref={field.ref} value={String(field.value)} onChange={(e) => field.onChange(Number(e.target.value))} options={TRIAL_LENGTHS.map((m) => ({ value: String(m), label: `${m} minutes` }))} />
                  </Field>
                )}
              />
              <Field label="Price" hint="Enter 0 for a free trial." error={errors.price?.message}>
                <Input type="number" inputMode="numeric" prefixText="$" {...register("price", { valueAsNumber: true })} />
              </Field>
            </div>
          )}
          <FormActions onCancel={ed.close} error={ed.error} />
        </form>
      ) : (
        <dl className="divide-y divide-line">
          <DetailRow label="Status">{tutor.trial.enabled ? <Badge tone="success" size="sm">Offered</Badge> : <Badge size="sm">Not offered</Badge>}</DetailRow>
          {tutor.trial.enabled && (
            <>
              <DetailRow label="Length">{tutor.trial.durationMin} minutes</DetailRow>
              <DetailRow label="Price">{tutor.trial.priceCents ? formatCents(tutor.trial.priceCents) : "Free"}</DetailRow>
            </>
          )}
        </dl>
      )}
    </Section>
  );
}

/* ─── Booking rules ─────────────────────────────────────────────────────────── */

const SESSION_OPTIONS = [30, 45, 60, 90, 120];
const rulesSchema = z.object({
  minNoticeHours: z.number(),
  maxAdvanceDays: z.number(),
  bufferMinutes: z.number(),
  sessionLengths: z.array(z.number()).min(1, "Offer at least one lesson length."),
  instant: z.boolean(),
});
type RulesValues = z.infer<typeof rulesSchema>;

const NOTICE = [1, 2, 4, 6, 12, 24, 48, 72, 168];
const ADVANCE = [7, 14, 30, 45, 60, 90, 120, 180];
const BUFFER = [0, 5, 10, 15, 20, 30, 45, 60];
const withCurrent = (list: number[], v: number) => (list.includes(v) ? list : [...list, v].sort((a, b) => a - b));

function BookingRulesSection({ tutor }: { tutor: Tutor }) {
  const setRules = useApp((s) => s.setBookingRules);
  const instantFlag = useFlag("instant_booking");
  const ed = useEditor();
  const values = (): RulesValues => ({ ...tutor.rules, instant: !tutor.rules.requiresApproval });
  const form = useForm<RulesValues>({ resolver: zodResolver(rulesSchema), mode: "onTouched", defaultValues: values() });
  const { control, handleSubmit, reset, formState: { errors } } = form;
  const r = tutor.rules;
  const instantActive = !r.requiresApproval && instantFlag;

  const save = (v: RulesValues) =>
    ed.run(
      setRules({
        minNoticeHours: v.minNoticeHours,
        maxAdvanceDays: v.maxAdvanceDays,
        bufferMinutes: v.bufferMinutes,
        sessionLengths: [...v.sessionLengths].sort((a, b) => a - b),
        // While the platform has instant booking off, leave the tutor's preference untouched.
        ...(instantFlag ? { requiresApproval: !v.instant } : {}),
      }),
      "Booking rules saved",
    );

  const numberSelect = (name: "minNoticeHours" | "maxAdvanceDays" | "bufferMinutes", label: string, list: number[], fmt: (n: number) => string) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Field label={label}>
          <Select ref={field.ref} value={String(field.value)} onChange={(e) => field.onChange(Number(e.target.value))} options={withCurrent(list, field.value).map((n) => ({ value: String(n), label: fmt(n) }))} />
        </Field>
      )}
    />
  );

  return (
    <Section
      id="booking-rules"
      title="Booking rules"
      description="Controls when and how families can book you."
      editing={ed.editing}
      onEdit={() => {
        reset(values());
        ed.open();
      }}
    >
      {ed.editing ? (
        <form noValidate onSubmit={handleSubmit(save)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            {numberSelect("minNoticeHours", "Minimum notice", NOTICE, (n) => (n >= 24 && n % 24 === 0 ? `${n / 24} ${n === 24 ? "day" : "days"}` : `${n} ${n === 1 ? "hour" : "hours"}`))}
            {numberSelect("maxAdvanceDays", "Book up to", ADVANCE, (n) => `${n} days ahead`)}
            {numberSelect("bufferMinutes", "Buffer between lessons", BUFFER, (n) => (n ? `${n} minutes` : "No buffer"))}
          </div>
          <Controller
            name="sessionLengths"
            control={control}
            render={({ field }) => (
              <GroupField legend="Lesson lengths" required hint="Families choose from these when booking regular lessons." error={errors.sessionLengths?.message}>
                <ChipGroup label="Lesson lengths" options={SESSION_OPTIONS.map((m) => ({ value: String(m), label: formatDuration(m) }))} value={field.value.map(String)} onChange={(v) => field.onChange(v.map(Number))} />
              </GroupField>
            )}
          />
          <Controller
            name="instant"
            control={control}
            render={({ field }) => (
              <div className="flex items-start justify-between gap-4 rounded-lg border border-line px-4 py-3">
                <div>
                  <label htmlFor="instant-booking" className="text-sm font-medium text-ink">
                    Instant booking
                  </label>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {instantFlag ? "Families can book open times without waiting for you to accept." : "Instant booking is turned off across TutorLink right now, so every request needs your approval."}
                  </p>
                </div>
                <Switch id="instant-booking" checked={instantFlag && field.value} onCheckedChange={field.onChange} disabled={!instantFlag} />
              </div>
            )}
          />
          <FormActions onCancel={ed.close} error={ed.error} />
        </form>
      ) : (
        <dl className="divide-y divide-line">
          <DetailRow label="Minimum notice">{r.minNoticeHours} hours</DetailRow>
          <DetailRow label="Book up to">{r.maxAdvanceDays} days ahead</DetailRow>
          <DetailRow label="Buffer">{r.bufferMinutes ? `${r.bufferMinutes} minutes` : "None"}</DetailRow>
          <DetailRow label="Lesson lengths">{r.sessionLengths.map(formatDuration).join(", ")}</DetailRow>
          <DetailRow label="Approval">
            {instantActive ? (
              <span className="inline-flex items-center gap-1">
                <Zap className="size-3.5 text-ink" aria-hidden /> Instant booking
              </span>
            ) : (
              "You approve each request"
            )}
          </DetailRow>
        </dl>
      )}
    </Section>
  );
}

/* ─── Credentials (read-only) ───────────────────────────────────────────────── */

function CredentialsSection({ tutor }: { tutor: Tutor }) {
  return (
    <Section id="credentials" title="Education & certifications" description="Verified entries show a check on your public profile." editing={false}>
      {tutor.education.length + tutor.certifications.length === 0 ? (
        <p className="text-sm text-muted">No education or certifications listed.</p>
      ) : (
        <ul className="divide-y divide-line">
          {tutor.education.map((e, i) => (
            <li key={`e${i}`} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <span>
                <span className="font-medium text-ink">
                  {e.degree} {e.field}
                </span>
                <span className="block text-[13px] text-muted">
                  {e.institution} · {e.year}
                </span>
              </span>
              {e.verified ? (
                <Badge tone="success" size="sm">
                  <BadgeCheck /> Verified
                </Badge>
              ) : (
                <Badge size="sm">Unverified</Badge>
              )}
            </li>
          ))}
          {tutor.certifications.map((c, i) => (
            <li key={`c${i}`} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <span>
                <span className="font-medium text-ink">{c.name}</span>
                <span className="block text-[13px] text-muted">
                  {c.issuer} · {c.year}
                </span>
              </span>
              {c.verified ? (
                <Badge tone="success" size="sm">
                  <BadgeCheck /> Verified
                </Badge>
              ) : (
                <Badge size="sm">Unverified</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
      <Link href="/dashboard/verification" className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:underline">
        Upload documents in Verification <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </Section>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────────── */

/** Upload (or remove) the profile photo. The picture is shrunk in the browser and saved with the profile. */
function PhotoPicker({ hasPhoto }: { hasPhoto: boolean }) {
  const update = useApp((s) => s.updateTutorProfile);
  const id = React.useId();
  const [busy, setBusy] = React.useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) return toast.error("Choose a PNG, JPG or WebP image.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Choose an image under 5 MB.");
    setBusy(true);
    try {
      const photoUrl = await imageFileToDataUrl(file);
      const res = update({ photoUrl });
      if (!res.ok) toast.error(res.error);
      else toast.success("Profile photo updated", { description: "It shows on your cards and profile straight away." });
    } catch {
      toast.error("That image couldn't be read. Try a different file.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        htmlFor={id}
        className={cn("inline-flex h-9 cursor-pointer items-center gap-2 border border-line-strong bg-surface px-3.5 text-[13.5px] font-medium text-ink transition-colors hover:bg-sunken", busy && "pointer-events-none opacity-60")}
      >
        <ImageUp className="size-4" aria-hidden /> {busy ? "Saving…" : hasPhoto ? "Change photo" : "Upload a photo"}
        <input
          id={id}
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
      {hasPhoto && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const res = update({ photoUrl: undefined });
            if (!res.ok) toast.error(res.error);
            else toast.success("Photo removed");
          }}
        >
          Remove
        </Button>
      )}
      <p className="basis-full text-[12.5px] text-muted">A clear, friendly headshot. PNG, JPG or WebP up to 5 MB.</p>
    </div>
  );
}

export function ProfileView() {
  const { me, tutor } = useMyTutor();

  // Deep links such as /dashboard/profile#booking-rules: scroll once the sections exist.
  const ready = !!tutor;
  React.useEffect(() => {
    if (!ready || !window.location.hash) return;
    const el = document.getElementById(window.location.hash.slice(1));
    if (!el) return;
    const t = setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    return () => clearTimeout(t);
  }, [ready]);

  if (!me || !tutor) return <NeedsTutorProfile what="your profile" />;
  const checklist = profileChecklist(tutor);
  const pct = completionPercent(checklist);

  return (
    <div>
      <PageHeader
        title="My profile"
        description="Changes are saved section by section and show on your public profile right away."
        actions={
          <Button asChild variant="secondary">
            <Link href={`/tutors/${tutor.slug}`}>
              View public profile <ExternalLink />
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <AboutSection tutor={tutor} />
          <SubjectsSection tutor={tutor} />
          <RatesSection tutor={tutor} />
          <TrialSection tutor={tutor} />
          <BookingRulesSection tutor={tutor} />
          <LanguagesSection tutor={tutor} />
          <CredentialsSection tutor={tutor} />
        </div>

        <aside className="order-first space-y-6 xl:order-none">
          <div className="space-y-6 xl:sticky xl:top-20">
            <Card>
              <CardContent className="flex items-center gap-4">
                <Avatar name={`${tutor.firstName} ${tutor.lastName}`} src={tutor.photoUrl} tone={tutor.tone} size="lg" verified={tutor.verification.identity === "verified"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">
                    {tutor.firstName} {tutor.lastName}
                  </p>
                  <p className="truncate text-[13px] text-muted">
                    {TUTOR_CATEGORY_LABEL[tutor.category]} · {tutor.city}, {tutor.state}
                  </p>
                  <StarRating rating={tutor.rating} count={tutor.reviewCount} className="mt-1" />
                </div>
              </CardContent>
              <div className="border-t border-line px-5 py-3">
                <PhotoPicker hasPhoto={!!tutor.photoUrl} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Profile strength" description={`${checklist.filter((c) => c.done).length} of ${checklist.length} complete`} action={<span className="text-lg font-semibold tabular-nums text-ink">{pct}%</span>} />
              <CardContent className="pt-3">
                <Progress value={pct} label="Profile completion" tone={pct === 100 ? "success" : "navy"} />
                <ul className="mt-4 space-y-1">
                  {checklist.map((c) => (
                    <li key={c.key}>
                      <Link href={c.href} className="group flex items-center gap-2.5 rounded-md px-1.5 py-1 text-[13px] transition-colors hover:bg-sunken">
                        <span className={cn("grid size-4 shrink-0 place-items-center rounded-full", c.done ? "bg-success text-white" : "border border-line-strong")} aria-hidden>
                          {c.done && <Check className="size-2.5" strokeWidth={3.5} />}
                        </span>
                        <span className={cn("flex-1", c.done ? "text-muted" : "font-medium text-ink")}>
                          {c.label}
                          <span className="sr-only">{c.done ? " (done)" : " (to do)"}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}
