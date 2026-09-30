"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import {
  ArrowLeft, ArrowRight, Briefcase, CalendarDays, Check, CircleAlert, ClipboardList, Cloud, Eye, FileX2, Inbox, Loader2, Lock, Send, ShieldCheck,
} from "lucide-react";
import type { Child, Requirement, User } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useHydrated, useNow, useSession } from "@/lib/store/hooks";
import { formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { EmptyState, InlineAlert } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { AnimatePresence, motion, EASE, Reveal, Stagger, StaggerItem, WordReveal } from "@/components/motion";
import { defaultTitle } from "@/components/jobs/jobUtils";
import { cn } from "@/lib/utils";
import {
  PREVIEW_STEP, STEPS, firstInvalidStep, fromRequirement, newForm, toPayload, wizardResolver,
  type FamilyRole, type Prefill, type ReqForm, type WizardContext,
} from "./model";
import { CompactProgress, VerticalStepper } from "./Stepper";
import { StepBudget, StepFormat, StepGoals, StepLearner, StepPreview, StepSchedule } from "./WizardSteps";
import { PublishSuccess } from "./PublishSuccess";
import { Eyebrow } from "@/components/marketing/Section";

/* ─── Entry: auth gates, resume and prefill ────────────────────────────────── */

export function RequirementWizard() {
  const hydrated = useHydrated();
  const me = useSession();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const requirements = useApp((s) => s.requirements);
  const allChildren = useApp((s) => s.children);
  const [createdId, setCreatedId] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);

  const idParam = params.get("id");
  const kids = React.useMemo(() => (me ? allChildren.filter((c) => c.parentId === me.id) : []), [allChildren, me]);

  const onCreated = React.useCallback(
    (id: string) => {
      setCreatedId(id);
      router.replace(`/post-requirement?id=${id}`, { scroll: false });
    },
    [router],
  );
  const onRestart = React.useCallback(() => {
    setCreatedId(null);
    setNonce((n) => n + 1);
    router.replace("/post-requirement", { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [router]);

  if (!hydrated) return <WizardSkeleton />;

  const qs = params.toString();
  const next = `${pathname}${qs ? `?${qs}` : ""}`;
  if (!me) return <SignedOutIntro next={next} />;
  if (me.role !== "student" && me.role !== "parent") return <FamiliesOnly staff={me.role !== "tutor"} />;

  const resuming = !!idParam && idParam !== createdId;
  const req = resuming ? requirements.find((r) => r.id === idParam) : undefined;
  if (resuming && (!req || req.ownerId !== me.id)) {
    return (
      <div className="container-page py-16 sm:py-24">
        <EmptyState
          icon={<FileX2 />}
          title="We couldn't find that requirement"
          description="It may have been deleted, or it belongs to a different account."
          action={
            <>
              <Button onClick={onRestart}>Start a new requirement</Button>
              <Button asChild variant="secondary">
                <Link href="/dashboard/requirements">My requirements</Link>
              </Button>
            </>
          }
        />
      </div>
    );
  }
  if (req?.status === "closed") {
    return (
      <div className="container-page py-16 sm:py-24">
        <EmptyState
          icon={<Lock />}
          title="This requirement is closed"
          description="Closed requirements can't be edited. Post a new one if you still need a tutor."
          action={
            <>
              <Button onClick={onRestart}>Post a new requirement</Button>
              <Button asChild variant="secondary">
                <Link href={`/dashboard/requirements/${req.id}`}>View requirement</Link>
              </Button>
            </>
          }
        />
      </div>
    );
  }

  const prefill: Prefill = {
    subject: params.get("subject") ?? undefined,
    grade: params.get("grade") ?? undefined,
    mode: params.get("mode") ?? undefined,
    zip: params.get("zip") ?? undefined,
    goal: params.get("goal") ?? undefined,
    childId: params.get("childId") ?? undefined,
  };

  return (
    <WizardForm
      key={resuming ? idParam : `new-${nonce}`}
      me={me}
      role={me.role}
      kids={kids}
      requirement={req}
      prefill={prefill}
      onCreated={onCreated}
      onRestart={onRestart}
    />
  );
}

/* ─── The wizard ────────────────────────────────────────────────────────────── */

type SaveState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "saving" }
  | { status: "saved"; at: number }
  | { status: "unsaved" }
  | { status: "error"; message: string };

const STEP_INTRO = [
  "Who the lessons are for and the subject you need help with.",
  "What should tutoring achieve? Specific goals attract better applications.",
  "Online, in person or either. Only your city and ZIP are ever shown to tutors.",
  "The days and times that usually work. Tutors treat this as a preference, not a booking.",
  "Your hourly budget and any preferences for the tutor.",
  "This is exactly what tutors will see. Publish when you're happy with it.",
];

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 18 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -18 }),
};

