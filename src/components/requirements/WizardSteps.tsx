"use client";

import * as React from "react";
import Link from "next/link";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { FileText, Info, MapPin, Monitor, Paperclip, Pencil, ShieldCheck, Shuffle, Upload, UserRound, Users, X } from "lucide-react";
import type { Child, Grade, Role } from "@/lib/types";
import { GRADES, GRADE_LABEL, LANGUAGES, LEARNING_SUPPORT, TIMES_OF_DAY, US_STATES, subjectName } from "@/lib/data/catalog";
import { resolveLocation } from "@/lib/data/geo";
import { formatCents } from "@/lib/format";
import { useTutors } from "@/lib/store/hooks";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { ChipGroup, RadioCards, Segmented } from "@/components/ui/Controls";
import { InlineAlert } from "@/components/ui/States";
import { AnimatePresence, motion } from "@/components/motion";
import { GroupField } from "@/components/concierge/AnswerFields";
import { JobPosting } from "@/components/jobs/JobPosting";
import { DAY_ORDER, EXPERIENCE_OPTIONS, defaultTitle, type TimeOfDay } from "@/components/jobs/jobUtils";
import { cn } from "@/lib/utils";
import { SubjectSelect, fieldDescribedBy } from "./SubjectSelect";
import { LIMITS, STEPS, cityForZip, formatToModes, type Attachment, type Format, type ReqForm } from "./model";

/* ─── Step 1 · Learner & subject ───────────────────────────────────────────── */

