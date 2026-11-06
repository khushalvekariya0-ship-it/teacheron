"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, type DefaultValues, type FieldValues, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ArrowRight, Check, Lock, Search } from "lucide-react";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { currencyForCountry } from "@/lib/money";
import { useApp, type Result } from "@/lib/store";
import { useSession } from "@/lib/store/hooks";
import { GRADE_LABEL } from "@/lib/data/catalog";
import { toQueryString } from "@/lib/search";
import { PageHeader } from "@/components/dashboard/Shell";
import { FormActions, Section, useEditor } from "@/components/dashboard/tutor/ProfileView";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, DetailRow } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Controls";
import { InlineAlert } from "@/components/ui/States";
import { BasicFields, BudgetFields, LearningFields, PreferencesFields, ScheduleFields } from "./fields";
import {
  basicSchema, basicValues, budgetSchemaFor, budgetToProfile, budgetValues, learningSchema, learningValues, preferencesSchema, preferencesValues,
  scheduleSchema, scheduleValues, studentChecklist, type BasicValues, type BudgetValues,
} from "./schema";
import { basicRows, budgetRows, learningRows, preferenceRows, scheduleRows, tutorSearchFor, type SummaryRow } from "./summary";
import { useStudentProfile } from "./useStudentProfile";

/** One part of the profile: a summary, and the same fields as the setup step when editing. */
function ProfilePart<T extends FieldValues>({
  id,
  title,
  description,
  rows,
  schema,
  values,
  onSave,
  render,
}: {
  id: string;
  title: string;
  description: string;
  rows: SummaryRow[];
  schema: z.ZodTypeAny;
  values: () => T;
  onSave: (v: T) => Promise<Result<unknown>>;
  render: (form: UseFormReturn<T>) => React.ReactNode;
}) {
  const ed = useEditor();
  const form = useForm<T>({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: values() as DefaultValues<T> });
  return (
    <Section
      id={id}
      title={title}
      description={description}
      editing={ed.editing}
      onEdit={() => {
        form.reset(values());
        ed.open();
      }}
    >
      {ed.editing ? (
        <form noValidate onSubmit={form.handleSubmit((v) => ed.run(onSave(v), `${title} saved`))} className="space-y-6">
          {render(form)}
          <FormActions onCancel={ed.close} error={ed.error} saving={ed.saving} />
        </form>
      ) : (
        <dl className="divide-y divide-line">
          {rows.map((r) => (
            <DetailRow key={r.label} label={r.label}>
              {r.value}
            </DetailRow>
          ))}
        </dl>
      )}
    </Section>
  );
}

export function StudentProfileView() {
  const me = useSession();
  // Deep links such as /dashboard/profile#budget: scroll once the sections exist.
  const ready = !!me;
  React.useEffect(() => {
    if (!ready || !window.location.hash) return;
    const el = document.getElementById(window.location.hash.slice(1));
    if (!el) return;
    const t = setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    return () => clearTimeout(t);
  }, [ready]);
  if (!me) return null;
  return <Profile me={me} />;
}