function WizardForm({
  me,
  role,
  kids,
  requirement,
  prefill,
  onCreated,
  onRestart,
}: {
  me: User;
  role: FamilyRole;
  kids: Child[];
  requirement?: Requirement;
  prefill: Prefill;
  onCreated: (id: string) => void;
  onRestart: () => void;
}) {
  const router = useRouter();
  const saveDraft = useApp((s) => s.saveRequirementDraft);
  const publishRequirement = useApp((s) => s.publishRequirement);
  const now = useNow(15_000);
  const live = !!requirement && requirement.status !== "draft";
  const paused = requirement?.status === "paused";

  const [initial] = React.useState(() => {
    if (requirement) {
      const completed = requirement.status === "draft" ? Math.min(requirement.draftStep ?? 0, PREVIEW_STEP) : PREVIEW_STEP;
      return { values: fromRequirement(requirement), step: requirement.status === "draft" ? completed : 0, completed };
    }
    return { values: newForm(me, kids, prefill), step: 0, completed: 0 };
  });

  const [step, setStep] = React.useState(initial.step);
  const [dir, setDir] = React.useState(1);
  const [maxReached, setMaxReached] = React.useState(initial.completed);
  const [titleAuto, setTitleAuto] = React.useState(() => !initial.values.title || initial.values.title === defaultTitle(initial.values.subject, initial.values.grade));
  const [save, setSave] = React.useState<SaveState>(requirement && !live ? { status: "saved", at: new Date(requirement.updatedAt).getTime() } : { status: "idle" });
  const [published, setPublished] = React.useState<{ req: Requirement; outcome: "published" | "updated" | "saved" } | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [publishError, setPublishError] = React.useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);

  const draftIdRef = React.useRef<string | undefined>(requirement?.id);
  const completedRef = React.useRef(initial.completed);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const topRef = React.useRef<HTMLDivElement>(null);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  const methods = useForm<ReqForm, WizardContext>({
    resolver: wizardResolver,
    context: { step, role },
    defaultValues: initial.values,
    mode: "onTouched",
  });
  const { getValues, trigger, setError, subscribe } = methods;

  /** Saves the draft. Live (published/paused) requirements only save when `force` is set. */
  const persist = React.useCallback(
    (opts: { explicit?: boolean; force?: boolean } = {}): Requirement | null => {
      if (live && !opts.force) return null;
      const v = getValues();
      if (!draftIdRef.current && !(v.subject && v.grade)) return null;
      setSave({ status: "saving" });
      // Only send `id` when it exists — the store spreads input over its defaults, so `id: undefined` would erase the new id.
      const r = saveDraft({
        ...toPayload(v, role),
        ...(draftIdRef.current ? { id: draftIdRef.current } : {}),
        ...(live ? {} : { draftStep: completedRef.current }),
      });
      if (!r.ok) {
        setSave({ status: "error", message: r.error });
        if (opts.explicit) toast.error(r.error);
        return null;
      }
      if (!draftIdRef.current) {
        draftIdRef.current = r.data.id;
        onCreated(r.data.id);
      }
      setSave({ status: "saved", at: Date.now() });
      return r.data;
    },
    [live, getValues, role, saveDraft, onCreated],
  );

  // Debounced autosave while typing (drafts only). Live requirements track unsaved changes instead.
  React.useEffect(() => {
    const unsubscribe = subscribe({
      formState: { values: true },
      callback: ({ type }) => {
        if (type !== "change") return;
        clearTimeout(timer.current);
        if (live) {
          setSave((s) => (s.status === "unsaved" ? s : { status: "unsaved" }));
          return;
        }
        setSave((s) => (s.status === "pending" ? s : { status: "pending" }));
        timer.current = setTimeout(() => persist(), 1200);
      },
    });
    return () => {
      unsubscribe();
      clearTimeout(timer.current);
    };
  }, [subscribe, persist, live]);

  const focusHeading = () => {
    const top = topRef.current;
    if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => headingRef.current?.focus({ preventScroll: true }), 60);
  };

  const showStepErrors = (bad: NonNullable<ReturnType<typeof firstInvalidStep>>) => {
    setDir(bad.step < step ? -1 : 1);
    setStep(bad.step);
    setMaxReached((m) => Math.max(m, bad.step));
    const seen = new Set<string>();
    for (const i of bad.issues) {
      if (seen.has(i.path)) continue;
      seen.add(i.path);
      setError(i.path, { type: "custom", message: i.message });
    }
    focusHeading();
  };

  const goTo = async (target: number) => {
    if (target === step || target < 0 || target > PREVIEW_STEP) return;
    if (target > step) {
      const ok = await trigger(undefined, { shouldFocus: true });
      if (!ok) return;
      completedRef.current = Math.max(completedRef.current, step + 1);
      const bad = firstInvalidStep(getValues(), role);
      if (bad && bad.step < target) {
        showStepErrors(bad);
        return;
      }
    }
    clearTimeout(timer.current);
    persist();
    setDir(target > step ? 1 : -1);
    setMaxReached((m) => Math.max(m, target));
    setStep(target);
    focusHeading();
  };

  const saveAndExit = () => {
    clearTimeout(timer.current);
    if (live) {
      if (save.status === "unsaved") setConfirmDiscard(true);
      else router.push(`/dashboard/requirements/${requirement!.id}`);
      return;
    }
    const saved = persist({ explicit: true });
    if (saved) {
      toast.success("Draft saved", { description: "Pick up where you left off from My requirements." });
      router.push("/dashboard/requirements");
    } else if (!draftIdRef.current) {
      toast("Nothing to save yet", { description: "Choose a subject and grade to start a draft." });
    }
  };

  const publish = () => {
    setPublishError(null);
    const bad = firstInvalidStep(getValues(), role);
    if (bad) {
      showStepErrors(bad);
      toast.error(`Please finish “${STEPS[bad.step].title}” first.`);
      return;
    }
    clearTimeout(timer.current);
    setPublishing(true);
    completedRef.current = PREVIEW_STEP;
    const saved = persist({ explicit: true, force: true });
    if (!saved) {
      setPublishing(false);
      return;
    }
    if (paused) {
      setPublishing(false);
      toast.success("Changes saved");
      setPublished({ req: saved, outcome: "saved" });
      return;
    }
    const r = publishRequirement(saved.id);
    setPublishing(false);
    if (!r.ok) {
      setPublishError(r.error);
      toast.error(r.error);
      return;
    }
    toast.success(live ? "Changes published" : "Requirement published");
    setPublished({ req: r.data, outcome: live ? "updated" : "published" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (published) return <PublishSuccess req={published.req} outcome={published.outcome} onPostAnother={onRestart} />;

  const isPreview = step === PREVIEW_STEP;
  const primaryLabel = isPreview ? (live ? (paused ? "Save changes" : "Publish changes") : "Publish requirement") : `Continue`;

  return (
    <FormProvider {...methods}>
      <div ref={topRef} className="container-page scroll-mt-20 pb-32 pt-8 sm:pt-12 lg:pb-24">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow className="mb-4 text-ink">{live ? "Edit requirement" : "Post a requirement"}</Eyebrow>
            <h1 className="font-heading text-[2.2rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-ink sm:text-5xl">{live ? "Update your requirement" : "Tell tutors what you need"}</h1>
            <p className="mt-3 text-[15px] text-ink-2">{live ? "Changes go live when you save them on the last step." : "About three minutes. Your draft saves as you go."}</p>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <SaveIndicator state={save} now={now} live={live} />
            <Button variant="secondary" size="sm" onClick={saveAndExit}>
              {live ? "Cancel" : "Save & exit"}
            </Button>
          </div>
        </div>

        {paused && (
          <InlineAlert tone="warning" title="This requirement is paused" className="mt-6">
            Saving updates the details but won&apos;t resume it. Resume it from your dashboard when you&apos;re ready for applications.
          </InlineAlert>
        )}

        <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-14">
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              <VerticalStepper step={step} maxReached={maxReached} onSelect={goTo} />
              <p className="flex gap-2.5 rounded-xl bg-canvas p-4 text-[12.5px] leading-relaxed text-ink-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
                Tutors never see your name, email, phone number or address.
              </p>
            </div>
          </aside>

          <div className="min-w-0">
            <CompactProgress step={step} />
            <form
              id="req-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (isPreview) publish();
                else void goTo(step + 1);
              }}
              className="mt-5 rounded-2xl border border-line bg-surface lg:mt-0"
            >
              <div className="border-b border-line px-5 py-5 sm:px-8 sm:py-6">
                <p className="mb-1 hidden text-[12.5px] font-medium tabular-nums text-muted lg:block">
                  Step {step + 1} of {STEPS.length}
                </p>
                <h2 ref={headingRef} tabIndex={-1} className="font-heading text-2xl font-extrabold tracking-[-0.035em] text-ink outline-none sm:text-[1.75rem]">
                  {STEPS[step].title}
                </h2>
                <p className="mt-1 text-sm text-muted">{STEP_INTRO[step]}</p>
              </div>

              <div className="overflow-hidden px-5 py-6 sm:px-8 sm:py-8">
                <AnimatePresence mode="wait" initial={false} custom={dir}>
                  <motion.div key={step} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: EASE }}>
                    {step === 0 && <StepLearner role={role} kids={kids} firstName={me.firstName} titleAuto={titleAuto} setTitleAuto={setTitleAuto} />}
                    {step === 1 && <StepGoals />}
                    {step === 2 && <StepFormat />}
                    {step === 3 && <StepSchedule />}
                    {step === 4 && <StepBudget />}
                    {step === 5 && <StepPreview role={role} now={now} onEdit={(s) => void goTo(s)} />}
                  </motion.div>
                </AnimatePresence>
                {role === "parent" && kids.length === 0 && step === 0 && methods.formState.errors.childId && (
                  <p role="alert" className="mt-3 text-[13px] text-danger">{methods.formState.errors.childId.message}</p>
                )}
                <AnimatePresence>
                  {publishError && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6">
                      <InlineAlert tone="danger" title="We couldn't publish this yet">
                        {publishError}
                      </InlineAlert>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="hidden items-center justify-between gap-3 rounded-b-2xl border-t border-line bg-canvas px-8 py-4 lg:flex">
                <Button type="button" variant="ghost" onClick={() => void goTo(step - 1)} disabled={step === 0}>
                  <ArrowLeft /> Back
                </Button>
                <Button type="submit" size="lg" loading={publishing}>
                  {isPreview ? <Send /> : null}
                  {primaryLabel}
                  {!isPreview && <ArrowRight />}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Mobile action bar */}
        <div data-fixed-bottom className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 py-3 lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-2">
            <Button type="button" variant="secondary" size="icon" onClick={() => void goTo(step - 1)} disabled={step === 0} aria-label="Previous step" className="size-12">
              <ArrowLeft />
            </Button>
            <Button type="submit" form="req-form" size="lg" className="flex-1" loading={publishing}>
              {isPreview ? <Send /> : null}
              {primaryLabel}
              {!isPreview && <ArrowRight />}
            </Button>
          </div>
        </div>

        <ConfirmDialog
          open={confirmDiscard}
          onOpenChange={setConfirmDiscard}
          title="Discard your changes?"
          description="Your live requirement stays exactly as it was."
          confirmLabel="Discard changes"
          tone="danger"
          onConfirm={() => {
            setConfirmDiscard(false);
            router.push(`/dashboard/requirements/${requirement!.id}`);
          }}
        />
      </div>
    </FormProvider>
  );
}

