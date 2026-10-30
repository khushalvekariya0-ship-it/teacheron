"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, LayoutDashboard, Lock, LogIn, Pencil, Search, ShieldAlert, Sparkles, UserPlus } from "lucide-react";
import type { StudentProfile, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApp, type Result } from "@/lib/store";
import { useHydrated, useSession } from "@/lib/store/hooks";
import { toQueryString } from "@/lib/search";
import { safeNext } from "@/components/auth/authUtils";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Controls";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { EASE } from "@/components/motion";
import { setSaveExitHandler } from "@/components/onboarding/saveExit";
import { BasicFields, BudgetFields, LearningFields, PreferencesFields, ScheduleFields } from "./fields";
import {
  STUDENT_STEPS, STUDENT_TOTAL_STEPS, basicSchema, basicValues, budgetSchema, budgetToProfile, budgetValues, learningSchema, learningValues,
  preferencesSchema, preferencesValues, scheduleSchema, scheduleValues,
} from "./schema";
import { basicRows, budgetRows, learningRows, preferenceRows, scheduleRows, tutorSearchFor, type SummaryRow } from "./summary";
import { useStudentProfile } from "./useStudentProfile";

/* ─── Entry: gates ──────────────────────────────────────────────────────────── */

export function StudentOnboarding() {
  const hydrated = useHydrated();
  const me = useSession();
  const next = safeNext(useSearchParams().get("next"));
  if (!hydrated) return <WizardSkeleton />;
  if (!me) return <SignedOutGate />;
  if (me.role !== "student") return <WrongRoleGate me={me} />;
  return <Wizard me={me} next={next} />;
}

function GateCard({ icon, title, children, actions }: { icon: React.ReactNode; title: string; children: React.ReactNode; actions: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16 sm:py-24">
      <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm sm:p-10">
        <div className="mx-auto grid size-12 place-items-center rounded-xl border border-line bg-canvas text-navy [&_svg]:size-5">{icon}</div>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.025em] text-ink">{title}</h1>
        <div className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted">{children}</div>
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">{actions}</div>
      </div>
    </div>
  );
}

function SignedOutGate() {
  return (
    <GateCard
      icon={<Lock />}
      title="Create your student account"
      actions={
        <>
          <Button asChild size="lg">
            <Link href="/register?role=student">
              <UserPlus /> Create a student account
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={`/login?next=${encodeURIComponent("/onboarding/student")}`}>
              <LogIn /> Sign in
            </Link>
          </Button>
        </>
      }
    >
      Your learning profile takes about 5 minutes and helps us suggest tutors who fit you.
    </GateCard>
  );
}

function WrongRoleGate({ me }: { me: User }) {
  const parent = me.role === "parent";
  return (
    <GateCard
      icon={<ShieldAlert />}
      title="This setup is for student accounts"
      actions={
        <Button asChild size="lg">
          <Link href={parent ? "/dashboard/children" : me.role === "tutor" ? "/onboarding/tutor" : "/dashboard"}>{parent ? "Add your children" : "Go to your dashboard"}</Link>
        </Button>
      }
    >
      {parent ? "As a parent, you add each child's grade, subjects and goals in Children." : "You're signed in with an account that doesn't have a learning profile."}
    </GateCard>
  );
}

function WizardSkeleton() {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[16rem_1fr] lg:py-14" role="status" aria-label="Loading">
      <div className="hidden space-y-3 lg:block">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="mt-4 h-96 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/* ─── Steps ─────────────────────────────────────────────────────────────────── */

interface StepProps {
  formId: string;
  me: User;
  profile: StudentProfile;
  /** Saves the step; false when the store refused it (the error is shown as a toast). */
  persist: (n: number, values: unknown) => boolean;
  onSaved: () => void;
  /** Lets the wizard save this step's answers (when valid) on Back and Save & exit. */
  bindPending: (fn: () => void) => void;
}

/** A step's <form>: submit saves and moves on; Back / Save & exit save the answers if they're valid. */
function StepForm<T extends FieldValues>({ n, form, schema, formId, persist, onSaved, bindPending, children }: { n: number; form: UseFormReturn<T>; schema: z.ZodTypeAny; children: React.ReactNode } & Pick<StepProps, "formId" | "persist" | "onSaved" | "bindPending">) {
  const { getValues, handleSubmit } = form;
  React.useEffect(() => {
    bindPending(() => {
      const parsed = schema.safeParse(getValues());
      if (parsed.success) persist(n, parsed.data);
    });
  }, [bindPending, getValues, n, persist, schema]);
  return (
    <form id={formId} noValidate onSubmit={handleSubmit((v) => persist(n, v) && onSaved())}>
      {children}
    </form>
  );
}

function BasicStep(p: StepProps) {
  const schema = React.useMemo(() => basicSchema(!!p.me.parentalConsent), [p.me.parentalConsent]);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: basicValues(p.me, p.profile), mode: "onTouched" });
  return (
    <StepForm n={1} form={form} schema={schema} {...p}>
      <BasicFields form={form} me={p.me} />
    </StepForm>
  );
}