function Profile({ me }: { me: User }) {
  const profile = useStudentProfile(me.id);
  const save = useApp((s) => s.saveStudentProfile);
  const updateMe = useApp((s) => s.updateMe);
  const teen = !!me.parentalConsent;
  const basic = React.useMemo(() => basicSchema(teen), [teen]);
  const checklist = studentChecklist(me, profile);
  const pct = Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100);
  const query = toQueryString(tutorSearchFor(me, profile));

  const saveBasic = async (v: BasicValues): Promise<Result<unknown>> => {
    const u = await updateMe({ firstName: v.firstName.trim(), lastName: v.lastName.trim(), country: v.country, city: v.city.trim(), state: v.state, zip: v.zip.trim() });
    return u.ok ? save({ age: v.age, gender: v.gender, photoUrl: v.photoUrl }, { step: 1 }) : u;
  };

  return (
    <div>
      <PageHeader
        title="My profile"
        description="Your learning profile. Only you can see it. We use it to suggest tutors who fit you."
        actions={
          <Button asChild variant="secondary">
            <Link href={`/tutors${query ? `?${query}` : ""}`}>
              <Search /> See matching tutors
            </Link>
          </Button>
        }
      />
      {!profile.completedAt && (
        <InlineAlert
          tone="info"
          className="mb-6"
          title={profile.step > 0 ? "Finish setting up your profile" : "Set up your learning profile"}
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/onboarding/student">{profile.step > 0 ? "Continue setup" : "Start setup"}</Link>
            </Button>
          }
        >
          Six short steps: about you, what you want to learn, your ideal tutor, when you&apos;re free, and your budget. Or fill in the sections below one at a time.
        </InlineAlert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <ProfilePart
            id="basic"
            title="Basic information"
            description="Name, age, gender, location and photo."
            rows={basicRows(me, profile)}
            schema={basic}
            values={() => basicValues(me, profile)}
            onSave={saveBasic}
            render={(form) => <BasicFields form={form} me={me} />}
          />
          <ProfilePart
            id="learning"
            title="Learning requirements"
            description="What you want to learn and what you want to achieve."
            rows={learningRows(profile)}
            schema={learningSchema}
            values={() => learningValues(profile)}
            onSave={(v) => save(v, { step: 2 })}
            render={(form) => <LearningFields form={form} />}
          />
          <ProfilePart
            id="preferences"
            title="Tutor preferences"
            description="The kind of tutor you'd like to work with."
            rows={preferenceRows(profile)}
            schema={preferencesSchema}
            values={() => preferencesValues(profile)}
            onSave={(v) => save(v, { step: 3 })}
            render={(form) => <PreferencesFields form={form} />}
          />
          <ProfilePart
            id="schedule"
            title="Schedule & availability"
            description="When you're free for lessons, in your own time zone."
            rows={scheduleRows(profile)}
            schema={scheduleSchema}
            values={() => scheduleValues(profile)}
            onSave={(v) => save(v, { step: 4 })}
            render={(form) => <ScheduleFields form={form} timezone={me.timezone} />}
          />
          <ProfilePart
            id="budget"
            title="Budget & payment"
            description="What you'd like to spend, and how you'll pay when you book."
            rows={budgetRows(profile, currencyForCountry(me.country))}
            schema={budgetSchemaFor(currencyForCountry(me.country))}
            values={() => budgetValues(profile, teen)}
            onSave={(v: BudgetValues) => save(budgetToProfile(v), { step: 5 })}
            render={(form) => <BudgetFields form={form} schedule={profile} />}
          />
        </div>

        <aside className="order-first space-y-6 xl:order-none">
          <div className="space-y-6 xl:sticky xl:top-20">
            <Card>
              <CardContent className="flex items-center gap-4">
                <Avatar name={`${me.firstName} ${me.lastName}`} src={profile.photoUrl || undefined} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">
                    {me.firstName} {me.lastName}
                  </p>
                  <p className="truncate text-[13px] text-muted">{[profile.grade ? GRADE_LABEL[profile.grade] : "Student", me.city].filter(Boolean).join(" · ")}</p>
                </div>
              </CardContent>
              <p className="flex items-start gap-2 border-t border-line px-5 py-3 text-[12.5px] leading-snug text-muted">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Private to you. Tutors don&apos;t see your age, gender, phone or address.
              </p>
            </Card>
            <Card>
              <CardHeader title="Profile strength" description={`${checklist.filter((c) => c.done).length} of ${checklist.length} complete`} action={<span className="text-lg font-semibold tabular-nums text-ink">{pct}%</span>} />
              <CardContent className="pt-3">
                <Progress value={pct} label="Profile completion" tone={pct === 100 ? "success" : "navy"} />
                <ul className="mt-4 space-y-1">
                  {checklist.map((c) => (
                    <li key={c.key}>
                      <a href={`#${c.href.split("#")[1]}`} className="group flex items-center gap-2.5 rounded-md px-1.5 py-1 text-[13px] transition-colors hover:bg-sunken">
                        <span className={cn("grid size-4 shrink-0 place-items-center rounded-full", c.done ? "bg-success text-white" : "border border-line-strong")} aria-hidden>
                          {c.done && <Check className="size-2.5" strokeWidth={3.5} />}
                        </span>
                        <span className={cn("flex-1", c.done ? "text-muted" : "font-medium text-ink")}>
                          {c.label}
                          <span className="sr-only">{c.done ? " (done)" : " (to do)"}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
                <Link href={`/tutors${query ? `?${query}` : ""}`} className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:underline">
                  Tutors that match your profile <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}