function SaveIndicator({ state, now, live }: { state: SaveState; now: number; live: boolean }) {
  let icon: React.ReactNode;
  let text: string;
  let tone = "text-muted";
  switch (state.status) {
    case "idle":
      icon = <Cloud className="size-3.5" />;
      text = live ? "Editing your live requirement" : "Draft saves automatically";
      break;
    case "pending":
    case "saving":
      icon = <Loader2 className="size-3.5 animate-spin" />;
      text = "Saving draft…";
      break;
    case "saved":
      icon = <Check className="size-3.5 text-success" />;
      text = `Draft saved · ${formatRelative(new Date(Math.min(state.at, now)).toISOString(), now)}`;
      break;
    case "unsaved":
      icon = <CircleAlert className="size-3.5 text-warning" />;
      text = "Unsaved changes";
      break;
    case "error":
      icon = <CircleAlert className="size-3.5" />;
      text = "Couldn't save draft";
      tone = "text-danger";
      break;
  }
  return (
    <p role="status" aria-live="polite" className={cn("inline-flex h-8 items-center text-[13px]", tone)} title={state.status === "error" ? state.message : undefined}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={state.status} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.18 }} className="inline-flex items-center gap-1.5">
          <span aria-hidden>{icon}</span>
          {text}
        </motion.span>
      </AnimatePresence>
    </p>
  );
}