export function StepLearner({ role, kids, firstName, titleAuto, setTitleAuto }: { role: "student" | "parent"; kids: Child[]; firstName: string; titleAuto: boolean; setTitleAuto: (v: boolean) => void }) {
  const { control, register, setValue, formState } = useFormContext<ReqForm>();
  const errors = formState.errors;
  const subject = useWatch<ReqForm, "subject">({ name: "subject" });
  const grade = useWatch<ReqForm, "grade">({ name: "grade" });
  const title = useWatch<ReqForm, "title">({ name: "title" });
  const suggested = defaultTitle(subject, grade);

  const refreshTitle = (s: string, g: ReqForm["grade"]) => {
    if (titleAuto) setValue("title", defaultTitle(s, g), { shouldDirty: true, shouldValidate: !!errors.title });
  };

  return (
    <div className="space-y-7">
      {role === "parent" ? (
        kids.length === 0 ? (
          <InlineAlert
            tone="warning"
            title="Add your child first"
            action={
              <Button asChild size="sm" variant="secondary">
                <Link href="/dashboard/children">Add a child</Link>
              </Button>
            }
          >
            Requirements from parent accounts are posted for one of your children. Add a child profile, then come back — your progress here is saved.
          </InlineAlert>
        ) : (
          <GroupField legend="Who is this for?" error={errors.childId?.message} hint="Your child's name is never shown to tutors.">
            <Controller
              control={control}
              name="childId"
              render={({ field }) => (
                <RadioCards
                  name="req-child"
                  value={field.value || undefined}
                  columns={kids.length > 2 ? 3 : 2}
                  onValueChange={(id) => {
                    field.onChange(id);
                    const kid = kids.find((k) => k.id === id);
                    if (kid) {
                      setValue("grade", kid.grade, { shouldDirty: true, shouldValidate: !!errors.grade });
                      refreshTitle(subject, kid.grade);
                    }
                  }}
                  options={kids.map((k) => ({
                    value: k.id,
                    label: k.firstName,
                    description: GRADE_LABEL[k.grade] + (k.subjects.length ? ` · ${k.subjects.slice(0, 2).map(subjectName).join(", ")}` : ""),
                    icon: <UserRound />,
                  }))}
                />
              )}
            />
          </GroupField>
        )
      ) : (
        <p className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3.5 py-2.5 text-[13.5px] text-ink-2">
          <UserRound className="size-4 text-muted" aria-hidden /> Posting for yourself, {firstName}. Your name is never shown to tutors.
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr]">
        <Field label="Subject" id="req-subject" required error={errors.subject?.message}>
          <Controller
            control={control}
            name="subject"
            render={({ field }) => (
              <SubjectSelect
                id="req-subject"
                ref={field.ref}
                name={field.name}
                value={field.value}
                onBlur={field.onBlur}
                onChange={(v) => {
                  field.onChange(v);
                  refreshTitle(v, grade);
                }}
                invalid={!!errors.subject}
                aria-describedby={fieldDescribedBy("req-subject", errors.subject?.message)}
                aria-required
              />
            )}
          />
        </Field>
        <Field label="Grade" id="req-grade" required error={errors.grade?.message}>
          <Controller
            control={control}
            name="grade"
            render={({ field }) => (
              <Select
                id="req-grade"
                ref={field.ref}
                name={field.name}
                value={field.value}
                onBlur={field.onBlur}
                onChange={(e) => {
                  const g = e.target.value as ReqForm["grade"];
                  field.onChange(g);
                  refreshTitle(subject, g);
                }}
                placeholder="Choose a grade"
                options={GRADES.map((g) => ({ value: g.value, label: g.label }))}
                aria-required
              />
            )}
          />
        </Field>
      </div>

      <Field
        label="Title"
        id="req-title"
        required
        error={errors.title?.message}
        hint={
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>Tutors see this first. Keep names out of it.</span>
            <span className="tabular-nums">{title.trim().length}/{LIMITS.titleMax}</span>
          </span>
        }
      >
        <Input
          id="req-title"
          maxLength={LIMITS.titleMax}
          placeholder={suggested || "e.g. Algebra tutor for an 8th grader"}
          {...register("title", { onChange: () => setTitleAuto(false) })}
        />
      </Field>
      <AnimatePresence initial={false}>
        {suggested && title.trim() !== suggested && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="-mt-4 overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setValue("title", suggested, { shouldDirty: true, shouldValidate: true });
                setTitleAuto(true);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md text-[13px] font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2"
            >
              Use suggested title: “{suggested}”
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Step 2 · Goals ────────────────────────────────────────────────────────── */

export function StepGoals() {
  const { control, formState } = useFormContext<ReqForm>();
  const errors = formState.errors;
  const objectives = useWatch<ReqForm, "objectives">({ name: "objectives" });
  const len = objectives.trim().length;
  return (
    <div className="space-y-7">
      <Field
        label="Learning objectives"
        id="req-objectives"
        required
        error={errors.objectives?.message}
        hint={len < LIMITS.objectivesMin ? `${LIMITS.objectivesMin - len} more ${LIMITS.objectivesMin - len === 1 ? "character" : "characters"} needed.` : "Great — the more specific, the better the applications."}
      >
        <Controller
          control={control}
          name="objectives"
          render={({ field }) => (
            <Textarea
              id="req-objectives"
              rows={6}
              maxLength={LIMITS.objectivesMax}
              showCount
              placeholder="Where things stand now, what feels hard, and what you'd like to achieve — e.g. “Keep an A in AP Calc and feel ready for the May exam.”"
              {...field}
            />
          )}
        />
      </Field>
      <div className="rounded-xl bg-canvas px-4 py-3.5">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <Info className="size-3.5 text-ink" aria-hidden /> Helpful things to mention
        </p>
        <ul className="mt-2 grid gap-1 text-[13px] text-muted sm:grid-cols-2">
          <li>· Current level or recent grades</li>
          <li>· Topics that feel hardest</li>
          <li>· A deadline: test date, report card, exam</li>
          <li>· How the learner likes to learn</li>
        </ul>
      </div>
      <GroupField legend="Learning support needs" optional hint="Helps specialists find you. You don't need to share a diagnosis.">
        <Controller
          control={control}
          name="learningSupport"
          render={({ field }) => <ChipGroup label="Learning support needs" value={field.value} onChange={field.onChange} options={LEARNING_SUPPORT.map((s) => ({ value: s, label: s }))} />}
        />
      </GroupField>
    </div>
  );
}

/* ─── Step 3 · Format & location ────────────────────────────────────────────── */

export function StepFormat() {
  const { control, register, setValue, getValues, formState } = useFormContext<ReqForm>();
  const errors = formState.errors;
  const format = useWatch<ReqForm, "format">({ name: "format" });
  const zip = useWatch<ReqForm, "zip">({ name: "zip" });
  const inPerson = format === "in_person" || format === "both";
  const point = /^\d{5}$/.test(zip) ? resolveLocation(zip) : null;

  return (
    <div className="space-y-7">
      <GroupField legend="How should lessons happen?" error={errors.format?.message}>
        <Controller
          control={control}
          name="format"
          render={({ field }) => (
            <RadioCards<Exclude<Format, "">>
              name="req-format"
              value={field.value || undefined}
              onValueChange={field.onChange}
              columns={3}
              options={[
                { value: "online", label: "Online", description: "Video lessons from anywhere", icon: <Monitor /> },
                { value: "in_person", label: "In person", description: "Meet locally", icon: <Users /> },
                { value: "both", label: "Either works", description: "Reach the most tutors", icon: <Shuffle /> },
              ]}
            />
          )}
        />
      </GroupField>

      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-ink">
            Location {!inPerson && <span className="font-normal text-muted">(optional for online lessons)</span>}
          </p>
          <p className="mt-0.5 text-[13px] text-muted">{inPerson ? "Tutors use this to check whether you're inside their service area." : "Helps tutors in your time zone find you."}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-[150px_1fr_1fr]">
          <Field label="ZIP code" id="req-zip" required={inPerson} error={errors.zip?.message} hint={point ? point.label.replace(/^\d{5} · /, "") : undefined}>
            <Input
              id="req-zip"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              placeholder="11201"
              icon={<MapPin />}
              {...register("zip", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  const clean = e.target.value.replace(/\D/g, "").slice(0, 5);
                  if (clean !== e.target.value) setValue("zip", clean);
                  const hit = clean.length === 5 ? cityForZip(clean) : null;
                  if (hit && !getValues("city").trim()) {
                    setValue("city", hit.city, { shouldValidate: !!errors.city });
                    setValue("state", hit.state, { shouldValidate: !!errors.state });
                  }
                },
              })}
            />
          </Field>
          <Field label="City" id="req-city" required={inPerson} error={errors.city?.message}>
            <Input id="req-city" autoComplete="address-level2" placeholder="Brooklyn" {...register("city")} />
          </Field>
          <Field label="State" id="req-state" required={inPerson} error={errors.state?.message}>
            <Controller
              control={control}
              name="state"
              render={({ field }) => <Select id="req-state" autoComplete="address-level1" placeholder="Choose a state" options={US_STATES} {...field} />}
            />
          </Field>
        </div>
      </div>

      <InlineAlert tone="info" title="Your address stays private">
        Tutors only see your city{inPerson ? " and ZIP code" : ""} — never your street address, name or contact details. You&apos;ll agree on a meeting place in messages after choosing a tutor.
      </InlineAlert>
    </div>
  );
}

/* ─── Step 4 · Schedule ─────────────────────────────────────────────────────── */

const DAY_PRESETS = [
  { label: "Weekdays", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
  { label: "Weekends", days: ["Sat", "Sun"] },
  { label: "Any day", days: [...DAY_ORDER] },
];

export function StepSchedule() {
  const { control, setValue, formState } = useFormContext<ReqForm>();
  const errors = formState.errors;
  return (
    <div className="space-y-8">
      <GroupField legend="Which days work?" error={errors.days?.message} hint="Pick every day that could work — more days means more tutors can apply.">
        <Controller
          control={control}
          name="days"
          render={({ field }) => (
            <div className="space-y-3">
              <ChipGroup label="Preferred days" value={field.value} onChange={field.onChange} options={DAY_ORDER.map((d) => ({ value: d as string, label: d }))} />
              <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                <span className="text-muted">Quick pick:</span>
                {DAY_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setValue("days", p.days, { shouldDirty: true, shouldValidate: true })}
                    className="inline-flex h-8 items-center rounded-md px-2 font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:bg-canvas"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        />
      </GroupField>

      <GroupField legend="What times of day?" error={errors.timesOfDay?.message} hint="In your local time.">
        <Controller
          control={control}
          name="timesOfDay"
          render={({ field }) => (
            <ChipGroup
              label="Preferred times of day"
              value={field.value}
              onChange={field.onChange}
              options={TIMES_OF_DAY.map((t) => ({ value: t.value as TimeOfDay, label: <span>{t.label} <span className="font-normal opacity-70">{t.range}</span></span> }))}
            />
          )}
        />
      </GroupField>

      <GroupField legend="Sessions per week" error={errors.sessionsPerWeek?.message}>
        <Controller
          control={control}
          name="sessionsPerWeek"
          render={({ field }) => (
            <Segmented
              label="Sessions per week"
              value={String(field.value)}
              onChange={(v) => field.onChange(Number(v))}
              options={["1", "2", "3", "4", "5"].map((n) => ({ value: n, label: `${n}×` }))}
            />
          )}
        />
      </GroupField>
    </div>
  );
}

/* ─── Step 5 · Budget & preferences ─────────────────────────────────────────── */

const ACCEPTED = [".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx"];

function AttachmentsField() {
  const { control } = useFormContext<ReqForm>();
  const [errs, setErrs] = React.useState<string[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <Controller
      control={control}
      name="attachments"
      render={({ field }) => {
        const files: Attachment[] = field.value;
        const add = (list: FileList | null) => {
          if (!list) return;
          const next = [...files];
          const problems: string[] = [];
          for (const f of Array.from(list)) {
            const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
            if (!ACCEPTED.includes(ext)) problems.push(`“${f.name}” isn't a supported type. Use PDF, PNG, JPG, DOC or DOCX.`);
            else if (f.size > LIMITS.maxFileMb * 1024 * 1024) problems.push(`“${f.name}” is larger than ${LIMITS.maxFileMb} MB.`);
            else if (next.some((x) => x.name === f.name)) problems.push(`“${f.name}” is already attached.`);
            else if (next.length >= LIMITS.maxFiles) problems.push(`You can attach up to ${LIMITS.maxFiles} files — “${f.name}” wasn't added.`);
            else next.push({ name: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)) });
          }
          setErrs(problems);
          if (next.length !== files.length) field.onChange(next);
          if (inputRef.current) inputRef.current.value = "";
        };
        return (
          <GroupField legend="Attachments" optional hint={`Up to ${LIMITS.maxFiles} files, ${LIMITS.maxFileMb} MB each — PDF, PNG, JPG, DOC or DOCX. In this preview only the file name and size are saved.`}>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                add(e.dataTransfer.files);
              }}
              className={cn("flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors", dragging ? "border-ink bg-brand-soft" : "border-line-strong bg-canvas")}
            >
              <Upload className="size-5 text-muted" aria-hidden />
              <p className="text-[13.5px] text-ink-2">
                Drag files here or{" "}
                <label htmlFor="req-files" className="cursor-pointer font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
                  browse
                </label>
              </p>
              <input
                ref={inputRef}
                id="req-files"
                type="file"
                multiple
                accept={ACCEPTED.join(",")}
                className="sr-only"
                disabled={files.length >= LIMITS.maxFiles}
                onChange={(e) => add(e.target.files)}
              />
              <p className="text-[12px] tabular-nums text-muted">
                {files.length}/{LIMITS.maxFiles} attached
              </p>
            </div>
            {errs.length > 0 && (
              <ul role="alert" className="space-y-1">
                {errs.map((m) => (
                  <li key={m} className="text-[13px] text-danger">
                    {m}
                  </li>
                ))}
              </ul>
            )}
            {files.length > 0 && (
              <ul className="divide-y divide-line rounded-lg border border-line">
                <AnimatePresence initial={false}>
                  {files.map((f) => (
                    <motion.li key={f.name} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 overflow-hidden px-3.5 py-2.5">
                      <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{f.name}</span>
                      <span className="shrink-0 text-[12px] tabular-nums text-muted">{f.sizeKb >= 1024 ? `${(f.sizeKb / 1024).toFixed(1)} MB` : `${f.sizeKb} KB`}</span>
                      <button
                        type="button"
                        onClick={() => {
                          field.onChange(files.filter((x) => x.name !== f.name));
                          setErrs([]);
                        }}
                        className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink"
                        aria-label={`Remove ${f.name}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </GroupField>
        );
      }}
    />
  );
}

function RateContext({ subject }: { subject: string }) {
  const tutors = useTutors();
  const rates = React.useMemo(() => tutors.filter((t) => t.subjects.includes(subject)).map((t) => t.hourlyRateCents).sort((a, b) => a - b), [tutors, subject]);
  if (!subject || rates.length < 2) return null;
  return (
    <p className="flex items-start gap-2 text-[13px] text-muted">
      <Info className="mt-0.5 size-3.5 shrink-0 text-ink" aria-hidden />
      <span>
        For reference, the {rates.length} tutors who list {subjectName(subject)} on TutorLink charge {formatCents(rates[0])}–{formatCents(rates[rates.length - 1])}/hr.
      </span>
    </p>
  );
}

export function StepBudget() {
  const { control, register, setValue, formState } = useFormContext<ReqForm>();
  const errors = formState.errors;
  const subject = useWatch<ReqForm, "subject">({ name: "subject" });
  const digitsOnly = (name: "budgetMin" | "budgetMax") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, "").slice(0, 3);
    if (clean !== e.target.value) setValue(name, clean);
  };
  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Minimum hourly rate" id="req-bmin" required error={errors.budgetMin?.message}>
            <Input id="req-bmin" inputMode="numeric" prefixText="$" suffix={<span className="pr-1 text-[13px]">/hr</span>} placeholder="40" {...register("budgetMin", { onChange: digitsOnly("budgetMin") })} />
          </Field>
          <Field label="Maximum hourly rate" id="req-bmax" required error={errors.budgetMax?.message}>
            <Input id="req-bmax" inputMode="numeric" prefixText="$" suffix={<span className="pr-1 text-[13px]">/hr</span>} placeholder="80" {...register("budgetMax", { onChange: digitsOnly("budgetMax") })} />
          </Field>
        </div>
        <RateContext subject={subject} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Minimum experience" id="req-exp" optional>
          <Select id="req-exp" options={EXPERIENCE_OPTIONS} {...register("minExperience")} />
        </Field>
      </div>

      <GroupField legend="Lesson language" error={errors.languages?.message} hint="Tutors who list a language other than English score higher for your requirement.">
        <Controller control={control} name="languages" render={({ field }) => <ChipGroup label="Lesson language" size="sm" value={field.value} onChange={field.onChange} options={LANGUAGES.map((l) => ({ value: l, label: l }))} />} />
      </GroupField>

      <Field label="Tutor preferences" id="req-prefs" optional error={errors.preferences?.message} hint="e.g. certified teacher, Orton-Gillingham training, patient with younger kids.">
        <Controller control={control} name="preferences" render={({ field }) => <Textarea id="req-prefs" rows={3} maxLength={LIMITS.preferencesMax} showCount {...field} />} />
      </Field>

      <Field label="Additional details" id="req-details" optional error={errors.details?.message} hint="Anything else tutors should know. Don't include phone numbers, emails or your address.">
        <Controller control={control} name="details" render={({ field }) => <Textarea id="req-details" rows={4} maxLength={LIMITS.detailsMax} showCount {...field} />} />
      </Field>

      <AttachmentsField />
    </div>
  );
}

/* ─── Step 6 · Preview ──────────────────────────────────────────────────────── */

export function StepPreview({ role, now, onEdit }: { role: Role; now: number; onEdit: (step: number) => void }) {
  const v = useWatch<ReqForm>() as unknown as ReqForm;
  const job = {
    title: v.title.trim(),
    subject: v.subject,
    grade: (v.grade || "9") as Grade,
    objectives: v.objectives.trim(),
    modes: formatToModes(v.format),
    city: v.city.trim(),
    state: v.state,
    zip: v.zip,
    days: v.days,
    timesOfDay: v.timesOfDay,
    sessionsPerWeek: v.sessionsPerWeek,
    budgetMinCents: Number(v.budgetMin || 0) * 100,
    budgetMaxCents: Number(v.budgetMax || 0) * 100,
    minExperienceYears: v.minExperience ? Number(v.minExperience) : undefined,
    languages: v.languages,
    preferences: v.preferences,
    details: v.details,
    attachments: v.attachments,
    learningSupport: v.learningSupport,
  };
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-line">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-canvas px-4 py-2.5">
          <p className="flex items-center gap-2 text-[12.5px] font-medium text-muted">
            <ShieldCheck className="size-3.5 text-ink" aria-hidden /> Exactly what tutors will see
          </p>
          <Badge tone="outline" size="sm">Preview</Badge>
        </div>
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <JobPosting job={job} ownerRole={role} now={now} preview headingLevel="h2" applicants={0} />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-ink">Need to change something?</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {STEPS.slice(0, -1).map((s, i) => (
            <li key={s.title}>
              <Button type="button" size="sm" variant="secondary" onClick={() => onEdit(i)}>
                <Pencil /> {s.title}
              </Button>
            </li>
          ))}
        </ul>
        {v.attachments.length > 0 && (
          <p className="mt-4 flex items-center gap-2 text-[13px] text-muted">
            <Paperclip className="size-3.5" aria-hidden /> Tutors see that {v.attachments.length === 1 ? "a file is" : `${v.attachments.length} files are`} attached, not the file names.
          </p>
        )}
      </div>
    </div>
  );
}