function LearningStep(p: StepProps) {
  const form = useForm({ resolver: zodResolver(learningSchema), defaultValues: learningValues(p.profile), mode: "onTouched" });
  return (
    <StepForm n={2} form={form} schema={learningSchema} {...p}>
      <LearningFields form={form} />
    </StepForm>
  );
}

function PreferencesStep(p: StepProps) {
  const form = useForm({ resolver: zodResolver(preferencesSchema), defaultValues: preferencesValues(p.profile), mode: "onTouched" });
  return (
    <StepForm n={3} form={form} schema={preferencesSchema} {...p}>
      <PreferencesFields form={form} />
    </StepForm>
  );
}

function ScheduleStep(p: StepProps) {
  const form = useForm({ resolver: zodResolver(scheduleSchema), defaultValues: scheduleValues(p.profile), mode: "onTouched" });
  return (
    <StepForm n={4} form={form} schema={scheduleSchema} {...p}>
      <ScheduleFields form={form} timezone={p.me.timezone} />
    </StepForm>
  );
}

function BudgetStep(p: StepProps) {
  const form = useForm({ resolver: zodResolver(budgetSchema), defaultValues: budgetValues(p.profile, !!p.me.parentalConsent), mode: "onTouched" });
  return (
    <StepForm n={5} form={form} schema={budgetSchema} {...p}>
      <BudgetFields form={form} schedule={p.profile} />
    </StepForm>
  );
}