/* ─── Gates ─────────────────────────────────────────────────────────────────── */

function WizardSkeleton() {
  return (
    <div className="container-page pb-24 pt-8 sm:pt-12" role="status" aria-label="Loading">
      <Skeleton className="h-3.5 w-32" />
      <Skeleton className="mt-4 h-9 w-80 max-w-full" />
      <div className="mt-10 grid gap-14 lg:grid-cols-[250px_minmax(0,1fr)]">
        <div className="hidden space-y-4 lg:block">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
        <Skeleton className="h-[460px] rounded-2xl" />
      </div>
    </div>
  );
}

const HOW_IT_WORKS = [
  { icon: ClipboardList, title: "Describe what you need", body: "Subject, grade, goals and any learning-support needs." },
  { icon: CalendarDays, title: "Set format, schedule and budget", body: "Online or in person, the days that work, and your hourly range." },
  { icon: Eye, title: "Preview, then publish", body: "See exactly what tutors will see before it goes live." },
  { icon: Inbox, title: "Review applications", body: "Compare tutors' notes and proposed rates, then message the ones you like." },
];

function SignedOutIntro({ next }: { next: string }) {
  return (
    <section className="relative overflow-hidden bg-brand-soft">
      <div className="container-page relative py-14 sm:py-20 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <Reveal>
              <Eyebrow className="mb-6 text-ink">Post a requirement</Eyebrow>
            </Reveal>
            <WordReveal text="Tell tutors what you need. Let them come to you." className="font-heading text-[2.6rem] font-extrabold leading-[0.98] tracking-[-0.04em] text-ink sm:text-6xl lg:text-[4.2rem]" />
            <Reveal delay={0.2}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/80 sm:text-xl">
                Describe the learner, goals, schedule and budget. Tutors apply with a short note and a proposed rate — you decide who to message.
              </p>
            </Reveal>
            <Reveal delay={0.3} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={`/login?next=${encodeURIComponent(next)}`}>
                  Sign in to post <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href={`/register?next=${encodeURIComponent(next)}`}>Create account</Link>
              </Button>
            </Reveal>
            <Reveal delay={0.35}>
              <p className="mt-6 text-[14px] text-ink/80">
                Posting is free for families. Want suggestions right away?{" "}
                <Link href="/concierge" className="font-semibold text-ink underline decoration-[1.5px] underline-offset-4 hover:decoration-2">
                  Help me find a tutor
                </Link>
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            <div className="rounded-2xl bg-surface p-6 sm:p-8">
              <p className="font-heading text-xl font-extrabold tracking-[-0.03em] text-ink">How it works</p>
              <Stagger as="ol" className="mt-6 space-y-6" stagger={0.08}>
                {HOW_IT_WORKS.map((s, i) => (
                  <StaggerItem as="li" key={s.title} className="flex gap-4">
                    <span className="relative grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-ink">
                      <s.icon className="size-[18px]" aria-hidden />
                      <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-md bg-ink text-[10.5px] font-bold tabular-nums text-on-ink">{i + 1}</span>
                    </span>
                    <div>
                      <h3 className="text-[16px] font-bold text-ink">{s.title}</h3>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{s.body}</p>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
              <p className="mt-7 flex items-start gap-2.5 border-t border-line pt-5 text-[13px] leading-relaxed text-ink-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden />
                Tutors only see your city and ZIP code — never your name, email, phone number or street address.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function FamiliesOnly({ staff }: { staff: boolean }) {
  return (
    <div className="container-page py-16 sm:py-24">
      <EmptyState
        icon={<Briefcase />}
        title="Requirements are posted by families"
        description={
          staff
            ? "Staff accounts can't post requirements. You can review what families have posted on the jobs board or in the admin console."
            : "You're signed in as a tutor. Browse the requirements families have posted and apply with a short note."
        }
        action={
          <>
            <Button asChild>
              <Link href="/tutor-jobs">Browse tutor jobs</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={staff ? "/admin" : "/dashboard"}>{staff ? "Admin console" : "Go to dashboard"}</Link>
            </Button>
          </>
        }
      />
    </div>
  );
}