export function SummaryBlock({ title, rows, onEdit }: { title: string; rows: SummaryRow[]; onEdit?: () => void }) {
  return (
    <section className="rounded-xl border border-line p-4 sm:p-5" aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {onEdit && (
          <Button variant="ghost" size="xs" onClick={onEdit} aria-label={`Edit ${title.toLowerCase()}`}>
            <Pencil /> Edit
          </Button>
        )}
      </div>
      <dl className="space-y-2 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
            <dt className="text-muted">{r.label}</dt>
            <dd className="min-w-0 break-words text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ReviewStep({ formId, me, profile, onEdit, onFinish }: { formId: string; me: User; profile: StudentProfile; onEdit: (n: number) => void; onFinish: () => void }) {
  return (
    <form
      id={formId}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onFinish();
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryBlock title="Basic information" rows={basicRows(me, profile)} onEdit={() => onEdit(1)} />
        <SummaryBlock title="Learning requirements" rows={learningRows(profile)} onEdit={() => onEdit(2)} />
        <SummaryBlock title="Tutor preferences" rows={preferenceRows(profile)} onEdit={() => onEdit(3)} />
        <SummaryBlock title="Schedule & availability" rows={scheduleRows(profile)} onEdit={() => onEdit(4)} />
      </div>
      <SummaryBlock title="Budget & payment" rows={budgetRows(profile)} onEdit={() => onEdit(5)} />
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <Lock className="size-4 shrink-0 text-navy" aria-hidden /> Only you can see your profile. We use it to suggest tutors who fit you.
      </p>
    </form>
  );
}

/* ─── Done ──────────────────────────────────────────────────────────────────── */

function DoneScreen({ me, profile, next }: { me: User; profile: StudentProfile; next: string | null }) {
  const query = toQueryString(tutorSearchFor(me, profile));
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16 text-center sm:py-24" role="status" aria-live="polite">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.35, duration: 0.7 }}
        className="mx-auto grid size-20 place-items-center rounded-full bg-success-50 text-success"
      >
        <Check className="size-9" strokeWidth={2.4} aria-hidden />
      </motion.div>
      <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-ink">Your learning profile is ready</h1>
      <p className="mt-2 text-[15px] text-muted">Thanks, {me.firstName}. You can change any answer later in My profile.</p>
      <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
        <Button asChild size="lg">
          <Link href={`/tutors${query ? `?${query}` : ""}`}>
            <Search /> See tutors that match you
          </Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href={next ?? "/dashboard"}>
            {next ? "Continue" : "Go to dashboard"} {next ? <ArrowRight /> : <LayoutDashboard />}
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* ─── Wizard ────────────────────────────────────────────────────────────────── */

const STEP_MOTION = {
  enter: (d: number) => ({ opacity: 0, x: d * 16 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -12 }),
};

function Wizard({ me, next }: { me: User; next: string | null }) {
  const router = useRouter();
  const profile = useStudentProfile(me.id);
  const save = useApp((s) => s.saveStudentProfile);
  const updateMe = useApp((s) => s.updateMe);
  const [step, setStep] = React.useState(() => (profile.completedAt ? 1 : Math.min(STUDENT_TOTAL_STEPS, profile.step + 1)));
  const [dir, setDir] = React.useState(1);
  const [finished, setFinished] = React.useState(false);
  const pending = React.useRef<() => void>(() => {});
  const navigated = React.useRef(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const teen = !!me.parentalConsent;
  const furthest = profile.completedAt ? STUDENT_TOTAL_STEPS : Math.min(STUDENT_TOTAL_STEPS, Math.max(step, profile.step + 1));
  const percent = Math.round((Math.min(profile.step, STUDENT_TOTAL_STEPS - 1) / (STUDENT_TOTAL_STEPS - 1)) * 100);
  const meta = STUDENT_STEPS[step - 1];
  const formId = `student-step-${step}`;

  const check = (res: Result<unknown>) => {
    if (!res.ok) toast.error(res.error);
    return res.ok;
  };
  const persist = React.useCallback(
    (n: number, values: unknown): boolean => {
      const ok = (res: Result<unknown>) => {
        if (!res.ok) toast.error(res.error);
        return res.ok;
      };
      if (n === 1) {
        const v = values as ReturnType<typeof basicValues>;
        if (!ok(updateMe({ firstName: v.firstName.trim(), lastName: v.lastName.trim(), city: v.city.trim(), state: v.state, zip: v.zip.trim() }))) return false;
        return ok(save({ age: v.age, gender: v.gender, photoUrl: v.photoUrl }, { step: 1 }));
      }
      if (n === 5) return ok(save(budgetToProfile(values as ReturnType<typeof budgetValues>), { step: 5 }));
      return ok(save(values as Partial<StudentProfile>, { step: n }));
    },
    [save, updateMe],
  );
  const bindPending = React.useCallback((fn: () => void) => {
    pending.current = fn;
  }, []);

  const goTo = (n: number) => {
    pending.current();
    pending.current = () => {};
    setDir(n > step ? 1 : -1);
    navigated.current = true;
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const advance = () => {
    pending.current = () => {};
    setDir(1);
    navigated.current = true;
    setStep((s) => Math.min(STUDENT_TOTAL_STEPS, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const finish = () => {
    const parts: [number, boolean][] = [
      [1, basicSchema(teen).safeParse(basicValues(me, profile)).success],
      [2, learningSchema.safeParse(learningValues(profile)).success],
      [3, preferencesSchema.safeParse(preferencesValues(profile)).success],
      [4, scheduleSchema.safeParse(scheduleValues(profile)).success],
      [5, budgetSchema.safeParse(budgetValues(profile, teen)).success],
    ];
    const missing = parts.find(([, valid]) => !valid);
    if (missing) {
      toast.error(`“${STUDENT_STEPS[missing[0] - 1].title}” needs attention before you finish.`);
      goTo(missing[0]);
      return;
    }
    if (check(save({}, { step: STUDENT_TOTAL_STEPS, complete: true }))) setFinished(true);
  };

  // "Save & exit" in the onboarding header.
  const exitTo = next ?? "/dashboard";
  React.useEffect(() => {
    if (finished) return;
    setSaveExitHandler(() => {
      pending.current();
      toast.success("Progress saved", { description: "Finish your profile any time from your dashboard." });
      router.push(exitTo);
    });
    return () => setSaveExitHandler(null);
  }, [exitTo, finished, router]);

  if (finished) return <DoneScreen me={me} profile={profile} next={next} />;

  const common: StepProps = { formId, me, profile, persist, onSaved: advance, bindPending };
  const content = (() => {
    switch (step) {
      case 1:
        return <BasicStep {...common} />;
      case 2:
        return <LearningStep {...common} />;
      case 3:
        return <PreferencesStep {...common} />;
      case 4:
        return <ScheduleStep {...common} />;
      case 5:
        return <BudgetStep {...common} />;
      default:
        return <ReviewStep formId={formId} me={me} profile={profile} onEdit={goTo} onFinish={finish} />;
    }
  })();

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-10 pt-6 sm:px-6 sm:pt-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12 lg:pb-16 lg:pt-14">
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <p className="text-[13px] font-medium text-ink">Your learning profile</p>
          <div className="mt-2 flex items-center gap-3">
            <Progress value={percent} label="Profile completion" className="flex-1" />
            <span className="text-[12.5px] font-medium tabular-nums text-muted">{percent}%</span>
          </div>
          <nav aria-label="Setup steps" className="mt-6">
            <ol className="relative space-y-0.5">
              <span className="absolute bottom-4 left-[15px] top-4 w-px bg-line" aria-hidden />
              {STUDENT_STEPS.map((s) => {
                const current = s.n === step;
                const reachable = s.n <= furthest;
                const done = s.n <= profile.step && s.n < STUDENT_TOTAL_STEPS;
                return (
                  <li key={s.n} className="relative">
                    <button
                      type="button"
                      disabled={!reachable || current}
                      onClick={() => goTo(s.n)}
                      aria-current={current ? "step" : undefined}
                      className={cn("group relative flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left transition-colors disabled:cursor-default", reachable && !current && "hover:bg-sunken")}
                    >
                      {current && <motion.span layoutId="student-step" className="absolute inset-0 rounded-lg bg-surface shadow-xs ring-1 ring-line" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
                      <span
                        className={cn(
                          "relative grid size-[21px] shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums transition-colors",
                          done ? "bg-navy text-on-ink" : current ? "border-2 border-navy bg-surface text-navy" : "border border-line-strong bg-canvas text-muted",
                        )}
                      >
                        {done ? <Check className="size-3" strokeWidth={3} aria-hidden /> : s.n}
                      </span>
                      <span className={cn("relative text-[13.5px]", current ? "font-semibold text-ink" : reachable ? "font-medium text-ink-2" : "text-muted")}>
                        {s.title}
                        {done && <span className="sr-only"> (saved)</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
          <p className="mt-6 flex gap-2 text-[12.5px] leading-snug text-muted">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-navy" aria-hidden /> Each step saves when you continue. Only you can see your profile.
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="mb-6 lg:hidden">
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="font-medium text-ink">
              Step {step} of {STUDENT_TOTAL_STEPS}
              <span className="text-muted"> · {meta.short}</span>
            </span>
            <span className="tabular-nums text-muted">{percent}% complete</span>
          </div>
          <div className="mt-2 grid grid-cols-6 gap-1" aria-hidden>
            {STUDENT_STEPS.map((s) => (
              <span key={s.n} className={cn("h-1 rounded-full transition-colors duration-300", s.n < step ? "bg-navy" : s.n === step ? "bg-navy/60" : "bg-sunken")} />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={STEP_MOTION}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: EASE }}
            onAnimationComplete={(definition) => {
              if (definition === "center" && navigated.current) {
                navigated.current = false;
                headingRef.current?.focus({ preventScroll: true });
              }
            }}
          >
            <p className="text-[12.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Step {step} of {STUDENT_TOTAL_STEPS}
            </p>
            <h1 ref={headingRef} tabIndex={-1} className="mt-1.5 text-2xl font-semibold tracking-[-0.025em] text-ink outline-none sm:text-[28px]">
              {meta.title}
            </h1>
            <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{meta.description}</p>
            <div className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-xs sm:p-7">{content}</div>
          </motion.div>
        </AnimatePresence>

        <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <div className="flex items-center justify-between gap-3">
            {step === 1 ? (
              <Button asChild variant="ghost">
                <Link href={exitTo}>Do this later</Link>
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => goTo(step - 1)}>
                <ArrowLeft /> Back
              </Button>
            )}
            <Button type="submit" form={formId} size="lg">
              {step === STUDENT_TOTAL_STEPS ? (
                <>
                  <Check /> Finish
                </>
              ) : (
                <>
                  Continue <ArrowRight />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
